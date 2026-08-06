import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import type { BodyState, SimulationState } from "../physics/contracts";
import {
  ASTRONOMICAL_UNIT_M,
  majorBodySnapshot,
  majorBodySystem,
} from "../physics/solar-system";
import { bodyOrientationQuaternion } from "./orientation";
import {
  surfaceHorizonPoint,
  surfaceObserverBodies,
  surfaceObserverFrame,
} from "./surface-observer";

function initialState(): SimulationState {
  return {
    timeSeconds: 0,
    energy: 0,
    bodies: majorBodySystem.bodies,
  };
}

function bodyState(
  id: string,
  positionM: readonly [number, number, number],
): BodyState {
  const definition = majorBodySystem.bodies.find((body) => body.id === id);
  if (definition === undefined) {
    throw new Error(`Test body ${id} is unavailable`);
  }
  return {
    ...definition,
    positionM,
    velocityMps: [0, 0, 0],
  };
}

function icrfMetresFromSceneDirection(direction: Vector3) {
  return [
    direction.x * ASTRONOMICAL_UNIT_M,
    -direction.z * ASTRONOMICAL_UNIT_M,
    direction.y * ASTRONOMICAL_UNIT_M,
  ] as const;
}

describe("surface observer", () => {
  it("offers only bodies with supported solid surfaces", () => {
    const ids = new Set(surfaceObserverBodies.map((body) => body.id));
    expect(ids).toContain("earth");
    expect(ids).toContain("moon");
    expect(ids).toContain("titan");
    expect(ids).not.toContain("sun");
    expect(ids).not.toContain("jupiter");
    expect(ids).not.toContain("saturn");
    expect(ids).not.toContain("uranus");
    expect(ids).not.toContain("neptune");
  });

  it("places the eye two metres above the live oriented reference sphere", () => {
    const frame = surfaceObserverFrame(initialState(), {
      bodyId: "earth",
      latitudeDeg: 51.4779,
      longitudeDeg: 0,
      targetBodyId: "moon",
    });

    expect(
      frame.observerPositionAu.distanceTo(frame.surfacePositionAu) *
        ASTRONOMICAL_UNIT_M,
    ).toBeCloseTo(2, 5);
    expect(frame.zenith.length()).toBeCloseTo(1, 12);
    expect(frame.north.length()).toBeCloseTo(1, 12);
    expect(frame.east.length()).toBeCloseTo(1, 12);
    expect(frame.zenith.dot(frame.north)).toBeCloseTo(0, 12);
    expect(frame.zenith.dot(frame.east)).toBeCloseTo(0, 12);
    expect(frame.north.dot(frame.east)).toBeCloseTo(0, 12);
  });

  it("derives noon, zenith Sun and six/twelve/eighteen geometric events", () => {
    const orientation = bodyOrientationQuaternion("earth", 0);
    const subsolarDirection = new Vector3(1, 0, 0)
      .applyQuaternion(orientation)
      .normalize();
    const state: SimulationState = {
      timeSeconds: 0,
      energy: 0,
      bodies: [
        bodyState("earth", [0, 0, 0]),
        bodyState("sun", icrfMetresFromSceneDirection(subsolarDirection)),
      ],
    };
    const frame = surfaceObserverFrame(state, {
      bodyId: "earth",
      latitudeDeg: 0,
      longitudeDeg: 0,
      targetBodyId: "sun",
    });

    expect(frame.localSolarTimeHours).toBeCloseTo(12, 10);
    expect(frame.sunAltitudeDeg).toBeCloseTo(90, 5);
    expect(frame.solarHorizonEvents).toEqual({
      regime: "normal",
      sunriseLocalSolarHours: 6,
      sunsetLocalSolarHours: 18,
    });
  });

  it("keeps the geometric horizon on the observer reference sphere", () => {
    const earth = majorBodySnapshot.bodies.find((body) => body.id === "earth");
    if (earth === undefined) {
      throw new Error("Earth physical definition is unavailable");
    }
    const state = initialState();
    const earthState = state.bodies.find((body) => body.id === "earth");
    if (earthState === undefined) {
      throw new Error("Earth state is unavailable");
    }
    const earthCenter = new Vector3(
      earthState.positionM[0] / ASTRONOMICAL_UNIT_M,
      earthState.positionM[2] / ASTRONOMICAL_UNIT_M,
      -earthState.positionM[1] / ASTRONOMICAL_UNIT_M,
    );
    const frame = surfaceObserverFrame(state, {
      bodyId: "earth",
      latitudeDeg: -33.8688,
      longitudeDeg: 151.2093,
      targetBodyId: "sun",
    });

    for (const azimuth of [0, 90, 180, 270]) {
      const point = surfaceHorizonPoint(frame, earth.meanRadiusM, azimuth);
      expect(point.distanceTo(earthCenter) * ASTRONOMICAL_UNIT_M).toBeCloseTo(
        earth.meanRadiusM,
        4,
      );
    }
  });

  it("reports live apparent geometry and rejects unsupported observers", () => {
    const frame = surfaceObserverFrame(initialState(), {
      bodyId: "earth",
      latitudeDeg: 0,
      longitudeDeg: 0,
      targetBodyId: "moon",
    });

    expect(frame.targetDistanceM).toBeGreaterThan(300_000_000);
    expect(frame.targetAngularDiameterDeg).toBeGreaterThan(0.4);
    expect(frame.targetAngularDiameterDeg).toBeLessThan(0.7);
    expect(frame.targetIlluminatedFraction).toBeGreaterThanOrEqual(0);
    expect(frame.targetIlluminatedFraction).toBeLessThanOrEqual(1);
    expect(Number.isFinite(frame.targetNorthPolePositionAngleDeg)).toBe(true);
    expect(Number.isFinite(frame.brightLimbPositionAngleDeg)).toBe(true);

    expect(() =>
      surfaceObserverFrame(initialState(), {
        bodyId: "jupiter",
        latitudeDeg: 0,
        longitudeDeg: 0,
        targetBodyId: "sun",
      }),
    ).toThrow("no supported solid surface");
  });
});
