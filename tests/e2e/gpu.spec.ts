import { expect, test } from "@playwright/test";

test("validates and presents the complete small-body catalogue directly on WebGPU", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Orrery" }).click();
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("checkbox", { name: "Comets" }).check();

  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.small-body-layer");
  await expect(scene).toHaveAttribute("data-gpu-authority-positions", "2", {
    timeout: 120_000,
  });
  await expect(scene).toHaveAttribute("data-gpu-presentation", "direct-webgpu");
  await expect(canvas).toHaveAttribute("data-presentation", "direct-webgpu");
  const submittedObjects =
    Number(await canvas.getAttribute("data-submitted-asteroids")) +
    Number(await canvas.getAttribute("data-submitted-comets"));
  expect(submittedObjects).toBeGreaterThan(0);
  expect(submittedObjects).toBeLessThan(1_556_349);
  await expect(
    page.getByText("1,556,349 propagated · 1,791 unavailable"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
