import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { URLSearchParams } from "node:url";

const CATALOGUE_ID = "I/239/hip_main";
const SOURCE_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv";
const MAXIMUM_VISIBLE_MAGNITUDE = 6.5;
const OUTPUT_PATH = resolve("src/data/hipparcos-stars.snapshot.json");
const EXPECTED_COLUMNS = [
  "HIP",
  "RAICRS",
  "DEICRS",
  "Vmag",
  "pmRA",
  "pmDE",
  "B-V",
];

function optionalFiniteNumber(value, field, hipId) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Hipparcos ${hipId} has invalid ${field}: ${value}`);
  }
  return parsed;
}

function parseSnapshot(tsv) {
  const lines = tsv.split(/\r?\n/u);
  const headerIndex = lines.findIndex(
    (line) => line === EXPECTED_COLUMNS.join("\t"),
  );
  if (headerIndex < 0) {
    throw new Error("Hipparcos response is missing the expected column header");
  }

  const stars = [];
  for (const line of lines.slice(headerIndex + 3)) {
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const fields = line.split("\t");
    if (fields.length !== EXPECTED_COLUMNS.length) {
      throw new Error(`Hipparcos response row has ${fields.length} fields`);
    }
    const hipId = Number(fields[0]?.trim());
    const raDeg = Number(fields[1]?.trim());
    const decDeg = Number(fields[2]?.trim());
    const visualMagnitude = Number(fields[3]?.trim());
    if (
      !Number.isInteger(hipId) ||
      hipId <= 0 ||
      !Number.isFinite(raDeg) ||
      raDeg < 0 ||
      raDeg >= 360 ||
      !Number.isFinite(decDeg) ||
      decDeg < -90 ||
      decDeg > 90 ||
      !Number.isFinite(visualMagnitude) ||
      visualMagnitude > MAXIMUM_VISIBLE_MAGNITUDE
    ) {
      throw new Error(`Hipparcos row failed validation: ${line}`);
    }
    stars.push({
      hipId,
      raDeg,
      decDeg,
      visualMagnitude,
      properMotionRaMasPerYear: optionalFiniteNumber(
        fields[4] ?? "",
        "pmRA",
        hipId,
      ),
      properMotionDecMasPerYear: optionalFiniteNumber(
        fields[5] ?? "",
        "pmDE",
        hipId,
      ),
      colorIndexBv: optionalFiniteNumber(fields[6] ?? "", "B-V", hipId),
    });
  }

  if (stars.length < 8_000 || stars.length > 12_000) {
    throw new Error(
      `Expected 8,000 to 12,000 visible Hipparcos stars, received ${stars.length}`,
    );
  }
  const uniqueIds = new Set(stars.map((star) => star.hipId));
  if (uniqueIds.size !== stars.length) {
    throw new Error("Hipparcos response contains duplicate identifiers");
  }
  return stars.sort(
    (first, second) =>
      first.visualMagnitude - second.visualMagnitude ||
      first.hipId - second.hipId,
  );
}

const query = new URLSearchParams({
  "-source": CATALOGUE_ID,
  "-out": EXPECTED_COLUMNS.join(","),
  Vmag: `<${MAXIMUM_VISIBLE_MAGNITUDE}`,
  "-out.max": "unlimited",
});
const response = await fetch(`${SOURCE_URL}?${query.toString()}`);
if (!response.ok) {
  throw new Error(
    `Hipparcos catalogue request failed: ${response.status} ${response.statusText}`,
  );
}
const tsv = await response.text();
const stars = parseSnapshot(tsv);
const requestDate = /^#INFO\s+request_date=([^\s]+)/mu.exec(tsv)?.[1];
if (requestDate === undefined) {
  throw new Error("Hipparcos response is missing its request date");
}

const snapshot = {
  schemaVersion: "1.0.0",
  authority: "European Space Agency Hipparcos Catalogue",
  publisher: "CDS VizieR",
  catalogueId: CATALOGUE_ID,
  catalogueReference: "1997HIP...C......0E",
  sourceUrl: `${SOURCE_URL}?${query.toString()}`,
  retrievedAt: `${requestDate}Z`,
  sourceResponseSha256: createHash("sha256").update(tsv).digest("hex"),
  referenceEpochJulianYear: 1991.25,
  coordinateFrame: "ICRS",
  magnitudeBand: "Johnson V",
  selection: `Vmag < ${MAXIMUM_VISIBLE_MAGNITUDE}; valid ICRS position and V magnitude`,
  stars,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${stars.length.toLocaleString()} Hipparcos stars to ${OUTPUT_PATH}`,
);
