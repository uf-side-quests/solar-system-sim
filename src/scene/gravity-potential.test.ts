import { describe, expect, it } from "vitest";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import {
  absoluteGravityPotentialDisplayRange,
  gravityPotentialDisplayRange,
  gravityWellDisplayDepthAu,
  newtonianPotentialJPerKgAt,
  potentialMagnitudeSunUnitsAt,
  validateGravityPotentialSources,
  type GravityPotentialSource,
} from "./gravity-potential";

const EARTH_GM = Number("3.9860043550702266e14");
const EARTH_RADIUS_AU = 6_371_008.4 / ASTRONOMICAL_UNIT_M;
const earth: GravityPotentialSource = {
  id: "earth",
  gravitationalParameterM3S2: EARTH_GM,
  positionAu: [0, 0, 0],
  radiusAu: EARTH_RADIUS_AU,
};

describe("Newtonian gravity potential", () => {
  it("provides one fixed range for truthful cross-body comparison", () => {
    const range = absoluteGravityPotentialDisplayRange();
    expect(range.minimumLog2SunUnits).toBe(-6);
    expect(range.maximumLog2SunUnits).toBe(8);
    expect(range.maximumMagnitudeJPerKg).toBeGreaterThan(
      range.minimumMagnitudeJPerKg,
    );
  });
  it("matches -GM/r outside a spherical body's sourced mean radius", () => {
    const distanceAu = 0.01;
    expect(newtonianPotentialJPerKgAt([distanceAu, 0, 0], [earth])).toBeCloseTo(
      -EARTH_GM / (distanceAu * ASTRONOMICAL_UNIT_M),
      10,
    );
  });

  it("caps point-mass potential at the sourced mean-radius surface", () => {
    const surfacePotential =
      -EARTH_GM / (EARTH_RADIUS_AU * ASTRONOMICAL_UNIT_M);
    expect(newtonianPotentialJPerKgAt([0, 0, 0], [earth])).toBeCloseTo(
      surfacePotential,
      8,
    );
    expect(
      newtonianPotentialJPerKgAt([EARTH_RADIUS_AU / 2, 0, 0], [earth]),
    ).toBeCloseTo(surfacePotential, 8);
  });

  it("superposes every positive-GM body's potential", () => {
    const secondEarth = {
      ...earth,
      id: "earth-2",
      positionAu: [1, 0, 0],
    } as const;
    const first = potentialMagnitudeSunUnitsAt([0.5, 0, 0], [earth]);
    const combined = potentialMagnitudeSunUnitsAt(
      [0.5, 0, 0],
      [earth, secondEarth],
    );
    expect(combined).toBeCloseTo(first * 2, 14);
  });

  it("derives a finite log display range without changing potential values", () => {
    const range = gravityPotentialDisplayRange(
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      0.02,
      [earth],
    );
    expect(range.minimumLog2SunUnits).toBeLessThan(range.maximumLog2SunUnits);
    expect(range.minimumMagnitudeJPerKg).toBeGreaterThan(0);
    expect(range.maximumMagnitudeJPerKg).toBeGreaterThan(
      range.minimumMagnitudeJPerKg,
    );
  });

  it("keeps visual well depth close enough to the orbital plane to remain anchored", () => {
    expect(gravityWellDisplayDepthAu(0.02)).toBeCloseTo(0.000_64, 12);
    expect(() => gravityWellDisplayDepthAu(0)).toThrow(/positive and finite/u);
  });

  it("rejects massless or radius-free gravity sources instead of faking wells", () => {
    expect(() =>
      validateGravityPotentialSources([
        { ...earth, id: "massless", gravitationalParameterM3S2: 0 },
      ]),
    ).toThrow(/positive gravitational parameter/u);
    expect(() =>
      validateGravityPotentialSources([
        { ...earth, id: "unknown", radiusAu: 0 },
      ]),
    ).toThrow(/positive sourced radius/u);
  });
});
