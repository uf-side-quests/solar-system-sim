import type { BodyState, SimulationState } from "../physics/contracts";
import { masslessCircularOrbitState } from "./massless-circular-orbit";

export const DISCOVERY_ONE_BODY_ID = "discovery-one";
export const DISCOVERY_ONE_NAME = "Discovery One (fictional)";
export const DISCOVERY_ONE_PARENT_BODY_ID = "io";
export const DISCOVERY_ONE_LENGTH_M = 140.1;
export const DISCOVERY_ONE_MAXIMUM_DIAMETER_M = 16.7;
export const DISCOVERY_ONE_BOUNDING_RADIUS_M = DISCOVERY_ONE_LENGTH_M / 2;
export const DISCOVERY_ONE_ORBITAL_ALTITUDE_M = 400_000;
export const DISCOVERY_ONE_SOURCE_URL =
  "https://catalog.afi.com/Film/57233-2010";
export const DISCOVERY_ONE_VISUAL_REFERENCE_URL =
  "https://commons.wikimedia.org/wiki/Category:Discovery_One";

/**
 * The films place Discovery in a deteriorating orbit around Io, but publish no
 * osculating elements. This authored 400 km circular orbit preserves that
 * canonical location while making the unprovided trajectory explicit.
 */
export function discoveryOneState(state: SimulationState): BodyState {
  return masslessCircularOrbitState(state, {
    id: DISCOVERY_ONE_BODY_ID,
    parentBodyId: DISCOVERY_ONE_PARENT_BODY_ID,
    planeReferenceBodyId: "jupiter",
    parentRadiusM: 1_821_600,
    orbitalAltitudeM: DISCOVERY_ONE_ORBITAL_ALTITUDE_M,
    initialPhaseRad: 4.35,
  });
}
