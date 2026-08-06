import { describe, expect, it } from "vitest";

import {
  interpolateOperationalSpacecraft,
  isOperationalSpacecraftWithinValidity,
  operationalSpacecraftSnapshot,
} from "./operational-spacecraft";

describe("operational spacecraft ephemerides", () => {
  it("reproduces every authoritative sample exactly at its timestamp", () => {
    for (const spacecraft of operationalSpacecraftSnapshot.spacecraft) {
      for (const sample of spacecraft.samples.filter(
        (_, index) =>
          index % Math.max(1, Math.floor(spacecraft.samples.length / 20)) === 0,
      )) {
        const state = interpolateOperationalSpacecraft(
          spacecraft.id,
          sample.timeSeconds,
        );
        expect(state.positionM).toEqual(sample.positionM);
        expect(state.velocityMps).toEqual(sample.velocityMps);
      }
    }
  });

  it("refuses to invent positions outside the published coverage", () => {
    const hubble = operationalSpacecraftSnapshot.spacecraft.find(
      (spacecraft) => spacecraft.id === "hubble",
    );
    expect(hubble).toBeDefined();
    const first = hubble?.samples[0];
    expect(first).toBeDefined();
    expect(
      isOperationalSpacecraftWithinValidity(
        "hubble",
        (first?.timeSeconds ?? 0) - 1,
      ),
    ).toBe(false);
    expect(() =>
      interpolateOperationalSpacecraft("hubble", (first?.timeSeconds ?? 0) - 1),
    ).toThrow(/unavailable/u);
  });
});
