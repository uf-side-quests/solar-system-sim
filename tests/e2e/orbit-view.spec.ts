import { expect, test } from "@playwright/test";

async function selectFocus(
  focus: import("@playwright/test").Locator,
  label: string,
): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

test("orbits a focused object and yields to manual camera control", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );
  await selectFocus(page.getByRole("combobox", { name: "Focus" }), "Earth");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );

  const orbitButton = page.getByRole("button", {
    name: "Enter orbit",
    exact: true,
  });
  await orbitButton.click();
  await expect(scene).toHaveAttribute("data-orbit-view", "active");
  await expect(scene).toHaveAttribute("data-orbit-view-body", "earth");
  await expect(scene).toHaveAttribute(
    "data-camera-tracking",
    "physical-circular-orbit",
  );
  await expect(scene).toHaveAttribute("data-orbit-preset", "high-observation");
  await expect(scene).toHaveAttribute("data-orbit-speed-mps", /\d+/u);
  await expect(scene).toHaveAttribute("data-orbit-period-seconds", /\d+/u);
  await expect(page.getByRole("button", { name: "Leave orbit" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("earth-orbit-view.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  const flightMode = page.getByRole("combobox", { name: "Flight mode" });
  await flightMode.selectOption("synchronous");
  await expect(scene).toHaveAttribute("data-orbit-preset", "synchronous");
  await expect
    .poll(async () => Number(await scene.getAttribute("data-orbit-altitude-m")))
    .toBeGreaterThan(35_700_000);
  expect(
    Number(await scene.getAttribute("data-orbit-altitude-m")),
  ).toBeLessThan(35_900_000);
  await flightMode.selectOption("polar");
  await expect(scene).toHaveAttribute("data-orbit-preset", "polar");
  await flightMode.selectOption("powered-hover");
  await expect(scene).toHaveAttribute("data-camera-tracking", "powered-hover");
  await expect(page.getByText(/Station keeping/u)).toBeVisible();
  await flightMode.selectOption("low-circular");
  await page.getByRole("button", { name: "Close" }).click();

  const startingDirection = await scene.getAttribute("data-camera-direction");
  const startingDistance = Number(
    await scene.getAttribute("data-camera-distance-au"),
  );
  await expect
    .poll(async () => scene.getAttribute("data-camera-direction"))
    .not.toBe(startingDirection);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeCloseTo(startingDistance, 10);

  const canvas = page.locator("canvas.major-body-layer");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    throw new Error("Major-body canvas is unavailable for manual control");
  }
  const start = {
    x: bounds.x + bounds.width * 0.72,
    y: bounds.y + bounds.height * 0.42,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 35, { steps: 8 });
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-orbit-view-requested", "false");
  await expect(
    page.getByRole("button", { name: "Enter orbit", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Collapse selected body details",
    })
    .click();
  const detailPanel = page.locator(".selected-body-detail");
  await expect(detailPanel).toHaveClass(/is-collapsed/u);
  await expect(page.getByText("Mass", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "Expand selected body details",
    }),
  ).toBeVisible();
  const collapsedBounds = await detailPanel.boundingBox();
  expect(collapsedBounds?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
  await page.screenshot({
    path: testInfo.outputPath("collapsed-selected-body-panel.png"),
    animations: "disabled",
  });

  await page
    .getByRole("button", {
      name: "Expand selected body details",
    })
    .click();
  await expect(page.getByText("Mass", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "View" }).click();
  await expect(
    page.getByText(/Asteroids and comets are GPU catalogue points/u),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Asteroids" }),
  ).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Comets" })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("orbit-view-and-compact-panel.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Orrery" }).click();
  await expect(page.getByRole("checkbox", { name: "Asteroids" })).toBeEnabled();
  await expect(page.getByRole("checkbox", { name: "Comets" })).toBeEnabled();
});
