import { z } from "zod";

const MAXIMUM_SUPPORTED_OBJECTS = 2_000_000;

const countSchema = z.number().int().nonnegative();

export const sbdbSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("NASA/JPL SBDB (Small-Body DataBase) Query API"),
  endpoint: z.url(),
  retrievedAt: z.iso.datetime(),
  retrievalStartedAt: z.iso.datetime(),
  referenceEpoch: z.object({
    value: z.number(),
    format: z.literal("Julian day"),
    timeScale: z.literal("TDB"),
  }),
  coordinateModel: z.object({
    origin: z.literal("Sun"),
    frame: z.literal("J2000 ecliptic orbital elements"),
    propagation: z.literal("GPU two-body Kepler propagation"),
    numericPrecision: z.literal("IEEE-754 binary32 with epoch rebasing"),
  }),
  counts: z.object({
    numberedAsteroids: countSchema,
    unnumberedAsteroids: countSchema,
    numberedComets: countSchema,
    unnumberedComets: countSchema,
    asteroids: countSchema,
    comets: countSchema,
    total: countSchema.max(MAXIMUM_SUPPORTED_OBJECTS),
    integrable: countSchema,
    unavailableForSimulation: countSchema,
  }),
  binary: z.object({
    path: z.literal("/data/sbdb-orbits.bin"),
    recordStrideBytes: z.literal(48),
    byteLength: countSchema,
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
});

export type SbdbSnapshotManifest = z.infer<typeof sbdbSnapshotSchema>;

export type SbdbSnapshot = Readonly<{
  manifest: SbdbSnapshotManifest;
  orbitalRecords: ArrayBuffer;
}>;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function validateCounts(manifest: SbdbSnapshotManifest): void {
  const { counts } = manifest;
  if (
    counts.asteroids !==
      counts.numberedAsteroids + counts.unnumberedAsteroids ||
    counts.comets !== counts.numberedComets + counts.unnumberedComets ||
    counts.total !== counts.asteroids + counts.comets ||
    counts.total !== counts.integrable + counts.unavailableForSimulation
  ) {
    throw new Error(
      "NASA/JPL SBDB snapshot counts are internally inconsistent",
    );
  }
  if (
    manifest.binary.byteLength !==
    counts.total * manifest.binary.recordStrideBytes
  ) {
    throw new Error("NASA/JPL SBDB binary length does not match its manifest");
  }
}

export async function loadSbdbSnapshot(
  signal: AbortSignal,
): Promise<SbdbSnapshot> {
  const manifestResponse = await fetch("/data/sbdb-snapshot.json", { signal });
  if (!manifestResponse.ok) {
    throw new Error(
      `NASA/JPL SBDB manifest is unavailable: HTTP ${String(manifestResponse.status)}`,
    );
  }
  const manifest = sbdbSnapshotSchema.parse(await manifestResponse.json());
  validateCounts(manifest);

  const binaryResponse = await fetch(manifest.binary.path, { signal });
  if (!binaryResponse.ok) {
    throw new Error(
      `NASA/JPL SBDB orbital snapshot is unavailable: HTTP ${String(binaryResponse.status)}`,
    );
  }
  const orbitalRecords = await binaryResponse.arrayBuffer();
  if (orbitalRecords.byteLength !== manifest.binary.byteLength) {
    throw new Error(
      "NASA/JPL SBDB orbital snapshot byte length does not match its manifest",
    );
  }
  const checksum = bytesToHex(
    await crypto.subtle.digest("SHA-256", orbitalRecords),
  );
  if (checksum !== manifest.binary.checksumSha256) {
    throw new Error("NASA/JPL SBDB orbital snapshot checksum failed");
  }

  return { manifest, orbitalRecords };
}

export { MAXIMUM_SUPPORTED_OBJECTS };
