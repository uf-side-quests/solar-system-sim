import { describe, expect, it } from "vitest";

import type { BodyState } from "../physics/contracts";
import { osculatingOrbitPositionsM } from "./osculating-orbit";

const parent: BodyState = {
  id: "sun",
  gravitationalParameterM3S2: 1,
  positionM: [0, 0, 0],
  velocityMps: [0, 0, 0],
};

describe("osculating orbit", () => {
  it("reconstructs a circular orbit from the instantaneous physics state", () => {
    const body: BodyState = {
      id: "planet",
      gravitationalParameterM3S2: 0,
      positionM: [4, 0, 0],
      velocityMps: [0, 0.5, 0],
    };

    const points = osculatingOrbitPositionsM(body, parent, 64);

    expect(points).toHaveLength(64);
    for (const point of points) {
      expect(Math.hypot(...point)).toBeCloseTo(4, 10);
    }
  });

  it("rejects an invalid point count rather than weakening the orbit", () => {
    const body: BodyState = {
      id: "planet",
      gravitationalParameterM3S2: 0,
      positionM: [4, 0, 0],
      velocityMps: [0, 0.5, 0],
    };

    expect(() => osculatingOrbitPositionsM(body, parent, 8)).toThrow(
      "at least 32 points",
    );
  });

  it("derives an eccentric ellipse from position and velocity instead of drawing a decorative circle", () => {
    const body: BodyState = {
      id: "comet-like-body",
      gravitationalParameterM3S2: 0,
      positionM: [2, 0, 0],
      velocityMps: [0, Math.sqrt(0.75), 0],
    };

    const radii = osculatingOrbitPositionsM(body, parent, 192).map((point) =>
      Math.hypot(...point),
    );

    expect(Math.min(...radii)).toBeCloseTo(2, 10);
    expect(Math.max(...radii)).toBeCloseTo(6, 10);
  });
});
