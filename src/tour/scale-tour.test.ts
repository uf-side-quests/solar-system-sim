import { describe, expect, it } from "vitest";

import { majorBodySnapshot } from "../physics/solar-system";
import {
  SCALE_TOUR_STEPS,
  SCALE_TOUR_STEP_DURATION_MS,
  SCALE_TOUR_TRANSITION_DURATION_MS,
} from "./scale-tour";

describe("Solar System scale tour", () => {
  it("gives every camera journey time to establish context and settle", () => {
    expect(SCALE_TOUR_TRANSITION_DURATION_MS).toBeGreaterThanOrEqual(7_000);
    expect(SCALE_TOUR_STEP_DURATION_MS).toBeGreaterThanOrEqual(
      SCALE_TOUR_TRANSITION_DURATION_MS * 2,
    );
  });

  it("uses unique steps with resolvable major-body destinations", () => {
    const knownBodyIds = new Set(
      majorBodySnapshot.bodies.map((body) => body.id),
    );
    knownBodyIds.add("");
    expect(new Set(SCALE_TOUR_STEPS.map((step) => step.id)).size).toBe(
      SCALE_TOUR_STEPS.length,
    );
    for (const step of SCALE_TOUR_STEPS) {
      expect(knownBodyIds.has(step.focusBodyId)).toBe(true);
      expect(step.title.length).toBeGreaterThan(10);
      expect(step.description.length).toBeGreaterThan(40);
      if (step.cameraTargetBodyId === undefined) {
        expect(typeof step.cameraDistanceAu).toBe("number");
        expect(step.cameraDistanceAu).toBeGreaterThan(0);
      } else {
        expect(knownBodyIds.has(step.cameraTargetBodyId)).toBe(true);
        expect(step.cameraTargetBodyId).not.toBe(step.focusBodyId);
        expect(step.cameraDistanceAu).toBe("observer-separation");
        expect(step.transitionOverviewAnchorBodyId).toBe(step.focusBodyId);
      }
      expect([1, 60, 3_600, 86_400, 604_800, 2_592_000]).toContain(
        step.timeRateSecondsPerSecond,
      );
      expect(step.timeRateLabel.length).toBeGreaterThan(20);
      expect(step.cameraZoom).toBeGreaterThanOrEqual(0.5);
      expect(step.cameraZoom).toBeLessThanOrEqual(8);
      expect(knownBodyIds.has(step.transitionOverviewAnchorBodyId)).toBe(true);
      expect(step.transitionOverviewDistanceAu).toBeGreaterThan(0);
      expect(step.bodyVisibilityPercent).toBeGreaterThanOrEqual(0);
      expect(step.bodyVisibilityPercent).toBeLessThanOrEqual(100);
      expect(step.visualKey.length).toBeGreaterThan(20);
    }
  });

  it("moves from a familiar body to the full physical-scale view", () => {
    expect(SCALE_TOUR_STEPS[0]?.focusBodyId).toBe("earth");
    expect(SCALE_TOUR_STEPS.at(-1)?.focusBodyId).toBe("");
    expect(SCALE_TOUR_STEPS[0]?.cameraDistanceAu).toBeLessThan(0.001);
    expect(
      SCALE_TOUR_STEPS.find((step) => step.id === "moon-gap")?.cameraDistanceAu,
    ).toBeGreaterThan(0.005);
    expect(
      SCALE_TOUR_STEPS.find((step) => step.id === "sun-atmosphere")
        ?.cameraDistanceAu,
    ).toBeLessThan(0.04);
    expect(
      SCALE_TOUR_STEPS.find((step) => step.id === "moon-gap")
        ?.transitionOverviewDistanceAu,
    ).toBe(0.012);
  });

  it("includes physically anchored observer viewpoints", () => {
    const observerPairs = new Set(
      SCALE_TOUR_STEPS.filter(
        (step) => step.cameraTargetBodyId !== undefined,
      ).map((step) => `${step.focusBodyId}->${step.cameraTargetBodyId ?? ""}`),
    );
    expect(observerPairs).toContain("mars->sun");
    expect(observerPairs).toContain("jupiter->earth");
    expect(observerPairs).toContain("io->jupiter");
    expect(observerPairs).toContain("titan->saturn");
  });

  it("authors three-dimensional compositions instead of flattening every scene", () => {
    const orientations = new Set(
      SCALE_TOUR_STEPS.map((step) => step.orientation),
    );
    expect(orientations.has("perspective")).toBe(true);
    expect(orientations.has("parent-facing")).toBe(true);
    expect(
      SCALE_TOUR_STEPS.filter((step) => step.orientation === "overhead"),
    ).toHaveLength(0);
    for (const stepId of ["earth", "moon-gap", "jupiter", "saturn"]) {
      expect(
        SCALE_TOUR_STEPS.find((step) => step.id === stepId)?.orientation,
        stepId,
      ).toBe("parent-facing");
    }
  });

  it("keeps guided bodies at physical size", () => {
    for (const step of SCALE_TOUR_STEPS) {
      expect(step.viewMode, step.id).toBe("reality");
      expect(step.bodyVisibilityPercent, step.id).toBe(0);
    }
  });

  it("keeps every authored shot free of unexplained line overlays", () => {
    for (const step of SCALE_TOUR_STEPS) {
      expect(step.overlays.tactical, step.id).toBe(false);
      expect(step.overlays.eclipticGrid, step.id).toBe(false);
      expect(step.overlays.planetTrails, step.id).toBe(false);
      expect(step.overlays.moonTrail, step.id).toBe(false);
      if (step.overlays.orbitGuides) {
        expect(step.visualKey.toLocaleLowerCase(), step.id).toMatch(/orbit/u);
      }
    }
  });
});
