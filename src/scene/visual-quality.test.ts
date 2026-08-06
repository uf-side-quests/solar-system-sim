import { describe, expect, it } from "vitest";

import {
  adaptExposure,
  solarExposureForDistanceAu,
  VISUAL_QUALITY_PROFILES,
} from "./visual-quality";

describe("photographic visual quality", () => {
  it("compensates inverse-square sunlight when a camera focuses farther out", () => {
    const earth = solarExposureForDistanceAu("photographic", 1);
    const jupiter = solarExposureForDistanceAu("photographic", 5.2);
    expect(jupiter / earth).toBeCloseTo(5.2 ** 2, 10);
  });

  it("does not auto-expose an unfocused system overview", () => {
    expect(solarExposureForDistanceAu("balanced", undefined)).toBe(
      VISUAL_QUALITY_PROFILES.balanced.baseExposure,
    );
  });

  it("adapts halfway to a new exposure in one configured half-life", () => {
    expect(adaptExposure(1, 9, 0.6, 0.6)).toBeCloseTo(5, 12);
  });

  it("rejects invalid exposure inputs rather than displaying a plausible frame", () => {
    expect(() => solarExposureForDistanceAu("photographic", 0)).toThrow(
      "Solar exposure distance must be positive and finite",
    );
    expect(() => adaptExposure(1, Number.NaN, 1, 1)).toThrow(
      "Target exposure must be positive and finite",
    );
  });
});
