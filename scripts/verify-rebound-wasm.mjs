import path from "node:path";
import { fileURLToPath } from "node:url";

import createReboundModule from "../src/physics/wasm/generated/rebound-node.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(
  scriptDirectory,
  "../src/physics/wasm/generated/rebound-node.wasm",
);
const module = await createReboundModule({ locateFile: () => wasmPath });

const sunGravitationalParameter = Number("1.3271244004127942e20");
const earthGravitationalParameter = Number("3.9860043550702266e14");
const au = 149_597_870_700;
const mu = sunGravitationalParameter + earthGravitationalParameter;
const velocity = Math.sqrt(mu / au);
const period = 2 * Math.PI * Math.sqrt(au ** 3 / mu);

function assertSuccess(code, operation) {
  if (code !== 0) {
    throw new Error(`${operation} failed with bridge error ${String(code)}`);
  }
}

assertSuccess(module._sste_create(1), "create");
assertSuccess(
  module._sste_add_body(sunGravitationalParameter, 0, 0, 0, 0, 0, 0),
  "add Sun",
);
assertSuccess(
  module._sste_add_body(earthGravitationalParameter, au, 0, 0, 0, velocity, 0),
  "add Earth",
);
assertSuccess(module._sste_move_to_barycentre(), "move to barycentre");
const initialEnergy = module._sste_energy();
assertSuccess(module._sste_integrate(period), "integrate forward");

const dx = module._sste_body_value(1, 1) - module._sste_body_value(0, 1);
const dy = module._sste_body_value(1, 2) - module._sste_body_value(0, 2);
const dz = module._sste_body_value(1, 3) - module._sste_body_value(0, 3);
const separation = Math.hypot(dx, dy, dz);
const relativeSeparationError = Math.abs(separation / au - 1);
const relativeEnergyError = Math.abs(module._sste_energy() / initialEnergy - 1);

if (relativeSeparationError > 1e-10) {
  throw new Error(
    `relative separation error ${String(relativeSeparationError)} exceeds 1e-10`,
  );
}
if (relativeEnergyError > 1e-12) {
  throw new Error(
    `relative energy error ${String(relativeEnergyError)} exceeds 1e-12`,
  );
}

assertSuccess(module._sste_integrate(0), "integrate backward");
const restoredEarthX = module._sste_body_value(1, 1);
const restoredSunX = module._sste_body_value(0, 1);
const restoredSeparation = restoredEarthX - restoredSunX;
const relativeRestorationError = Math.abs(restoredSeparation / au - 1);
if (relativeRestorationError > 1e-10) {
  throw new Error(
    `relative restoration error ${String(relativeRestorationError)} exceeds 1e-10`,
  );
}

console.log(`integrator=ias15`);
console.log(`period_seconds=${period.toFixed(6)}`);
console.log(
  `relative_separation_error=${relativeSeparationError.toExponential(3)}`,
);
console.log(`relative_energy_error=${relativeEnergyError.toExponential(3)}`);
console.log(
  `relative_restoration_error=${relativeRestorationError.toExponential(3)}`,
);
