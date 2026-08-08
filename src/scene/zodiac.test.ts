import { describe, expect, it } from "vitest";

import {
  eclipticDirection,
  eclipticSkyDirection,
  TROPICAL_ZODIAC_SIGNS,
} from "./zodiac";

describe("tropical zodiac sky reference", () => {
  it("defines the familiar twelve equal signs along the ecliptic", () => {
    expect(TROPICAL_ZODIAC_SIGNS).toHaveLength(12);
    expect(TROPICAL_ZODIAC_SIGNS[0]).toEqual({
      name: "Aries",
      glyph: "♈",
      startLongitudeDeg: 0,
      centreLongitudeDeg: 15,
    });
    expect(TROPICAL_ZODIAC_SIGNS.at(-1)?.name).toBe("Pisces");
    expect(TROPICAL_ZODIAC_SIGNS.map((sign) => sign.startLongitudeDeg)).toEqual(
      [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    );
  });

  it("maps sign longitudes onto the unit J2000 ecliptic", () => {
    expect(eclipticDirection(0)).toEqual([1, 0, 0]);
    const quarter = eclipticDirection(90);
    expect(quarter[0]).toBeCloseTo(0, 12);
    expect(quarter[1]).toBeCloseTo(1, 12);
    expect(quarter[2]).toBe(0);
  });

  it("rejects an invalid longitude", () => {
    expect(() => eclipticDirection(Number.NaN)).toThrow(
      "Ecliptic longitude and latitude must be finite",
    );
  });

  it("places readable labels above and below the ecliptic", () => {
    const north = eclipticSkyDirection(0, 12);
    const south = eclipticSkyDirection(180, -12);
    expect(Math.hypot(...north)).toBeCloseTo(1);
    expect(Math.hypot(...south)).toBeCloseTo(1);
    expect(north[2]).toBeGreaterThan(0);
    expect(south[2]).toBeLessThan(0);
  });
});
