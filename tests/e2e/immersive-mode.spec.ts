import { expect, test } from "@playwright/test";

test("enters native fullscreen, hides every control surface, and restores the UI", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  const app = page.locator("main.app-shell");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("button", { name: "Enter surface view" }).click();
  await expect(
    page.getByRole("complementary", {
      name: "Surface observer measurements",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(app).toHaveAttribute("data-immersive-mode", "true");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
    .toBe("MAIN");

  await expect(page.locator("header.command-bar")).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Camera navigation" }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Time controls" }),
  ).toBeHidden();
  await expect(
    page.getByRole("complementary", {
      name: "Surface observer measurements",
    }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Exit full screen" }),
  ).toBeVisible();
  await expect(scene).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("surface-observer-immersive.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(app).toHaveAttribute("data-immersive-mode", "false");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
  await expect(page.locator("header.command-bar")).toBeVisible();
  await expect(
    page.getByRole("complementary", {
      name: "Surface observer measurements",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Full screen" })).toBeFocused();

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(app).toHaveAttribute("data-immersive-mode", "true");
  await page.evaluate(() => document.exitFullscreen());
  await expect(app).toHaveAttribute("data-immersive-mode", "false");
  await expect(page.locator("header.command-bar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Full screen" })).toBeFocused();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
