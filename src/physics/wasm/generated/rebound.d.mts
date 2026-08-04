import type { ReboundModule, ReboundModuleOptions } from "../rebound-module";

declare const createReboundModule: (
  options: ReboundModuleOptions,
) => Promise<ReboundModule>;

export default createReboundModule;
