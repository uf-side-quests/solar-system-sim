import path from "node:path";
import { fileURLToPath } from "node:url";

import horizonSnapshot from "../src/data/horizons-regression.snapshot.json" with { type: "json" };
import majorBodySnapshot from "../src/data/major-bodies.snapshot.json" with { type: "json" };
import physicalSnapshot from "../src/data/naif-physical.snapshot.json" with { type: "json" };
import createReboundModule from "../src/physics/wasm/generated/rebound-node.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(
  scriptDirectory,
  "../src/physics/wasm/generated/rebound-node.wasm",
);

function assertSuccess(code, operation) {
  if (code !== 0) {
    throw new Error(`${operation} failed with bridge error ${code}`);
  }
}

async function simulationAt(offsetDays) {
  const module = await createReboundModule({ locateFile: () => wasmPath });
  assertSuccess(module._sste_create(1), "create");
  for (const body of majorBodySnapshot.bodies) {
    const physical = physicalSnapshot.bodies[body.id];
    if (physical === undefined) {
      throw new Error(`Physical snapshot is missing ${body.id}`);
    }
    assertSuccess(
      module._sste_add_body(
        physical.gravitationalParameterM3S2,
        ...body.positionM,
        ...body.velocityMps,
      ),
      `add ${body.id}`,
    );
  }
  assertSuccess(module._sste_move_to_barycentre(), "move to barycentre");
  assertSuccess(module._sste_integrate(offsetDays * 86_400), "integrate");
  const states = {};
  for (const [index, body] of majorBodySnapshot.bodies.entries()) {
    states[body.id] = {
      positionM: [1, 2, 3].map((field) =>
        module._sste_body_value(index, field),
      ),
      velocityMps: [4, 5, 6].map((field) =>
        module._sste_body_value(index, field),
      ),
    };
  }
  return { states, energy: module._sste_energy() };
}

function relativePosition(body, origin) {
  return body.positionM.map((value, index) => value - origin.positionM[index]);
}

function separationErrorM(
  actualBody,
  actualOrigin,
  expectedBody,
  expectedOrigin,
) {
  const actual = relativePosition(actualBody, actualOrigin);
  const expected = relativePosition(expectedBody, expectedOrigin);
  return Math.hypot(...actual.map((value, index) => value - expected[index]));
}

const thresholds = {
  0: { earthSunM: 1, moonEarthM: 1 },
  1: { earthSunM: 2, moonEarthM: 10 },
  30: { earthSunM: 2_000, moonEarthM: 2_000 },
  365: { earthSunM: 100_000, moonEarthM: 20_000 },
};

let maximumEarthSunErrorM = 0;
let maximumMoonEarthErrorM = 0;
for (const sample of horizonSnapshot.samples) {
  const simulated = await simulationAt(sample.offsetDays);
  const absoluteDays = Math.abs(sample.offsetDays);
  const threshold = thresholds[absoluteDays];
  if (threshold === undefined) {
    throw new Error(`No regression threshold for ${sample.offsetDays} days`);
  }
  const earthSunErrorM = separationErrorM(
    simulated.states.earth,
    simulated.states.sun,
    sample.bodies.earth,
    sample.bodies.sun,
  );
  const moonEarthErrorM = separationErrorM(
    simulated.states.moon,
    simulated.states.earth,
    sample.bodies.moon,
    sample.bodies.earth,
  );
  maximumEarthSunErrorM = Math.max(maximumEarthSunErrorM, earthSunErrorM);
  maximumMoonEarthErrorM = Math.max(maximumMoonEarthErrorM, moonEarthErrorM);
  console.log(
    `offset_days=${sample.offsetDays} earth_sun_error_m=${earthSunErrorM.toFixed(3)} moon_earth_error_m=${moonEarthErrorM.toFixed(3)}`,
  );
  if (earthSunErrorM > threshold.earthSunM) {
    throw new Error(
      `Earth-Sun error ${earthSunErrorM} m exceeds ${threshold.earthSunM} m at ${sample.offsetDays} days`,
    );
  }
  if (moonEarthErrorM > threshold.moonEarthM) {
    throw new Error(
      `Moon-Earth error ${moonEarthErrorM} m exceeds ${threshold.moonEarthM} m at ${sample.offsetDays} days`,
    );
  }
}
console.log(`maximum_earth_sun_error_m=${maximumEarthSunErrorM.toFixed(3)}`);
console.log(`maximum_moon_earth_error_m=${maximumMoonEarthErrorM.toFixed(3)}`);
