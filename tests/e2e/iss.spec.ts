import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

test("ISS uses physical dimensions and only resolves at close range", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
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

  await expect(scene).toHaveAttribute("data-iss-ephemeris-valid", "false");
  await expect(scene).toHaveAttribute("data-iss-geometry-visible", "false");

  await selectFocus(focus, "International Space Station (Earth)");
  await expect(scene).toHaveAttribute("data-focus-body", "iss");
  await expect(scene).toHaveAttribute("data-iss-ephemeris-valid", "true", {
    timeout: 15_000,
  });
  await expect(scene).toHaveAttribute("data-iss-model-scale", "physical");
  await expect(scene).toHaveAttribute("data-iss-maximum-dimension-m", "109");
  await expect(scene).toHaveAttribute("data-iss-geometry-visible", "true", {
    timeout: 15_000,
  });
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-iss-radius-pixels")),
    )
    .toBeGreaterThan(0.5);
  await expect(
    page.getByText("Official NASA 3D model · physical scale · SGP4 trajectory"),
  ).toBeVisible();
  await expect(scene).toHaveAttribute("data-iss-model-loaded", "true");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 35_000 },
  );
  await expect(
    page.getByText("Geocentric distance", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Altitude", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Speed relative to Earth", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("419,725 kg")).toBeVisible();
  await expect(page.getByText("Orbit data", { exact: true })).toBeVisible();
  await expect(page.getByText("109 × 73 m")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("iss-focused.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Parent" }).click();
  await expect(scene).toHaveAttribute("data-selected-body", "earth");
  await expect(scene).toHaveAttribute("data-focus-body", "iss");
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 35_000 },
  );
  await expect(scene).toHaveAttribute("data-iss-geometry-visible", "false");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-iss-radius-pixels")),
    )
    .toBeLessThan(0.5);

  await page.getByRole("button", { name: "Display" }).click();
  const spacecraft = page.getByRole("checkbox", { name: "Spacecraft" });
  await expect(spacecraft).toBeChecked();
  await spacecraft.uncheck();
  await expect(scene).toHaveAttribute("data-spacecraft-visible", "false");
  await expect(scene).toHaveAttribute("data-iss-geometry-visible", "false");
});
