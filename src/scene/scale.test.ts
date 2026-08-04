import { describe, expect, it } from "vitest";

import { majorBodySnapshot } from "../physics/solar-system";
import {
  displayedRadiusAu,
  isPhysicalBodyResolvable,
  nonOverlappingDisplayedRadiusAu,
} from "./scale";

function body(id: string) {
  const result = majorBodySnapshot.bodies.find(
    (candidate) => candidate.id === id,
  );
  if (result === undefined) {
    throw new Error(`Missing test body ${id}`);
  }
  return result;
}

describe("body scale transformations", () => {
  it("uses one common physical length scale at zero visibility boost", () => {
    const earth = body("earth");
    const moon = body("moon");

    expect(
      displayedRadiusAu(earth, 0) / displayedRadiusAu(moon, 0),
    ).toBeCloseTo(earth.meanRadiusM / moon.meanRadiusM, 12);
  });

  it("caps enhanced radii before neighboring bodies can overlap", () => {
    expect(
      nonOverlappingDisplayedRadiusAu(body("earth"), 1, 0.00257),
    ).toBeCloseTo(0.00257 / 5, 12);
  });

  it.each(["jupiter", "saturn", "uranus", "neptune"])(
    "never shrinks %s below its physical radius when a moon is nearby",
    (bodyId) => {
      const definition = body(bodyId);
      const physicalRadiusAu = definition.meanRadiusM / 149_597_870_700;

      expect(
        nonOverlappingDisplayedRadiusAu(definition, 0, physicalRadiusAu * 1.5),
      ).toBeCloseTo(physicalRadiusAu, 15);
    },
  );

  it("changes continuously from physical to enhanced radii", () => {
    const earth = body("earth");
    const physical = displayedRadiusAu(earth, 0);
    const midpoint = displayedRadiusAu(earth, 0.5);
    const enhanced = displayedRadiusAu(earth, 1);

    expect(midpoint).toBeCloseTo(Math.sqrt(physical * enhanced), 12);
    expect(midpoint).toBeGreaterThan(physical);
    expect(enhanced).toBeGreaterThan(midpoint);
  });

  it("rejects values outside the declared scale", () => {
    const earth = body("earth");

    expect(() => displayedRadiusAu(earth, -0.01)).toThrow(/between 0 and 1/u);
    expect(() => displayedRadiusAu(earth, 1.01)).toThrow(/between 0 and 1/u);
  });

  it("hides physical bodies smaller than one projected CSS pixel", () => {
    expect(isPhysicalBodyResolvable(0.499)).toBe(false);
    expect(isPhysicalBodyResolvable(0.5)).toBe(true);
  });

  it("rejects invalid projected physical radii", () => {
    expect(() => isPhysicalBodyResolvable(-0.1)).toThrow(
      /finite and non-negative/u,
    );
  });
});
