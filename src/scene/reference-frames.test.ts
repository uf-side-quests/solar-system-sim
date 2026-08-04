import { describe, expect, it } from "vitest";

import {
  J2000_MEAN_OBLIQUITY_RAD,
  icrfToScene,
  j2000EclipticToScene,
} from "./reference-frames";

describe("reference-frame transforms", () => {
  it("maps ICRF axes into the y-up scene without changing handedness", () => {
    expect(icrfToScene({ x: 1, y: 2, z: 3 }).toArray()).toEqual([1, 3, -2]);
  });

  it("rotates J2000 ecliptic positions through the mean obliquity", () => {
    const eclipticNorth = j2000EclipticToScene({ x: 0, y: 0, z: 1 });
    expect(eclipticNorth.x).toBeCloseTo(0, 12);
    expect(eclipticNorth.y).toBeCloseTo(Math.cos(J2000_MEAN_OBLIQUITY_RAD), 12);
    expect(eclipticNorth.z).toBeCloseTo(Math.sin(J2000_MEAN_OBLIQUITY_RAD), 12);
  });
});
