import { describe, expect, it } from "vitest";

import { withKnownSatellites } from "./known-satellite-ephemeris";
import { ISS_BODY_ID } from "./iss-ephemeris";
import {
  additionalAvailableKnownSatellites,
  additionalKnownSatellites,
} from "./known-satellites";
import { OPERATIONAL_SPACECRAFT_BODY_IDS } from "./operational-spacecraft";
import { majorBodySystem } from "./solar-system";

describe("known-satellite display state", () => {
  it("adds every available moon and authoritative spacecraft without dropping integrated probes", () => {
    const state = withKnownSatellites({
      timeSeconds: 0,
      energy: 0,
      bodies: majorBodySystem.bodies,
    });

    expect(state.bodies).toHaveLength(
      majorBodySystem.bodies.length +
        additionalAvailableKnownSatellites.length +
        1 +
        OPERATIONAL_SPACECRAFT_BODY_IDS.length,
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
    expect(state.bodies.some((body) => body.id === "voyager-1")).toBe(true);
    expect(state.bodies.some((body) => body.id === "voyager-2")).toBe(true);
    expect(
      OPERATIONAL_SPACECRAFT_BODY_IDS.every((bodyId) =>
        state.bodies.some((body) => body.id === bodyId),
      ),
    ).toBe(true);
  });
});
