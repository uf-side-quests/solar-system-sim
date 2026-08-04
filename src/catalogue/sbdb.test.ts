import { describe, expect, it } from "vitest";

import { MAXIMUM_SUPPORTED_OBJECTS, sbdbSnapshotSchema } from "./sbdb";

describe("NASA/JPL SBDB snapshot manifest", () => {
  it("rejects a catalogue that exceeds the declared GPU capacity", () => {
    const result = sbdbSnapshotSchema.safeParse({
      schemaVersion: "1.0.0",
      authority: "NASA/JPL SBDB (Small-Body DataBase) Query API",
      endpoint: "https://ssd-api.jpl.nasa.gov/sbdb_query.api",
      retrievedAt: "2026-08-02T00:00:00.000Z",
      retrievalStartedAt: "2026-08-02T00:00:00.000Z",
      referenceEpoch: {
        value: 2_461_041.5,
        format: "Julian day",
        timeScale: "TDB",
      },
      coordinateModel: {
        origin: "Sun",
        frame: "J2000 ecliptic orbital elements",
        propagation: "GPU two-body Kepler propagation",
        numericPrecision: "IEEE-754 binary32 with epoch rebasing",
      },
      counts: {
        numberedAsteroids: MAXIMUM_SUPPORTED_OBJECTS + 1,
        unnumberedAsteroids: 0,
        numberedComets: 0,
        unnumberedComets: 0,
        asteroids: MAXIMUM_SUPPORTED_OBJECTS + 1,
        comets: 0,
        total: MAXIMUM_SUPPORTED_OBJECTS + 1,
        integrable: MAXIMUM_SUPPORTED_OBJECTS + 1,
        unavailableForSimulation: 0,
      },
      binary: {
        path: "/data/sbdb-orbits.bin",
        recordStrideBytes: 48,
        byteLength: (MAXIMUM_SUPPORTED_OBJECTS + 1) * 48,
        checksumSha256: "0".repeat(64),
      },
    });

    expect(result.success).toBe(false);
  });
});
