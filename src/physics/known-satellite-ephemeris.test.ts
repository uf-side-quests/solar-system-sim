import { describe, expect, it } from "vitest";

import { withKnownSatellites } from "./known-satellite-ephemeris";
import { ISS_BODY_ID } from "./iss-ephemeris";
import {
  additionalAvailableKnownSatellites,
  additionalKnownSatellites,
} from "./known-satellites";
import { majorBodySystem } from "./solar-system";

describe("known-satellite display state", () => {
  it("adds every available indexed moon and the ISS", () => {
    const state = withKnownSatellites({
      timeSeconds: 0,
      energy: 0,
      bodies: majorBodySystem.bodies,
    });

    expect(state.bodies).toHaveLength(
      majorBodySystem.bodies.length +
        additionalAvailableKnownSatellites.length +
        1,
    );
    expect(
      additionalAvailableKnownSatellites.every((satellite) =>
        state.bodies.some((body) => body.id === satellite.id),
      ),
    ).toBe(true);
    expect(
      additionalKnownSatellites
        .filter((satellite) => satellite.availability === "unavailable")
        .some((satellite) =>
          state.bodies.some((body) => body.id === satellite.id),
        ),
    ).toBe(false);
    expect(state.bodies.some((body) => body.id === ISS_BODY_ID)).toBe(true);
  });
});
