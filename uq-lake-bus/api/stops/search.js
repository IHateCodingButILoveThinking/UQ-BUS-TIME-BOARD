import { fetchStopMatches } from "../../server/departures.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") ?? "").trim();
    const stops = await fetchStopMatches(query);

    return new Response(JSON.stringify({ stops }), {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        "cache-control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Could not search Translink stops", error);

    return new Response(
      JSON.stringify({
        error: "Could not search Translink stops right now.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...JSON_HEADERS,
          "cache-control": "no-store",
        },
      },
    );
  }
}
