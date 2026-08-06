import type { SimulationState } from "../physics/contracts";

export type WayfinderMode = "off" | "sun" | "sun-planet" | "sun-two-planets";

export const WAYFINDER_PLANET_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;

export type PlanetWayfinderTarget = Readonly<{
  bodyId: (typeof WAYFINDER_PLANET_IDS)[number];
  distanceM: number;
}>;

export function wayfinderPlanetCount(mode: WayfinderMode): 0 | 1 | 2 {
  switch (mode) {
    case "off":
    case "sun":
      return 0;
    case "sun-planet":
      return 1;
    case "sun-two-planets":
      return 2;
  }
}

export function nearestPlanetWayfinders(
  state: SimulationState,
  originBodyId: string,
  count: 0 | 1 | 2,
): readonly PlanetWayfinderTarget[] {
  const statesById = new Map(state.bodies.map((body) => [body.id, body]));
  const origin = statesById.get(originBodyId);
  if (origin === undefined) {
    throw new Error(`Wayfinder origin ${originBodyId} is unavailable`);
  }

  return WAYFINDER_PLANET_IDS.filter((bodyId) => bodyId !== originBodyId)
    .map((bodyId) => {
      const body = statesById.get(bodyId);
      if (body === undefined) {
        throw new Error(`Wayfinder planet ${bodyId} is unavailable`);
      }
      return {
        bodyId,
        distanceM: Math.hypot(
          body.positionM[0] - origin.positionM[0],
          body.positionM[1] - origin.positionM[1],
          body.positionM[2] - origin.positionM[2],
        ),
      };
    })
    .sort(
      (first, second) =>
        first.distanceM - second.distanceM ||
        first.bodyId.localeCompare(second.bodyId),
    )
    .slice(0, count);
}
