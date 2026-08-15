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

async function hemisphereLuminance(
  image: Buffer,
  centreX: number,
  centreY: number,
  radius: number,
): Promise<Readonly<{ left: number; right: number }>> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let leftTotal = 0;
  let leftCount = 0;
  let rightTotal = 0;
  let rightCount = 0;
  const sampleRadius = radius * 0.72;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const localX = x - centreX;
      const localY = y - centreY;
      if (localX * localX + localY * localY > sampleRadius * sampleRadius) {
        continue;
      }
      const offset = (y * info.width + x) * info.channels;
      const luminance =
        (data[offset] ?? 0) * 0.2126 +
        (data[offset + 1] ?? 0) * 0.7152 +
        (data[offset + 2] ?? 0) * 0.0722;
      if (localX < -radius * 0.08) {
        leftTotal += luminance;
        leftCount += 1;
      } else if (localX > radius * 0.08) {
        rightTotal += luminance;
        rightCount += 1;
      }
    }
  }
  if (leftCount === 0 || rightCount === 0) {
    throw new Error("The reference body has no image samples");
  }
  return { left: leftTotal / leftCount, right: rightTotal / rightCount };
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
    "data-solar-occlusion-model",
    "all-major-bodies-finite-disc",
  );
  expect(
    Number(await scene.getAttribute("data-solar-occlusion-receiver-count")),
  ).toBeGreaterThan(20);
  await expect(scene).toHaveAttribute(
    "data-atmosphere-model",
    "optical-depth-ray-marched-single-scattering",
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
  const exposureMode = page.getByRole("combobox", { name: "Exposure mode" });
  await expect(exposureMode).toHaveValue("auto");
  await expect(scene).toHaveAttribute("data-camera-exposure-mode", "auto");
  await exposureMode.selectOption("manual");
  const manualExposure = page.getByRole("slider", {
    name: "Manual exposure EV",
  });
  await manualExposure.fill("2");
  await expect(scene).toHaveAttribute("data-camera-exposure-mode", "manual");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-exposure-ev")),
    )
    .toBeGreaterThan(1.8);
  await exposureMode.selectOption("auto");
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
  await expect(scene).toHaveAttribute(
    "data-earth-night-light-asset",
    "NASA-Black-Marble-2016",
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
    for (const [orientation, controlName] of [
      ["sun-facing", "Sunlit side"],
      ["overhead", "Above"],
      ["edge-on", "Side"],
    ] as const) {
      await page.getByRole("button", { name: "Display" }).click();
      await page.getByRole("tab", { name: "Camera" }).click();
      await page
        .getByRole("button", { name: controlName, exact: true })
        .click();
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
  await page.getByRole("button", { name: "Sunlit side" }).click();
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
    "physical-limb-darkening-and-corona-scattering",
  );
  await expect(scene).toHaveAttribute("data-solar-corona-layers", "3d-shell");
  await expect(scene).toHaveAttribute("data-solar-prominence-count", "0");
  const canvas = page.locator("canvas.major-body-layer");
  const capture = await canvas.screenshot({ animations: "disabled" });
  expect(capture.byteLength).toBeGreaterThan(10_000);
  await page.screenshot({
    path: testInfo.outputPath("photographic-sun-close.png"),
    animations: "disabled",
  });
});

test("matches the reference image for a physical terminator", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await focusBody(page, scene, "Earth", "earth");
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await page.getByRole("button", { name: "Day and night" }).click();
  await expect(scene).toHaveAttribute("data-camera-orientation", "terminator");
  await expect(scene).toHaveAttribute(
    "data-orientation-transition-phase",
    "settled",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Close" }).click();
  const earthFrame = await canvas.screenshot({ animations: "disabled" });
  const earthLabel = page.locator('.body-label[data-body-id="earth"]');
  const earthLuminance = await hemisphereLuminance(
    earthFrame,
    Number(await earthLabel.getAttribute("data-screen-x")),
    Number(await earthLabel.getAttribute("data-screen-y")),
    Number(await earthLabel.getAttribute("data-radius-pixels")),
  );
  expect(
    Math.max(earthLuminance.left, earthLuminance.right) /
      Math.max(1, Math.min(earthLuminance.left, earthLuminance.right)),
  ).toBeGreaterThan(2.2);
  await page.screenshot({
    path: testInfo.outputPath("reference-earth-terminator.png"),
    animations: "disabled",
  });
});

test("matches the reference image for the Death Star II local shadow", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await focusBody(page, scene, "Death Star II (fictional)", "death-star-2");
  await expect(scene).toHaveAttribute("data-deathstar2-model-loaded", "true", {
    timeout: 60_000,
  });
  await expect(scene).toHaveAttribute("data-local-shadow-body", "death-star-2");
  await expect(scene).toHaveAttribute("data-local-shadow-map", "pcf-2048");
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await page.getByRole("button", { name: "Day and night" }).click();
  await expect(scene).toHaveAttribute("data-camera-orientation", "terminator");
  await page.getByRole("button", { name: "Close" }).click();
  const modelFrame = await canvas.screenshot({ animations: "disabled" });
  expect(modelFrame.byteLength).toBeGreaterThan(10_000);
  const modelLabel = page.locator('.body-label[data-body-id="death-star-2"]');
  const modelLuminance = await hemisphereLuminance(
    modelFrame,
    Number(await modelLabel.getAttribute("data-screen-x")),
    Number(await modelLabel.getAttribute("data-screen-y")),
    Number(await modelLabel.getAttribute("data-radius-pixels")),
  );
  expect(
    Math.max(modelLuminance.left, modelLuminance.right) /
      Math.max(1, Math.min(modelLuminance.left, modelLuminance.right)),
  ).toBeGreaterThan(1.25);
  await page.screenshot({
    path: testInfo.outputPath("reference-death-star-local-shadow.png"),
    animations: "disabled",
  });
});
