import { describe, expect, it } from "vitest";

import type { SimulationState } from "../physics/contracts";
import {
  FICTIONAL_ORBITERS,
  fictionalOrbiterState,
} from "./fictional-orbiters";

const state: SimulationState = {
  timeSeconds: 0,
  energy: 0,
  bodies: [
    {
      id: "jupiter",
      gravitationalParameterM3S2: 1.266_865_34e17,
      positionM: [0, 0, 0],
      velocityMps: [0, 0, 0],
    },
    {
      id: "callisto",
      gravitationalParameterM3S2: 7.179_304_867 * 1e12,
      positionM: [1_882_700_000, 0, 0],
      velocityMps: [0, 0, 8_204],
    },
    {
      id: "ganymede",
      gravitationalParameterM3S2: 9.887_819_98 * 1e12,
      positionM: [1_070_400_000, 0, 0],
      velocityMps: [0, 0, 10_880],
    },
  ],
};

describe("fictional orbiters", () => {
  it.each(FICTIONAL_ORBITERS)(
    "places $name at the declared physical altitude without gravity",
    (orbiter) => {
      const result = fictionalOrbiterState(state, orbiter);
      const moon = state.bodies.find(
        (body) => body.id === orbiter.parentBodyId,
      );
      expect(moon).toBeDefined();
      const separationM = Math.hypot(
        result.positionM[0] - (moon?.positionM[0] ?? 0),
        result.positionM[1] - (moon?.positionM[1] ?? 0),
        result.positionM[2] - (moon?.positionM[2] ?? 0),
      );
      const moonRadiusM =
        orbiter.parentBodyId === "callisto" ? 2_410_300 : 2_634_100;
      expect(separationM).toBeCloseTo(
        moonRadiusM + orbiter.orbitalAltitudeM,
        3,
      );
      expect(result.gravitationalParameterM3S2).toBe(0);
    },
  );
});
