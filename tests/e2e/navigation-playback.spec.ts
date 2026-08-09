import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

const DAY_SECONDS = 86_400;

async function selectFocus(focus: Locator, label: string): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
  await expect(focus).toHaveValue(label);
}

test("selects on one click, focuses explicitly, and re-centres the view", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const venusLabel = page.getByRole("button", { name: "Focus Venus" });
  await expect(venusLabel).toBeVisible();
  const cameraDirectionBeforeSelection = await scene.getAttribute(
    "data-camera-direction",
  );
  await venusLabel.click();
  await expect(scene).toHaveAttribute("data-focus-body", "solar-system");
  await expect(scene).toHaveAttribute("data-selected-body", "venus");
  await expect(scene).toHaveAttribute(
    "data-camera-direction",
    cameraDirectionBeforeSelection ?? "",
  );
  await expect(venusLabel).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".selected-body-detail").getByText("Venus", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(scene).toHaveAttribute("data-focus-body", "venus");
  await expect(page.getByRole("combobox", { name: "Focus" })).toHaveValue(
    "Venus",
  );
  await expect(venusLabel).toHaveAttribute("aria-pressed", "true");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );

  const canvas = page.locator("canvas.major-body-layer");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds !== null) {
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down({ button: "right" });
    await page.mouse.move(
      bounds.x + bounds.width * 0.7,
      bounds.y + bounds.height * 0.62,
      {
        steps: 8,
      },
    );
    await page.mouse.up({ button: "right" });
  }
  await expect(scene).toHaveAttribute("data-camera-orientation", "custom");
  await page.getByRole("button", { name: "Re-centre", exact: true }).click();
  await expect(scene).toHaveAttribute("data-camera-orientation", "sun-facing");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );
});

test("navigates bodies, configures trails, and reports measured buffered playback", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Display" }).click();

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute("data-star-field-count", "8789", {
    timeout: 30_000,
  });
  await expect(scene).toHaveAttribute(
    "data-star-catalogue",
    "ESA Hipparcos I/239",
  );
  const stars = page.getByRole("checkbox", { name: "Stars" });
  const majorBodyCanvas = page.locator("canvas.major-body-layer");
  await expect(stars).toBeChecked();
  const starsOnFrame = await majorBodyCanvas.screenshot();
  await stars.uncheck();
  await expect(scene).toHaveAttribute("data-stars-visible", "false");
  const starsOffFrame = await majorBodyCanvas.screenshot();
  let changedFrameBytes = Math.abs(starsOnFrame.length - starsOffFrame.length);
  for (
    let index = 0;
    index < Math.min(starsOnFrame.length, starsOffFrame.length);
    index += 1
  ) {
    if (starsOnFrame[index] !== starsOffFrame[index]) {
      changedFrameBytes += 1;
    }
  }
  expect(changedFrameBytes).toBeGreaterThan(500);
  await stars.check();
  await expect(scene).toHaveAttribute("data-stars-visible", "true");
  await expect(scene).toHaveAttribute(
    "data-surface-lighting",
    "inverse-square-solar-point-light-auto-exposure",
  );
  await expect(scene).toHaveAttribute(
    "data-atmosphere-rendering",
    "sunlit-single-scattering-phase-functions",
  );

  const focus = page.getByRole("combobox", { name: "Focus" });
  await selectFocus(focus, "Earth");
  await page.getByRole("button", { name: "Next object" }).click();
  await expect(scene).toHaveAttribute("data-selected-body", "mars");
  await expect(focus).toHaveValue("Earth");
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Mars");
  await page.getByRole("button", { name: "Parent" }).click();
  await expect(scene).toHaveAttribute("data-selected-body", "sun");
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Sun");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(focus).toHaveValue("Mars");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(focus).toHaveValue("Earth");
  await selectFocus(focus, "Hubble Space Telescope");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("James Webb Space Telescope");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Jovian Monolith (fictional)");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Discovery One (fictional)");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Death Star I (fictional)");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Death Star II (fictional)");
  await page.getByRole("button", { name: "Next object" }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(focus).toHaveValue("Sun");
  await page.getByRole("button", { name: "Home" }).click();
  await expect(focus).toHaveValue("Solar System");

  await page.getByRole("tab", { name: "Guides" }).click();
  const trailLength = page.getByRole("combobox", { name: "Trail length" });
  const trailFade = page.getByRole("slider", { name: "Trail fade" });
  await trailLength.selectOption("7");
  await trailFade.fill("50");
  await expect(scene).toHaveAttribute(
    "data-trail-duration-seconds",
    String(7 * DAY_SECONDS),
  );
  await expect(scene).toHaveAttribute("data-trail-fade", "0.50");
  await page.getByRole("button", { name: "Clear trails" }).click();
  await expect(scene).toHaveAttribute("data-clear-trails-token", "1");
  await expect(scene).toHaveAttribute("data-moon-trail-points", "0");

  const playbackRate = page.getByRole("slider", { name: "Playback rate" });
  const timeOutput = page.locator(".time-readout output");
  await playbackRate.fill("5");
  await page.getByRole("button", { name: "Run forward" }).click();
  await expect(page.locator(".run-status")).toContainText(
    "30 days/s requested",
  );
  await expect(page.locator(".run-status")).toContainText("buffered", {
    timeout: 60_000,
  });
  await expect(scene).toHaveAttribute("data-motion-treatment", "high-speed");
  const startTime = Number(await timeOutput.getAttribute("data-time-seconds"));
  const startedAt = Date.now();
  await page.waitForTimeout(2_500);
  const endTime = Number(await timeOutput.getAttribute("data-time-seconds"));
  const elapsedSeconds = (Date.now() - startedAt) / 1_000;
  const achievedDaysPerSecond =
    (endTime - startTime) / DAY_SECONDS / elapsedSeconds;
  expect(achievedDaysPerSecond).toBeGreaterThan(10);
  await expect(page.locator(".run-status")).toContainText("achieved");
  await page.getByRole("button", { name: "Pause" }).click();
  await playbackRate.fill("6");
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect(page.locator(".model-validity")).toHaveAttribute(
    "data-outside-validated-window",
    "true",
    { timeout: 120_000 },
  );
  await expect(page.locator(".model-validity")).toContainText(
    "Outside ±1 year ephemeris validation",
  );
  await selectFocus(focus, "Jupiter");
  await expect(scene).toHaveAttribute("data-known-moon-point-count", "0");

  await page.screenshot({
    path: testInfo.outputPath("navigation-playback.png"),
    fullPage: true,
  });
});
