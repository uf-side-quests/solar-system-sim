import { Box3, Color, DoubleSide, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import { DISCOVERY_ONE_BODY_ID, DISCOVERY_ONE_LENGTH_M } from "./discovery-one";
import { createDiscoveryOneModel } from "./discovery-one-model";

describe("Discovery One model", () => {
  it("uses physical scale, selectable parts and non-emissive hull lighting", () => {
    const model = createDiscoveryOneModel();
    model.updateMatrixWorld(true);
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    expect(size.x * ASTRONOMICAL_UNIT_M).toBeCloseTo(DISCOVERY_ONE_LENGTH_M, 0);
    let meshCount = 0;
    let hullEmissiveHex: number | undefined;
    model.traverse((object) => {
      if (object.type !== "Mesh") {
        return;
      }
      meshCount += 1;
      expect(object.userData["bodyId"]).toBe(DISCOVERY_ONE_BODY_ID);
      const material = (object as import("three").Mesh).material;
      const materials = Array.isArray(material) ? material : [material];
      for (const candidate of materials) {
        expect(candidate.transparent).toBe(false);
        expect(candidate.opacity).toBe(1);
        expect(candidate.depthWrite).toBe(true);
        expect(candidate.side).toBe(DoubleSide);
        if (candidate.name === "Discovery warm white ceramic hull") {
          const emissive: unknown = Reflect.get(candidate, "emissive");
          if (!(emissive instanceof Color)) {
            throw new Error("Discovery hull emissive colour is unavailable");
          }
          hullEmissiveHex = emissive.getHex();
        }
      }
    });
    expect(meshCount).toBeGreaterThan(100);
    expect(hullEmissiveHex).toBe(0);
    expect(model.userData["visualReferenceUrl"]).toContain(
      "commons.wikimedia.org",
    );
    expect(model.userData["exteriorMaterialContract"]).toBe(
      "opaque-two-sided-depth-writing",
    );
  });
});
