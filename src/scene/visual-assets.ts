import { z } from "zod";

import textureSnapshotJson from "../data/nasa-textures.snapshot.json";

const assetSchema = z.object({
  id: z.string().min(1),
  role: z.enum([
    "surface-color",
    "surface-height",
    "cloud-opacity",
    "ring-color-opacity",
    "night-emission",
    "surface-normal",
    "surface-roughness",
  ]),
  file: z.string().startsWith("/textures/nasa/"),
  classification: z.enum([
    "observational-composite",
    "measured-topography",
    "visualization",
    "authority-derived-material",
  ]),
  coverage: z.enum([
    "global",
    "global-with-polar-fill",
    "global-with-reconstruction",
    "global-with-unobserved-region",
    "radial-observation",
  ]),
  projection: z.enum([
    "equirectangular",
    "simple-cylindrical",
    "radial-profile",
  ]),
  pageUrl: z.url(),
  assetUrl: z.url(),
  supportingAssetUrls: z.array(z.url()).optional(),
  credit: z.string().min(1),
  limitations: z.string().min(1),
  sourceContentType: z.union([
    z.string().startsWith("image/"),
    z.literal("model/gltf-binary"),
  ]),
  contentType: z.enum(["image/png", "image/webp"]),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  sourceSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteLength: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
});

const materialPresentationSchema = z.object({
  id: z.string().min(1),
  classification: z.literal("observation-constrained-atmosphere"),
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
  pageUrl: z.url(),
  credit: z.string().min(1),
  limitations: z.string().min(1),
});

const textureSnapshotSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  authority: z.literal("NASA, JPL, and USGS"),
  generatedAt: z.iso.datetime(),
  note: z.string().min(1),
  assets: z.array(assetSchema).min(1),
  materialPresentations: z.array(materialPresentationSchema),
});

export const nasaTextureSnapshot =
  textureSnapshotSchema.parse(textureSnapshotJson);

export type NasaTextureAsset = (typeof nasaTextureSnapshot.assets)[number];

export const nasaTextureByBodyId = new Map(
  nasaTextureSnapshot.assets
    .filter((asset) => asset.role === "surface-color")
    .map((asset) => [asset.id, asset] as const),
);

export const nasaMaterialPresentationByBodyId = new Map(
  nasaTextureSnapshot.materialPresentations.map(
    (presentation) => [presentation.id, presentation] as const,
  ),
);

export const nasaMoonHeightAsset = nasaTextureSnapshot.assets.find(
  (asset) => asset.id === "moon-height",
);

export const nasaEarthCloudAsset = nasaTextureSnapshot.assets.find(
  (asset) => asset.id === "earth-clouds",
);

export const nasaEarthNightLightAsset = nasaTextureSnapshot.assets.find(
  (asset) => asset.id === "earth-night-lights",
);

export const nasaSaturnRingAsset = nasaTextureSnapshot.assets.find(
  (asset) => asset.id === "saturn-rings",
);

export const nasaSurfaceNormalByBodyId = new Map(
  nasaTextureSnapshot.assets
    .filter((asset) => asset.role === "surface-normal")
    .map((asset) => [asset.id.replace(/-normal$/u, ""), asset] as const),
);

export const nasaSurfaceRoughnessByBodyId = new Map(
  nasaTextureSnapshot.assets
    .filter((asset) => asset.role === "surface-roughness")
    .map((asset) => [asset.id.replace(/-roughness$/u, ""), asset] as const),
);
