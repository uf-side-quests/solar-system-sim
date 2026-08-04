import type { SimulationState } from "./contracts";
import { withIssEphemeris } from "./iss-ephemeris";
import { additionalAvailableKnownSatellites } from "./known-satellites";
import { majorBodySnapshot, naifPhysicalSnapshot } from "./solar-system";
import {
  propagateKnownSatellite,
  type KnownSatellitePropagationInput,
} from "./two-body-propagator";

const parentInitialStates = new Map(
  majorBodySnapshot.bodies.map((body) => [
    body.id,
    {
      id: body.id,
      gravitationalParameterM3S2:
        naifPhysicalSnapshot.bodies[body.id]?.gravitationalParameterM3S2 ??
        (() => {
          throw new Error(`Parent GM is missing for ${body.id}`);
        })(),
      positionM: body.positionM,
      velocityMps: body.velocityMps,
    },
  ]),
);
const majorBodyIds = new Set(majorBodySnapshot.bodies.map((body) => body.id));

const propagationInputs: readonly KnownSatellitePropagationInput[] =
  additionalAvailableKnownSatellites.map((definition) => {
    const parentInitialState = parentInitialStates.get(definition.parentId);
    const parentGravitationalParameterM3S2 =
      naifPhysicalSnapshot.bodies[definition.parentId]
        ?.gravitationalParameterM3S2;
    if (
      parentInitialState === undefined ||
      parentGravitationalParameterM3S2 === undefined
    ) {
      throw new Error(
        `Known moon ${definition.name} has unavailable parent physics`,
      );
    }
    return {
      definition,
      parentInitialState,
      parentGravitationalParameterM3S2,
    };
  });

export function withKnownSatellites(
  state: SimulationState,
  includedParentIds?: ReadonlySet<string>,
): SimulationState {
  const majorBodies = state.bodies.filter((body) => majorBodyIds.has(body.id));
  const stateById = new Map(majorBodies.map((body) => [body.id, body]));
  const selectedInputs =
    includedParentIds === undefined
      ? propagationInputs
      : propagationInputs.filter((input) =>
          includedParentIds.has(input.definition.parentId),
        );
  const satellites = selectedInputs.map((input) => {
    const parentState = stateById.get(input.definition.parentId);
    if (parentState === undefined) {
      throw new Error(
        `Integrated parent ${input.definition.parentId} is unavailable`,
      );
    }
    return propagateKnownSatellite(input, parentState, state.timeSeconds);
  });
  return withIssEphemeris({
    ...state,
    bodies: [...majorBodies, ...satellites],
  });
}
