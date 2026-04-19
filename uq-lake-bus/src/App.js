import { useEffect, useMemo, useState } from "react";
import {
  FaBroadcastTower,
  FaBusAlt,
  FaClock,
  FaExchangeAlt,
  FaMapMarkerAlt,
  FaRoute,
  FaSearch,
  FaTimesCircle,
  FaUniversity,
} from "react-icons/fa";
import { ToastContainer, cssTransition, toast } from "react-toastify";

import uqChancellorsLockup from "./assets/uq-lockup-classic.svg";
import uqLakesLockup from "./assets/uq-lockup.svg";

const REFRESH_MS = 30000;
const FILTER_PENDING_MS = 450;
const DESTINATION_SEARCH_DEBOUNCE_MS = 220;
const PLANNER_DEPARTURE_LIMIT = 96;
const ALL_ROUTES_ID = "all-routes";
const BOARD_PAGE_ID = "board";
const PLANNER_PAGE_ID = "planner";
const DEFAULT_STOP_ID = "uq-lakes-station";
const BRISBANE_TZ = "Australia/Brisbane";
const FAVORITES_STORAGE_KEY = "uq-bus-board-favorites-v1";
const stopSearchCache = new Map();
const toastTransition = cssTransition({
  enter: "bus-toast-enter",
  exit: "bus-toast-exit",
  duration: [280, 220],
  collapse: true,
});
const PLANNER_QUICK_STOPS = [
  {
    label: "UQ Lakes",
    value: "UQ Lakes station",
  },
  {
    label: "Chancellor's",
    value: "UQ Chancellor's Place",
  },
];

const STOPS = {
  "uq-lakes-station": {
    id: "uq-lakes-station",
    displayName: "UQ Lakes station",
    switchLabel: "UQ Lakes station",
    themeClass: "theme-lakes",
    themeKey: "lakes",
    searchAliases: ["uq", "uq lakes", "uni of qld", "university of queensland", "st lucia"],
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

const STOP_OPTIONS = Object.values(STOPS);
const OFFICIAL_STATION_CHOICES = [
  {
    label: "South Bank busway station",
    aliases: ["South Bank", "Southbank", "South Bank station", "South Bank busway"],
  },
  {
    label: "South Bank station",
    aliases: ["South Bank train station"],
  },
  {
    label: "Cultural Centre station",
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
    label: "King George Square bus station",
    aliases: ["King George Square", "KGS"],
  },
  {
    label: "Queen Street bus station",
    aliases: ["Queen Street", "Queen St"],
  },
  {
    label: "Roma Street busway station",
    aliases: ["Roma Street", "Roma St", "Roma Street busway", "Roma St busway"],
  },
  {
    label: "Roma Street station",
    aliases: ["Roma Street train station", "Roma St station"],
  },
  {
    label: "Upper Mt Gravatt station",
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
    label: "UQ Lakes station",
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
    label: "UQ Chancellor's Place",
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
  {
    label: "Buranda busway station",
    aliases: ["Buranda busway"],
  },
  {
    label: "Buranda station",
    aliases: ["Buranda train station"],
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPageId);
  const [selectedStopId, setSelectedStopId] = useState(getInitialStopId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(getInitialRouteId);
  const [appliedRoute, setAppliedRoute] = useState(getInitialRouteId);
  const [filterPending, setFilterPending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stopSheetOpen, setStopSheetOpen] = useState(false);
  const [plannerOriginQuery, setPlannerOriginQuery] = useState("");
  const [plannerDestinationQuery, setPlannerDestinationQuery] = useState("");
  const [plannerOriginStops, setPlannerOriginStops] = useState([]);
  const [plannerDestinationStops, setPlannerDestinationStops] = useState([]);
  const [plannerOriginPending, setPlannerOriginPending] = useState(false);
  const [plannerDestinationPending, setPlannerDestinationPending] =
    useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState("");
  const [plannerSearchResult, setPlannerSearchResult] = useState(null);
  const [favoriteRoutes, setFavoriteRoutes] = useState(
    getInitialFavoriteRoutes,
  );

  const activeStop = STOPS[selectedStopId] ?? STOPS[DEFAULT_STOP_ID];
  const activeData =
    activeStop.sourceMode === "preview"
      ? buildPreviewBoardData(activeStop)
      : data;
  const departures = activeData?.departures ?? [];
  const activeFavorites = useMemo(() => {
    return favoriteRoutes
      .filter((favorite) => favorite.stopId === selectedStopId)
      .sort((left, right) =>
        left.routeCode.localeCompare(right.routeCode, "en", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [favoriteRoutes, selectedStopId]);
  const favoriteRouteCodes = useMemo(() => {
    return new Set(activeFavorites.map((favorite) => favorite.routeCode));
  }, [activeFavorites]);
  const showLoadingState =
    activeStop.sourceMode === "live" && loading && !activeData;
  const showError = activeStop.sourceMode === "live" && error;
  const modalOpen =
    currentPage === BOARD_PAGE_ID && (filterOpen || stopSheetOpen);

  useEffect(() => {
    let timerId;
    let isActive = true;

    const loadDepartures = async ({ silent } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/departures");
        if (!response.ok) {
          throw new Error("Could not load departures.");
        }

        const nextData = await response.json();
        if (!isActive) {
          return;
        }

        setData(nextData);
        setError("");
      } catch (fetchError) {
        if (!isActive) {
          return;
        }

        console.error(fetchError);
        setError("Unable to load buses right now.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadDepartures();
    timerId = window.setInterval(() => {
      loadDepartures({ silent: true });
    }, REFRESH_MS);

    return () => {
      isActive = false;
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const scrollY = window.scrollY;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
        setStopSheetOpen(false);
      }
    };

    document.documentElement.classList.add("filter-sheet-open");
    document.body.classList.add("filter-sheet-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("filter-sheet-open");
      document.body.classList.remove("filter-sheet-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(favoriteRoutes),
      );
    } catch (storageError) {
      console.error("Could not save favourite routes.", storageError);
    }
  }, [favoriteRoutes]);

  useEffect(() => {
    document.documentElement.dataset.stopTheme = activeStop.themeKey;
    document.documentElement.dataset.page = currentPage;
    document.body.dataset.stopTheme = activeStop.themeKey;
    document.body.dataset.page = currentPage;
    document.title =
      currentPage === PLANNER_PAGE_ID
        ? "Direct Bus Planner"
        : `${activeStop.switchLabel} Bus Board`;

    return () => {
      document.documentElement.removeAttribute("data-stop-theme");
      document.documentElement.removeAttribute("data-page");
      document.body.removeAttribute("data-stop-theme");
      document.body.removeAttribute("data-page");
    };
  }, [activeStop.themeKey, activeStop.switchLabel, currentPage]);

  useEffect(() => {
    window.history.replaceState(
      {},
      "",
      buildAppUrl({
        baseUrl: window.location.href,
        pageId: currentPage,
        routeCode: selectedRoute,
        stopId: selectedStopId,
      }),
    );
  }, [currentPage, selectedRoute, selectedStopId]);

  const routeOptions = useMemo(() => {
    const groupedRoutes = departures.reduce((routeMap, departure) => {
      const routeId = departure.routeCode || "Bus";
      const existingRoute = routeMap.get(routeId) ?? {
        id: routeId,
        short: routeId,
        label: routeId,
        count: 0,
      };

      existingRoute.count += 1;
      routeMap.set(routeId, existingRoute);
      return routeMap;
    }, new Map());

    return [
      {
        id: ALL_ROUTES_ID,
        short: "All",
        label: "Show all buses",
        count: departures.length,
      },
      ...Array.from(groupedRoutes.values()).sort((left, right) =>
        left.short.localeCompare(right.short, "en", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    ];
  }, [departures]);

  const visibleDepartures = useMemo(() => {
    if (appliedRoute === ALL_ROUTES_ID) {
      return departures;
    }

    return departures.filter(
      (departure) => departure.routeCode === appliedRoute,
    );
  }, [appliedRoute, departures]);
  const plannerOriginOptions = useMemo(() => {
    return plannerOriginStops;
  }, [plannerOriginStops]);
  const plannerDestinationOptions = useMemo(() => {
    return plannerDestinationStops;
  }, [plannerDestinationStops]);
  const plannerResultDepartures = plannerSearchResult?.departures ?? [];
  const plannerEmptyMessage = plannerSearchResult?.emptyMessage ?? "";

  useEffect(() => {
    if (currentPage !== PLANNER_PAGE_ID) {
      return undefined;
    }

    setPlannerOriginQuery((currentQuery) => currentQuery || activeStop.displayName);
  }, [activeStop.displayName, currentPage]);

  useEffect(() => {
    const nextQuery = plannerOriginQuery.trim();

    if (!nextQuery) {
      setPlannerOriginPending(false);
      setPlannerOriginStops([]);
      return undefined;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setPlannerOriginPending(true);

      try {
        const nextStops = await fetchTranslinkStops(nextQuery);

        if (!isActive) {
          return;
        }

        setPlannerOriginStops(nextStops);
      } catch (searchError) {
        if (!isActive) {
          return;
        }

        console.error("Could not search Translink stops.", searchError);
        setPlannerOriginStops([]);
      } finally {
        if (isActive) {
          setPlannerOriginPending(false);
        }
      }
    }, DESTINATION_SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [plannerOriginQuery]);

  useEffect(() => {
    const nextQuery = plannerDestinationQuery.trim();

    if (!nextQuery) {
      setPlannerDestinationPending(false);
      setPlannerDestinationStops([]);
      return undefined;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setPlannerDestinationPending(true);

      try {
        const nextStops = await fetchTranslinkStops(nextQuery);

        if (!isActive) {
          return;
        }

        setPlannerDestinationStops(nextStops);
      } catch (searchError) {
        if (!isActive) {
          return;
        }

        console.error("Could not search Translink stops.", searchError);
        setPlannerDestinationStops([]);
      } finally {
        if (isActive) {
          setPlannerDestinationPending(false);
        }
      }
    }, DESTINATION_SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [plannerDestinationQuery]);

  useEffect(() => {
    if (activeStop.sourceMode === "live" && loading && departures.length === 0) {
      return;
    }

    const hasSelectedRoute = routeOptions.some(
      (option) => option.id === selectedRoute,
    );
    const hasAppliedRoute = routeOptions.some(
      (option) => option.id === appliedRoute,
    );

    if (!hasSelectedRoute) {
      setSelectedRoute(ALL_ROUTES_ID);
      setAppliedRoute(ALL_ROUTES_ID);
      setFilterPending(false);
      setFilterOpen(false);
      return;
    }

    if (!hasAppliedRoute) {
      setAppliedRoute(ALL_ROUTES_ID);
      setFilterPending(false);
      setFilterOpen(false);
    }
  }, [
    activeStop.sourceMode,
    appliedRoute,
    departures.length,
    loading,
    routeOptions,
    selectedRoute,
  ]);

  useEffect(() => {
    if (selectedRoute === appliedRoute) {
      setFilterPending(false);
      return undefined;
    }

    setFilterPending(true);
    const timeoutId = window.setTimeout(() => {
      setAppliedRoute(selectedRoute);
      setFilterPending(false);
    }, FILTER_PENDING_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appliedRoute, selectedRoute]);

  const boardDepartures = departures;
  const nextDeparture = boardDepartures[0];
  const closestDepartures = nextDeparture
    ? boardDepartures.filter(
        (departure) => departure.displayTime === nextDeparture.displayTime,
      )
    : [];
  const boardUpcoming = boardDepartures.slice(
    closestDepartures.length,
    closestDepartures.length + 4,
  );
  const feedDepartures =
    selectedRoute === ALL_ROUTES_ID
      ? departures.slice(
          closestDepartures.length + 4,
          closestDepartures.length + 20,
        )
      : visibleDepartures.slice(0, 16);
  const selectedRouteIsAll = selectedRoute === ALL_ROUTES_ID;
  const closestDisplayDepartures = closestDepartures.slice(0, 3);
  const closestStopLabels = Array.from(
    new Set(
      closestDisplayDepartures.map((departure) =>
        formatPlatform(departure.platform),
      ),
    ),
  );
  const closestHasSaved = closestDisplayDepartures.some((departure) => {
    return favoriteRouteCodes.has(departure.routeCode);
  });
  const plannerHasSearched = Boolean(plannerSearchResult);
  const plannerBusy =
    plannerLoading || plannerOriginPending || plannerDestinationPending;
  const footerSourceUrl =
    currentPage === PLANNER_PAGE_ID
      ? plannerSearchResult?.sourceUrl
      : activeData?.sourceUrl;

  const handlePageChange = (pageId) => {
    if (![BOARD_PAGE_ID, PLANNER_PAGE_ID].includes(pageId)) {
      return;
    }

    setFilterOpen(false);
    setStopSheetOpen(false);

    if (pageId === PLANNER_PAGE_ID) {
      setPlannerOriginQuery((currentQuery) => currentQuery || activeStop.displayName);
    }

    setCurrentPage(pageId);
  };

  const handlePlannerOriginChange = (value) => {
    setPlannerError("");
    setPlannerOriginQuery(value);
  };

  const handlePlannerDestinationChange = (value) => {
    setPlannerError("");
    setPlannerDestinationQuery(value);
  };

  const performPlannerSearch = async ({
    destinationQuery,
    originQuery,
    showMissingToast = true,
  }) => {
    const nextOriginQuery = String(originQuery ?? "").trim();
    const nextDestinationQuery = String(destinationQuery ?? "").trim();

    if (!nextOriginQuery || !nextDestinationQuery) {
      if (showMissingToast) {
        toast.info("Choose both stops first.", {
          className: "bus-toast bus-toast-info",
          bodyClassName: "bus-toast-body",
        });
      }
      return false;
    }

    setPlannerLoading(true);
    setPlannerError("");

    try {
      const [matchedOriginStops, matchedDestinationStops] = await Promise.all([
        fetchTranslinkStops(nextOriginQuery),
        fetchTranslinkStops(nextDestinationQuery),
      ]);

      setPlannerOriginStops(matchedOriginStops);
      setPlannerDestinationStops(matchedDestinationStops);

      const originStop = resolveSearchStop(nextOriginQuery, matchedOriginStops);
      const destinationStop = resolveSearchStop(
        nextDestinationQuery,
        matchedDestinationStops,
      );

      if (!originStop) {
        toast.error("Choose a real Translink origin stop.", {
          className: "bus-toast bus-toast-error",
          bodyClassName: "bus-toast-body",
        });
        setPlannerSearchResult(null);
        return false;
      }

      if (!destinationStop) {
        toast.error("Choose a real Translink destination stop.", {
          className: "bus-toast bus-toast-error",
          bodyClassName: "bus-toast-body",
        });
        setPlannerSearchResult(null);
        return false;
      }

      if (
        normalizeSearchCandidate(originStop.label) ===
        normalizeSearchCandidate(destinationStop.label)
      ) {
        toast.info("Choose two different stops.", {
          className: "bus-toast bus-toast-info",
          bodyClassName: "bus-toast-body",
        });
        return false;
      }

      const [originDeparturesPayload, destinationDeparturesPayload] =
        await Promise.all([
          fetchStopDepartures({
            limit: PLANNER_DEPARTURE_LIMIT,
            stopId: originStop.id,
            stopName: originStop.label,
          }),
          fetchStopDepartures({
            limit: PLANNER_DEPARTURE_LIMIT,
            stopId: destinationStop.id,
            stopName: destinationStop.label,
          }),
        ]);
      const availableDepartures = Array.isArray(originDeparturesPayload.departures)
        ? originDeparturesPayload.departures
        : [];
      const availableDestinationDepartures = Array.isArray(
        destinationDeparturesPayload.departures,
      )
        ? destinationDeparturesPayload.departures
        : [];
      const matches = availableDepartures.filter((departure) => {
        return Boolean(
          findPlannerDepartureMatch(
            departure,
            destinationStop,
            originStop,
            availableDestinationDepartures,
          ),
        );
      });
      const noServicesRunning = availableDepartures.length === 0;
      const emptyMessage = noServicesRunning
        ? `No buses are running from ${originStop.label} right now. Services may have finished for the day.`
        : `Cannot find a direct bus from ${originStop.label} to ${destinationStop.label} right now.`;

      setPlannerOriginQuery(originStop.label);
      setPlannerDestinationQuery(destinationStop.label);
      setPlannerSearchResult({
        departures: matches,
        destinationStop,
        emptyMessage,
        generatedAt: originDeparturesPayload.generatedAt,
        originStop,
        sourceUrl: originDeparturesPayload.sourceUrl,
        stopName: originDeparturesPayload.stopName,
      });

      if (noServicesRunning) {
        toast.info(
          `No buses are running from ${originStop.label} right now.`,
          {
            className: "bus-toast bus-toast-info",
            bodyClassName: "bus-toast-body",
          },
        );
        return false;
      }

      if (!matches.length) {
        toast.info(emptyMessage, {
          className: "bus-toast bus-toast-info",
          bodyClassName: "bus-toast-body",
        });
        return false;
      }

      toast.success(
        `Showing ${matches.length} direct ${
          matches.length === 1 ? "bus" : "buses"
        } to ${destinationStop.label}.`,
        {
          className: "bus-toast bus-toast-success",
          bodyClassName: "bus-toast-body",
        },
      );
      return true;
    } catch (searchError) {
      console.error("Could not load planner departures.", searchError);
      setPlannerError("Could not load direct buses right now.");
      setPlannerSearchResult(null);
      toast.error("Could not load direct buses right now.", {
        className: "bus-toast bus-toast-error",
        bodyClassName: "bus-toast-body",
      });
      return false;
    } finally {
      setPlannerLoading(false);
    }
  };

  const handlePlannerSwapStations = () => {
    const nextOriginQuery = plannerDestinationQuery;
    const nextDestinationQuery = plannerOriginQuery;

    setPlannerError("");
    setPlannerSearchResult(null);
    setPlannerOriginQuery(nextOriginQuery);
    setPlannerDestinationQuery(nextDestinationQuery);
    setPlannerOriginStops(plannerDestinationStops);
    setPlannerDestinationStops(plannerOriginStops);

    if (nextOriginQuery.trim() && nextDestinationQuery.trim()) {
      void performPlannerSearch({
        destinationQuery: nextDestinationQuery,
        originQuery: nextOriginQuery,
        showMissingToast: false,
      });
    }
  };

  const handleStopSelection = (stopId) => {
    if (!isValidStopId(stopId)) {
      return;
    }

    setStopSheetOpen(false);

    if (stopId === selectedStopId) {
      return;
    }

    setSelectedRoute(ALL_ROUTES_ID);
    setAppliedRoute(ALL_ROUTES_ID);
    setFilterPending(false);
    setFilterOpen(false);
    setSelectedStopId(stopId);
  };

  const handlePlannerSearch = (event) => {
    event.preventDefault();
    void performPlannerSearch({
      destinationQuery: plannerDestinationQuery,
      originQuery: plannerOriginQuery,
    });
  };

  const clearPlannerSearch = () => {
    setPlannerOriginQuery("");
    setPlannerDestinationQuery("");
    setPlannerOriginStops([]);
    setPlannerDestinationStops([]);
    setPlannerError("");
    setPlannerSearchResult(null);
  };

  const toggleFavoriteRoute = (routeCode) => {
    if (!routeCode || routeCode === ALL_ROUTES_ID) {
      return;
    }

    const existingFavorite = findFavoriteRoute(
      favoriteRoutes,
      selectedStopId,
      routeCode,
    );

    if (existingFavorite) {
      setFavoriteRoutes((currentFavorites) => {
        return currentFavorites.filter((favorite) => {
          return !(
            favorite.stopId === selectedStopId &&
            favorite.routeCode === routeCode
          );
        });
      });
      toast.info(`Bus ${routeCode} removed from favourites.`, {
        className: "bus-toast bus-toast-info",
        bodyClassName: "bus-toast-body",
      });
      return;
    }

    setFavoriteRoutes((currentFavorites) => {
      return [
        ...currentFavorites,
        createFavoriteRoute({
          stopId: selectedStopId,
          routeCode,
        }),
      ];
    });
    toast.success(`Bus ${routeCode} saved to favourites.`, {
      className: "bus-toast bus-toast-success",
      bodyClassName: "bus-toast-body",
    });
  };

  return (
    <main className={`app-shell ${activeStop.themeClass} page-${currentPage}`}>
      <nav className="surface-panel page-switcher" aria-label="Choose page">
        <span
          aria-hidden="true"
          className={`page-switcher-indicator ${
            currentPage === PLANNER_PAGE_ID ? "planner" : "board"
          }`}
        />
        <button
          type="button"
          className={`page-switcher-button ${
            currentPage === BOARD_PAGE_ID ? "active" : ""
          }`}
          aria-pressed={currentPage === BOARD_PAGE_ID}
          onClick={() => handlePageChange(BOARD_PAGE_ID)}
        >
          <FaBusAlt className="page-switcher-icon" aria-hidden="true" />
          <span>Live board</span>
        </button>
        <button
          type="button"
          className={`page-switcher-button ${
            currentPage === PLANNER_PAGE_ID ? "active" : ""
          }`}
          aria-pressed={currentPage === PLANNER_PAGE_ID}
          onClick={() => handlePageChange(PLANNER_PAGE_ID)}
        >
          <FaRoute className="page-switcher-icon" aria-hidden="true" />
          <span>Trip planner</span>
        </button>
      </nav>

      {currentPage === BOARD_PAGE_ID ? (
        <>
          <div className="side-stack">
            <section className="surface-panel hero-panel">
              <div className="hero-glow hero-glow-top" aria-hidden="true" />
              <div className="hero-glow hero-glow-bottom" aria-hidden="true" />

              <div className="hero-topbar">
                <div className="hero-copy">
                  <div className="brand-copy">
                    <div className="brand-copy-top">
                      <p className="eyebrow">{activeStop.displayName}</p>
                      {activeStop.studentNote ? (
                        <span className="student-note">
                          {activeStop.studentNote}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className={`stop-control ${stopSheetOpen ? "open" : ""}`}
                      aria-expanded={stopSheetOpen}
                      aria-haspopup="listbox"
                      aria-label={`Switch UQ bus stop. Current stop ${activeStop.switchLabel}`}
                      onClick={() => {
                        setFilterOpen(false);
                        setStopSheetOpen((currentOpen) => !currentOpen);
                      }}
                    >
                      <span
                        className={`stop-control-icon ${showLoadingState ? "pending" : ""}`}
                        aria-hidden="true"
                      >
                        {showLoadingState ? <SpinnerIcon /> : <SwitchIcon />}
                      </span>
                      <span className="stop-control-label">Switch stop</span>
                      <span className="stop-control-arrow" aria-hidden="true">
                        <ChevronIcon />
                      </span>
                    </button>
                  </div>
                </div>

                <img
                  className="uq-lockup"
                  src={activeStop.logoSrc}
                  alt="The University of Queensland Australia"
                />
              </div>

              {nextDeparture ? (
                <article className="next-card">
                  <div className="board-header">
                    <p className="eyebrow board-eyebrow">
                      {closestDepartures.length > 1
                        ? "Closest departures"
                        : "Closest departure"}
                    </p>
                  </div>

                  <div className="board-primary">
                    <article
                      className={`board-primary-item ${
                        closestHasSaved ? "saved" : ""
                      }`}
                    >
                      <div className="board-primary-topline">
                        <div className="board-route-group">
                          {closestDisplayDepartures.map((departure) => (
                            <RouteToken
                              code={departure.routeCode}
                              className={`board-route-pill ${
                                favoriteRouteCodes.has(departure.routeCode)
                                  ? "saved"
                                  : ""
                              }`}
                              key={`closest-route-${departure.id}`}
                              saved={favoriteRouteCodes.has(
                                departure.routeCode,
                              )}
                              showMarkers
                            />
                          ))}
                        </div>
                        <strong>{nextDeparture.displayTime}</strong>
                      </div>

                      <div className="board-primary-bottomline">
                        <div className="board-stop-group">
                          {closestStopLabels.map((stopLabel) => (
                            <span className="board-stop-chip" key={stopLabel}>
                              {stopLabel}
                            </span>
                          ))}
                        </div>
                        <span className="board-primary-time-note">
                          {nextDeparture.countdownText}
                        </span>
                      </div>
                    </article>
                  </div>

                  <div className="mini-board">
                    <span className="mini-board-label">Next 4 upcoming</span>

                    {boardUpcoming.length ? (
                      <div className="mini-board-list">
                        {boardUpcoming.map((departure) => {
                          const isFavorite = favoriteRouteCodes.has(
                            departure.routeCode,
                          );

                          return (
                            <article
                              className={`mini-board-item ${
                                isFavorite ? "saved" : ""
                              }`}
                              key={departure.id}
                            >
                              <div className="mini-board-topline">
                                <RouteToken
                                  code={departure.routeCode}
                                  className={`mini-board-route ${
                                    isFavorite ? "saved" : ""
                                  }`}
                                  saved={isFavorite}
                                  showMarkers
                                />
                                <strong>{departure.displayTime}</strong>
                              </div>
                              <div className="mini-board-bottomline">
                                <span className="mini-board-stop">
                                  {formatPlatform(departure.platform)}
                                </span>
                                <span className="mini-board-time-note">
                                  {departure.countdownText}
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mini-board-empty">
                        No more upcoming buses.
                      </div>
                    )}
                  </div>
                </article>
              ) : (
                <EmptyState
                  message={
                    activeStop.sourceMode === "preview"
                      ? "Preview frame ready for Chancellor's Place."
                      : "No buses right now."
                  }
                />
              )}
            </section>

            {showError ? (
              <section className="surface-panel error-card">{error}</section>
            ) : null}

            <section className="surface-panel controls-panel">
              <div className="controls-grid">
                <div
                  className={`filter-control-shell ${filterOpen ? "open" : ""}`}
                >
                  <button
                    type="button"
                    className={`filter-control ${
                      filterPending ? "pending" : ""
                    } ${filterOpen ? "open" : ""}`}
                    aria-expanded={filterOpen}
                    aria-haspopup="listbox"
                    onClick={() => {
                      if (filterPending) {
                        return;
                      }

                      setStopSheetOpen(false);
                      setFilterOpen((currentOpen) => !currentOpen);
                    }}
                  >
                    <div className="filter-control-copy">
                      <span className="filter-control-label">
                        Choose bus number
                      </span>
                      <strong className="filter-control-value">
                        {selectedRouteIsAll ? (
                          "All routes"
                        ) : (
                          <RouteToken
                            code={selectedRoute}
                            className="filter-control-route-token"
                          />
                        )}
                      </strong>
                    </div>
                    <span
                      className={`filter-control-icon ${
                        filterPending ? "pending" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {filterPending ? <SpinnerIcon /> : <ChevronIcon />}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="surface-panel feed-panel">
            <div className="section-head feed-head">
              <div>
                <p className="eyebrow">Arrivals</p>
                <h2 className="section-title">Upcoming buses</h2>
              </div>
              <div className="section-head-meta">
                {filterPending ? (
                  <p className="section-note">Updating route...</p>
                ) : null}
              </div>
            </div>

            {showLoadingState ? (
              <div className="feed-list">
                {[1, 2, 3, 4].map((item) => (
                  <article className="departure-card skeleton-card" key={item} />
                ))}
              </div>
            ) : filterPending ? (
              <>
                <div className="feed-loading-status">
                  Loading selected route...
                </div>
                <div className="feed-list feed-list-pending">
                  {[1, 2, 3].map((item) => (
                    <article className="departure-card skeleton-card" key={item} />
                  ))}
                </div>
              </>
            ) : feedDepartures.length ? (
              <div className="feed-list">
                {feedDepartures.map((departure) => {
                  return (
                    <DepartureCard
                      key={departure.id}
                      departure={departure}
                      isFavorite={favoriteRouteCodes.has(departure.routeCode)}
                      onToggleFavorite={() =>
                        toggleFavoriteRoute(departure.routeCode)
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                compact
                message="No more buses in this selection."
              />
            )}
          </section>
        </>
      ) : (
        <section className="planner-layout">
          <section className="surface-panel planner-panel">
            <div className="planner-copy">
              <h1 className="section-title">Find a direct bus</h1>
            </div>

            <div className="planner-quick-actions" aria-label="Quick origin stops">
              {PLANNER_QUICK_STOPS.map((stop) => (
                <button
                  key={stop.value}
                  type="button"
                  className="planner-quick-action"
                  onClick={() => handlePlannerOriginChange(stop.value)}
                >
                  {stop.value === "UQ Chancellor's Place" ? (
                    <FaUniversity aria-hidden="true" />
                  ) : (
                    <FaMapMarkerAlt aria-hidden="true" />
                  )}
                  {stop.label}
                </button>
              ))}
              <button
                type="button"
                className="planner-swap-button planner-quick-swap"
                onClick={handlePlannerSwapStations}
              >
                <span className="planner-swap-icon" aria-hidden="true">
                  <FaExchangeAlt />
                </span>
                <span>Switch</span>
              </button>
            </div>

            <form className="planner-form" onSubmit={handlePlannerSearch}>
              <PlannerStopField
                fieldId="planner-origin-stop"
                icon={<OriginIcon />}
                label="From"
                options={plannerOriginOptions}
                pending={plannerOriginPending}
                placeholder="Buranda busway station"
                query={plannerOriginQuery}
                onQueryChange={handlePlannerOriginChange}
              />

              <PlannerStopField
                fieldId="planner-destination-stop"
                icon={<DestinationIcon />}
                label="To"
                options={plannerDestinationOptions}
                pending={plannerDestinationPending}
                placeholder="UQ Lakes station"
                query={plannerDestinationQuery}
                onQueryChange={handlePlannerDestinationChange}
              />

              <div className="planner-form-actions">
                <button
                  className="destination-search-button"
                  type="submit"
                  disabled={plannerBusy}
                >
                  <FaSearch aria-hidden="true" />
                  {plannerLoading ? "Searching" : "Search"}
                </button>

                <button
                  className="destination-search-clear"
                  type="button"
                  onClick={clearPlannerSearch}
                  disabled={
                    !plannerOriginQuery &&
                    !plannerDestinationQuery &&
                    !plannerHasSearched
                  }
                >
                  <FaTimesCircle aria-hidden="true" />
                  Clear
                </button>
              </div>
            </form>

            {plannerError ? (
              <p className="planner-inline-error">{plannerError}</p>
            ) : null}
          </section>

          <section className="surface-panel feed-panel planner-results-panel">
            <div className="section-head feed-head">
              <div>
                <p className="eyebrow">Planner results</p>
                <h2 className="section-title">Bus times</h2>
              </div>
            </div>

            {plannerHasSearched ? (
              <div className="planner-summary">
                <div className="planner-summary-meta">
                  <span className="destination-search-status">
                    {plannerResultDepartures.length} upcoming{" "}
                    {plannerResultDepartures.length === 1 ? "departure" : "departures"}
                  </span>
                  {plannerSearchResult.generatedAt ? (
                    <span className="planner-summary-note">
                      Updated {formatTime(plannerSearchResult.generatedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {plannerLoading ? (
              <>
                <div className="feed-loading-status">
                  Looking up direct buses...
                </div>
                <div className="feed-list feed-list-pending">
                  {[1, 2, 3].map((item) => (
                    <article className="departure-card skeleton-card" key={item} />
                  ))}
                </div>
              </>
            ) : plannerHasSearched ? (
              plannerResultDepartures.length ? (
                <div className="feed-list">
                  {plannerResultDepartures.map((departure) => {
                    return (
                      <DepartureCard
                        key={departure.id}
                        departure={departure}
                        plannerJourney={{
                          destinationLabel: plannerSearchResult.destinationStop.label,
                          originLabel: plannerSearchResult.originStop.label,
                        }}
                        showFavoriteAction={false}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  compact
                  message={
                    plannerEmptyMessage ||
                    `Cannot find a direct bus from ${plannerSearchResult.originStop.label} to ${plannerSearchResult.destinationStop.label} right now.`
                  }
                />
              )
            ) : (
              <EmptyState
                compact
                message="Choose an origin and destination to see direct buses."
              />
            )}
          </section>
        </section>
      )}

      <footer className="app-footer">
        <div className="app-footer-copy">
          <strong>Translink Data Declaration</strong>
          <p>
            This interface displays arrival information retrieved from Translink
            open data. The underlying timetable and service data remain the
            property of Translink, and this app does not claim ownership of that
            data.
          </p>
        </div>

        {footerSourceUrl ? (
          <a
            className="app-footer-link"
            href={footerSourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        ) : null}
      </footer>

      {currentPage === BOARD_PAGE_ID && filterOpen ? (
        <div className="filter-sheet-layer">
          <button
            type="button"
            className="filter-sheet-backdrop"
            aria-label="Close route picker"
            onClick={() => setFilterOpen(false)}
          />

          <section
            className="filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose bus route"
          >
            <div className="filter-sheet-handle" aria-hidden="true" />

            <div className="filter-sheet-header">
              <div>
                <p className="filter-sheet-title">Choose bus number</p>
              </div>

              <button
                type="button"
                className="filter-sheet-close"
                aria-label="Close route picker"
                onClick={() => setFilterOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="filter-sheet-list" role="listbox">
              {routeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selectedRoute === option.id}
                  aria-label={`${option.id === ALL_ROUTES_ID ? "All routes" : option.short}, ${formatRouteCount(option.count)}`}
                  className={`filter-option ${selectedRoute === option.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedRoute(option.id);
                    setFilterOpen(false);
                  }}
                >
                  <span className="filter-option-main">
                    {option.id === ALL_ROUTES_ID ? (
                      <span className="filter-option-title">All routes</span>
                    ) : (
                      <RouteToken
                        code={option.short}
                        className="filter-option-route-token"
                      />
                    )}
                  </span>

                  <span className="filter-option-tail">
                    <span className="filter-option-count">
                      {formatRouteCount(option.count)}
                    </span>

                    <span className="filter-option-check" aria-hidden="true">
                      {selectedRoute === option.id ? (
                        <CheckIcon />
                      ) : (
                        <span className="filter-option-check-dot" />
                      )}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {currentPage === BOARD_PAGE_ID && stopSheetOpen ? (
        <div className="filter-sheet-layer">
          <button
            type="button"
            className="filter-sheet-backdrop"
            aria-label="Close bus stop picker"
            onClick={() => setStopSheetOpen(false)}
          />

          <section
            className="filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose bus stop"
          >
            <div className="filter-sheet-handle" aria-hidden="true" />

            <div className="filter-sheet-header">
              <div>
                <p className="filter-sheet-title">Choose bus stop</p>
              </div>

              <button
                type="button"
                className="filter-sheet-close"
                aria-label="Close bus stop picker"
                onClick={() => setStopSheetOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="filter-sheet-list" role="listbox">
              {STOP_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selectedStopId === option.id}
                  aria-label={`${option.switchLabel}, ${getStopOptionBadge(selectedStopId, option.id)}`}
                  className={`stop-option ${selectedStopId === option.id ? "selected" : ""}`}
                  onClick={() => handleStopSelection(option.id)}
                >
                  <span className="stop-option-main">
                    <span className="stop-option-title">
                      {option.switchLabel}
                    </span>
                    <span className="stop-option-copy">
                      {option.sheetDescription}
                    </span>
                  </span>

                  <span className="stop-option-tail">
                    <span className="stop-option-badge">
                      {getStopOptionBadge(selectedStopId, option.id)}
                    </span>

                    <span className="stop-option-check" aria-hidden="true">
                      {selectedStopId === option.id ? (
                        <CheckIcon />
                      ) : (
                        <span className="stop-option-check-dot" />
                      )}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <ToastContainer
        autoClose={1200}
        closeButton={false}
        draggable={false}
        hideProgressBar
        newestOnTop
        pauseOnFocusLoss={false}
        pauseOnHover={false}
        position="top-center"
        transition={toastTransition}
      />
    </main>
  );
}

function RouteToken({
  code,
  className = "",
  saved = false,
  showMarkers = false,
}) {
  const routeKind = getRouteKind(code);
  const routeClassName = ["route-token", routeKind, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={routeClassName}>
      <TransportIcon kind={routeKind} />
      <span className="route-token-code">{code}</span>
      {showMarkers && saved ? (
        <span className="route-token-markers">
          <span className="route-token-marker saved" aria-label="Saved route">
            <FavoriteIcon filled />
          </span>
        </span>
      ) : null}
    </span>
  );
}

function TransportIcon({ kind }) {
  return (
    <span className={`route-token-icon ${kind}`} aria-hidden="true">
      {kind === "metro" ? <MetroIcon /> : <BusIcon />}
    </span>
  );
}

function PlannerStopField({
  fieldId,
  icon,
  label,
  options,
  pending = false,
  placeholder,
  query,
  onQueryChange,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const visibleOptions = options.slice(0, 8);
  const hasQuery = Boolean(query.trim());
  const showEmptyState = hasQuery && !pending && visibleOptions.length === 0;
  const showSuggestions = isFocused && hasQuery && (visibleOptions.length > 0 || showEmptyState);
  const fieldStatus = pending
    ? "Searching"
    : hasQuery && visibleOptions.length
      ? `${visibleOptions.length} possible station${visibleOptions.length === 1 ? "" : "s"}`
      : "";

  return (
    <div className={`planner-field ${showSuggestions ? "open" : ""}`}>
      <div className="planner-field-head">
        <label className="planner-field-label" htmlFor={fieldId}>
          <span className="planner-field-label-icon" aria-hidden="true">
            {icon}
          </span>
          <span>{label}</span>
        </label>
        {fieldStatus ? <span className="planner-field-status">{fieldStatus}</span> : null}
      </div>

      <div className="planner-input-shell">
        <span className="planner-input-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          id={fieldId}
          className="destination-search-input"
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={`${fieldId}-suggestions`}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
        />
      </div>

      {showSuggestions ? (
        <div
          className="planner-suggestion-list"
          id={`${fieldId}-suggestions`}
          role="listbox"
        >
          {visibleOptions.map((option) => (
            <button
              key={`${fieldId}-${option.id || option.label}`}
              type="button"
              className="planner-suggestion"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onQueryChange(option.label);
                setIsFocused(false);
              }}
            >
              <span className="planner-suggestion-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="planner-suggestion-text">{option.label}</span>
            </button>
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="planner-suggestion-empty">
          No bus stop found.
        </div>
      ) : null}
    </div>
  );
}

function DepartureCard({
  departure,
  directMatchLabel = "",
  isFavorite = false,
  onToggleFavorite,
  plannerJourney = null,
  showFavoriteAction = true,
}) {
  const isPlannerJourney = Boolean(
    plannerJourney?.originLabel && plannerJourney?.destinationLabel,
  );
  const routeSummary = formatRouteSummary(
    departure.fullHeadsign,
    departure.destination,
  );
  const plannerDetail =
    routeSummary && routeSummary !== departure.destination ? routeSummary : "";
  const cardClassName = [
    "departure-card",
    isPlannerJourney ? "planner-card" : "",
    isFavorite ? "saved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <div className="departure-trigger">
        <div className="trigger-main">
          <div className="trigger-row">
            <span className={`route-badge ${isFavorite ? "saved" : ""}`}>
              {departure.routeCode}
            </span>
            {!isPlannerJourney ? (
              <span className="inline-stop-chip">
                {formatPlatform(departure.platform)}
              </span>
            ) : departure.platform ? (
              <span className="inline-stop-chip planner">
                {formatPlatform(departure.platform)}
              </span>
            ) : null}

            {showFavoriteAction ? (
              <div className="trigger-actions">
                <button
                  type="button"
                  className={`route-action-button ${isFavorite ? "active" : ""}`}
                  aria-label={`${
                    isFavorite ? "Remove" : "Save"
                  } ${departure.routeCode} as a favourite`}
                  onClick={onToggleFavorite}
                >
                  <FavoriteIcon filled={isFavorite} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="trigger-copy">
            {isPlannerJourney ? (
              <div className="planner-card-copy">
                {departure.destination ? (
                  <strong>{departure.destination}</strong>
                ) : null}
                <span>
                  {departure.live ? "Live time" : "Scheduled time"}
                  {plannerDetail ? ` · ${plannerDetail}` : ""}
                </span>
              </div>
            ) : (
              <>
                <strong>{departure.destination}</strong>
                <span>{routeSummary}</span>
              </>
            )}
          </div>

          {!isPlannerJourney && (directMatchLabel || isFavorite) ? (
            <div className="trigger-flags">
              {directMatchLabel ? (
                <span className="departure-flag direct">
                  <DestinationIcon />
                  <span>Direct to {directMatchLabel}</span>
                </span>
              ) : null}
              {showFavoriteAction && isFavorite ? (
                <span className="departure-flag saved">
                  <FavoriteIcon filled />
                  <span>Saved bus</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`trigger-side ${isPlannerJourney ? "planner-side" : ""}`}>
          {isPlannerJourney ? (
            <div className="planner-time-row">
              <span className="planner-time-chip">
                <FaClock aria-hidden="true" />
                {departure.displayTime}
              </span>
              <strong>{departure.countdownText}</strong>
              <span className={`planner-live-chip ${departure.live ? "live" : ""}`}>
                <FaBroadcastTower aria-hidden="true" />
                {departure.live ? "Live" : "Scheduled"}
              </span>
            </div>
          ) : (
            <>
              <div className="trigger-side-top">
                <span className="trigger-time">{departure.displayTime}</span>
              </div>
              <div className="trigger-status">
                <strong>{departure.countdownText}</strong>
                <span>{departure.live ? "Live" : "Scheduled"}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.2a6.8 6.8 0 1 1-4.808 1.992"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 6.5h9.5M10.75 3.75 13.5 6.5l-2.75 2.75M16 13.5H6.5M9.25 10.75 6.5 13.5l2.75 2.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5.5 10.2 2.8 2.8 6.2-6.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FavoriteIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m10 3.2 2.1 4.258 4.7.682-3.4 3.315.802 4.684L10 13.93l-4.202 2.209.802-4.684-3.4-3.315 4.7-.682L10 3.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DestinationIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 16.2s4.8-4.8 4.8-8.3A4.8 4.8 0 1 0 5.2 7.9c0 3.5 4.8 8.3 4.8 8.3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="7.9" r="1.7" fill="currentColor" />
    </svg>
  );
}

function OriginIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="5.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.75" fill="currentColor" />
    </svg>
  );
}

function BusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="4.25"
        y="3.5"
        width="11.5"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.75 8.25h10.5M7 14.5v1.75M13 14.5v1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 6.25h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7.25" cy="11.25" r="0.9" fill="currentColor" />
      <circle cx="12.75" cy="11.25" r="0.9" fill="currentColor" />
    </svg>
  );
}

function MetroIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6 3.75h8a2 2 0 0 1 2 2v6.5a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 4 12.25v-6.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7.25 6.5h5.5M7.25 9.25v2.25M12.75 9.25v2.25M7 15.75l1.3-1.25M13 15.75l-1.3-1.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6 6 14 14M14 6 6 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyState({
  compact = false,
  message = "No upcoming buses right now.",
}) {
  return (
    <section className={`empty-state ${compact ? "compact" : ""}`}>
      <p>{message}</p>
    </section>
  );
}

function getInitialStopId() {
  const stopId = new URLSearchParams(window.location.search).get("stop");
  return isValidStopId(stopId) ? stopId : DEFAULT_STOP_ID;
}

function getInitialPageId() {
  const pageId = new URLSearchParams(window.location.search).get("page");
  return pageId === PLANNER_PAGE_ID ? PLANNER_PAGE_ID : BOARD_PAGE_ID;
}

function getInitialRouteId() {
  const routeId = new URLSearchParams(window.location.search)
    .get("route")
    ?.trim();

  return routeId ? routeId : ALL_ROUTES_ID;
}

function getInitialFavoriteRoutes() {
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

function isValidStopId(stopId) {
  return typeof stopId === "string" && Object.hasOwn(STOPS, stopId);
}

function isValidFavoriteRoute(favorite) {
  return (
    Boolean(favorite) &&
    typeof favorite === "object" &&
    isValidStopId(favorite.stopId) &&
    String(favorite.routeCode ?? "").trim().length > 0
  );
}

function createFavoriteRoute(favorite) {
  return {
    stopId: favorite.stopId,
    routeCode: String(favorite.routeCode).trim(),
  };
}

function findFavoriteRoute(favorites, stopId, routeCode) {
  return favorites.find((favorite) => {
    return favorite.stopId === stopId && favorite.routeCode === routeCode;
  });
}

function getStopOptionBadge(selectedStopId, optionId) {
  return selectedStopId === optionId ? "Current" : "Choose";
}

function buildPreviewBoardData(stop) {
  return {
    stopId: stop.id,
    stopName: stop.displayName,
    generatedAt: new Date().toISOString(),
    sourceUrl: "",
    departures: buildPreviewDepartures(stop.displayName),
  };
}

function buildPreviewDepartures(stopName) {
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
      fullHeadsign: "Uni of Qld, St Lucia, Toowong, Auchenflower, Milton, City",
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
      fullHeadsign: "Uni of Qld, St Lucia, Taringa, Indooroopilly, Chapel Hill",
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

function formatPlatform(platform) {
  return platform ? `Stop ${platform}` : "UQ";
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

function getRouteKind(routeCode) {
  return /[A-Za-z]/.test(routeCode) && /\d/.test(routeCode) ? "metro" : "bus";
}

function formatRouteCount(count) {
  return `${count} ${count === 1 ? "bus" : "buses"}`;
}

function formatRouteSummary(headsign, fallback) {
  const segments = (headsign || "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0]} - ${segments.at(-1)}`;
  }

  return segments[0] || fallback || "";
}

function createSearchStop(stopConfig) {
  const rawId = String(stopConfig?.id ?? "").trim();
  const rawLabel = String(stopConfig?.label ?? stopConfig?.name ?? "").trim();
  const label = getStationChoiceLabel(rawLabel, stopConfig?.aliases ?? []);

  if (!label) {
    return null;
  }

  const aliases = buildStopAliases(label, [rawLabel, ...(stopConfig?.aliases ?? [])]);

  return {
    id: label || rawId,
    label,
    aliases,
    aliasKeys: aliases.map((alias) => normalizeSearchCandidate(alias)),
  };
}

function buildStopAliases(label, extraAliases = []) {
  const strippedLabel = label
    .replace(/\bbusway station\b/gi, "")
    .replace(/\bbus station\b/gi, "")
    .replace(/\bstation\b/gi, "")
    .trim();
  const compactLabel = strippedLabel.replace(/\s+/g, "");
  const abbreviationVariants = [
    strippedLabel.replace(/\bstreet\b/gi, "St").trim(),
    strippedLabel.replace(/\bsouth\b/gi, "Sth").trim(),
    strippedLabel.replace(/\bmount\b/gi, "Mt").trim(),
  ];

  return Array.from(
    new Set(
      [label, strippedLabel, compactLabel, ...abbreviationVariants, ...extraAliases]
        .map((alias) => String(alias ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function getStationChoiceLabel(label, extraAliases = []) {
  const canonicalLabel = getCanonicalStationLabel([label, ...extraAliases]);

  if (canonicalLabel) {
    return canonicalLabel;
  }

  const stationLabel = stripStationPlatformDetail(label);

  if (!stationLabel) {
    return "";
  }

  if (
    /\bbusway\b/i.test(stationLabel) &&
    !/\bbusway station\b/i.test(stationLabel)
  ) {
    return `${stationLabel} station`;
  }

  return stationLabel;
}

function getCanonicalStationLabel(values) {
  const normalizedValues = values
    .map((value) => stripStationPlatformDetail(value))
    .map((value) => normalizeSearchCandidate(value))
    .filter(Boolean);

  const matchedStation = OFFICIAL_STATION_CHOICES.find((station) => {
    const stationKeys = buildStopAliases(station.label, station.aliases).map((alias) =>
      normalizeSearchCandidate(alias),
    );

    return normalizedValues.some((value) => {
      return stationKeys.some((stationKey) => {
        return (
          value === stationKey ||
          value.includes(stationKey) ||
          stationKey.includes(value)
        );
      });
    });
  });

  return matchedStation?.label ?? "";
}

function stripStationPlatformDetail(label) {
  return String(label ?? "")
    .replace(/\s*,\s*[^,]+$/g, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/\s*[-,]\s*(platform|plat|bay|stop|stand)\s+[a-z0-9-]+\s*$/i, "")
    .replace(/\s+(platform|plat|bay|stop|stand)\s+[a-z0-9-]+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadsignSegments(headsign) {
  return String(headsign ?? "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeSearchCandidate(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bsouth\b/g, "sth")
    .replace(/\bmount\b/g, "mt")
    .replace(/\bcenter\b/g, "centre")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSearchStop(query, stops) {
  const normalizedQuery = normalizeSearchCandidate(query);

  if (!normalizedQuery) {
    return null;
  }

  return (
    stops.find((stop) => {
      return stop.aliasKeys.includes(normalizedQuery);
    }) ??
    stops.find((stop) => {
      return stop.aliasKeys.some((aliasKey) => aliasKey.startsWith(normalizedQuery));
    }) ??
    stops.find((stop) => {
      return stop.aliasKeys.some((aliasKey) => aliasKey.includes(normalizedQuery));
    }) ??
    null
  );
}

function getDepartureSearchTargets(departure, stop) {
  const searchAliases = new Set(
    (stop?.searchAliases ?? []).map((alias) => normalizeSearchCandidate(alias)),
  );
  const targetMap = new Map();
  const pushTarget = (target) => {
    const trimmedTarget = String(target ?? "").trim();
    const normalizedTarget = normalizeSearchCandidate(trimmedTarget);

    if (
      !trimmedTarget ||
      !normalizedTarget ||
      searchAliases.has(normalizedTarget) ||
      targetMap.has(normalizedTarget)
    ) {
      return;
    }

    targetMap.set(normalizedTarget, trimmedTarget);
  };

  pushTarget(departure.destination);

  const headsignSegments = getHeadsignSegments(departure.fullHeadsign);
  const downstreamSegments =
    headsignSegments.length > 1 ? headsignSegments.slice(1) : headsignSegments;

  downstreamSegments.forEach(pushTarget);

  return Array.from(targetMap.values());
}

function findDepartureStopMatch(departure, destinationStop, stop) {
  if (!destinationStop) {
    return "";
  }

  const targets = getDepartureSearchTargets(departure, stop);
  const targetMatch = targets.find((target) =>
    doesTargetMatchStop(target, destinationStop),
  );

  return targetMatch ? destinationStop.label : "";
}

function doesRouteStartAtDestination(departure, destinationStop) {
  const [routeOrigin] = getHeadsignSegments(departure.fullHeadsign);

  return doesTargetMatchStop(routeOrigin, destinationStop);
}

function doesTargetMatchStop(target, stop) {
  const normalizedTarget = normalizeSearchCandidate(target);

  if (!normalizedTarget || !stop?.aliasKeys?.length) {
    return false;
  }

  return stop.aliasKeys.some((aliasKey) => {
    return (
      normalizedTarget === aliasKey ||
      normalizedTarget.startsWith(`${aliasKey} `) ||
      normalizedTarget.endsWith(` ${aliasKey}`) ||
      normalizedTarget.includes(` ${aliasKey} `)
    );
  });
}

function findRoutePathStopOrderMatch(departure, originStop, destinationStop) {
  const headsignSegments = getHeadsignSegments(departure.fullHeadsign);

  if (headsignSegments.length < 2) {
    return null;
  }

  const originIndex = findStopSegmentIndex(headsignSegments, originStop);
  const destinationIndex = findStopSegmentIndex(headsignSegments, destinationStop);

  if (originIndex < 0 || destinationIndex < 0) {
    return null;
  }

  return destinationIndex > originIndex ? destinationStop.label : "";
}

function findStopSegmentIndex(segments, stop) {
  return segments.findIndex((segment) => doesTargetMatchStop(segment, stop));
}

function findPlannerDepartureMatch(
  departure,
  destinationStop,
  originStop,
  destinationDepartures = [],
) {
  const routePathMatch = findRoutePathStopOrderMatch(
    departure,
    originStop,
    destinationStop,
  );

  if (routePathMatch !== null) {
    return routePathMatch;
  }

  const textMatch = findDepartureStopMatch(departure, destinationStop, {
    searchAliases: originStop?.aliases,
  });

  if (textMatch) {
    return textMatch;
  }

  if (doesRouteStartAtDestination(departure, destinationStop)) {
    return "";
  }

  return hasMatchingDownstreamDeparture(departure, destinationDepartures)
    ? destinationStop.label
    : "";
}

function hasMatchingDownstreamDeparture(
  originDeparture,
  destinationDepartures = [],
) {
  const originTime = new Date(originDeparture?.scheduledUtc).getTime();
  const originHeadsign = normalizeSearchCandidate(originDeparture?.fullHeadsign);
  const originDestination = normalizeSearchCandidate(originDeparture?.destination);

  if (!Number.isFinite(originTime)) {
    return false;
  }

  return destinationDepartures.some((destinationDeparture) => {
    if (
      String(destinationDeparture?.routeCode ?? "") !==
        String(originDeparture?.routeCode ?? "") ||
      String(destinationDeparture?.direction ?? "") !==
        String(originDeparture?.direction ?? "")
    ) {
      return false;
    }

    const destinationTime = new Date(destinationDeparture?.scheduledUtc).getTime();
    const minutesBetweenStops = (destinationTime - originTime) / 60000;

    if (
      !Number.isFinite(destinationTime) ||
      minutesBetweenStops < 0 ||
      minutesBetweenStops > 45
    ) {
      return false;
    }

    if (
      originDeparture?.id &&
      destinationDeparture?.id &&
      originDeparture.id === destinationDeparture.id
    ) {
      return true;
    }

    const destinationHeadsign = normalizeSearchCandidate(
      destinationDeparture?.fullHeadsign,
    );
    const destinationLabel = normalizeSearchCandidate(
      destinationDeparture?.destination,
    );

    return (
      (originHeadsign && destinationHeadsign && originHeadsign === destinationHeadsign) ||
      (originDestination &&
        destinationLabel &&
        originDestination === destinationLabel)
    );
  });
}

async function fetchTranslinkStops(query) {
  const trimmedQuery = String(query ?? "").trim();
  const cacheKey = normalizeSearchCandidate(trimmedQuery);

  if (!cacheKey) {
    return [];
  }

  if (stopSearchCache.has(cacheKey)) {
    return stopSearchCache.get(cacheKey);
  }

  const response = await fetch(
    `/api/stops/search?q=${encodeURIComponent(trimmedQuery)}`,
  );

  if (!response.ok) {
    throw new Error("Could not search official stop names.");
  }

  const payload = await response.json();
  const stops = Array.isArray(payload?.stops) ? payload.stops : [];

  const uniqueStops = Array.from(
    stops.reduce((stopMap, stop) => {
      const searchStop = createSearchStop(stop);

      if (!searchStop) {
        return stopMap;
      }

      const stopKey = normalizeSearchCandidate(searchStop.label);
      const existingStop = stopMap.get(stopKey);

      if (existingStop) {
        const aliases = Array.from(
          new Set([...existingStop.aliases, ...searchStop.aliases]),
        );

        stopMap.set(stopKey, {
          ...existingStop,
          aliases,
          aliasKeys: aliases.map((alias) => normalizeSearchCandidate(alias)),
        });
        return stopMap;
      }

      stopMap.set(stopKey, searchStop);
      return stopMap;
    }, new Map()).values(),
  );

  stopSearchCache.set(cacheKey, uniqueStops);

  return uniqueStops;
}

async function fetchStopDepartures({ limit, stopId, stopName }) {
  const params = new URLSearchParams();

  if (stopId) {
    params.set("stopId", stopId);
  }

  if (stopName) {
    params.set("stopName", stopName);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  const response = await fetch(`/api/departures?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Could not load departures for this stop.");
  }

  return response.json();
}

function buildAppUrl({ baseUrl, pageId, stopId, routeCode }) {
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
