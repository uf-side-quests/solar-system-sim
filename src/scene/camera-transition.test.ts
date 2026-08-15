import { describe, expect, it } from "vitest";

import {
  formatViewpointSpeed,
  interpolateLogarithmicDistance,
  sampleDirectCameraTransition,
  sampleOrientationTransition,
} from "./camera-transition";

describe("camera transition", () => {
  it("labels camera speed honestly across terrestrial and superluminal scales", () => {
    expect(formatViewpointSpeed(125)).toBe("125 m/s");
    expect(formatViewpointSpeed(12_500)).toBe("12.5 km/s");
    expect(formatViewpointSpeed(299_792_458 * 2.5)).toBe("2.5× light speed");
    expect(() => formatViewpointSpeed(-1)).toThrow(/non-negative/u);
  });

  it("eases a local orientation change without overshoot", () => {
    expect(sampleOrientationTransition(0, 1_200)).toEqual({
      settled: false,
      progress: 0,
    });
    expect(sampleOrientationTransition(600, 1_200).progress).toBe(0.5);
    expect(sampleOrientationTransition(1_200, 1_200)).toEqual({
      settled: true,
      progress: 1,
    });
  });

  it("rejects invalid local orientation timing", () => {
    expect(() => sampleOrientationTransition(-1, 1_200)).toThrow(/elapsed/u);
    expect(() => sampleOrientationTransition(0, 0)).toThrow(/duration/u);
  });

  it("turns, travels on one route, and settles into the selected shot", () => {
    expect(sampleDirectCameraTransition(0, 3_000)).toEqual({
      phase: "orienting",
      segmentProgress: 0,
    });
    expect(sampleDirectCameraTransition(1_500, 3_000).phase).toBe("travelling");
    expect(sampleDirectCameraTransition(2_400, 3_000).phase).toBe("arriving");
    expect(sampleDirectCameraTransition(3_000, 3_000)).toEqual({
      phase: "settled",
      segmentProgress: 1,
    });
  });

  it("continues along the direct route without an overview stop", () => {
    const early = sampleDirectCameraTransition(1_650, 3_000);
    const late = sampleDirectCameraTransition(2_100, 3_000);
    expect(early.phase).toBe("travelling");
    expect(late.phase).toBe("travelling");
    expect(late.segmentProgress).toBeGreaterThan(early.segmentProgress);
  });

  it("fails explicitly for invalid timing inputs", () => {
    expect(() => sampleDirectCameraTransition(-1, 3_000)).toThrow(/elapsed/u);
    expect(() => sampleDirectCameraTransition(0, 0)).toThrow(/duration/u);
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

  it("turns toward a manual destination before travelling directly to it", () => {
    expect(sampleDirectCameraTransition(0, 12_000)).toEqual({
      phase: "orienting",
      segmentProgress: 0,
    });
    expect(sampleDirectCameraTransition(4_000, 12_000).phase).toBe("orienting");
    expect(sampleDirectCameraTransition(6_000, 12_000).phase).toBe(
      "travelling",
    );
    expect(sampleDirectCameraTransition(10_000, 12_000).phase).toBe("arriving");
    expect(sampleDirectCameraTransition(12_000, 12_000)).toEqual({
      phase: "settled",
      segmentProgress: 1,
    });
  });

  it("reserves the final third of a direct flight for arrival", () => {
    const travelling = sampleDirectCameraTransition(8_000, 12_000);
    const arriving = sampleDirectCameraTransition(10_000, 12_000);
    expect(travelling.phase).toBe("travelling");
    expect(arriving.phase).toBe("arriving");
    expect(arriving.segmentProgress).toBeGreaterThan(
      travelling.segmentProgress,
    );
    expect(arriving.segmentProgress).toBeLessThan(1);
  });

  it("rejects invalid direct-flight timing", () => {
    expect(() => sampleDirectCameraTransition(-1, 12_000)).toThrow(/elapsed/u);
    expect(() => sampleDirectCameraTransition(0, 0)).toThrow(/duration/u);
  });
});
