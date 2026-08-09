import { describe, expect, it } from "vitest";

import {
  bodyOrientationAngles,
  bodyOrientationQuaternion,
  siderealRotationPeriodHours,
  siderealRotationRateRadPerSecond,
} from "./orientation";
import { majorBodySnapshot } from "../physics/solar-system";

describe("NAIF body orientation", () => {
  it("advances Earth by its published sidereal rotation rate", () => {
    const initial = bodyOrientationAngles("earth", 0);
    const oneDay = bodyOrientationAngles("earth", 86_400);
    expect(oneDay.primeMeridianDeg - initial.primeMeridianDeg).toBeCloseTo(
      360.9856235,
      6,
    );
  });

  it("preserves retrograde rotation signs", () => {
    const venusInitial = bodyOrientationAngles("venus", 0);
    const venusDay = bodyOrientationAngles("venus", 86_400);
    const uranusInitial = bodyOrientationAngles("uranus", 0);
    const uranusDay = bodyOrientationAngles("uranus", 86_400);
    expect(venusDay.primeMeridianDeg).toBeLessThan(
      venusInitial.primeMeridianDeg,
    );
    expect(uranusDay.primeMeridianDeg).toBeLessThan(
      uranusInitial.primeMeridianDeg,
    );
    expect(siderealRotationRateRadPerSecond("earth")).toBeGreaterThan(0);
    expect(siderealRotationRateRadPerSecond("venus")).toBeLessThan(0);
  });

  it("uses the NAIF Venus retrograde rotation rate", () => {
    const venus = majorBodySnapshot.bodies.find((body) => body.id === "venus");
    if (venus === undefined) {
      throw new Error("Venus is missing from the major-body snapshot");
    }
    const initial = bodyOrientationAngles("venus", 0);
    const oneDay = bodyOrientationAngles("venus", 86_400);
    expect(oneDay.primeMeridianDeg - initial.primeMeridianDeg).toBeCloseTo(
      -1.4813688,
      7,
    );
    expect(siderealRotationPeriodHours(venus) / 24).toBeCloseTo(243.018, 3);
  });

  it("returns a normalized scene quaternion for the Moon", () => {
    expect(bodyOrientationQuaternion("moon", 0).length()).toBeCloseTo(1, 12);
  });

  it("turns the rendered Earth transform by the prime-meridian advance", () => {
    const initial = bodyOrientationQuaternion("earth", 0);
    const threeHours = bodyOrientationQuaternion("earth", 3 * 3_600);
    expect((initial.angleTo(threeHours) * 180) / Math.PI).toBeCloseTo(
      45.1232,
      4,
    );
  });
});
