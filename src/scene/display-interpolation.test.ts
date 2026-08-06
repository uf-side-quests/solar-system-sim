import { describe, expect, it } from "vitest";

import {
  operationalSpacecraftById,
  withOperationalSpacecraft,
} from "../physics/operational-spacecraft";
import { interpolateDisplayedSimulationFrame } from "./display-interpolation";

const sun = {
  id: "sun",
  gravitationalParameterM3S2: 1.327_124_400_412_794_2e20,
  positionM: [0, 0, 0] as const,
  velocityMps: [0, 0, 0] as const,
};

describe("display interpolation", () => {
  it("evaluates operational spacecraft at display time across a coverage boundary", () => {
    const hubble = operationalSpacecraftById.get("hubble");
    const finalSample = hubble?.samples.at(-1);
    if (finalSample === undefined) {
      throw new Error("Hubble coverage endpoint is unavailable");
    }
    const start = withOperationalSpacecraft({
      timeSeconds: finalSample.timeSeconds - 3_600,
      energy: 0,
      bodies: [sun],
    });
    const end = withOperationalSpacecraft({
      timeSeconds: finalSample.timeSeconds + 3_600,
      energy: 0,
      bodies: [sun],
    });
    expect(start.bodies.some((body) => body.id === "hubble")).toBe(true);
    expect(end.bodies.some((body) => body.id === "hubble")).toBe(false);

    const insideCoverage = interpolateDisplayedSimulationFrame(
      { start, end, transitionDurationMs: 1_000 },
      0.25,
    );
    const outsideCoverage = interpolateDisplayedSimulationFrame(
      { start, end, transitionDurationMs: 1_000 },
      0.75,
    );
    expect(insideCoverage.bodies.some((body) => body.id === "hubble")).toBe(
      true,
    );
    expect(outsideCoverage.bodies.some((body) => body.id === "hubble")).toBe(
      false,
    );
  });
});
