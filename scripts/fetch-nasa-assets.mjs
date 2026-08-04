import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";

import sharp from "sharp";

const OUTPUT_DIRECTORY = new URL("../public/textures/nasa/", import.meta.url);
const SOURCE_MANIFEST_PATH = new URL(
  "../src/data/nasa-textures.snapshot.json",
  import.meta.url,
);
const NASA_RESOURCE_ROOT = "https://science.nasa.gov/3d-resources";
const DEFAULT_MAXIMUM_WIDTH = 4_096;
const DEFAULT_MAXIMUM_HEIGHT = 2_048;

function nasaTexture({
  id,
  slug,
  directory,
  fileName,
  classification = "observational-composite",
  credit = "NASA/JPL-Caltech and USGS",
  limitations = "Global rendering mosaic assembled from available mission imagery; resolution and illumination vary with source coverage.",
}) {
  return {
    id,
    role: "surface-color",
    classification,
    coverage: "global",
    projection: "equirectangular",
    pageUrl: `${NASA_RESOURCE_ROOT}/${slug}/`,
    assetUrl: `https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/${directory}/${fileName}`,
    credit,
    limitations,
  };
}

const resources = [
  nasaTexture({
    id: "venus",
    slug: "venus",
    directory: "venus",
    fileName: "Venus.jpg",
    limitations:
      "Radar-derived global surface visualization; Venusian clouds hide this terrain in ordinary visible light.",
  }),
  nasaTexture({
    id: "mars",
    slug: "mars",
    directory: "mars",
    fileName: "Mars.jpg",
  }),
  nasaTexture({
    id: "neptune",
    slug: "neptune",
    directory: "neptune",
    fileName: "Neptune.jpg",
    classification: "visualization",
    limitations:
      "Static global atmospheric visualization; Neptune has no solid visible surface and its clouds evolve with time.",
  }),
  nasaTexture({
    id: "phobos",
    slug: "mars-phobos",
    directory: "mars---phobos",
    fileName: "Mars%20-%20Phobos.jpg",
  }),
  nasaTexture({
    id: "deimos",
    slug: "mars-deimos",
    directory: "mars---deimos",
    fileName: "Mars%20-%20Deimos.jpg",
  }),
  nasaTexture({
    id: "io",
    slug: "jupiter-io-b",
    directory: "jupiter---io-(b)",
    fileName: "Jupiter%20-%20Io%20(B).jpg",
  }),
  nasaTexture({
    id: "europa",
    slug: "jupiter-europa",
    directory: "jupiter---europa",
    fileName: "Jupiter%20-%20Europa.jpg",
  }),
  nasaTexture({
    id: "callisto",
    slug: "jupiter-callisto",
    directory: "jupiter---callisto",
    fileName: "Jupiter%20-%20Callisto.jpg",
  }),
  nasaTexture({
    id: "mimas",
    slug: "saturn-mimas",
    directory: "saturn---mimas",
    fileName: "Saturn%20-%20Mimas.jpg",
  }),
  nasaTexture({
    id: "tethys",
    slug: "saturn-tethys",
    directory: "saturn---tethys",
    fileName: "Saturn%20-%20Tethys.jpg",
  }),
  nasaTexture({
    id: "dione",
    slug: "saturn-dione",
    directory: "saturn---dione",
    fileName: "Saturn%20-%20Dione.jpg",
  }),
  nasaTexture({
    id: "rhea",
    slug: "saturn-rhea",
    directory: "saturn---rhea",
    fileName: "Saturn%20-%20Rhea.jpg",
  }),
  nasaTexture({
    id: "titan",
    slug: "saturn-titan",
    directory: "saturn---titan",
    fileName: "Saturn%20-%20Titan.jpg",
    classification: "visualization",
    limitations:
      "Static visible-atmosphere visualization; Titan's opaque haze conceals most surface detail.",
  }),
  nasaTexture({
    id: "iapetus",
    slug: "saturn-iapetus",
    directory: "saturn---iapetus",
    fileName: "Saturn%20-%20Iapetus.jpg",
  }),
  nasaTexture({
    id: "ariel",
    slug: "uranus-ariel",
    directory: "uranus---ariel",
    fileName: "Uranus%20-%20Ariel.jpg",
  }),
  nasaTexture({
    id: "umbriel",
    slug: "uranus-umbriel",
    directory: "uranus---umbriel",
    fileName: "Uranus%20-%20Umbriel.jpg",
  }),
  nasaTexture({
    id: "titania",
    slug: "uranus-titania",
    directory: "uranus---titania",
    fileName: "Uranus%20-%20Titania.jpg",
  }),
  nasaTexture({
    id: "miranda",
    slug: "uranus-miranda",
    directory: "uranus---miranda",
    fileName: "Uranus%20-%20Miranda.jpg",
  }),
  nasaTexture({
    id: "triton",
    slug: "neptune-triton",
    directory: "neptune---triton",
    fileName: "Neptune%20-%20Triton.jpg",
  }),
];

const directResources = [
  {
    id: "saturn",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global-with-reconstruction",
    projection: "equirectangular",
    pageUrl:
      "https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn:nasa:pds:co_iss_global-maps&version=1.0",
    assetUrl:
      "https://atmos.nmsu.edu/PDS/data/PDS4/co_iss_global-maps/data_derived/Cassini_ISS_RGB_Saturn_global_color_map_original.fits",
    supportingAssetUrls: [
      "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/saturn/Saturn.jpg",
    ],
    credit:
      "NASA Planetary Data System; Cassini ISS; Li, West, Jiang, and Knowles",
    limitations:
      "Cassini RGB atmosphere map acquired on 11 August 2011. Unobserved black regions are feather-filled from NASA's static global Saturn visualization; clouds evolve with time.",
    decoder: "fits-rgb-f32-be",
    cachedFileName: "saturn-original.fits",
    sourceContentType: "image/fits",
    sourceSha256:
      "32a62eca9b82255c7dd763ba0752cee1664ae73d5ec4d5d5260227deecd422af",
  },
  {
    id: "saturn-rings",
    role: "ring-color-opacity",
    classification: "observational-composite",
    coverage: "radial-observation",
    projection: "radial-profile",
    pageUrl: "https://science.nasa.gov/resource/panoramic-rings/",
    assetUrl:
      "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/0/PIA06175-1.jpg",
    credit: "NASA/JPL/Space Science Institute; Cassini ISS",
    limitations:
      "Natural-colour six-image mosaic observed from below the ring plane. The installed radial profile averages a narrow central strip and represents the 74,565 to 136,780 kilometre region observed in this mosaic.",
    profileCropFraction: 0.2,
    maximumWidth: 4_096,
    maximumHeight: 32,
  },
  {
    id: "mercury",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl:
      "https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m",
    assetUrl:
      "https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif",
    credit:
      "MESSENGER Team, Arizona State University, and USGS Astrogeology Science Center",
    limitations:
      "Three-filter MESSENGER MDIS end-of-mission mosaic rendered as instrument color, not a naked-eye view; small polar no-data regions remain black rather than being inpainted.",
  },
  {
    id: "earth",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl:
      "https://visibleearth.nasa.gov/images/74218/december-blue-marble-next-generation/74226l",
    assetUrl:
      "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x5400x2700.jpg",
    credit: "NASA Earth Observatory",
    limitations:
      "Cloud-free December 2004 Blue Marble composite, not live weather or a single-time photograph.",
  },
  {
    id: "earth-clouds",
    role: "cloud-opacity",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl: "https://visibleearth.nasa.gov/images/57747/blue-marble-clouds",
    assetUrl:
      "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg",
    credit: "NASA Earth Observatory",
    limitations:
      "Static cloud composite, not synchronized with simulation time.",
    maximumWidth: 2_048,
    maximumHeight: 1_024,
  },
  {
    id: "jupiter",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl: "https://photojournal.jpl.nasa.gov/catalog/PIA07782",
    assetUrl:
      "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia07/pia07782/PIA07782.jpg",
    credit: "NASA/JPL/Space Science Institute",
    limitations:
      "Cassini cylindrical cloud mosaic from December 2000; atmospheric features evolve and longitude is epoch-specific.",
  },
  {
    id: "moon",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global-with-polar-fill",
    projection: "equirectangular",
    pageUrl: "https://svs.gsfc.nasa.gov/4720/",
    assetUrl:
      "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif",
    credit: "NASA SVS, LROC team, and LOLA team",
    limitations:
      "2025 LROC color map; high-latitude gaps are filled from lower-resolution laser-altimeter albedo data.",
  },
  {
    id: "moon-height",
    role: "surface-height",
    classification: "measured-topography",
    coverage: "global",
    projection: "equirectangular",
    pageUrl: "https://svs.gsfc.nasa.gov/4720/",
    assetUrl:
      "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif",
    credit: "NASA SVS and LOLA team",
    limitations:
      "LOLA elevation relative to a 1,737.4 km reference sphere; rendered bump amplitude is visually exaggerated.",
    outputFormat: "png",
  },
  {
    id: "ganymede",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl: "https://photojournal.jpl.nasa.gov/catalog/PIA03781",
    assetUrl:
      "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia03/pia03781/PIA03781.jpg",
    credit: "NASA/JPL and USGS Astrogeology Science Center",
    limitations:
      "Galileo and Voyager global mosaic with resolution and color fidelity varying by source coverage.",
  },
  {
    id: "enceladus",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global",
    projection: "equirectangular",
    pageUrl: "https://photojournal.jpl.nasa.gov/catalog/PIA18435",
    assetUrl:
      "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia18/pia18435/PIA18435.jpg",
    credit:
      "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute",
    limitations:
      "Cassini enhanced-color global mosaic; colors extend beyond ordinary human vision.",
  },
  {
    id: "oberon",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global-with-reconstruction",
    projection: "equirectangular",
    pageUrl: "https://science.nasa.gov/3d-resources/uranus-oberon/",
    assetUrl:
      "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/uranus---oberon/Uranus%20-%20Oberon.tif",
    credit: "USGS/Tammy Becker and JPL/Caltech",
    limitations:
      "Voyager mosaic with reconstruction outside observed coverage; the NASA page's JPEG link incorrectly targets Ariel, so the authoritative TIFF is used.",
  },
  {
    id: "pluto",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global-with-unobserved-region",
    projection: "simple-cylindrical",
    pageUrl:
      "https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m",
    assetUrl:
      "https://planetarymaps.usgs.gov/mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
    credit: "NASA/JHUAPL/SwRI and USGS Astrogeology Science Center",
    limitations:
      "New Horizons global grayscale mosaic; unilluminated terrain remains black rather than being invented.",
  },
  {
    id: "charon",
    role: "surface-color",
    classification: "observational-composite",
    coverage: "global-with-unobserved-region",
    projection: "equirectangular",
    pageUrl:
      "https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m",
    assetUrl:
      "https://planetarymaps.usgs.gov/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif",
    credit: "NASA/JHUAPL/SwRI and USGS Astrogeology Science Center",
    limitations:
      "New Horizons global grayscale mosaic; unilluminated southern terrain remains black rather than being invented.",
  },
];

const materialPresentations = [
  {
    id: "uranus",
    classification: "observation-constrained-atmosphere",
    color: "#8fd8dc",
    pageUrl: "https://science.nasa.gov/photojournal/uranus/",
    credit: "NASA/JPL Voyager 2",
    limitations:
      "Approximate visible-atmosphere base color constrained by Voyager 2 imagery. Uranus has no solid visible surface and no complete contemporaneous global cloud map, so no fictional terrain texture is applied.",
  },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function assertPinnedSource(path, expectedSha256, assetId) {
  if (expectedSha256 === undefined) {
    return;
  }
  const actualSha256 = sha256(await readFile(path));
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Authority source ${assetId} checksum ${actualSha256} does not match ${expectedSha256}`,
    );
  }
}

async function downloadUrl(url, sourcePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Authority asset ${url} returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Authority asset ${url} returned ${contentType || "no content type"}`,
    );
  }
  if (response.body === null) {
    throw new Error(`Authority asset ${url} returned no body`);
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(sourcePath),
  );
  return contentType;
}

async function downloadSource(resource, temporaryDirectory) {
  const sourcePath = join(temporaryDirectory, `${resource.id}.source`);
  const cacheDirectory = globalThis.process?.env["SOLAR_ASSET_CACHE_DIRECTORY"];
  if (cacheDirectory !== undefined && resource.cachedFileName !== undefined) {
    const cachedPath = join(cacheDirectory, resource.cachedFileName);
    await assertPinnedSource(cachedPath, resource.sourceSha256, resource.id);
    await copyFile(cachedPath, sourcePath);
    return {
      sourcePath,
      sourceContentType: resource.sourceContentType,
    };
  }
  const sourceContentType = await downloadUrl(resource.assetUrl, sourcePath);
  await assertPinnedSource(sourcePath, resource.sourceSha256, resource.id);
  return { sourcePath, sourceContentType };
}

function requiredFitsInteger(header, key) {
  for (let offset = 0; offset < header.length; offset += 80) {
    const card = header.subarray(offset, offset + 80).toString("ascii");
    if (card.slice(0, 8).trim() === key) {
      const parsed = Number.parseInt(card.slice(10).split("/")[0].trim(), 10);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
      break;
    }
  }
  throw new Error(`FITS header is missing integer ${key}`);
}

async function decodeSaturnFits(resource, sourcePath, temporaryDirectory) {
  const source = await readFile(sourcePath);
  const header = source.subarray(0, 2_880);
  const bitpix = requiredFitsInteger(header, "BITPIX");
  const axes = requiredFitsInteger(header, "NAXIS");
  const width = requiredFitsInteger(header, "NAXIS1");
  const height = requiredFitsInteger(header, "NAXIS2");
  const bands = requiredFitsInteger(header, "NAXIS3");
  if (bitpix !== -32 || axes !== 3 || bands !== 3) {
    throw new Error(
      `Authority asset ${resource.id} must be a three-band big-endian float32 FITS image`,
    );
  }
  const pixelCount = width * height;
  const expectedBytes = 2_880 + pixelCount * bands * 4;
  if (source.length < expectedBytes) {
    throw new Error(
      `Authority asset ${resource.id} is truncated at ${String(source.length)} bytes`,
    );
  }
  const rgb = Buffer.allocUnsafe(pixelCount * 3);
  const observedMask = Buffer.alloc(pixelCount);
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    const outputY = height - sourceY - 1;
    for (let x = 0; x < width; x += 1) {
      const sourcePixel = sourceY * width + x;
      const outputPixel = outputY * width + x;
      let observed = false;
      for (let band = 0; band < bands; band += 1) {
        const value = source.readFloatBE(
          2_880 + (band * pixelCount + sourcePixel) * 4,
        );
        if (!Number.isFinite(value)) {
          throw new Error(
            `Authority asset ${resource.id} contains a non-finite sample`,
          );
        }
        const channel = Math.round(Math.min(255, Math.max(0, value)));
        rgb[outputPixel * 3 + band] = channel;
        observed ||= channel > 0;
      }
      observedMask[outputPixel] = observed ? 255 : 0;
    }
  }
  const supportingUrl = resource.supportingAssetUrls?.[0];
  if (supportingUrl === undefined) {
    throw new Error(
      `Authority asset ${resource.id} requires a declared fill source`,
    );
  }
  const fallbackPath = join(temporaryDirectory, `${resource.id}.fallback`);
  await downloadUrl(supportingUrl, fallbackPath);
  const fallback = await sharp(fallbackPath, {
    failOn: "error",
    limitInputPixels: false,
  })
    .resize({ width, height, fit: "fill" })
    .modulate({ saturation: 0.35 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const featheredMaskOutput = await sharp(observedMask, {
    raw: { width, height, channels: 1 },
  })
    .blur(12)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (featheredMaskOutput.info.channels !== 1) {
    throw new Error(
      `Authority asset ${resource.id} mask must remain single-channel`,
    );
  }
  const featheredMask = featheredMaskOutput.data;
  const observedRgba = Buffer.allocUnsafe(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    observedRgba[index * 4] = rgb[index * 3];
    observedRgba[index * 4 + 1] = rgb[index * 3 + 1];
    observedRgba[index * 4 + 2] = rgb[index * 3 + 2];
    observedRgba[index * 4 + 3] = featheredMask[index];
  }
  return {
    input: sharp(fallback, { raw: { width, height, channels: 3 } }).composite([
      {
        input: observedRgba,
        raw: { width, height, channels: 4 },
        blend: "over",
      },
    ]),
    sourceWidth: width,
    sourceHeight: height,
  };
}

async function standardImageInput(sourcePath) {
  const input = sharp(sourcePath, {
    failOn: "error",
    limitInputPixels: false,
    sequentialRead: true,
  });
  const sourceMetadata = await input.metadata();
  if (
    sourceMetadata.width === undefined ||
    sourceMetadata.height === undefined ||
    sourceMetadata.width < 2 ||
    sourceMetadata.height < 2
  ) {
    throw new Error("Authority asset has invalid dimensions");
  }
  return {
    input,
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
  };
}

async function processAsset(resource, temporaryDirectory) {
  const { sourcePath, sourceContentType } = await downloadSource(
    resource,
    temporaryDirectory,
  );
  const decoded =
    resource.decoder === "fits-rgb-f32-be"
      ? await decodeSaturnFits(resource, sourcePath, temporaryDirectory)
      : await standardImageInput(sourcePath);
  const maximumWidth = resource.maximumWidth ?? DEFAULT_MAXIMUM_WIDTH;
  const maximumHeight = resource.maximumHeight ?? DEFAULT_MAXIMUM_HEIGHT;
  const profileCropFraction = resource.profileCropFraction;
  const resized =
    profileCropFraction === undefined
      ? decoded.input.resize({
          width: maximumWidth,
          height: maximumHeight,
          fit: "inside",
          withoutEnlargement: true,
        })
      : decoded.input
          .extract({
            left: 0,
            top: Math.round(
              (decoded.sourceHeight * (1 - profileCropFraction)) / 2,
            ),
            width: decoded.sourceWidth,
            height: Math.round(decoded.sourceHeight * profileCropFraction),
          })
          .resize({
            width: maximumWidth,
            height: maximumHeight,
            fit: "fill",
            withoutEnlargement: true,
          });
  const outputFormat = resource.outputFormat ?? "webp";
  const output =
    outputFormat === "png"
      ? await resized.png({ compressionLevel: 9 }).toBuffer({
          resolveWithObject: true,
        })
      : await resized
          .webp({ quality: 92, effort: 6, smartSubsample: true })
          .toBuffer({ resolveWithObject: true });
  const bytes = Buffer.from(output.data);
  const extension = outputFormat;
  const fileName = `${resource.id}.${extension}`;
  await writeFile(new URL(fileName, OUTPUT_DIRECTORY), bytes);
  return {
    id: resource.id,
    role: resource.role,
    file: `/textures/nasa/${fileName}`,
    classification: resource.classification,
    coverage: resource.coverage,
    projection: resource.projection,
    pageUrl: resource.pageUrl,
    assetUrl: resource.assetUrl,
    ...(resource.supportingAssetUrls === undefined
      ? {}
      : { supportingAssetUrls: resource.supportingAssetUrls }),
    credit: resource.credit,
    limitations: resource.limitations,
    sourceContentType,
    contentType: outputFormat === "png" ? "image/png" : "image/webp",
    sourceWidth: decoded.sourceWidth,
    sourceHeight: decoded.sourceHeight,
    ...(resource.sourceSha256 === undefined
      ? {}
      : { sourceSha256: resource.sourceSha256 }),
    width: output.info.width,
    height: output.info.height,
    byteLength: bytes.length,
    sha256: sha256(bytes),
  };
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const temporaryDirectory = await mkdtemp(join(tmpdir(), "solar-assets-"));
try {
  const assets = [];
  for (const resource of [...resources, ...directResources]) {
    assets.push(await processAsset(resource, temporaryDirectory));
    console.log(`Installed ${resource.id}`);
  }
  const manifest = {
    schemaVersion: "2.0.0",
    authority: "NASA, JPL, and USGS",
    generatedAt: new Date().toISOString(),
    note: "Every file is derived from an explicit authority URL. Coverage and limitations distinguish measured composites, filled regions, and visualizations without inventing unknown terrain.",
    assets,
    materialPresentations,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    writeFile(new URL("manifest.json", OUTPUT_DIRECTORY), manifestText),
    writeFile(SOURCE_MANIFEST_PATH, manifestText),
  ]);
  console.log(`Wrote ${assets.length} authority texture records`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
