import { expect, test } from "@playwright/test";

test("renders both Voyager probes at physical scale from JPL-seeded REBOUND states", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const focus = page.getByRole("combobox", { name: "Focus" });
  await expect(scene).toHaveAttribute("data-voyager-count", "2", {
    timeout: 30_000,
  });
  await expect(scene).toHaveAttribute("data-voyager-model-scale", "physical");
  await expect(scene).toHaveAttribute(
    "data-voyager-physics",
    "REBOUND-massless-test-particle",
  );
  await expect(scene).toHaveAttribute("data-voyager-antenna-target", "earth");
  expect(
    Number(await scene.getAttribute("data-voyager1-antenna-earth-alignment")),
  ).toBeGreaterThan(0.999_999);
  expect(
    Number(await scene.getAttribute("data-voyager2-antenna-earth-alignment")),
  ).toBeGreaterThan(0.999_999);
  expect(
    Number(await scene.getAttribute("data-voyager1-distance-au")),
  ).toBeGreaterThan(160);
  expect(
    Number(await scene.getAttribute("data-voyager2-distance-au")),
  ).toBeGreaterThan(130);

  await focus.fill("Voyager 1 (interstellar space)");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "voyager-1");
  await expect(scene).toHaveAttribute("data-voyager1-geometry-visible", "true");
  await expect(
    page.getByRole("button", { name: "Focus Voyager 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Speed relative to the Sun", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("733 kg");
  await page.screenshot({
    path: testInfo.outputPath("voyager-1-focused.png"),
    animations: "disabled",
  });

  await focus.fill("Voyager 2 (interstellar space)");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "voyager-2");
  await expect(scene).toHaveAttribute("data-voyager2-geometry-visible", "true");
  await expect(page.getByRole("complementary")).toContainText("735 kg");

  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("checkbox", { name: "Spacecraft" }).uncheck();
  await expect(scene).toHaveAttribute(
    "data-voyager2-geometry-visible",
    "false",
  );
});
