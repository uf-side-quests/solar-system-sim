export type SmallBodyLevelOfDetail = Readonly<{
  visibilityFraction: number;
  pointOpacity: number;
}>;

const REFERENCE_DISTANCE_AU = 70;
const REFERENCE_VISIBILITY_FRACTION = 0.0015;
const MINIMUM_VISIBILITY_FRACTION = 0.00025;
const MINIMUM_FOCUSED_POINT_OPACITY = 0.4;

export function effectiveSmallBodyPointOpacity(
  baseOpacity: number,
  focusRadiusAu: number,
): number {
  if (!Number.isFinite(baseOpacity) || baseOpacity < 0 || baseOpacity > 1) {
    throw new Error("Base point opacity must be between zero and one");
  }
  if (!Number.isFinite(focusRadiusAu) || focusRadiusAu < 0) {
    throw new Error("Focus radius must be finite and non-negative");
  }
  return focusRadiusAu > 0
    ? Math.max(baseOpacity, MINIMUM_FOCUSED_POINT_OPACITY)
    : baseOpacity;
}

export function categoryVisibilityFraction(
  baseVisibilityFraction: number,
  catalogueCount: number,
  minimumCatalogueSamples: number,
): number {
  if (
    !Number.isFinite(baseVisibilityFraction) ||
    baseVisibilityFraction < 0 ||
    baseVisibilityFraction > 1
  ) {
    throw new Error("Base visibility fraction must be between zero and one");
  }
  if (!Number.isInteger(catalogueCount) || catalogueCount <= 0) {
    throw new Error("Catalogue count must be a positive integer");
  }
  if (
    !Number.isInteger(minimumCatalogueSamples) ||
    minimumCatalogueSamples < 0
  ) {
    throw new Error("Minimum catalogue samples must be a non-negative integer");
  }
  return Math.min(
    1,
    Math.max(baseVisibilityFraction, minimumCatalogueSamples / catalogueCount),
  );
}

export function smallBodyLevelOfDetail(
  cameraDistanceAu: number,
): SmallBodyLevelOfDetail {
  if (!Number.isFinite(cameraDistanceAu) || cameraDistanceAu <= 0) {
    throw new Error("Camera distance must be a positive finite AU value");
  }
  const visibilityFraction = Math.min(
    1,
    Math.max(
      MINIMUM_VISIBILITY_FRACTION,
      REFERENCE_VISIBILITY_FRACTION *
        Math.pow(REFERENCE_DISTANCE_AU / cameraDistanceAu, 2),
    ),
  );
  const pointOpacity = Math.min(
    0.7,
    Math.max(
      0.15,
      0.7 * Math.pow(REFERENCE_VISIBILITY_FRACTION / visibilityFraction, 0.2),
    ),
  );
  return { visibilityFraction, pointOpacity };
}
