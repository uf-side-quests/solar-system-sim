import { Vector3 } from "three";

import type { SimulationState } from "../physics/contracts";
import {
  ASTRONOMICAL_UNIT_M,
  majorBodySnapshot,
} from "../physics/solar-system";
import { bodyOrientationQuaternion } from "./orientation";
import { icrfToScene } from "./reference-frames";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DEFAULT_EYE_HEIGHT_M = 2;
const GIANT_PLANET_IDS = new Set(["jupiter", "saturn", "uranus", "neptune"]);

const majorBodyById = new Map(
  majorBodySnapshot.bodies.map((body) => [body.id, body]),
);

export const surfaceObserverBodies = majorBodySnapshot.bodies.filter(
  (body) => body.type !== "star" && !GIANT_PLANET_IDS.has(body.id),
);

export type SurfaceObserverConfiguration = Readonly<{
  bodyId: string;
  latitudeDeg: number;
  longitudeDeg: number;
  targetBodyId: string;
  eyeHeightM?: number;
}>;

export type SolarHorizonEvents =
  | Readonly<{
      regime: "normal";
      sunriseLocalSolarHours: number;
      sunsetLocalSolarHours: number;
    }>
  | Readonly<{ regime: "polar-day" | "polar-night" }>;

export type SurfaceObserverFrame = Readonly<{
  observerName: string;
  targetName: string;
  observerPositionAu: Vector3;
  surfacePositionAu: Vector3;
  zenith: Vector3;
  north: Vector3;
  east: Vector3;
  targetDirection: Vector3;
  targetDistanceM: number;
  targetAltitudeDeg: number;
  targetAzimuthDeg: number;
  targetAngularDiameterDeg: number;
  targetIlluminatedFraction: number | undefined;
  targetNorthPolePositionAngleDeg: number;
  brightLimbPositionAngleDeg: number | undefined;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  sunAngularDiameterDeg: number;
  localSolarTimeHours: number;
  solarHorizonEvents: SolarHorizonEvents;
  geometricHorizonDistanceM: number;
  horizonCentralAngleRad: number;
}>;

function stateBody(state: SimulationState, bodyId: string) {
  const body = state.bodies.find((candidate) => candidate.id === bodyId);
  if (body === undefined) {
    throw new Error(`Surface observer state is missing body ${bodyId}`);
  }
  return body;
}

function scenePosition(positionM: readonly [number, number, number]): Vector3 {
  return icrfToScene({
    x: positionM[0] / ASTRONOMICAL_UNIT_M,
    y: positionM[1] / ASTRONOMICAL_UNIT_M,
    z: positionM[2] / ASTRONOMICAL_UNIT_M,
  });
}

function normalizedDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function normalizedHours(value: number): number {
  return ((value % 24) + 24) % 24;
}

function signedRadians(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function angularDiameterDeg(radiusM: number, centerDistanceM: number): number {
  if (centerDistanceM <= radiusM) {
    throw new Error("Surface observer target must be outside its own radius");
  }
  return 2 * Math.asin(radiusM / centerDistanceM) * RAD_TO_DEG;
}

function horizontalCoordinates(
  direction: Vector3,
  zenith: Vector3,
  north: Vector3,
  east: Vector3,
): Readonly<{ altitudeDeg: number; azimuthDeg: number }> {
  const unitDirection = direction.clone().normalize();
  const altitudeDeg =
    Math.asin(Math.max(-1, Math.min(1, unitDirection.dot(zenith)))) *
    RAD_TO_DEG;
  const azimuthDeg = normalizedDegrees(
    Math.atan2(unitDirection.dot(east), unitDirection.dot(north)) * RAD_TO_DEG,
  );
  return { altitudeDeg, azimuthDeg };
}

function skyPositionAngleDeg(
  direction: Vector3,
  vector: Vector3,
  zenith: Vector3,
  north: Vector3,
): number {
  const lineOfSight = direction.clone().normalize();
  let skyUp = zenith
    .clone()
    .sub(lineOfSight.clone().multiplyScalar(zenith.dot(lineOfSight)));
  if (skyUp.lengthSq() < 1e-18) {
    skyUp = north
      .clone()
      .sub(lineOfSight.clone().multiplyScalar(north.dot(lineOfSight)));
  }
  skyUp.normalize();
  const skyRight = lineOfSight.clone().cross(skyUp).normalize();
  const projectedVector = vector
    .clone()
    .sub(lineOfSight.clone().multiplyScalar(vector.dot(lineOfSight)));
  if (projectedVector.lengthSq() < 1e-18) {
    return 0;
  }
  projectedVector.normalize();
  return (
    signedRadians(
      Math.atan2(projectedVector.dot(skyRight), projectedVector.dot(skyUp)),
    ) * RAD_TO_DEG
  );
}

function solarHorizonEvents(
  latitudeRad: number,
  solarDeclinationRad: number,
): SolarHorizonEvents {
  const altitudeAtTransit =
    Math.sin(latitudeRad) * Math.sin(solarDeclinationRad) +
    Math.cos(latitudeRad) * Math.cos(solarDeclinationRad);
  const altitudeAtAntitransit =
    Math.sin(latitudeRad) * Math.sin(solarDeclinationRad) -
    Math.cos(latitudeRad) * Math.cos(solarDeclinationRad);
  if (altitudeAtAntitransit >= 0) {
    return { regime: "polar-day" };
  }
  if (altitudeAtTransit <= 0) {
    return { regime: "polar-night" };
  }
  const cosineHourAngle =
    -Math.tan(latitudeRad) * Math.tan(solarDeclinationRad);
  const sunriseHourAngle = Math.acos(
    Math.max(-1, Math.min(1, cosineHourAngle)),
  );
  const offsetHours = (sunriseHourAngle * 12) / Math.PI;
  return {
    regime: "normal",
    sunriseLocalSolarHours: 12 - offsetHours,
    sunsetLocalSolarHours: 12 + offsetHours,
  };
}

export function surfaceObserverFrame(
  state: SimulationState,
  configuration: SurfaceObserverConfiguration,
): SurfaceObserverFrame {
  if (
    !Number.isFinite(configuration.latitudeDeg) ||
    configuration.latitudeDeg < -90 ||
    configuration.latitudeDeg > 90
  ) {
    throw new Error(
      "Surface observer latitude must be between -90 and 90 degrees",
    );
  }
  if (
    !Number.isFinite(configuration.longitudeDeg) ||
    configuration.longitudeDeg < -180 ||
    configuration.longitudeDeg > 180
  ) {
    throw new Error(
      "Surface observer longitude must be between -180 and 180 degrees",
    );
  }
  const eyeHeightM = configuration.eyeHeightM ?? DEFAULT_EYE_HEIGHT_M;
  if (!Number.isFinite(eyeHeightM) || eyeHeightM <= 0) {
    throw new Error("Surface observer eye height must be positive and finite");
  }
  const observerDefinition = majorBodyById.get(configuration.bodyId);
  if (
    observerDefinition === undefined ||
    !surfaceObserverBodies.some((body) => body.id === configuration.bodyId)
  ) {
    throw new Error(
      `Surface observer body ${configuration.bodyId} has no supported solid surface`,
    );
  }
  const targetDefinition = majorBodyById.get(configuration.targetBodyId);
  if (targetDefinition === undefined) {
    throw new Error(
      `Surface observer target ${configuration.targetBodyId} has no physical definition`,
    );
  }
  if (configuration.targetBodyId === configuration.bodyId) {
    throw new Error("Surface observer target must differ from observer body");
  }
  const sunDefinition = majorBodyById.get("sun");
  if (sunDefinition === undefined) {
    throw new Error("Surface observer requires the Sun physical definition");
  }

  const observerState = stateBody(state, configuration.bodyId);
  const targetState = stateBody(state, configuration.targetBodyId);
  const sunState = stateBody(state, "sun");
  const observerCenter = scenePosition(observerState.positionM);
  const targetCenter = scenePosition(targetState.positionM);
  const sunCenter = scenePosition(sunState.positionM);
  const latitudeRad = configuration.latitudeDeg * DEG_TO_RAD;
  const longitudeRad = configuration.longitudeDeg * DEG_TO_RAD;
  const cosLatitude = Math.cos(latitudeRad);
  const orientation = bodyOrientationQuaternion(
    configuration.bodyId,
    state.timeSeconds,
  );
  const zenith = new Vector3(
    cosLatitude * Math.cos(longitudeRad),
    Math.sin(latitudeRad),
    -cosLatitude * Math.sin(longitudeRad),
  )
    .applyQuaternion(orientation)
    .normalize();
  const north = new Vector3(
    -Math.sin(latitudeRad) * Math.cos(longitudeRad),
    Math.cos(latitudeRad),
    Math.sin(latitudeRad) * Math.sin(longitudeRad),
  )
    .applyQuaternion(orientation)
    .normalize();
  const east = new Vector3(-Math.sin(longitudeRad), 0, -Math.cos(longitudeRad))
    .applyQuaternion(orientation)
    .normalize();
  const radiusAu = observerDefinition.meanRadiusM / ASTRONOMICAL_UNIT_M;
  const surfacePositionAu = observerCenter
    .clone()
    .add(zenith.clone().multiplyScalar(radiusAu));
  const observerPositionAu = observerCenter
    .clone()
    .add(
      zenith
        .clone()
        .multiplyScalar(
          (observerDefinition.meanRadiusM + eyeHeightM) / ASTRONOMICAL_UNIT_M,
        ),
    );
  const targetDirection = targetCenter.clone().sub(observerPositionAu);
  const targetDistanceM = targetDirection.length() * ASTRONOMICAL_UNIT_M;
  const sunDirection = sunCenter.clone().sub(observerPositionAu);
  const targetHorizontal = horizontalCoordinates(
    targetDirection,
    zenith,
    north,
    east,
  );
  const sunHorizontal = horizontalCoordinates(
    sunDirection,
    zenith,
    north,
    east,
  );

  const sunFromObserverCenter = sunCenter
    .clone()
    .sub(observerCenter)
    .normalize();
  const bodyFixedSunDirection = sunFromObserverCenter
    .clone()
    .applyQuaternion(orientation.clone().invert());
  const subsolarLongitudeRad = Math.atan2(
    -bodyFixedSunDirection.z,
    bodyFixedSunDirection.x,
  );
  const localHourAngleRad = signedRadians(longitudeRad - subsolarLongitudeRad);
  const localSolarTimeHours = normalizedHours(
    12 + (localHourAngleRad * 12) / Math.PI,
  );
  const solarDeclinationRad = Math.asin(
    Math.max(-1, Math.min(1, bodyFixedSunDirection.y)),
  );

  const targetPole = new Vector3(0, 1, 0)
    .applyQuaternion(
      bodyOrientationQuaternion(configuration.targetBodyId, state.timeSeconds),
    )
    .normalize();
  const targetNorthPolePositionAngleDeg = skyPositionAngleDeg(
    targetDirection,
    targetPole,
    zenith,
    north,
  );
  let targetIlluminatedFraction: number | undefined;
  let brightLimbPositionAngleDeg: number | undefined;
  if (configuration.targetBodyId !== "sun") {
    const targetToSun = sunCenter.clone().sub(targetCenter).normalize();
    const targetToObserver = observerPositionAu
      .clone()
      .sub(targetCenter)
      .normalize();
    targetIlluminatedFraction =
      (1 + Math.max(-1, Math.min(1, targetToSun.dot(targetToObserver)))) / 2;
    brightLimbPositionAngleDeg = skyPositionAngleDeg(
      targetDirection,
      sunCenter.clone().sub(targetCenter),
      zenith,
      north,
    );
  }

  const geometricHorizonDistanceM = Math.sqrt(
    (observerDefinition.meanRadiusM + eyeHeightM) ** 2 -
      observerDefinition.meanRadiusM ** 2,
  );
  const horizonCentralAngleRad = Math.acos(
    observerDefinition.meanRadiusM /
      (observerDefinition.meanRadiusM + eyeHeightM),
  );
  return {
    observerName: observerDefinition.name,
    targetName: targetDefinition.name,
    observerPositionAu,
    surfacePositionAu,
    zenith,
    north,
    east,
    targetDirection: targetDirection.normalize(),
    targetDistanceM,
    targetAltitudeDeg: targetHorizontal.altitudeDeg,
    targetAzimuthDeg: targetHorizontal.azimuthDeg,
    targetAngularDiameterDeg: angularDiameterDeg(
      targetDefinition.meanRadiusM,
      targetDistanceM,
    ),
    targetIlluminatedFraction,
    targetNorthPolePositionAngleDeg,
    brightLimbPositionAngleDeg,
    sunAltitudeDeg: sunHorizontal.altitudeDeg,
    sunAzimuthDeg: sunHorizontal.azimuthDeg,
    sunAngularDiameterDeg: angularDiameterDeg(
      sunDefinition.meanRadiusM,
      sunDirection.length() * ASTRONOMICAL_UNIT_M,
    ),
    localSolarTimeHours,
    solarHorizonEvents: solarHorizonEvents(latitudeRad, solarDeclinationRad),
    geometricHorizonDistanceM,
    horizonCentralAngleRad,
  };
}

export function surfaceHorizonPoint(
  frame: SurfaceObserverFrame,
  observerRadiusM: number,
  azimuthDeg: number,
): Vector3 {
  if (!Number.isFinite(observerRadiusM) || observerRadiusM <= 0) {
    throw new Error("Surface horizon radius must be positive and finite");
  }
  const azimuthRad = azimuthDeg * DEG_TO_RAD;
  const horizontalDirection = frame.north
    .clone()
    .multiplyScalar(Math.cos(azimuthRad))
    .add(frame.east.clone().multiplyScalar(Math.sin(azimuthRad)));
  return frame.surfacePositionAu
    .clone()
    .add(
      frame.zenith
        .clone()
        .multiplyScalar(
          (observerRadiusM * (Math.cos(frame.horizonCentralAngleRad) - 1)) /
            ASTRONOMICAL_UNIT_M,
        ),
    )
    .add(
      horizontalDirection.multiplyScalar(
        (observerRadiusM * Math.sin(frame.horizonCentralAngleRad)) /
          ASTRONOMICAL_UNIT_M,
      ),
    );
}
