import { getRouteKind } from "../lib/board-utils";
import { BusIcon, FavoriteIcon, MetroIcon } from "./icons";

function TransportIcon({ kind }) {
  return (
    <span className={`route-token-icon ${kind}`} aria-hidden="true">
      {kind === "metro" ? <MetroIcon /> : <BusIcon />}
    </span>
  );
}

export default function RouteToken({
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
