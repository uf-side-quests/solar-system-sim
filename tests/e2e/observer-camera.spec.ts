import { expect, test } from "@playwright/test";

const OBSERVER_STEPS = [
  { id: "sun-from-mars", observerBodyId: "mars", targetBodyId: "sun" },
  { id: "jupiter-from-io", observerBodyId: "io", targetBodyId: "jupiter" },
  {
    id: "earth-from-jupiter",
    observerBodyId: "jupiter",
    targetBodyId: "earth",
  },
  {
    id: "saturn-from-titan",
    observerBodyId: "titan",
    targetBodyId: "saturn",
  },
] as const;

async function advanceToStep(
  tour: import("@playwright/test").Locator,
  nextButton: import("@playwright/test").Locator,
  stepId: string,
  diagnostics: Readonly<{
    pageErrors: string[];
    consoleErrors: string[];
    lifecycleEvents: string[];
  }>,
): Promise<void> {
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const currentStepId = await tour.getAttribute("data-tour-step");
    if (currentStepId === stepId) {
      return;
    }
    await nextButton.click();
    await tour.page().waitForTimeout(100);
    if ((await tour.count()) === 0) {
      throw new Error(
        `Tour disappeared after ${currentStepId ?? "unknown"}: ${JSON.stringify(diagnostics)}`,
      );
    }
    await expect(tour).not.toHaveAttribute(
      "data-tour-step",
      currentStepId ?? "",
    );
  }
  throw new Error(`Tour did not reach ${stepId}`);
}

test("anchors every observer scene at its origin while centring its look-at target", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const lifecycleEvents: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("crash", () => lifecycleEvents.push("page crashed"));
  page.on("close", () => lifecycleEvents.push("page closed"));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto("/");
    const scene = page.getByRole("img", {
      name: /Physics-driven Solar System/u,
    });
    await expect(page.locator("canvas.major-body-layer")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Scale tour" }).click();
    const tour = page.getByRole("dialog", {
      name: "Scale of the Solar System tour",
    });
    await page.getByRole("button", { name: "Pause tour" }).click();
    const nextButton = page.getByRole("button", { name: "Next" });

    for (const step of OBSERVER_STEPS) {
      await advanceToStep(tour, nextButton, step.id, {
        pageErrors,
        consoleErrors,
        lifecycleEvents,
      });
      await expect(scene).toHaveAttribute(
        "data-camera-observer-body",
        step.observerBodyId,
      );
      await expect(scene).toHaveAttribute(
        "data-camera-target-body",
        step.targetBodyId,
      );
      await expect(tour).toHaveAttribute(
        "data-tour-observer",
        step.observerBodyId,
      );
      await expect(tour).toHaveAttribute("data-tour-target", step.targetBodyId);
      await expect(scene).toHaveAttribute(
        "data-camera-transition-interpolation",
        "depart-coast-arrive",
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-duration-ms",
        "12000",
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-phase",
        "overview",
        { timeout: 6_000 },
      );
      const overviewAnchorPosition = {
        x: Number(
          await scene.getAttribute("data-camera-transition-anchor-screen-x"),
        ),
        y: Number(
          await scene.getAttribute("data-camera-transition-anchor-screen-y"),
        ),
      };
      const overviewSceneSize = await scene.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
      }));
      expect(overviewAnchorPosition.x).toBeCloseTo(
        overviewSceneSize.width / 2,
        3,
      );
      expect(overviewAnchorPosition.y).toBeCloseTo(
        overviewSceneSize.height / 2,
        3,
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-phase",
        "settled",
        { timeout: 16_000 },
      );
      await expect(scene).toHaveAttribute(
        "data-focus-body",
        step.observerBodyId,
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-overview-anchor",
        "moving-route",
      );
      await expect(scene).toHaveAttribute(
        "data-camera-transition-destination-anchor",
        step.observerBodyId,
      );
      await expect
        .poll(async () =>
          Number(await scene.getAttribute("data-camera-observer-altitude-km")),
        )
        .toBeGreaterThan(0);

      const targetPosition = {
        x: Number(await scene.getAttribute("data-camera-target-screen-x")),
        y: Number(await scene.getAttribute("data-camera-target-screen-y")),
      };
      const sceneSize = await scene.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
      }));
      expect(targetPosition.x).toBeCloseTo(sceneSize.width / 2, 3);
      expect(targetPosition.y).toBeCloseTo(sceneSize.height / 2, 3);
      if (step.targetBodyId === "earth") {
        await expect(
          page.getByRole("button", { name: "Focus Earth", exact: true }),
        ).toBeVisible();
      }
      await page
        .getByRole("button", { name: "Run forward", exact: true })
        .click();
      await page.waitForTimeout(500);
      const movingTargetPosition = {
        x: Number(await scene.getAttribute("data-camera-target-screen-x")),
        y: Number(await scene.getAttribute("data-camera-target-screen-y")),
      };
      expect(movingTargetPosition.x).toBeCloseTo(sceneSize.width / 2, 3);
      expect(movingTargetPosition.y).toBeCloseTo(sceneSize.height / 2, 3);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.screenshot({
        path: testInfo.outputPath(`${step.id}.png`),
        animations: "disabled",
      });
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(lifecycleEvents).toEqual([]);
  } finally {
    await testInfo.attach("browser-events", {
      body: JSON.stringify({ pageErrors, consoleErrors, lifecycleEvents }),
      contentType: "application/json",
    });
  }
});
