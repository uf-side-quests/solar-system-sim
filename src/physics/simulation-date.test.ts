import { describe, expect, it } from "vitest";

import { majorBodySnapshot } from "./solar-system";
import { formatSimulationDateUtc, simulationDateUtc } from "./simulation-date";

describe("simulation UTC date", () => {
  it("converts the TDB model epoch to its corresponding UTC instant", () => {
    expect(majorBodySnapshot.epoch.value).toBe(2_461_041.5);
    expect(simulationDateUtc(0).toISOString()).toBe("2025-12-31T23:58:44.948Z");
  });

  it("formats a compact global timestamp", () => {
    expect(formatSimulationDateUtc(86_400)).toBe("01 Jan 2026 · 23:58:44 UTC");
  });

  it("rejects invalid simulation times", () => {
    expect(() => simulationDateUtc(Number.NaN)).toThrow(
      "Simulation time must be finite",
    );
  });
});
