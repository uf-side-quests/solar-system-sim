import { describe, expect, it } from "vitest";

import { additionalAvailableKnownSatellites } from "./known-satellites";
import { majorBodySnapshot, naifPhysicalSnapshot } from "./solar-system";
import {
  propagateKnownSatellite,
  propagateTwoBody,
} from "./two-body-propagator";

const earthPhysical = naifPhysicalSnapshot.bodies["earth"];
if (earthPhysical === undefined) {
  throw new Error("Missing Earth physical constants in the NAIF snapshot");
}
const EARTH_GM = earthPhysical.gravitationalParameterM3S2;
const RADIUS_M = 7_000_000;
const CIRCULAR_SPEED_MPS = Math.sqrt(EARTH_GM / RADIUS_M);
const PERIOD_SECONDS = (2 * Math.PI * RADIUS_M) / CIRCULAR_SPEED_MPS;
const initial = {
  positionM: [RADIUS_M, 0, 0] as const,
  velocityMps: [0, CIRCULAR_SPEED_MPS, 0] as const,
};

describe("universal-variable two-body propagation", () => {
  it("returns to the initial circular state after one period", () => {
    const result = propagateTwoBody(initial, EARTH_GM, PERIOD_SECONDS);
    expect(result.positionM[0]).toBeCloseTo(initial.positionM[0], 5);
    expect(result.positionM[1]).toBeCloseTo(initial.positionM[1], 5);
    expect(result.velocityMps[0]).toBeCloseTo(initial.velocityMps[0], 8);
    expect(result.velocityMps[1]).toBeCloseTo(initial.velocityMps[1], 8);
  });

  it("is symmetric for positive and negative quarter periods", () => {
    const forward = propagateTwoBody(initial, EARTH_GM, PERIOD_SECONDS / 4);
    const backward = propagateTwoBody(initial, EARTH_GM, -PERIOD_SECONDS / 4);
    expect(forward.positionM[0]).toBeCloseTo(0, 5);
    expect(backward.positionM[0]).toBeCloseTo(0, 5);
    expect(forward.positionM[1]).toBeCloseTo(-backward.positionM[1], 5);
    expect(forward.velocityMps[0]).toBeCloseTo(-backward.velocityMps[0], 8);
  });

  it("produces finite forward and backward states for all 437 small moons", () => {
    const parents = new Map(
      majorBodySnapshot.bodies.map((body) => [
        body.id,
        {
          id: body.id,
          gravitationalParameterM3S2:
            naifPhysicalSnapshot.bodies[body.id]?.gravitationalParameterM3S2 ??
            (() => {
              throw new Error(`Missing test parent GM for ${body.id}`);
            })(),
          positionM: body.positionM,
          velocityMps: body.velocityMps,
        },
      ]),
    );
    for (const definition of additionalAvailableKnownSatellites) {
      const parent = parents.get(definition.parentId);
      if (parent === undefined) {
        throw new Error(`Missing test parent for ${definition.name}`);
      }
      for (const elapsedSeconds of [-365 * 86_400, 365 * 86_400]) {
        const result = propagateKnownSatellite(
          {
            definition,
            parentInitialState: parent,
            parentGravitationalParameterM3S2: parent.gravitationalParameterM3S2,
          },
          parent,
          elapsedSeconds,
        );
        expect(
          [...result.positionM, ...result.velocityMps].every(Number.isFinite),
        ).toBe(true);
      }
    }
  });
});
