import {
  ALL_ROUTES_ID,
  BOARD_PAGE_ID,
  BRISBANE_TZ,
  DEFAULT_STOP_ID,
  FAVORITES_STORAGE_KEY,
  PLANNER_PAGE_ID,
  STOPS,
} from "./app-constants";

export function getInitialStopId() {
  const stopId = new URLSearchParams(window.location.search).get("stop");
  return isValidStopId(stopId) ? stopId : DEFAULT_STOP_ID;
}

export function getInitialPageId() {
  const pageId = new URLSearchParams(window.location.search).get("page");
  return pageId === PLANNER_PAGE_ID ? PLANNER_PAGE_ID : BOARD_PAGE_ID;
}

export function getInitialRouteId() {
  const routeId = new URLSearchParams(window.location.search)
    .get("route")
    ?.trim();

  return routeId ? routeId : ALL_ROUTES_ID;
}

export function getInitialFavoriteRoutes() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedFavorites = JSON.parse(
      window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]",
    );

    if (!Array.isArray(storedFavorites)) {
      return [];
    }

    return storedFavorites.reduce((favorites, favorite) => {
      if (!isValidFavoriteRoute(favorite)) {
        return favorites;
      }

      const normalizedFavorite = createFavoriteRoute(favorite);
      const alreadySaved = favorites.some((candidate) => {
        return (
          candidate.stopId === normalizedFavorite.stopId &&
          candidate.routeCode === normalizedFavorite.routeCode
        );
      });

      if (alreadySaved) {
        return favorites;
      }

      return [...favorites, normalizedFavorite];
    }, []);
  } catch (storageError) {
    console.error("Could not load saved favourites.", storageError);
    return [];
  }
}

export function isValidStopId(stopId) {
  return typeof stopId === "string" && Object.hasOwn(STOPS, stopId);
}

export function isValidFavoriteRoute(favorite) {
  return (
    Boolean(favorite) &&
    typeof favorite === "object" &&
    isValidStopId(favorite.stopId) &&
    String(favorite.routeCode ?? "").trim().length > 0
  );
}

export function createFavoriteRoute(favorite) {
  return {
    stopId: favorite.stopId,
    routeCode: String(favorite.routeCode).trim(),
  };
}

export function findFavoriteRoute(favorites, stopId, routeCode) {
  return favorites.find((favorite) => {
    return favorite.stopId === stopId && favorite.routeCode === routeCode;
  });
}

export function getStopOptionBadge(selectedStopId, optionId) {
  return selectedStopId === optionId ? "Current" : "Choose";
}

export function buildPreviewBoardData(stop) {
  return {
    stopId: stop.id,
    stopName: stop.displayName,
    generatedAt: new Date().toISOString(),
    sourceUrl: "",
    departures: buildPreviewDepartures(stop.displayName),
  };
}

export function buildPreviewDepartures(stopName) {
  const previewSchedule = [
    {
      routeCode: "402",
      platform: "A",
      minutesAway: 4,
      destination: "Toowong",
      fullHeadsign: "Uni of Qld, St Lucia, Toowong, Indooroopilly",
      direction: "Outbound",
    },
    {
      routeCode: "411",
      platform: "C",
      minutesAway: 7,
      destination: "City",
      fullHeadsign:
        "Uni of Qld, St Lucia, Toowong, Auchenflower, Milton, City",
      direction: "Inbound",
    },
    {
      routeCode: "412",
      platform: "D",
      minutesAway: 12,
      destination: "City",
      fullHeadsign:
        "St Lucia South, Uni of Qld, St Lucia, Toowong, Milton, City",
      direction: "Inbound",
    },
    {
      routeCode: "414",
      platform: "B",
      minutesAway: 18,
      destination: "City",
      fullHeadsign: "Pinjarra Hills, Kenmore, Indooroopilly, Toowong, City",
      direction: "Inbound",
    },
    {
      routeCode: "427",
      platform: "A",
      minutesAway: 24,
      destination: "Indooroopilly",
      fullHeadsign: "Uni of Qld, St Lucia, Taringa, Indooroopilly",
      direction: "Outbound",
    },
    {
      routeCode: "428",
      platform: "B",
      minutesAway: 31,
      destination: "Chapel Hill",
      fullHeadsign:
        "Uni of Qld, St Lucia, Taringa, Indooroopilly, Chapel Hill",
      direction: "Outbound",
    },
    {
      routeCode: "432",
      platform: "E",
      minutesAway: 39,
      destination: "City",
      fullHeadsign: "Moggill Rd, Toowong, City",
      direction: "Inbound",
    },
  ];

  const now = Date.now();

  return previewSchedule.map((departure, index) => {
    const scheduledUtc = new Date(
      now + departure.minutesAway * 60_000,
    ).toISOString();

    return {
      id: `preview-${departure.routeCode}-${index}`,
      routeCode: departure.routeCode,
      destination: departure.destination,
      fullHeadsign: departure.fullHeadsign,
      direction: departure.direction,
      scheduledUtc,
      displayTime: formatTime(scheduledUtc),
      countdownText: formatCountdown(departure.minutesAway),
      countdownMinutes: departure.minutesAway,
      stopId: stopName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
      stopName,
      platform: departure.platform,
      live: false,
    };
  });
}

export function formatPlatform(platform) {
  return platform ? `Stop ${platform}` : "UQ";
}

export function formatTime(dateTime) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BRISBANE_TZ,
  }).format(new Date(dateTime));
}

export function formatCountdown(minutesAway) {
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

export function getRouteKind(routeCode) {
  return /[A-Za-z]/.test(routeCode) && /\d/.test(routeCode) ? "metro" : "bus";
}

export function formatRouteCount(count) {
  return `${count} ${count === 1 ? "bus" : "buses"}`;
}

export function formatRouteSummary(headsign, fallback) {
  const segments = (headsign || "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0]} - ${segments.at(-1)}`;
  }

  return segments[0] || fallback || "";
}

export function buildAppUrl({ baseUrl, pageId, stopId, routeCode }) {
  const url = new URL(baseUrl);

  if (!pageId || pageId === BOARD_PAGE_ID) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", pageId);
  }

  if (stopId === DEFAULT_STOP_ID) {
    url.searchParams.delete("stop");
  } else {
    url.searchParams.set("stop", stopId);
  }

  if (!routeCode || routeCode === ALL_ROUTES_ID) {
    url.searchParams.delete("route");
  } else {
    url.searchParams.set("route", routeCode);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
