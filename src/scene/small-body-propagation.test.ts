import { describe, expect, it } from "vitest";

import { propagateSmallBodyPositionAu } from "./small-body-propagation";

describe("small-body propagation authority model", () => {
  it("uses the JPL negative-a convention without mirroring hyperbolic motion", () => {
    const position = propagateSmallBodyPositionAu(
      {
        semiMajorAxisAu: -2,
        eccentricity: 1.5,
        perihelionAu: 1,
        inclinationRad: 0,
        ascendingNodeRad: 0,
        argumentPerihelionRad: 0,
        meanAnomalyAtReferenceRad: 0.5,
        meanMotionRadPerDay: 0,
        flags: 1,
      },
      0,
    );

    expect(position).toBeDefined();
    expect(position?.[0]).toBeCloseTo(0.381_719_402_8, 10);
    expect(position?.[1]).toBeCloseTo(0.751_497_969_9, 10);
    expect(position?.[2]).toBeCloseTo(-1.733_347_168_9, 10);
  });

  it("places a hyperbolic body at perihelion when mean anomaly is zero", () => {
    const position = propagateSmallBodyPositionAu(
      {
        semiMajorAxisAu: -2,
        eccentricity: 1.5,
        perihelionAu: 1,
        inclinationRad: 0,
        ascendingNodeRad: 0,
        argumentPerihelionRad: 0,
        meanAnomalyAtReferenceRad: 0,
        meanMotionRadPerDay: 0,
        flags: 1,
      },
      0,
    );

    expect(position?.[0]).toBeCloseTo(1, 12);
    expect(position?.[1]).toBeCloseTo(0, 12);
    expect(position?.[2]).toBeCloseTo(0, 12);
  });
});
