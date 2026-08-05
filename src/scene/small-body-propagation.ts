import { J2000_MEAN_OBLIQUITY_RAD } from "./reference-frames";

export const SMALL_BODY_RECORD_STRIDE_BYTES = 48;

export type SmallBodyOrbitRecord = Readonly<{
  semiMajorAxisAu: number;
  eccentricity: number;
  perihelionAu: number;
  inclinationRad: number;
  ascendingNodeRad: number;
  argumentPerihelionRad: number;
  meanAnomalyAtReferenceRad: number;
  meanMotionRadPerDay: number;
  flags: number;
}>;

export function readSmallBodyOrbitRecord(
  records: ArrayBuffer,
  index: number,
): SmallBodyOrbitRecord {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Small-body record index must be a non-negative integer");
  }
  const byteOffset = index * SMALL_BODY_RECORD_STRIDE_BYTES;
  if (byteOffset + SMALL_BODY_RECORD_STRIDE_BYTES > records.byteLength) {
    throw new Error("Small-body record index is outside the snapshot");
  }
  const view = new DataView(
    records,
    byteOffset,
    SMALL_BODY_RECORD_STRIDE_BYTES,
  );
  return {
    semiMajorAxisAu: view.getFloat32(0, true),
    eccentricity: view.getFloat32(4, true),
    perihelionAu: view.getFloat32(8, true),
    inclinationRad: view.getFloat32(12, true),
    ascendingNodeRad: view.getFloat32(16, true),
    argumentPerihelionRad: view.getFloat32(20, true),
    meanAnomalyAtReferenceRad: view.getFloat32(24, true),
    meanMotionRadPerDay: view.getFloat32(28, true),
    flags: view.getUint32(36, true),
  };
}

function solveElliptic(meanAnomaly: number, eccentricity: number): number {
  let eccentricAnomaly =
    eccentricity > 0.8
      ? meanAnomaly + (Math.sin(meanAnomaly) >= 0 ? 0.85 : -0.85) * eccentricity
      : meanAnomaly;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function solveHyperbolic(meanAnomaly: number, eccentricity: number): number {
  let hyperbolicAnomaly =
    eccentricity < 1.1 && meanAnomaly !== 0
      ? Math.sign(meanAnomaly) *
        Math.cbrt((6 * Math.abs(meanAnomaly)) / eccentricity)
      : Math.asinh(meanAnomaly / eccentricity);
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const sinhMinusAnomaly = Math.sinh(hyperbolicAnomaly) - hyperbolicAnomaly;
    const coshMinusOne = Math.cosh(hyperbolicAnomaly) - 1;
    hyperbolicAnomaly -=
      ((eccentricity - 1) * hyperbolicAnomaly +
        eccentricity * sinhMinusAnomaly -
        meanAnomaly) /
      (eccentricity - 1 + eccentricity * coshMinusOne);
  }
  return hyperbolicAnomaly;
}

export function propagateSmallBodyPositionAu(
  orbit: SmallBodyOrbitRecord,
  elapsedDays: number,
): readonly [number, number, number] | undefined {
  if (!Number.isFinite(elapsedDays)) {
    throw new Error("Small-body elapsed days must be finite");
  }
  if ((orbit.flags & 1) === 0 || Math.abs(orbit.eccentricity - 1) <= 0.000_01) {
    return undefined;
  }
  const meanAnomaly =
    orbit.meanAnomalyAtReferenceRad + orbit.meanMotionRadPerDay * elapsedDays;
  let orbitalX: number;
  let orbitalY: number;
  if (orbit.eccentricity < 1) {
    const wrappedMeanAnomaly = Math.atan2(
      Math.sin(meanAnomaly),
      Math.cos(meanAnomaly),
    );
    const eccentricAnomaly = solveElliptic(
      wrappedMeanAnomaly,
      orbit.eccentricity,
    );
    orbitalX =
      orbit.semiMajorAxisAu * (Math.cos(eccentricAnomaly) - orbit.eccentricity);
    orbitalY =
      orbit.semiMajorAxisAu *
      Math.sqrt(1 - orbit.eccentricity * orbit.eccentricity) *
      Math.sin(eccentricAnomaly);
  } else {
    const hyperbolicAnomaly = solveHyperbolic(meanAnomaly, orbit.eccentricity);
    orbitalX =
      orbit.perihelionAu +
      orbit.semiMajorAxisAu * 2 * Math.sinh(hyperbolicAnomaly / 2) ** 2;
    orbitalY =
      -orbit.semiMajorAxisAu *
      Math.sqrt(orbit.eccentricity * orbit.eccentricity - 1) *
      Math.sinh(hyperbolicAnomaly);
  }

  const cosNode = Math.cos(orbit.ascendingNodeRad);
  const sinNode = Math.sin(orbit.ascendingNodeRad);
  const cosArgument = Math.cos(orbit.argumentPerihelionRad);
  const sinArgument = Math.sin(orbit.argumentPerihelionRad);
  const cosInclination = Math.cos(orbit.inclinationRad);
  const sinInclination = Math.sin(orbit.inclinationRad);
  const eclipticX =
    (cosNode * cosArgument - sinNode * sinArgument * cosInclination) *
      orbitalX +
    (-cosNode * sinArgument - sinNode * cosArgument * cosInclination) *
      orbitalY;
  const eclipticY =
    (sinNode * cosArgument + cosNode * sinArgument * cosInclination) *
      orbitalX +
    (-sinNode * sinArgument + cosNode * cosArgument * cosInclination) *
      orbitalY;
  const eclipticZ =
    sinArgument * sinInclination * orbitalX +
    cosArgument * sinInclination * orbitalY;
  const cosineObliquity = Math.cos(J2000_MEAN_OBLIQUITY_RAD);
  const sineObliquity = Math.sin(J2000_MEAN_OBLIQUITY_RAD);
  const icrfY = cosineObliquity * eclipticY - sineObliquity * eclipticZ;
  const icrfZ = sineObliquity * eclipticY + cosineObliquity * eclipticZ;
  return [eclipticX, icrfZ, -icrfY];
}
