import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const SURFACE_CASES = [
  ["Mercury", "mercury", "observational-composite"],
  ["Venus", "venus", "observational-composite"],
  ["Earth", "earth", "observational-composite"],
  ["Mars", "mars", "observational-composite"],
  ["Jupiter", "jupiter", "observational-composite"],
  ["Saturn", "saturn", "visualization"],
  ["Uranus", "uranus", "observation-constrained-atmosphere"],
  ["Neptune", "neptune", "visualization"],
  ["Moon", "moon", "observational-composite"],
  ["Phobos", "phobos", "observational-composite"],
  ["Deimos", "deimos", "observational-composite"],
  ["Io", "io", "observational-composite"],
  ["Europa", "europa", "observational-composite"],
  ["Ganymede", "ganymede", "observational-composite"],
  ["Callisto", "callisto", "observational-composite"],
  ["Mimas", "mimas", "observational-composite"],
  ["Enceladus", "enceladus", "observational-composite"],
  ["Tethys", "tethys", "observational-composite"],
  ["Dione", "dione", "observational-composite"],
  ["Rhea", "rhea", "observational-composite"],
  ["Titan", "titan", "visualization"],
  ["Iapetus", "iapetus", "observational-composite"],
  ["Ariel", "ariel", "observational-composite"],
  ["Umbriel", "umbriel", "observational-composite"],
  ["Titania", "titania", "observational-composite"],
  ["Oberon", "oberon", "observational-composite"],
  ["Miranda", "miranda", "observational-composite"],
  ["Triton", "triton", "observational-composite"],
  ["Pluto", "pluto", "observational-composite"],
  ["Charon", "charon", "observational-composite"],
] as const;

const SPACECRAFT_CASES = [
  [
    "International Space Station (Earth)",
    "iss",
    "data-iss-model-loaded",
    "data-iss-geometry-visible",
  ],
  [
    "Hubble Space Telescope",
    "hubble",
    "data-hubble-model-loaded",
    "data-hubble-geometry-visible",
  ],
  [
    "James Webb Space Telescope",
    "jwst",
    "data-jwst-model-loaded",
    "data-jwst-geometry-visible",
  ],
  [
    "Voyager 1 (interstellar space)",
    "voyager-1",
    "data-voyager1-model-loaded",
    "data-voyager1-geometry-visible",
  ],
  [
    "Voyager 2 (interstellar space)",
    "voyager-2",
    "data-voyager2-model-loaded",
    "data-voyager2-geometry-visible",
  ],
] as const;

async function dollyToInspectSurface(
  page: Page,
  surfaceLabel: Locator,
): Promise<void> {
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await expect
    .poll(
      async () => Number(await surfaceLabel.getAttribute("data-radius-pixels")),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const radiusPixels = Number(
      await surfaceLabel.getAttribute("data-radius-pixels"),
    );
    if (radiusPixels > 100) {
      return;
    }
    await zoomIn.click();
    await expect
      .poll(async () =>
        Number(await surfaceLabel.getAttribute("data-radius-pixels")),
      )
      .toBeGreaterThan(radiusPixels);
  }
  throw new Error("Camera could not dolly close enough to inspect the surface");
}

async function waitForExposure(scene: Locator): Promise<void> {
  await expect
    .poll(
      async () => {
        const current = Number(
          await scene.getAttribute("data-camera-exposure"),
        );
        const target = Number(
          await scene.getAttribute("data-camera-exposure-target"),
        );
        return Math.abs(current - target) / target;
      },
      { timeout: 20_000 },
    )
    .toBeLessThan(0.02);
}

test("captures every installed planet and moon surface presentation", async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  const focus = page.getByRole("combobox", { name: "Focus" });
  const selectedDetail = page.locator(".selected-body-detail");
  const canvas = page.locator("canvas.major-body-layer");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const captures = new Map<string, Buffer>();

  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );

  for (const [name, bodyId, classification] of SURFACE_CASES) {
    await focus.fill(name);
    await focus.press("Enter");
    await expect(focus).toHaveValue(name);
    await expect(scene).toHaveAttribute("data-focus-body", bodyId);
    await expect(selectedDetail).toContainText(classification);
    const surfaceLabel = page.locator(`.body-label[data-body-id="${bodyId}"]`);
    await dollyToInspectSurface(page, surfaceLabel);
    await expect(surfaceLabel).toHaveAttribute(
      "data-surface-asset-state",
      bodyId === "uranus" ? "material" : "loaded",
      { timeout: 60_000 },
    );
    await waitForExposure(scene);
    const capture = await canvas.screenshot({ animations: "disabled" });
    expect(capture.byteLength).toBeGreaterThan(5_000);
    captures.set(bodyId, capture);
    await canvas.screenshot({
      path: testInfo.outputPath(`surface-${bodyId}.png`),
      animations: "disabled",
    });
  }

  await expect(scene).toHaveAttribute("data-saturn-ring-asset-state", "loaded");
  await expect(scene).toHaveAttribute(
    "data-saturn-ring-profile",
    "Cassini PIA06175",
  );
  expect(
    Number(await scene.getAttribute("data-saturn-equatorial-to-polar-ratio")),
  ).toBeCloseTo(1.1086, 3);

  expect(
    new Set([...captures.values()].map((capture) => capture.toString("base64")))
      .size,
  ).toBe(captures.size);
});

test("captures every installed spacecraft model presentation", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  const focus = page.getByRole("combobox", { name: "Focus" });
  const canvas = page.locator("canvas.major-body-layer");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const captures = new Map<string, Buffer>();

  await expect(scene).toHaveAttribute(
    "data-rendered-time-seconds",
    /-?\d+(?:\.\d+)?/u,
    { timeout: 30_000 },
  );

  for (const [
    name,
    bodyId,
    loadedAttribute,
    visibleAttribute,
  ] of SPACECRAFT_CASES) {
    await focus.fill(name);
    await focus.press("Enter");
    await expect(scene).toHaveAttribute("data-focus-body", bodyId, {
      timeout: 30_000,
    });
    await expect(scene).toHaveAttribute(loadedAttribute, "true", {
      timeout: 30_000,
    });
    await expect(scene).toHaveAttribute(visibleAttribute, "true", {
      timeout: 30_000,
    });
    await waitForExposure(scene);
    const capture = await canvas.screenshot({ animations: "disabled" });
    expect(capture.byteLength).toBeGreaterThan(5_000);
    captures.set(bodyId, capture);
    await canvas.screenshot({
      path: testInfo.outputPath(`spacecraft-${bodyId}.png`),
      animations: "disabled",
    });
  }

  expect(
    new Set([...captures.values()].map((capture) => capture.toString("base64")))
      .size,
  ).toBe(captures.size);
});
