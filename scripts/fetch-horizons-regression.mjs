import { mkdir, rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH_JD_TDB = 2_461_041.5;
const offsetsDays = [-365, -30, -1, 0, 1, 30, 365];
const bodies = [
  ["sun", "10"],
  ["earth", "399"],
  ["moon", "301"],
];

async function fetchJson(parameters) {
  const url = new URL(ENDPOINT);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, String(value));
  }
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Horizons returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(attempt * 1_000);
      }
    }
  }
  throw lastError;
}

function parseFirstVector(result, expectedJulianDay, id) {
  const match = result.match(/\$\$SOE\s*\n([^\n]+)/u);
  if (match === null) {
    throw new Error(`Horizons returned no vector for ${id}`);
  }
  const values = match[1].split(",").map((value) => value.trim());
  const epoch = Number(values[0]);
  const vector = values.slice(2, 8).map(Number);
  if (
    Math.abs(epoch - expectedJulianDay) > 1e-9 ||
    vector.length !== 6 ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`Horizons returned an invalid vector for ${id}`);
  }
  return {
    positionM: vector.slice(0, 3).map((value) => value * 1_000),
    velocityMps: vector.slice(3).map((value) => value * 1_000),
  };
}

async function fetchVector(id, horizonsId, offsetDays) {
  const julianDay = EPOCH_JD_TDB + offsetDays;
  const response = await fetchJson({
    format: "json",
    COMMAND: `'${horizonsId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@0'",
    START_TIME: `'JD${julianDay}'`,
    STOP_TIME: `'JD${julianDay + 1}'`,
    STEP_SIZE: "'1 d'",
    VEC_TABLE: "'2'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    REF_PLANE: "'FRAME'",
  });
  return parseFirstVector(response.result, julianDay, id);
}

const samples = [];
for (const offsetDays of offsetsDays) {
  const states = {};
  for (const [id, horizonsId] of bodies) {
    states[id] = await fetchVector(id, horizonsId, offsetDays);
    console.log(
      `Fetched ${id} at ${offsetDays >= 0 ? "+" : ""}${offsetDays} d`,
    );
  }
  samples.push({ offsetDays, bodies: states });
}

const snapshot = {
  schemaVersion: "1.0.0",
  authority: "NASA/JPL Horizons API",
  endpoint: ENDPOINT,
  retrievedAt: new Date().toISOString(),
  epochJulianDayTdb: EPOCH_JD_TDB,
  origin: "Solar System Barycenter",
  frame: "ICRF",
  corrections: "geometric; no aberration corrections",
  samples,
};
await mkdir("src/data", { recursive: true });
const temporary = "src/data/horizons-regression.snapshot.json.tmp";
await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
await rename(temporary, "src/data/horizons-regression.snapshot.json");
console.log(`Published ${samples.length} Horizons regression epochs`);
