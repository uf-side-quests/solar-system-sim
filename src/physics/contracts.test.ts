import { describe, expect, it } from "vitest";

import { simulationInitialStateSchema } from "./contracts";

describe("simulation initial state", () => {
  it("rejects non-finite state rather than substituting a value", () => {
    const result = simulationInitialStateSchema.safeParse({
      bodies: [
        {
          id: "earth",
          gravitationalParameterM3S2: Number("3.9860043550702266e14"),
          positionM: [Number.NaN, 0, 0],
          velocityMps: [0, 29_780, 0],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit massless test particles", () => {
    const result = simulationInitialStateSchema.safeParse({
      bodies: [
        {
          id: "test-particle",
          gravitationalParameterM3S2: 0,
          positionM: [1, 2, 3],
          velocityMps: [4, 5, 6],
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
