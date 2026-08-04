import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import { surfaceObserverViewpoint } from "./observer-camera";

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
