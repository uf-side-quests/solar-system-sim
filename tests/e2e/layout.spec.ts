import { expect, test } from "@playwright/test";

test("shows direct view-angle actions before advanced camera settings", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  const clock = page.locator(".global-simulation-clock");
  await expect(clock).toHaveText(
    /\d{2} [A-Z][a-z]{2} \d{4} · \d{2}:\d{2}:\d{2} UTC/u,
  );
  await expect(clock).toBeInViewport();
  await page.getByRole("button", { name: "Display" }).click();
  await expect(clock).toBeVisible();
  await expect(clock).toBeInViewport();
  await page.getByRole("tab", { name: "Camera" }).click();

  const viewAngles = page.getByRole("group", { name: "View angle" });
  await expect(viewAngles).toBeVisible();
  await expect(viewAngles).toBeInViewport();
  await expect(viewAngles.getByRole("button")).toHaveCount(8);
  await expect(
    viewAngles.getByRole("button", { name: "Day and night" }),
  ).toBeVisible();
  await expect(
    viewAngles.getByRole("button", { name: "3D view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Observer body" }),
  ).toBeHidden();

  await page.screenshot({
    path: testInfo.outputPath("direct-view-angle-controls.png"),
    fullPage: true,
  });
});

test("keeps the compact controls usable at narrow widths", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Solar System Explorer" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Focus" })).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Playback rate" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reality" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Orrery" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  const cameraNavigation = page.getByRole("navigation", {
    name: "Camera navigation",
  });
  await expect(cameraNavigation).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scale tour" })).toBeVisible();
  // Do not tear the page down while its WebAssembly worker is still starting.
  // Chromium can otherwise leave the following test's worker startup stalled.
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });

  const horizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Display" }).click();
  await expect(
    page.getByRole("dialog", { name: "Display controls" }),
  ).toBeVisible();
  await expect(cameraNavigation).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Time controls" }),
  ).toBeHidden();
  await page.getByRole("tab", { name: "Camera" }).click();
  await expect(page.getByRole("group", { name: "View angle" })).toBeVisible();
  const controlsOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(controlsOverflow).toBeLessThanOrEqual(0);

  await page.screenshot({
    path: testInfo.outputPath("display-panel-mobile.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Display controls" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Display" })).toBeFocused();

  await page.screenshot({
    path: testInfo.outputPath("modern-controls-mobile.png"),
    fullPage: true,
  });

  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/solar-compact-mobile.png`,
      fullPage: true,
    });
  }
});
