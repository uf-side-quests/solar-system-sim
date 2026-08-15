import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import {
  circleOverlapFraction,
  eclipseTransmissionAtPoint,
  exposureEvFromMultiplier,
  exposureMultiplierFromEv,
  selectSolarOccluders,
} from "./physical-lighting";

describe("finite solar-disc lighting", () => {
  it("returns full light when the discs do not overlap", () => {
    expect(circleOverlapFraction(0.01, 0.02, 0.031)).toBe(0);
  });

  it("returns full occlusion when a larger blocker covers the source", () => {
    expect(circleOverlapFraction(0.01, 0.02, 0.005)).toBe(1);
  });

  it("returns the source area fraction for a centred smaller blocker", () => {
    expect(circleOverlapFraction(0.02, 0.01, 0)).toBeCloseTo(0.25, 12);
  });

  it("selects only blockers between the receiver and the Sun", () => {
    const selected = selectSolarOccluders(
      "earth",
      new Vector3(0, 0, 0),
      0.000_04,
      new Vector3(1, 0, 0),
      0.004_65,
      [
        {
          id: "moon",
          positionAu: new Vector3(0.002_57, 0, 0),
          radiusAu: 0.000_011_6,
        },
        { id: "behind", positionAu: new Vector3(-0.01, 0, 0), radiusAu: 0.001 },
        { id: "side", positionAu: new Vector3(0.1, 0.1, 0), radiusAu: 0.001 },
      ],
    );
    expect(selected.map((candidate) => candidate.id)).toEqual(["moon"]);
  });

  it("uses the same finite discs to attenuate a receiver atmosphere", () => {
    expect(
      eclipseTransmissionAtPoint(
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        0.01,
        [
          {
            id: "moon",
            positionAu: new Vector3(0.1, 0, 0),
            radiusAu: 0.001,
          },
        ],
      ),
    ).toBeCloseTo(0, 12);
  });
});

describe("camera exposure EV", () => {
  it("uses one stop for each exposure-value step", () => {
    expect(exposureMultiplierFromEv(3)).toBe(8);
    expect(exposureEvFromMultiplier(8)).toBe(3);
  });

  it("rejects invalid values", () => {
    expect(() => exposureMultiplierFromEv(Number.NaN)).toThrow(
      "Exposure EV must be finite",
    );
    expect(() => exposureEvFromMultiplier(0)).toThrow(
      "Exposure multiplier must be positive and finite",
    );
  });
});
