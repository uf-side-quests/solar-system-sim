import {
  BufferGeometry,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  TorusGeometry,
  Vector3,
} from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import type { FictionalOrbiter } from "./fictional-orbiters";

function selectableMesh(
  geometry: BufferGeometry,
  material: MeshPhysicalMaterial | MeshStandardMaterial,
  bodyId: string,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.userData["bodyId"] = bodyId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPanelledHullMaterial(): MeshPhysicalMaterial {
  const hullTexture = new TextureLoader().load(
    "/textures/fictional/death-star-hull.webp",
  );
  hullTexture.name = "Original fictional battle-station hull texture";
  hullTexture.colorSpace = SRGBColorSpace;
  hullTexture.wrapS = RepeatWrapping;
  hullTexture.wrapT = RepeatWrapping;
  hullTexture.repeat.set(4, 2);
  return new MeshPhysicalMaterial({
    name: "Fictional battle station PBR panelled hull",
    color: 0xf1f3f3,
    map: hullTexture,
    bumpMap: hullTexture,
    bumpScale: 0.006,
    emissive: 0x9da4a7,
    emissiveMap: hullTexture,
    emissiveIntensity: 0.42,
    metalness: 0.18,
    roughness: 0.76,
    clearcoat: 0.04,
    clearcoatRoughness: 0.8,
    dithering: true,
  });
}

function addEquatorialInfrastructure(
  root: Group,
  bodyId: string,
  trenchMaterial: MeshStandardMaterial,
  edgeMaterial: MeshStandardMaterial,
): void {
  const trench = selectableMesh(
    new TorusGeometry(1.006, 0.019, 10, 256),
    trenchMaterial,
    bodyId,
  );
  trench.name = "Deep equatorial service trench";
  trench.rotation.x = Math.PI / 2;
  root.add(trench);
  for (const y of [-0.021, 0.021]) {
    const trenchEdge = selectableMesh(
      new TorusGeometry(1.009, 0.0045, 8, 256),
      edgeMaterial,
      bodyId,
    );
    trenchEdge.name = "Equatorial trench armoured edge";
    trenchEdge.rotation.x = Math.PI / 2;
    trenchEdge.position.y = y;
    root.add(trenchEdge);
  }
}

function createDishSurface(radius: number): RingGeometry {
  const geometry = new RingGeometry(0, radius, 96, 12);
  const positions = geometry.attributes["position"];
  if (positions === undefined) {
    throw new Error("Superlaser dish geometry has no positions");
  }
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const normalizedRadius = Math.min(Math.hypot(x, y) / radius, 1);
    positions.setZ(index, 0.072 * normalizedRadius * normalizedRadius);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function addSuperlaserAssembly(
  root: Group,
  bodyId: string,
  dishMaterial: MeshPhysicalMaterial,
  structureMaterial: MeshStandardMaterial,
): void {
  const dishRoot = new Group();
  dishRoot.name = "Recessed superlaser assembly";
  dishRoot.userData["bodyId"] = bodyId;
  const direction = new Vector3(0.36, 0.3, 0.884).normalize();
  dishRoot.position.copy(direction).multiplyScalar(1.006);
  dishRoot.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
  root.add(dishRoot);

  const dish = selectableMesh(createDishSurface(0.224), dishMaterial, bodyId);
  dish.name = "Concave superlaser reflector";
  dishRoot.add(dish);

  for (const radius of [0.057, 0.108, 0.16, 0.224]) {
    const ring = selectableMesh(
      new TorusGeometry(radius, radius === 0.224 ? 0.008 : 0.003, 8, 96),
      structureMaterial,
      bodyId,
    );
    ring.name = "Superlaser concentric support";
    ring.position.z = 0.072 * (radius / 0.224) ** 2 + 0.006;
    dishRoot.add(ring);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const spoke = selectableMesh(
      new BoxGeometry(0.19, 0.004, 0.004),
      structureMaterial,
      bodyId,
    );
    spoke.name = "Superlaser radial support";
    spoke.position.set(Math.cos(angle) * 0.105, Math.sin(angle) * 0.105, 0.075);
    spoke.rotation.z = angle;
    dishRoot.add(spoke);
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    const focusingNode = selectableMesh(
      new CylinderGeometry(0.009, 0.012, 0.018, 12),
      structureMaterial,
      bodyId,
    );
    focusingNode.name = "Superlaser perimeter focusing node";
    focusingNode.rotation.x = Math.PI / 2;
    focusingNode.position.set(
      Math.cos(angle) * 0.166,
      Math.sin(angle) * 0.166,
      0.047,
    );
    dishRoot.add(focusingNode);
  }
  const emitter = selectableMesh(
    new CylinderGeometry(0.031, 0.039, 0.022, 32),
    structureMaterial,
    bodyId,
  );
  emitter.name = "Superlaser central emitter";
  emitter.rotation.x = Math.PI / 2;
  emitter.position.z = 0.019;
  dishRoot.add(emitter);
}

function addIncompleteSuperstructure(
  root: Group,
  bodyId: string,
  structureMaterial: MeshStandardMaterial,
  darkInteriorMaterial: MeshStandardMaterial,
): void {
  const frame = new Group();
  frame.name = "Death Star II exposed internal construction";
  frame.userData["bodyId"] = bodyId;
  frame.position.z = 0.12;
  frame.scale.setScalar(0.9);
  root.add(frame);

  const voidBacking = selectableMesh(
    new RingGeometry(0, 0.96, 128),
    darkInteriorMaterial,
    bodyId,
  );
  voidBacking.name = "Exposed incomplete hull interior";
  voidBacking.position.z = -0.34;
  frame.add(voidBacking);

  for (const [ringIndex, radius] of [0.2, 0.38, 0.57, 0.76].entries()) {
    const supportRing = selectableMesh(
      new TorusGeometry(
        radius,
        radius < 0.3 ? 0.018 : 0.011,
        7,
        112,
        Math.PI * (1.18 + ringIndex * 0.09),
      ),
      structureMaterial,
      bodyId,
    );
    supportRing.name = "Incomplete station concentric truss";
    supportRing.position.z = -0.08 + radius * 0.06;
    supportRing.rotation.z = -0.72 + ringIndex * 0.31;
    frame.add(supportRing);
  }
  for (let index = 0; index < 9; index += 1) {
    const angle = -1.12 + (index / 8) * Math.PI * 1.45;
    const length = 0.7 + (index % 4) * 0.075;
    const radial = selectableMesh(
      new BoxGeometry(length, 0.019, 0.024),
      structureMaterial,
      bodyId,
    );
    radial.name = "Incomplete station radial truss";
    radial.rotation.z = angle;
    radial.position.set(
      Math.cos(angle) * length * 0.42,
      Math.sin(angle) * length * 0.42,
      -0.035 + (index % 3) * 0.025,
    );
    frame.add(radial);
  }
  for (const [x, y, length, rotation] of [
    [-0.33, 0.28, 0.88, 0.14],
    [0.27, -0.2, 0.72, -0.3],
    [-0.04, -0.5, 0.58, Math.PI / 2],
    [0.48, 0.18, 0.5, Math.PI / 2.8],
  ] as const) {
    const girder = selectableMesh(
      new BoxGeometry(length, 0.028, 0.03),
      structureMaterial,
      bodyId,
    );
    girder.name = "Incomplete station offset construction girder";
    girder.position.set(x, y, 0.055);
    girder.rotation.z = rotation;
    frame.add(girder);
  }
  for (const [x, y, width, height, depth] of [
    [-0.5, 0.5, 0.24, 0.13, -0.005],
    [-0.29, 0.57, 0.17, 0.09, 0.018],
    [0.08, 0.66, 0.21, 0.12, -0.018],
    [0.36, 0.48, 0.18, 0.11, 0.025],
    [0.54, 0.23, 0.16, 0.1, 0.005],
    [-0.58, -0.16, 0.2, 0.11, 0.022],
    [-0.42, -0.42, 0.18, 0.12, -0.014],
    [0.16, -0.57, 0.22, 0.1, 0.018],
    [0.47, -0.36, 0.16, 0.13, -0.006],
  ] as const) {
    const machineryDeck = selectableMesh(
      new BoxGeometry(width, height, 0.036),
      structureMaterial,
      bodyId,
    );
    machineryDeck.name = "Incomplete station machinery deck";
    machineryDeck.position.set(x, y, depth);
    frame.add(machineryDeck);
  }
  for (let index = 0; index < 18; index += 1) {
    const angle = -1.28 + index * 0.151;
    const radius = 0.31 + (index % 5) * 0.105;
    const node = selectableMesh(
      new BoxGeometry(0.035, 0.035, 0.07 + (index % 3) * 0.025),
      structureMaterial,
      bodyId,
    );
    node.name = "Incomplete station truss junction";
    node.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.04 + (index % 4) * 0.018,
    );
    node.rotation.z = angle;
    frame.add(node);
  }
  const reactor = selectableMesh(
    new CylinderGeometry(0.11, 0.15, 0.72, 36),
    structureMaterial,
    bodyId,
  );
  reactor.name = "Incomplete station reactor spine";
  reactor.rotation.x = Math.PI / 2;
  reactor.position.z = 0.02;
  frame.add(reactor);
}

export function createDeathStarModel(orbiter: FictionalOrbiter): Group {
  const group = new Group();
  group.name = `${orbiter.name} detailed physical-scale visualization`;
  group.userData["bodyId"] = orbiter.id;
  group.userData["visualSource"] =
    "original-pbr-hull-and-physically-shaded-geometry";
  group.scale.setScalar(orbiter.diameterM / 2 / ASTRONOMICAL_UNIT_M);
  const modelRoot = new Group();
  modelRoot.name = `${orbiter.name} presentation geometry`;
  modelRoot.userData["bodyId"] = orbiter.id;
  group.add(modelRoot);

  const hull = createPanelledHullMaterial();
  const trench = new MeshStandardMaterial({
    name: "Fictional battle station equatorial trench",
    color: 0x090c0e,
    metalness: 0.64,
    roughness: 0.78,
  });
  const structure = new MeshStandardMaterial({
    name: "Fictional exposed construction interior",
    color: 0x70787b,
    emissive: 0x3d4346,
    emissiveIntensity: 0.2,
    metalness: 0.38,
    roughness: 0.7,
  });
  const interiorVoid = new MeshStandardMaterial({
    name: "Fictional exposed construction void",
    color: 0x050708,
    metalness: 0.12,
    roughness: 0.94,
    side: DoubleSide,
  });
  const dish = new MeshPhysicalMaterial({
    name: "Fictional superlaser reflector",
    color: 0x525a5e,
    emissive: 0x353b3e,
    emissiveIntensity: 0.24,
    metalness: 0.34,
    roughness: 0.72,
    clearcoat: 0.03,
    side: DoubleSide,
  });

  const spherePhiLength =
    orbiter.constructionState === "complete" ? Math.PI * 2 : Math.PI * 1.5;
  const spherePhiStart =
    orbiter.constructionState === "complete" ? 0 : Math.PI * 0.75;
  const shell = selectableMesh(
    new SphereGeometry(1, 192, 112, spherePhiStart, spherePhiLength),
    hull,
    orbiter.id,
  );
  shell.name = `${orbiter.name} main hull`;
  modelRoot.add(shell);

  addEquatorialInfrastructure(modelRoot, orbiter.id, trench, structure);
  addSuperlaserAssembly(modelRoot, orbiter.id, dish, structure);

  if (orbiter.constructionState === "incomplete") {
    addIncompleteSuperstructure(modelRoot, orbiter.id, structure, interiorVoid);
  }

  return group;
}
