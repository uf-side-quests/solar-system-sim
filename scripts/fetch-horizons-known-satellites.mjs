import { mkdir, rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH = "2026-01-01";
const EPOCH_JD_TDB = 2_461_041.5;
const CONCURRENCY = 2;
const REQUEST_SPACING_MS = 200;

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
        throw new Error(
          `NASA/JPL Horizons returned HTTP ${String(response.status)}`,
        );
      }
      const result = await response.json();
      if (typeof result.result !== "string") {
        throw new Error("NASA/JPL Horizons returned no text result");
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(attempt * 1_000);
      }
    }
  }
  throw lastError;
}

function isNaturalSatelliteId(id) {
  if (id === 301) {
    return true;
  }
  const threeDigitFamily = Math.floor(id / 100);
  if (threeDigitFamily >= 4 && threeDigitFamily <= 9 && id % 100 !== 99) {
    return true;
  }
  return id >= 55_000 && id < 100_000;
}

function parentIdFor(horizonsId) {
  if (horizonsId === 301) {
    return "earth";
  }
  const family = Number(String(horizonsId)[0]);
  const parents = {
    4: "mars",
    5: "jupiter",
    6: "saturn",
    7: "uranus",
    8: "neptune",
    9: "pluto",
  };
  const parentId = parents[family];
  if (parentId === undefined) {
    throw new Error(`No parent mapping for Horizons satellite ${horizonsId}`);
  }
  return parentId;
}

function parseMajorBodyIndex(result) {
  const satellites = [];
  for (const line of result.split("\n")) {
    const idMatch = line.match(/^\s+(\d+)\s{2,}/u);
    if (idMatch === null) {
      continue;
    }
    const idText = idMatch[1];
    const horizonsId = Number(idText);
    if (!isNaturalSatelliteId(horizonsId)) {
      continue;
    }
    const officialName = line.slice(11, 45).trim();
    const designation = line.slice(46, 57).trim();
    const name = officialName || designation;
    if (name === "") {
      throw new Error(
        `Horizons satellite ${idText} has no name or designation`,
      );
    }
    satellites.push({ horizonsId, name, parentId: parentIdFor(horizonsId) });
  }
  const uniqueIds = new Set(satellites.map((body) => body.horizonsId));
  if (uniqueIds.size !== satellites.length || satellites.length < 400) {
    throw new Error(
      `Horizons major-body index produced ${String(satellites.length)} non-unique or incomplete satellite records`,
    );
  }
  return satellites.sort((left, right) => left.horizonsId - right.horizonsId);
}

function parseFirstVector(result, horizonsId) {
  const match = result.match(/\$\$SOE\s*\n([^\n]+)/u);
  if (match === null) {
    return undefined;
  }
  const values = match[1].split(",").map((value) => value.trim());
  const epoch = Number(values[0]);
  const vector = values.slice(2, 8).map(Number);
  if (
    epoch !== EPOCH_JD_TDB ||
    vector.length !== 6 ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `NASA/JPL Horizons returned an invalid vector for ${horizonsId}`,
    );
  }
  return {
    positionM: vector.slice(0, 3).map((value) => value * 1_000),
    velocityMps: vector.slice(3).map((value) => value * 1_000),
  };
}

async function fetchSatellite(definition) {
  const response = await fetchJson({
    format: "json",
    COMMAND: `'${String(definition.horizonsId)}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@0'",
    START_TIME: `'${EPOCH}'`,
    STOP_TIME: "'2026-01-02'",
    STEP_SIZE: "'1 d'",
    VEC_TABLE: "'2'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
    REF_PLANE: "'FRAME'",
  });
  const state = parseFirstVector(response.result, definition.horizonsId);
  const identity = {
    id: `horizons-moon-${String(definition.horizonsId)}`,
    name: definition.name,
    authorityId: `NASA/JPL-Horizons:${String(definition.horizonsId)}`,
    horizonsId: definition.horizonsId,
    parentId: definition.parentId,
  };
  if (state === undefined) {
    const unavailableReason =
      typeof response.error === "string" && response.error.trim() !== ""
        ? response.error.trim()
        : `No state vector at JD ${String(EPOCH_JD_TDB)} TDB`;
    return { ...identity, availability: "unavailable", unavailableReason };
  }
  return { ...identity, availability: "available", ...state };
}

async function main() {
  const indexResponse = await fetchJson({ format: "json", COMMAND: "'MB'" });
  const definitions = parseMajorBodyIndex(indexResponse.result);
  const records = new Array(definitions.length);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (nextIndex < definitions.length) {
      const index = nextIndex;
      nextIndex += 1;
      const definition = definitions[index];
      records[index] = await fetchSatellite(definition);
      await delay(REQUEST_SPACING_MS);
      completed += 1;
      if (completed % 25 === 0 || completed === definitions.length) {
        console.log(
          `Fetched ${String(completed)}/${String(definitions.length)} satellite states`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const snapshot = {
    schemaVersion: "1.0.0",
    authority: "NASA/JPL Horizons major-body index and vector API",
    endpoint: ENDPOINT,
    retrievedAt: new Date().toISOString(),
    catalogueCommand: "MB",
    epoch: {
      value: EPOCH_JD_TDB,
      format: "Julian day",
      timeScale: "TDB",
    },
    stateVector: {
      origin: "Solar System Barycenter",
      frame: "ICRF",
      positionUnits: "m",
      velocityUnits: "m/s",
      corrections: "geometric; no aberration corrections",
    },
    simulationRole:
      "Massless reversible two-body propagation around each live REBOUND parent body",
    availabilityContract:
      "Every indexed satellite is retained; records without a state vector at the common epoch are explicitly unavailable and are not simulated",
    bodies: records,
  };
  await mkdir("src/data", { recursive: true });
  const temporary = "src/data/known-satellites.snapshot.json.tmp";
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temporary, "src/data/known-satellites.snapshot.json");
  console.log(`Published ${String(records.length)} satellite state vectors`);
}

await main();
