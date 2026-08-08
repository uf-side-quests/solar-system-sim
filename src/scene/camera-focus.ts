import type { MajorBodyDefinition } from "../physics/solar-system";
import {
  SATURN_MAIN_RING_OUTER_RADIUS_KM,
  URANUS_MAIN_RING_OUTER_RADIUS_KM,
} from "./ring-system";
import { displayedRadiusAu } from "./scale";

const DISPLAY_RADIUS_CLEARANCE = 4;
const MAXIMUM_ENHANCED_FOCUS_SCALE = 12;
const FOCUS_DISTANCE_TO_NEAR_PLANE_RATIO = 64;

const RING_SYSTEM_OUTER_RADIUS_KM: Readonly<Record<string, number>> = {
  saturn: SATURN_MAIN_RING_OUTER_RADIUS_KM,
  // Frame the resolvable main rings by default. Nu and Mu remain physically
  // present but are extremely diffuse and can be reached by zooming out.
  uranus: URANUS_MAIN_RING_OUTER_RADIUS_KM,
};

function displayedVisualExtentAu(
  body: MajorBodyDefinition,
  visibilityBoost: number,
): number {
  const bodyRadius = displayedRadiusAu(body, visibilityBoost);
  const ringOuterRadiusKm = RING_SYSTEM_OUTER_RADIUS_KM[body.id];
  if (ringOuterRadiusKm === undefined) {
    return bodyRadius;
  }
  return (bodyRadius * (ringOuterRadiusKm * 1_000)) / body.meanRadiusM;
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

export function focusNearPlaneAu(
  focusDistance: number,
  maximumNearPlane: number,
): number {
  if (!Number.isFinite(focusDistance) || focusDistance <= 0) {
    throw new Error("Focus distance must be positive and finite");
  }
  if (!Number.isFinite(maximumNearPlane) || maximumNearPlane <= 0) {
    throw new Error("Maximum near plane must be positive and finite");
  }
  return Math.min(
    maximumNearPlane,
    focusDistance / FOCUS_DISTANCE_TO_NEAR_PLANE_RATIO,
  );
}
