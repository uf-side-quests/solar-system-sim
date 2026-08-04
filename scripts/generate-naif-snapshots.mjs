import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const PCK_PATH = new URL("../data/naif/pck00011.tpc", import.meta.url);
const GM_PATH = new URL("../data/naif/gm_de440.tpc", import.meta.url);
const BODIES_PATH = new URL(
  "../src/data/major-bodies.snapshot.json",
  import.meta.url,
);
const OUTPUT_PATH = new URL(
  "../src/data/naif-physical.snapshot.json",
  import.meta.url,
);

const [pckText, gmText, bodyText] = await Promise.all([
  readFile(PCK_PATH, "utf8"),
  readFile(GM_PATH, "utf8"),
  readFile(BODIES_PATH, "utf8"),
]);
const bodySnapshot = JSON.parse(bodyText);

function numbers(value) {
  return [...value.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[DE][-+]?\d+)?/gi)].map(
    (match) => Number(match[0].replace(/[dD]/u, "E")),
  );
}

function lastAssignment(text, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*\\(([\\s\\S]*?)\\)`, "giu");
  const matches = [...text.matchAll(pattern)];
  const last = matches.at(-1);
  return last === undefined ? undefined : numbers(last[1]);
}

function requiredAssignment(text, name) {
  const value = lastAssignment(text, name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Required NAIF assignment ${name} is missing`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const bodies = {};
for (const body of bodySnapshot.bodies) {
  const naifId = Number(body.authorityId.split(":").at(-1));
  if (!Number.isInteger(naifId)) {
    throw new Error(`Invalid NAIF body identifier for ${body.id}`);
  }
  const systemId = Math.trunc(naifId / 100);
  const poleRightAscensionDeg = requiredAssignment(
    pckText,
    `BODY${naifId}_POLE_RA`,
  );
  const poleDeclinationDeg = requiredAssignment(
    pckText,
    `BODY${naifId}_POLE_DEC`,
  );
  const primeMeridianDeg = requiredAssignment(pckText, `BODY${naifId}_PM`);
  const nutationRightAscensionDeg =
    lastAssignment(pckText, `BODY${naifId}_NUT_PREC_RA`) ?? [];
  const nutationDeclinationDeg =
    lastAssignment(pckText, `BODY${naifId}_NUT_PREC_DEC`) ?? [];
  const nutationPrimeMeridianDeg =
    lastAssignment(pckText, `BODY${naifId}_NUT_PREC_PM`) ?? [];
  const phaseValues =
    lastAssignment(pckText, `BODY${systemId}_NUT_PREC_ANGLES`) ?? [];
  const maximumPhaseDegree =
    lastAssignment(pckText, `BODY${systemId}_MAX_PHASE_DEGREE`)?.[0] ?? 1;
  const phaseWidth = maximumPhaseDegree + 1;
  if (phaseValues.length % phaseWidth !== 0) {
    throw new Error(
      `NAIF phase coefficients for system ${systemId} are malformed`,
    );
  }
  const phaseAnglesDeg = [];
  for (let index = 0; index < phaseValues.length; index += phaseWidth) {
    phaseAnglesDeg.push(phaseValues.slice(index, index + phaseWidth));
  }
  const maximumNutationTerms = Math.max(
    nutationRightAscensionDeg.length,
    nutationDeclinationDeg.length,
    nutationPrimeMeridianDeg.length,
  );
  if (maximumNutationTerms > phaseAnglesDeg.length) {
    throw new Error(
      `NAIF body ${naifId} has more nutation terms than system ${systemId} phase angles`,
    );
  }
  const gravitationalParameterKm3S2 = requiredAssignment(
    gmText,
    `BODY${naifId}_GM`,
  )[0];
  bodies[body.id] = {
    naifId,
    gravitationalParameterM3S2: gravitationalParameterKm3S2 * 1_000_000_000,
    orientation: {
      poleRightAscensionDeg,
      poleDeclinationDeg,
      primeMeridianDeg,
      nutationRightAscensionDeg,
      nutationDeclinationDeg,
      nutationPrimeMeridianDeg,
      phaseAnglesDeg,
    },
  };
}

const output = {
  schemaVersion: "1.0.0",
  gravitationalParameters: {
    authority: "NASA/JPL NAIF gm_de440.tpc",
    sourceUrl:
      "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc",
    sourceSha256: sha256(gmText),
    sourceUnits: "km^3/s^2",
    outputUnits: "m^3/s^2",
  },
  orientations: {
    authority: "NASA/JPL NAIF pck00011.tpc",
    sourceUrl:
      "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc",
    sourceSha256: sha256(pckText),
    angleUnits: "degrees",
    polynomialTimeUnits: {
      pole: "Julian centuries since J2000 TDB",
      primeMeridian: "days since J2000 TDB",
      phase: "Julian centuries since J2000 TDB",
    },
  },
  bodies,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${Object.keys(bodies).length} NAIF body records`);
