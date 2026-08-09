import type { BodyState, SimulationState } from "../physics/contracts";
import { masslessCircularOrbitState } from "./massless-circular-orbit";

export type FictionalOrbiter = Readonly<{
  id: "death-star-1" | "death-star-2";
  name: string;
  parentBodyId: "callisto" | "ganymede";
  diameterM: number;
  orbitalAltitudeM: number;
  initialPhaseRad: number;
  constructionState: "complete" | "incomplete";
  sourceUrl: string;
}>;

export const FICTIONAL_ORBITERS: readonly FictionalOrbiter[] = [
  {
    id: "death-star-1",
    name: "Death Star I (fictional)",
    parentBodyId: "callisto",
    diameterM: 160_000,
    orbitalAltitudeM: 500_000,
    initialPhaseRad: 0.35,
    constructionState: "complete",
    sourceUrl: "https://www.starwars.com/databank/death-star",
  },
  {
    id: "death-star-2",
    name: "Death Star II (fictional)",
    parentBodyId: "ganymede",
    diameterM: 200_000,
    orbitalAltitudeM: 650_000,
    initialPhaseRad: 2.1,
    constructionState: "incomplete",
    sourceUrl: "https://www.starwars.com/databank/death-star-ii",
  },
] as const;

export type FictionalOrbiterId = (typeof FICTIONAL_ORBITERS)[number]["id"];

export const fictionalOrbiterById = new Map(
  FICTIONAL_ORBITERS.map((orbiter) => [orbiter.id, orbiter]),
);

export function isFictionalOrbiterId(
  bodyId: string | null,
): bodyId is FictionalOrbiterId {
  if (bodyId === null) {
    return false;
  }
  return fictionalOrbiterById.has(bodyId as FictionalOrbiterId);
}

/**
 * Evaluate a hypothetical massless circular orbit around a live Galilean moon.
 *
 * The moon state and gravitational parameter come from the simulator. The
 * fictional object has zero gravitational parameter and therefore cannot
 * perturb any real body. The reference plane follows the moon's instantaneous
 * orbit around Jupiter, while circular speed follows sqrt(mu / r).
 */
export function fictionalOrbiterState(
  state: SimulationState,
  orbiter: FictionalOrbiter,
): BodyState {
  const moonRadiusM =
    orbiter.parentBodyId === "callisto" ? 2_410_300 : 2_634_100;
  return masslessCircularOrbitState(state, {
    id: orbiter.id,
    parentBodyId: orbiter.parentBodyId,
    planeReferenceBodyId: "jupiter",
    parentRadiusM: moonRadiusM,
    orbitalAltitudeM: orbiter.orbitalAltitudeM,
    initialPhaseRad: orbiter.initialPhaseRad,
  });
}

export function fictionalOrbiterStateById(
  state: SimulationState,
  bodyId: FictionalOrbiterId,
): BodyState {
  const orbiter = fictionalOrbiterById.get(bodyId);
  if (orbiter === undefined) {
    throw new Error(`Fictional orbiter ${bodyId} is unavailable`);
  }
  return fictionalOrbiterState(state, orbiter);
}
