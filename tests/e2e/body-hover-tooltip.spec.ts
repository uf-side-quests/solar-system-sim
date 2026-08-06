import { expect, test } from "@playwright/test";

test("identifies a physically rendered background moon on hover", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });
  const canvas = page.locator("canvas.major-body-layer");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const focus = page.getByRole("combobox", { name: "Focus" });
  await focus.fill("Jupiter");
  await focus.press("Enter");
  await expect(scene).toHaveAttribute("data-focus-body", "jupiter");
  await expect(scene).toHaveAttribute(
    "data-camera-transition-phase",
    "settled",
    {
      timeout: 20_000,
    },
  );
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "Zoom out" }).click();
  }
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("checkbox", { name: "Labels" }).uncheck();
  await page.getByRole("button", { name: "Close" }).click();

  const moonNames = new Map([
    ["io", "Io"],
    ["europa", "Europa"],
    ["ganymede", "Ganymede"],
    ["callisto", "Callisto"],
  ]);
  await expect
    .poll(async () => {
      for (const bodyId of moonNames.keys()) {
        const label = page.locator(`.body-label[data-body-id="${bodyId}"]`);
        if (
          (await label.getAttribute("data-body-rendered")) === "true" &&
          (await label.getAttribute("data-in-camera-frustum")) === "true" &&
          (await label.isHidden())
        ) {
          return {
            bodyId,
            x: Number(await label.getAttribute("data-screen-x")),
            y: Number(await label.getAttribute("data-screen-y")),
          };
        }
      }
      return undefined;
    })
    .not.toBeUndefined();

  let backgroundMoon:
    Readonly<{ bodyId: string; x: number; y: number }> | undefined;
  for (const bodyId of moonNames.keys()) {
    const label = page.locator(`.body-label[data-body-id="${bodyId}"]`);
    if (
      (await label.getAttribute("data-body-rendered")) === "true" &&
      (await label.getAttribute("data-in-camera-frustum")) === "true" &&
      (await label.isHidden())
    ) {
      backgroundMoon = {
        bodyId,
        x: Number(await label.getAttribute("data-screen-x")),
        y: Number(await label.getAttribute("data-screen-y")),
      };
      break;
    }
  }
  if (backgroundMoon === undefined) {
    throw new Error("No physically rendered unlabeled Jovian moon is visible");
  }
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Scene canvas has no bounding box");
  await page.mouse.move(
    bounds.x + backgroundMoon.x,
    bounds.y + backgroundMoon.y,
  );
  const tooltip = page.locator(".body-hover-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveAttribute("data-body-id", backgroundMoon.bodyId);
  await expect(tooltip).toContainText(
    `${moonNames.get(backgroundMoon.bodyId) ?? backgroundMoon.bodyId} · moon of Jupiter`,
  );
});
