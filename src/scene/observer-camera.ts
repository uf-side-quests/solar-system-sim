import { Vector3 } from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";

const MINIMUM_OBSERVER_ALTITUDE_M = 10_000;
const OBSERVER_RADIUS_CLEARANCE_FRACTION = 0.01;

export type ObserverViewpoint = Readonly<{
  position: Vector3;
  up: Vector3;
  altitudeKm: number;
}>;

export function surfaceObserverViewpoint(
  observerCenter: Vector3,
  targetPosition: Vector3,
  observerMeanRadiusM: number,
): ObserverViewpoint {
  if (!Number.isFinite(observerMeanRadiusM) || observerMeanRadiusM <= 0) {
    throw new Error("Camera observer radius must be positive and finite");
  }
  const lineOfSight = targetPosition.clone().sub(observerCenter);
  const centerSeparationAu = lineOfSight.length();
  if (!Number.isFinite(centerSeparationAu) || centerSeparationAu <= 0) {
    throw new Error(
      "Camera observer and target must have distinct finite positions",
    );
  }
  const observerRadiusAu = observerMeanRadiusM / ASTRONOMICAL_UNIT_M;
  const altitudeM = Math.max(
    observerMeanRadiusM * OBSERVER_RADIUS_CLEARANCE_FRACTION,
    MINIMUM_OBSERVER_ALTITUDE_M,
  );
  const surfaceDistanceAu = observerRadiusAu + altitudeM / ASTRONOMICAL_UNIT_M;
  if (surfaceDistanceAu >= centerSeparationAu) {
    throw new Error("Camera target must be outside the observer body");
  }
  return {
    position: observerCenter
      .clone()
      .add(lineOfSight.normalize().multiplyScalar(surfaceDistanceAu)),
    up: new Vector3(0, 1, 0),
    altitudeKm: altitudeM / 1_000,
  };
}

export function limbObserverViewpoint(
  observerCenter: Vector3,
  targetPosition: Vector3,
  observerMeanRadiusM: number,
  referenceUp: Vector3,
  altitudeM: number,
  targetGeometricAltitudeDeg: number,
): ObserverViewpoint {
  if (!Number.isFinite(observerMeanRadiusM) || observerMeanRadiusM <= 0) {
    throw new Error("Camera observer radius must be positive and finite");
  }
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) {
    throw new Error("Camera observer altitude must be positive and finite");
  }
  if (
    !Number.isFinite(targetGeometricAltitudeDeg) ||
    targetGeometricAltitudeDeg <= -90 ||
    targetGeometricAltitudeDeg >= 90
  ) {
    throw new Error(
      "Camera target geometric altitude must be between -90 and 90 degrees",
    );
  }
  if (referenceUp.lengthSq() <= Number.EPSILON) {
    throw new Error("Camera observer reference up must be non-zero");
  }
  const lineOfSight = targetPosition.clone().sub(observerCenter);
  const centerSeparationAu = lineOfSight.length();
  if (!Number.isFinite(centerSeparationAu) || centerSeparationAu <= 0) {
    throw new Error(
      "Camera observer and target must have distinct finite positions",
    );
  }
  const targetDirection = lineOfSight.normalize();
  const tangentUp = referenceUp
    .clone()
    .addScaledVector(targetDirection, -referenceUp.dot(targetDirection));
  if (tangentUp.lengthSq() <= Number.EPSILON) {
    throw new Error(
      "Camera observer reference up must not align with the target",
    );
  }
  tangentUp.normalize();
  const targetAltitudeRad = (targetGeometricAltitudeDeg * Math.PI) / 180;
  const up = tangentUp
    .multiplyScalar(Math.cos(targetAltitudeRad))
    .add(targetDirection.clone().multiplyScalar(Math.sin(targetAltitudeRad)))
    .normalize();
  const observerRadiusAu = observerMeanRadiusM / ASTRONOMICAL_UNIT_M;
  const surfaceDistanceAu = observerRadiusAu + altitudeM / ASTRONOMICAL_UNIT_M;
  if (surfaceDistanceAu >= centerSeparationAu) {
    throw new Error("Camera target must be outside the observer body");
  }
  return {
    position: observerCenter
      .clone()
      .add(up.clone().multiplyScalar(surfaceDistanceAu)),
    up,
    altitudeKm: altitudeM / 1_000,
  };
}
