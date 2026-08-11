import type { BodyState, SimulationState } from "../physics/contracts";
import { masslessCircularOrbitState } from "./massless-circular-orbit";

export const DEEP_SPACE_NINE_BODY_ID = "deep-space-nine";
export const DEEP_SPACE_NINE_NAME = "Deep Space Nine (fictional)";
export const DEEP_SPACE_NINE_PARENT_BODY_ID = "callisto";
export const DEEP_SPACE_NINE_DIAMETER_M = 1_451.82;
export const DEEP_SPACE_NINE_ORBITAL_ALTITUDE_M = 10_000_000;
export const DEEP_SPACE_NINE_SOURCE_URL =
  "https://memory-alpha.fandom.com/wiki/Terok_Nor_type";

export const USS_DEFIANT_BODY_ID = "uss-defiant";
export const USS_DEFIANT_NAME = "USS Defiant (fictional)";
export const USS_DEFIANT_LENGTH_M = 170.68;
export const USS_DEFIANT_PATROL_RADIUS_M = 2_500;
export const USS_DEFIANT_PATROL_PERIOD_SECONDS = 1_800;
export const USS_DEFIANT_SOURCE_URL =
  "https://www.startrek.com/news/designing-the-defiant";

export function ussDefiantPatrolPhaseRad(timeSeconds: number): number {
  if (!Number.isFinite(timeSeconds)) {
    throw new Error("Defiant patrol time must be finite");
  }
  return 0.65 + (timeSeconds * 2 * Math.PI) / USS_DEFIANT_PATROL_PERIOD_SECONDS;
}

export const DEEP_SPACE_NINE_OBJECTS = [
  {
    id: DEEP_SPACE_NINE_BODY_ID,
    name: DEEP_SPACE_NINE_NAME,
    maximumDimensionM: DEEP_SPACE_NINE_DIAMETER_M,
  },
  {
    id: USS_DEFIANT_BODY_ID,
    name: USS_DEFIANT_NAME,
    maximumDimensionM: USS_DEFIANT_LENGTH_M,
  },
] as const;

export type DeepSpaceNineObjectId =
  (typeof DEEP_SPACE_NINE_OBJECTS)[number]["id"];

export function isDeepSpaceNineObjectId(
  bodyId: string | null,
): bodyId is DeepSpaceNineObjectId {
  return DEEP_SPACE_NINE_OBJECTS.some((object) => object.id === bodyId);
}

export function deepSpaceNineState(state: SimulationState): BodyState {
  return masslessCircularOrbitState(state, {
    id: DEEP_SPACE_NINE_BODY_ID,
    parentBodyId: DEEP_SPACE_NINE_PARENT_BODY_ID,
    planeReferenceBodyId: "jupiter",
    parentRadiusM: 2_410_300,
    orbitalAltitudeM: DEEP_SPACE_NINE_ORBITAL_ALTITUDE_M,
    initialPhaseRad: 5.25,
  });
}

function normalized(
  vector: readonly [number, number, number],
): [number, number, number] {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error("Defiant patrol reference vector is unavailable");
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

/**
 * Evaluate an explicit fictional patrol around Deep Space Nine.
 *
 * The story publishes no station mass or Defiant patrol elements. This
 * prescribed path therefore uses no invented gravity. It follows the live
 * station frame and remains excluded from the Solar System integration.
 */
export function ussDefiantState(state: SimulationState): BodyState {
  const station = deepSpaceNineState(state);
  const callisto = state.bodies.find(
    (body) => body.id === DEEP_SPACE_NINE_PARENT_BODY_ID,
  );
  if (callisto === undefined) {
    throw new Error("Defiant patrol requires Callisto state");
  }
  const radial = normalized([
    station.positionM[0] - callisto.positionM[0],
    station.positionM[1] - callisto.positionM[1],
    station.positionM[2] - callisto.positionM[2],
  ]);
  const relativeVelocity = normalized([
    station.velocityMps[0] - callisto.velocityMps[0],
    station.velocityMps[1] - callisto.velocityMps[1],
    station.velocityMps[2] - callisto.velocityMps[2],
  ]);
  const normal = normalized(cross(radial, relativeVelocity));
  const tangent = normalized(cross(normal, radial));
  const angularRate = (2 * Math.PI) / USS_DEFIANT_PATROL_PERIOD_SECONDS;
  const phase = ussDefiantPatrolPhaseRad(state.timeSeconds);
  const cosine = Math.cos(phase);
  const sine = Math.sin(phase);
  const offset: [number, number, number] = [
    tangent[0] * cosine + normal[0] * sine,
    tangent[1] * cosine + normal[1] * sine,
    tangent[2] * cosine + normal[2] * sine,
  ];
  const direction: [number, number, number] = [
    -tangent[0] * sine + normal[0] * cosine,
    -tangent[1] * sine + normal[1] * cosine,
    -tangent[2] * sine + normal[2] * cosine,
  ];
  const speedMps = angularRate * USS_DEFIANT_PATROL_RADIUS_M;
  return {
    id: USS_DEFIANT_BODY_ID,
    gravitationalParameterM3S2: 0,
    positionM: [
      station.positionM[0] + offset[0] * USS_DEFIANT_PATROL_RADIUS_M,
      station.positionM[1] + offset[1] * USS_DEFIANT_PATROL_RADIUS_M,
      station.positionM[2] + offset[2] * USS_DEFIANT_PATROL_RADIUS_M,
    ],
    velocityMps: [
      station.velocityMps[0] + direction[0] * speedMps,
      station.velocityMps[1] + direction[1] * speedMps,
      station.velocityMps[2] + direction[2] * speedMps,
    ],
  };
}

export function deepSpaceNineObjectStateById(
  state: SimulationState,
  bodyId: DeepSpaceNineObjectId,
): BodyState {
  return bodyId === DEEP_SPACE_NINE_BODY_ID
    ? deepSpaceNineState(state)
    : ussDefiantState(state);
}

export function deepSpaceNineParentBodyId(
  bodyId: DeepSpaceNineObjectId,
): string {
  return bodyId === DEEP_SPACE_NINE_BODY_ID
    ? DEEP_SPACE_NINE_PARENT_BODY_ID
    : DEEP_SPACE_NINE_BODY_ID;
}
