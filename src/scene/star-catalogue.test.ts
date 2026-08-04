import { describe, expect, it } from "vitest";

import {
  hipparcosStarSnapshot,
  starDirectionIcrs,
  starDisplayColor,
  starDisplayOpacity,
  starDisplaySizeCssPixels,
} from "./star-catalogue";

describe("Hipparcos visible-star snapshot", () => {
  it("contains the complete naked-eye magnitude selection including Sirius", () => {
    expect(hipparcosStarSnapshot.stars).toHaveLength(8_789);
    expect(hipparcosStarSnapshot.stars[0]).toMatchObject({
      hipId: 32_349,
      visualMagnitude: -1.44,
    });
    expect(
      new Set(hipparcosStarSnapshot.stars.map((star) => star.hipId)).size,
    ).toBe(hipparcosStarSnapshot.stars.length);
  });

  it("maps catalogue ICRS coordinates to a unit direction at J1991.25", () => {
    const sirius = hipparcosStarSnapshot.stars[0];
    if (sirius === undefined) {
      throw new Error("Sirius is unavailable");
    }
    const direction = starDirectionIcrs(sirius, 1991.25);
    expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
    expect(direction).toEqual([
      expect.closeTo(-0.187_481, 5),
      expect.closeTo(0.939_228, 5),
      expect.closeTo(-0.287_58, 5),
    ]);
  });

  it("applies measured proper motion without changing direction length", () => {
    const sirius = hipparcosStarSnapshot.stars[0];
    if (sirius === undefined) {
      throw new Error("Sirius is unavailable");
    }
    const atCatalogueEpoch = starDirectionIcrs(sirius, 1991.25);
    const atSimulationEpoch = starDirectionIcrs(sirius, 2026);
    expect(atSimulationEpoch).not.toEqual(atCatalogueEpoch);
    expect(Math.hypot(...atSimulationEpoch)).toBeCloseTo(1, 12);
  });

  it("maps measured B-V colour toward blue or warm display colour", () => {
    const blue = starDisplayColor(-0.4);
    const warm = starDisplayColor(2);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });

  it("gives brighter stars greater point size and opacity", () => {
    expect(starDisplaySizeCssPixels(-1.44)).toBe(5.5);
    expect(starDisplaySizeCssPixels(6.5)).toBeGreaterThanOrEqual(1.1);
    expect(starDisplaySizeCssPixels(-1)).toBeGreaterThan(
      starDisplaySizeCssPixels(6),
    );
    expect(starDisplayOpacity(-1)).toBeGreaterThan(starDisplayOpacity(6));
  });

  it("rejects invalid display magnitudes", () => {
    expect(() => starDisplaySizeCssPixels(Number.NaN)).toThrow(/finite/u);
    expect(() => starDisplayOpacity(Number.POSITIVE_INFINITY)).toThrow(
      /finite/u,
    );
  });
});
