import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import type { FictionalOrbiter } from "./fictional-orbiters";

function selectableMesh(
  geometry:
    | BoxGeometry
    | CylinderGeometry
    | RingGeometry
    | SphereGeometry
    | TorusGeometry,
  material: MeshBasicMaterial | MeshPhysicalMaterial | MeshStandardMaterial,
  bodyId: string,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.userData["bodyId"] = bodyId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createDeathStarModel(orbiter: FictionalOrbiter): Group {
  const group = new Group();
  group.name = `${orbiter.name} original physical-scale visualization`;
  group.userData["bodyId"] = orbiter.id;
  group.scale.setScalar(orbiter.diameterM / 2 / ASTRONOMICAL_UNIT_M);
  const modelRoot = new Group();
  modelRoot.name = `${orbiter.name} presentation geometry`;
  modelRoot.userData["bodyId"] = orbiter.id;
  group.add(modelRoot);

  const hull = new MeshPhysicalMaterial({
    name: "Fictional battle station panelled hull",
    color: orbiter.constructionState === "complete" ? 0x73797c : 0x666d71,
    emissive: 0x20282c,
    emissiveIntensity: 0.72,
    metalness: 0.62,
    roughness: 0.58,
    clearcoat: 0.08,
  });
  const trench = new MeshStandardMaterial({
    name: "Fictional battle station equatorial trench",
    color: 0x14191c,
    metalness: 0.74,
    roughness: 0.62,
  });
  const interior = new MeshBasicMaterial({
    name: "Fictional exposed construction interior",
    color: 0x536269,
  });
  const interiorVoid = new MeshBasicMaterial({
    name: "Fictional exposed construction void",
    color: 0x090d0f,
  });
  const laser = new MeshPhysicalMaterial({
    name: "Fictional superlaser lens",
    color: 0x273033,
    emissive: 0x08100d,
    emissiveIntensity: 0.2,
    metalness: 0.7,
    roughness: 0.48,
    clearcoat: 0.12,
  });

  const spherePhiLength =
    orbiter.constructionState === "complete" ? Math.PI * 2 : Math.PI * 1.55;
  const spherePhiStart =
    orbiter.constructionState === "complete" ? 0 : Math.PI * 0.475;
  const shell = selectableMesh(
    new SphereGeometry(1, 128, 80, spherePhiStart, spherePhiLength),
    hull,
    orbiter.id,
  );
  shell.name = `${orbiter.name} main hull`;
  modelRoot.add(shell);

  if (orbiter.constructionState === "complete") {
    const equatorialTrench = selectableMesh(
      new TorusGeometry(1.003, 0.018, 8, 192),
      trench,
      orbiter.id,
    );
    equatorialTrench.name = "Equatorial trench";
    equatorialTrench.rotation.x = Math.PI / 2;
    modelRoot.add(equatorialTrench);
  }

  const dishRim = selectableMesh(
    new TorusGeometry(0.22, 0.018, 8, 64),
    trench,
    orbiter.id,
  );
  dishRim.name = "Superlaser dish rim";
  dishRim.position.set(0.34, 0.3, 0.89);
  modelRoot.add(dishRim);
  const dishLens = selectableMesh(
    new CircleGeometryWithSafeType(0.2, 64),
    laser,
    orbiter.id,
  );
  dishLens.name = "Superlaser dish";
  dishLens.position.set(0.34, 0.3, 0.895);
  modelRoot.add(dishLens);

  for (let latitudeIndex = -5; latitudeIndex <= 5; latitudeIndex += 1) {
    if (latitudeIndex === 0 || orbiter.constructionState === "incomplete") {
      continue;
    }
    const latitude = (latitudeIndex * Math.PI) / 12;
    const radius = Math.cos(latitude);
    const band = selectableMesh(
      new TorusGeometry(radius * 1.002, 0.004, 4, 128),
      trench,
      orbiter.id,
    );
    band.position.y = Math.sin(latitude);
    band.rotation.x = Math.PI / 2;
    modelRoot.add(band);
  }

  if (orbiter.constructionState === "incomplete") {
    const constructionFrame = new Group();
    constructionFrame.name = "Death Star II exposed internal construction";
    constructionFrame.position.set(0, 0, 0.3);
    constructionFrame.userData["bodyId"] = orbiter.id;

    const exposedVoid = selectableMesh(
      new CircleGeometryWithSafeType(0.94, 128),
      interiorVoid,
      orbiter.id,
    );
    exposedVoid.name = "Exposed incomplete hull interior";
    exposedVoid.position.z = -0.18;
    constructionFrame.add(exposedVoid);

    for (const x of [-0.62, -0.4, -0.18, 0.18, 0.4, 0.62]) {
      const height = Math.sqrt(1 - x * x) * 1.65;
      const verticalFrame = selectableMesh(
        new BoxGeometry(0.018, height, 0.018),
        interior,
        orbiter.id,
      );
      verticalFrame.position.x = x;
      constructionFrame.add(verticalFrame);
    }
    for (const y of [-0.64, -0.42, -0.2, 0.2, 0.42, 0.64]) {
      const width = Math.sqrt(1 - y * y) * 1.65;
      const horizontalFrame = selectableMesh(
        new BoxGeometry(width, 0.018, 0.018),
        interior,
        orbiter.id,
      );
      horizontalFrame.position.y = y;
      constructionFrame.add(horizontalFrame);
    }
    for (const radius of [0.26, 0.48, 0.7, 0.86]) {
      const scaffold = selectableMesh(
        new TorusGeometry(radius, 0.01, 5, 96),
        interior,
        orbiter.id,
      );
      constructionFrame.add(scaffold);
    }
    const reactorCore = selectableMesh(
      new CylinderGeometry(0.12, 0.12, 1.25, 24),
      interior,
      orbiter.id,
    );
    reactorCore.rotation.x = Math.PI / 2;
    constructionFrame.add(reactorCore);
    modelRoot.add(constructionFrame);
  }

  return group;
}

// Keep the accepted geometry union explicit without widening selectableMesh to
// arbitrary BufferGeometry.
class CircleGeometryWithSafeType extends RingGeometry {
  constructor(radius: number, segments: number) {
    super(0, radius, segments);
  }
}
