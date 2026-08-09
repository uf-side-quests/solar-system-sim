import { describe, expect, it } from "vitest";

import type { SimulationState } from "../physics/contracts";
import {
  DISCOVERY_ONE_ORBITAL_ALTITUDE_M,
  discoveryOneState,
} from "./discovery-one";

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
      velocityMps: [0, 0, 17_334],
    },
  ],
};

describe("Discovery One fictional placement", () => {
  it("uses a massless physical circular orbit around live Io", () => {
    const discovery = discoveryOneState(state);
    const io = state.bodies[1];
    if (io === undefined) throw new Error("Io test state is unavailable");
    expect(
      Math.hypot(
        discovery.positionM[0] - io.positionM[0],
        discovery.positionM[1] - io.positionM[1],
        discovery.positionM[2] - io.positionM[2],
      ),
    ).toBeCloseTo(1_821_600 + DISCOVERY_ONE_ORBITAL_ALTITUDE_M, 3);
    expect(discovery.gravitationalParameterM3S2).toBe(0);
  });
});
