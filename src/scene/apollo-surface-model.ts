import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from "three";

import type { ApolloLandingSite } from "./lunar-landing-sites";
import { apolloTraverseForSiteId } from "./apollo-traverses";

export const MOON_SURFACE_RADIUS_M = 1_737_400;

function addMesh(
  group: Group,
  geometry: BoxGeometry | CylinderGeometry | PlaneGeometry | SphereGeometry,
  material: MeshPhysicalMaterial | MeshStandardMaterial,
  name: string,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createApolloSurfaceSiteModel(site: ApolloLandingSite): Group {
  const group = new Group();
  group.name = `${site.mission} physical surface artefacts`;
  group.userData["bodyId"] = site.id;
  group.scale.setScalar(1 / MOON_SURFACE_RADIUS_M);

  const foil = new MeshPhysicalMaterial({
    color: 0xb89a45,
    metalness: 0.82,
    roughness: 0.42,
    clearcoat: 0.2,
  });
  const aluminium = new MeshStandardMaterial({
    color: 0xa9aeb1,
    metalness: 0.84,
    roughness: 0.5,
  });
  const darkMetal = new MeshStandardMaterial({
    color: 0x202326,
    metalness: 0.72,
    roughness: 0.64,
  });
  const whiteFabric = new MeshPhysicalMaterial({
    color: 0xe8e4d8,
    roughness: 0.82,
    clearcoat: 0.04,
  });
  const flagMaterial = new MeshPhysicalMaterial({
    color: 0x335a9d,
    roughness: 0.72,
    side: 2,
  });
  const localGroundMaterial = new MeshStandardMaterial({
    color: 0x12110f,
    metalness: 0,
    roughness: 1,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const localGround = addMesh(
    group,
    new PlaneGeometry(800, 800),
    localGroundMaterial,
    "Local flat lunar reference patch without invented terrain",
    [0, -0.5, 0],
  );
  localGround.rotation.x = -Math.PI / 2;
  localGround.renderOrder = -10;

  addMesh(
    group,
    new CylinderGeometry(2.15, 1.65, 1.1, 8),
    foil,
    `${site.lunarModule} descent stage`,
    [0, 0.55, 0],
  );
  addMesh(
    group,
    new BoxGeometry(2.6, 0.48, 2.6),
    aluminium,
    "Lunar Module landing deck",
    [0, 1.2, 0],
  );
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = Math.cos(angle) * 2.7;
    const z = Math.sin(angle) * 2.7;
    const leg = addMesh(
      group,
      new CylinderGeometry(0.07, 0.1, 3.1, 10),
      aluminium,
      "Lunar Module landing leg",
      [x * 0.58, 0.45, z * 0.58],
    );
    leg.rotation.z = Math.cos(angle) * 0.86;
    leg.rotation.x = -Math.sin(angle) * 0.86;
    addMesh(
      group,
      new CylinderGeometry(0.55, 0.55, 0.08, 24),
      aluminium,
      "Lunar Module footpad",
      [x, 0.04, z],
    );
  }
  const ladder = addMesh(
    group,
    new BoxGeometry(0.72, 1.8, 0.08),
    aluminium,
    "Lunar Module ladder",
    [0, 0.95, 1.65],
    [1, 1, 1],
  );
  ladder.rotation.x = -0.22;

  addMesh(
    group,
    new CylinderGeometry(0.025, 0.025, 2.4, 10),
    aluminium,
    "Apollo flag pole",
    [7, 1.2, 2],
  );
  const flag = addMesh(
    group,
    new PlaneGeometry(1.4, 0.85, 12, 4),
    flagMaterial,
    "United States flag",
    [7.72, 1.75, 2],
  );
  flag.rotation.y = Math.PI / 2;

  addMesh(
    group,
    new BoxGeometry(0.8, 0.45, 0.65),
    whiteFabric,
    "ALSEP central station",
    [-9, 0.23, -4],
  );
  addMesh(
    group,
    new CylinderGeometry(0.16, 0.16, 1.35, 16),
    aluminium,
    "ALSEP antenna",
    [-9, 1.05, -4],
  );
  addMesh(
    group,
    new SphereGeometry(0.34, 24, 16),
    aluminium,
    "Laser ranging retroreflector package",
    [-6, 0.18, 5],
    [1.2, 0.2, 1.2],
  );

  if (["Apollo 15", "Apollo 16", "Apollo 17"].includes(site.mission)) {
    addMesh(
      group,
      new BoxGeometry(1.55, 0.35, 0.95),
      aluminium,
      "Lunar Roving Vehicle chassis",
      [11, 0.65, -6],
    );
    for (const x of [10.25, 11.75]) {
      for (const z of [-6.55, -5.45]) {
        const wheel = addMesh(
          group,
          new CylinderGeometry(0.405, 0.405, 0.23, 24),
          darkMetal,
          "Lunar Roving Vehicle mesh wheel",
          [x, 0.405, z],
        );
        wheel.rotation.x = Math.PI / 2;
      }
    }
    addMesh(
      group,
      new BoxGeometry(0.58, 0.16, 0.52),
      whiteFabric,
      "Lunar Roving Vehicle seat",
      [11, 1.02, -6],
    );
  }

  const traverse = apolloTraverseForSiteId(site.id);
  if (traverse !== undefined) {
    for (const path of traverse.paths) {
      const material = new LineBasicMaterial({
        color: path.role === "CDR" ? 0x77c9ff : 0xffc46b,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      });
      const segmentVertices: Vector3[] = [];
      for (const segment of path.segments) {
        for (let index = 1; index < segment.length; index += 1) {
          const previous = segment[index - 1];
          const current = segment[index];
          if (previous === undefined || current === undefined) {
            throw new Error("LROC traverse segment contains a missing point");
          }
          segmentVertices.push(
            new Vector3(previous[0], 0.08, -previous[1]),
            new Vector3(current[0], 0.08, -current[1]),
          );
        }
      }
      const geometry = new BufferGeometry().setFromPoints(segmentVertices);
      const lineSegments = new LineSegments(geometry, material);
      lineSegments.name = `${site.mission} EVA ${String(path.eva)} ${path.role} LROC traverses`;
      group.add(lineSegments);
    }
  }

  group.traverse((object) => {
    object.userData["bodyId"] = site.id;
  });
  return group;
}
