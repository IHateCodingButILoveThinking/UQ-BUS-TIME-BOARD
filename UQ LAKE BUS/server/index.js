import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { fetchDepartures } from "./departures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

const PORT = Number(process.env.PORT || 8787);

const app = express();

app.get("/api/departures", async (_request, response) => {
  try {
    const departures = await fetchDepartures();
    response.json(departures);
  } catch (error) {
    console.error("Could not fetch Translink departures", error);
    response.status(500).json({
      error: "Could not load live departures right now.",
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
