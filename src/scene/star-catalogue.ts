import { z } from "zod";

import snapshotJson from "../data/hipparcos-stars.snapshot.json";

const nullableNumber = z.number().nullable();
const starSchema = z.object({
  hipId: z.number().int().positive(),
  raDeg: z.number().min(0).lt(360),
  decDeg: z.number().min(-90).max(90),
  visualMagnitude: z.number().max(6.5),
  properMotionRaMasPerYear: nullableNumber,
  properMotionDecMasPerYear: nullableNumber,
  colorIndexBv: nullableNumber,
});

const snapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  authority: z.literal("European Space Agency Hipparcos Catalogue"),
  publisher: z.literal("CDS VizieR"),
  catalogueId: z.literal("I/239/hip_main"),
  catalogueReference: z.literal("1997HIP...C......0E"),
  sourceUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  sourceResponseSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  referenceEpochJulianYear: z.literal(1991.25),
  coordinateFrame: z.literal("ICRS"),
  magnitudeBand: z.literal("Johnson V"),
  selection: z.string().min(1),
  stars: z.array(starSchema).min(8_000),
});

export const hipparcosStarSnapshot = snapshotSchema.parse(snapshotJson);
export type HipparcosStar = (typeof hipparcosStarSnapshot.stars)[number];

const MILLIARCSECOND_TO_RADIAN = Math.PI / (180 * 3_600_000);

export function starDirectionIcrs(
  star: HipparcosStar,
  julianYear: number,
): readonly [number, number, number] {
  if (!Number.isFinite(julianYear)) {
    throw new Error("Star propagation year must be finite");
  }
  const rightAscension = (star.raDeg * Math.PI) / 180;
  const declination = (star.decDeg * Math.PI) / 180;
  const cosDeclination = Math.cos(declination);
  const base = [
    cosDeclination * Math.cos(rightAscension),
    cosDeclination * Math.sin(rightAscension),
    Math.sin(declination),
  ] as const;
  if (
    star.properMotionRaMasPerYear === null ||
    star.properMotionDecMasPerYear === null
  ) {
    return base;
  }

  const elapsedYears =
    julianYear - hipparcosStarSnapshot.referenceEpochJulianYear;
  const east = [
    -Math.sin(rightAscension),
    Math.cos(rightAscension),
    0,
  ] as const;
  const north = [
    -Math.sin(declination) * Math.cos(rightAscension),
    -Math.sin(declination) * Math.sin(rightAscension),
    cosDeclination,
  ] as const;
  const eastMotion =
    star.properMotionRaMasPerYear * elapsedYears * MILLIARCSECOND_TO_RADIAN;
  const northMotion =
    star.properMotionDecMasPerYear * elapsedYears * MILLIARCSECOND_TO_RADIAN;
  const moved = [
    base[0] + east[0] * eastMotion + north[0] * northMotion,
    base[1] + east[1] * eastMotion + north[1] * northMotion,
    base[2] + east[2] * eastMotion + north[2] * northMotion,
  ] as const;
  const length = Math.hypot(...moved);
  return [moved[0] / length, moved[1] / length, moved[2] / length];
}

export function starDisplayColor(
  colorIndexBv: number | null,
): readonly [number, number, number] {
  if (colorIndexBv === null) {
    return [0.82, 0.86, 0.92];
  }
  const normalized = Math.max(0, Math.min(1, (colorIndexBv + 0.4) / 2.4));
  if (normalized < 0.5) {
    const amount = normalized * 2;
    return [0.58 + amount * 0.42, 0.72 + amount * 0.28, 1];
  }
  const amount = (normalized - 0.5) * 2;
  return [1, 1 - amount * 0.32, 1 - amount * 0.58];
}

export function starDisplaySizeCssPixels(visualMagnitude: number): number {
  if (!Number.isFinite(visualMagnitude)) {
    throw new Error("Star visual magnitude must be finite");
  }
  return Math.max(1.1, Math.min(5.5, 5.5 - (visualMagnitude + 1.44) * 0.55));
}

export function starDisplayOpacity(visualMagnitude: number): number {
  if (!Number.isFinite(visualMagnitude)) {
    throw new Error("Star visual magnitude must be finite");
  }
  return Math.max(0.22, Math.min(1, 10 ** (-0.12 * (visualMagnitude + 1.44))));
}
