import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

const ENDPOINT = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";
const FIELDS = [
  "spkid",
  "pdes",
  "kind",
  "epoch",
  "e",
  "a",
  "q",
  "i",
  "om",
  "w",
  "ma",
  "tp",
];
const PAGE_SIZE = 50_000;
const RECORD_STRIDE_BYTES = 48;
const REFERENCE_EPOCH_JD_TDB = 2_461_041.5;
const GAUSSIAN_GRAVITATIONAL_CONSTANT = 0.017_202_098_95;
const DEG_TO_RAD = Math.PI / 180;

function requiredNumber(value) {
  if (value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRadians(value) {
  const wrapped = value % (2 * Math.PI);
  return wrapped > Math.PI
    ? wrapped - 2 * Math.PI
    : wrapped < -Math.PI
      ? wrapped + 2 * Math.PI
      : wrapped;
}

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
          `NASA/JPL SBDB returned HTTP ${String(response.status)}`,
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

async function currentCounts() {
  const response = await fetchJson({ info: "count" });
  const count = response.info?.count;
  if (count === undefined) {
    throw new Error("NASA/JPL SBDB count response is missing info.count");
  }
  const categories = {
    numberedAsteroids: Number(count.an),
    unnumberedAsteroids: Number(count.au),
    numberedComets: Number(count.cn),
    unnumberedComets: Number(count.cu),
  };
  if (Object.values(categories).some((value) => !Number.isSafeInteger(value))) {
    throw new Error("NASA/JPL SBDB returned a non-integer catalogue count");
  }
  return categories;
}

function totalCount(categories) {
  return Object.values(categories).reduce((total, value) => total + value, 0);
}

function packRecord(view, recordIndex, row) {
  const values = Object.fromEntries(
    FIELDS.map((field, fieldIndex) => [field, row[fieldIndex]]),
  );
  const spkid = requiredNumber(values.spkid);
  if (
    spkid === undefined ||
    !Number.isSafeInteger(spkid) ||
    spkid < 0 ||
    spkid > 0xffff_ffff
  ) {
    throw new Error(`Invalid SBDB SPK-ID at record ${String(recordIndex)}`);
  }

  const eccentricity = requiredNumber(values.e);
  const semiMajorAxisAu = requiredNumber(values.a);
  const perihelionAu = requiredNumber(values.q);
  const inclinationDeg = requiredNumber(values.i);
  const ascendingNodeDeg = requiredNumber(values.om);
  const argumentPerihelionDeg = requiredNumber(values.w);
  const epochJd = requiredNumber(values.epoch);
  const meanAnomalyDeg = requiredNumber(values.ma);
  const perihelionTimeJd = requiredNumber(values.tp);
  const kind = String(values.kind ?? "");
  const isComet = kind.startsWith("c");
  const isNumbered = kind.endsWith("n");

  const integrable =
    eccentricity !== undefined &&
    eccentricity >= 0 &&
    Math.abs(eccentricity - 1) > 0.000_01 &&
    semiMajorAxisAu !== undefined &&
    semiMajorAxisAu !== 0 &&
    perihelionAu !== undefined &&
    perihelionAu > 0 &&
    inclinationDeg !== undefined &&
    ascendingNodeDeg !== undefined &&
    argumentPerihelionDeg !== undefined &&
    epochJd !== undefined &&
    (meanAnomalyDeg !== undefined || perihelionTimeJd !== undefined);

  let meanAnomalyAtReferenceRad = 0;
  let meanMotionRadPerDay = 0;
  if (integrable) {
    meanMotionRadPerDay =
      GAUSSIAN_GRAVITATIONAL_CONSTANT /
      Math.pow(Math.abs(semiMajorAxisAu), 1.5);
    meanAnomalyAtReferenceRad =
      meanAnomalyDeg === undefined
        ? meanMotionRadPerDay * (REFERENCE_EPOCH_JD_TDB - perihelionTimeJd)
        : meanAnomalyDeg * DEG_TO_RAD +
          meanMotionRadPerDay * (REFERENCE_EPOCH_JD_TDB - epochJd);
    if (eccentricity < 1) {
      meanAnomalyAtReferenceRad = normalizeRadians(meanAnomalyAtReferenceRad);
    }
  }

  const byteOffset = recordIndex * RECORD_STRIDE_BYTES;
  view.setFloat32(byteOffset, semiMajorAxisAu ?? 0, true);
  view.setFloat32(byteOffset + 4, eccentricity ?? 0, true);
  view.setFloat32(byteOffset + 8, perihelionAu ?? 0, true);
  view.setFloat32(byteOffset + 12, (inclinationDeg ?? 0) * DEG_TO_RAD, true);
  view.setFloat32(byteOffset + 16, (ascendingNodeDeg ?? 0) * DEG_TO_RAD, true);
  view.setFloat32(
    byteOffset + 20,
    (argumentPerihelionDeg ?? 0) * DEG_TO_RAD,
    true,
  );
  view.setFloat32(byteOffset + 24, meanAnomalyAtReferenceRad, true);
  view.setFloat32(byteOffset + 28, meanMotionRadPerDay, true);
  view.setUint32(byteOffset + 32, spkid, true);
  view.setUint32(
    byteOffset + 36,
    (integrable ? 1 : 0) | (isComet ? 2 : 0) | (isNumbered ? 4 : 0),
    true,
  );
  view.setFloat32(
    byteOffset + 40,
    epochJd === undefined ? 0 : epochJd - REFERENCE_EPOCH_JD_TDB,
    true,
  );
  view.setUint32(byteOffset + 44, recordIndex, true);

  const designation = String(values.pdes ?? "")
    .replaceAll("\t", " ")
    .replaceAll("\n", " ");
  return {
    designation: `${String(spkid)}\t${designation}\t${kind}\n`,
    integrable,
    isComet,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const countsBefore = await currentCounts();
  const expectedCount = totalCount(countsBefore);
  const buffer = new ArrayBuffer(expectedCount * RECORD_STRIDE_BYTES);
  const view = new DataView(buffer);
  const designations = [];
  const seenSpkIds = new Set();
  let recordIndex = 0;
  let integrableCount = 0;
  let asteroidCount = 0;
  let cometCount = 0;

  for (let offset = 0; offset < expectedCount; offset += PAGE_SIZE) {
    const page = await fetchJson({
      fields: FIELDS.join(","),
      "full-prec": "true",
      limit: Math.min(PAGE_SIZE, expectedCount - offset),
      "limit-from": offset,
      sort: "spkid",
    });
    if (JSON.stringify(page.fields) !== JSON.stringify(FIELDS)) {
      throw new Error("NASA/JPL SBDB response field order changed");
    }
    if (!Array.isArray(page.data)) {
      throw new Error(`NASA/JPL SBDB page ${String(offset)} has no data array`);
    }
    for (const row of page.data) {
      const spkid = Number(row[0]);
      if (seenSpkIds.has(spkid)) {
        throw new Error(`Duplicate NASA/JPL SBDB SPK-ID ${String(spkid)}`);
      }
      seenSpkIds.add(spkid);
      const packed = packRecord(view, recordIndex, row);
      designations.push(packed.designation);
      integrableCount += packed.integrable ? 1 : 0;
      cometCount += packed.isComet ? 1 : 0;
      asteroidCount += packed.isComet ? 0 : 1;
      recordIndex += 1;
    }
    console.log(`Fetched ${String(recordIndex)} of ${String(expectedCount)}`);
  }

  const countsAfter = await currentCounts();
  if (
    JSON.stringify(countsAfter) !== JSON.stringify(countsBefore) ||
    recordIndex !== expectedCount ||
    seenSpkIds.size !== expectedCount
  ) {
    throw new Error(
      "NASA/JPL SBDB changed during retrieval; refusing to publish an incomplete snapshot",
    );
  }

  await mkdir("public/data", { recursive: true });
  await mkdir("data", { recursive: true });
  const binary = Buffer.from(buffer);
  const checksumSha256 = createHash("sha256").update(binary).digest("hex");
  const retrievedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: "1.0.0",
    authority: "NASA/JPL SBDB (Small-Body DataBase) Query API",
    endpoint: ENDPOINT,
    retrievedAt,
    retrievalStartedAt: startedAt,
    referenceEpoch: {
      value: REFERENCE_EPOCH_JD_TDB,
      format: "Julian day",
      timeScale: "TDB",
    },
    coordinateModel: {
      origin: "Sun",
      frame: "J2000 ecliptic orbital elements",
      propagation: "GPU two-body Kepler propagation",
      numericPrecision: "IEEE-754 binary32 with epoch rebasing",
    },
    counts: {
      ...countsBefore,
      asteroids: asteroidCount,
      comets: cometCount,
      total: expectedCount,
      integrable: integrableCount,
      unavailableForSimulation: expectedCount - integrableCount,
    },
    binary: {
      path: "/data/sbdb-orbits.bin",
      recordStrideBytes: RECORD_STRIDE_BYTES,
      byteLength: binary.byteLength,
      checksumSha256,
    },
  };

  const binaryTemporary = "public/data/sbdb-orbits.bin.tmp";
  const manifestTemporary = "public/data/sbdb-snapshot.json.tmp";
  const designationTemporary = "data/sbdb-designations.tsv.gz.tmp";
  await writeFile(binaryTemporary, binary);
  await writeFile(manifestTemporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    designationTemporary,
    await gzipAsync(designations.join(""), { level: 9 }),
  );
  await rename(binaryTemporary, "public/data/sbdb-orbits.bin");
  await rename(manifestTemporary, "public/data/sbdb-snapshot.json");
  await rename(designationTemporary, "data/sbdb-designations.tsv.gz");
  console.log(
    `Published ${String(expectedCount)} NASA/JPL records; ${String(integrableCount)} are GPU-propagatable`,
  );
}

await main();
