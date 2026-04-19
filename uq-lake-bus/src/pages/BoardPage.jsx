import DepartureCard from "../components/DepartureCard";
import EmptyState from "../components/EmptyState";
import RouteToken from "../components/RouteToken";
import { ALL_ROUTES_ID, STOP_OPTIONS } from "../lib/app-constants";
import {
  formatPlatform,
  formatRouteCount,
  getStopOptionBadge,
} from "../lib/board-utils";
import {
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  SpinnerIcon,
  SwitchIcon,
} from "../components/icons";

export default function BoardPage({
  activeStop,
  boardUpcoming,
  closestDepartures,
  closestDisplayDepartures,
  closestHasSaved,
  closestStopLabels,
  error,
  favoriteRouteCodes,
  feedDepartures,
  filterOpen,
  filterPending,
  nextDeparture,
  onCloseFilter,
  onCloseStopSheet,
  onSelectRoute,
  onSelectStop,
  onToggleFavorite,
  onToggleFilter,
  onToggleStopSheet,
  routeOptions,
  selectedRoute,
  selectedRouteIsAll,
  selectedStopId,
  showError,
  showLoadingState,
  stopSheetOpen,
}) {
  return (
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
                    <span className="student-note">{activeStop.studentNote}</span>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={`stop-control ${stopSheetOpen ? "open" : ""}`}
                  aria-expanded={stopSheetOpen}
                  aria-haspopup="listbox"
                  aria-label={`Switch UQ bus stop. Current stop ${activeStop.switchLabel}`}
                  onClick={onToggleStopSheet}
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
                  className={`board-primary-item ${closestHasSaved ? "saved" : ""}`}
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
                          saved={favoriteRouteCodes.has(departure.routeCode)}
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
                          className={`mini-board-item ${isFavorite ? "saved" : ""}`}
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
                  <div className="mini-board-empty">No more upcoming buses.</div>
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
            <div className={`filter-control-shell ${filterOpen ? "open" : ""}`}>
              <button
                type="button"
                className={`filter-control ${filterPending ? "pending" : ""} ${
                  filterOpen ? "open" : ""
                }`}
                aria-expanded={filterOpen}
                aria-haspopup="listbox"
                onClick={onToggleFilter}
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
            <div className="feed-loading-status">Loading selected route...</div>
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
                  onToggleFavorite={() => onToggleFavorite(departure.routeCode)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState compact message="No more buses in this selection." />
        )}
      </section>

      {filterOpen ? (
        <div className="filter-sheet-layer">
          <button
            type="button"
            className="filter-sheet-backdrop"
            aria-label="Close route picker"
            onClick={onCloseFilter}
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
                onClick={onCloseFilter}
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
                  aria-label={`${
                    option.id === ALL_ROUTES_ID ? "All routes" : option.short
                  }, ${formatRouteCount(option.count)}`}
                  className={`filter-option ${
                    selectedRoute === option.id ? "selected" : ""
                  }`}
                  onClick={() => onSelectRoute(option.id)}
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

      {stopSheetOpen ? (
        <div className="filter-sheet-layer">
          <button
            type="button"
            className="filter-sheet-backdrop"
            aria-label="Close bus stop picker"
            onClick={onCloseStopSheet}
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
                onClick={onCloseStopSheet}
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
                  aria-label={`${option.switchLabel}, ${getStopOptionBadge(
                    selectedStopId,
                    option.id,
                  )}`}
                  className={`stop-option ${
                    selectedStopId === option.id ? "selected" : ""
                  }`}
                  onClick={() => onSelectStop(option.id)}
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
    </>
  );
}
