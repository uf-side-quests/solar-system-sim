import { describe, expect, it } from "vitest";

import type { BodyState } from "./contracts";
import {
  ISS_EPOCH_SIMULATION_SECONDS,
  isIssEphemerisWithinValidity,
  issSnapshot,
  propagateIss,
} from "./iss-ephemeris";
import { EARTH_GRAVITATIONAL_PARAMETER_M3_S2 } from "./solar-system";

const earthAtOrigin: BodyState = {
  id: "earth",
  gravitationalParameterM3S2: EARTH_GRAVITATIONAL_PARAMETER_M3_S2,
  positionM: [0, 0, 0],
  velocityMps: [0, 0, 0],
};

describe("ISS SGP4 ephemeris", () => {
  it("propagates the CelesTrak OMM to a plausible low Earth orbit", () => {
    const state = propagateIss(earthAtOrigin, ISS_EPOCH_SIMULATION_SECONDS);
    const geocentricRadiusM = Math.hypot(...state.positionM);
    const geocentricSpeedMps = Math.hypot(...state.velocityMps);

    expect(geocentricRadiusM).toBeGreaterThan(6_700_000);
    expect(geocentricRadiusM).toBeLessThan(6_900_000);
    expect(geocentricSpeedMps).toBeGreaterThan(7_500);
    expect(geocentricSpeedMps).toBeLessThan(7_800);
    expect(state.gravitationalParameterM3S2).toBe(0);
  });

  it("declares a symmetric seven-day display-validity window", () => {
    const window = issSnapshot.validityWindowSeconds;
    expect(window).toBe(7 * 86_400);
    expect(
      isIssEphemerisWithinValidity(ISS_EPOCH_SIMULATION_SECONDS - window),
    ).toBe(true);
    expect(
      isIssEphemerisWithinValidity(ISS_EPOCH_SIMULATION_SECONDS + window),
    ).toBe(true);
    expect(
      isIssEphemerisWithinValidity(ISS_EPOCH_SIMULATION_SECONDS + window + 1),
    ).toBe(false);
  });

  it("preserves the sourced NASA dimensions", () => {
    expect(issSnapshot.physicalDimensions.overallEndToEndM).toBe(109);
    expect(issSnapshot.physicalDimensions.solarArrayLengthM).toBe(73);
    expect(issSnapshot.physicalDimensions.massKg).toBe(419_725);
  });
});
