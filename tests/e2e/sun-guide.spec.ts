import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

async function waitForCameraJourney(
  scene: Locator,
  previousSequence: string | null,
): Promise<void> {
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(previousSequence);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );
}

test("keeps the Sun labelled with a live focus distance and bearing line", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const focus = page.getByRole("combobox", { name: "Focus" });
  const sunLabel = page.getByRole("button", { name: "Focus Sun" });
  const sunLine = page.locator(".sun-guide-line");

  await expect(scene).toHaveAttribute("data-sun-guide-visible", "true", {
    timeout: 30_000,
  });
  await expect(sunLabel).toBeVisible();
  await expect(sunLabel).toHaveText("Sun");
  await expect(scene).toHaveAttribute("data-sun-guide-line-visible", "false");

  const sequenceBeforeEarth = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await selectFocus(focus, "Earth");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await waitForCameraJourney(scene, sequenceBeforeEarth);
  await expect(scene).toHaveAttribute("data-sun-guide-line-visible", "true");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-sun-guide-distance-au")),
    )
    .toBeGreaterThan(0.9);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-sun-guide-distance-au")),
    )
    .toBeLessThan(1.1);
  await expect(sunLabel).toContainText("Sun");
  await expect(sunLabel).toContainText("AU");
  await expect(sunLine).not.toHaveCSS("display", "none");
  const earthLabel = page.locator('.body-label[data-body-id="earth"]');
  await expect(earthLabel).toBeVisible();
  await expect(earthLabel).toHaveCSS("border-top-width", "0px");
  await expect(earthLabel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(earthLabel).toHaveCSS("font-weight", "700");
  await expect(earthLabel).toHaveCSS("color", "rgb(142, 216, 255)");
  await expect(sunLabel).toHaveCSS("border-top-width", "0px");
  await expect(sunLabel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const earthLine = await sunLine.evaluate((line) => ({
    x1: Number(line.getAttribute("x1")),
    y1: Number(line.getAttribute("y1")),
    x2: Number(line.getAttribute("x2")),
    y2: Number(line.getAttribute("y2")),
  }));
  expect(
    Math.hypot(earthLine.x2 - earthLine.x1, earthLine.y2 - earthLine.y1),
  ).toBeGreaterThan(20);
  await page.screenshot({
    path: testInfo.outputPath("earth-sun-guide.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Display" }).click();
  const labels = page.getByRole("checkbox", { name: "Labels" });
  const wayfinders = page.getByRole("combobox", { name: "Wayfinders" });
  await expect(wayfinders).toHaveValue("sun");
  await labels.uncheck();
  await expect(sunLabel).toBeVisible();
  await wayfinders.selectOption("off");
  await expect(scene).toHaveAttribute("data-wayfinder-count", "0");
  await expect(sunLabel).toBeHidden();
  await wayfinders.selectOption("sun-planet");
  await expect(scene).toHaveAttribute("data-wayfinder-count", "2");
  await expect(scene).toHaveAttribute("data-wayfinder-planet-count", "1");
  const nearestPlanetLabel = page.locator(
    '.planet-guide-label[data-wayfinder-rank="1"]',
  );
  await expect(nearestPlanetLabel).toBeVisible();
  await expect(nearestPlanetLabel).toContainText(/km|AU/u);
  await wayfinders.selectOption("sun-two-planets");
  await expect(scene).toHaveAttribute("data-wayfinder-count", "3");
  await expect(scene).toHaveAttribute("data-wayfinder-planet-count", "2");
  const secondPlanetLabel = page.locator(
    '.planet-guide-label[data-wayfinder-rank="2"]',
  );
  await expect(secondPlanetLabel).toBeVisible();
  const nearestDistanceAu = Number(
    await nearestPlanetLabel.getAttribute("data-distance-au"),
  );
  const secondDistanceAu = Number(
    await secondPlanetLabel.getAttribute("data-distance-au"),
  );
  expect(nearestDistanceAu).toBeLessThanOrEqual(secondDistanceAu);
  await page.screenshot({
    path: testInfo.outputPath("earth-three-wayfinders.png"),
    animations: "disabled",
  });
  await wayfinders.selectOption("sun");

  const sequenceBeforeJupiter = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await selectFocus(focus, "Jupiter");
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
  await waitForCameraJourney(scene, sequenceBeforeJupiter);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-sun-guide-distance-au")),
    )
    .toBeGreaterThan(3.9);
  await expect(sunLabel).toContainText("AU");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const bounds = await sunLabel.boundingBox();
      return bounds === null
        ? Number.POSITIVE_INFINITY
        : bounds.x + bounds.width;
    })
    .toBeLessThanOrEqual(390);
  const mobileLabelBounds = await sunLabel.boundingBox();
  expect(mobileLabelBounds).not.toBeNull();
  expect(mobileLabelBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(
    (mobileLabelBounds?.x ?? 391) + (mobileLabelBounds?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("jupiter-sun-guide-mobile.png"),
    animations: "disabled",
  });

  const sequenceBeforeSun = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  await sunLabel.click();
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
  await expect(scene).toHaveAttribute("data-selected-body", "sun");
  await sunLabel.dblclick();
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await waitForCameraJourney(scene, sequenceBeforeSun);
  await expect(scene).toHaveAttribute("data-sun-guide-line-visible", "false");
  await expect(sunLabel).toHaveText("Sun");
  await page.screenshot({
    path: testInfo.outputPath("sun-distance-guide.png"),
    animations: "disabled",
  });

  await wayfinders.selectOption("sun-two-planets");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(scene).toHaveAttribute("data-wayfinder-count", "3");
  await expect
    .poll(async () => {
      const targets = await scene.getAttribute("data-wayfinder-targets");
      return targets?.split(",").filter(Boolean).length ?? 0;
    })
    .toBe(3);
  const firstPlanetTarget = await scene.getAttribute("data-wayfinder-targets");
  const firstPlanetId = firstPlanetTarget?.split(",")[1];
  expect(firstPlanetId).toBeTruthy();
  const sequenceBeforePlanet = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  const firstPlanetLabel = page.locator(
    '.planet-guide-label[data-wayfinder-rank="1"]',
  );
  await firstPlanetLabel.click();
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await expect(scene).toHaveAttribute(
    "data-selected-body",
    firstPlanetId ?? "",
  );
  await firstPlanetLabel.dblclick();
  await expect(scene).toHaveAttribute("data-focus-body", firstPlanetId ?? "");
  await waitForCameraJourney(scene, sequenceBeforePlanet);
});
