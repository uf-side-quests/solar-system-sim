import type { SimulationInitialState } from "./contracts";
import { z } from "zod";

import naifPhysicalSnapshotJson from "../data/naif-physical.snapshot.json";
export { majorBodySnapshot } from "./solar-system-data";
import { majorBodySnapshot } from "./solar-system-data";
import { voyagerInitialBodies } from "./voyager-ephemeris";

export const ASTRONOMICAL_UNIT_M = 149_597_870_700;
export const SUN_GRAVITATIONAL_PARAMETER_M3_S2 = Number(
  "1.3271244004127942e20",
);
export const EARTH_GRAVITATIONAL_PARAMETER_M3_S2 = Number(
  "3.9860043550702266e14",
);

const finiteNumber = z.number();

const orientationSchema = z.object({
  poleRightAscensionDeg: z.array(finiteNumber).length(3),
  poleDeclinationDeg: z.array(finiteNumber).length(3),
  primeMeridianDeg: z.array(finiteNumber).length(3),
  nutationRightAscensionDeg: z.array(finiteNumber),
  nutationDeclinationDeg: z.array(finiteNumber),
  nutationPrimeMeridianDeg: z.array(finiteNumber),
  phaseAnglesDeg: z.array(z.array(finiteNumber).min(2).max(3)),
});

const naifBodySchema = z.object({
  naifId: z.number().int().positive(),
  gravitationalParameterM3S2: finiteNumber.positive(),
  orientation: orientationSchema,
});

const naifPhysicalSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  gravitationalParameters: z.object({
    authority: z.literal("NASA/JPL NAIF gm_de440.tpc"),
    sourceUrl: z.url(),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    sourceUnits: z.literal("km^3/s^2"),
    outputUnits: z.literal("m^3/s^2"),
  }),
  orientations: z.object({
    authority: z.literal("NASA/JPL NAIF pck00011.tpc"),
    sourceUrl: z.url(),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    angleUnits: z.literal("degrees"),
    polynomialTimeUnits: z.object({
      pole: z.literal("Julian centuries since J2000 TDB"),
      primeMeridian: z.literal("days since J2000 TDB"),
      phase: z.literal("Julian centuries since J2000 TDB"),
    }),
  }),
  bodies: z.record(z.string(), naifBodySchema),
});

export const naifPhysicalSnapshot = naifPhysicalSnapshotSchema.parse(
  naifPhysicalSnapshotJson,
);

export type { MajorBodyDefinition } from "./solar-system-data";

export const majorBodySystem: SimulationInitialState = {
  bodies: [
    ...majorBodySnapshot.bodies.map((body) => ({
      id: body.id,
      gravitationalParameterM3S2:
        naifPhysicalSnapshot.bodies[body.id]?.gravitationalParameterM3S2 ??
        (() => {
          throw new Error(`NAIF physical data is missing body ${body.id}`);
        })(),
      positionM: body.positionM,
      velocityMps: body.velocityMps,
    })),
    ...voyagerInitialBodies,
  ],
};

const mu =
  SUN_GRAVITATIONAL_PARAMETER_M3_S2 + EARTH_GRAVITATIONAL_PARAMETER_M3_S2;
const earthCircularVelocityMps = Math.sqrt(mu / ASTRONOMICAL_UNIT_M);

export const validationSystem: SimulationInitialState = {
  bodies: [
    {
      id: "sun",
      gravitationalParameterM3S2: SUN_GRAVITATIONAL_PARAMETER_M3_S2,
      positionM: [0, 0, 0],
      velocityMps: [0, 0, 0],
    },
    {
      id: "earth",
      gravitationalParameterM3S2: EARTH_GRAVITATIONAL_PARAMETER_M3_S2,
      positionM: [ASTRONOMICAL_UNIT_M, 0, 0],
      velocityMps: [0, earthCircularVelocityMps, 0],
    },
  ],
};
