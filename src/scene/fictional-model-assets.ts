import { z } from "zod";

const fictionalModelAssetSchema = z.object({
  bodyId: z.enum([
    "discovery-one",
    "death-star-2",
    "deep-space-nine",
    "uss-defiant",
  ]),
  modelUrl: z.string().startsWith("/models/").endsWith(".glb"),
  pageUrl: z.url(),
  archiveUrl: z.url(),
  licenseUrl: z.url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  maximumDimensionM: z.number().positive(),
  credit: z.string().min(1),
});

export type FictionalModelAsset = z.infer<typeof fictionalModelAssetSchema>;

export const fictionalModelAssets = fictionalModelAssetSchema.array().parse([
  {
    bodyId: "discovery-one",
    modelUrl: "/models/community/discovery-one.glb",
    pageUrl:
      "https://sketchfab.com/3d-models/discovery-1-3c0b0c7bb5364305a04b74382f944935",
    archiveUrl: "https://objaverse.allenai.org/",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sha256: "b2cc068f824a5812b29045c10cd43f6d282a01244ed9b5ceec95ae02185498ac",
    maximumDimensionM: 140.1,
    credit: "Discovery 1 by uperesito · CC BY 4.0 · Sketchfab",
  },
  {
    bodyId: "death-star-2",
    modelUrl: "/models/community/death-star-ii.glb",
    pageUrl:
      "https://sketchfab.com/3d-models/death-star-ii-17ccca0dbb6b4e338fa999202f9e6685",
    archiveUrl: "https://objaverse.allenai.org/",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sha256: "c721f3f11d2d6dee1497efca0c401de60df6de0b1fe8325069b8ee4b8ae126b3",
    maximumDimensionM: 200_000,
    credit: "Death Star II by N8 · CC BY 4.0 · Sketchfab",
  },
  {
    bodyId: "deep-space-nine",
    modelUrl: "/models/community/deep-space-nine.glb",
    pageUrl:
      "https://sketchfab.com/3d-models/deep-space-nine-03368a8eed67471396b52fc3dce77cfa",
    archiveUrl: "https://objaverse.allenai.org/",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sha256: "9f8d4af18650679039bb875e1de740938ddcc410f7acab3f6eb2d690a720d7ba",
    maximumDimensionM: 1_451.82,
    credit: "Deep Space Nine by neilken · CC BY 4.0 · Sketchfab",
  },
  {
    bodyId: "uss-defiant",
    modelUrl: "/models/community/uss-defiant.glb",
    pageUrl:
      "https://sketchfab.com/3d-models/defiant-170220edebe0462ba477772c3325679a",
    archiveUrl: "https://objaverse.allenai.org/",
    licenseUrl: "https://sketchfab.com/licenses",
    sha256: "4f9e0ced7ea55a0390946a8d1f2371a7a3bcf0f8e943ba9bb059a38e88e7b3cc",
    maximumDimensionM: 170.68,
    credit: "Defiant by morenostefanuto · Sketchfab Free Standard",
  },
]);

export const fictionalModelAssetByBodyId: ReadonlyMap<
  string,
  FictionalModelAsset
> = new Map(fictionalModelAssets.map((asset) => [asset.bodyId, asset]));
