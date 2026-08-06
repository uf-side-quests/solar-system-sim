import { expect, test } from "@playwright/test";

const TOUR_SCENES = [
  ["earth", "Earth is already enormous"],
  ["moon-gap", "Most of the picture is empty space"],
  ["sun-atmosphere", "The Sun is more than a yellow ball"],
  ["sun-from-mars", "The Sun seen from Mars"],
  ["jupiter", "Jupiter is a system of its own"],
  ["jupiter-from-io", "Jupiter fills Io's sky"],
  ["earth-from-jupiter", "Earth seen from Jupiter"],
  ["saturn", "Saturn's rings dwarf Earth"],
  ["saturn-from-titan", "Saturn seen from Titan"],
  ["neptune", "Neptune is thirty times farther out"],
  ["voyager-2", "Voyager 2 follows a different road"],
  ["voyager-1", "Voyager 1 is almost lost in the dark"],
  ["solar-system", "The heliosphere is not the edge of the Solar System"],
  [
    "oort-cloud",
    "The Oort Cloud may reach more than a third of the way to the next star",
  ],
  ["alpha-centauri", "Alpha Centauri is another scale entirely"],
] as const;

test("renders every authored tour scene without browser or simulation errors", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas.major-body-layer")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Scale tour" }).click();
  const tour = page.getByRole("dialog", {
    name: "Scale of the Solar System tour",
  });
  const scene = page.getByRole("img", {
    name: /Physics-driven Solar System/u,
  });

  for (const [index, [stepId, title]] of TOUR_SCENES.entries()) {
    await expect(tour).toHaveAttribute("data-tour-step", stepId);
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(".error")).toHaveCount(0);
    if (stepId === "solar-system") {
      await expect(scene).toHaveAttribute(
        "data-deep-space-layer",
        "same-three-scene",
      );
      await expect(scene).toHaveAttribute("data-heliosphere-visible", "true");
      await expect(scene).toHaveAttribute(
        "data-heliopause-voyager-1-au",
        "122",
      );
      await expect(scene).toHaveAttribute(
        "data-heliopause-voyager-2-au",
        "119",
      );
      await expect(page.getByText("Heliopause · about 120 AU")).toBeVisible();
      await expect(tour).toContainText("solar wind inflates");
    }
    if (stepId === "oort-cloud") {
      await expect(scene).toHaveAttribute("data-oort-cloud-visible", "true");
      await expect(scene).toHaveAttribute("data-oort-inner-min-au", "2000");
      await expect(scene).toHaveAttribute("data-oort-outer-max-au", "100000");
      await expect(
        page.getByText("Oort Cloud · estimated 2,000-100,000 AU"),
      ).toBeVisible();
      await expect(tour).toContainText("not mapped objects");
    }
    if (stepId === "alpha-centauri") {
      await expect(scene).toHaveAttribute(
        "data-alpha-centauri-visible",
        "true",
      );
      await expect(scene).toHaveAttribute("data-alpha-distance-au", "272000");
      await expect(scene).toHaveAttribute(
        "data-solar-system-share-percent",
        /0\.0808/u,
      );
      await expect(scene).toHaveAttribute(
        "data-oort-cloud-share-percent",
        /36\.764/u,
      );
      await expect(
        page.getByText("Alpha Centauri · 4.3 light-years"),
      ).toBeVisible();
    }
    await page.waitForTimeout(300);
    await page.screenshot({
      path: testInfo.outputPath(
        `${String(index + 1).padStart(2, "0")}-${stepId}.png`,
      ),
      fullPage: true,
    });
    if (index < TOUR_SCENES.length - 1) {
      await page.getByRole("button", { name: "Next" }).click();
    }
  }

  expect(errors).toEqual([]);
});
