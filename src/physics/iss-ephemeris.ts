import {
  AstroTime,
  RotateState,
  Rotation_EQD_EQJ,
  SiderealTime,
  StateVector,
} from "astronomy-engine";
import { gstime, json2satrec, propagate } from "satellite.js";
import { z } from "zod";

import issSnapshotJson from "../data/iss.snapshot.json";
import type { BodyState, SimulationState } from "./contracts";
import { majorBodySnapshot } from "./solar-system-data";

const DAY_MILLISECONDS = 86_400_000;
const JULIAN_DAY_AT_UNIX_EPOCH = 2_440_587.5;
const TDB_MINUS_UTC_SECONDS_2026 = 69.184;
const KILOMETERS_TO_METERS = 1_000;

const finiteNumber = z.number();
const ommSchema = z.object({
  OBJECT_NAME: z.literal("ISS (ZARYA)"),
  OBJECT_ID: z.literal("1998-067A"),
  EPOCH: z.iso.datetime({ local: true }),
  MEAN_MOTION: finiteNumber.positive(),
  ECCENTRICITY: finiteNumber.nonnegative().lt(1),
  INCLINATION: finiteNumber,
  RA_OF_ASC_NODE: finiteNumber,
  ARG_OF_PERICENTER: finiteNumber,
  MEAN_ANOMALY: finiteNumber,
  EPHEMERIS_TYPE: z.literal(0),
  CLASSIFICATION_TYPE: z.literal("U"),
  NORAD_CAT_ID: z.literal(25544),
  ELEMENT_SET_NO: z.number().int().nonnegative(),
  REV_AT_EPOCH: z.number().int().nonnegative(),
  BSTAR: finiteNumber,
  MEAN_MOTION_DOT: finiteNumber,
  MEAN_MOTION_DDOT: finiteNumber,
});

const issSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("CelesTrak current General Perturbations data"),
  sourceUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  referenceFrame: z.literal("TEME"),
  timeScale: z.literal("UTC"),
  propagator: z.literal("SGP4"),
  validityWindowSeconds: finiteNumber.positive(),
  object: ommSchema,
  physicalDimensions: z.object({
    authority: z.literal("NASA International Space Station Facts and Figures"),
    sourceUrl: z.url(),
    overallEndToEndM: finiteNumber.positive(),
    solarArrayLengthM: finiteNumber.positive(),
    pressurizedModuleLengthM: finiteNumber.positive(),
    trussLengthM: finiteNumber.positive(),
    massKg: finiteNumber.positive(),
  }),
  frameConversion: z.object({
    targetFrame: z.literal("J2000 mean equator aligned with ICRF"),
    method: z.string().trim().min(1),
    velocityTreatment: z.string().trim().min(1),
  }),
});

export const issSnapshot = issSnapshotSchema.parse(issSnapshotJson);
export const ISS_BODY_ID = "iss";
export const ISS_PARENT_BODY_ID = "earth";
export const ISS_MAXIMUM_DIMENSION_M =
  issSnapshot.physicalDimensions.overallEndToEndM;
export const ISS_BOUNDING_RADIUS_M = ISS_MAXIMUM_DIMENSION_M / 2;

const simulationEpochUtcMilliseconds =
  (majorBodySnapshot.epoch.value - JULIAN_DAY_AT_UNIX_EPOCH) *
    DAY_MILLISECONDS -
  TDB_MINUS_UTC_SECONDS_2026 * 1_000;
const issEpochUtcMilliseconds = Date.parse(`${issSnapshot.object.EPOCH}Z`);
if (!Number.isFinite(issEpochUtcMilliseconds)) {
  throw new Error("ISS OMM epoch is not a valid UTC timestamp");
}

export const ISS_EPOCH_SIMULATION_SECONDS =
  (issEpochUtcMilliseconds - simulationEpochUtcMilliseconds) / 1_000;

const issSatrec = json2satrec(issSnapshot.object);

function simulationDateUtc(timeSeconds: number): Date {
  if (!Number.isFinite(timeSeconds)) {
    throw new Error("ISS propagation time must be finite");
  }
  return new Date(simulationEpochUtcMilliseconds + timeSeconds * 1_000);
}

function rotateTemeStateToJ2000(
  date: Date,
  positionKm: Readonly<{ x: number; y: number; z: number }>,
  velocityKmPerSecond: Readonly<{ x: number; y: number; z: number }>,
): Readonly<{
  positionKm: readonly [number, number, number];
  velocityKmPerSecond: readonly [number, number, number];
}> {
  const meanSiderealRadians = gstime(date);
  const apparentSiderealRadians = (SiderealTime(date) * 15 * Math.PI) / 180;
  const equationOfEquinoxesRadians =
    apparentSiderealRadians - meanSiderealRadians;
  const cosine = Math.cos(equationOfEquinoxesRadians);
  const sine = Math.sin(equationOfEquinoxesRadians);
  const rotateToTrueEquinox = (
    vector: Readonly<{ x: number; y: number; z: number }>,
  ): readonly [number, number, number] => [
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
    vector.z,
  ];
  const positionEqd = rotateToTrueEquinox(positionKm);
  const velocityEqd = rotateToTrueEquinox(velocityKmPerSecond);
  const rotated = RotateState(
    Rotation_EQD_EQJ(date),
    new StateVector(
      positionEqd[0],
      positionEqd[1],
      positionEqd[2],
      velocityEqd[0],
      velocityEqd[1],
      velocityEqd[2],
      new AstroTime(date),
    ),
  );
  return {
    positionKm: [rotated.x, rotated.y, rotated.z],
    velocityKmPerSecond: [rotated.vx, rotated.vy, rotated.vz],
  };
}

export function isIssEphemerisWithinValidity(timeSeconds: number): boolean {
  return (
    Math.abs(timeSeconds - ISS_EPOCH_SIMULATION_SECONDS) <=
    issSnapshot.validityWindowSeconds
  );
}

export function propagateIss(
  earthState: BodyState,
  timeSeconds: number,
): BodyState {
  if (earthState.id !== ISS_PARENT_BODY_ID) {
    throw new Error("ISS propagation requires the Earth state");
  }
  const date = simulationDateUtc(timeSeconds);
  const propagated = propagate(issSatrec, date);
  if (propagated === null) {
    throw new Error(
      `ISS SGP4 propagation failed with error ${String(issSatrec.error)}`,
    );
  }
  const rotated = rotateTemeStateToJ2000(
    date,
    propagated.position,
    propagated.velocity,
  );
  return {
    id: ISS_BODY_ID,
    gravitationalParameterM3S2: 0,
    positionM: [
      earthState.positionM[0] + rotated.positionKm[0] * KILOMETERS_TO_METERS,
      earthState.positionM[1] + rotated.positionKm[1] * KILOMETERS_TO_METERS,
      earthState.positionM[2] + rotated.positionKm[2] * KILOMETERS_TO_METERS,
    ],
    velocityMps: [
      earthState.velocityMps[0] +
        rotated.velocityKmPerSecond[0] * KILOMETERS_TO_METERS,
      earthState.velocityMps[1] +
        rotated.velocityKmPerSecond[1] * KILOMETERS_TO_METERS,
      earthState.velocityMps[2] +
        rotated.velocityKmPerSecond[2] * KILOMETERS_TO_METERS,
    ],
  };
}

export function withIssEphemeris(state: SimulationState): SimulationState {
  const earthState = state.bodies.find(
    (body) => body.id === ISS_PARENT_BODY_ID,
  );
  if (earthState === undefined) {
    throw new Error(
      "Integrated Earth state is unavailable for ISS propagation",
    );
  }
  return {
    ...state,
    bodies: [
      ...state.bodies.filter((body) => body.id !== ISS_BODY_ID),
      propagateIss(earthState, state.timeSeconds),
    ],
  };
}
