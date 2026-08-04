import { describe, expect, it } from "vitest";

import { interpolateBodyState } from "./interpolation";

const body = {
  id: "body",
  gravitationalParameterM3S2: 1,
  positionM: [0, 0, 0] as const,
  velocityMps: [1, 0, 0] as const,
};

describe("physics-state interpolation", () => {
  it("uses exact solver endpoints", () => {
    const end = {
      ...body,
      positionM: [10, 0, 0] as const,
    };
    expect(interpolateBodyState(body, end, 0, 10, 0).positionM).toEqual(
      body.positionM,
    );
    expect(interpolateBodyState(body, end, 0, 10, 1).positionM).toEqual(
      end.positionM,
    );
  });

  it("follows the velocity-constrained Hermite path between states", () => {
    const end = {
      ...body,
      positionM: [10, 0, 0] as const,
    };
    expect(interpolateBodyState(body, end, 0, 10, 0.5).positionM[0]).toBe(5);
  });
});
