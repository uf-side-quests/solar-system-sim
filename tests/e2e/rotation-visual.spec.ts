import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

function angularDifferenceDegrees(first: number, second: number): number {
  return Math.abs(((second - first + 540) % 360) - 180);
}

async function uncheckImmediately(checkbox: Locator): Promise<void> {
  await checkbox.evaluate((element: HTMLInputElement) => {
    if (element.checked) {
      element.click();
    }
  });
  await expect(checkbox).not.toBeChecked();
}

test("focused Earth visibly rotates with simulation time", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const sequenceBeforeEarth = await scene.getAttribute(
    "data-camera-transition-sequence",
  );
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Earth");
  await focus.press("Enter");
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByText("Trails and frames", { exact: true }).click();
  await uncheckImmediately(page.getByRole("checkbox", { name: "Moon trail" }));
  await uncheckImmediately(
    page.getByRole("checkbox", { name: "Planet trails" }),
  );
  await uncheckImmediately(page.getByRole("checkbox", { name: "Moons" }));
  await uncheckImmediately(
    page.getByRole("checkbox", { name: "Ecliptic grid" }),
  );
  await page.getByRole("slider", { name: "Playback rate" }).fill("2");

  const canvas = page.locator("canvas.major-body-layer");
  await expect(scene).toHaveAttribute("data-focus-body", "earth");
  await expect
    .poll(async () => scene.getAttribute("data-camera-transition-sequence"))
    .not.toBe(sequenceBeforeEarth);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 15_000,
    },
  );
  await expect(page.locator('[data-body-id="earth"]')).toHaveAttribute(
    "data-body-rendered",
    "true",
  );
  await expect(canvas).toBeVisible();
  const primeMeridianBefore = Number(
    await scene.getAttribute("data-focused-prime-meridian-deg"),
  );
  const pixelsBefore = await canvas.screenshot({ animations: "disabled" });

  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/earth-rotation-before.png`,
      fullPage: true,
    });
  }

  const timeOutput = page.locator(".time-readout output");
  const timeBefore = Number(await timeOutput.getAttribute("data-time-seconds"));
  for (let step = 1; step <= 3; step += 1) {
    await page.getByRole("button", { name: "Step forward" }).click();
    await expect
      .poll(async () =>
        Number(await timeOutput.getAttribute("data-time-seconds")),
      )
      .toBe(timeBefore + step * 3_600);
  }
  await expect
    .poll(
      async () =>
        angularDifferenceDegrees(
          primeMeridianBefore,
          Number(await scene.getAttribute("data-focused-prime-meridian-deg")),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(30);

  const pixelsAfter = await canvas.screenshot({ animations: "disabled" });
  if (process.env.SOLAR_VISUAL_CAPTURE_DIR !== undefined) {
    await page.screenshot({
      path: `${process.env.SOLAR_VISUAL_CAPTURE_DIR}/earth-rotation-after.png`,
      fullPage: true,
    });
  }
  expect(pixelsAfter).not.toEqual(pixelsBefore);
});
