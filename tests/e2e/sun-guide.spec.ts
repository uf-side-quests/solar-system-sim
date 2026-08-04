import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

test("keeps the Sun labelled with a live focus distance and bearing line", async ({
  page,
}, testInfo) => {
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

  await selectFocus(focus, "Earth");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
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
  await labels.uncheck();
  await expect(sunLabel).toBeVisible();

  await selectFocus(focus, "Jupiter");
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
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

  await sunLabel.click();
  await expect(scene).toHaveAttribute("data-focus-body", "sun");
  await expect(scene).toHaveAttribute("data-sun-guide-line-visible", "false");
  await expect(sunLabel).toHaveText("Sun");
  await page.screenshot({
    path: testInfo.outputPath("sun-distance-guide.png"),
    animations: "disabled",
  });
});
