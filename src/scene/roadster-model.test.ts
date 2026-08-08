import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ASTRONOMICAL_UNIT_M } from "../physics/solar-system";
import {
  createRoadsterAndStarmanModel,
  ROADSTER_BODY_ID,
  ROADSTER_LENGTH_M,
} from "./roadster-model";

describe("Roadster and Starman model", () => {
  it("is selectable and rendered at physical scale", () => {
    const model = createRoadsterAndStarmanModel();
    model.updateMatrixWorld(true);
    const sizeAu = new Box3().setFromObject(model).getSize(new Vector3());
    expect(
      Math.max(sizeAu.x, sizeAu.y, sizeAu.z) * ASTRONOMICAL_UNIT_M,
    ).toBeCloseTo(ROADSTER_LENGTH_M, 6);
    model.traverse((object) => {
      if (object.type === "Mesh") {
        expect(object.userData["bodyId"]).toBe(ROADSTER_BODY_ID);
      }
    });
  });
});
