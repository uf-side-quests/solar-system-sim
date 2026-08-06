import { expose } from "comlink";

import type {
  PhysicsWorkerApi,
  SimulationInitialState,
  SimulationState,
} from "./contracts";
import { ReboundEngine } from "./rebound-engine";
import createReboundModule from "./wasm/generated/rebound.mjs";

const wasmUrl = new URL("./wasm/generated/rebound.wasm", import.meta.url).href;
let enginePromise: Promise<ReboundEngine> | undefined;
async function createEngine(): Promise<ReboundEngine> {
  const response = await fetch(wasmUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      `REBOUND WebAssembly download failed: ${String(response.status)} ${response.statusText}`,
    );
  }
  const compiledModule = await WebAssembly.compile(
    await response.arrayBuffer(),
  );
  const module = await createReboundModule({
    locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
    instantiateWasm: (imports, receiveInstance) => {
      receiveInstance(new WebAssembly.Instance(compiledModule, imports));
    },
  });
  return new ReboundEngine(module);
}

function engine(): Promise<ReboundEngine> {
  enginePromise ??= createEngine();
  return enginePromise;
}

const api: PhysicsWorkerApi = {
  async initialize(
    initialState: SimulationInitialState,
  ): Promise<SimulationState> {
    return (await engine()).initialize(initialState);
  },
  async integrateTo(timeSeconds: number): Promise<SimulationState> {
    return (await engine()).integrateTo(timeSeconds);
  },
  async integrateSeries(
    timeSeconds: readonly number[],
  ): Promise<readonly SimulationState[]> {
    if (timeSeconds.length === 0 || timeSeconds.length > 30) {
      throw new Error("Physics series must contain between 1 and 30 targets");
    }
    if (timeSeconds.some((target) => !Number.isFinite(target))) {
      throw new Error("Physics series targets must be finite");
    }
    const reboundEngine = await engine();
    return timeSeconds.map((target) => reboundEngine.integrateTo(target));
  },
};

expose(api);
