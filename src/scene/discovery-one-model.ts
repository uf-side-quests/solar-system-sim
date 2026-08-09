import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import {
  DISCOVERY_ONE_BODY_ID,
  DISCOVERY_ONE_LENGTH_M,
  DISCOVERY_ONE_VISUAL_REFERENCE_URL,
} from "./discovery-one";
import { enforceOpaqueTwoSidedExterior } from "./model-exterior-materials";

type DiscoveryMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

function part(
  geometry: BufferGeometry,
  material: DiscoveryMaterial,
  name: string,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.userData["bodyId"] = DISCOVERY_ONE_BODY_ID;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function beamBetween(
  start: Vector3,
  end: Vector3,
  radiusM: number,
  material: DiscoveryMaterial,
  name: string,
): Mesh {
  const direction = end.clone().sub(start);
  const beam = part(
    new CylinderGeometry(radiusM, radiusM, direction.length(), 8),
    material,
    name,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.normalize(),
  );
  return beam;
}

function addTrussBay(
  root: Group,
  centerX: number,
  bayLengthM: number,
  halfWidthM: number,
  structure: DiscoveryMaterial,
): void {
  const x0 = centerX - bayLengthM / 2;
  const x1 = centerX + bayLengthM / 2;
  const corners = [
    new Vector3(0, halfWidthM, halfWidthM),
    new Vector3(0, halfWidthM, -halfWidthM),
    new Vector3(0, -halfWidthM, halfWidthM),
    new Vector3(0, -halfWidthM, -halfWidthM),
  ];
  for (const [index, corner] of corners.entries()) {
    root.add(
      beamBetween(
        new Vector3(x0, corner.y, corner.z),
        new Vector3(x1, corner.y, corner.z),
        0.11,
        structure,
        `Discovery truss longeron ${String(index + 1)}`,
      ),
    );
  }
  const edges: readonly [number, number][] = [
    [0, 1],
    [0, 2],
    [3, 1],
    [3, 2],
  ];
  for (const [first, second] of edges) {
    const firstCorner = corners[first];
    const secondCorner = corners[second];
    if (firstCorner === undefined || secondCorner === undefined) {
      throw new Error("Discovery truss corner is unavailable");
    }
    root.add(
      beamBetween(
        new Vector3(x0, firstCorner.y, firstCorner.z),
        new Vector3(x1, secondCorner.y, secondCorner.z),
        0.075,
        structure,
        "Discovery diagonal truss brace",
      ),
    );
    root.add(
      beamBetween(
        new Vector3(x1, firstCorner.y, firstCorner.z),
        new Vector3(x0, secondCorner.y, secondCorner.z),
        0.075,
        structure,
        "Discovery crossing truss brace",
      ),
    );
  }
}

export function createDiscoveryOneModel(): Group {
  const root = new Group();
  root.name = "Discovery One detailed physical-scale visualization";
  root.userData["bodyId"] = DISCOVERY_ONE_BODY_ID;
  root.userData["visualSource"] =
    "original-procedural-model-from-open-museum-photography-v1";
  root.userData["visualReferenceUrl"] = DISCOVERY_ONE_VISUAL_REFERENCE_URL;
  root.userData["physicalLengthM"] = DISCOVERY_ONE_LENGTH_M;
  root.scale.setScalar(1 / ASTRONOMICAL_UNIT_M);

  const hull = new MeshPhysicalMaterial({
    name: "Discovery warm white ceramic hull",
    color: 0xc9c8bf,
    metalness: 0.12,
    roughness: 0.76,
    clearcoat: 0.12,
    clearcoatRoughness: 0.68,
  });
  const panel = new MeshStandardMaterial({
    name: "Discovery recessed hull panels",
    color: 0x70736f,
    metalness: 0.42,
    roughness: 0.7,
  });
  const structure = new MeshStandardMaterial({
    name: "Discovery graphite truss structure",
    color: 0x2a2e2d,
    metalness: 0.64,
    roughness: 0.52,
  });
  const engine = new MeshStandardMaterial({
    name: "Discovery nuclear engine shielding",
    color: 0x5f625e,
    metalness: 0.72,
    roughness: 0.46,
  });
  const glass = new MeshPhysicalMaterial({
    name: "Discovery flight deck windows",
    color: 0x152129,
    emissive: 0x7b9aaa,
    emissiveIntensity: 0.18,
    metalness: 0.22,
    roughness: 0.14,
    clearcoat: 0.9,
  });

  const commandSphere = part(
    new SphereGeometry(8.35, 72, 48),
    hull,
    "Discovery command sphere",
  );
  commandSphere.position.x = -61.7;
  root.add(commandSphere);

  const equatorialBand = part(
    new TorusGeometry(8.38, 0.24, 12, 96),
    panel,
    "Discovery command sphere equatorial service band",
  );
  equatorialBand.position.x = -61.7;
  equatorialBand.rotation.y = Math.PI / 2;
  root.add(equatorialBand);

  for (let index = 0; index < 7; index += 1) {
    const angle = -0.54 + index * 0.18;
    const window = part(
      new BoxGeometry(0.22, 0.8, 1.05),
      glass,
      "Discovery flight deck window",
    );
    window.position.set(
      -69.66,
      Math.sin(angle) * 3.7 + 2.4,
      Math.cos(angle) * 3.7,
    );
    window.rotation.x = angle;
    root.add(window);
  }

  for (let index = 0; index < 3; index += 1) {
    const podBayDoor = part(
      new BoxGeometry(0.18, 2.25, 2.65),
      panel,
      `Discovery pod bay door ${String(index + 1)}`,
    );
    podBayDoor.position.set(-68.95, -1.2, (index - 1) * 3.05);
    root.add(podBayDoor);
  }

  const neck = part(
    new CylinderGeometry(1.2, 1.65, 9.2, 20),
    hull,
    "Discovery command sphere neck",
  );
  neck.rotation.z = Math.PI / 2;
  neck.position.x = -51.6;
  root.add(neck);

  for (let centerX = -44; centerX <= 43; centerX += 8.7) {
    addTrussBay(root, centerX, 8.7, 2.25, structure);
    const serviceModule = part(
      new CylinderGeometry(1.38, 1.38, 3.2, 20),
      centerX % 17.4 === 0 ? panel : hull,
      "Discovery spine service module",
    );
    serviceModule.rotation.z = Math.PI / 2;
    serviceModule.position.x = centerX;
    root.add(serviceModule);
  }

  for (const x of [-38, -21, -4, 13, 30]) {
    for (const y of [-3.7, 3.7]) {
      const tank = part(
        new SphereGeometry(1.62, 24, 16),
        hull,
        "Discovery external spherical tank",
      );
      tank.scale.x = 1.55;
      tank.position.set(x, y, 0);
      root.add(tank);
    }
  }

  const antennaMast = beamBetween(
    new Vector3(-34, 2.1, 0),
    new Vector3(-34, 9.6, 0),
    0.18,
    structure,
    "Discovery high-gain antenna mast",
  );
  root.add(antennaMast);
  const dish = part(
    new RingGeometry(0.45, 3.65, 72, 8),
    hull,
    "Discovery high-gain antenna reflector",
  );
  dish.rotation.x = Math.PI / 2;
  dish.position.set(-34, 9.6, 0);
  root.add(dish);
  const dishFeed = part(
    new CylinderGeometry(0.12, 0.12, 2.3, 12),
    structure,
    "Discovery antenna feed",
  );
  dishFeed.position.set(-34, 10.8, 0);
  root.add(dishFeed);

  const engineBlock = part(
    new CylinderGeometry(5.2, 4.4, 11.8, 24),
    engine,
    "Discovery aft propulsion and reactor module",
  );
  engineBlock.rotation.z = Math.PI / 2;
  engineBlock.position.x = 51.2;
  root.add(engineBlock);

  const aftCollar = part(
    new TorusGeometry(4.75, 0.42, 14, 72),
    panel,
    "Discovery aft service collar",
  );
  aftCollar.rotation.y = Math.PI / 2;
  aftCollar.position.x = 56.4;
  root.add(aftCollar);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const engineOffset = new Vector3(
      0,
      Math.cos(angle) * 3.15,
      Math.sin(angle) * 3.15,
    );
    root.add(
      beamBetween(
        new Vector3(56.1, engineOffset.y * 0.72, engineOffset.z * 0.72),
        new Vector3(65.1, engineOffset.y, engineOffset.z),
        0.28,
        engine,
        "Discovery engine support boom",
      ),
    );
    const nozzle = part(
      new CylinderGeometry(0.62, 1.05, 4.9, 20),
      structure,
      "Discovery plasma engine nozzle",
    );
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(67.6, engineOffset.y, engineOffset.z);
    root.add(nozzle);
  }

  const exteriorReport = enforceOpaqueTwoSidedExterior(root);
  root.userData["exteriorMaterialContract"] = "opaque-two-sided-depth-writing";
  root.userData["exteriorMaterialCount"] = exteriorReport.materialCount;
  return root;
}
