import { expect, test } from "@playwright/test";

test("observes the live sky from physical surface coordinates", async ({
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
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Display" }).click();

  const observerBody = page.getByRole("combobox", {
    name: "Observer body",
  });
  const observerTarget = page
    .locator(".surface-observer-controls")
    .getByRole("combobox", { name: "Look at" });
  await observerBody.selectOption("earth");
  await observerTarget.selectOption("moon");
  await page.getByRole("spinbutton", { name: "Latitude" }).fill("51.4779");
  await page.getByRole("spinbutton", { name: "Longitude °E" }).fill("0");
  await page.getByRole("button", { name: "Enter surface view" }).click();

  const hud = page.getByRole("complementary", {
    name: "Surface observer measurements",
  });
  await expect(hud).toBeVisible();
  await expect(hud).toHaveAttribute("data-surface-observer-body", "earth");
  await expect(hud).toHaveAttribute("data-surface-observer-target", "moon");
  await expect(scene).toHaveAttribute("data-view-mode", "reality");
  await expect(scene).toHaveAttribute(
    "data-camera-tracking",
    "surface-observer",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-orientation",
    "local-horizontal",
  );
  await expect(scene).toHaveAttribute("data-surface-observer-body", "earth");
  await expect(scene).toHaveAttribute("data-surface-observer-target", "moon");
  await expect(scene).toHaveAttribute(
    "data-surface-horizon-model",
    "mean-radius-geometric-no-refraction",
  );
  await expect(scene).toHaveAttribute("data-surface-horizon-visible", "true");
  await expect(hud).toContainText("Apparent diameter");
  await expect(hud).toContainText("Illuminated disc");
  await expect(hud).toContainText("Local solar time");
  await expect(hud).toContainText("Sunrise and sunset");
  await expect(page.getByLabel("Local compass")).toContainText("N");
  await expect(hud).toContainText("Geometric horizon");
  await expect(hud).toContainText("no terrain, atmosphere or refraction");

  const sceneSize = await scene.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-target-screen-x")),
    )
    .toBeCloseTo(sceneSize.width / 2, 3);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-target-screen-y")),
    )
    .toBeCloseTo(sceneSize.height / 2, 3);

  const observerPositionBeforeLook = await scene.getAttribute(
    "data-surface-observer-position",
  );
  const targetXBeforeLook = Number(
    await scene.getAttribute("data-camera-target-screen-x"),
  );
  const canvas = page.locator("canvas.major-body-layer");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox === null) throw new Error("Scene canvas has no bounding box");
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2 + 180,
    canvasBox.y + canvasBox.height / 2 - 70,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-surface-free-look", "true");
  await expect(scene).toHaveAttribute(
    "data-surface-observer-position",
    observerPositionBeforeLook ?? "",
  );
  await expect
    .poll(async () =>
      Math.abs(
        Number(await scene.getAttribute("data-camera-target-screen-x")) -
          targetXBeforeLook,
      ),
    )
    .toBeGreaterThan(80);
  await hud.getByRole("button", { name: "Centre target" }).click();
  await expect(scene).toHaveAttribute("data-surface-free-look", "false");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-target-screen-x")),
    )
    .toBeCloseTo(sceneSize.width / 2, 3);

  const localSolarTimeBefore = await scene.getAttribute(
    "data-surface-local-solar-time-hours",
  );
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect
    .poll(() => scene.getAttribute("data-surface-local-solar-time-hours"))
    .not.toBe(localSolarTimeBefore);

  await page.getByRole("button", { name: "Display" }).click();
  await observerBody.selectOption("moon");
  await observerTarget.selectOption("earth");
  await expect(scene).toHaveAttribute("data-surface-observer-body", "moon");
  await expect(scene).toHaveAttribute("data-surface-observer-target", "earth");
  await expect(
    page.getByRole("button", { name: "Focus Earth", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.screenshot({
    path: testInfo.outputPath("surface-observer-earth-from-moon.png"),
    animations: "disabled",
  });

  await hud.getByRole("button", { name: "Exit" }).click();
  await expect(hud).toBeHidden();
  await expect(scene).not.toHaveAttribute("data-surface-observer-body", /.+/u);
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeEnabled();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
