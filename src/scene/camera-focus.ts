import type { MajorBodyDefinition } from "../physics/solar-system";
import { displayedRadiusAu } from "./scale";

const DISPLAY_RADIUS_CLEARANCE = 4;
const MAXIMUM_ENHANCED_FOCUS_SCALE = 12;
const SATURN_RING_OUTER_RADIUS_KM = 136_780;

function displayedVisualExtentAu(
  body: MajorBodyDefinition,
  visibilityBoost: number,
): number {
  const bodyRadius = displayedRadiusAu(body, visibilityBoost);
  if (body.id !== "saturn") {
    return bodyRadius;
  }
  return (
    (bodyRadius * (SATURN_RING_OUTER_RADIUS_KM * 1_000)) / body.meanRadiusM
  );
}

function physicalVisualExtentAu(body: MajorBodyDefinition): number {
  return displayedVisualExtentAu(body, 0);
}

export function focusDistanceAu(
  body: MajorBodyDefinition,
  visibilityBoost: number,
): number {
  const physicalExtent = physicalVisualExtentAu(body);
  const displayedExtent = Math.min(
    displayedVisualExtentAu(body, visibilityBoost),
    physicalExtent * MAXIMUM_ENHANCED_FOCUS_SCALE,
  );
  return displayedExtent * DISPLAY_RADIUS_CLEARANCE;
}
