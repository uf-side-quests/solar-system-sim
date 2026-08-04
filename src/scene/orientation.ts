import { Matrix4, Quaternion, Vector3 } from "three";

import type { MajorBodyDefinition } from "../physics/solar-system";
import {
  majorBodySnapshot,
  naifPhysicalSnapshot,
} from "../physics/solar-system";
import { icrfToScene } from "./reference-frames";

const J2000_JULIAN_DAY = 2_451_545;
const DAYS_PER_JULIAN_CENTURY = 36_525;
const SECONDS_PER_DAY = 86_400;
const DEG_TO_RAD = Math.PI / 180;

function polynomial(coefficients: readonly number[], value: number): number {
  return coefficients.reduceRight(
    (result, coefficient) => result * value + coefficient,
    0,
  );
}

export type BodyOrientationAngles = Readonly<{
  poleRightAscensionDeg: number;
  poleDeclinationDeg: number;
  primeMeridianDeg: number;
}>;

export function bodyOrientationAngles(
  bodyId: string,
  elapsedSeconds: number,
): BodyOrientationAngles {
  const physicalBody = naifPhysicalSnapshot.bodies[bodyId];
  if (physicalBody === undefined) {
    throw new Error(`NAIF orientation is missing body ${bodyId}`);
  }
  const elapsedDays = elapsedSeconds / SECONDS_PER_DAY;
  const daysSinceJ2000 =
    majorBodySnapshot.epoch.value - J2000_JULIAN_DAY + elapsedDays;
  const centuriesSinceJ2000 = daysSinceJ2000 / DAYS_PER_JULIAN_CENTURY;
  const model = physicalBody.orientation;
  const phases = model.phaseAnglesDeg.map(
    (coefficients) =>
      polynomial(coefficients, centuriesSinceJ2000) * DEG_TO_RAD,
  );
  let poleRightAscensionDeg = polynomial(
    model.poleRightAscensionDeg,
    centuriesSinceJ2000,
  );
  let poleDeclinationDeg = polynomial(
    model.poleDeclinationDeg,
    centuriesSinceJ2000,
  );
  let primeMeridianDeg = polynomial(model.primeMeridianDeg, daysSinceJ2000);
  for (const [index, phase] of phases.entries()) {
    poleRightAscensionDeg +=
      (model.nutationRightAscensionDeg[index] ?? 0) * Math.sin(phase);
    poleDeclinationDeg +=
      (model.nutationDeclinationDeg[index] ?? 0) * Math.cos(phase);
    primeMeridianDeg +=
      (model.nutationPrimeMeridianDeg[index] ?? 0) * Math.sin(phase);
  }
  return { poleRightAscensionDeg, poleDeclinationDeg, primeMeridianDeg };
}

/** Returns local body geometry to scene orientation from the NAIF text PCK. */
export function bodyOrientationQuaternion(
  bodyId: string,
  elapsedSeconds: number,
): Quaternion {
  const angles = bodyOrientationAngles(bodyId, elapsedSeconds);
  const rightAscension = angles.poleRightAscensionDeg * DEG_TO_RAD;
  const declination = angles.poleDeclinationDeg * DEG_TO_RAD;
  const primeMeridian = angles.primeMeridianDeg * DEG_TO_RAD;
  const sinRightAscension = Math.sin(rightAscension);
  const cosRightAscension = Math.cos(rightAscension);
  const sinDeclination = Math.sin(declination);
  const cosDeclination = Math.cos(declination);
  const sinPrimeMeridian = Math.sin(primeMeridian);
  const cosPrimeMeridian = Math.cos(primeMeridian);

  const bodyX = new Vector3(
    -sinRightAscension * cosPrimeMeridian -
      cosRightAscension * sinDeclination * sinPrimeMeridian,
    cosRightAscension * cosPrimeMeridian -
      sinRightAscension * sinDeclination * sinPrimeMeridian,
    cosDeclination * sinPrimeMeridian,
  );
  const bodyY = new Vector3(
    sinRightAscension * sinPrimeMeridian -
      cosRightAscension * sinDeclination * cosPrimeMeridian,
    -cosRightAscension * sinPrimeMeridian -
      sinRightAscension * sinDeclination * cosPrimeMeridian,
    cosDeclination * cosPrimeMeridian,
  );
  const bodyZ = new Vector3(
    cosRightAscension * cosDeclination,
    sinRightAscension * cosDeclination,
    sinDeclination,
  );
  const sceneBodyX = icrfToScene(bodyX);
  const sceneBodyZ = icrfToScene(bodyZ);
  const sceneNegativeBodyY = icrfToScene(bodyY).multiplyScalar(-1);
  const matrix = new Matrix4().makeBasis(
    sceneBodyX,
    sceneBodyZ,
    sceneNegativeBodyY,
  );
  return new Quaternion().setFromRotationMatrix(matrix).normalize();
}

export function siderealRotationPeriodHours(body: MajorBodyDefinition): number {
  const rateDegPerDay =
    naifPhysicalSnapshot.bodies[body.id]?.orientation.primeMeridianDeg[1];
  if (rateDegPerDay === undefined || rateDegPerDay === 0) {
    throw new Error(`NAIF rotation rate is missing body ${body.id}`);
  }
  return (360 / Math.abs(rateDegPerDay)) * 24;
}
