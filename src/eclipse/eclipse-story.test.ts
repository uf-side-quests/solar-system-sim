import { describe, expect, it } from "vitest";

import {
  ECLIPSE_STORY_STEPS,
  LONDON_ECLIPSE,
  LONDON_ECLIPSE_OBSERVER,
  SPAIN_CENTRE_LINE_OBSERVER,
} from "./eclipse-story";

describe("12 August 2026 eclipse story", () => {
  it("matches NASA's published London circumstances", () => {
    expect(LONDON_ECLIPSE.partialBeginUtc).toBe("2026-08-12T17:17:12.171Z");
    expect(LONDON_ECLIPSE.maximumUtc).toBe("2026-08-12T18:13:11.748Z");
    expect(LONDON_ECLIPSE.partialEndUtc).toBe("2026-08-12T19:06:11.180Z");
    expect(LONDON_ECLIPSE.maximumObscuration).toBeCloseTo(0.9133, 4);
    expect(LONDON_ECLIPSE.maximumSunAltitudeDeg).toBeCloseTo(10.44, 2);
  });

  it("uses physical observer locations for London and the Spanish centre line", () => {
    expect(LONDON_ECLIPSE_OBSERVER).toEqual({
      name: "London",
      latitudeDeg: 51.5074,
      longitudeDeg: -0.1278,
    });
    expect(SPAIN_CENTRE_LINE_OBSERVER.latitudeDeg).toBeCloseTo(43.3717, 4);
    expect(SPAIN_CENTRE_LINE_OBSERVER.longitudeDeg).toBeCloseTo(-6.1883, 4);
  });

  it("keeps every view in the same physical renderer", () => {
    expect(ECLIPSE_STORY_STEPS).toHaveLength(8);
    expect(new Set(ECLIPSE_STORY_STEPS.map((step) => step.id)).size).toBe(8);
    for (const step of ECLIPSE_STORY_STEPS) {
      expect(step.viewMode, step.id).toBe("reality");
      expect(step.bodyVisibilityPercent, step.id).toBe(0);
      expect(step.timeSeconds, step.id).toBeGreaterThan(0);
      expect(step.overlays.tactical, step.id).toBe(false);
      expect(step.overlays.eclipticGrid, step.id).toBe(false);
      expect(step.overlays.planetTrails, step.id).toBe(false);
      expect(step.overlays.moonTrail, step.id).toBe(false);
      expect(step.narration.audioSource).toBe(`/audio/tour/${step.id}.mp3`);
      expect(step.narration.text.length).toBeGreaterThan(120);
    }
  });

  it("starts with the Sun-Moon-Earth alignment and visible lunar motion", () => {
    const opening = ECLIPSE_STORY_STEPS[0];
    expect(opening?.orientation).toBe("perspective");
    expect(opening?.timeRateSecondsPerSecond).toBe(3_600);
    expect(opening?.overlays.orbitGuides).toBe(true);
    expect(opening?.overlays.moonTrail).toBe(false);
    expect(opening?.title).toContain("Sun-Earth line");
    expect(opening?.description).toContain("Earth and Moon separate");
  });

  it("bridges the London view to a physical lunar-limb view", () => {
    const shadowAxis = ECLIPSE_STORY_STEPS.find(
      (step) => step.id === "shadow-axis",
    );
    const lunarLimb = ECLIPSE_STORY_STEPS.find(
      (step) => step.id === "shadow-from-moon",
    );
    expect(shadowAxis?.orientation).toBe("perspective");
    expect(shadowAxis?.focusBodyId).toBe("earth");
    expect(shadowAxis?.overlays.orbitGuides).toBe(true);
    expect(lunarLimb?.focusBodyId).toBe("moon");
    expect(lunarLimb?.cameraTargetBodyId).toBe("earth");
    expect(lunarLimb?.observerCameraStyle).toBe("limb");
  });

  it("uses surface views for each contact phase and totality comparison", () => {
    const surfaceStepIds = ECLIPSE_STORY_STEPS.filter(
      (step) => step.surfaceObserver !== undefined,
    ).map((step) => step.id);
    expect(surfaceStepIds).toEqual([
      "london-before-contact",
      "london-first-contact",
      "london-maximum",
      "spain-totality",
      "london-final-contact",
    ]);
  });
});
