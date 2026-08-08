import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";

export const ROADSTER_BODY_ID = "roadster";
export const ROADSTER_LENGTH_M = 3.946;

type RoadsterGeometry =
  | BoxGeometry
  | CapsuleGeometry
  | CylinderGeometry
  | ExtrudeGeometry
  | SphereGeometry
  | TorusGeometry;
type RoadsterMaterial = MeshPhysicalMaterial | MeshStandardMaterial;

function modelMesh(
  geometry: RoadsterGeometry,
  material: RoadsterMaterial,
  name: string,
): Mesh {
  const result = new Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  result.userData["bodyId"] = ROADSTER_BODY_ID;
  return result;
}

function createBodyShell(material: RoadsterMaterial): Mesh {
  const halfLength = ROADSTER_LENGTH_M / 2;
  const plan = new Shape();
  plan.moveTo(0, -halfLength);
  plan.bezierCurveTo(0.72, -halfLength, 0.91, -1.42, 0.89, -0.92);
  plan.bezierCurveTo(0.86, -0.2, 0.82, 0.72, 0.72, 1.3);
  plan.bezierCurveTo(0.64, 1.7, 0.42, halfLength, 0, halfLength);
  plan.bezierCurveTo(-0.42, halfLength, -0.64, 1.7, -0.72, 1.3);
  plan.bezierCurveTo(-0.82, 0.72, -0.86, -0.2, -0.89, -0.92);
  plan.bezierCurveTo(-0.91, -1.42, -0.72, -halfLength, 0, -halfLength);
  const geometry = new ExtrudeGeometry(plan, {
    depth: 0.34,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.translate(0, 0, -0.17);
  geometry.rotateX(Math.PI / 2);
  const shell = modelMesh(
    geometry,
    material,
    "Roadster carbon-fibre body shell",
  );
  shell.position.y = 0.08;
  return shell;
}

function addWheel(
  group: Group,
  x: number,
  z: number,
  tyre: RoadsterMaterial,
  rim: RoadsterMaterial,
): void {
  const wheel = modelMesh(
    new CylinderGeometry(0.31, 0.31, 0.22, 48),
    tyre,
    "Roadster tyre",
  );
  wheel.position.set(x, -0.04, z);
  wheel.rotation.z = Math.PI / 2;
  group.add(wheel);
  const wheelRim = modelMesh(
    new CylinderGeometry(0.19, 0.19, 0.226, 32),
    rim,
    "Roadster ten-spoke wheel rim",
  );
  wheelRim.position.copy(wheel.position);
  wheelRim.rotation.copy(wheel.rotation);
  group.add(wheelRim);
  for (let spokeIndex = 0; spokeIndex < 10; spokeIndex += 1) {
    const angle = (spokeIndex / 10) * Math.PI * 2;
    const spoke = modelMesh(
      new BoxGeometry(0.018, 0.145, 0.018),
      rim,
      "Roadster wheel spoke",
    );
    spoke.position.set(
      x + (x > 0 ? 0.119 : -0.119),
      -0.04 + Math.cos(angle) * 0.075,
      z + Math.sin(angle) * 0.075,
    );
    spoke.rotation.x = angle;
    group.add(spoke);
  }
}

export function createRoadsterAndStarmanModel(): Group {
  const group = new Group();
  group.name = "Tesla Roadster and Starman physical-scale reconstruction";
  group.userData["bodyId"] = ROADSTER_BODY_ID;
  group.scale.setScalar(1 / ASTRONOMICAL_UNIT_M);

  const redPaint = new MeshPhysicalMaterial({
    name: "Roadster metallic red carbon-fibre paint",
    color: 0x9f0713,
    metalness: 0.7,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const darkCarbon = new MeshStandardMaterial({
    name: "Roadster exposed carbon fibre",
    color: 0x101316,
    metalness: 0.5,
    roughness: 0.32,
  });
  const glass = new MeshPhysicalMaterial({
    name: "Roadster curved windscreen",
    color: 0x172833,
    transmission: 0.42,
    transparent: true,
    opacity: 0.78,
    metalness: 0.06,
    roughness: 0.08,
    clearcoat: 1,
  });
  const tyre = new MeshStandardMaterial({
    name: "Roadster rubber tyres",
    color: 0x070809,
    roughness: 0.96,
  });
  const rim = new MeshStandardMaterial({
    name: "Roadster forged wheel rims",
    color: 0x959ca2,
    metalness: 0.94,
    roughness: 0.18,
  });
  const lamp = new MeshPhysicalMaterial({
    name: "Roadster lamp lenses",
    color: 0xe4f2ff,
    emissive: 0x203242,
    emissiveIntensity: 0.2,
    transmission: 0.35,
    roughness: 0.08,
  });
  const suit = new MeshPhysicalMaterial({
    name: "Starman SpaceX pressure suit",
    color: 0xd8dce0,
    roughness: 0.52,
    clearcoat: 0.18,
  });
  const suitTrim = new MeshStandardMaterial({
    name: "Starman suit black trim",
    color: 0x111417,
    roughness: 0.58,
  });
  const visor = new MeshPhysicalMaterial({
    name: "Starman dark visor",
    color: 0x100e0b,
    metalness: 0.46,
    roughness: 0.08,
    clearcoat: 0.9,
  });
  const adapter = new MeshStandardMaterial({
    name: "Falcon Heavy payload adapter",
    color: 0x71777c,
    metalness: 0.84,
    roughness: 0.34,
  });

  group.add(createBodyShell(redPaint));

  const hood = modelMesh(
    new SphereGeometry(1, 64, 32),
    redPaint,
    "Roadster low sculpted bonnet",
  );
  hood.scale.set(0.69, 0.16, 0.92);
  hood.position.set(0, 0.3, 1.02);
  group.add(hood);
  const rearDeck = modelMesh(
    new SphereGeometry(1, 64, 32),
    redPaint,
    "Roadster rear deck",
  );
  rearDeck.scale.set(0.75, 0.15, 0.58);
  rearDeck.position.set(0, 0.31, -1.18);
  group.add(rearDeck);

  const cockpit = modelMesh(
    new SphereGeometry(1, 64, 32),
    darkCarbon,
    "Roadster open cockpit",
  );
  cockpit.scale.set(0.61, 0.19, 0.72);
  cockpit.position.set(0, 0.43, -0.3);
  group.add(cockpit);
  const windscreen = modelMesh(
    new SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
    "Roadster windscreen",
  );
  windscreen.scale.set(0.66, 0.36, 0.2);
  windscreen.position.set(0, 0.46, 0.3);
  windscreen.rotation.x = -0.26;
  group.add(windscreen);

  for (const x of [-0.48, 0.48]) {
    const headlamp = modelMesh(
      new SphereGeometry(1, 32, 16),
      lamp,
      "Roadster elliptical headlamp",
    );
    headlamp.scale.set(0.22, 0.055, 0.105);
    headlamp.position.set(x, 0.3, 1.72);
    group.add(headlamp);
    const tailLamp = modelMesh(
      new SphereGeometry(1, 24, 12),
      redPaint,
      "Roadster tail lamp",
    );
    tailLamp.scale.set(0.2, 0.06, 0.07);
    tailLamp.position.set(x, 0.27, -1.84);
    group.add(tailLamp);
  }

  for (const x of [-0.87, 0.87]) {
    addWheel(group, x, -1.14, tyre, rim);
    addWheel(group, x, 1.18, tyre, rim);
  }

  const payloadAdapter = modelMesh(
    new CylinderGeometry(0.5, 0.44, 0.18, 48),
    adapter,
    "Falcon Heavy payload adapter",
  );
  payloadAdapter.position.y = -0.27;
  group.add(payloadAdapter);

  const seat = modelMesh(
    new BoxGeometry(0.46, 0.58, 0.16),
    darkCarbon,
    "Roadster driver seat",
  );
  seat.position.set(-0.27, 0.55, -0.45);
  seat.rotation.x = -0.22;
  group.add(seat);

  const torso = modelMesh(
    new CapsuleGeometry(0.17, 0.34, 12, 24),
    suit,
    "Starman fitted pressure-suit torso",
  );
  torso.scale.set(1, 1, 0.74);
  torso.position.set(-0.27, 0.82, -0.36);
  torso.rotation.x = -0.24;
  group.add(torso);
  const helmet = modelMesh(
    new SphereGeometry(0.2, 48, 32),
    suit,
    "Starman helmet",
  );
  helmet.scale.set(0.92, 1.08, 0.95);
  helmet.position.set(-0.27, 1.2, -0.27);
  group.add(helmet);
  const faceplate = modelMesh(
    new SphereGeometry(1, 48, 24),
    visor,
    "Starman visor",
  );
  faceplate.scale.set(0.135, 0.15, 0.045);
  faceplate.position.set(-0.27, 1.2, -0.085);
  group.add(faceplate);
  const collar = modelMesh(
    new TorusGeometry(0.15, 0.025, 10, 32),
    suitTrim,
    "Starman helmet collar",
  );
  collar.position.set(-0.27, 1.02, -0.27);
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  const armTargets = [
    { x: -0.49, z: 0, rotationZ: -0.28 },
    { x: -0.04, z: 0.02, rotationZ: 0.28 },
  ] as const;
  for (const armTarget of armTargets) {
    const arm = modelMesh(
      new CapsuleGeometry(0.065, 0.36, 8, 16),
      suit,
      "Starman articulated arm",
    );
    arm.position.set(armTarget.x, 0.78, armTarget.z);
    arm.rotation.x = 1.0;
    arm.rotation.z = armTarget.rotationZ;
    group.add(arm);
  }
  const steeringWheel = modelMesh(
    new TorusGeometry(0.14, 0.018, 8, 32),
    darkCarbon,
    "Roadster steering wheel",
  );
  steeringWheel.position.set(-0.27, 0.68, 0.22);
  steeringWheel.rotation.x = Math.PI / 2.7;
  group.add(steeringWheel);

  return group;
}
