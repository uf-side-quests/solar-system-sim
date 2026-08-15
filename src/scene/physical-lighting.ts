import { Vector3 } from "three";

export const MAXIMUM_ECLIPSE_OCCLUDERS = 8;

export type ExposureMode = "auto" | "manual";

export type SolarOccluder = Readonly<{
  id: string;
  positionAu: Vector3;
  radiusAu: number;
}>;

export type SelectedSolarOccluder = Readonly<{
  id: string;
  positionAu: Vector3;
  radiusAu: number;
  angularSeparationRad: number;
}>;

export function eclipseTransmissionAtPoint(
  surfacePointAu: Vector3,
  sunPositionAu: Vector3,
  sunRadiusAu: number,
  occluders: readonly SolarOccluder[],
): number {
  requiredPositiveFinite("Sun radius", sunRadiusAu);
  const toSun = sunPositionAu.clone().sub(surfacePointAu);
  const sunDistance = requiredPositiveFinite("Sun distance", toSun.length());
  const sunDirection = toSun.multiplyScalar(1 / sunDistance);
  const sunAngularRadius = Math.asin(Math.min(1, sunRadiusAu / sunDistance));
  let transmission = 1;
  for (const occluder of occluders) {
    requiredPositiveFinite(`${occluder.id} radius`, occluder.radiusAu);
    const toOccluder = occluder.positionAu.clone().sub(surfacePointAu);
    const occluderDistance = requiredPositiveFinite(
      `${occluder.id} distance`,
      toOccluder.length(),
    );
    const distanceTowardSun = toOccluder.dot(sunDirection);
    if (distanceTowardSun <= 0 || distanceTowardSun >= sunDistance) continue;
    const occluderDirection = toOccluder.multiplyScalar(1 / occluderDistance);
    const angularSeparation = Math.acos(
      Math.max(-1, Math.min(1, occluderDirection.dot(sunDirection))),
    );
    const occluderAngularRadius = Math.asin(
      Math.min(1, occluder.radiusAu / occluderDistance),
    );
    transmission *=
      1 -
      circleOverlapFraction(
        sunAngularRadius,
        occluderAngularRadius,
        angularSeparation,
      );
  }
  return Math.max(0, Math.min(1, transmission));
}

function requiredPositiveFinite(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive and finite`);
  }
  return value;
}

export function circleOverlapFraction(
  sourceRadius: number,
  blockerRadius: number,
  separation: number,
): number {
  requiredPositiveFinite("Source angular radius", sourceRadius);
  requiredPositiveFinite("Blocker angular radius", blockerRadius);
  if (!Number.isFinite(separation) || separation < 0) {
    throw new Error("Angular separation must be finite and non-negative");
  }
  if (separation >= sourceRadius + blockerRadius) return 0;
  if (blockerRadius >= separation + sourceRadius) return 1;
  if (sourceRadius >= separation + blockerRadius) {
    return (blockerRadius * blockerRadius) / (sourceRadius * sourceRadius);
  }
  const separationSquared = separation * separation;
  const sourceSquared = sourceRadius * sourceRadius;
  const blockerSquared = blockerRadius * blockerRadius;
  const sourceSector = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (separationSquared + sourceSquared - blockerSquared) /
          (2 * separation * sourceRadius),
      ),
    ),
  );
  const blockerSector = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (separationSquared + blockerSquared - sourceSquared) /
          (2 * separation * blockerRadius),
      ),
    ),
  );
  const lensRoot = Math.sqrt(
    Math.max(
      0,
      (-separation + sourceRadius + blockerRadius) *
        (separation + sourceRadius - blockerRadius) *
        (separation - sourceRadius + blockerRadius) *
        (separation + sourceRadius + blockerRadius),
    ),
  );
  const overlapArea =
    sourceSquared * sourceSector +
    blockerSquared * blockerSector -
    lensRoot / 2;
  return Math.max(0, Math.min(1, overlapArea / (Math.PI * sourceSquared)));
}

export function selectSolarOccluders(
  receiverId: string,
  receiverPositionAu: Vector3,
  receiverRadiusAu: number,
  sunPositionAu: Vector3,
  sunRadiusAu: number,
  candidates: readonly SolarOccluder[],
): readonly SelectedSolarOccluder[] {
  if (!receiverPositionAu.toArray().every(Number.isFinite)) {
    throw new Error("Receiver position must be finite");
  }
  requiredPositiveFinite("Receiver radius", receiverRadiusAu);
  requiredPositiveFinite("Sun radius", sunRadiusAu);
  const toSun = sunPositionAu.clone().sub(receiverPositionAu);
  const sunDistance = requiredPositiveFinite("Sun distance", toSun.length());
  const sunDirection = toSun.multiplyScalar(1 / sunDistance);
  const sunAngularRadius = Math.asin(Math.min(1, sunRadiusAu / sunDistance));

  return candidates
    .filter((candidate) => candidate.id !== receiverId)
    .map((candidate): SelectedSolarOccluder | undefined => {
      requiredPositiveFinite(`${candidate.id} radius`, candidate.radiusAu);
      const toCandidate = candidate.positionAu.clone().sub(receiverPositionAu);
      const candidateDistance = toCandidate.length();
      if (!Number.isFinite(candidateDistance) || candidateDistance <= 0) {
        return undefined;
      }
      const distanceTowardSun = toCandidate.dot(sunDirection);
      if (distanceTowardSun <= 0 || distanceTowardSun >= sunDistance) {
        return undefined;
      }
      const candidateDirection = toCandidate.multiplyScalar(
        1 / candidateDistance,
      );
      const separation = Math.acos(
        Math.max(-1, Math.min(1, candidateDirection.dot(sunDirection))),
      );
      const candidateAngularRadius = Math.asin(
        Math.min(1, candidate.radiusAu / candidateDistance),
      );
      const receiverParallax = Math.asin(
        Math.min(1, receiverRadiusAu / candidateDistance),
      );
      if (
        separation >
        sunAngularRadius + candidateAngularRadius + receiverParallax
      ) {
        return undefined;
      }
      return {
        id: candidate.id,
        positionAu: candidate.positionAu,
        radiusAu: candidate.radiusAu,
        angularSeparationRad: separation,
      };
    })
    .filter(
      (candidate): candidate is SelectedSolarOccluder =>
        candidate !== undefined,
    )
    .sort(
      (left, right) => left.angularSeparationRad - right.angularSeparationRad,
    )
    .slice(0, MAXIMUM_ECLIPSE_OCCLUDERS);
}

export function exposureMultiplierFromEv(ev: number): number {
  if (!Number.isFinite(ev)) {
    throw new Error("Exposure EV must be finite");
  }
  return 2 ** ev;
}

export function exposureEvFromMultiplier(multiplier: number): number {
  return Math.log2(requiredPositiveFinite("Exposure multiplier", multiplier));
}
