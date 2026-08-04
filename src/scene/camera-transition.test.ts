import { describe, expect, it } from "vitest";

import {
  interpolateLogarithmicDistance,
  sampleCameraTransition,
} from "./camera-transition";

describe("camera transition", () => {
  it("travels out, holds the system overview, and returns to the authored shot", () => {
    expect(sampleCameraTransition(0, 3_000)).toEqual({
      phase: "outbound",
      segmentProgress: 0,
    });
    expect(sampleCameraTransition(1_350, 3_000)).toEqual({
      phase: "overview",
      segmentProgress: 1,
    });
    expect(sampleCameraTransition(2_250, 3_000).phase).toBe("inbound");
    expect(sampleCameraTransition(3_000, 3_000)).toEqual({
      phase: "settled",
      segmentProgress: 1,
    });
  });

  it("fails explicitly for invalid timing inputs", () => {
    expect(() => sampleCameraTransition(-1, 3_000)).toThrow(/elapsed/u);
    expect(() => sampleCameraTransition(0, 0)).toThrow(/duration/u);
  });

  it("changes scale geometrically instead of rushing near the close endpoint", () => {
    expect(interpolateLogarithmicDistance(0.001, 100, 0)).toBeCloseTo(0.001);
    expect(interpolateLogarithmicDistance(0.001, 100, 0.5)).toBeCloseTo(
      Math.sqrt(0.001 * 100),
    );
    expect(interpolateLogarithmicDistance(0.001, 100, 1)).toBeCloseTo(100);
  });

  it("rejects invalid logarithmic camera distances", () => {
    expect(() => interpolateLogarithmicDistance(0, 1, 0.5)).toThrow(
      /positive/u,
    );
    expect(() => interpolateLogarithmicDistance(1, Number.NaN, 0.5)).toThrow(
      /positive/u,
    );
    expect(() => interpolateLogarithmicDistance(1, 2, Number.NaN)).toThrow(
      /progress/u,
    );
  });
});
