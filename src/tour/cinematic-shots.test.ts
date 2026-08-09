import { describe, expect, it } from "vitest";

import { CINEMATIC_SHOTS } from "./cinematic-shots";

describe("cinematic shots", () => {
  it("keeps every Cool Shot physically scaled in Reality mode", () => {
    expect(CINEMATIC_SHOTS).not.toHaveLength(0);
    for (const shot of CINEMATIC_SHOTS) {
      expect(shot.viewMode, shot.name).toBe("reality");
      expect(shot.bodyVisibilityPercent, shot.name).toBe(100);
    }
  });

  it("uses a sunward camera for planetary portraits", () => {
    for (const shotId of [
      "earth-daylight",
      "saturn-ring-skimming",
      "jupiter-daylight",
    ]) {
      expect(
        CINEMATIC_SHOTS.find((shot) => shot.id === shotId)?.orientation,
      ).toBe("sun-facing");
    }
  });

  it("keeps the Moon portrait illuminated at every live orbital phase", () => {
    const moon = CINEMATIC_SHOTS.find((shot) => shot.id === "moon-daylight");
    expect(moon?.orientation).toBe("sun-facing");
    expect(moon?.cameraDistanceAu).toBeGreaterThan(0);
  });
});
