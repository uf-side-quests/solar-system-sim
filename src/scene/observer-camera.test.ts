import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import {
  limbObserverViewpoint,
  surfaceObserverViewpoint,
} from "./observer-camera";

describe("surfaceObserverViewpoint", () => {
  it("places the camera above the observer radius toward the target", () => {
    const radiusM = 1_821_600;
    const viewpoint = surfaceObserverViewpoint(
      new Vector3(5, 0, 0),
      new Vector3(5.003, 0, 0),
      radiusM,
    );

    expect(viewpoint.altitudeKm).toBeCloseTo(18.216, 6);
    expect(viewpoint.position.x - 5).toBeCloseTo(
      (radiusM * 1.01) / ASTRONOMICAL_UNIT_M,
      12,
    );
    expect(viewpoint.position.y).toBe(0);
    expect(viewpoint.position.z).toBe(0);
    expect(viewpoint.up).toEqual(new Vector3(0, 1, 0));
  });

  it("places a limb camera above the observer and perpendicular to the target", () => {
    const radiusM = 1_737_400;
    const altitudeM = 5_000;
    const viewpoint = limbObserverViewpoint(
      new Vector3(5, 0, 0),
      new Vector3(5.003, 0, 0),
      radiusM,
      new Vector3(0, 1, 0),
      altitudeM,
      0,
    );

    expect(viewpoint.altitudeKm).toBe(5);
    expect(viewpoint.position.x).toBe(5);
    expect(viewpoint.position.y).toBeCloseTo(
      (radiusM + altitudeM) / ASTRONOMICAL_UNIT_M,
      12,
    );
    expect(viewpoint.position.z).toBe(0);
    expect(viewpoint.up).toEqual(new Vector3(0, 1, 0));
  });

  it("places a target below the geometric horizon for a sunlit limb", () => {
    const viewpoint = limbObserverViewpoint(
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      1_737_400,
      new Vector3(0, 1, 0),
      5_000,
      -2,
    );

    expect(viewpoint.up.dot(new Vector3(1, 0, 0))).toBeCloseTo(
      Math.sin((-2 * Math.PI) / 180),
      12,
    );
  });

  it("rejects coincident observer and target positions", () => {
    expect(() =>
      surfaceObserverViewpoint(
        new Vector3(1, 2, 3),
        new Vector3(1, 2, 3),
        1_000,
      ),
    ).toThrow("distinct finite positions");
  });

  it("rejects a target inside the observer body", () => {
    expect(() =>
      surfaceObserverViewpoint(
        new Vector3(0, 0, 0),
        new Vector3(1e-9, 0, 0),
        1_000_000,
      ),
    ).toThrow("outside the observer body");
  });
});
