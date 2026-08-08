import { describe, expect, it } from "vitest";

import {
  discreteRingSystemExtent,
  JUPITER_EQUATORIAL_RADIUS_KM,
  JUPITER_RINGS,
  NEPTUNE_EQUATORIAL_RADIUS_KM,
  NEPTUNE_RINGS,
  ringRadiusRatio,
  SATURN_EQUATORIAL_RADIUS_KM,
  SATURN_MAIN_RING_INNER_RADIUS_KM,
  SATURN_MAIN_RING_OUTER_RADIUS_KM,
  URANUS_EQUATORIAL_RADIUS_KM,
  URANUS_MAIN_RING_OUTER_RADIUS_KM,
  URANUS_RING_INNER_RADIUS_KM,
  URANUS_RING_OUTER_RADIUS_KM,
  URANUS_RINGS,
} from "./ring-system";

describe("ring-system physical dimensions", () => {
  it("keeps Saturn's observed main-ring profile outside the globe", () => {
    expect(
      ringRadiusRatio(
        SATURN_MAIN_RING_INNER_RADIUS_KM,
        SATURN_EQUATORIAL_RADIUS_KM,
      ),
    ).toBeCloseTo(1.2372, 4);
    expect(
      ringRadiusRatio(
        SATURN_MAIN_RING_OUTER_RADIUS_KM,
        SATURN_EQUATORIAL_RADIUS_KM,
      ),
    ).toBeCloseTo(2.2695, 4);
  });

  it("models Uranus as thirteen measured rings rather than a filled annulus", () => {
    expect(URANUS_RINGS.map((ring) => ring.name)).toEqual([
      "Zeta",
      "6",
      "5",
      "4",
      "Alpha",
      "Beta",
      "Eta",
      "Gamma",
      "Delta",
      "Lambda",
      "Epsilon",
      "Nu",
      "Mu",
    ]);
    expect(URANUS_RINGS.find((ring) => ring.name === "6")?.widthKm).toBe(1.5);
    expect(URANUS_RINGS.find((ring) => ring.name === "Epsilon")?.widthKm).toBe(
      58,
    );
    expect(URANUS_RINGS.find((ring) => ring.name === "Nu")?.color).toBe("red");
    expect(URANUS_RINGS.find((ring) => ring.name === "Mu")?.color).toBe("blue");
  });

  it("uses the diffuse outer Mu ring as Uranus's true ring extent", () => {
    expect(URANUS_MAIN_RING_OUTER_RADIUS_KM).toBe(51_178);
    expect(URANUS_RING_INNER_RADIUS_KM).toBe(37_850);
    expect(URANUS_RING_OUTER_RADIUS_KM).toBe(106_200);
    expect(
      ringRadiusRatio(URANUS_RING_OUTER_RADIUS_KM, URANUS_EQUATORIAL_RADIUS_KM),
    ).toBeCloseTo(4.1551, 4);
  });

  it("models Jupiter's five overlapping PDS dust components", () => {
    expect(JUPITER_RINGS.map((ring) => ring.name)).toEqual([
      "Halo",
      "Main",
      "Amalthea gossamer",
      "Thebe gossamer",
      "Thebe extension",
    ]);
    expect(
      discreteRingSystemExtent({
        equatorialRadiusKm: JUPITER_EQUATORIAL_RADIUS_KM,
        rings: JUPITER_RINGS,
      }),
    ).toEqual({ innerRadiusKm: 100_000, outerRadiusKm: 270_000 });
    expect(JUPITER_RINGS.at(-1)?.opticalDepth).toBe(0.000_000_001);
  });

  it("models Neptune's five named main rings at measured radii", () => {
    expect(NEPTUNE_RINGS.map((ring) => ring.name)).toEqual([
      "Galle",
      "Le Verrier",
      "Lassell",
      "Arago enhancement",
      "Adams",
    ]);
    expect(
      ringRadiusRatio(
        NEPTUNE_RINGS.at(-1)?.radiusKm ?? 0,
        NEPTUNE_EQUATORIAL_RADIUS_KM,
      ),
    ).toBeCloseTo(2.5413, 4);
  });

  it("rejects invalid physical radii", () => {
    expect(() => ringRadiusRatio(0, 1)).toThrow(
      "Ring and equatorial radii must be positive and finite",
    );
  });
});
