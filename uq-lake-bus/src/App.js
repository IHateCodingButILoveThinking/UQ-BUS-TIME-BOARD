import { useEffect, useMemo, useState } from "react";

import uqLockup from "./assets/uq-lockup.svg";

const REFRESH_MS = 30000;
const FILTER_PENDING_MS = 450;
const ALL_ROUTES_ID = "all-routes";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(ALL_ROUTES_ID);
  const [appliedRoute, setAppliedRoute] = useState(ALL_ROUTES_ID);
  const [filterPending, setFilterPending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let timerId;

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
        setData(nextData);
        setError("");
      } catch (fetchError) {
        console.error(fetchError);
        setError("Unable to load buses right now.");
      } finally {
        setLoading(false);
      }
    };

    loadDepartures();
    timerId = window.setInterval(() => {
      loadDepartures({ silent: true });
    }, REFRESH_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!filterOpen) {
      return undefined;
    }

    const scrollY = window.scrollY;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
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
  }, [filterOpen]);

  const departures = data?.departures ?? [];
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

  useEffect(() => {
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
  }, [appliedRoute, routeOptions, selectedRoute]);

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

  const nextDeparture = departures[0];
  const closestDepartures = nextDeparture
    ? departures.filter(
        (departure) => departure.displayTime === nextDeparture.displayTime,
      )
    : [];
  const boardUpcoming = departures.slice(
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

  return (
    <main className="app-shell">
      <div className="side-stack">
        <section className="surface-panel hero-panel">
          <div className="hero-glow hero-glow-top" aria-hidden="true" />
          <div className="hero-glow hero-glow-bottom" aria-hidden="true" />

          <div className="hero-topbar">
            <div className="brand-copy">
              <div className="brand-copy-top">
                <p className="eyebrow">UQ Lakes station</p>
                <span className="student-note">For UQ students</span>
              </div>
            </div>

            <img
              className="uq-lockup"
              src={uqLockup}
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
                <article className="board-primary-item">
                  <div className="board-primary-topline">
                    <div className="board-route-group">
                      {closestDisplayDepartures.map((departure) => (
                        <RouteToken
                          code={departure.routeCode}
                          className="board-route-pill"
                          key={`closest-route-${departure.id}`}
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
                    {boardUpcoming.map((departure) => (
                      <article className="mini-board-item" key={departure.id}>
                        <div className="mini-board-topline">
                          <span className="mini-board-route">
                            {departure.routeCode}
                          </span>
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
                    ))}
                  </div>
                ) : (
                  <div className="mini-board-empty">No more upcoming buses.</div>
                )}
              </div>
            </article>
          ) : (
            <EmptyState message="No buses right now." />
          )}
        </section>

        {error ? (
          <section className="surface-panel error-card">{error}</section>
        ) : null}

        <section className="surface-panel controls-panel">
          <div className={`filter-control-shell ${filterOpen ? "open" : ""}`}>
            <button
              type="button"
              className={`filter-control ${filterPending ? "pending" : ""} ${filterOpen ? "open" : ""}`}
              aria-expanded={filterOpen}
              aria-haspopup="listbox"
              onClick={() => {
                if (filterPending) {
                  return;
                }

                setFilterOpen((currentOpen) => !currentOpen);
              }}
            >
              <div className="filter-control-copy">
                <span className="filter-control-label">Choose bus number</span>
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
                className={`filter-control-icon ${filterPending ? "pending" : ""}`}
                aria-hidden="true"
              >
                {filterPending ? <SpinnerIcon /> : <ChevronIcon />}
              </span>
            </button>
          </div>
        </section>
      </div>

      <section className="surface-panel feed-panel">
        <div className="section-head feed-head">
          <div>
            <p className="eyebrow">Arrivals</p>
            <h2 className="section-title">Upcoming buses</h2>
          </div>
          {filterPending ? (
            <p className="section-note">Updating route...</p>
          ) : null}
        </div>

        {loading && !data ? (
          <div className="feed-list">
            {[1, 2, 3, 4].map((item) => (
              <article className="departure-card skeleton-card" key={item} />
            ))}
          </div>
        ) : filterPending ? (
          <>
            <div className="feed-loading-status">Loading selected route...</div>
            <div className="feed-list feed-list-pending">
              {[1, 2, 3].map((item) => (
                <article className="departure-card skeleton-card" key={item} />
              ))}
            </div>
          </>
        ) : feedDepartures.length ? (
          <div className="feed-list">
            {feedDepartures.map((departure) => (
              <DepartureCard key={departure.id} departure={departure} />
            ))}
          </div>
        ) : (
          <EmptyState compact message="No more buses in this selection." />
        )}
      </section>

      <footer className="app-footer">
        <div className="app-footer-copy">
          <strong>Translink Data Declaration</strong>
          <p>
            This interface displays arrival information retrieved from
            Translink open data. The underlying timetable and service data
            remain the property of Translink, and this app does not claim
            ownership of that data.
          </p>
        </div>

        {data?.sourceUrl ? (
          <a
            className="app-footer-link"
            href={data.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        ) : null}
      </footer>

      {filterOpen ? (
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
    </main>
  );
}

function RouteToken({ code, className = "" }) {
  const routeKind = getRouteKind(code);
  const routeClassName = ["route-token", routeKind, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={routeClassName}>
      <TransportIcon kind={routeKind} />
      <span className="route-token-code">{code}</span>
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

function DepartureCard({ departure }) {
  const routeSummary = formatRouteSummary(
    departure.fullHeadsign,
    departure.destination,
  );

  return (
    <article className="departure-card">
      <div className="departure-trigger">
        <div className="trigger-main">
          <div className="trigger-row">
            <span className="route-badge">{departure.routeCode}</span>
            <span className="inline-stop-chip">
              {formatPlatform(departure.platform)}
            </span>
          </div>

          <div className="trigger-copy">
            <strong>{departure.destination}</strong>
            <span>{routeSummary}</span>
          </div>
        </div>

        <div className="trigger-side">
          <div className="trigger-side-top">
            <span className="trigger-time">{departure.displayTime}</span>
          </div>
          <div className="trigger-status">
            <strong>{departure.countdownText}</strong>
            <span>{departure.live ? "Live" : "Scheduled"}</span>
          </div>
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

function formatPlatform(platform) {
  return platform ? `Stop ${platform}` : "UQ";
}

function getRouteKind(routeCode) {
  return /[A-Za-z]/.test(routeCode) && /\d/.test(routeCode)
    ? "metro"
    : "bus";
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
