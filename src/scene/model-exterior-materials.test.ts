import {
  BoxGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it } from "vitest";

import { enforceOpaqueTwoSidedExterior } from "./model-exterior-materials";

describe("exterior model material repair", () => {
  it("makes shared opaque and transmissive materials solid from both sides", () => {
    const root = new Group();
    const paint = new MeshStandardMaterial({
      opacity: 0.45,
      side: FrontSide,
      transparent: true,
    });
    const glass = new MeshPhysicalMaterial({
      opacity: 0.2,
      side: FrontSide,
      transmission: 0.8,
      transparent: true,
    });
    root.add(new Mesh(new BoxGeometry(), [paint, glass]));
    root.add(new Mesh(new BoxGeometry(), paint));

    const report = enforceOpaqueTwoSidedExterior(root);

    expect(report).toEqual({
      meshCount: 2,
      materialCount: 2,
      repairedMaterialCount: 2,
    });
    for (const material of [paint, glass]) {
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(true);
      expect(material.side).not.toBe(FrontSide);
    }
    expect(glass.transmission).toBe(0);
  });
});
