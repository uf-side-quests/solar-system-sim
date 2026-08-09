import { expect, test } from "@playwright/test";

const sceneName = /Physics-driven Solar System/u;

async function focusObject(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill(name);
  await focus.press("Enter");
}

function requiredArrivalDistance(
  distances: readonly number[],
  index: number,
): number {
  const distance = distances[index];
  if (distance === undefined) {
    throw new Error(`Arrival distance sample ${String(index)} is missing`);
  }
  return distance;
}

test("turns toward a new manual focus before travelling there directly", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", { name: sceneName });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await focusObject(page, "Earth");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 15_000,
    },
  );
  await focusObject(page, "Jupiter");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-interpolation",
    "orient-then-logarithmic-approach",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "orienting",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-overview-anchor",
    "not-used-direct-flight",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "travelling",
    {
      timeout: 7_000,
    },
  );
  await expect(page.locator(".camera-journey")).toContainText(
    /Viewpoint speed .+(?:km\/s|light speed)/u,
  );
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-transition-speed-mps")),
    )
    .toBeGreaterThan(0);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-speed-definition",
    "camera-displacement-per-real-second",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "arriving",
    {
      timeout: 12_000,
    },
  );
  const arrivalDistances: number[] = [];
  for (let sample = 0; sample < 4; sample += 1) {
    arrivalDistances.push(
      Number(await scene.getAttribute("data-camera-distance-au")),
    );
    await page.locator("canvas.major-body-layer").screenshot({
      path: testInfo.outputPath(`jupiter-arrival-${String(sample + 1)}.png`),
      animations: "disabled",
    });
    await page.waitForTimeout(150);
  }
  expect(arrivalDistances.every(Number.isFinite)).toBe(true);
  expect(
    arrivalDistances.every(
      (distance, index) =>
        index === 0 ||
        distance <= requiredArrivalDistance(arrivalDistances, index - 1),
    ),
    `Arrival distances: ${arrivalDistances.join(", ")}`,
  ).toBe(true);
  const firstArrivalStep =
    requiredArrivalDistance(arrivalDistances, 0) -
    requiredArrivalDistance(arrivalDistances, 1);
  const finalArrivalStep =
    requiredArrivalDistance(arrivalDistances, 2) -
    requiredArrivalDistance(arrivalDistances, 3);
  expect(finalArrivalStep).toBeLessThan(firstArrivalStep);
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 15_000,
    },
  );
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
});

test("mouse wheel can dolly from the Solar System to Alpha Centauri scale", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.getByRole("img", { name: sceneName });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const bounds = await canvas.boundingBox();
  if (bounds === null) {
    throw new Error("Solar System canvas has no screen bounds");
  }
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  for (let step = 0; step < 4; step += 1) {
    await page.mouse.wheel(0, 5_000);
    await page.waitForTimeout(100);
  }
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-camera-distance-au")),
    )
    .toBeGreaterThan(40_000);
  await expect(scene).toHaveAttribute("data-alpha-centauri-visible", "true");
  await expect(scene).toHaveAttribute(
    "data-semantic-zoom-level",
    "interstellar",
  );
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("tab", { name: "Camera" }).click();
  const zoomOutput = page
    .getByText("Camera zoom", { exact: true })
    .locator("..")
    .locator("output");
  await expect(zoomOutput).toContainText("e");
});

test("renders and focuses the fictional Jovian monolith at true scale", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", { name: sceneName });
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await focusObject(page, "Jovian Monolith (fictional)");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "orienting",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    { timeout: 25_000 },
  );
  await expect(scene).toHaveAttribute("data-focus-body", "jovian-monolith");
  await expect(scene).toHaveAttribute(
    "data-jovian-monolith-physics",
    "display-only-jupiter-io-l1-no-gravity",
  );
  await expect(scene).toHaveAttribute(
    "data-jovian-monolith-dimensions-m",
    "222.222,888.889,2000.000",
  );
  await expect
    .poll(async () =>
      Number(
        await scene.getAttribute("data-jovian-monolith-distance-from-io-km"),
      ),
    )
    .toBeGreaterThan(10_000);
  await expect(scene).toHaveAttribute(
    "data-jovian-monolith-geometry-visible",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Focus Jovian Monolith (fictional)" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("jovian-monolith.png"),
    animations: "disabled",
  });
});
