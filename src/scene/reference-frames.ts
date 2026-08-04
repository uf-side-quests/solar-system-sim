import { Vector3 } from "three";

export const J2000_MEAN_OBLIQUITY_RAD = (23.439291111 * Math.PI) / 180;

/** Converts J2000 ecliptic coordinates into the ICRF-aligned Three.js scene. */
export function j2000EclipticToScene(
  position: Readonly<{ x: number; y: number; z: number }>,
): Vector3 {
  const cosine = Math.cos(J2000_MEAN_OBLIQUITY_RAD);
  const sine = Math.sin(J2000_MEAN_OBLIQUITY_RAD);
  const icrfY = cosine * position.y - sine * position.z;
  const icrfZ = sine * position.y + cosine * position.z;
  return new Vector3(position.x, icrfZ, -icrfY);
}

/** Converts ICRF coordinates into the app's y-up Three.js scene. */
export function icrfToScene(
  position: Readonly<{ x: number; y: number; z: number }>,
): Vector3 {
  return new Vector3(position.x, position.z, -position.y);
}
