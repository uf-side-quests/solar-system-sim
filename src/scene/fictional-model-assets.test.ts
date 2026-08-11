import { describe, expect, it } from "vitest";

import {
  fictionalModelAssetByBodyId,
  fictionalModelAssets,
} from "./fictional-model-assets";

describe("licensed fictional model assets", () => {
  it("registers each installed model with a stable hash and attribution", () => {
    expect(fictionalModelAssets).toHaveLength(4);
    expect(fictionalModelAssetByBodyId.size).toBe(4);
    for (const asset of fictionalModelAssets) {
      expect(asset.modelUrl).toMatch(/^\/models\/community\/.+\.glb$/u);
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/u);
      expect(asset.credit).toMatch(/Sketchfab/u);
      expect(asset.maximumDimensionM).toBeGreaterThan(0);
    }
  });

  it("keeps the PBR Death Star II and the high-detail Defiant distinct", () => {
    expect(fictionalModelAssetByBodyId.get("death-star-2")?.modelUrl).toBe(
      "/models/community/death-star-ii.glb",
    );
    expect(fictionalModelAssetByBodyId.get("uss-defiant")?.modelUrl).toBe(
      "/models/community/uss-defiant.glb",
    );
  });
});
