export type DiscreteRing = Readonly<{
  name: string;
  radiusKm: number;
  widthKm: number;
  opticalDepth: number;
  color: "grey" | "red" | "blue" | "dust";
}>;

export type RingSystem = Readonly<{
  equatorialRadiusKm: number;
  rings: readonly DiscreteRing[];
}>;

export const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
export const SATURN_POLAR_RADIUS_KM = 54_364;
export const SATURN_MAIN_RING_INNER_RADIUS_KM = 74_565;
export const SATURN_MAIN_RING_OUTER_RADIUS_KM = 136_780;

export const URANUS_EQUATORIAL_RADIUS_KM = 25_559;
export const URANUS_POLAR_RADIUS_KM = 24_973;

// Radii, widths and normal optical depths are from the NASA PDS Ring-Moon
// Systems Node. Width ranges are represented by their midpoint. Zeta, Nu and
// Mu are broad diffuse rings; the remaining entries are narrow main rings.
export const URANUS_RINGS: readonly DiscreteRing[] = [
  {
    name: "Zeta",
    radiusKm: 39_600,
    widthKm: 3_500,
    opticalDepth: 0.0045,
    color: "grey",
  },
  {
    name: "6",
    radiusKm: 41_837,
    widthKm: 1.5,
    opticalDepth: 0.3,
    color: "grey",
  },
  {
    name: "5",
    radiusKm: 42_234,
    widthKm: 2,
    opticalDepth: 0.5,
    color: "grey",
  },
  {
    name: "4",
    radiusKm: 42_571,
    widthKm: 2,
    opticalDepth: 0.3,
    color: "grey",
  },
  {
    name: "Alpha",
    radiusKm: 44_718,
    widthKm: 7,
    opticalDepth: 0.4,
    color: "grey",
  },
  {
    name: "Beta",
    radiusKm: 45_661,
    widthKm: 8,
    opticalDepth: 0.3,
    color: "grey",
  },
  {
    name: "Eta",
    radiusKm: 47_176,
    widthKm: 1.6,
    opticalDepth: 0.4,
    color: "grey",
  },
  {
    name: "Gamma",
    radiusKm: 47_627,
    widthKm: 2.5,
    opticalDepth: 0.3,
    color: "grey",
  },
  {
    name: "Delta",
    radiusKm: 48_300,
    widthKm: 5,
    opticalDepth: 0.5,
    color: "grey",
  },
  {
    name: "Lambda",
    radiusKm: 50_024,
    widthKm: 2,
    opticalDepth: 0.1,
    color: "grey",
  },
  {
    name: "Epsilon",
    radiusKm: 51_149,
    widthKm: 58,
    opticalDepth: 1.4,
    color: "grey",
  },
  {
    name: "Nu",
    radiusKm: 67_300,
    widthKm: 3_800,
    opticalDepth: 0.000_006,
    color: "red",
  },
  {
    name: "Mu",
    radiusKm: 97_700,
    widthKm: 17_000,
    opticalDepth: 0.000_008,
    color: "blue",
  },
] as const;

export const JUPITER_EQUATORIAL_RADIUS_KM = 71_492;
export const JUPITER_POLAR_RADIUS_KM = 66_854;

// Boundaries and normal optical depths are from the NASA PDS Ring-Moon
// Systems Node. The halo and gossamer components overlap radially because
// they are distinct vertically extended dust populations rather than painted
// annuli. Their tiny optical depths intentionally make them difficult to see.
export const JUPITER_RINGS: readonly DiscreteRing[] = [
  {
    name: "Halo",
    radiusKm: 111_200,
    widthKm: 22_400,
    opticalDepth: 0.000_001,
    color: "dust",
  },
  {
    name: "Main",
    radiusKm: 125_750,
    widthKm: 6_700,
    opticalDepth: 0.000_008,
    color: "dust",
  },
  {
    name: "Amalthea gossamer",
    radiusKm: 151_875,
    widthKm: 58_950,
    opticalDepth: 0.000_000_5,
    color: "dust",
  },
  {
    name: "Thebe gossamer",
    radiusKm: 172_150,
    widthKm: 99_500,
    opticalDepth: 0.000_000_1,
    color: "dust",
  },
  {
    name: "Thebe extension",
    radiusKm: 245_950,
    widthKm: 48_100,
    opticalDepth: 0.000_000_001,
    color: "dust",
  },
] as const;

export const NEPTUNE_EQUATORIAL_RADIUS_KM = 24_764;
export const NEPTUNE_POLAR_RADIUS_KM = 24_341;

// The five named main rings use NASA PDS radii, widths and normal optical
// depths. Arago has no measured width in the PDS table, so it is represented
// as the documented brightness enhancement within Lassell, not as a sixth
// invented band. The Adams entry represents its axisymmetric ring component;
// the named arcs are not assigned invented longitudinal spans because this
// summary source does not publish their angular widths.
export const NEPTUNE_RINGS: readonly DiscreteRing[] = [
  {
    name: "Galle",
    radiusKm: 42_000,
    widthKm: 2_000,
    opticalDepth: 0.000_1,
    color: "dust",
  },
  {
    name: "Le Verrier",
    radiusKm: 53_200,
    widthKm: 100,
    opticalDepth: 0.003,
    color: "dust",
  },
  {
    name: "Lassell",
    radiusKm: 55_200,
    widthKm: 4_000,
    opticalDepth: 0.000_1,
    color: "dust",
  },
  {
    name: "Arago enhancement",
    radiusKm: 57_200,
    widthKm: 120,
    opticalDepth: 0.000_2,
    color: "dust",
  },
  {
    name: "Adams",
    radiusKm: 62_933,
    widthKm: 15,
    opticalDepth: 0.003,
    color: "dust",
  },
] as const;

export const DISCRETE_RING_SYSTEMS = {
  jupiter: {
    equatorialRadiusKm: JUPITER_EQUATORIAL_RADIUS_KM,
    rings: JUPITER_RINGS,
  },
  uranus: {
    equatorialRadiusKm: URANUS_EQUATORIAL_RADIUS_KM,
    rings: URANUS_RINGS,
  },
  neptune: {
    equatorialRadiusKm: NEPTUNE_EQUATORIAL_RADIUS_KM,
    rings: NEPTUNE_RINGS,
  },
} as const satisfies Readonly<Record<string, RingSystem>>;

export type DiscreteRingBodyId = keyof typeof DISCRETE_RING_SYSTEMS;

export function isDiscreteRingBodyId(
  bodyId: string,
): bodyId is DiscreteRingBodyId {
  return Object.hasOwn(DISCRETE_RING_SYSTEMS, bodyId);
}

export function discreteRingSystemExtent(system: RingSystem): Readonly<{
  innerRadiusKm: number;
  outerRadiusKm: number;
}> {
  if (system.rings.length === 0) {
    throw new Error("A discrete ring system must contain at least one ring");
  }
  return {
    innerRadiusKm: Math.min(
      ...system.rings.map((ring) => ring.radiusKm - ring.widthKm / 2),
    ),
    outerRadiusKm: Math.max(
      ...system.rings.map((ring) => ring.radiusKm + ring.widthKm / 2),
    ),
  };
}

export const URANUS_RING_INNER_RADIUS_KM = Math.min(
  ...URANUS_RINGS.map((ring) => ring.radiusKm - ring.widthKm / 2),
);

export const URANUS_RING_OUTER_RADIUS_KM = Math.max(
  ...URANUS_RINGS.map((ring) => ring.radiusKm + ring.widthKm / 2),
);

export const URANUS_MAIN_RING_OUTER_RADIUS_KM = (() => {
  const epsilon = URANUS_RINGS.find((ring) => ring.name === "Epsilon");
  if (epsilon === undefined) {
    throw new Error("Uranus Epsilon ring is missing");
  }
  return epsilon.radiusKm + epsilon.widthKm / 2;
})();

export function ringRadiusRatio(
  radiusKm: number,
  equatorialRadiusKm: number,
): number {
  if (
    !Number.isFinite(radiusKm) ||
    !Number.isFinite(equatorialRadiusKm) ||
    radiusKm <= 0 ||
    equatorialRadiusKm <= 0
  ) {
    throw new Error("Ring and equatorial radii must be positive and finite");
  }
  return radiusKm / equatorialRadiusKm;
}
