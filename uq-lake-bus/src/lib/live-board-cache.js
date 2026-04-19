import {
  LIVE_BOARD_CACHE_KEY,
  LIVE_BOARD_CACHE_MAX_AGE_MS,
} from "./app-constants";

export function getCachedLiveBoardData() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const payload = JSON.parse(
      window.localStorage.getItem(LIVE_BOARD_CACHE_KEY) ?? "null",
    );

    if (!isValidCachedBoardPayload(payload)) {
      return null;
    }

    if (Date.now() - payload.cachedAt > LIVE_BOARD_CACHE_MAX_AGE_MS) {
      return null;
    }

    return payload.data;
  } catch (storageError) {
    console.error("Could not read cached live board data.", storageError);
    return null;
  }
}

export function cacheLiveBoardData(data) {
  if (typeof window === "undefined" || !isValidBoardData(data)) {
    return;
  }

  try {
    window.localStorage.setItem(
      LIVE_BOARD_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      }),
    );
  } catch (storageError) {
    console.error("Could not cache live board data.", storageError);
  }
}

function isValidCachedBoardPayload(payload) {
  return (
    Boolean(payload) &&
    typeof payload === "object" &&
    typeof payload.cachedAt === "number" &&
    isValidBoardData(payload.data)
  );
}

function isValidBoardData(data) {
  return (
    Boolean(data) &&
    typeof data === "object" &&
    typeof data.stopName === "string" &&
    Array.isArray(data.departures)
  );
}
