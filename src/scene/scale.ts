import type { MajorBodyDefinition } from "../physics/solar-system";
import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";

export const MINIMUM_RESOLVABLE_BODY_DIAMETER_CSS_PIXELS = 1;

function enhancedRadiusAu(body: MajorBodyDefinition): number {
  if (body.type === "star") {
    return 0.3;
  }
  const radiusKm = body.meanRadiusM / 1_000;
  const categoryMultiplier = body.type === "moon" ? 0.018 : 0.035;
  return Math.max(0.035, categoryMultiplier * Math.log10(radiusKm));
}

export function displayedRadiusAu(
  body: MajorBodyDefinition,
  visibilityBoost: number,
): number {
  if (
    !Number.isFinite(visibilityBoost) ||
    visibilityBoost < 0 ||
    visibilityBoost > 1
  ) {
    throw new Error("Body size boost must be between 0 and 1");
  }
  const physicalRadiusAu = body.meanRadiusM / ASTRONOMICAL_UNIT_M;
  return (
    physicalRadiusAu *
    Math.pow(enhancedRadiusAu(body) / physicalRadiusAu, visibilityBoost)
  );
}

export function nonOverlappingDisplayedRadiusAu(
  body: MajorBodyDefinition,
  visibilityBoost: number,
  nearestBodyDistanceAu: number,
): number {
  if (!Number.isFinite(nearestBodyDistanceAu) || nearestBodyDistanceAu <= 0) {
    throw new Error("Nearest-body distance must be positive and finite");
  }
  const physicalRadiusAu = body.meanRadiusM / ASTRONOMICAL_UNIT_M;
  return Math.max(
    physicalRadiusAu,
    Math.min(
      displayedRadiusAu(body, visibilityBoost),
      nearestBodyDistanceAu / 5,
    ),
  );
}

export function isPhysicalBodyResolvable(radiusCssPixels: number): boolean {
  if (!Number.isFinite(radiusCssPixels) || radiusCssPixels < 0) {
    throw new Error("Physical body radius must be finite and non-negative");
  }
  return radiusCssPixels * 2 >= MINIMUM_RESOLVABLE_BODY_DIAMETER_CSS_PIXELS;
}
