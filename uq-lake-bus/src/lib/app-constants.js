import uqChancellorsLockup from "../assets/uq-lockup-classic.svg";
import uqLakesLockup from "../assets/uq-lockup.svg";

export const REFRESH_MS = 30000;
export const FILTER_PENDING_MS = 450;
export const DESTINATION_SEARCH_DEBOUNCE_MS = 220;
export const ALL_ROUTES_ID = "all-routes";
export const BOARD_PAGE_ID = "board";
export const PLANNER_PAGE_ID = "planner";
export const DEFAULT_STOP_ID = "uq-lakes-station";
export const BRISBANE_TZ = "Australia/Brisbane";
export const FAVORITES_STORAGE_KEY = "uq-bus-board-favorites-v1";
export const LIVE_BOARD_CACHE_KEY = "uq-bus-board-live-cache-v1";
export const LIVE_BOARD_CACHE_MAX_AGE_MS = 120_000;

export const STOPS = {
  "uq-lakes-station": {
    id: "uq-lakes-station",
    displayName: "UQ Lakes station",
    switchLabel: "UQ Lakes station",
    themeClass: "theme-lakes",
    themeKey: "lakes",
    searchAliases: [
      "uq",
      "uq lakes",
      "uni of qld",
      "university of queensland",
      "st lucia",
    ],
    studentNote: "",
    logoSrc: uqLakesLockup,
    sheetDescription: "Current live board for the lakeside UQ stop.",
    sourceMode: "live",
  },
  "uq-chancellors-place": {
    id: "uq-chancellors-place",
    displayName: "UQ Chancellor's Place",
    switchLabel: "UQ Chancellor's Place",
    themeClass: "theme-chancellors",
    themeKey: "chancellors",
    searchAliases: [
      "uq",
      "chancellors place",
      "chancellor s place",
      "uni of qld",
      "university of queensland",
      "st lucia",
    ],
    studentNote: "",
    logoSrc: uqChancellorsLockup,
    sheetDescription: "Current live board for Chancellor's Place UQ stop.",
    sourceMode: "preview",
  },
};

export const STOP_OPTIONS = Object.values(STOPS);
