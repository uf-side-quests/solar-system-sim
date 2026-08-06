import type { SimulationState } from "../physics/contracts";
import {
  isOperationalSpacecraftBodyId,
  withOperationalSpacecraft,
} from "../physics/operational-spacecraft";
import {
  interpolateSimulationFrame,
  type SimulationFrame,
} from "./interpolation";

function withoutOperationalSpacecraft(state: SimulationState): SimulationState {
  return {
    ...state,
    bodies: state.bodies.filter(
      (body) => !isOperationalSpacecraftBodyId(body.id),
    ),
  };
}

export function interpolateDisplayedSimulationFrame(
  frame: SimulationFrame,
  fraction: number,
): SimulationState {
  const interpolatedState = interpolateSimulationFrame(
    {
      ...frame,
      start: withoutOperationalSpacecraft(frame.start),
      end: withoutOperationalSpacecraft(frame.end),
    },
    fraction,
  );
  return withOperationalSpacecraft(interpolatedState);
}
