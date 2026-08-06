import { describe, expect, it } from "vitest";

import {
  ALPHA_CENTAURI_COMPARISON_AU,
  OORT_CLOUD_INNER_EDGE_MAX_AU,
  OORT_CLOUD_INNER_EDGE_MIN_AU,
  OORT_CLOUD_OUTER_EDGE_MAX_AU,
  OORT_CLOUD_OUTER_EDGE_MIN_AU,
} from "./OuterRegionsScaleScene";

describe("outer Solar System scale diagrams", () => {
  it("keeps the sourced Oort Cloud ranges ordered and below Alpha Centauri", () => {
    expect(OORT_CLOUD_INNER_EDGE_MIN_AU).toBe(2_000);
    expect(OORT_CLOUD_INNER_EDGE_MAX_AU).toBe(5_000);
    expect(OORT_CLOUD_OUTER_EDGE_MIN_AU).toBe(10_000);
    expect(OORT_CLOUD_OUTER_EDGE_MAX_AU).toBe(100_000);
    expect(OORT_CLOUD_INNER_EDGE_MIN_AU).toBeLessThan(
      OORT_CLOUD_INNER_EDGE_MAX_AU,
    );
    expect(OORT_CLOUD_INNER_EDGE_MAX_AU).toBeLessThan(
      OORT_CLOUD_OUTER_EDGE_MIN_AU,
    );
    expect(OORT_CLOUD_OUTER_EDGE_MAX_AU).toBeLessThan(
      ALPHA_CENTAURI_COMPARISON_AU,
    );
  });
});
