import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import DepartureCard from "../components/DepartureCard";
import EmptyState from "../components/EmptyState";
import { DESTINATION_SEARCH_DEBOUNCE_MS } from "../lib/app-constants";
import { formatTime } from "../lib/board-utils";

export default function PlannerPage({ activeStop, onSourceUrlChange }) {
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

  const plannerOriginOptions = useMemo(() => {
    return plannerOriginStops.map((stop) => stop.label);
  }, [plannerOriginStops]);
  const plannerDestinationOptions = useMemo(() => {
    return plannerDestinationStops.map((stop) => stop.label);
  }, [plannerDestinationStops]);
  const plannerHasSearched = Boolean(plannerSearchResult);
  const plannerBusy =
    plannerLoading || plannerOriginPending || plannerDestinationPending;
  const plannerResultDepartures = plannerSearchResult?.departures ?? [];
  const plannerResultSource = plannerSearchResult
    ? { searchAliases: plannerSearchResult.originStop.aliases }
    : null;

  useEffect(() => {
    setPlannerOriginQuery((currentQuery) => currentQuery || activeStop.displayName);
  }, [activeStop.displayName]);

  useEffect(() => {
    onSourceUrlChange?.(plannerSearchResult?.sourceUrl ?? "");

    return () => {
      onSourceUrlChange?.("");
    };
  }, [onSourceUrlChange, plannerSearchResult?.sourceUrl]);

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

  const handlePlannerSearch = async (event) => {
    event.preventDefault();

    const nextOriginQuery = plannerOriginQuery.trim();
    const nextDestinationQuery = plannerDestinationQuery.trim();

    if (!nextOriginQuery || !nextDestinationQuery) {
      toast.info("Choose both your current stop and destination first.", {
        className: "bus-toast bus-toast-info",
        bodyClassName: "bus-toast-body",
      });
      return;
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
        return;
      }

      if (!destinationStop) {
        toast.error("Choose a real Translink destination stop.", {
          className: "bus-toast bus-toast-error",
          bodyClassName: "bus-toast-body",
        });
        setPlannerSearchResult(null);
        return;
      }

      if (
        normalizeSearchCandidate(originStop.label) ===
        normalizeSearchCandidate(destinationStop.label)
      ) {
        toast.info("Choose two different stops.", {
          className: "bus-toast bus-toast-info",
          bodyClassName: "bus-toast-body",
        });
        return;
      }

      const departuresPayload = await fetchStopDepartures({
        stopId: originStop.id,
        stopName: originStop.label,
      });
      const matches = departuresPayload.departures.filter((departure) => {
        return Boolean(
          findDepartureStopMatch(departure, destinationStop, {
            searchAliases: originStop.aliases,
          }),
        );
      });

      setPlannerOriginQuery(originStop.label);
      setPlannerDestinationQuery(destinationStop.label);
      setPlannerSearchResult({
        departures: matches,
        destinationStop,
        generatedAt: departuresPayload.generatedAt,
        originStop,
        sourceUrl: departuresPayload.sourceUrl,
        stopName: departuresPayload.stopName,
      });

      if (!matches.length) {
        toast.info(
          `No direct bus from ${originStop.label} to ${destinationStop.label}.`,
          {
            className: "bus-toast bus-toast-info",
            bodyClassName: "bus-toast-body",
          },
        );
        return;
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
    } catch (searchError) {
      console.error("Could not load planner departures.", searchError);
      setPlannerError("Could not load direct buses right now.");
      setPlannerSearchResult(null);
      toast.error("Could not load direct buses right now.", {
        className: "bus-toast bus-toast-error",
        bodyClassName: "bus-toast-body",
      });
    } finally {
      setPlannerLoading(false);
    }
  };

  const clearPlannerSearch = () => {
    setPlannerOriginQuery("");
    setPlannerDestinationQuery("");
    setPlannerOriginStops([]);
    setPlannerDestinationStops([]);
    setPlannerError("");
    setPlannerSearchResult(null);
  };

  return (
    <section className="planner-layout">
      <section className="surface-panel planner-panel">
        <div className="planner-copy">
          <p className="eyebrow">Direct Bus Planner</p>
          <h1 className="section-title">
            Choose where you are and where you want to go
          </h1>
          <p className="planner-description">
            Type or select official Translink stop names for your current stop
            and destination. The results panel will only show direct buses.
          </p>
        </div>

        <button
          type="button"
          className="planner-quick-action"
          onClick={() => setPlannerOriginQuery(activeStop.displayName)}
        >
          Use {activeStop.displayName} as origin
        </button>

        <form className="planner-form" onSubmit={handlePlannerSearch}>
          <PlannerStopField
            fieldId="planner-origin-stop"
            label="I am at"
            options={plannerOriginOptions}
            pending={plannerOriginPending}
            placeholder="UQ Lakes station"
            query={plannerOriginQuery}
            onQueryChange={setPlannerOriginQuery}
          />

          <PlannerStopField
            fieldId="planner-destination-stop"
            label="I want to go to"
            options={plannerDestinationOptions}
            pending={plannerDestinationPending}
            placeholder="South Bank busway station"
            query={plannerDestinationQuery}
            onQueryChange={setPlannerDestinationQuery}
          />

          <div className="planner-form-actions">
            <button
              className="destination-search-button"
              type="submit"
              disabled={plannerBusy}
            >
              {plannerLoading ? "Loading buses" : "Show direct buses"}
            </button>

            {plannerOriginQuery ||
            plannerDestinationQuery ||
            plannerHasSearched ? (
              <button
                className="destination-search-clear"
                type="button"
                onClick={clearPlannerSearch}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="planner-form-foot">
            <span>Only official Translink stop and station names are accepted.</span>
            <span>If there is no direct bus, the app will let you know.</span>
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
            <h2 className="section-title">Direct buses</h2>
          </div>
        </div>

        {plannerHasSearched ? (
          <div className="planner-summary">
            <div className="planner-summary-grid">
              <div className="planner-summary-stop">
                <span className="planner-summary-label">From</span>
                <strong>{plannerSearchResult.originStop.label}</strong>
              </div>
              <div className="planner-summary-stop">
                <span className="planner-summary-label">To</span>
                <strong>{plannerSearchResult.destinationStop.label}</strong>
              </div>
            </div>
            <div className="planner-summary-meta">
              <span className="destination-search-status">
                {plannerResultDepartures.length} direct{" "}
                {plannerResultDepartures.length === 1 ? "bus" : "buses"}
              </span>
              {plannerSearchResult.stopName ? (
                <span className="planner-summary-note">
                  Departures from {plannerSearchResult.stopName}
                </span>
              ) : null}
              {plannerSearchResult.generatedAt ? (
                <span className="planner-summary-note">
                  Checked {formatTime(plannerSearchResult.generatedAt)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {plannerLoading ? (
          <>
            <div className="feed-loading-status">Looking up direct buses...</div>
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
                    directMatchLabel={findDepartureStopMatch(
                      departure,
                      plannerSearchResult.destinationStop,
                      plannerResultSource,
                    )}
                    showFavoriteAction={false}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              compact
              message={`No direct buses from ${plannerSearchResult.originStop.label} to ${plannerSearchResult.destinationStop.label} right now.`}
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
  );
}

function PlannerStopField({
  fieldId,
  label,
  options,
  pending = false,
  placeholder,
  query,
  onQueryChange,
}) {
  return (
    <div className="planner-field">
      <div className="planner-field-head">
        <label className="filter-control-label" htmlFor={fieldId}>
          {label}
        </label>
        <span className="destination-search-status">
          {pending
            ? "Searching Translink"
            : query.trim()
              ? `${options.length} official match${
                  options.length === 1 ? "" : "es"
                }`
              : "Official stop search"}
        </span>
      </div>

      <input
        id={fieldId}
        className="destination-search-input"
        type="text"
        list={`${fieldId}-options`}
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <datalist id={`${fieldId}-options`}>
        {options.map((option) => (
          <option key={`${fieldId}-${option}`} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function createSearchStop(stopConfig) {
  const id = String(stopConfig?.id ?? "").trim();
  const label = String(stopConfig?.label ?? stopConfig?.name ?? "").trim();

  if (!label) {
    return null;
  }

  const aliases = buildStopAliases(label, stopConfig?.aliases ?? []);

  return {
    id,
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
    }) ?? null
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
  getHeadsignSegments(departure.fullHeadsign).forEach(pushTarget);

  return Array.from(targetMap.values());
}

function findDepartureStopMatch(departure, destinationStop, stop) {
  if (!destinationStop) {
    return "";
  }

  const targets = getDepartureSearchTargets(departure, stop);
  const targetMatch = targets.find((target) => {
    const normalizedTarget = normalizeSearchCandidate(target);

    return destinationStop.aliasKeys.some((aliasKey) => {
      return (
        normalizedTarget === aliasKey ||
        normalizedTarget.startsWith(`${aliasKey} `) ||
        normalizedTarget.endsWith(` ${aliasKey}`) ||
        normalizedTarget.includes(` ${aliasKey} `)
      );
    });
  });

  return targetMatch ? destinationStop.label : "";
}

async function fetchTranslinkStops(query) {
  const response = await fetch(
    `/api/stops/search?q=${encodeURIComponent(String(query ?? "").trim())}`,
  );

  if (!response.ok) {
    throw new Error("Could not search official stop names.");
  }

  const payload = await response.json();
  const stops = Array.isArray(payload?.stops) ? payload.stops : [];

  return Array.from(
    stops.reduce((stopMap, stop) => {
      const searchStop = createSearchStop(stop);

      if (!searchStop) {
        return stopMap;
      }

      const stopKey = normalizeSearchCandidate(searchStop.label);

      if (!stopMap.has(stopKey)) {
        stopMap.set(stopKey, searchStop);
      }

      return stopMap;
    }, new Map()).values(),
  );
}

async function fetchStopDepartures({ stopId, stopName }) {
  const params = new URLSearchParams();

  if (stopId) {
    params.set("stopId", stopId);
  }

  if (stopName) {
    params.set("stopName", stopName);
  }

  const response = await fetch(`/api/departures?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Could not load departures for this stop.");
  }

  return response.json();
}
