import { expect, test } from "@playwright/test";

async function waitForCameraJourney(
  scene: import("@playwright/test").Locator,
  previousSequence: string | null,
): Promise<void> {
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(previousSequence);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 16_000 },
  );
}

test("keeps escape navigation visible and guides the user through scale", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const cameraNavigation = page.getByRole("navigation", {
    name: "Camera navigation",
  });
  await expect(cameraNavigation).toBeVisible();
  await expect(scene).toHaveAttribute(
    "data-solar-presentation",
    "procedural-non-observational",
  );
  await expect(scene).toHaveAttribute(
    "data-solar-photosphere",
    "procedural-granulation",
  );
  await expect(scene).toHaveAttribute("data-solar-corona-layers", "2");
  await expect(scene).toHaveAttribute("data-solar-prominence-count", "0");
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-centre" })).toBeVisible();

  const focus = page.getByRole("combobox", { name: "Focus" });
  const sequenceBeforeEarth = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await focus.fill("Earth");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await waitForCameraJourney(scene, sequenceBeforeEarth);
  await expect(scene).toHaveAttribute("data-camera-orientation", "sun-facing");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(0.000_170_35, 7);
  const earthLabel = page.locator('[data-body-id="earth"]');
  const labelFontSize = await earthLabel.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  expect(labelFontSize).toBeLessThan(10);
  await expect(scene).toHaveAttribute("data-orbit-guide-count", "0");
  await expect(scene).toHaveAttribute("data-tactical-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-planet-trails-visible", "false");
  await page.screenshot({
    path: testInfo.outputPath("earth-object-focus.png"),
    fullPage: true,
  });

  const sequenceBeforeTour = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await page.getByRole("button", { name: "Scale tour" }).click();
  const tour = page.getByRole("dialog", {
    name: "Scale of the Solar System tour",
  });
  await expect(tour).toBeVisible();
  await expect(tour).toHaveAttribute("data-tour-minimised", "false");
  await tour.getByRole("button", { name: "Minimise" }).click();
  await expect(tour).toHaveAttribute("data-tour-minimised", "true");
  await expect(tour.getByRole("heading")).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("scale-tour-minimised.png"),
    fullPage: true,
  });
  await tour.getByRole("button", { name: "Restore" }).click();
  await expect(tour).toHaveAttribute("data-tour-minimised", "false");
  await expect(tour).toHaveAttribute("data-tour-step", "earth");
  await expect(tour).toHaveAttribute(
    "data-tour-time-rate-seconds-per-second",
    "3600",
  );
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await waitForCameraJourney(scene, sequenceBeforeTour);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(0.000_18, 8);
  await expect(
    tour.getByText("Physical sizes · no guides or trails", { exact: true }),
  ).toBeVisible();
  const initialPrimeMeridian = Number(
    await scene.getAttribute("data-focused-prime-meridian-deg"),
  );
  await page.waitForTimeout(500);
  const movingPrimeMeridian = Number(
    await scene.getAttribute("data-focused-prime-meridian-deg"),
  );
  expect(Math.abs(movingPrimeMeridian - initialPrimeMeridian)).toBeGreaterThan(
    2,
  );
  await page.getByRole("button", { name: "Pause tour" }).click();
  await expect(tour).toHaveAttribute("data-tour-playing", "false");
  await page.waitForTimeout(250);
  const pausedPrimeMeridian = Number(
    await scene.getAttribute("data-focused-prime-meridian-deg"),
  );
  await page.waitForTimeout(400);
  expect(
    Number(await scene.getAttribute("data-focused-prime-meridian-deg")),
  ).toBeCloseTo(pausedPrimeMeridian, 4);

  const fittedDistance = Number(
    await scene.getAttribute("data-camera-distance-au"),
  );
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(scene).toHaveAttribute(
    "data-camera-navigation-action",
    "zoom-out",
  );
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeGreaterThan(fittedDistance);

  const resetTokenBeforeRecenter = Number(
    await scene.getAttribute("data-reset-view-token"),
  );
  await page.getByRole("button", { name: "Re-centre" }).click();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-reset-view-token")))
    .toBeGreaterThan(resetTokenBeforeRecenter);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 20_000 },
  );
  await expect(scene).toHaveAttribute("data-camera-orientation", "sun-facing");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(fittedDistance, 6);

  const sequenceBeforeMoonGap = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAttribute("data-tour-step", "moon-gap");
  await expect(tour).toHaveAttribute(
    "data-tour-time-rate-seconds-per-second",
    "86400",
  );
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await waitForCameraJourney(scene, sequenceBeforeMoonGap);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-route-points",
    "2",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-overview-anchor",
    "not-used-direct-flight",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-interpolation",
    "orient-then-direct-flight",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-duration-ms",
    "12000",
  );
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(0.007, 7);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-orbit-guide-count")),
    )
    .toBe(1);
  await expect(
    tour.getByText("Thin blue curve · the Moon's orbital path around Earth", {
      exact: true,
    }),
  ).toBeVisible();

  const sequenceBeforeSun = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAttribute("data-tour-step", "sun-atmosphere");
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await waitForCameraJourney(scene, sequenceBeforeSun);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(0.032, 6);
  await expect(
    tour.getByText(
      "Photosphere, chromosphere and quiet corona · solar activity is illustrative",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("sun-atmosphere.png"),
    fullPage: true,
  });

  const sequenceBeforeMars = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAttribute("data-tour-step", "sun-from-mars");
  await expect(tour).toHaveAttribute("data-tour-observer", "mars");
  await expect(tour).toHaveAttribute("data-tour-target", "sun");
  await expect(scene).toHaveAttribute("data-focus-body", "mars");
  await expect(scene).toHaveAttribute("data-camera-observer-body", "mars");
  await expect(scene).toHaveAttribute("data-camera-target-body", "sun");
  await waitForCameraJourney(scene, sequenceBeforeMars);
  await expect(scene).toHaveAttribute(
    "data-camera-orientation",
    "observer-facing",
  );
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeGreaterThan(1);
  await expect(
    tour.getByText(
      "Physical sizes and separation · 8× optical camera zoom · observer at Mars",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("sun-from-mars.png"),
    fullPage: true,
  });

  const sequenceBeforeJupiter = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await page.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAttribute("data-tour-step", "jupiter");
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
  await expect(scene).toHaveAttribute("data-view-mode", "reality");
  await waitForCameraJourney(scene, sequenceBeforeJupiter);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(0.025, 7);
  await expect(
    tour.getByText(
      "Thin blue curves · major-moon orbits; all bodies retain physical size",
      { exact: true },
    ),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("scale-tour.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Exit" }).click();
  await expect(tour).toHaveCount(0);
  await expect(cameraNavigation).toBeVisible();
});
