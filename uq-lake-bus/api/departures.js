import { fetchDepartures } from "../server/departures.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export async function GET() {
  try {
    const departures = await fetchDepartures();

    return new Response(JSON.stringify(departures), {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        "cache-control": "public, s-maxage=20, stale-while-revalidate=40",
      },
    });
  } catch (error) {
    console.error("Could not fetch Translink departures", error);

    return new Response(
      JSON.stringify({
        error: "Could not load live departures right now.",
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
