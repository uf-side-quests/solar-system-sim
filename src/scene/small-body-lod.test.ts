import { describe, expect, it } from "vitest";

import {
  categoryVisibilityFraction,
  effectiveSmallBodyPointOpacity,
  smallBodyLevelOfDetail,
} from "./small-body-lod";

describe("small-body level of detail", () => {
  it("reveals more catalogue positions as the camera approaches", () => {
    const distant = smallBodyLevelOfDetail(140);
    const initial = smallBodyLevelOfDetail(70);
    const close = smallBodyLevelOfDetail(10);

    expect(distant.visibilityFraction).toBeLessThan(initial.visibilityFraction);
    expect(initial.visibilityFraction).toBeLessThan(close.visibilityFraction);
    expect(close.pointOpacity).toBeLessThan(initial.pointOpacity);
  });

  it("bounds sampling while rejecting invalid camera distances", () => {
    expect(smallBodyLevelOfDetail(0.01).visibilityFraction).toBe(1);
    expect(smallBodyLevelOfDetail(1_000_000).visibilityFraction).toBe(0.00025);
    expect(() => smallBodyLevelOfDetail(0)).toThrow(/positive finite/u);
  });

  it("keeps sparse categories perceptible without changing their positions", () => {
    const baseFraction = smallBodyLevelOfDetail(90).visibilityFraction;
    const asteroidFraction = categoryVisibilityFraction(
      baseFraction,
      1_554_071,
      1_024,
    );
    const cometFraction = categoryVisibilityFraction(
      baseFraction,
      4_069,
      1_024,
    );

    expect(asteroidFraction).toBe(baseFraction);
    expect(cometFraction).toBeCloseTo(1_024 / 4_069);
    expect(cometFraction * 4_069).toBeCloseTo(1_024, 10);
  });

  it("validates category sampling inputs", () => {
    expect(() => categoryVisibilityFraction(-0.1, 10, 1)).toThrow(
      /between zero and one/u,
    );
    expect(() => categoryVisibilityFraction(0.1, 0, 1)).toThrow(
      /positive integer/u,
    );
    expect(() => categoryVisibilityFraction(0.1, 10, -1)).toThrow(
      /non-negative integer/u,
    );
  });

  it("keeps a spatially filtered focus region legible", () => {
    expect(effectiveSmallBodyPointOpacity(0.15, 0.05)).toBe(0.4);
    expect(effectiveSmallBodyPointOpacity(0.7, 0.05)).toBe(0.7);
    expect(effectiveSmallBodyPointOpacity(0.15, 0)).toBe(0.15);
    expect(() => effectiveSmallBodyPointOpacity(1.1, 0.05)).toThrow(
      /between zero and one/u,
    );
    expect(() => effectiveSmallBodyPointOpacity(0.5, -0.05)).toThrow(
      /non-negative/u,
    );
  });
});
