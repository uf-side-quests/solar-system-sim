import { Vector3 } from "three";

export type OrbitPreset =
  | "low-circular"
  | "equatorial"
  | "polar"
  | "synchronous"
  | "high-observation"
  | "powered-hover"
  | "custom";

export type OrbitDirection = "prograde" | "retrograde";

export type CameraOrbitConfiguration = Readonly<{
  preset: OrbitPreset;
  altitudeM: number;
  inclinationDeg: number;
  direction: OrbitDirection;
  longitudeDeg: number;
  epochTimeSeconds: number;
}>;

export type OrbitBodyParameters = Readonly<{
  radiusM: number;
  gravitationalParameterM3S2: number;
  siderealRotationRateRadPerSecond: number;
  hillSphereRadiusM?: number;
}>;

export type CircularOrbitSolution = Readonly<{
  orbitalRadiusM: number;
  speedMps: number;
  periodSeconds: number;
  angularRateRadPerSecond: number;
}>;

export const DEFAULT_ORBIT_LONGITUDE_DEG = 35;
export const MINIMUM_OBSERVATION_ALTITUDE_M = 100_000;
export const LOW_ORBIT_RADIUS_FRACTION = 0.03;
export const HIGH_OBSERVATION_ALTITUDE_RADII = 3;
export const SYNCHRONOUS_HILL_SPHERE_LIMIT = 0.9;

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive and finite`);
  }
}

export function minimumObservationAltitudeM(radiusM: number): number {
  requirePositiveFinite(radiusM, "Body radius");
  return Math.max(
    MINIMUM_OBSERVATION_ALTITUDE_M,
    radiusM * LOW_ORBIT_RADIUS_FRACTION,
  );
}

export function circularOrbitSolution(
  gravitationalParameterM3S2: number,
  bodyRadiusM: number,
  altitudeM: number,
): CircularOrbitSolution {
  requirePositiveFinite(gravitationalParameterM3S2, "Gravitational parameter");
  requirePositiveFinite(bodyRadiusM, "Body radius");
  if (!Number.isFinite(altitudeM) || altitudeM < 0) {
    throw new Error("Orbit altitude must be finite and non-negative");
  }
  const orbitalRadiusM = bodyRadiusM + altitudeM;
  const angularRateRadPerSecond = Math.sqrt(
    gravitationalParameterM3S2 / orbitalRadiusM ** 3,
  );
  return {
    orbitalRadiusM,
    speedMps: Math.sqrt(gravitationalParameterM3S2 / orbitalRadiusM),
    periodSeconds: (Math.PI * 2) / angularRateRadPerSecond,
    angularRateRadPerSecond,
  };
}

export function poweredHoverAccelerationMps2(
  gravitationalParameterM3S2: number,
  bodyRadiusM: number,
  altitudeM: number,
): number {
  const orbit = circularOrbitSolution(
    gravitationalParameterM3S2,
    bodyRadiusM,
    altitudeM,
  );
  return gravitationalParameterM3S2 / orbit.orbitalRadiusM ** 2;
}

export function synchronousOrbitAltitudeM(body: OrbitBodyParameters): number {
  requirePositiveFinite(
    body.gravitationalParameterM3S2,
    "Gravitational parameter",
  );
  requirePositiveFinite(body.radiusM, "Body radius");
  if (
    !Number.isFinite(body.siderealRotationRateRadPerSecond) ||
    body.siderealRotationRateRadPerSecond === 0
  ) {
    throw new Error("Synchronous orbit requires a non-zero rotation rate");
  }
  const angularRate = Math.abs(body.siderealRotationRateRadPerSecond);
  const orbitalRadiusM = Math.cbrt(
    body.gravitationalParameterM3S2 / angularRate ** 2,
  );
  const altitudeM = orbitalRadiusM - body.radiusM;
  if (altitudeM <= 0) {
    throw new Error("Synchronous orbit lies below the body's surface");
  }
  if (
    body.hillSphereRadiusM !== undefined &&
    orbitalRadiusM > body.hillSphereRadiusM * SYNCHRONOUS_HILL_SPHERE_LIMIT
  ) {
    throw new Error("Synchronous orbit lies outside the stable Hill region");
  }
  return altitudeM;
}

export function hillSphereRadiusM(
  parentSeparationM: number,
  bodyGravitationalParameterM3S2: number,
  parentGravitationalParameterM3S2: number,
): number {
  requirePositiveFinite(parentSeparationM, "Parent separation");
  requirePositiveFinite(
    bodyGravitationalParameterM3S2,
    "Body gravitational parameter",
  );
  requirePositiveFinite(
    parentGravitationalParameterM3S2,
    "Parent gravitational parameter",
  );
  return (
    parentSeparationM *
    Math.cbrt(
      bodyGravitationalParameterM3S2 / (3 * parentGravitationalParameterM3S2),
    )
  );
}

export function orbitConfigurationForPreset(
  preset: OrbitPreset,
  body: OrbitBodyParameters,
  current: CameraOrbitConfiguration,
): CameraOrbitConfiguration {
  const lowAltitudeM = minimumObservationAltitudeM(body.radiusM);
  switch (preset) {
    case "low-circular":
      return {
        ...current,
        preset,
        altitudeM: lowAltitudeM,
        inclinationDeg: 0,
        direction: "prograde",
        longitudeDeg: current.longitudeDeg,
      };
    case "equatorial":
      return {
        ...current,
        preset,
        altitudeM: Math.max(current.altitudeM, lowAltitudeM),
        inclinationDeg: 0,
      };
    case "polar":
      return {
        ...current,
        preset,
        altitudeM: Math.max(current.altitudeM, lowAltitudeM),
        inclinationDeg: 90,
      };
    case "synchronous":
      return {
        ...current,
        preset,
        altitudeM: synchronousOrbitAltitudeM(body),
        inclinationDeg: 0,
        direction:
          body.siderealRotationRateRadPerSecond < 0 ? "retrograde" : "prograde",
        longitudeDeg: current.longitudeDeg,
      };
    case "high-observation":
      return {
        ...current,
        preset,
        altitudeM: body.radiusM * HIGH_OBSERVATION_ALTITUDE_RADII,
      };
    case "powered-hover":
      return {
        ...current,
        preset,
        altitudeM: Math.max(current.altitudeM, lowAltitudeM),
        inclinationDeg: 0,
      };
    case "custom":
      return { ...current, preset };
  }
}

export function defaultOrbitConfiguration(
  body: OrbitBodyParameters,
): CameraOrbitConfiguration {
  return orbitConfigurationForPreset("high-observation", body, {
    preset: "high-observation",
    altitudeM: minimumObservationAltitudeM(body.radiusM),
    inclinationDeg: 0,
    direction: "prograde",
    longitudeDeg: DEFAULT_ORBIT_LONGITUDE_DEG,
    epochTimeSeconds: 0,
  });
}

function projectedReferenceDirection(
  orbitNormal: Vector3,
  preferredReference: Vector3,
  alternateReference: Vector3,
): Vector3 {
  const projected = preferredReference
    .clone()
    .addScaledVector(orbitNormal, -preferredReference.dot(orbitNormal));
  if (projected.lengthSq() > 1e-12) {
    return projected.normalize();
  }
  const alternate = alternateReference
    .clone()
    .addScaledVector(orbitNormal, -alternateReference.dot(orbitNormal));
  if (alternate.lengthSq() <= 1e-12) {
    throw new Error("Orbit reference directions are parallel to its normal");
  }
  return alternate.normalize();
}

export function orbitNormalForInclination(
  spinAxis: Vector3,
  nodeReference: Vector3,
  inclinationDeg: number,
): Vector3 {
  if (spinAxis.lengthSq() === 0 || nodeReference.lengthSq() === 0) {
    throw new Error("Orbit orientation axes must be non-zero");
  }
  if (
    !Number.isFinite(inclinationDeg) ||
    inclinationDeg < 0 ||
    inclinationDeg > 180
  ) {
    throw new Error("Orbit inclination must be between 0 and 180 degrees");
  }
  const axis = spinAxis.clone().normalize();
  const node = projectedReferenceDirection(
    axis,
    nodeReference.clone().normalize(),
    new Vector3(1, 0, 0),
  );
  return axis
    .applyAxisAngle(node, (inclinationDeg * Math.PI) / 180)
    .normalize();
}

export function orbitRadialDirection(
  orbitNormal: Vector3,
  preferredReference: Vector3,
  alternateReference: Vector3,
  phaseRad: number,
): Vector3 {
  if (!Number.isFinite(phaseRad)) {
    throw new Error("Orbit phase must be finite");
  }
  if (orbitNormal.lengthSq() === 0) {
    throw new Error("Orbit normal must be non-zero");
  }
  const normal = orbitNormal.clone().normalize();
  const firstAxis = projectedReferenceDirection(
    normal,
    preferredReference,
    alternateReference,
  );
  const secondAxis = normal.clone().cross(firstAxis).normalize();
  return firstAxis
    .multiplyScalar(Math.cos(phaseRad))
    .add(secondAxis.multiplyScalar(Math.sin(phaseRad)))
    .normalize();
}
