import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const SURFACE_CASES = [
  ["Mercury", "mercury", "observational-composite"],
  ["Venus", "venus", "observational-composite"],
  ["Earth", "earth", "observational-composite"],
  ["Mars", "mars", "observational-composite"],
  ["Jupiter", "jupiter", "observational-composite"],
  ["Saturn", "saturn", "observational-composite"],
  ["Uranus", "uranus", "observation-constrained-atmosphere"],
  ["Neptune", "neptune", "visualization"],
  ["Pluto", "pluto", "observational-composite"],
  ["Moon", "moon", "observational-composite"],
  ["Ganymede", "ganymede", "observational-composite"],
  ["Enceladus", "enceladus", "observational-composite"],
  ["Oberon", "oberon", "observational-composite"],
  ["Charon", "charon", "observational-composite"],
] as const;

async function dollyToInspectSurface(
  page: Page,
  surfaceLabel: Locator,
): Promise<void> {
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
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

test("loads every planet surface and representative authority moon maps", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
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
    if (
      [
        "mercury",
        "earth",
        "jupiter",
        "saturn",
        "uranus",
        "pluto",
        "moon",
        "charon",
      ].includes(bodyId)
    ) {
      const capture = await canvas.screenshot({ animations: "disabled" });
      captures.set(bodyId, capture);
      await page.screenshot({
        path: testInfo.outputPath(`surface-${bodyId}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
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
