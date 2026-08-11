import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type SceneHarness = Readonly<{
  scene: Locator;
  assertNoBrowserErrors(): void;
}>;

async function openPausedScene(page: Page): Promise<SceneHarness> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    requestFailures.push(
      `${request.failure()?.errorText ?? "unknown request failure"}: ${request.url()}`,
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute("data-rendered-time-seconds", /-?\d+/u, {
    timeout: 30_000,
  });
  return {
    scene,
    assertNoBrowserErrors: () => {
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(requestFailures).toEqual([]);
    },
  };
}

test("declares all four physical ring systems and fictional-orbiter physics", async ({
  page,
}) => {
  const harness = await openPausedScene(page);
  const { scene } = harness;
  await expect(scene).toHaveAttribute("data-jupiter-ring-count", "5");
  await expect(scene).toHaveAttribute("data-uranus-ring-count", "13");
  await expect(scene).toHaveAttribute("data-neptune-ring-count", "5");
  await expect(scene).toHaveAttribute(
    "data-fictional-orbiter-physics",
    "hypothetical-massless-two-body-no-gravity-backreaction",
  );
  harness.assertNoBrowserErrors();
});

for (const [search, bodyId, ringModelAttribute] of [
  ["Jupiter", "jupiter", "data-jupiter-ring-model"],
  ["Neptune", "neptune", "data-neptune-ring-model"],
] as const) {
  test(`renders ${search}'s PDS ring system`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const harness = await openPausedScene(page);
    const { scene } = harness;
    await page.getByRole("button", { name: "Orrery" }).click();
    const focus = page.getByRole("combobox", { name: "Focus" });
    await focus.fill(search);
    await focus.press("Enter");
    await expect(scene).toHaveAttribute("data-focus-body", bodyId);
    await expect(scene).toHaveAttribute(
      ringModelAttribute,
      "pds-radii-widths-optical-depths",
    );
    for (let zoomStep = 0; zoomStep < 4; zoomStep += 1) {
      await page.getByRole("button", { name: "Zoom in" }).click();
    }
    await page.screenshot({
      path: testInfo.outputPath(`${bodyId}-rings.png`),
      animations: "disabled",
    });
    harness.assertNoBrowserErrors();
  });
}

for (const [search, bodyId, geometryAttribute] of [
  [
    "Death Star I (fictional)",
    "death-star-1",
    "data-deathstar1-geometry-visible",
  ],
  [
    "Death Star II (fictional)",
    "death-star-2",
    "data-deathstar2-geometry-visible",
  ],
] as const) {
  test(`renders ${search} at physical scale`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const harness = await openPausedScene(page);
    const { scene } = harness;
    const focus = page.getByRole("combobox", { name: "Focus" });
    await focus.fill(search);
    await focus.press("Enter");
    await expect(scene).toHaveAttribute("data-focus-body", bodyId);
    await expect(scene).toHaveAttribute(geometryAttribute, "true");
    await expect(scene).toHaveAttribute(
      `data-${bodyId.replaceAll("-", "")}-visual-model`,
      bodyId === "death-star-2"
        ? "cc-by-sketchfab-pbr-glb"
        : "original-integrated-pbr-hull-recessed-dish-and-dense-interior-v3",
    );
    if (bodyId === "death-star-2") {
      await expect(scene).toHaveAttribute(
        "data-deathstar2-model-loaded",
        "true",
        { timeout: 30_000 },
      );
    }
    await expect(page.getByRole("complementary")).toContainText(
      "Hypothetical live circular two-body orbit",
    );
    if (bodyId === "death-star-2") {
      await expect(scene).toHaveAttribute(
        "data-deathstar2-attitude",
        "camera-relative-fictional-presentation",
      );
    } else {
      await expect(scene).toHaveAttribute(
        "data-deathstar1-attitude",
        "camera-relative-fictional-presentation",
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`${bodyId}.png`),
      animations: "disabled",
    });
    const radiusAttribute = `data-${bodyId.replaceAll("-", "")}-radius-pixels`;
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    for (let zoomStep = 0; zoomStep < 3; zoomStep += 1) {
      const previousRadius = Number(await scene.getAttribute(radiusAttribute));
      await zoomIn.click();
      await expect
        .poll(() => scene.getAttribute(radiusAttribute).then(Number))
        .toBeGreaterThan(previousRadius);
      if (zoomStep === 1) {
        await expect
          .poll(() => scene.getAttribute(radiusAttribute).then(Number))
          .toBeGreaterThan(280);
        await page.screenshot({
          path: testInfo.outputPath(`${bodyId}-close-framed.png`),
          animations: "disabled",
        });
      }
    }
    await expect
      .poll(() => scene.getAttribute(radiusAttribute).then(Number))
      .toBeGreaterThan(280);
    await page.screenshot({
      path: testInfo.outputPath(`${bodyId}-close.png`),
      animations: "disabled",
    });
    harness.assertNoBrowserErrors();
  });
}

for (const [search, bodyId, distanceText] of [
  ["Deep Space Nine (fictional)", "deep-space-nine", "Distance from Callisto"],
  ["USS Defiant (fictional)", "uss-defiant", "Distance from Deep Space Nine"],
] as const) {
  test(`renders the licensed ${search} model at physical scale`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const harness = await openPausedScene(page);
    const { scene } = harness;
    const focus = page.getByRole("combobox", { name: "Focus" });
    await focus.fill(search);
    await focus.press("Enter");
    await expect(scene).toHaveAttribute("data-focus-body", bodyId);
    await expect(scene).toHaveAttribute(
      `data-${bodyId.replaceAll("-", "")}-model-loaded`,
      "true",
      { timeout: 30_000 },
    );
    await expect(scene).toHaveAttribute(
      `data-${bodyId.replaceAll("-", "")}-geometry-visible`,
      "true",
    );
    await expect(page.getByRole("complementary")).toContainText(distanceText);
    await expect(page.getByRole("complementary")).toContainText("Sketchfab");
    await page.screenshot({
      path: testInfo.outputPath(`${bodyId}.png`),
      animations: "disabled",
    });
    harness.assertNoBrowserErrors();
  });
}

test("installs physical Apollo artefacts and sourced LROC traverses", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  await expect(scene).toHaveAttribute("data-rendered-time-seconds", /-?\d+/u, {
    timeout: 30_000,
  });
  await expect(scene).toHaveAttribute(
    "data-apollo-surface-assets",
    "physical-lm-flags-alsep-retroreflectors-lrv",
  );
  await expect(scene).toHaveAttribute(
    "data-apollo-traverse-authority",
    "NASA-LROC-PDS",
  );
});
