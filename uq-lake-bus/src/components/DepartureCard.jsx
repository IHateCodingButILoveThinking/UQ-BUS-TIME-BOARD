import {
  formatPlatform,
  formatRouteSummary,
} from "../lib/board-utils";
import { DestinationIcon, FavoriteIcon } from "./icons";

export default function DepartureCard({
  departure,
  directMatchLabel = "",
  isFavorite = false,
  onToggleFavorite,
  showFavoriteAction = true,
}) {
  const routeSummary = formatRouteSummary(
    departure.fullHeadsign,
    departure.destination,
  );
  const cardClassName = ["departure-card", isFavorite ? "saved" : ""]
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
            <span className="inline-stop-chip">
              {formatPlatform(departure.platform)}
            </span>

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
            <strong>{departure.destination}</strong>
            <span>{routeSummary}</span>
          </div>

          {directMatchLabel || (showFavoriteAction && isFavorite) ? (
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
