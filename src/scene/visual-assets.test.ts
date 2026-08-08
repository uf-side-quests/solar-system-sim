import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { majorBodySnapshot } from "../physics/solar-system";
import {
  nasaMaterialPresentationByBodyId,
  nasaTextureByBodyId,
  nasaTextureSnapshot,
} from "./visual-assets";

const AUTHORITY_ASSET_HOSTS = new Set([
  "assets.science.nasa.gov",
  "eoimages.gsfc.nasa.gov",
  "planetarymaps.usgs.gov",
  "svs.gsfc.nasa.gov",
  "atmos.nmsu.edu",
]);

const NASA_VTAD_RECONSTRUCTED_MOONS = [
  "ariel",
  "umbriel",
  "titania",
  "miranda",
  "triton",
] as const;

describe("authority visual assets", () => {
  it("provides an explicit surface representation for every non-stellar major body", () => {
    const bodyIds = majorBodySnapshot.bodies
      .filter((body) => body.type !== "star")
      .map((body) => body.id);
    const missing = bodyIds.filter(
      (bodyId) =>
        !nasaTextureByBodyId.has(bodyId) &&
        !nasaMaterialPresentationByBodyId.has(bodyId),
    );
    expect(missing).toEqual([]);
  });

  it("uses an observation-constrained atmosphere instead of fictional Uranian terrain", () => {
    expect(nasaTextureByBodyId.has("uranus")).toBe(false);
    expect(nasaMaterialPresentationByBodyId.get("uranus")?.classification).toBe(
      "observation-constrained-atmosphere",
    );
  });

  it("uses measured New Horizons imagery for Pluto and leaves unobserved terrain explicit", () => {
    const pluto = nasaTextureByBodyId.get("pluto");
    expect(pluto?.classification).toBe("observational-composite");
    expect(pluto?.coverage).toBe("global-with-unobserved-region");
    expect(pluto?.projection).toBe("simple-cylindrical");
  });

  it("uses NASA VTAD reconstruction without presenting it as measured Voyager detail", async () => {
    for (const bodyId of NASA_VTAD_RECONSTRUCTED_MOONS) {
      const asset = nasaTextureByBodyId.get(bodyId);
      expect(asset?.coverage).toBe("global-with-reconstruction");
      expect(asset?.sourceContentType).toBe("model/gltf-binary");
      expect(asset?.assetUrl).toMatch(/\.glb$/u);
      expect(asset?.credit).toContain(
        "NASA Visualization Technology Applications and Development",
      );
      expect(asset?.limitations).toContain("authority model");
      expect(asset?.limitations).toContain(
        "no independently measured surface detail",
      );
      const imagePath = fileURLToPath(
        new URL(`../../public${asset?.file ?? ""}`, import.meta.url),
      );
      const decoded = await sharp(imagePath)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let maximumNearBlackRun = 0;
      let currentNearBlackRun = 0;
      const colors = new Set<string>();
      for (
        let offset = 0;
        offset < decoded.data.length;
        offset += decoded.info.channels
      ) {
        const red = decoded.data.readUInt8(offset);
        const green = decoded.data.readUInt8(offset + 1);
        const blue = decoded.data.readUInt8(offset + 2);
        if (Math.max(red, green, blue) <= 4) {
          const pixelIndex = offset / decoded.info.channels;
          const column = pixelIndex % decoded.info.width;
          currentNearBlackRun = column === 0 ? 1 : currentNearBlackRun + 1;
          maximumNearBlackRun = Math.max(
            maximumNearBlackRun,
            currentNearBlackRun,
          );
        } else {
          currentNearBlackRun = 0;
        }
        colors.add(`${String(red)},${String(green)},${String(blue)}`);
      }
      expect(maximumNearBlackRun / decoded.info.width).toBeLessThan(0.01);
      expect(colors.size).toBeGreaterThan(32);
    }
  }, 20_000);

  it("pins unique authority URLs, provenance, dimensions, and checksums", () => {
    const ids = nasaTextureSnapshot.assets.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of nasaTextureSnapshot.assets) {
      expect(AUTHORITY_ASSET_HOSTS.has(new URL(asset.assetUrl).hostname)).toBe(
        true,
      );
      expect(asset.credit.length).toBeGreaterThan(0);
      expect(asset.limitations.length).toBeGreaterThan(0);
      expect(asset.width).toBeLessThanOrEqual(asset.sourceWidth);
      expect(asset.height).toBeLessThanOrEqual(asset.sourceHeight);
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/u);
      for (const supportingUrl of asset.supportingAssetUrls ?? []) {
        expect(AUTHORITY_ASSET_HOSTS.has(new URL(supportingUrl).hostname)).toBe(
          true,
        );
      }
    }
  });

  it("installs four-kilopixel detail for the flagship high-resolution maps", () => {
    for (const bodyId of [
      "mercury",
      "earth",
      "moon",
      "ganymede",
      "enceladus",
      "pluto",
      "charon",
    ]) {
      expect(nasaTextureByBodyId.get(bodyId)?.width).toBe(4_096);
    }
  });

  it("keeps Saturn's globe ring-free and its Cassini rings separate", async () => {
    const saturn = nasaTextureByBodyId.get("saturn");
    const rings = nasaTextureSnapshot.assets.find(
      (asset) => asset.id === "saturn-rings",
    );
    expect(saturn?.sourceWidth).toBe(4_096);
    expect(saturn?.sourceHeight).toBe(3_072);
    expect(saturn?.width).toBe(4_096);
    expect(saturn?.height).toBe(2_048);
    expect(saturn?.classification).toBe("visualization");
    expect(saturn?.sourceContentType).toBe("model/gltf-binary");
    expect(saturn?.limitations).toContain("contains no rings");
    expect(rings?.role).toBe("ring-color-opacity");
    expect(rings?.coverage).toBe("radial-observation");
    expect(rings?.width).toBe(4_096);

    const imagePath = fileURLToPath(
      new URL(`../../public${saturn?.file ?? ""}`, import.meta.url),
    );
    const decoded = await sharp(imagePath)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let maximumNearBlackRowFraction = 0;
    for (let y = 0; y < decoded.info.height; y += 1) {
      let nearBlackPixels = 0;
      for (let x = 0; x < decoded.info.width; x += 1) {
        const offset = (y * decoded.info.width + x) * decoded.info.channels;
        if (
          Math.max(
            decoded.data.readUInt8(offset),
            decoded.data.readUInt8(offset + 1),
            decoded.data.readUInt8(offset + 2),
          ) < 48
        ) {
          nearBlackPixels += 1;
        }
      }
      maximumNearBlackRowFraction = Math.max(
        maximumNearBlackRowFraction,
        nearBlackPixels / decoded.info.width,
      );
    }
    expect(maximumNearBlackRowFraction).toBeLessThan(0.001);
  });
});
