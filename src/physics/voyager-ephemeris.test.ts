import { describe, expect, it } from "vitest";

import { ASTRONOMICAL_UNIT_M, majorBodySystem } from "./solar-system";
import {
  VOYAGER_BODY_IDS,
  voyagerById,
  voyagerInitialBodies,
  voyagerSnapshot,
} from "./voyager-ephemeris";

describe("Voyager ephemeris", () => {
  it("installs both probes as massless REBOUND test particles", () => {
    expect(voyagerSnapshot.authority).toBe("NASA/JPL Horizons");
    expect(voyagerInitialBodies.map((body) => body.id)).toEqual(
      VOYAGER_BODY_IDS,
    );
    expect(
      voyagerInitialBodies.every(
        (body) => body.gravitationalParameterM3S2 === 0,
      ),
    ).toBe(true);
    for (const bodyId of VOYAGER_BODY_IDS) {
      expect(majorBodySystem.bodies.some((body) => body.id === bodyId)).toBe(
        true,
      );
    }
  });

  it("uses distinct barycentric states beyond the planetary system", () => {
    const distances = VOYAGER_BODY_IDS.map((bodyId) => {
      const probe = voyagerById.get(bodyId);
      if (probe === undefined) throw new Error(`Missing ${bodyId}`);
      return Math.hypot(...probe.positionM) / ASTRONOMICAL_UNIT_M;
    });
    expect(distances[0]).toBeGreaterThan(160);
    expect(distances[1]).toBeGreaterThan(130);
    expect(distances[0]).not.toBeCloseTo(distances[1] ?? 0, 1);
  });
});
