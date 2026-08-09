import { expect, test } from "@playwright/test";

async function selectFocus(
  focus: import("@playwright/test").Locator,
  label: string,
): Promise<void> {
  await focus.fill(label);
  await focus.press("Enter");
}

test("renders Discovery One and presents every cinematic shot", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );

  await selectFocus(
    page.getByRole("combobox", { name: "Focus" }),
    "Discovery One",
  );
  await expect(scene).toHaveAttribute("data-focus-body", "discovery-one");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 25_000 },
  );
  await expect(scene).toHaveAttribute(
    "data-discovery-one-visual-model",
    "original-procedural-model-from-open-museum-photography-v1",
  );
  await expect(scene).toHaveAttribute(
    "data-discovery-one-exterior-materials",
    "opaque-two-sided-depth-writing",
  );
  await expect(scene).toHaveAttribute(
    "data-discovery-one-geometry-visible",
    "true",
  );
  await expect(page.getByText("140.1 m long", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  await page
    .getByRole("combobox", { name: "Zoom preset" })
    .selectOption("close");
  await page.getByRole("button", { name: "Close" }).click();
  await page.screenshot({
    path: testInfo.outputPath("discovery-one-focus.png"),
    animations: "disabled",
  });

  const shots = [
    ["Earth in daylight", "earth"],
    ["Saturn and its rings", "saturn"],
    ["Jupiter in daylight", "jupiter"],
    ["Moon in sunlight", "moon"],
    ["Voyager beyond the planets", "voyager-1"],
    ["Sun from Mercury", "mercury"],
  ] as const;
  for (const [shotName, expectedFocus] of shots) {
    await page.getByRole("button", { name: "Display" }).click();
    await page.getByRole("tab", { name: "Camera" }).click();
    const shotButton = page.getByRole("button", {
      name: shotName,
      exact: true,
    });
    await expect(shotButton).toBeVisible();
    await shotButton.click();
    await expect(scene).toHaveAttribute("data-focus-body", expectedFocus, {
      timeout: 15_000,
    });
    await expect(scene).toHaveAttribute("data-view-mode", "reality");
    await expect(scene).toHaveAttribute(
      "data-camera-transition-phase",
      "settled",
      { timeout: 25_000 },
    );
    await expect(page.getByText(/Physics engine failed/u)).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(
        `${shotName.toLowerCase().replaceAll(" ", "-")}.png`,
      ),
      animations: "disabled",
    });
  }
});
