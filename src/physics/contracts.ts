import { z } from "zod";

const finiteNumber = z.number();
const vector3Schema = z.tuple([finiteNumber, finiteNumber, finiteNumber]);

export const bodyInitialStateSchema = z.object({
  id: z.string().trim().min(1),
  gravitationalParameterM3S2: finiteNumber.nonnegative(),
  positionM: vector3Schema,
  velocityMps: vector3Schema,
});

export const simulationInitialStateSchema = z.object({
  bodies: z.array(bodyInitialStateSchema).min(1),
});

export type BodyInitialState = z.infer<typeof bodyInitialStateSchema>;
export type SimulationInitialState = z.infer<
  typeof simulationInitialStateSchema
>;

export type BodyState = Readonly<{
  id: string;
  gravitationalParameterM3S2: number;
  positionM: readonly [number, number, number];
  velocityMps: readonly [number, number, number];
}>;

export type SimulationState = Readonly<{
  timeSeconds: number;
  energy: number;
  bodies: readonly BodyState[];
}>;

export type PhysicsWorkerApi = {
  initialize(initialState: SimulationInitialState): Promise<SimulationState>;
  integrateTo(timeSeconds: number): Promise<SimulationState>;
  integrateSeries(
    timeSeconds: readonly number[],
  ): Promise<readonly SimulationState[]>;
};
