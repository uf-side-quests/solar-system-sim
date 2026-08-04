import { describe, expect, it } from "vitest";

import { majorBodySnapshot } from "../physics/solar-system";
import { focusDistanceAu } from "./camera-focus";

function bodyById(id: string) {
  const body = majorBodySnapshot.bodies.find(
    (candidate) => candidate.id === id,
  );
  if (body === undefined) {
    throw new Error(`Missing test body ${id}`);
  }
  return body;
}

describe("camera focus distance", () => {
  it("fits Earth itself instead of silently framing the Earth-Moon system", () => {
    const earth = bodyById("earth");
    expect(focusDistanceAu(earth, 0)).toBeCloseTo(
      (earth.meanRadiusM / 149_597_870_700) * 4,
      15,
    );
  });

  it("frames a close Moon view", () => {
    const moon = bodyById("moon");
    expect(focusDistanceAu(moon, 0)).toBeCloseTo(
      (moon.meanRadiusM / 149_597_870_700) * 4,
      15,
    );
  });

  it("bounds enhanced-object framing instead of zooming out to the whole system", () => {
    const earth = bodyById("earth");
    const physicalDistance = focusDistanceAu(earth, 0);
    expect(focusDistanceAu(earth, 1)).toBeCloseTo(physicalDistance * 12, 15);
  });

  it("frames Saturn's observed outer ring instead of only its globe", () => {
    const saturn = bodyById("saturn");
    const globeOnlyDistance = (saturn.meanRadiusM / 149_597_870_700) * 4;
    expect(focusDistanceAu(saturn, 0)).toBeGreaterThan(globeOnlyDistance * 2.3);
  });
});
