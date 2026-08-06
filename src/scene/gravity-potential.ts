import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";

export const MAX_GRAVITY_WELL_BODIES = 32;

export type GravityWellMode = "off" | "contours" | "surface";
export type GravityWellScale = "absolute" | "local";

export type GravityPotentialSource = Readonly<{
  id: string;
  gravitationalParameterM3S2: number;
  positionAu: readonly [number, number, number];
  radiusAu: number;
}>;

export type GravityPotentialRange = Readonly<{
  minimumLog2SunUnits: number;
  maximumLog2SunUnits: number;
  minimumMagnitudeJPerKg: number;
  maximumMagnitudeJPerKg: number;
}>;

type Vector3Tuple = readonly [number, number, number];

const SUN_GRAVITATIONAL_PARAMETER_M3_S2 = 1.3271244004127942e20;
const SUN_POTENTIAL_UNIT_J_PER_KG =
  SUN_GRAVITATIONAL_PARAMETER_M3_S2 / ASTRONOMICAL_UNIT_M;
const DISPLAY_RANGE_PADDING_LOG2 = 0.06;
const DISPLAY_RANGE_MINIMUM_LOG2_SPAN = 0.12;
const DISPLAY_RANGE_SAMPLE_COUNT = 17;
const GRAVITY_WELL_DEPTH_FRACTION = 0.032;
const ABSOLUTE_MINIMUM_LOG2_SUN_UNITS = -6;
const ABSOLUTE_MAXIMUM_LOG2_SUN_UNITS = 8;

export function absoluteGravityPotentialDisplayRange(): GravityPotentialRange {
  return {
    minimumLog2SunUnits: ABSOLUTE_MINIMUM_LOG2_SUN_UNITS,
    maximumLog2SunUnits: ABSOLUTE_MAXIMUM_LOG2_SUN_UNITS,
    minimumMagnitudeJPerKg:
      2 ** ABSOLUTE_MINIMUM_LOG2_SUN_UNITS * SUN_POTENTIAL_UNIT_J_PER_KG,
    maximumMagnitudeJPerKg:
      2 ** ABSOLUTE_MAXIMUM_LOG2_SUN_UNITS * SUN_POTENTIAL_UNIT_J_PER_KG,
  };
}

function assertFiniteVector(name: string, value: Vector3Tuple): void {
  if (!value.every(Number.isFinite)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
}

function dot(first: Vector3Tuple, second: Vector3Tuple): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function addScaled(
  origin: Vector3Tuple,
  firstDirection: Vector3Tuple,
  firstScale: number,
  secondDirection: Vector3Tuple,
  secondScale: number,
): Vector3Tuple {
  return [
    origin[0] +
      firstDirection[0] * firstScale +
      secondDirection[0] * secondScale,
    origin[1] +
      firstDirection[1] * firstScale +
      secondDirection[1] * secondScale,
    origin[2] +
      firstDirection[2] * firstScale +
      secondDirection[2] * secondScale,
  ];
}

function subtract(first: Vector3Tuple, second: Vector3Tuple): Vector3Tuple {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function validateGravityPotentialSources(
  sources: readonly GravityPotentialSource[],
): void {
  if (sources.length === 0) {
    throw new Error("Gravity potential requires at least one massive body");
  }
  if (sources.length > MAX_GRAVITY_WELL_BODIES) {
    throw new Error(
      `Gravity potential supports at most ${String(MAX_GRAVITY_WELL_BODIES)} massive bodies`,
    );
  }
  const ids = new Set<string>();
  for (const source of sources) {
    if (source.id.trim() === "" || ids.has(source.id)) {
      throw new Error(
        `Gravity potential body id ${source.id || "<empty>"} is invalid`,
      );
    }
    ids.add(source.id);
    assertFiniteVector(`${source.id} position`, source.positionAu);
    if (
      !Number.isFinite(source.gravitationalParameterM3S2) ||
      source.gravitationalParameterM3S2 <= 0
    ) {
      throw new Error(
        `${source.id} must have a positive gravitational parameter`,
      );
    }
    if (!Number.isFinite(source.radiusAu) || source.radiusAu <= 0) {
      throw new Error(`${source.id} must have a positive sourced radius`);
    }
  }
}

export function gravityWellDisplayDepthAu(extentAu: number): number {
  if (!Number.isFinite(extentAu) || extentAu <= 0) {
    throw new Error("Gravity well extent must be positive and finite");
  }
  return extentAu * GRAVITY_WELL_DEPTH_FRACTION;
}

export function potentialMagnitudeSunUnitsAt(
  pointAu: Vector3Tuple,
  sources: readonly GravityPotentialSource[],
): number {
  assertFiniteVector("Potential sample", pointAu);
  let magnitude = 0;
  for (const source of sources) {
    const distanceAu = Math.max(
      source.radiusAu,
      Math.hypot(
        pointAu[0] - source.positionAu[0],
        pointAu[1] - source.positionAu[1],
        pointAu[2] - source.positionAu[2],
      ),
    );
    magnitude +=
      source.gravitationalParameterM3S2 /
      SUN_GRAVITATIONAL_PARAMETER_M3_S2 /
      distanceAu;
  }
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new Error(
      "Gravity potential produced a non-positive finite magnitude",
    );
  }
  return magnitude;
}

export function newtonianPotentialJPerKgAt(
  pointAu: Vector3Tuple,
  sources: readonly GravityPotentialSource[],
): number {
  return (
    -potentialMagnitudeSunUnitsAt(pointAu, sources) *
    SUN_POTENTIAL_UNIT_J_PER_KG
  );
}

export function gravityPotentialDisplayRange(
  centerAu: Vector3Tuple,
  planeFirstAxis: Vector3Tuple,
  planeSecondAxis: Vector3Tuple,
  extentAu: number,
  sources: readonly GravityPotentialSource[],
): GravityPotentialRange {
  assertFiniteVector("Gravity field center", centerAu);
  assertFiniteVector("Gravity field first axis", planeFirstAxis);
  assertFiniteVector("Gravity field second axis", planeSecondAxis);
  if (!Number.isFinite(extentAu) || extentAu <= 0) {
    throw new Error("Gravity field extent must be positive and finite");
  }
  validateGravityPotentialSources(sources);

  const halfExtent = extentAu / 2;
  const magnitudes: number[] = [];
  for (let row = 0; row < DISPLAY_RANGE_SAMPLE_COUNT; row += 1) {
    const secondOffset =
      -halfExtent + (extentAu * row) / (DISPLAY_RANGE_SAMPLE_COUNT - 1);
    for (let column = 0; column < DISPLAY_RANGE_SAMPLE_COUNT; column += 1) {
      const firstOffset =
        -halfExtent + (extentAu * column) / (DISPLAY_RANGE_SAMPLE_COUNT - 1);
      magnitudes.push(
        potentialMagnitudeSunUnitsAt(
          addScaled(
            centerAu,
            planeFirstAxis,
            firstOffset,
            planeSecondAxis,
            secondOffset,
          ),
          sources,
        ),
      );
    }
  }

  for (const source of sources) {
    const fromCenter = subtract(source.positionAu, centerAu);
    const firstOffset = clamp(
      dot(fromCenter, planeFirstAxis),
      -halfExtent,
      halfExtent,
    );
    const secondOffset = clamp(
      dot(fromCenter, planeSecondAxis),
      -halfExtent,
      halfExtent,
    );
    magnitudes.push(
      potentialMagnitudeSunUnitsAt(
        addScaled(
          centerAu,
          planeFirstAxis,
          firstOffset,
          planeSecondAxis,
          secondOffset,
        ),
        sources,
      ),
    );
  }

  const minimumMagnitude = Math.min(...magnitudes);
  const maximumMagnitude = Math.max(...magnitudes);
  let minimumLog2 = Math.log2(minimumMagnitude) - DISPLAY_RANGE_PADDING_LOG2;
  let maximumLog2 = Math.log2(maximumMagnitude) + DISPLAY_RANGE_PADDING_LOG2;
  if (maximumLog2 - minimumLog2 < DISPLAY_RANGE_MINIMUM_LOG2_SPAN) {
    const midpoint = (minimumLog2 + maximumLog2) / 2;
    minimumLog2 = midpoint - DISPLAY_RANGE_MINIMUM_LOG2_SPAN / 2;
    maximumLog2 = midpoint + DISPLAY_RANGE_MINIMUM_LOG2_SPAN / 2;
  }
  return {
    minimumLog2SunUnits: minimumLog2,
    maximumLog2SunUnits: maximumLog2,
    minimumMagnitudeJPerKg: 2 ** minimumLog2 * SUN_POTENTIAL_UNIT_J_PER_KG,
    maximumMagnitudeJPerKg: 2 ** maximumLog2 * SUN_POTENTIAL_UNIT_J_PER_KG,
  };
}
