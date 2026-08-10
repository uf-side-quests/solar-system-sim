import { expect, test } from "@playwright/test";

test("reopens the focus picker with a concise catalogue and searches every known body", async ({
  page,
}) => {
  await page.goto("/");
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Earth");
  await focus.press("Enter");
  await expect(focus).toHaveValue("Earth");

  await page.getByRole("button", { name: "Open focus list" }).click();
  const focusPopover = page.locator(".focus-popover");
  await expect(
    focusPopover.getByText("Overview", { exact: true }),
  ).toBeVisible();
  await expect(
    focusPopover.getByText("Planets", { exact: true }),
  ).toBeVisible();
  await expect(
    focusPopover.getByText("Spacecraft", { exact: true }),
  ).toBeVisible();
  await expect(
    focusPopover.getByText("Saturn moons", { exact: true }),
  ).toBeHidden();
  expect(await focusPopover.getByRole("option").count()).toBeLessThan(60);

  await focus.fill("S2023_S63");
  await expect(
    focusPopover.getByRole("option", { name: "S2023_S63 (Saturn)" }),
  ).toBeVisible();
});

test("keeps the zoom control in sync with wheel and trackpad dolly", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const navigationMap = page.locator(".reality-navigation-map");
  await expect(navigationMap).toBeVisible();
  await expect(navigationMap).toHaveAttribute("data-scale-au", /\d/u);
  await expect(navigationMap).toHaveAttribute("data-observer-body", "camera");
  await expect(navigationMap).toHaveAttribute("data-view-bearing-deg", /\d/u);
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  const zoom = page.getByRole("slider", { name: "Camera zoom" });
  const before = await scene.getAttribute("data-view-magnification");
  await canvas.hover();
  await page.mouse.wheel(0, -900);
  await expect
    .poll(() => scene.getAttribute("data-view-magnification"))
    .not.toBe(before);
  await expect
    .poll(async () => {
      const controlZoom = 2 ** Number(await zoom.inputValue());
      const renderedZoom = Number(
        await scene.getAttribute("data-view-magnification"),
      );
      return Math.abs(controlZoom - renderedZoom);
    })
    .toBeLessThan(0.02);
});

test("searches grouped focus targets and renders official operational spacecraft at physical scale", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const focus = page.getByRole("combobox", { name: "Focus" });
  await expect(scene).toHaveAttribute("data-rendered-time-seconds", /-?\d+/u, {
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Open focus list" }).click();
  const focusPopover = page.locator(".focus-popover");
  await expect(
    focusPopover.getByText("Planets", { exact: true }),
  ).toBeVisible();
  await expect(
    focusPopover.getByText("Spacecraft", { exact: true }),
  ).toBeVisible();
  await focus.fill("telescope");
  await expect(
    focusPopover.getByRole("option", { name: "Hubble Space Telescope" }),
  ).toBeVisible();
  await expect(
    focusPopover.getByRole("option", {
      name: "James Webb Space Telescope",
    }),
  ).toBeVisible();

  await focus.fill("Hubble Space Telescope");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "hubble");
  await expect(scene).toHaveAttribute("data-hubble-model-loaded", "true", {
    timeout: 30_000,
  });
  await expect(scene).toHaveAttribute("data-hubble-geometry-visible", "true");
  await expect(scene).toHaveAttribute(
    "data-operational-spacecraft-physics",
    "NASA-JPL-Horizons-cubic-Hermite",
  );
  await expect(page.getByRole("complementary")).toContainText("11,110 kg");
  await expect(page.getByRole("complementary")).toContainText(
    "NASA/JPL Horizons trajectory",
  );

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  const zoom = page.getByRole("slider", { name: "Camera zoom" });
  await zoom.fill("-6");
  await expect(scene).toHaveAttribute("data-camera-zoom", "0.02");
  await zoom.fill("7");
  await expect(scene).toHaveAttribute("data-camera-zoom", "128.00");
  await page.getByRole("button", { name: "Close" }).click();

  await focus.fill("James Webb Space Telescope");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "jwst");
  await expect(scene).toHaveAttribute("data-jwst-model-loaded", "true", {
    timeout: 30_000,
  });
  await expect(scene).toHaveAttribute("data-jwst-geometry-visible", "true");
  await expect(page.getByRole("complementary")).toContainText("6,200 kg");

  const canvas = page.locator("canvas.major-body-layer");
  const spacecraftOn = await canvas.screenshot();
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "View" }).click();
  const spacecraftToggle = page.getByRole("checkbox", { name: "Spacecraft" });
  await spacecraftToggle.uncheck();
  await expect(scene).toHaveAttribute("data-jwst-geometry-visible", "false");
  const spacecraftOff = await canvas.screenshot();
  let changedBytes = Math.abs(spacecraftOn.length - spacecraftOff.length);
  for (
    let index = 0;
    index < Math.min(spacecraftOn.length, spacecraftOff.length);
    index += 1
  ) {
    if (spacecraftOn[index] !== spacecraftOff[index]) changedBytes += 1;
  }
  expect(changedBytes).toBeGreaterThan(500);
  await spacecraftToggle.check();
  await page.getByRole("button", { name: "Close" }).click();

  await page.screenshot({
    path: testInfo.outputPath("jwst-official-model.png"),
    animations: "disabled",
  });
  expect(pageErrors).toEqual([]);
});
