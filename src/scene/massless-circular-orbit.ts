import type { BodyState, SimulationState } from "../physics/contracts";

export type MasslessCircularOrbitDefinition = Readonly<{
  id: string;
  parentBodyId: string;
  planeReferenceBodyId: string;
  parentRadiusM: number;
  orbitalAltitudeM: number;
  initialPhaseRad: number;
}>;

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
    throw new Error("Massless orbit reference vector is unavailable");
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
 * Evaluate an authored massless circular orbit against live solver state.
 *
 * The orbit plane follows the parent's instantaneous orbit around its plane
 * reference body. Position and velocity are derived from the parent's live
 * gravitational parameter. The visual object cannot perturb a real body.
 */
export function masslessCircularOrbitState(
  state: SimulationState,
  definition: MasslessCircularOrbitDefinition,
): BodyState {
  const parent = requiredBody(state, definition.parentBodyId);
  const planeReference = requiredBody(state, definition.planeReferenceBodyId);
  if (
    !Number.isFinite(parent.gravitationalParameterM3S2) ||
    parent.gravitationalParameterM3S2 <= 0
  ) {
    throw new Error(
      `${definition.id} requires ${definition.parentBodyId}'s gravity`,
    );
  }
  const orbitalRadiusM = definition.parentRadiusM + definition.orbitalAltitudeM;
  if (!Number.isFinite(orbitalRadiusM) || orbitalRadiusM <= 0) {
    throw new Error(`${definition.id} orbital radius must be positive`);
  }
  const inward = normalized([
    planeReference.positionM[0] - parent.positionM[0],
    planeReference.positionM[1] - parent.positionM[1],
    planeReference.positionM[2] - parent.positionM[2],
  ]);
  const relativeVelocity = normalized([
    parent.velocityMps[0] - planeReference.velocityMps[0],
    parent.velocityMps[1] - planeReference.velocityMps[1],
    parent.velocityMps[2] - planeReference.velocityMps[2],
  ]);
  const normal = normalized(cross(inward, relativeVelocity));
  const tangent = normalized(cross(normal, inward));
  const angularRateRadPerSecond = Math.sqrt(
    parent.gravitationalParameterM3S2 / orbitalRadiusM ** 3,
  );
  const phase =
    definition.initialPhaseRad + state.timeSeconds * angularRateRadPerSecond;
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
    id: definition.id,
    gravitationalParameterM3S2: 0,
    positionM: [
      parent.positionM[0] + radial[0] * orbitalRadiusM,
      parent.positionM[1] + radial[1] * orbitalRadiusM,
      parent.positionM[2] + radial[2] * orbitalRadiusM,
    ],
    velocityMps: [
      parent.velocityMps[0] + directionOfTravel[0] * circularSpeedMps,
      parent.velocityMps[1] + directionOfTravel[1] * circularSpeedMps,
      parent.velocityMps[2] + directionOfTravel[2] * circularSpeedMps,
    ],
  };
}
