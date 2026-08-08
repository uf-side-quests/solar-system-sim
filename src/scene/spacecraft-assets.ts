import { z } from "zod";

const assetSchema = z.object({
  bodyId: z.enum([
    "iss",
    "voyager-1",
    "voyager-2",
    "hubble",
    "jwst",
    "roadster",
  ]),
  modelUrl: z.string().startsWith("/models/").endsWith(".glb"),
  pageUrl: z.url(),
  repositoryUrl: z.url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  maximumDimensionM: z.number().positive(),
  credit: z.string().min(1),
});

export const spacecraftAssets = assetSchema.array().parse([
  {
    bodyId: "iss",
    modelUrl: "/models/nasa/iss.glb",
    pageUrl:
      "https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/",
    repositoryUrl:
      "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/International%20Space%20Station%20B",
    sha256: "2ba4427413b0dd89a33d2acaf962dea8a96a3b1d8dceda05cc7aad547ffd3d16",
    maximumDimensionM: 109,
    credit: "NASA 3D Resources",
  },
  ...(["voyager-1", "voyager-2"] as const).map((bodyId) => ({
    bodyId,
    modelUrl: "/models/nasa/voyager.glb",
    pageUrl: "https://science.nasa.gov/resource/voyager-3d-model/",
    repositoryUrl:
      "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Voyager%20Probe%20A",
    sha256: "7cf8eefb5a0fca9e4e1b0d1e51c37433124169183e5dbfd2d8034af902311821",
    maximumDimensionM: 13,
    credit: "NASA 3D Resources",
  })),
  {
    bodyId: "hubble",
    modelUrl: "/models/nasa/hubble.glb",
    pageUrl:
      "https://science.nasa.gov/resource/hubble-space-telescope-3d-model/",
    repositoryUrl:
      "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Hubble%20Space%20Telescope%20A",
    sha256: "e5ba4de15c7d359ac8fa1ab7e286aff42dec09c0fadae3db99252587f39fa384",
    maximumDimensionM: 13.2,
    credit: "NASA 3D Resources",
  },
  {
    bodyId: "jwst",
    modelUrl: "/models/nasa/jwst.glb",
    pageUrl: "https://science.nasa.gov/mission/webb/multimedia/3d-models/",
    repositoryUrl:
      "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/James%20Webb%20Space%20Telescope%20B",
    sha256: "4958e61e5a564f2efcc32cd516b9d36ea0b9bc644f64dbcfe182ce8a422ae526",
    maximumDimensionM: 21.197,
    credit: "NASA 3D Resources",
  },
  {
    bodyId: "roadster",
    modelUrl: "/models/community/roadster-starman.glb",
    pageUrl:
      "https://spacedock.info/mod/1797/Elon%27s%20Roadster%20%26%20Starman",
    repositoryUrl: "https://spacedock.info/profile/TheBigElon",
    sha256: "1f033cb4a8e47fa852494e37927cf3d8008b9fb18e26fdc586bfc5a631392184",
    maximumDimensionM: 3.946,
    credit:
      "TheBigElon Roadster and Oranhunter Starman · MIT-licensed SpaceDock model",
  },
]);

export const ROADSTER_BODY_ID = "roadster" as const;

export const spacecraftAssetByBodyId = new Map(
  spacecraftAssets.map((asset) => [asset.bodyId, asset]),
);
