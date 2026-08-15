import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const snapshotUrl = new URL(
  "../src/data/nasa-textures.snapshot.json",
  import.meta.url,
);
const publicManifestUrl = new URL(
  "../public/textures/nasa/manifest.json",
  import.meta.url,
);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function installDerivedMap({
  id,
  role,
  sourceId,
  fileName,
  credit,
  limitations,
  derive,
}) {
  const sourceAsset = snapshot.assets.find((asset) => asset.id === sourceId);
  if (sourceAsset === undefined) {
    throw new Error(`Authority source ${sourceId} is unavailable`);
  }
  const sourceUrl = new URL(`../public${sourceAsset.file}`, import.meta.url);
  const source = await readFile(sourceUrl);
  const sourceImage = await sharp(source)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const outputBuffer = await derive(sourceImage.data, sourceImage.info);
  const outputUrl = new URL(
    `../public/textures/nasa/${fileName}`,
    import.meta.url,
  );
  await sharp(outputBuffer, {
    raw: {
      width: sourceImage.info.width,
      height: sourceImage.info.height,
      channels: 3,
    },
  })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(fileURLToPath(outputUrl));
  const output = await readFile(outputUrl);
  snapshot.assets = snapshot.assets.filter((asset) => asset.id !== id);
  snapshot.assets.push({
    id,
    role,
    file: `/textures/nasa/${fileName}`,
    classification: "authority-derived-material",
    coverage: sourceAsset.coverage,
    projection: sourceAsset.projection,
    pageUrl: sourceAsset.pageUrl,
    assetUrl: sourceAsset.assetUrl,
    supportingAssetUrls: [sourceAsset.assetUrl],
    credit,
    limitations,
    sourceContentType: sourceAsset.contentType,
    contentType: "image/webp",
    sourceWidth: sourceAsset.width,
    sourceHeight: sourceAsset.height,
    sourceSha256: sourceAsset.sha256,
    width: sourceImage.info.width,
    height: sourceImage.info.height,
    byteLength: output.length,
    sha256: sha256(output),
  });
}

await installDerivedMap({
  id: "moon-normal",
  role: "surface-normal",
  sourceId: "moon-height",
  fileName: "moon-normal.webp",
  credit: "Derived from NASA SVS and LOLA measured elevation",
  limitations:
    "A Sobel normal map derived from LOLA elevation. The renderer scales the relief for visibility and does not displace the globe geometry.",
  derive(data, info) {
    const output = Buffer.alloc(info.width * info.height * 3);
    const channelCount = info.channels;
    const sample = (x, y) => {
      const wrappedX = (x + info.width) % info.width;
      const clampedY = Math.max(0, Math.min(info.height - 1, y));
      return data[(clampedY * info.width + wrappedX) * channelCount] / 255;
    };
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const gradientX =
          sample(x + 1, y - 1) +
          2 * sample(x + 1, y) +
          sample(x + 1, y + 1) -
          sample(x - 1, y - 1) -
          2 * sample(x - 1, y) -
          sample(x - 1, y + 1);
        const gradientY =
          sample(x - 1, y + 1) +
          2 * sample(x, y + 1) +
          sample(x + 1, y + 1) -
          sample(x - 1, y - 1) -
          2 * sample(x, y - 1) -
          sample(x + 1, y - 1);
        const normalX = -gradientX * 2.5;
        const normalY = -gradientY * 2.5;
        const inverseLength = 1 / Math.hypot(normalX, normalY, 1);
        const offset = (y * info.width + x) * 3;
        output[offset] = Math.round(
          (normalX * inverseLength * 0.5 + 0.5) * 255,
        );
        output[offset + 1] = Math.round(
          (normalY * inverseLength * 0.5 + 0.5) * 255,
        );
        output[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      }
    }
    return output;
  },
});

await installDerivedMap({
  id: "earth-roughness",
  role: "surface-roughness",
  sourceId: "earth",
  fileName: "earth-roughness.webp",
  credit: "Derived from the NASA Earth Observatory Blue Marble composite",
  limitations:
    "A declared water-versus-land material estimate derived from Blue Marble colour. It is not a measured BRDF product.",
  derive(data, info) {
    const output = Buffer.alloc(info.width * info.height * 3);
    for (let index = 0; index < info.width * info.height; index += 1) {
      const sourceOffset = index * info.channels;
      const red = data[sourceOffset] / 255;
      const green = data[sourceOffset + 1] / 255;
      const blue = data[sourceOffset + 2] / 255;
      const waterEvidence = Math.max(
        0,
        Math.min(1, (blue - Math.max(red, green * 0.85)) * 5),
      );
      const iceEvidence = Math.max(
        0,
        Math.min(1, (red + green + blue - 2.35) * 3),
      );
      const roughness =
        0.82 * (1 - waterEvidence) + 0.24 * waterEvidence + 0.12 * iceEvidence;
      const encoded = Math.round(Math.min(1, roughness) * 255);
      const outputOffset = index * 3;
      output[outputOffset] = encoded;
      output[outputOffset + 1] = encoded;
      output[outputOffset + 2] = encoded;
    }
    return output;
  },
});

const manifestText = `${JSON.stringify(snapshot, null, 2)}\n`;
await Promise.all([
  writeFile(snapshotUrl, manifestText),
  writeFile(publicManifestUrl, manifestText),
]);
