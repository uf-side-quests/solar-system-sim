import { describe, expect, it } from "vitest";

import type { SimulationState } from "../physics/contracts";
import {
  JOVIAN_MONOLITH_DIMENSIONS_M,
  jovianMonolithState,
} from "./jovian-monolith";

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
      id: "io",
      gravitationalParameterM3S2: 5.959_916e12,
      positionM: [421_700_000, 0, 0],
      velocityMps: [0, 17_334, 0],
    },
  ],
};

describe("Jovian monolith", () => {
  it("retains the stated two-kilometre 1:4:9 dimensions", () => {
    expect(JOVIAN_MONOLITH_DIMENSIONS_M.length).toBe(2_000);
    expect(
      JOVIAN_MONOLITH_DIMENSIONS_M.width /
        JOVIAN_MONOLITH_DIMENSIONS_M.thickness,
    ).toBeCloseTo(4);
    expect(
      JOVIAN_MONOLITH_DIMENSIONS_M.length /
        JOVIAN_MONOLITH_DIMENSIONS_M.thickness,
    ).toBeCloseTo(9);
  });

  it("places the display-only object between Jupiter and Io near Io L1", () => {
    const monolith = jovianMonolithState(state);
    expect(monolith.gravitationalParameterM3S2).toBe(0);
    expect(monolith.positionM[0]).toBeGreaterThan(0);
    expect(monolith.positionM[0]).toBeLessThan(421_700_000);
    expect(421_700_000 - monolith.positionM[0]).toBeGreaterThan(10_000_000);
    expect(421_700_000 - monolith.positionM[0]).toBeLessThan(20_000_000);
  });

  it("fails explicitly when the live Jupiter-Io state is incomplete", () => {
    expect(() =>
      jovianMonolithState({ ...state, bodies: state.bodies.slice(0, 1) }),
    ).toThrow(/requires io physics state/u);
  });
});
