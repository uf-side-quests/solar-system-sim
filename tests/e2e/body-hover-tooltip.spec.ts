import { expect, test } from "@playwright/test";

test("identifies a physically rendered background moon on hover", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Jupiter");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "Zoom out" }).click();
  }
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("checkbox", { name: "Labels" }).uncheck();
  await page.getByRole("button", { name: "Close" }).click();

  const moonNames = new Map([
    ["io", "Io"],
    ["europa", "Europa"],
    ["ganymede", "Ganymede"],
    ["callisto", "Callisto"],
  ]);
  await expect
    .poll(async () => {
      for (const bodyId of moonNames.keys()) {
        const label = page.locator(`.body-label[data-body-id="${bodyId}"]`);
        if (
          (await label.getAttribute("data-body-rendered")) === "true" &&
          (await label.getAttribute("data-in-camera-frustum")) === "true" &&
          (await label.isHidden())
        ) {
          return {
            bodyId,
            x: Number(await label.getAttribute("data-screen-x")),
            y: Number(await label.getAttribute("data-screen-y")),
          };
        }
      }
      return undefined;
    })
    .not.toBeUndefined();

  let backgroundMoon:
    Readonly<{ bodyId: string; x: number; y: number }> | undefined;
  for (const bodyId of moonNames.keys()) {
    const label = page.locator(`.body-label[data-body-id="${bodyId}"]`);
    if (
      (await label.getAttribute("data-body-rendered")) === "true" &&
      (await label.getAttribute("data-in-camera-frustum")) === "true" &&
      (await label.isHidden())
    ) {
      backgroundMoon = {
        bodyId,
        x: Number(await label.getAttribute("data-screen-x")),
        y: Number(await label.getAttribute("data-screen-y")),
      };
      break;
    }
  }
  if (backgroundMoon === undefined) {
    throw new Error("No physically rendered unlabeled Jovian moon is visible");
  }
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Scene canvas has no bounding box");
  await page.mouse.move(
    bounds.x + backgroundMoon.x,
    bounds.y + backgroundMoon.y,
  );
  const tooltip = page.locator(".body-hover-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveAttribute("data-body-id", backgroundMoon.bodyId);
  await expect(tooltip).toContainText(
    `${moonNames.get(backgroundMoon.bodyId) ?? backgroundMoon.bodyId} · moon of Jupiter`,
  );
  await expect(tooltip).toHaveAttribute("data-placement", "above-right");
  const tooltipBounds = await tooltip.boundingBox();
  if (tooltipBounds === null) throw new Error("Tooltip has no bounding box");
  const pointerX = bounds.x + backgroundMoon.x;
  const pointerY = bounds.y + backgroundMoon.y;
  expect(tooltipBounds.x).toBeGreaterThan(pointerX);
  expect(tooltipBounds.y + tooltipBounds.height).toBeLessThan(pointerY);
});

test("identifies a Hipparcos star after a one-second hover", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-star-tooltip-delay-ms", "1000");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(
      async () => await scene.getAttribute("data-bright-visible-star-hip-id"),
    )
    .not.toBeNull();

  const hipId = await scene.getAttribute("data-bright-visible-star-hip-id");
  const screenX = Number(
    await scene.getAttribute("data-bright-visible-star-screen-x"),
  );
  const screenY = Number(
    await scene.getAttribute("data-bright-visible-star-screen-y"),
  );
  if (
    hipId === null ||
    !Number.isFinite(screenX) ||
    !Number.isFinite(screenY)
  ) {
    throw new Error("Bright visible star hover diagnostic is unavailable");
  }
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Scene canvas has no bounding box");
  const tooltip = page.locator(".body-hover-tooltip");
  await page.mouse.move(bounds.x + screenX, bounds.y + screenY);
  await page.waitForTimeout(650);
  await expect(tooltip).toBeHidden();
  await expect(tooltip).toBeVisible({ timeout: 1_000 });
  await expect(tooltip).toHaveAttribute("data-star-hip-id", hipId);
  await expect(tooltip).toContainText(`HIP ${hipId}`);
  await expect(tooltip).toContainText(/V -?\d/u);
  await expect(tooltip).toContainText(/RA \d/u);
  await expect(tooltip).toContainText(/Dec -?\d/u);
  await page.screenshot({
    path: testInfo.outputPath("hipparcos-star-tooltip.png"),
    animations: "disabled",
  });
});

test("shows the twelve-sign zodiac as an optional sky reference", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("checkbox", { name: "Stars" }).uncheck();
  await page.getByRole("checkbox", { name: "Zodiac signs" }).check();
  await expect(scene).toHaveAttribute("data-zodiac-visible", "true");
  await expect(scene).toHaveAttribute("data-zodiac-sign-count", "12");
  await expect(scene).toHaveAttribute(
    "data-zodiac-reference",
    "tropical-twelve-equal-signs-on-j2000-ecliptic",
  );
  await expect(page.locator(".zodiac-label:not([hidden])")).not.toHaveCount(0);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-zodiac-visible-label-count")),
    )
    .toBeGreaterThanOrEqual(1);
  await expect(page.getByLabel("Twelve tropical zodiac signs")).toBeVisible();
  await expect(
    page.getByLabel("Twelve tropical zodiac signs").locator("span"),
  ).toHaveCount(12);
  await page.getByRole("button", { name: "Close" }).click();
  await page.screenshot({
    path: testInfo.outputPath("zodiac-sky.png"),
    animations: "disabled",
  });
});
