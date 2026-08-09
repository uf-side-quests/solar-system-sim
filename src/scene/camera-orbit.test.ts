import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import {
  circularOrbitSolution,
  defaultOrbitConfiguration,
  hillSphereRadiusM,
  orbitConfigurationForPreset,
  orbitNormalForInclination,
  orbitRadialDirection,
  poweredHoverAccelerationMps2,
  synchronousOrbitAltitudeM,
} from "./camera-orbit";

const EARTH = {
  radiusM: 6_378_137,
  gravitationalParameterM3S2: 3.986_004_418e14,
  siderealRotationRateRadPerSecond: (Math.PI * 2) / 86_164.0905,
  hillSphereRadiusM: 1.47e9,
} as const;

describe("physical camera orbit", () => {
  it("derives circular speed and period from gravity and radius", () => {
    const orbit = circularOrbitSolution(
      EARTH.gravitationalParameterM3S2,
      EARTH.radiusM,
      400_000,
    );

    expect(orbit.speedMps).toBeCloseTo(7_668.56, 1);
    expect(orbit.periodSeconds / 60).toBeCloseTo(92.56, 1);
  });

  it("derives Earth's geostationary altitude from sidereal rotation", () => {
    expect(synchronousOrbitAltitudeM(EARTH) / 1_000).toBeCloseTo(35_786, 0);
  });

  it("rejects a synchronous orbit outside a moon's Hill region", () => {
    expect(() =>
      synchronousOrbitAltitudeM({
        radiusM: 1_737_400,
        gravitationalParameterM3S2: 4.9028e12,
        siderealRotationRateRadPerSecond: (Math.PI * 2) / (27.321_661 * 86_400),
        hillSphereRadiusM: 61_500_000,
      }),
    ).toThrow("outside the stable Hill region");
  });

  it("keeps powered hover separate from free-fall orbital speed", () => {
    expect(
      poweredHoverAccelerationMps2(
        EARTH.gravitationalParameterM3S2,
        EARTH.radiusM,
        400_000,
      ),
    ).toBeCloseTo(8.676, 2);
  });

  it("computes a Hill sphere from the live parent separation", () => {
    const radius = hillSphereRadiusM(
      149_597_870_700,
      EARTH.gravitationalParameterM3S2,
      1.327_124_400_18e20,
    );
    expect(radius / 1_000_000_000).toBeCloseTo(1.5, 1);
  });

  it("maps equatorial and polar presets to physical inclinations", () => {
    const initial = defaultOrbitConfiguration(EARTH);
    expect(
      orbitConfigurationForPreset("equatorial", EARTH, initial).inclinationDeg,
    ).toBe(0);
    expect(
      orbitConfigurationForPreset("polar", EARTH, initial).inclinationDeg,
    ).toBe(90);
  });

  it("constructs radial directions in the requested orbital plane", () => {
    const normal = orbitNormalForInclination(
      new Vector3(0, 1, 0),
      new Vector3(1, 0, 0),
      90,
    );
    const radial = orbitRadialDirection(
      normal,
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 1),
      Math.PI / 2,
    );

    expect(Math.abs(normal.dot(radial))).toBeLessThan(1e-12);
    expect(radial.length()).toBeCloseTo(1, 12);
  });
});
