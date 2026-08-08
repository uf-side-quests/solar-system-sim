import type { BodyState, SimulationState } from "../physics/contracts";

export const JOVIAN_MONOLITH_BODY_ID = "jovian-monolith";
export const JOVIAN_MONOLITH_NAME = "Jovian Monolith (fictional)";

// 2010 describes the Jovian monolith as about two kilometres long. The
// 1:4:9 proportions are the recurring dimensions used for the monoliths in
// the Space Odyssey novels. No canonical mass or material is stated.
export const JOVIAN_MONOLITH_DIMENSIONS_M = {
  thickness: 2_000 / 9,
  width: (2_000 * 4) / 9,
  length: 2_000,
} as const;

export const JOVIAN_MONOLITH_BOUNDING_RADIUS_M =
  Math.hypot(
    JOVIAN_MONOLITH_DIMENSIONS_M.thickness,
    JOVIAN_MONOLITH_DIMENSIONS_M.width,
    JOVIAN_MONOLITH_DIMENSIONS_M.length,
  ) / 2;

function requiredBody(state: SimulationState, bodyId: string): BodyState {
  const body = state.bodies.find((candidate) => candidate.id === bodyId);
  if (body === undefined) {
    throw new Error(`Jovian monolith requires ${bodyId} physics state`);
  }
  return body;
}

/**
 * Place the fictional object at the Jupiter-Io inner Lagrange region.
 *
 * The live Jupiter and Io states come from the simulator. The L1 offset uses
 * the circular restricted three-body approximation r * cbrt(mu / 3), measured
 * from Io towards Jupiter. The object is display-only and is deliberately not
 * inserted into the gravitational integration.
 */
export function jovianMonolithState(state: SimulationState): BodyState {
  const jupiter = requiredBody(state, "jupiter");
  const io = requiredBody(state, "io");
  const delta = [
    jupiter.positionM[0] - io.positionM[0],
    jupiter.positionM[1] - io.positionM[1],
    jupiter.positionM[2] - io.positionM[2],
  ] as const;
  const separationM = Math.hypot(...delta);
  if (!Number.isFinite(separationM) || separationM <= 0) {
    throw new Error("Jupiter-Io separation must be positive and finite");
  }
  const totalGravitationalParameter =
    jupiter.gravitationalParameterM3S2 + io.gravitationalParameterM3S2;
  if (
    !Number.isFinite(totalGravitationalParameter) ||
    totalGravitationalParameter <= 0
  ) {
    throw new Error("Jupiter-Io gravitational parameters are unavailable");
  }
  const massFraction =
    io.gravitationalParameterM3S2 / totalGravitationalParameter;
  const ioToL1Fraction = Math.cbrt(massFraction / 3);
  const positionM: [number, number, number] = [
    io.positionM[0] + delta[0] * ioToL1Fraction,
    io.positionM[1] + delta[1] * ioToL1Fraction,
    io.positionM[2] + delta[2] * ioToL1Fraction,
  ];
  const velocityMps: [number, number, number] = [
    io.velocityMps[0] +
      (jupiter.velocityMps[0] - io.velocityMps[0]) * ioToL1Fraction,
    io.velocityMps[1] +
      (jupiter.velocityMps[1] - io.velocityMps[1]) * ioToL1Fraction,
    io.velocityMps[2] +
      (jupiter.velocityMps[2] - io.velocityMps[2]) * ioToL1Fraction,
  ];
  return {
    id: JOVIAN_MONOLITH_BODY_ID,
    gravitationalParameterM3S2: 0,
    positionM,
    velocityMps,
  };
}
