import { expect, test } from "@playwright/test";

const STORY_SCENES = [
  ["eclipse-alignment", "The Moon orbits Earth as both circle the Sun"],
  ["london-before-contact", "The Moon is ten minutes from first contact"],
  ["london-first-contact", "First contact: the Moon touches the Sun"],
  ["london-maximum", "Maximum: about 91% of the Sun is hidden"],
  ["shadow-from-moon", "Earth fills the sky beyond the lunar night side"],
  ["spain-totality", "On the centre line, the Moon covers the Sun"],
  ["london-final-contact", "Final contact arrives just above the horizon"],
] as const;

const SURFACE_OBSERVERS = new Map([
  ["london-before-contact", [51.5074, -0.1278]],
  ["london-first-contact", [51.5074, -0.1278]],
  ["london-maximum", [51.5074, -0.1278]],
  ["spain-totality", [43.371_666_666_7, -6.188_333_333_3]],
  ["london-final-contact", [51.5074, -0.1278]],
]);

test("shows every eclipse phase with live physical geometry", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Eclipse story" }).click();
  const story = page.getByRole("dialog", {
    name: "12 August 2026 eclipse story",
  });
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(story).toHaveAttribute("data-tour-kind", "eclipse");

  for (const [index, [stepId, title]] of STORY_SCENES.entries()) {
    await expect(story).toHaveAttribute("data-tour-step", stepId);
    await expect(story.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(".error")).toHaveCount(0);
    const requestedTimeSeconds = Number(
      await story.getAttribute("data-tour-time-seconds"),
    );
    await expect(scene).toHaveAttribute("data-rendered-time-seconds", /.+/u, {
      timeout: 30_000,
    });
    await expect
      .poll(
        async () =>
          Math.abs(
            Number(await scene.getAttribute("data-rendered-time-seconds")) -
              requestedTimeSeconds,
          ),
        { timeout: 30_000 },
      )
      .toBeLessThan(0.1);

    const surfaceObserver = SURFACE_OBSERVERS.get(stepId);
    if (surfaceObserver === undefined) {
      await expect(scene).not.toHaveAttribute(
        "data-surface-observer-body",
        /.+/u,
      );
    } else {
      await expect(scene).toHaveAttribute(
        "data-surface-observer-body",
        "earth",
      );
      await expect(scene).toHaveAttribute(
        "data-surface-observer-target",
        "sun",
      );
      await expect(scene).toHaveAttribute(
        "data-surface-observer-latitude-deg",
        surfaceObserver[0]?.toFixed(6) ?? "",
      );
      await expect(scene).toHaveAttribute(
        "data-surface-observer-longitude-deg",
        surfaceObserver[1]?.toFixed(6) ?? "",
      );
      const sunDiameterDeg = Number(
        await scene.getAttribute("data-solar-eclipse-sun-diameter-deg"),
      );
      const moonDiameterDeg = Number(
        await scene.getAttribute("data-solar-eclipse-moon-diameter-deg"),
      );
      expect(sunDiameterDeg).toBeGreaterThan(0.51);
      expect(sunDiameterDeg).toBeLessThan(0.54);
      expect(moonDiameterDeg).toBeGreaterThan(0.52);
      expect(moonDiameterDeg).toBeLessThan(0.57);
    }

    if (stepId === "london-before-contact") {
      expect(
        Number(await scene.getAttribute("data-solar-eclipse-obscuration")),
      ).toBe(0);
    }
    if (stepId === "london-maximum") {
      expect(
        Number(await scene.getAttribute("data-solar-eclipse-obscuration")),
      ).toBeCloseTo(0.913, 2);
      expect(
        Number(await scene.getAttribute("data-surface-target-altitude-deg")),
      ).toBeCloseTo(10.44, 0);
    }
    if (stepId === "spain-totality") {
      expect(
        Number(await scene.getAttribute("data-solar-eclipse-obscuration")),
      ).toBeGreaterThan(0.99);
    }

    await page.waitForTimeout(500);
    await page.screenshot({
      path: testInfo.outputPath(
        `${String(index + 1).padStart(2, "0")}-${stepId}.png`,
      ),
      fullPage: true,
    });
    if (index < STORY_SCENES.length - 1) {
      await page.getByRole("button", { name: "Next" }).click();
    }
  }

  expect(errors).toEqual([]);
});
