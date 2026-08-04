import { expect, test } from "@playwright/test";

test("switches between physical, orrery, and schematic views without changing physics state", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Pause" }).click();

  const timeOutput = page.locator(".time-readout output");
  const pausedTime = await timeOutput.getAttribute("data-time-seconds");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute("data-view-mode", "reality");
  await expect(scene).toHaveAttribute("data-tactical-overlay-visible", "false");
  const realityButton = page.getByRole("button", { name: "Reality" });
  await realityButton.focus();
  await expect(
    page.getByRole("tooltip", {
      name: /True physical sizes and positions/u,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Orrery" }).hover();
  await expect(
    page.getByRole("tooltip", {
      name: /Physical positions with enlarged bodies/u,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Map" }).hover();
  await expect(
    page.getByRole("tooltip", {
      name: /schematic navigation map/u,
    }),
  ).toBeVisible();
  const earth = page.locator('[data-body-id="earth"]');
  const moon = page.locator('[data-body-id="moon"]');
  const earthRadiusInReality = Number(
    await earth.getAttribute("data-displayed-radius-au"),
  );
  expect(earthRadiusInReality).toBeCloseTo(6_371_008.4 / 149_597_870_700, 12);
  await expect(earth).toHaveAttribute("data-body-rendered", "false");
  await expect(moon).toHaveAttribute("data-body-rendered", "false");
  await expect(scene).toHaveAttribute("data-known-moon-point-count", "0");
  await page.screenshot({
    path: testInfo.outputPath("physical-reality.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Display" }).click();
  const bodySizeBoost = page.getByRole("slider", { name: "Body size boost" });
  await expect(bodySizeBoost).toBeDisabled();
  await expect(
    page.locator("label", { hasText: "Body size boost" }).locator("output"),
  ).toHaveText("Physical");
  await expect(
    page.getByRole("checkbox", { name: "Asteroids" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Orrery" }).click();
  await expect(scene).toHaveAttribute("data-view-mode", "orrery");
  await expect
    .poll(async () =>
      Number(await earth.getAttribute("data-displayed-radius-au")),
    )
    .toBeGreaterThan(earthRadiusInReality);
  await expect(scene).toHaveAttribute("data-known-moon-point-count", "437");
  await expect(scene).toHaveAttribute("data-orbit-guide-count", "0");
  await page.getByRole("button", { name: "Display" }).click();
  const orbitGuides = page.getByRole("checkbox", { name: "Orbit guides" });
  await expect(orbitGuides).not.toBeChecked();
  await orbitGuides.check();
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-orbit-guide-count")),
    )
    .toBeGreaterThanOrEqual(8);
  await page.getByRole("button", { name: "Close" }).click();
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-orrery-marker-count")),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("orrery-view.png"),
    fullPage: true,
  });
  await expect(timeOutput).toHaveAttribute(
    "data-time-seconds",
    pausedTime ?? "0",
  );

  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Earth");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-tactical-overlay-visible", "false");
  await page.getByRole("button", { name: "Display" }).click();
  const tacticalOverlay = page.getByRole("checkbox", {
    name: "Tactical overlay",
  });
  await expect(tacticalOverlay).not.toBeChecked();
  await tacticalOverlay.check();
  await expect(scene).toHaveAttribute("data-tactical-overlay-visible", "true");
  const orientation = page.getByRole("combobox", { name: "Orientation" });
  await orientation.selectOption("velocity");
  await expect(scene).toHaveAttribute("data-camera-orientation", "velocity");
  await expect(scene).toHaveAttribute("data-camera-tracking", "continuous");
  await expect(scene).toHaveAttribute("data-semantic-zoom-level", "surface");
  await page
    .getByRole("combobox", { name: "Zoom preset" })
    .selectOption("detail");
  await expect(scene).toHaveAttribute("data-semantic-zoom-level", "surface");
  await page
    .getByRole("combobox", { name: "Zoom preset" })
    .selectOption("close");
  const cameraDirectionBefore = await scene.getAttribute(
    "data-camera-direction",
  );
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect
    .poll(async () => scene.getAttribute("data-camera-direction"))
    .not.toBe(cameraDirectionBefore);
  const trackedTime = await timeOutput.getAttribute("data-time-seconds");

  await page.getByText("Trails and frames", { exact: true }).click();
  const referenceFrame = page.getByRole("combobox", {
    name: "Reference frame",
  });
  await referenceFrame.selectOption("parent-relative");
  await expect(scene).toHaveAttribute(
    "data-reference-frame",
    "parent-relative",
  );
  await page.screenshot({
    path: testInfo.outputPath("tracked-earth.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Map" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  const map = page.getByRole("region", {
    name: /Schematic Solar System map/u,
  });
  await expect(map).toBeVisible();
  await page.getByRole("button", { name: "Mars", exact: true }).click();
  await expect(focus).toHaveValue("Mars");
  await expect(
    page.getByRole("button", { name: "Mars", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Earth", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(timeOutput).toHaveAttribute(
    "data-time-seconds",
    trackedTime ?? "0",
  );
  await page.screenshot({
    path: testInfo.outputPath("schematic-map.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await realityButton.focus();
  const mobileTooltip = page.locator("#view-mode-reality-tooltip");
  await expect(mobileTooltip).toBeVisible();
  const mobileTooltipBox = await mobileTooltip.boundingBox();
  expect(mobileTooltipBox).not.toBeNull();
  expect(mobileTooltipBox?.x).toBeGreaterThanOrEqual(0);
  expect(
    (mobileTooltipBox?.x ?? 0) + (mobileTooltipBox?.width ?? 0),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("view-mode-tooltip-mobile.png"),
    animations: "disabled",
  });
});
