import { describe, expect, it } from "vitest";

import {
  apolloLandingSiteById,
  apolloLandingSites,
  isApolloLandingSiteId,
  moonFixedSurfaceUnitVector,
} from "./lunar-landing-sites";

describe("Apollo lunar landing sites", () => {
  it("installs every crewed Apollo landing and no aborted mission", () => {
    expect(apolloLandingSites.map((site) => site.mission)).toEqual([
      "Apollo 11",
      "Apollo 12",
      "Apollo 14",
      "Apollo 15",
      "Apollo 16",
      "Apollo 17",
    ]);
    expect(apolloLandingSiteById.get("apollo-11-site")).toMatchObject({
      latitudeDeg: 0.67416,
      longitudeDeg: 23.47314,
      lunarModule: "Eagle",
    });
    expect(isApolloLandingSiteId("apollo-13-site")).toBe(false);
  });

  it("maps geodetic coordinates to the same Moon-fixed axes as observers", () => {
    expect(moonFixedSurfaceUnitVector(0, 0)).toEqual([1, 0, -0]);
    const northPole = moonFixedSurfaceUnitVector(90, 80);
    expect(northPole[0]).toBeCloseTo(0, 12);
    expect(northPole[1]).toBeCloseTo(1, 12);
    expect(northPole[2]).toBeCloseTo(0, 12);
    for (const site of apolloLandingSites) {
      expect(
        Math.hypot(
          ...moonFixedSurfaceUnitVector(site.latitudeDeg, site.longitudeDeg),
        ),
      ).toBeCloseTo(1, 12);
    }
  });
});
