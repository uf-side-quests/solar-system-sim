import { describe, expect, it } from "vitest";

import type { BodyState, SimulationState } from "../physics/contracts";
import { nearestPlanetWayfinders, wayfinderPlanetCount } from "./wayfinder";

function body(id: string, xM: number): BodyState {
  return {
    id,
    gravitationalParameterM3S2: 0,
    positionM: [xM, 0, 0],
    velocityMps: [0, 0, 0],
  };
}

const state: SimulationState = {
  timeSeconds: 0,
  energy: 0,
  bodies: [
    body("sun", 0),
    body("mercury", 10),
    body("venus", 20),
    body("earth", 25),
    body("mars", 70),
    body("jupiter", 500),
    body("saturn", 900),
    body("uranus", 1_900),
    body("neptune", 3_000),
  ],
};

describe("planet wayfinders", () => {
  it("maps each presentation mode to its requested planet count", () => {
    expect(wayfinderPlanetCount("off")).toBe(0);
    expect(wayfinderPlanetCount("sun")).toBe(0);
    expect(wayfinderPlanetCount("sun-planet")).toBe(1);
    expect(wayfinderPlanetCount("sun-two-planets")).toBe(2);
  });

  it("orders planets by live three-dimensional distance and excludes the origin", () => {
    expect(nearestPlanetWayfinders(state, "earth", 2)).toEqual([
      { bodyId: "venus", distanceM: 5 },
      { bodyId: "mercury", distanceM: 15 },
    ]);
  });

  it("fails when a required physics state is unavailable", () => {
    expect(() => nearestPlanetWayfinders(state, "moon", 1)).toThrow(
      "Wayfinder origin moon is unavailable",
    );
    expect(() =>
      nearestPlanetWayfinders(
        {
          ...state,
          bodies: state.bodies.filter((entry) => entry.id !== "mars"),
        },
        "earth",
        2,
      ),
    ).toThrow("Wayfinder planet mars is unavailable");
  });
});
