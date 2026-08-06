import { z } from "zod";

import voyagerSnapshotJson from "../data/voyager.snapshot.json";
import type { BodyInitialState } from "./contracts";

const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
const voyagerProbeSchema = z.object({
  id: z.enum(["voyager-1", "voyager-2"]),
  name: z.string().min(1),
  horizonsCommand: z.enum(["-31", "-32"]),
  launchDateUtc: z.iso.datetime(),
  massKg: z.number().positive(),
  maximumDimensionM: z.number().positive(),
  highGainAntennaDiameterM: z.number().positive(),
  heightM: z.number().positive(),
  positionM: vector3Schema,
  velocityMps: vector3Schema,
  horizonsSolution: z.string().min(1),
});

const voyagerSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("NASA/JPL Horizons"),
  endpoint: z.url(),
  epoch: z.object({
    julianDateTdb: z.literal(2_461_041.5),
    isoDateTdb: z.literal("2026-01-01T00:00:00 TDB"),
    referenceFrame: z.literal("ICRF"),
    center: z.literal("Solar System Barycenter (500@0)"),
  }),
  trajectoryCoverage: z.object({
    endYear: z.literal(2049),
    source: z.string().min(1),
  }),
  probes: z.array(voyagerProbeSchema).length(2),
});

export const voyagerSnapshot = voyagerSnapshotSchema.parse(voyagerSnapshotJson);
export type VoyagerProbe = (typeof voyagerSnapshot.probes)[number];
export const VOYAGER_BODY_IDS = ["voyager-1", "voyager-2"] as const;
export const voyagerById = new Map(
  voyagerSnapshot.probes.map((probe) => [probe.id, probe]),
);
export const voyagerInitialBodies: readonly BodyInitialState[] =
  voyagerSnapshot.probes.map((probe) => ({
    id: probe.id,
    gravitationalParameterM3S2: 0,
    positionM: probe.positionM,
    velocityMps: probe.velocityMps,
  }));

export function isVoyagerBodyId(bodyId: string): bodyId is VoyagerProbe["id"] {
  return voyagerById.has(bodyId as VoyagerProbe["id"]);
}
