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

  it("installs the bounded JPL Roadster solution rather than extrapolating it", () => {
    const roadster = operationalSpacecraftSnapshot.spacecraft.find(
      (spacecraft) => spacecraft.id === "roadster",
    );
    expect(roadster).toBeDefined();
    expect(roadster?.command).toBe("-143205");
    expect(roadster?.massKg).toBe(1_250);
    expect(roadster?.maximumDimensionM).toBe(3.946);
    expect(roadster?.samples).toHaveLength(5_253);

    const first = roadster?.samples.at(0);
    const last = roadster?.samples.at(-1);
    expect(first?.timeSeconds).toBe(-249_253_200);
    expect(last?.timeSeconds).toBe(2_019_610_800);
    expect(
      isOperationalSpacecraftWithinValidity(
        "roadster",
        first?.timeSeconds ?? Number.NaN,
      ),
    ).toBe(true);
    expect(
      isOperationalSpacecraftWithinValidity(
        "roadster",
        (last?.timeSeconds ?? Number.NaN) + 1,
      ),
    ).toBe(false);
  });
});
