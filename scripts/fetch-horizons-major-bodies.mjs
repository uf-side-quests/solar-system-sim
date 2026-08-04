import { mkdir, rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH = "2026-01-01";
const EPOCH_JD_TDB = 2_461_041.5;

const bodies = [
  ["sun", "Sun", "10", "star", 1.98847e30, 695_700, "#ffb52e"],
  ["mercury", "Mercury", "199", "planet", 3.30103e23, 2_439.4, "#aaa39b"],
  ["venus", "Venus", "299", "planet", 4.86731e24, 6_051.8, "#d8ad6a"],
  ["earth", "Earth", "399", "planet", 5.97217e24, 6_371.0084, "#3f78d6"],
  ["mars", "Mars", "499", "planet", 6.41691e23, 3_389.5, "#bd5b3d"],
  ["jupiter", "Jupiter", "599", "planet", 1.898125e27, 69_911, "#caa17d"],
  ["saturn", "Saturn", "699", "planet", 5.68317e26, 58_232, "#d8c58d"],
  ["uranus", "Uranus", "799", "planet", 8.68099e25, 25_362, "#89d6df"],
  ["neptune", "Neptune", "899", "planet", 1.024092e26, 24_622, "#4169b1"],
  ["moon", "Moon", "301", "moon", 7.342e22, 1_737.4, "#c8c8c5"],
  ["phobos", "Phobos", "401", "moon", 1.0659e16, 11.08, "#93877a"],
  ["deimos", "Deimos", "402", "moon", 1.4762e15, 6.2, "#a69a8c"],
  ["io", "Io", "501", "moon", 8.931938e22, 1_821.6, "#e4cf69"],
  ["europa", "Europa", "502", "moon", 4.799844e22, 1_560.8, "#c9b28c"],
  ["ganymede", "Ganymede", "503", "moon", 1.4819e23, 2_631.2, "#8d8377"],
  ["callisto", "Callisto", "504", "moon", 1.0759e23, 2_410.3, "#685f58"],
  ["mimas", "Mimas", "601", "moon", 3.7493e19, 198.2, "#bdbbb5"],
  ["enceladus", "Enceladus", "602", "moon", 1.08022e20, 252.1, "#e5e6e4"],
  ["tethys", "Tethys", "603", "moon", 6.17449e20, 531.1, "#c7c5bf"],
  ["dione", "Dione", "604", "moon", 1.09545e21, 561.4, "#b8b6b0"],
  ["rhea", "Rhea", "605", "moon", 2.30652e21, 763.8, "#aaa8a3"],
  ["titan", "Titan", "606", "moon", 1.3452e23, 2_574.7, "#c99b53"],
  ["iapetus", "Iapetus", "608", "moon", 1.80564e21, 734.5, "#918a7e"],
  ["ariel", "Ariel", "701", "moon", 1.25e21, 578.9, "#c4c7c5"],
  ["umbriel", "Umbriel", "702", "moon", 1.275e21, 584.7, "#777774"],
  ["titania", "Titania", "703", "moon", 3.527e21, 788.9, "#a4a19c"],
  ["oberon", "Oberon", "704", "moon", 3.014e21, 761.4, "#8f8a84"],
  ["miranda", "Miranda", "705", "moon", 6.4e19, 235.8, "#aaa7a2"],
  ["triton", "Triton", "801", "moon", 2.139e22, 1_353.4, "#c5aaa0"],
  ["pluto", "Pluto", "999", "dwarf-planet", 1.303e22, 1_188.3, "#bca58f"],
  ["charon", "Charon", "901", "moon", 1.586e21, 606, "#878480"],
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
        throw new Error(
          `NASA/JPL Horizons returned HTTP ${String(response.status)}`,
        );
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

function parseFirstVector(result, id) {
  const match = result.match(/\$\$SOE\s*\n([^\n]+)/u);
  if (match === null) {
    throw new Error(`NASA/JPL Horizons returned no vector for ${id}`);
  }
  const values = match[1].split(",").map((value) => value.trim());
  const epoch = Number(values[0]);
  const vector = values.slice(2, 8).map(Number);
  if (
    epoch !== EPOCH_JD_TDB ||
    vector.length !== 6 ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`NASA/JPL Horizons returned an invalid vector for ${id}`);
  }
  return {
    positionM: vector.slice(0, 3).map((value) => value * 1_000),
    velocityMps: vector.slice(3).map((value) => value * 1_000),
  };
}

async function fetchBody(body) {
  const [id, name, horizonsId, type, massKg, radiusKm, color] = body;
  const response = await fetchJson({
    format: "json",
    COMMAND: `'${horizonsId}'`,
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
  const state = parseFirstVector(response.result, id);
  console.log(`Fetched ${name}`);
  return {
    id,
    name,
    authorityId: `NASA/JPL-Horizons:${horizonsId}`,
    type,
    massKg,
    meanRadiusM: radiusKm * 1_000,
    color,
    ...state,
  };
}

async function main() {
  const retrievedAt = new Date().toISOString();
  const records = [];
  for (const body of bodies) {
    records.push(await fetchBody(body));
  }
  const snapshot = {
    schemaVersion: "1.0.0",
    authority: "NASA/JPL Horizons API",
    endpoint: ENDPOINT,
    retrievedAt,
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
    physicalParameterSources: [
      "https://ssd.jpl.nasa.gov/planets/phys_par.html",
      "https://ssd.jpl.nasa.gov/sats/phys_par/",
    ],
    bodies: records,
  };
  await mkdir("src/data", { recursive: true });
  const temporary = "src/data/major-bodies.snapshot.json.tmp";
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temporary, "src/data/major-bodies.snapshot.json");
  console.log(`Published ${String(records.length)} major-body state vectors`);
}

await main();
