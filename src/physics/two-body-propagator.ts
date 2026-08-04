import type { BodyState } from "./contracts";
import type { AvailableKnownSatelliteDefinition } from "./known-satellites";

type Vector3Tuple = readonly [number, number, number];

function add(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtract(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(vector: Vector3Tuple, factor: number): Vector3Tuple {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(left: Vector3Tuple, right: Vector3Tuple): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function magnitude(vector: Vector3Tuple): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function stumpffC(z: number): number {
  if (Math.abs(z) < 1e-8) {
    return 0.5 - z / 24 + (z * z) / 720;
  }
  if (z > 0) {
    const root = Math.sqrt(z);
    return (1 - Math.cos(root)) / z;
  }
  const root = Math.sqrt(-z);
  return (Math.cosh(root) - 1) / -z;
}

function stumpffS(z: number): number {
  if (Math.abs(z) < 1e-8) {
    return 1 / 6 - z / 120 + (z * z) / 5_040;
  }
  if (z > 0) {
    const root = Math.sqrt(z);
    return (root - Math.sin(root)) / (root * root * root);
  }
  const root = Math.sqrt(-z);
  return (Math.sinh(root) - root) / (root * root * root);
}

export type RelativeOrbitalState = Readonly<{
  positionM: Vector3Tuple;
  velocityMps: Vector3Tuple;
}>;

/**
 * Propagates one Kepler two-body state with universal variables.
 * The calculation is deterministic and reversible for positive or negative time.
 */
export function propagateTwoBody(
  initial: RelativeOrbitalState,
  gravitationalParameterM3S2: number,
  elapsedSeconds: number,
): RelativeOrbitalState {
  if (
    !Number.isFinite(gravitationalParameterM3S2) ||
    gravitationalParameterM3S2 <= 0 ||
    !Number.isFinite(elapsedSeconds)
  ) {
    throw new Error(
      "Two-body propagation requires finite time and positive GM",
    );
  }
  if (elapsedSeconds === 0) {
    return initial;
  }
  const radius0 = magnitude(initial.positionM);
  const speedSquared0 = dot(initial.velocityMps, initial.velocityMps);
  const radialVelocity0 = dot(initial.positionM, initial.velocityMps) / radius0;
  const alpha = 2 / radius0 - speedSquared0 / gravitationalParameterM3S2;
  if (!Number.isFinite(alpha) || alpha <= 0) {
    throw new Error(
      "Known-moon two-body model requires a bound elliptic state",
    );
  }
  const sqrtMu = Math.sqrt(gravitationalParameterM3S2);
  let universalAnomaly = sqrtMu * alpha * elapsedSeconds;
  let converged = false;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const anomalySquared = universalAnomaly * universalAnomaly;
    const z = alpha * anomalySquared;
    const c = stumpffC(z);
    const s = stumpffS(z);
    const value =
      (radius0 * radialVelocity0 * anomalySquared * c) / sqrtMu +
      (1 - alpha * radius0) * anomalySquared * universalAnomaly * s +
      radius0 * universalAnomaly -
      sqrtMu * elapsedSeconds;
    const derivative =
      (radius0 * radialVelocity0 * universalAnomaly * (1 - z * s)) / sqrtMu +
      (1 - alpha * radius0) * anomalySquared * c +
      radius0;
    const correction = value / derivative;
    universalAnomaly -= correction;
    if (
      Math.abs(correction) <=
      1e-9 * Math.max(1, Math.abs(universalAnomaly))
    ) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    throw new Error("Known-moon two-body propagation did not converge");
  }
  const anomalySquared = universalAnomaly * universalAnomaly;
  const z = alpha * anomalySquared;
  const c = stumpffC(z);
  const s = stumpffS(z);
  const f = 1 - (anomalySquared / radius0) * c;
  const g = elapsedSeconds - (anomalySquared * universalAnomaly * s) / sqrtMu;
  const positionM = add(
    scale(initial.positionM, f),
    scale(initial.velocityMps, g),
  );
  const radius = magnitude(positionM);
  const fDot =
    (sqrtMu / (radius * radius0)) *
    (alpha * anomalySquared * universalAnomaly * s - universalAnomaly);
  const gDot = 1 - (anomalySquared / radius) * c;
  const velocityMps = add(
    scale(initial.positionM, fDot),
    scale(initial.velocityMps, gDot),
  );
  if ([...positionM, ...velocityMps].some((value) => !Number.isFinite(value))) {
    throw new Error(
      "Known-moon two-body propagation returned non-finite state",
    );
  }
  return { positionM, velocityMps };
}

export type KnownSatellitePropagationInput = Readonly<{
  definition: AvailableKnownSatelliteDefinition;
  parentInitialState: BodyState;
  parentGravitationalParameterM3S2: number;
}>;

export function propagateKnownSatellite(
  input: KnownSatellitePropagationInput,
  parentState: BodyState,
  elapsedSeconds: number,
): BodyState {
  const relative = propagateTwoBody(
    {
      positionM: subtract(
        input.definition.positionM,
        input.parentInitialState.positionM,
      ),
      velocityMps: subtract(
        input.definition.velocityMps,
        input.parentInitialState.velocityMps,
      ),
    },
    input.parentGravitationalParameterM3S2,
    elapsedSeconds,
  );
  return {
    id: input.definition.id,
    gravitationalParameterM3S2: 0,
    positionM: add(parentState.positionM, relative.positionM),
    velocityMps: add(parentState.velocityMps, relative.velocityMps),
  };
}
