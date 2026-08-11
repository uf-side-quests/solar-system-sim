import { describe, expect, it } from "vitest";

import type { SimulationState } from "../physics/contracts";
import {
  DEEP_SPACE_NINE_ORBITAL_ALTITUDE_M,
  deepSpaceNineState,
  USS_DEFIANT_PATROL_PERIOD_SECONDS,
  USS_DEFIANT_PATROL_RADIUS_M,
  ussDefiantPatrolPhaseRad,
  ussDefiantState,
} from "./deep-space-nine";

const baseState: SimulationState = {
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
      gravitationalParameterM3S2: 7.179_304_867e12,
      positionM: [1_882_700_000, 0, 0],
      velocityMps: [0, 0, 8_204],
    },
  ],
};

describe("Deep Space Nine fictional exhibit", () => {
  it("uses Callisto gravity for the massless station orbit", () => {
    const station = deepSpaceNineState(baseState);
    const callisto = baseState.bodies[1];
    if (callisto === undefined) {
      throw new Error("Callisto test state is unavailable");
    }
    expect(
      Math.hypot(
        station.positionM[0] - callisto.positionM[0],
        station.positionM[1] - callisto.positionM[1],
        station.positionM[2] - callisto.positionM[2],
      ),
    ).toBeCloseTo(2_410_300 + DEEP_SPACE_NINE_ORBITAL_ALTITUDE_M, 3);
    expect(station.gravitationalParameterM3S2).toBe(0);
  });

  it("keeps the scripted Defiant patrol at its declared radius", () => {
    const station = deepSpaceNineState(baseState);
    const defiant = ussDefiantState(baseState);
    expect(
      Math.hypot(
        defiant.positionM[0] - station.positionM[0],
        defiant.positionM[1] - station.positionM[1],
        defiant.positionM[2] - station.positionM[2],
      ),
    ).toBeCloseTo(USS_DEFIANT_PATROL_RADIUS_M, 5);
    expect(defiant.gravitationalParameterM3S2).toBe(0);
  });

  it("completes one patrol after the declared period", () => {
    const initialPhase = ussDefiantPatrolPhaseRad(0);
    const completedPhase = ussDefiantPatrolPhaseRad(
      USS_DEFIANT_PATROL_PERIOD_SECONDS,
    );
    expect(completedPhase - initialPhase).toBeCloseTo(2 * Math.PI, 12);
  });
});
