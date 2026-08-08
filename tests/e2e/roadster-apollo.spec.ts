import { expect, test } from "@playwright/test";

test("shows the JPL Roadster and all six Moon-fixed Apollo landing sites", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-rendered-time-seconds", /-?\d+/u);

  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Tesla Roadster and Starman");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "roadster");
  await expect(scene).toHaveAttribute("data-roadster-model-loaded", "true");
  await expect(scene).toHaveAttribute(
    "data-roadster-model-provenance",
    "original-physical-scale-reconstruction",
  );
  await expect(scene).toHaveAttribute("data-roadster-geometry-visible", "true");
  const detail = page.getByRole("complementary");
  await expect(detail).toContainText("Tesla Roadster and Starman");
  await expect(detail).toContainText("Horizons solution 11");
  await expect(detail).toContainText("374 optical observations");
  await page.screenshot({
    path: testInfo.outputPath("roadster-starman.png"),
    animations: "disabled",
  });

  await focus.fill("Moon");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "moon");
  await expect(scene).toHaveAttribute("data-apollo-site-count", "6");
  await expect(scene).toHaveAttribute(
    "data-apollo-site-coordinates",
    "LRO-derived-ME-planetocentric",
  );
  await expect
    .poll(() => scene.getAttribute("data-apollo-site-labels-visible"))
    .not.toBe("0");

  const apollo11 = page.getByRole("button", {
    name: "Select Apollo 11 landing site at Tranquility Base",
  });
  await expect(apollo11).toBeVisible();
  await apollo11.click();
  await expect(detail).toContainText("Apollo 11 · Tranquility Base");
  await expect(detail).toContainText("Neil Armstrong and Buzz Aldrin");
  await expect(detail).toContainText("Michael Collins");
  await expect(
    detail.getByRole("link", { name: "LROC traverse map" }),
  ).toHaveAttribute("href", /SHAPEFILE_APOLLO_11/u);
  await page.screenshot({
    path: testInfo.outputPath("apollo-landing-sites.png"),
    animations: "disabled",
  });

  await detail.getByRole("button", { name: "Show on Moon" }).click();
  await expect(scene).toHaveAttribute(
    "data-apollo-inspection-site",
    "apollo-11-site",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-orientation",
    "apollo-site-inspection",
  );
  await page.waitForTimeout(500);
  await page.screenshot({
    path: testInfo.outputPath("apollo-11-equipment-inspection.png"),
    animations: "disabled",
  });

  await detail.getByRole("button", { name: "Stand at site" }).click();
  const observer = page.getByRole("complementary", {
    name: "Surface observer measurements",
  });
  await expect(observer).toHaveAttribute("data-surface-observer-body", "moon");
  await expect(observer).toHaveAttribute(
    "data-surface-observer-target",
    "earth",
  );
  await expect(scene).toHaveAttribute(
    "data-camera-tracking",
    "surface-observer",
  );
  await expect(scene).toHaveAttribute(
    "data-surface-observer-latitude-deg",
    "0.674160",
  );
  await expect(scene).toHaveAttribute(
    "data-surface-observer-longitude-deg",
    "23.473140",
  );
  await page.screenshot({
    path: testInfo.outputPath("apollo-11-surface-observer.png"),
    animations: "disabled",
  });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
