import { describe, expect, it } from "vitest";

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

  it("installs the Cassini radial observation instead of procedural Saturn bands", () => {
    const saturn = nasaTextureByBodyId.get("saturn");
    const rings = nasaTextureSnapshot.assets.find(
      (asset) => asset.id === "saturn-rings",
    );
    expect(saturn?.sourceWidth).toBe(3_601);
    expect(saturn?.sourceHeight).toBe(1_801);
    expect(saturn?.classification).toBe("observational-composite");
    expect(rings?.role).toBe("ring-color-opacity");
    expect(rings?.coverage).toBe("radial-observation");
    expect(rings?.width).toBe(4_096);
  });
});
