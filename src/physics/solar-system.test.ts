import { describe, expect, it } from "vitest";

import {
  majorBodySnapshot,
  majorBodySystem,
  naifPhysicalSnapshot,
} from "./solar-system";
import {
  additionalAvailableKnownSatellites,
  availableKnownSatelliteCount,
  knownSatelliteSnapshot,
} from "./known-satellites";

describe("NASA/JPL Horizons major-body snapshot", () => {
  it("contains every planet and the declared major moons", () => {
    const planets = majorBodySnapshot.bodies
      .filter((body) => body.type === "planet")
      .map((body) => body.name);
    const moons = majorBodySnapshot.bodies.filter(
      (body) => body.type === "moon",
    );

    expect(planets).toEqual([
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
    ]);
    expect(moons.length).toBe(21);
    expect(majorBodySnapshot.bodies).toHaveLength(31);
  });

  it("declares a common barycentric ICRF state-vector contract", () => {
    expect(majorBodySnapshot.stateVector).toEqual({
      origin: "Solar System Barycenter",
      frame: "ICRF",
      positionUnits: "m",
      velocityUnits: "m/s",
      corrections: "geometric; no aberration corrections",
    });
  });

  it("uses authority-published gravitational parameters for every massive body", () => {
    expect(Object.keys(naifPhysicalSnapshot.bodies)).toHaveLength(31);
    expect(
      majorBodySystem.bodies.find((body) => body.id === "earth")
        ?.gravitationalParameterM3S2,
    ).toBe(Number("3.9860043550702266e14"));
    expect(
      majorBodySystem.bodies.find((body) => body.id === "moon")
        ?.gravitationalParameterM3S2,
    ).toBe(Number("4.9028001184575496e12"));
  });

  it("retains the complete current Horizons planetary-satellite index", () => {
    expect(knownSatelliteSnapshot.bodies).toHaveLength(459);
    expect(availableKnownSatelliteCount).toBe(458);
    expect(
      knownSatelliteSnapshot.bodies.find((body) => body.name === "Daphnis"),
    ).toMatchObject({
      availability: "unavailable",
      parentId: "saturn",
    });
  });

  it("keeps small moons outside REBOUND while retaining the two massless probes", () => {
    expect(additionalAvailableKnownSatellites).toHaveLength(437);
    expect(majorBodySystem.bodies).toHaveLength(33);
    expect(
      majorBodySystem.bodies.filter(
        (body) => body.gravitationalParameterM3S2 === 0,
      ),
    ).toHaveLength(2);
  });
});
