import type { BodyState, SimulationState } from "../physics/contracts";

export type FictionalOrbiter = Readonly<{
  id: "death-star-1" | "death-star-2";
  name: string;
  parentBodyId: "callisto" | "ganymede";
  diameterM: number;
  orbitalAltitudeM: number;
  initialPhaseRad: number;
  constructionState: "complete" | "incomplete";
  sourceUrl: string;
}>;

export const FICTIONAL_ORBITERS: readonly FictionalOrbiter[] = [
  {
    id: "death-star-1",
    name: "Death Star I (fictional)",
    parentBodyId: "callisto",
    diameterM: 160_000,
    orbitalAltitudeM: 500_000,
    initialPhaseRad: 0.35,
    constructionState: "complete",
    sourceUrl: "https://www.starwars.com/databank/death-star",
  },
  {
    id: "death-star-2",
    name: "Death Star II (fictional)",
    parentBodyId: "ganymede",
    diameterM: 200_000,
    orbitalAltitudeM: 650_000,
    initialPhaseRad: 2.1,
    constructionState: "incomplete",
    sourceUrl: "https://www.starwars.com/databank/death-star-ii",
  },
] as const;

export type FictionalOrbiterId = (typeof FICTIONAL_ORBITERS)[number]["id"];

export const fictionalOrbiterById = new Map(
  FICTIONAL_ORBITERS.map((orbiter) => [orbiter.id, orbiter]),
);

export function isFictionalOrbiterId(
  bodyId: string | null,
): bodyId is FictionalOrbiterId {
  if (bodyId === null) {
    return false;
  }
  return fictionalOrbiterById.has(bodyId as FictionalOrbiterId);
}

function requiredBody(state: SimulationState, bodyId: string): BodyState {
  const body = state.bodies.find((candidate) => candidate.id === bodyId);
  if (body === undefined) {
    throw new Error(`${bodyId} physics state is required`);
  }
  return body;
}

function normalized(
  vector: readonly [number, number, number],
): [number, number, number] {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error("Fictional orbiter reference vector is unavailable");
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
 * Evaluate a hypothetical massless circular orbit around a live Galilean moon.
 *
 * The moon state and gravitational parameter come from the simulator. The
 * fictional object has zero gravitational parameter and therefore cannot
 * perturb any real body. The reference plane follows the moon's instantaneous
 * orbit around Jupiter, while circular speed follows sqrt(mu / r).
 */
export function fictionalOrbiterState(
  state: SimulationState,
  orbiter: FictionalOrbiter,
): BodyState {
  const moon = requiredBody(state, orbiter.parentBodyId);
  const jupiter = requiredBody(state, "jupiter");
  if (
    !Number.isFinite(moon.gravitationalParameterM3S2) ||
    moon.gravitationalParameterM3S2 <= 0
  ) {
    throw new Error(`${orbiter.name} requires its moon's gravity`);
  }
  const moonRadiusM =
    orbiter.parentBodyId === "callisto" ? 2_410_300 : 2_634_100;
  const orbitalRadiusM = moonRadiusM + orbiter.orbitalAltitudeM;
  const inward = normalized([
    jupiter.positionM[0] - moon.positionM[0],
    jupiter.positionM[1] - moon.positionM[1],
    jupiter.positionM[2] - moon.positionM[2],
  ]);
  const moonRelativeVelocity = normalized([
    moon.velocityMps[0] - jupiter.velocityMps[0],
    moon.velocityMps[1] - jupiter.velocityMps[1],
    moon.velocityMps[2] - jupiter.velocityMps[2],
  ]);
  const normal = normalized(cross(inward, moonRelativeVelocity));
  const tangent = normalized(cross(normal, inward));
  const angularRateRadPerSecond = Math.sqrt(
    moon.gravitationalParameterM3S2 / orbitalRadiusM ** 3,
  );
  const phase =
    orbiter.initialPhaseRad + state.timeSeconds * angularRateRadPerSecond;
  const cosine = Math.cos(phase);
  const sine = Math.sin(phase);
  const radial: [number, number, number] = [
    inward[0] * cosine + tangent[0] * sine,
    inward[1] * cosine + tangent[1] * sine,
    inward[2] * cosine + tangent[2] * sine,
  ];
  const directionOfTravel: [number, number, number] = [
    -inward[0] * sine + tangent[0] * cosine,
    -inward[1] * sine + tangent[1] * cosine,
    -inward[2] * sine + tangent[2] * cosine,
  ];
  const circularSpeedMps = angularRateRadPerSecond * orbitalRadiusM;
  return {
    id: orbiter.id,
    gravitationalParameterM3S2: 0,
    positionM: [
      moon.positionM[0] + radial[0] * orbitalRadiusM,
      moon.positionM[1] + radial[1] * orbitalRadiusM,
      moon.positionM[2] + radial[2] * orbitalRadiusM,
    ],
    velocityMps: [
      moon.velocityMps[0] + directionOfTravel[0] * circularSpeedMps,
      moon.velocityMps[1] + directionOfTravel[1] * circularSpeedMps,
      moon.velocityMps[2] + directionOfTravel[2] * circularSpeedMps,
    ],
  };
}

export function fictionalOrbiterStateById(
  state: SimulationState,
  bodyId: FictionalOrbiterId,
): BodyState {
  const orbiter = fictionalOrbiterById.get(bodyId);
  if (orbiter === undefined) {
    throw new Error(`Fictional orbiter ${bodyId} is unavailable`);
  }
  return fictionalOrbiterState(state, orbiter);
}
