export type ReboundModule = {
  _sste_create(gravitationalConstant: number): number;
  _sste_add_body(
    mass: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
  ): number;
  _sste_move_to_barycentre(): number;
  _sste_integrate(targetTimeSeconds: number): number;
  _sste_time(): number;
  _sste_energy(): number;
  _sste_body_count(): number;
  _sste_active_body_count(): number;
  _sste_body_value(bodyIndex: number, fieldIndex: number): number;
};

export type ReboundModuleOptions = {
  locateFile(path: string): string;
};

declare const createReboundModule: (
  options: ReboundModuleOptions,
) => Promise<ReboundModule>;

export default createReboundModule;
