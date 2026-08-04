import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

test("selected body stats identify their source and velocity reference", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const focus = page.getByRole("combobox", { name: "Focus" });

  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );

  await selectFocus(focus, "Earth");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect(page.getByText("Mass", { exact: true })).toBeVisible();
  await expect(page.getByText("5.9722 × 10²⁴ kg")).toBeVisible();
  await expect(
    page.getByText("Speed relative to Sun", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Composition", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Iron-nickel core, silicate mantle and crust, with surface water",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Source" })).toHaveAttribute(
    "href",
    "https://science.nasa.gov/earth/facts/",
  );

  await selectFocus(focus, "Moon");
  await expect(scene).toHaveAttribute("data-focus-body", "moon");
  await expect(
    page.getByText("Speed relative to Earth", { exact: true }),
  ).toBeVisible();

  await selectFocus(focus, "Amalthea (Jupiter)");
  await expect(page.getByText("Not provided by source")).toBeVisible();
  await expect(
    page.getByText("Not provided by the installed authority snapshot"),
  ).toBeVisible();
  await expect(
    page.getByText("Speed relative to Jupiter", { exact: true }),
  ).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("selected-body-stats.png"),
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await selectFocus(focus, "Earth");
  await expect(page.getByText("5.9722 × 10²⁴ kg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Display" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("selected-body-stats-mobile.png"),
    animations: "disabled",
  });
});
