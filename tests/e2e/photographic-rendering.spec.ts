import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";

async function focusBody(
  page: Page,
  scene: Locator,
  name: string,
  bodyId: string,
): Promise<void> {
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill(name);
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", bodyId);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-transition-elapsed-ms")),
    )
    .toBeGreaterThan(500);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 30_000 },
  );
}

test("uses photographic rendering with inverse-square sunlight and measured diagnostics", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await expect(scene).toHaveAttribute("data-visual-quality", "photographic");
  await expect(scene).toHaveAttribute(
    "data-solar-illumination-model",
    "inverse-square",
  );
  await expect(scene).toHaveAttribute(
    "data-atmosphere-model",
    "sunlit-single-scattering-approximation",
  );
  await expect(scene).toHaveAttribute(
    "data-saturn-ring-lighting",
    "cassini-profile-solar-incidence-mutual-shadowing-and-depth-occlusion",
  );
  await expect(scene).toHaveAttribute(
    "data-saturn-ring-exposure",
    "live-camera-exposure",
  );
  await expect(scene).toHaveAttribute(
    "data-saturn-ring-occlusion",
    "continuous-sheet-against-opaque-globe-logarithmic-depth-buffer",
  );
  await expect(scene).toHaveAttribute(
    "data-uranus-ring-model",
    "pds-13-ring-radii-widths-optical-depths",
  );
  await expect(scene).toHaveAttribute("data-uranus-ring-count", "13");
  await expect(scene).toHaveAttribute(
    "data-uranus-ring-inner-radius-km",
    "37850",
  );
  await expect(scene).toHaveAttribute(
    "data-uranus-ring-outer-radius-km",
    "106200",
  );

  await page.getByRole("button", { name: "Display" }).click();
  const quality = page.getByRole("combobox", { name: "Rendering quality" });
  await quality.selectOption("battery");
  await expect(scene).toHaveAttribute("data-visual-quality", "battery");
  expect(
    Number(await scene.getAttribute("data-render-pixel-ratio")),
  ).toBeLessThanOrEqual(1);
  await quality.selectOption("balanced");
  await expect(scene).toHaveAttribute("data-visual-quality", "balanced");
  await quality.selectOption("photographic");
  await expect(scene).toHaveAttribute("data-visual-quality", "photographic");
  await page.getByRole("tab", { name: "Guides" }).click();
  await page.getByRole("combobox", { name: "Wayfinders" }).selectOption("off");
  await page.getByRole("tab", { name: "View" }).click();
  await page.getByRole("checkbox", { name: "Labels" }).uncheck();
  await page.getByRole("button", { name: "Close" }).click();

  await focusBody(page, scene, "Earth", "earth");
  await expect(
    page.locator('.body-label[data-body-id="earth"]'),
  ).toHaveAttribute("data-surface-asset-state", "loaded", {
    timeout: 60_000,
  });
  expect(
    Number(await scene.getAttribute("data-exposure-reference-distance-au")),
  ).toBeGreaterThan(0.98);
  expect(
    Number(await scene.getAttribute("data-focused-sun-camera-alignment")),
  ).toBeGreaterThan(0.9);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.screenshot({
    path: testInfo.outputPath("photographic-earth.png"),
    animations: "disabled",
  });

  await focusBody(page, scene, "Saturn", "saturn");
  await expect(scene).toHaveAttribute(
    "data-saturn-ring-asset-state",
    "loaded",
    {
      timeout: 60_000,
    },
  );
  expect(
    Number(await scene.getAttribute("data-camera-exposure-target")),
  ).toBeGreaterThan(50);
  expect(
    Number(await scene.getAttribute("data-focused-sun-camera-alignment")),
  ).toBeGreaterThan(0.9);
  await page.getByRole("button", { name: "Zoom in" }).click();
  const saturnCanvas = page.locator("canvas.major-body-layer");
  const saturnFrame = await saturnCanvas.screenshot({
    animations: "disabled",
  });
  const saturnLabel = page.locator('.body-label[data-body-id="saturn"]');
  const saturnX = Number(await saturnLabel.getAttribute("data-screen-x"));
  const saturnY = Number(await saturnLabel.getAttribute("data-screen-y"));
  const saturnRadius = Number(
    await saturnLabel.getAttribute("data-radius-pixels"),
  );
  const { data: saturnPixels, info: saturnImage } = await sharp(saturnFrame)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visibleRingPixelCount = 0;
  let brightRingPixelCount = 0;
  let neutralRingPixelCount = 0;
  let brownRingPixelCount = 0;
  for (let y = 0; y < saturnImage.height; y += 1) {
    for (let x = 0; x < saturnImage.width; x += 1) {
      const distance = Math.hypot(x - saturnX, y - saturnY);
      if (distance <= saturnRadius * 1.08 || distance >= saturnRadius * 2.5) {
        continue;
      }
      const pixelOffset = (y * saturnImage.width + x) * saturnImage.channels;
      const red = saturnPixels[pixelOffset] ?? 0;
      const green = saturnPixels[pixelOffset + 1] ?? 0;
      const blue = saturnPixels[pixelOffset + 2] ?? 0;
      const maximumChannel = Math.max(red, green, blue);
      const minimumChannel = Math.min(red, green, blue);
      if (maximumChannel <= 35) {
        continue;
      }
      visibleRingPixelCount += 1;
      if (red + green + blue > 240) {
        brightRingPixelCount += 1;
      }
      if (maximumChannel - minimumChannel < 64) {
        neutralRingPixelCount += 1;
      }
      if (red > green * 1.18 && red > blue * 1.45) {
        brownRingPixelCount += 1;
      }
    }
  }
  await page.screenshot({
    path: testInfo.outputPath("photographic-saturn.png"),
    animations: "disabled",
  });
  expect(visibleRingPixelCount).toBeGreaterThan(5_000);
  expect(brightRingPixelCount).toBeGreaterThan(1_000);
  expect(neutralRingPixelCount / visibleRingPixelCount).toBeGreaterThan(0.7);
  expect(brownRingPixelCount / visibleRingPixelCount).toBeLessThan(0.08);

  await focusBody(page, scene, "Uranus", "uranus");
  await page.screenshot({
    path: testInfo.outputPath("photographic-uranus-rings.png"),
    animations: "disabled",
  });

  await focusBody(page, scene, "Sun", "sun");
  expect(
    Number(await scene.getAttribute("data-camera-exposure-target")),
  ).toBeCloseTo(1.05, 2);
  await page.waitForTimeout(1_000);
  const frameIntervalMs = Number(
    await scene.getAttribute("data-render-frame-interval-ms"),
  );
  const cpuSubmissionMs = Number(
    await scene.getAttribute("data-render-cpu-submission-ms"),
  );
  expect(frameIntervalMs).toBeGreaterThan(0);
  expect(frameIntervalMs).toBeLessThan(250);
  expect(cpuSubmissionMs).toBeGreaterThanOrEqual(0);
  expect(Number(await scene.getAttribute("data-render-calls"))).toBeGreaterThan(
    0,
  );
  const sunCanvas = await page
    .locator("canvas.major-body-layer")
    .screenshot({ animations: "disabled" });
  expect(sunCanvas.byteLength).toBeGreaterThan(5_000);
  await page.screenshot({
    path: testInfo.outputPath("photographic-sun.png"),
    animations: "disabled",
  });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("keeps both physical ring systems coherent across camera orientations", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  for (const [name, bodyId] of [
    ["Saturn", "saturn"],
    ["Uranus", "uranus"],
  ] as const) {
    await focusBody(page, scene, name, bodyId);
    for (const orientation of ["sun-facing", "overhead", "edge-on"] as const) {
      await page.getByRole("button", { name: "Display" }).click();
      await page.getByRole("tab", { name: "Camera" }).click();
      await page
        .getByRole("combobox", { name: "Orientation" })
        .selectOption(orientation);
      await expect(scene).toHaveAttribute(
        "data-camera-orientation",
        orientation,
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-phase",
        "settled",
        { timeout: 30_000 },
      );
      await page.getByRole("button", { name: "Close" }).click();
      await canvas.screenshot({
        path: testInfo.outputPath(`${bodyId}-${orientation}.png`),
        animations: "disabled",
      });
    }
  }

  await focusBody(page, scene, "Saturn", "saturn");
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await page
    .getByRole("combobox", { name: "Orientation" })
    .selectOption("sun-facing");
  await page.getByRole("button", { name: "Close" }).click();
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await zoomIn.click();
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 30_000,
    },
  );
  await canvas.screenshot({
    path: testInfo.outputPath("saturn-close-oblique.png"),
    animations: "disabled",
  });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("renders the restrained solar photosphere in the authored close-view scene", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Scale tour" }).click();
  const tourNext = page.getByRole("button", { name: "Next", exact: true });
  await tourNext.click();
  await tourNext.click();
  await expect(
    page.getByText("The Sun is more than a yellow ball", { exact: true }),
  ).toBeVisible();
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await expect(scene).toHaveAttribute(
    "data-solar-presentation",
    "procedural-non-observational",
  );
  await expect(scene).toHaveAttribute("data-solar-prominence-count", "0");
  const canvas = page.locator("canvas.major-body-layer");
  const capture = await canvas.screenshot({ animations: "disabled" });
  expect(capture.byteLength).toBeGreaterThan(10_000);
  await page.screenshot({
    path: testInfo.outputPath("photographic-sun-close.png"),
    animations: "disabled",
  });
});
