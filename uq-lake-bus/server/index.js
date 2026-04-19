import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { fetchDepartures, fetchStopMatches } from "./departures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

const PORT = Number(process.env.PORT || 8787);

const app = express();

app.get("/api/departures", async (request, response) => {
  try {
    const stopId = String(request.query.stopId ?? "").trim();
    const stopName = String(request.query.stopName ?? "").trim();
    const limit = request.query.limit;
    const departures = await fetchDepartures({
      stopLookup: stopId || stopName || undefined,
      displayName: stopName || undefined,
      limit,
    });
    response.json(departures);
  } catch (error) {
    console.error("Could not fetch Translink departures", error);
    response.status(500).json({
      error: "Could not load live departures right now.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/stops/search", async (request, response) => {
  try {
    const query = String(request.query.q ?? "").trim();
    const stops = await fetchStopMatches(query);
    response.json({ stops });
  } catch (error) {
    console.error("Could not search Translink stops", error);
    response.status(500).json({
      error: "Could not search Translink stops right now.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.use((_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`UQ Lakes bus server running on http://127.0.0.1:${PORT}`);
  });
}
