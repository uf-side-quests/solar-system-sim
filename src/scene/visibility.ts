import type { MajorBodyDefinition } from "../physics/solar-system";

export type ObjectVisibility = Readonly<{
  planets: boolean;
  moons: boolean;
  asteroids: boolean;
  comets: boolean;
  stars: boolean;
  spacecraft: boolean;
}>;

export const DEFAULT_OBJECT_VISIBILITY: ObjectVisibility = {
  planets: true,
  moons: true,
  asteroids: false,
  comets: false,
  stars: true,
  spacecraft: true,
};

export function isMajorBodyVisible(
  bodyType: MajorBodyDefinition["type"],
  visibility: ObjectVisibility,
): boolean {
  if (bodyType === "star") {
    return true;
  }
  if (bodyType === "moon") {
    return visibility.moons;
  }
  return visibility.planets;
}
