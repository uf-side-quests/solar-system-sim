import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const sourcePath = process.argv[2];
const sourceAssetUrl =
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg";

const outputPath = new URL(
  "../public/textures/nasa/earth-night-lights.webp",
  import.meta.url,
);
const snapshotPath = new URL(
  "../src/data/nasa-textures.snapshot.json",
  import.meta.url,
);
const publicManifestPath = new URL(
  "../public/textures/nasa/manifest.json",
  import.meta.url,
);
const source =
  sourcePath === undefined
    ? Buffer.from(await (await fetch(sourceAssetUrl)).arrayBuffer())
    : await readFile(sourcePath);
if (source.length === 0) {
  throw new Error("NASA Earth night-light download is empty");
}
const sourceMetadata = await sharp(source).metadata();
if (sourceMetadata.width !== 3_600 || sourceMetadata.height !== 1_800) {
  throw new Error("NASA Earth night-light source must be 3600 x 1800 pixels");
}
await sharp(source)
  .webp({ quality: 92, smartSubsample: true })
  .toFile(fileURLToPath(outputPath));
const output = await readFile(outputPath);
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
snapshot.assets = snapshot.assets.filter(
  (asset) => asset.id !== "earth-night-lights",
);
snapshot.assets.push({
  id: "earth-night-lights",
  role: "night-emission",
  file: "/textures/nasa/earth-night-lights.webp",
  classification: "observational-composite",
  coverage: "global",
  projection: "equirectangular",
  pageUrl:
    "https://visibleearth.nasa.gov/images/144898/earth-at-night-black-marble-2016-color-maps/144957l",
  assetUrl: sourceAssetUrl,
  credit:
    "NASA Earth Observatory, Joshua Stevens, Suomi NPP VIIRS, and Miguel Roman, NASA GSFC",
  limitations:
    "Cloud-free 2016 composite. It shows observed human light emissions, not a live map for the simulation time.",
  sourceContentType: "image/jpeg",
  contentType: "image/webp",
  sourceWidth: sourceMetadata.width,
  sourceHeight: sourceMetadata.height,
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  width: sourceMetadata.width,
  height: sourceMetadata.height,
  byteLength: output.length,
  sha256: createHash("sha256").update(output).digest("hex"),
});
const manifestText = `${JSON.stringify(snapshot, null, 2)}\n`;
await Promise.all([
  writeFile(snapshotPath, manifestText),
  writeFile(publicManifestPath, manifestText),
]);
