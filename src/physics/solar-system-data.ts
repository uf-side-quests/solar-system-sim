import { z } from "zod";

import majorBodySnapshotJson from "../data/major-bodies.snapshot.json";

const finiteNumber = z.number();
const vector3 = z.tuple([finiteNumber, finiteNumber, finiteNumber]);

const majorBodySnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("NASA/JPL Horizons API"),
  endpoint: z.url(),
  retrievedAt: z.iso.datetime(),
  epoch: z.object({
    value: finiteNumber,
    format: z.literal("Julian day"),
    timeScale: z.literal("TDB"),
  }),
  stateVector: z.object({
    origin: z.literal("Solar System Barycenter"),
    frame: z.literal("ICRF"),
    positionUnits: z.literal("m"),
    velocityUnits: z.literal("m/s"),
    corrections: z.literal("geometric; no aberration corrections"),
  }),
  physicalParameterSources: z.array(z.url()).min(1),
  bodies: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        authorityId: z.string().startsWith("NASA/JPL-Horizons:"),
        type: z.enum(["star", "planet", "dwarf-planet", "moon"]),
        massKg: finiteNumber.positive(),
        meanRadiusM: finiteNumber.positive(),
        color: z.string().regex(/^#[0-9a-f]{6}$/iu),
        positionM: vector3,
        velocityMps: vector3,
      }),
    )
    .min(1),
});

export const majorBodySnapshot = majorBodySnapshotSchema.parse(
  majorBodySnapshotJson,
);

export type MajorBodyDefinition = (typeof majorBodySnapshot.bodies)[number];
