import {
  DoubleSide,
  Material,
  Mesh,
  NormalBlending,
  type Object3D,
} from "three";

export type ExteriorMaterialReport = Readonly<{
  meshCount: number;
  materialCount: number;
  repairedMaterialCount: number;
}>;

function materialsForObject(object: Object3D): Material[] {
  const candidate: unknown = Reflect.get(object, "material");
  if (candidate instanceof Material) {
    return [candidate as Material];
  }
  if (
    Array.isArray(candidate) &&
    candidate.every((entry: unknown) => entry instanceof Material)
  ) {
    return candidate.map((entry: unknown) => entry as Material);
  }
  throw new Error(`Mesh ${object.name || "unnamed"} has invalid materials`);
}

/**
 * Imported and authored exterior models must remain solid from every camera
 * angle. This deliberately removes alpha/transmission exported for showcase
 * viewers because it exposes the sky through thin or open-backed body panels.
 */
export function enforceOpaqueTwoSidedExterior(
  root: Object3D,
): ExteriorMaterialReport {
  let meshCount = 0;
  let materialCount = 0;
  let repairedMaterialCount = 0;
  const visitedMaterials = new Set<Material>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    meshCount += 1;
    for (const material of materialsForObject(object)) {
      if (visitedMaterials.has(material)) {
        continue;
      }
      visitedMaterials.add(material);
      materialCount += 1;
      material.side = DoubleSide;
      material.transparent = false;
      material.opacity = 1;
      material.alphaTest = 0;
      material.depthTest = true;
      material.depthWrite = true;
      material.blending = NormalBlending;
      if ("transmission" in material) {
        Reflect.set(material, "transmission", 0);
      }
      material.needsUpdate = true;
      repairedMaterialCount += 1;
    }
  });

  return { meshCount, materialCount, repairedMaterialCount };
}
