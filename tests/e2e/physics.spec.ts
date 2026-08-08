import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function readCanvasPixels(
  canvas: Locator,
): Promise<Readonly<{ litPixels: number; positionHash: number }>> {
  const screenshot = await canvas.screenshot();
  return canvas.evaluate(
    async (element, pngBytes: number[]) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(pngBytes)], { type: "image/png" }),
      );
      const capture = new OffscreenCanvas(
        (element as HTMLCanvasElement).width,
        (element as HTMLCanvasElement).height,
      );
      const context = capture.getContext("2d");
      if (context === null) {
        throw new Error("2D canvas capture context is unavailable");
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(
        0,
        0,
        capture.width,
        capture.height,
      ).data;
      let litPixels = 0;
      let positionHash = 2_166_136_261;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset] ?? 0;
        const green = pixels[offset + 1] ?? 0;
        const blue = pixels[offset + 2] ?? 0;
        const brightestChannel = Math.max(red, green, blue);
        const darkestChannel = Math.min(red, green, blue);
        const isSmallBodyPixel =
          brightestChannel > 24 && brightestChannel - darkestChannel > 20;
        if (isSmallBodyPixel) {
          litPixels += 1;
          positionHash = Math.imul(positionHash ^ (offset / 4), 16_777_619);
        }
      }
      return { litPixels, positionHash: positionHash >>> 0 };
    },
    [...screenshot],
  );
}

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
  await expect(focus).toHaveValue(label);
}

test("renders solver state and advances time through the physics worker", async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Solar System Explorer" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Run forward" })).toBeVisible();
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Display" }).click();
  const timeOutput = page.locator(".time-readout output");
  await expect(timeOutput).toHaveAttribute(
    "data-time-seconds",
    /-?\d+(?:\.\d+)?/u,
  );
  const initialPausedTimeSeconds = Number(
    await timeOutput.getAttribute("data-time-seconds"),
  );
  expect(Number.isFinite(initialPausedTimeSeconds)).toBe(true);
  await expect(timeOutput).not.toHaveText(/\.\d{3,}\s+days/u);
  const bodyVisibility = page.getByRole("slider", {
    name: "Body size boost",
  });
  const initialTimeRate = page.getByRole("slider", { name: "Playback rate" });
  await expect(bodyVisibility).toHaveValue("100");
  await expect(bodyVisibility).toBeDisabled();
  await expect(initialTimeRate).toHaveValue("2");
  await expect(
    page.getByText("1 hour / second", { exact: true }),
  ).toBeVisible();
  const cameraZoom = page.getByRole("slider", { name: "Camera zoom" });
  const zoomPreset = page.getByRole("combobox", { name: "Zoom preset" });
  const orientation = page.getByRole("combobox", { name: "Orientation" });
  await expect(cameraZoom).toHaveValue("0");
  await expect(zoomPreset).toHaveValue("fit");
  await expect(orientation).toHaveValue("perspective");
  await expect(page.getByText("Physical scale", { exact: true })).toBeVisible();
  const smallBodyCanvas = page.locator("canvas.small-body-layer");
  await expect(smallBodyCanvas).toBeHidden();

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect
    .poll(async () =>
      Math.abs(
        Number(await scene.getAttribute("data-rendered-time-seconds")) -
          Number(await timeOutput.getAttribute("data-time-seconds")),
      ),
    )
    .toBeLessThanOrEqual(0.01);
  await expect(scene).toHaveAttribute(
    "data-semantic-zoom-level",
    "solar-system",
  );
  await expect(scene).toHaveAttribute("data-known-moon-catalogue-count", "459");
  for (const planetId of [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ]) {
    const planetLabel = page.locator(`[data-body-id="${planetId}"]`);
    await expect(planetLabel).toBeVisible();
    await expect(planetLabel).toHaveAttribute("data-body-rendered", "false");
    await expect
      .poll(async () =>
        Number(await planetLabel.getAttribute("data-radius-pixels")),
      )
      .toBeLessThan(0.5);
  }
  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/solar-planet-overview.png`,
      fullPage: true,
    });
  }
  const focus = page.getByRole("combobox", { name: "Focus" });
  const sequenceBeforeSun = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await selectFocus(focus, "Sun");
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(sequenceBeforeSun);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 30_000,
    },
  );
  await expect(scene).toHaveAttribute("data-focus-distance-au", "90.00000000");
  for (const planetId of [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ]) {
    const planetLabel = page.locator(`[data-body-id="${planetId}"]`);
    await expect(planetLabel).toBeVisible();
    await expect(planetLabel).toHaveAttribute("data-body-rendered", "false");
  }
  const sequenceBeforeSolarSystem = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await selectFocus(focus, "Solar System");
  await expect(scene).toHaveAttribute("data-focus-body", "solar-system");
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(sequenceBeforeSolarSystem);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 30_000,
    },
  );

  await expect(scene).toHaveAttribute("data-camera-zoom", "1.00");
  await zoomPreset.selectOption("detail");
  await expect(cameraZoom).toHaveValue("4");
  await expect(scene).toHaveAttribute("data-camera-zoom", "16.00");
  await cameraZoom.fill("1.25");
  await expect(zoomPreset).toHaveValue("custom");
  await expect(scene).toHaveAttribute("data-camera-zoom", "2.38");
  await zoomPreset.selectOption("fit");

  await orientation.selectOption("overhead");
  await expect(scene).toHaveAttribute("data-camera-orientation", "overhead");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-ecliptic-north-dot")),
    )
    .toBeGreaterThan(0.999);
  await orientation.selectOption("edge-on");
  await expect(scene).toHaveAttribute("data-camera-orientation", "edge-on");
  await expect
    .poll(async () =>
      Math.abs(
        Number(await scene.getAttribute("data-camera-ecliptic-north-dot")),
      ),
    )
    .toBeLessThan(0.001);
  await orientation.selectOption("perspective");
  const planets = page.getByRole("checkbox", { name: "Planets" });
  const moons = page.getByRole("checkbox", { name: "Moons" });
  const asteroids = page.getByRole("checkbox", { name: "Asteroids" });
  const comets = page.getByRole("checkbox", { name: "Comets" });
  await page.getByText("Trails and frames", { exact: true }).click();
  const minorBodyTrails = page.getByRole("checkbox", {
    name: "Minor-body trails",
  });
  await expect(planets).toBeChecked();
  await expect(moons).toBeChecked();
  await expect(asteroids).not.toBeChecked();
  await expect(comets).not.toBeChecked();
  await expect(minorBodyTrails).not.toBeChecked();

  await planets.uncheck();
  await expect(scene).toHaveAttribute("data-planets-visible", "false");
  await expect(scene).toHaveAttribute("data-moons-visible", "true");
  await planets.check();
  await moons.uncheck();
  await expect(scene).toHaveAttribute("data-planets-visible", "true");
  await expect(scene).toHaveAttribute("data-moons-visible", "false");
  await moons.check();

  await expect(smallBodyCanvas).toHaveAttribute(
    "data-asteroids-visible",
    "false",
  );
  await expect(smallBodyCanvas).toHaveAttribute("data-comets-visible", "false");
  await expect(smallBodyCanvas).toBeHidden();
  await page.getByRole("button", { name: "Orrery" }).click();
  await expect(bodyVisibility).toBeEnabled();
  await expect(
    page.locator("label", { hasText: "Body size boost" }).locator("output"),
  ).toHaveText("100%");
  await comets.check();
  await expect(
    page.getByText("1,556,349 propagated · 1,791 unavailable"),
  ).toBeVisible({
    timeout: 120_000,
  });
  await expect(scene).toHaveAttribute("data-gpu-authority-positions", "2");
  await expect(scene).toHaveAttribute("data-gpu-presentation", "direct-webgpu");
  await expect(smallBodyCanvas).toHaveAttribute(
    "data-presentation",
    "direct-webgpu",
  );
  await expect(smallBodyCanvas).toHaveAttribute(
    "data-asteroids-visible",
    "false",
  );
  await expect(smallBodyCanvas).toHaveAttribute("data-comets-visible", "true");
  await expect
    .poll(async () => (await readCanvasPixels(smallBodyCanvas)).litPixels, {
      timeout: 30_000,
    })
    .toBeGreaterThan(20);
  await expect
    .poll(async () =>
      Number(
        await smallBodyCanvas.getAttribute("data-comet-visibility-fraction"),
      ),
    )
    .toBeGreaterThan(0.25);
  await page.screenshot({
    path: testInfo.outputPath("comets-only.png"),
    fullPage: true,
  });
  await asteroids.check();
  await expect(smallBodyCanvas).toHaveAttribute(
    "data-asteroids-visible",
    "true",
  );
  await expect
    .poll(async () => (await readCanvasPixels(smallBodyCanvas)).litPixels, {
      timeout: 30_000,
    })
    .toBeGreaterThan(100);
  await minorBodyTrails.check();
  await expect(smallBodyCanvas).toHaveAttribute(
    "data-minor-body-trails",
    "true",
  );
  await page.screenshot({
    path: testInfo.outputPath("wide-view.png"),
    fullPage: true,
  });
  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/solar-upgrade-wide.png`,
      fullPage: true,
    });
  }

  const initialView = await readCanvasPixels(smallBodyCanvas);
  const initialCameraDirection = await scene.getAttribute(
    "data-camera-direction",
  );
  const viewCanvas = page.locator("canvas.major-body-layer");
  await viewCanvas.scrollIntoViewIfNeeded();
  const viewBounds = await viewCanvas.boundingBox();
  if (viewBounds === null) {
    throw new Error("Major-body view canvas has no browser bounds");
  }
  await page.mouse.move(
    viewBounds.x + viewBounds.width / 2,
    viewBounds.y + viewBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    viewBounds.x + viewBounds.width / 2 + 80,
    viewBounds.y + viewBounds.height / 2 + 160,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(orientation).toHaveValue("custom");
  await expect
    .poll(async () => scene.getAttribute("data-camera-direction"))
    .not.toBe(initialCameraDirection);
  await expect
    .poll(async () => (await readCanvasPixels(smallBodyCanvas)).positionHash, {
      timeout: 15_000,
    })
    .not.toBe(initialView.positionHash);
  const rotatedView = await readCanvasPixels(smallBodyCanvas);
  const wideVisibilityFraction = Number(
    await smallBodyCanvas.getAttribute("data-visibility-fraction"),
  );
  expect(wideVisibilityFraction).toBeGreaterThan(0);
  expect(wideVisibilityFraction).toBeLessThan(0.01);
  await viewCanvas.hover();
  await page.mouse.wheel(0, -1_600);
  await expect
    .poll(async () =>
      Number(await smallBodyCanvas.getAttribute("data-visibility-fraction")),
    )
    .toBeGreaterThan(wideVisibilityFraction);
  await expect
    .poll(async () => (await readCanvasPixels(smallBodyCanvas)).positionHash, {
      timeout: 15_000,
    })
    .not.toBe(rotatedView.positionHash);

  const timeRate = page.getByRole("slider", { name: "Playback rate" });
  await timeRate.fill("0");
  await expect(
    page.getByText("1 second / second", { exact: true }),
  ).toBeVisible();
  await timeRate.fill("6");
  await expect(
    page.getByText("1 year / second", { exact: true }),
  ).toBeVisible();
  await timeRate.fill("3");

  await bodyVisibility.fill("0");
  await expect(
    page.locator("label", { hasText: "Body size boost" }).locator("output"),
  ).toHaveText("Physical");
  await bodyVisibility.fill("100");
  await expect(
    page.locator("label", { hasText: "Body size boost" }).locator("output"),
  ).toHaveText("100%");
  await bodyVisibility.fill("50");

  await page.getByRole("button", { name: "Step backward" }).click();
  await expect
    .poll(async () =>
      Number(await timeOutput.getAttribute("data-time-seconds")),
    )
    .toBe(initialPausedTimeSeconds - 86_400);
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect
    .poll(async () =>
      Number(await timeOutput.getAttribute("data-time-seconds")),
    )
    .toBe(initialPausedTimeSeconds);

  const sequenceBeforeEarth = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await selectFocus(focus, "Earth");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(sequenceBeforeEarth);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 15_000,
    },
  );
  await expect(scene).toHaveAttribute("data-focus-distance-au", "0.00204420");
  await expect(cameraZoom).toHaveValue("0");
  await expect(orientation).toHaveValue("sun-facing");
  const earthPrimeMeridianBefore = Number(
    await scene.getAttribute("data-focused-prime-meridian-deg"),
  );
  await expect(smallBodyCanvas).toHaveAttribute(
    "data-focus-region-radius-au",
    "0.050",
  );
  await expect
    .poll(async () =>
      Number(await smallBodyCanvas.getAttribute("data-visibility-fraction")),
    )
    .toBeGreaterThan(wideVisibilityFraction);
  await expect
    .poll(async () => (await readCanvasPixels(smallBodyCanvas)).litPixels, {
      timeout: 30_000,
    })
    .toBeGreaterThan(100);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-earth-moon-separation-pixels")),
    )
    .toBeGreaterThan(20);
  await page.screenshot({
    path: testInfo.outputPath("earth-focus.png"),
    fullPage: true,
  });
  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/solar-upgrade-earth.png`,
      fullPage: true,
    });
  }

  const resetTokenBefore = Number(
    await scene.getAttribute("data-reset-view-token"),
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-reset-view-token")))
    .toBe(resetTokenBefore + 1);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 10_000,
    },
  );
  await expect(cameraZoom).toHaveValue("0");
  await expect(orientation).toHaveValue("sun-facing");
  await expect(scene).toHaveAttribute("data-visible-body-labels", /[1-9]\d*/u);

  const trailFrame = page.getByRole("combobox", { name: "Reference frame" });
  const planetTrails = page.getByRole("checkbox", { name: "Planet trails" });
  const moonTrail = page.getByRole("checkbox", { name: "Moon trail" });
  await expect(trailFrame).toHaveValue("heliocentric");
  await expect(planetTrails).not.toBeChecked();
  await expect(moonTrail).not.toBeChecked();
  await planetTrails.check();
  await moonTrail.check();
  await expect(scene).toHaveAttribute("data-moon-trail-frame", "heliocentric");

  await page.getByRole("button", { name: "Run forward" }).click();

  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect
    .poll(async () =>
      Number(await timeOutput.getAttribute("data-time-seconds")),
    )
    .not.toBe(initialPausedTimeSeconds);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-moon-trail-points")),
    )
    .toBeGreaterThan(1);
  await expect(scene).toHaveAttribute("data-moon-trail-visible", "true");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-planet-trail-points")),
    )
    .toBeGreaterThan(1);
  await expect(scene).toHaveAttribute("data-planet-trail-count", "8");
  await expect(scene).toHaveAttribute("data-planet-trails-visible", "true");
  await planetTrails.uncheck();
  await expect(scene).toHaveAttribute("data-planet-trails-visible", "false");
  await planetTrails.check();
  await expect(scene).toHaveAttribute("data-planet-trails-visible", "true");

  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-focused-prime-meridian-deg")),
    )
    .not.toBe(earthPrimeMeridianBefore);

  await selectFocus(focus, "Jupiter");
  await expect(scene).toHaveAttribute("data-known-moon-point-count", "437");
  await selectFocus(focus, "Himalia (Jupiter)");
  await expect(scene).toHaveAttribute("data-focus-body", "horizons-moon-506");
  await expect(scene).toHaveAttribute("data-known-moon-point-count", "437");
  await expect(
    page.locator(".selected-body-detail").getByText("Himalia", { exact: true }),
  ).toBeVisible();
  await trailFrame.selectOption("parent-relative");
  await expect(scene).toHaveAttribute(
    "data-moon-trail-frame",
    "parent-relative",
  );
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-moon-trail-points")),
    )
    .toBeGreaterThan(1);
  await moonTrail.uncheck();
  await expect(scene).toHaveAttribute("data-moon-trail-visible", "false");
  await moonTrail.check();
  await expect(scene).toHaveAttribute("data-moon-trail-visible", "true");

  await timeRate.fill("5");
  await expect(
    page.getByText("30 days / second", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        Number(await scene.getAttribute("data-interpolation-fraction")),
      { timeout: 10_000 },
    )
    .toBeLessThan(1);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("solar-system.png"),
    fullPage: true,
  });
  await page.locator("canvas.small-body-layer").screenshot({
    path: testInfo.outputPath("small-body-layer.png"),
  });
});
