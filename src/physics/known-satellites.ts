import { z } from "zod";

import knownSatelliteSnapshotJson from "../data/known-satellites.snapshot.json";
import { majorBodySnapshot } from "./solar-system-data";

const finiteNumber = z.number();
const vector3 = z.tuple([finiteNumber, finiteNumber, finiteNumber]);
const parentId = z.enum([
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
]);
const identity = z.object({
  id: z.string().startsWith("horizons-moon-"),
  name: z.string().min(1),
  authorityId: z.string().startsWith("NASA/JPL-Horizons:"),
  horizonsId: z.number().int().positive(),
  parentId,
});
const availableSatellite = identity.extend({
  availability: z.literal("available"),
  positionM: vector3,
  velocityMps: vector3,
});
const unavailableSatellite = identity.extend({
  availability: z.literal("unavailable"),
  unavailableReason: z.string().min(1),
});
const knownSatelliteSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("NASA/JPL Horizons major-body index and vector API"),
  endpoint: z.url(),
  retrievedAt: z.iso.datetime(),
  catalogueCommand: z.literal("MB"),
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
  simulationRole: z.string().min(1),
  availabilityContract: z.string().min(1),
  bodies: z
    .array(
      z.discriminatedUnion("availability", [
        availableSatellite,
        unavailableSatellite,
      ]),
    )
    .min(400),
});

export const knownSatelliteSnapshot = knownSatelliteSnapshotSchema.parse(
  knownSatelliteSnapshotJson,
);
export type KnownSatelliteDefinition =
  (typeof knownSatelliteSnapshot.bodies)[number];
export type AvailableKnownSatelliteDefinition = Extract<
  KnownSatelliteDefinition,
  { availability: "available" }
>;

const installedMajorSatelliteAuthorityIds = new Set(
  majorBodySnapshot.bodies
    .filter((body) => body.type === "moon")
    .map((body) => body.authorityId),
);

export const additionalKnownSatellites = knownSatelliteSnapshot.bodies.filter(
  (body) => !installedMajorSatelliteAuthorityIds.has(body.authorityId),
);

export const additionalAvailableKnownSatellites =
  additionalKnownSatellites.filter(
    (body): body is AvailableKnownSatelliteDefinition =>
      body.availability === "available",
  );

export const knownSatelliteById = new Map(
  additionalKnownSatellites.map((body) => [body.id, body]),
);

export const availableKnownSatelliteCount =
  knownSatelliteSnapshot.bodies.filter(
    (body) => body.availability === "available",
  ).length;
