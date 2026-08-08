import { z } from "zod";

import snapshotJson from "../data/operational-spacecraft.snapshot.json";
import type { BodyState, SimulationState } from "./contracts";

const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
const sampleSchema = z.object({
  timeSeconds: z.number(),
  positionM: vector3Schema,
  velocityMps: vector3Schema,
});
const spacecraftSchema = z.object({
  id: z.enum(["roadster", "hubble", "jwst"]),
  name: z.string().min(1),
  command: z.string().min(1),
  start: z.string().min(1),
  stop: z.string().min(1),
  step: z.string().min(1),
  maximumDimensionM: z.number().positive(),
  massKg: z.number().positive(),
  authority: z.literal("NASA/JPL Horizons"),
  sourceUrl: z.url(),
  sourceSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  samples: z.array(sampleSchema).min(2),
});
const snapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.iso.datetime(),
  epoch: z.object({
    julianDateTdb: z.literal(2_461_041.5),
    referenceFrame: z.literal("ICRF"),
    center: z.literal("Solar System Barycenter (500@0)"),
  }),
  interpolation: z.literal("cubic Hermite position and velocity"),
  spacecraft: z.array(spacecraftSchema).length(3),
});

export const operationalSpacecraftSnapshot = snapshotSchema.parse(snapshotJson);
export type OperationalSpacecraft =
  (typeof operationalSpacecraftSnapshot.spacecraft)[number];
export const operationalSpacecraftById = new Map(
  operationalSpacecraftSnapshot.spacecraft.map((spacecraft) => [
    spacecraft.id,
    spacecraft,
  ]),
);
export const OPERATIONAL_SPACECRAFT_BODY_IDS = [
  "roadster",
  "hubble",
  "jwst",
] as const;

export function isOperationalSpacecraftBodyId(
  bodyId: string,
): bodyId is OperationalSpacecraft["id"] {
  return operationalSpacecraftById.has(bodyId as OperationalSpacecraft["id"]);
}

export function isOperationalSpacecraftWithinValidity(
  bodyId: OperationalSpacecraft["id"],
  timeSeconds: number,
): boolean {
  const spacecraft = operationalSpacecraftById.get(bodyId);
  if (spacecraft === undefined || !Number.isFinite(timeSeconds)) {
    return false;
  }
  const first = spacecraft.samples[0];
  const last = spacecraft.samples.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error(`${spacecraft.name} ephemeris has no coverage`);
  }
  return timeSeconds >= first.timeSeconds && timeSeconds <= last.timeSeconds;
}

export function operationalSpacecraftRecommendedTimeSeconds(
  bodyId: OperationalSpacecraft["id"],
): number {
  const spacecraft = operationalSpacecraftById.get(bodyId);
  if (spacecraft === undefined) {
    throw new Error(`Operational spacecraft ${bodyId} is unavailable`);
  }
  const middle = spacecraft.samples[Math.floor(spacecraft.samples.length / 2)];
  if (middle === undefined) {
    throw new Error(`${spacecraft.name} ephemeris has no midpoint`);
  }
  return middle.timeSeconds;
}

function samplePair(spacecraft: OperationalSpacecraft, timeSeconds: number) {
  if (!isOperationalSpacecraftWithinValidity(spacecraft.id, timeSeconds)) {
    throw new Error(
      `${spacecraft.name} ephemeris is unavailable at ${String(timeSeconds)} simulation seconds`,
    );
  }
  let lower = 0;
  let upper = spacecraft.samples.length - 1;
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    const sample = spacecraft.samples[middle];
    if (sample === undefined) {
      throw new Error(
        `${spacecraft.name} ephemeris sample ${String(middle)} is missing`,
      );
    }
    if (sample.timeSeconds <= timeSeconds) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  const first = spacecraft.samples[lower];
  const second = spacecraft.samples[upper];
  if (first === undefined || second === undefined) {
    throw new Error(`${spacecraft.name} interpolation pair is missing`);
  }
  return { first, second };
}

export function interpolateOperationalSpacecraft(
  bodyId: OperationalSpacecraft["id"],
  timeSeconds: number,
): BodyState {
  const spacecraft = operationalSpacecraftById.get(bodyId);
  if (spacecraft === undefined) {
    throw new Error(`Operational spacecraft ${bodyId} is unavailable`);
  }
  const { first, second } = samplePair(spacecraft, timeSeconds);
  const duration = second.timeSeconds - first.timeSeconds;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`${spacecraft.name} ephemeris samples are not ordered`);
  }
  const fraction = (timeSeconds - first.timeSeconds) / duration;
  const fractionSquared = fraction * fraction;
  const fractionCubed = fractionSquared * fraction;
  const h00 = 2 * fractionCubed - 3 * fractionSquared + 1;
  const h10 = fractionCubed - 2 * fractionSquared + fraction;
  const h01 = -2 * fractionCubed + 3 * fractionSquared;
  const h11 = fractionCubed - fractionSquared;
  const dh00 = (6 * fractionSquared - 6 * fraction) / duration;
  const dh10 = 3 * fractionSquared - 4 * fraction + 1;
  const dh01 = (-6 * fractionSquared + 6 * fraction) / duration;
  const dh11 = 3 * fractionSquared - 2 * fraction;
  const positionAtAxis = (axis: 0 | 1 | 2): number =>
    h00 * first.positionM[axis] +
    h10 * duration * first.velocityMps[axis] +
    h01 * second.positionM[axis] +
    h11 * duration * second.velocityMps[axis];
  const velocityAtAxis = (axis: 0 | 1 | 2): number =>
    dh00 * first.positionM[axis] +
    dh10 * first.velocityMps[axis] +
    dh01 * second.positionM[axis] +
    dh11 * second.velocityMps[axis];
  const positionM: [number, number, number] = [
    positionAtAxis(0),
    positionAtAxis(1),
    positionAtAxis(2),
  ];
  const velocityMps: [number, number, number] = [
    velocityAtAxis(0),
    velocityAtAxis(1),
    velocityAtAxis(2),
  ];
  return {
    id: spacecraft.id,
    gravitationalParameterM3S2: 0,
    positionM,
    velocityMps,
  };
}

export function withOperationalSpacecraft(
  state: SimulationState,
): SimulationState {
  const integratedBodies = state.bodies.filter(
    (body) => !isOperationalSpacecraftBodyId(body.id),
  );
  const operationalBodies = operationalSpacecraftSnapshot.spacecraft
    .filter((spacecraft) =>
      isOperationalSpacecraftWithinValidity(spacecraft.id, state.timeSeconds),
    )
    .map((spacecraft) =>
      interpolateOperationalSpacecraft(spacecraft.id, state.timeSeconds),
    );
  return { ...state, bodies: [...integratedBodies, ...operationalBodies] };
}
