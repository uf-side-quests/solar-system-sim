import { expect, test } from "@playwright/test";

test("renders the live superposed Newtonian potential as contours and a 3D well", async ({
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
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Pause" }).click();
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(scene).toHaveAttribute("data-gravity-well-mode", "off");
  await expect(scene).toHaveAttribute("data-gravity-well-visible", "false");
  const withoutGravity = await canvas.screenshot();

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await page
    .getByRole("combobox", { name: "Orientation" })
    .selectOption("overhead");
  await page.getByRole("tab", { name: "Guides" }).click();
  const gravityField = page.getByRole("combobox", { name: "Gravity field" });
  const gravityScale = page.getByRole("combobox", { name: "Gravity scale" });
  await gravityField.selectOption("contours");
  await expect(scene).toHaveAttribute("data-gravity-well-mode", "contours");
  await expect(scene).toHaveAttribute("data-gravity-well-visible", "true");
  await expect(scene).toHaveAttribute("data-gravity-well-scale", "local");
  await expect(scene).toHaveAttribute(
    "data-gravity-potential-equation",
    "negative-sum-gm-over-r",
  );
  await expect(scene).toHaveAttribute(
    "data-gravity-potential-interior",
    "mean-radius-surface-cap",
  );
  await expect(scene).toHaveAttribute(
    "data-gravity-potential-display",
    "log2-only",
  );
  await expect(scene).toHaveAttribute(
    "data-gravity-potential-source-count",
    "31",
  );
  const minimumMagnitude = Number(
    await scene.getAttribute("data-gravity-potential-minimum-j-per-kg"),
  );
  const maximumMagnitude = Number(
    await scene.getAttribute("data-gravity-potential-maximum-j-per-kg"),
  );
  expect(minimumMagnitude).toBeGreaterThan(0);
  expect(maximumMagnitude).toBeGreaterThan(minimumMagnitude);
  await expect(
    page.getByText("Newtonian potential", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/J\/kg$/u)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  const withContours = await canvas.screenshot();
  expect(withContours.equals(withoutGravity)).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("newtonian-potential-contours.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Display" }).click();
  await gravityScale.selectOption("absolute");
  await expect(scene).toHaveAttribute("data-gravity-well-scale", "absolute");
  await page.getByRole("tab", { name: "Camera" }).click();
  await page
    .getByRole("combobox", { name: "Orientation" })
    .selectOption("perspective");
  await page.getByRole("tab", { name: "Guides" }).click();
  await gravityField.selectOption("surface");
  await expect(scene).toHaveAttribute("data-gravity-well-mode", "surface");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-gravity-well-depth-au")),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close" }).click();
  const withSurface = await canvas.screenshot();
  expect(withSurface.equals(withContours)).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("newtonian-potential-surface.png"),
    fullPage: true,
  });

  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Earth");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-gravity-well-extent-au")),
    )
    .toBeLessThan(0.1);
  await page.screenshot({
    path: testInfo.outputPath("earth-newtonian-potential-surface.png"),
    fullPage: true,
  });
  const gravityTimeBefore = await scene.getAttribute(
    "data-gravity-field-time-seconds",
  );
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect
    .poll(async () => scene.getAttribute("data-gravity-field-time-seconds"))
    .not.toBe(gravityTimeBefore);
  await expect
    .poll(async () => {
      const fieldTime = Number(
        await scene.getAttribute("data-gravity-field-time-seconds"),
      );
      const renderedTime = Number(
        await scene.getAttribute("data-rendered-time-seconds"),
      );
      return Math.abs(fieldTime - renderedTime);
    })
    .toBeLessThanOrEqual(0.01);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
