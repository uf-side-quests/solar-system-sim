import { rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH_JD_TDB = 2_461_041.5;
const probes = [
  {
    id: "voyager-1",
    name: "Voyager 1",
    horizonsCommand: "-31",
    launchDateUtc: "1977-09-05T12:56:00Z",
    massKg: 733,
    maximumDimensionM: 13,
    highGainAntennaDiameterM: 3.7,
    heightM: 3.8,
    horizonsSolution: "Voyager_1_ST+refit2022_m",
  },
  {
    id: "voyager-2",
    name: "Voyager 2",
    horizonsCommand: "-32",
    launchDateUtc: "1977-08-20T14:29:00Z",
    massKg: 735,
    maximumDimensionM: 13,
    highGainAntennaDiameterM: 3.7,
    heightM: 3.8,
    horizonsSolution: "Voyager_2_ST+refit2022_m",
  },
];

async function fetchJson(parameters) {
  const url = new URL(ENDPOINT);
  for (const [name, value] of Object.entries(parameters))
    url.searchParams.set(name, String(value));
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(
          `NASA/JPL Horizons returned HTTP ${String(response.status)}`,
        );
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 1_000);
    }
  }
  throw lastError;
}

function parseVector(result, probeId) {
  const match = result.match(/\$\$SOE\s*\n([^\n]+)/u);
  if (match === null)
    throw new Error(`NASA/JPL Horizons returned no vector for ${probeId}`);
  const values = match[1].split(",").map((value) => value.trim());
  const epoch = Number(values[0]);
  const vector = values.slice(2, 8).map(Number);
  if (
    epoch !== EPOCH_JD_TDB ||
    vector.length !== 6 ||
    vector.some((value) => !Number.isFinite(value))
  )
    throw new Error(
      `NASA/JPL Horizons returned an invalid vector for ${probeId}`,
    );
  return {
    positionM: vector.slice(0, 3).map((value) => value * 1_000),
    velocityMps: vector.slice(3).map((value) => value * 1_000),
  };
}

async function fetchProbe(probe) {
  const response = await fetchJson({
    format: "json",
    COMMAND: `'${probe.horizonsCommand}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@0'",
    START_TIME: "'2026-01-01'",
    STOP_TIME: "'2026-01-02'",
    STEP_SIZE: "'1 d'",
    VEC_TABLE: "'2'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    REF_PLANE: "'FRAME'",
  });
  return { ...probe, ...parseVector(response.result, probe.id) };
}

const records = [];
for (const probe of probes) records.push(await fetchProbe(probe));
const snapshot = {
  schemaVersion: "1.0.0",
  authority: "NASA/JPL Horizons",
  endpoint: ENDPOINT,
  epoch: {
    julianDateTdb: EPOCH_JD_TDB,
    isoDateTdb: "2026-01-01T00:00:00 TDB",
    referenceFrame: "ICRF",
    center: "Solar System Barycenter (500@0)",
  },
  trajectoryCoverage: {
    endYear: 2049,
    source: "JPL Horizons Voyager trajectory solutions",
  },
  probes: records,
};
const temporary = "src/data/voyager.snapshot.json.tmp";
await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
await rename(temporary, "src/data/voyager.snapshot.json");
console.log("Published Voyager 1 and Voyager 2 state vectors");
