import { wrap } from "comlink";
import type { Remote } from "comlink";

import type { PhysicsWorkerApi } from "./contracts";

export type PhysicsClient = Readonly<{
  api: Remote<PhysicsWorkerApi>;
  close(): void;
}>;

export function createPhysicsClient(): PhysicsClient {
  const worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
    type: "module",
    name: "rebound-physics",
  });
  return {
    api: wrap<PhysicsWorkerApi>(worker),
    close(): void {
      worker.terminate();
    },
  };
}
