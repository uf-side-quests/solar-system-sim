import { describe, expect, it } from "vitest";

import {
  ALPHA_CENTAURI_DISTANCE_AU,
  OORT_CLOUD_OUTER_ESTIMATE_AU,
  OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT,
  SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT,
  SOLAR_SYSTEM_TOUR_VIEW_AU,
} from "./InterstellarScaleScene";

describe("interstellar scale scene", () => {
  it("keeps the previous Solar System view at its true linear share", () => {
    expect(SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeCloseTo(
      (SOLAR_SYSTEM_TOUR_VIEW_AU / ALPHA_CENTAURI_DISTANCE_AU) * 100,
      12,
    );
    expect(SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeGreaterThan(0.08);
    expect(SOLAR_SYSTEM_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeLessThan(0.081);
  });

  it("places the possible Oort Cloud edge at its true share of the distance", () => {
    expect(OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeCloseTo(
      (OORT_CLOUD_OUTER_ESTIMATE_AU / ALPHA_CENTAURI_DISTANCE_AU) * 100,
      12,
    );
    expect(OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeGreaterThan(36);
    expect(OORT_CLOUD_SHARE_OF_ALPHA_DISTANCE_PERCENT).toBeLessThan(37);
  });
});
