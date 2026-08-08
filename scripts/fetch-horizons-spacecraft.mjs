import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { URL, URLSearchParams } from "node:url";

const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH_JD_TDB = 2_461_041.5;
const missions = [
  {
    id: "roadster",
    name: "Tesla Roadster and Starman",
    command: "-143205",
    start: "2018-02-07 03:00",
    stop: "2090-01-01",
    step: "5 d",
    maximumDimensionM: 3.946,
    massKg: 1_250,
  },
  {
    id: "hubble",
    name: "Hubble Space Telescope",
    command: "-48",
    start: "2026-01-01",
    stop: "2026-10-11",
    step: "1 h",
    maximumDimensionM: 13.2,
    massKg: 11_110,
  },
  {
    id: "jwst",
    name: "James Webb Space Telescope",
    command: "-170",
    start: "2026-01-01",
    stop: "2027-01-01",
    step: "6 h",
    maximumDimensionM: 21.197,
    massKg: 6_200,
  },
];

function quoted(value) {
  return `'${value}'`;
}

function parseVectors(result, mission) {
  const start = result.indexOf("$$SOE");
  const end = result.indexOf("$$EOE");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      `Horizons returned no vector block for ${mission.name}: ${result.slice(0, 2_000)}`,
    );
  }
  return result
    .slice(start + "$$SOE".length, end)
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const columns = line.split(",").map((value) => value.trim());
      if (columns.length < 8) {
        throw new Error(`Malformed Horizons row for ${mission.name}: ${line}`);
      }
      const julianDateTdb = Number(columns[0]);
      const state = columns.slice(2, 8).map(Number);
      if (!Number.isFinite(julianDateTdb) || !state.every(Number.isFinite)) {
        throw new Error(`Non-finite Horizons row for ${mission.name}: ${line}`);
      }
      return {
        timeSeconds: (julianDateTdb - EPOCH_JD_TDB) * 86_400,
        positionM: state.slice(0, 3).map((value) => value * 1_000),
        velocityMps: state.slice(3, 6).map((value) => value * 1_000),
      };
    });
}

const spacecraft = [];
for (const mission of missions) {
  const parameters = new URLSearchParams({
    format: "json",
    COMMAND: quoted(mission.command),
    OBJ_DATA: quoted("YES"),
    MAKE_EPHEM: quoted("YES"),
    EPHEM_TYPE: quoted("VECTORS"),
    CENTER: quoted("500@0"),
    START_TIME: quoted(mission.start),
    STOP_TIME: quoted(mission.stop),
    STEP_SIZE: quoted(mission.step),
    REF_SYSTEM: quoted("ICRF"),
    REF_PLANE: quoted("FRAME"),
    OUT_UNITS: quoted("KM-S"),
    VEC_TABLE: quoted("2"),
    CSV_FORMAT: quoted("YES"),
  });
  const response = await fetch(`${HORIZONS_URL}?${parameters.toString()}`);
  if (!response.ok) {
    throw new Error(
      `Horizons ${mission.name} request failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = await response.text();
  const sourceSha256 = createHash("sha256").update(body).digest("hex");
  const json = JSON.parse(body);
  if (typeof json.result !== "string") {
    throw new Error(`Horizons ${mission.name} response has no result text`);
  }
  spacecraft.push({
    ...mission,
    authority: "NASA/JPL Horizons",
    sourceUrl: `${HORIZONS_URL}?${parameters.toString()}`,
    sourceSha256,
    samples: parseVectors(json.result, mission),
  });
}

await writeFile(
  new URL("../src/data/operational-spacecraft.snapshot.json", import.meta.url),
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      epoch: {
        julianDateTdb: EPOCH_JD_TDB,
        referenceFrame: "ICRF",
        center: "Solar System Barycenter (500@0)",
      },
      interpolation: "cubic Hermite position and velocity",
      spacecraft,
    },
    null,
    2,
  )}\n`,
);
