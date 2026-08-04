import type { BodyState } from "../physics/contracts";

type Vector3 = readonly [number, number, number];

function add(first: Vector3, second: Vector3): Vector3 {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

function subtract(first: Vector3, second: Vector3): Vector3 {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function dot(first: Vector3, second: Vector3): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function cross(first: Vector3, second: Vector3): Vector3 {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function magnitude(vector: Vector3): number {
  return Math.hypot(...vector);
}

function normalize(vector: Vector3): Vector3 {
  const length = magnitude(vector);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error("Cannot normalize a zero or non-finite vector");
  }
  return scale(vector, 1 / length);
}

export function osculatingOrbitPositionsM(
  body: BodyState,
  parent: BodyState,
  pointCount = 192,
): readonly Vector3[] {
  if (!Number.isInteger(pointCount) || pointCount < 32) {
    throw new Error("Osculating orbit requires at least 32 points");
  }
  const mu =
    body.gravitationalParameterM3S2 + parent.gravitationalParameterM3S2;
  const position = subtract(body.positionM, parent.positionM);
  const velocity = subtract(body.velocityMps, parent.velocityMps);
  const radius = magnitude(position);
  const angularMomentum = cross(position, velocity);
  const angularMomentumSquared = dot(angularMomentum, angularMomentum);
  if (
    !Number.isFinite(mu) ||
    mu <= 0 ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(angularMomentumSquared) ||
    angularMomentumSquared <= 0
  ) {
    throw new Error("Osculating orbit state is physically invalid");
  }
  const eccentricityVector = subtract(
    scale(cross(velocity, angularMomentum), 1 / mu),
    scale(position, 1 / radius),
  );
  const eccentricity = magnitude(eccentricityVector);
  if (!Number.isFinite(eccentricity) || eccentricity >= 1) {
    return [];
  }
  const semiLatusRectum = angularMomentumSquared / mu;
  const periapsisDirection =
    eccentricity > 1e-10 ? normalize(eccentricityVector) : normalize(position);
  const orbitNormal = normalize(angularMomentum);
  const transverseDirection = normalize(cross(orbitNormal, periapsisDirection));
  return Array.from({ length: pointCount }, (_, index) => {
    const trueAnomaly = (index / pointCount) * Math.PI * 2;
    const orbitalRadius =
      semiLatusRectum / (1 + eccentricity * Math.cos(trueAnomaly));
    const relativePosition = add(
      scale(periapsisDirection, orbitalRadius * Math.cos(trueAnomaly)),
      scale(transverseDirection, orbitalRadius * Math.sin(trueAnomaly)),
    );
    return add(parent.positionM, relativePosition);
  });
}
