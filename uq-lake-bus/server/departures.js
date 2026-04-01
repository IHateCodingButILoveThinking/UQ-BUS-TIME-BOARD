import vm from "node:vm";

import * as cheerio from "cheerio";

const BRISBANE_TZ = "Australia/Brisbane";
const CACHE_TTL_MS = 20_000;
const SOURCE_NAME = "UQ Lakes station";
const STATION_METADATA_URL =
  "https://jp.translink.com.au/api/stop/timetable/uq%20lakes%20station";

let departuresCache = {
  expiresAt: 0,
  value: null,
};

export async function fetchDepartures() {
  if (departuresCache.value && departuresCache.expiresAt > Date.now()) {
    return departuresCache.value;
  }

  const station = await fetchJson(STATION_METADATA_URL);
  const serviceDate = getBrisbaneDate(new Date());
  const now = new Date();
  const stopResults = await Promise.allSettled(
    station.stops.map((stop) => fetchFullTimetable(stop, serviceDate)),
  );

  const stopTimetables = stopResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (stopTimetables.length === 0) {
    throw new Error("Could not load any UQ Lakes stop timetables.");
  }

  const departures = stopTimetables
    .flatMap((timetable) => normalizeStopDepartures(timetable, now))
    .sort((left, right) => {
      return (
        new Date(left.scheduledUtc).getTime() -
        new Date(right.scheduledUtc).getTime()
      );
    })
    .slice(0, 24);

  const payload = {
    stopName: SOURCE_NAME,
    generatedAt: new Date().toISOString(),
    sourceUrl:
      "https://jp.translink.com.au/plan-your-journey/stops/uq%20lakes%20station",
    departures,
  };

  departuresCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: payload,
  };

  return payload;
}

async function fetchJson(url) {
  const request = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!request.ok) {
    throw new Error(`Translink returned ${request.status}`);
  }

  return request.json();
}

async function fetchFullTimetable(stop, serviceDate) {
  const request = await fetch(
    `https://jp.translink.com.au/plan-your-journey/stops/${stop.id}/timetable/${serviceDate}?dateRedirect=false`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "text/html,application/xhtml+xml",
      },
    },
  );

  if (!request.ok) {
    throw new Error(`Timetable for stop ${stop.id} returned ${request.status}`);
  }

  const html = await request.text();
  const initialTimetableData = extractInitialTimetableData(html);

  return {
    stop,
    timetable: initialTimetableData,
  };
}

function extractInitialTimetableData(html) {
  const $ = cheerio.load(html);
  const pushes = [];

  $("script").each((_index, element) => {
    const content = $(element).html();
    if (!content || !content.includes("self.__next_f.push")) {
      return;
    }

    try {
      vm.runInNewContext(content, {
        self: {
          __next_f: {
            push(value) {
              pushes.push(value);
            },
          },
        },
      });
    } catch {
      // Ignore unrelated scripts and continue scanning.
    }
  });

  for (const pushEntry of pushes) {
    const chunk = Array.isArray(pushEntry) ? pushEntry[1] : null;
    if (typeof chunk !== "string" || !chunk.includes("\"initialTimetableData\":")) {
      continue;
    }

    const marker = "\"initialTimetableData\":";
    const objectStart = chunk.indexOf(marker) + marker.length;
    const objectEnd = findBalancedJsonEnd(chunk, objectStart);
    const jsonText = chunk.slice(objectStart, objectEnd);

    return JSON.parse(jsonText);
  }

  throw new Error("Could not extract timetable data from the Translink page.");
}

function findBalancedJsonEnd(text, startIndex) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error("Could not find the end of the timetable JSON object.");
}

function normalizeStopDepartures(stopTimetable, now) {
  const departures = stopTimetable.timetable.departures ?? [];
  const routes = stopTimetable.timetable.routes ?? [];

  return departures
    .filter((departure) => departure.canBoardDebark !== "Alighting")
    .map((departure) => {
      const route = routes.find(
        (candidate) =>
          candidate.id === departure.routeId &&
          candidate.direction === departure.direction,
      );
      const scheduledUtc =
        departure.realtime?.expectedDepartureUtc ?? departure.scheduledDepartureUtc;
      const minutesAway = Math.ceil(
        (new Date(scheduledUtc).getTime() - now.getTime()) / 60000,
      );

      return {
        id: departure.id,
        routeCode: routeCodeFromId(departure.routeId),
        destination: extractDestination(departure.headsign ?? route?.name ?? ""),
        fullHeadsign: departure.headsign ?? route?.name ?? "",
        direction: departure.direction,
        scheduledUtc,
        displayTime: formatTime(scheduledUtc),
        countdownText: formatCountdown(minutesAway),
        countdownMinutes: Math.max(minutesAway, 0),
        stopId: stopTimetable.stop.id,
        stopName: stopTimetable.stop.name,
        platform: departure.departurePlatform ?? platformFromName(stopTimetable.stop.name),
        live: Boolean(departure.realtime),
      };
    })
    .filter((departure) => {
      return new Date(departure.scheduledUtc).getTime() >= now.getTime() - 60_000;
    });
}

function routeCodeFromId(routeId) {
  return routeId?.split(":").at(-1) ?? routeId;
}

function extractDestination(headsign) {
  const segments = headsign
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.at(-1) ?? headsign;
}

function platformFromName(stopName) {
  const match = stopName.match(/stop\s+([A-Z])/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function formatTime(dateTime) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BRISBANE_TZ,
  }).format(new Date(dateTime));
}

function formatCountdown(minutesAway) {
  if (minutesAway <= 0) {
    return "Now";
  }

  if (minutesAway < 60) {
    return `${minutesAway} min`;
  }

  const hours = Math.floor(minutesAway / 60);
  const minutes = minutesAway % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function getBrisbaneDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BRISBANE_TZ,
  });

  return formatter.format(date);
}
