import { describe, expect, it } from "vitest";

import { pointInsideViewport, rayToViewportEdge } from "./sun-guide";

describe("sun guide screen geometry", () => {
  it("clips a bearing ray to the correct viewport edge", () => {
    expect(
      rayToViewportEdge({ x: 400, y: 300 }, { x: 2, y: 1 }, 800, 600, 24),
    ).toEqual({
      x: 776,
      y: 488,
    });
  });

  it("recognises points inside the labelled safe area", () => {
    expect(pointInsideViewport({ x: 24, y: 24 }, 800, 600, 24)).toBe(true);
    expect(pointInsideViewport({ x: 10, y: 300 }, 800, 600, 24)).toBe(false);
  });

  it("keeps an outward bearing on an already reached edge", () => {
    expect(
      rayToViewportEdge({ x: 776, y: 300 }, { x: 1, y: 0 }, 800, 600, 24),
    ).toEqual({ x: 776, y: 300 });
  });

  it("rejects a direction with no bearing", () => {
    expect(() =>
      rayToViewportEdge({ x: 400, y: 300 }, { x: 0, y: 0 }, 800, 600, 24),
    ).toThrow("direction must be positive");
  });
});
