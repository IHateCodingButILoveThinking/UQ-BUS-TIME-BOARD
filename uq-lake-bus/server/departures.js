import vm from "node:vm";

import * as cheerio from "cheerio";

const BRISBANE_TZ = "Australia/Brisbane";
const CACHE_TTL_MS = 20_000;
const STOP_SEARCH_CACHE_TTL_MS = 60_000;
const DEFAULT_DEPARTURE_LIMIT = 24;
const MAX_DEPARTURE_LIMIT = 96;
const SOURCE_NAME = "UQ Lakes station";
const DEFAULT_STOP_LOOKUP = SOURCE_NAME;
const departuresCache = new Map();
const stopSearchCache = new Map();
const OFFICIAL_FALLBACK_STOPS = [
  {
    id: "South Bank busway station",
    name: "South Bank busway station",
    aliases: ["South Bank", "Southbank", "South Bank station", "South Bank busway"],
  },
  {
    id: "South Bank station",
    name: "South Bank station",
    aliases: ["South Bank train station"],
  },
  {
    id: "Cultural Centre station",
    name: "Cultural Centre station",
    aliases: [
      "Cultural Centre",
      "Cultural Center",
      "Cultural Ctr",
      "Culture Centre",
      "Culture Center",
      "Culture Ctr",
    ],
  },
  {
    id: "King George Square bus station",
    name: "King George Square bus station",
    aliases: ["King George Square", "KGS"],
  },
  {
    id: "Queen Street bus station",
    name: "Queen Street bus station",
    aliases: ["Queen Street", "Queen St"],
  },
  {
    id: "Roma Street busway station",
    name: "Roma Street busway station",
    aliases: ["Roma Street", "Roma St", "Roma Street busway", "Roma St busway"],
  },
  {
    id: "Roma Street station",
    name: "Roma Street station",
    aliases: ["Roma Street train station", "Roma St station"],
  },
  {
    id: "Upper Mt Gravatt station",
    name: "Upper Mt Gravatt station",
    aliases: [
      "Garden City",
      "Garden City bus station",
      "Garden City station",
      "Garden City shopping centre",
      "Upper Mount Gravatt",
      "Upper Mt Gravatt",
    ],
  },
  {
    id: "UQ Lakes station",
    name: "UQ Lakes station",
    aliases: [
      "UQ Lakes",
      "UQ Lakes station",
      "UQ Lake",
      "University of Queensland",
      "The University of Queensland",
      "University of Qld",
      "University Qld",
      "Uni of Qld",
      "Uni of Queensland",
      "UQ",
    ],
  },
  {
    id: "Buranda busway station",
    name: "Buranda busway station",
    aliases: ["Buranda busway"],
  },
  {
    id: "Buranda station",
    name: "Buranda station",
    aliases: ["Buranda train station"],
  },
  {
    id: "UQ Chancellor's Place",
    name: "UQ Chancellor's Place",
    aliases: [
      "Chancellors Place",
      "Chancellor's Place",
      "UQ Chancellors Place",
      "UQ Chancellor's Place",
      "UQ Chancellor station",
      "UQ Chanceller station",
      "Chanceller Place",
      "Chanceller station",
    ],
  },
];

export async function fetchDepartures(options = {}) {
  const stopLookup = String(options.stopLookup ?? DEFAULT_STOP_LOOKUP).trim();
  const displayName = String(options.displayName ?? "").trim();
  const departureLimit = getDepartureLimit(options.limit);
  const cacheKey = `${stopLookup.toLowerCase()}::${departureLimit}`;
  const cachedEntry = departuresCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const station = await fetchJson(
    `https://jp.translink.com.au/api/stop/timetable/${encodeURIComponent(stopLookup)}`,
  );
  const stationStops = Array.isArray(station?.stops) ? station.stops : [];

  if (!stationStops.length) {
    throw new Error(`Could not find stop data for ${stopLookup}.`);
  }

  const serviceDate = getBrisbaneDate(new Date());
  const now = new Date();
  const stopResults = await Promise.allSettled(
    stationStops.map((stop) => fetchFullTimetable(stop, serviceDate)),
  );

  const stopTimetables = stopResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (stopTimetables.length === 0) {
    throw new Error(`Could not load any timetables for ${stopLookup}.`);
  }

  const departures = stopTimetables
    .flatMap((timetable) => normalizeStopDepartures(timetable, now))
    .sort((left, right) => {
      return (
        new Date(left.scheduledUtc).getTime() -
        new Date(right.scheduledUtc).getTime()
      );
    })
    .slice(0, departureLimit);

  const payload = {
    stopName: displayName || stationStops[0]?.name || stopLookup,
    generatedAt: new Date().toISOString(),
    sourceUrl: `https://jp.translink.com.au/plan-your-journey/stops/${encodeURIComponent(
      stationStops[0]?.id ?? stopLookup,
    )}`,
    departures,
  };

  departuresCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: payload,
  });

  return payload;
}

function getDepartureLimit(limit) {
  const parsedLimit = Number(limit);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_DEPARTURE_LIMIT;
  }

  return Math.min(MAX_DEPARTURE_LIMIT, Math.max(1, Math.floor(parsedLimit)));
}

export async function fetchStopMatches(query) {
  const normalizedQuery = String(query ?? "").trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const cacheKey = normalizedQuery.toLowerCase();
  const cachedEntry = stopSearchCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const fallbackStops = getFallbackStopMatches(normalizedQuery);
  let stops = [];

  try {
    const payload = await fetchJson(
      `https://jp.translink.com.au/api/stop/timetable/${encodeURIComponent(normalizedQuery)}`,
    );
    stops = Array.isArray(payload?.stops)
      ? payload.stops
          .map((stop) => {
            const id = String(stop?.id ?? "").trim();
            const name = String(stop?.name ?? "").trim();

            if (!id || !name) {
              return null;
            }

            return { id, name, aliases: [] };
          })
          .filter(Boolean)
      : [];
  } catch (error) {
    console.error("Could not fetch stop matches from Translink API.", error);
  }

  const uniqueStops = Array.from(
    [...fallbackStops, ...stops].reduce((stopMap, stop) => {
      const stopKey = normalizeStopSearchValue(stop.name);

      if (!stopMap.has(stopKey)) {
        stopMap.set(stopKey, stop);
      }

      return stopMap;
    }, new Map()).values(),
  ).slice(0, 12);

  stopSearchCache.set(cacheKey, {
    expiresAt: Date.now() + STOP_SEARCH_CACHE_TTL_MS,
    value: uniqueStops,
  });

  return uniqueStops;
}

function getFallbackStopMatches(query) {
  const normalizedQuery = normalizeStopSearchValue(query);

  return OFFICIAL_FALLBACK_STOPS.filter((stop) => {
    const searchValues = [stop.name, ...(stop.aliases ?? [])];

    return searchValues.some((value) => {
      const normalizedValue = normalizeStopSearchValue(value);

      return isStopSearchMatch(normalizedQuery, normalizedValue);
    });
  });
}

function isStopSearchMatch(queryKey, valueKey) {
  if (!queryKey || !valueKey) {
    return false;
  }

  if (queryKey === valueKey) {
    return true;
  }

  if (queryKey.length < 4) {
    return valueKey.startsWith(queryKey);
  }

  if (valueKey.length < 4) {
    return false;
  }

  return valueKey.includes(queryKey) || queryKey.includes(valueKey);
}

function normalizeStopSearchValue(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bsouth\b/g, "sth")
    .replace(/\bmount\b/g, "mt")
    .replace(/\s+/g, " ")
    .trim();
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
