import { describe, expect, it } from "vitest";

import { majorBodySnapshot } from "../physics/solar-system-data";
import { BODY_COMPOSITION_BY_ID, formatMassKg } from "./body-physical-facts";

describe("selected-body physical facts", () => {
  it("provides sourced composition summaries for every installed major body", () => {
    for (const body of majorBodySnapshot.bodies) {
      const fact = BODY_COMPOSITION_BY_ID[body.id];
      expect(fact, body.name).toBeDefined();
      expect(fact?.authority, body.name).toBe("NASA Science");
      expect(fact?.sourceUrl, body.name).toMatch(
        /^https:\/\/science\.nasa\.gov\//u,
      );
      expect(fact?.summary.length, body.name).toBeGreaterThan(20);
    }
  });

  it("formats catalogue-scale masses without discarding magnitude", () => {
    expect(formatMassKg(5.97217e24)).toBe("5.9722 × 10²⁴ kg");
    expect(formatMassKg(419_725)).toBe("419,725 kg");
    expect(formatMassKg(undefined)).toBe("Not provided by source");
  });
});
