import { expect, test } from "@playwright/test";

test("starts original ambient audio after interaction and persists controls", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const testWindow = window as unknown as Window & {
      audioOscillatorStarts: number;
    };
    testWindow.audioOscillatorStarts = 0;
    const originalStart: (this: OscillatorNode, when?: number) => void =
      Reflect.get(OscillatorNode.prototype, "start");
    OscillatorNode.prototype.start = function start(
      ...parameters: Parameters<OscillatorNode["start"]>
    ): void {
      testWindow.audioOscillatorStarts += 1;
      originalStart.apply(this, parameters);
    };
  });
  await page.goto("/");

  const app = page.locator(".app-shell");
  await expect(app).toHaveAttribute("data-audio-state", "awaiting-interaction");

  await page.getByRole("button", { name: "Display" }).click();
  await expect(app).toHaveAttribute("data-audio-state", "running");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveAttribute("data-audio-state", "suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveAttribute("data-audio-state", "running");

  const dialog = page.getByRole("dialog", { name: "Display controls" });
  const music = dialog.getByRole("checkbox", { name: "Ambient music" });
  const effects = dialog.getByRole("checkbox", { name: "Interface sounds" });
  const musicVolume = dialog.getByRole("slider", { name: "Music volume" });
  const effectsVolume = dialog.getByRole("slider", { name: "Sound volume" });

  await expect(music).toBeChecked();
  await expect(effects).toBeChecked();
  await expect(musicVolume).toHaveValue("22");
  await expect(effectsVolume).toHaveValue("45");
  await page.screenshot({
    path: testInfo.outputPath("audio-controls.png"),
    fullPage: true,
  });

  const oscillatorStarts = async (): Promise<number> =>
    page.evaluate(
      () =>
        (window as unknown as Window & { audioOscillatorStarts: number })
          .audioOscillatorStarts,
    );
  const beforeButton = await oscillatorStarts();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(oscillatorStarts).toBeGreaterThan(beforeButton);

  const beforeOption = await oscillatorStarts();
  await music.uncheck();
  await expect.poll(oscillatorStarts).toBeGreaterThan(beforeOption);
  await music.check();

  const beforeSlider = await oscillatorStarts();
  await musicVolume.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(oscillatorStarts).toBeGreaterThan(beforeSlider);

  await musicVolume.fill("31");
  await effectsVolume.fill("52");
  await music.uncheck();
  await effects.uncheck();
  await expect(musicVolume).toBeDisabled();
  await expect(effectsVolume).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "Display" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Ambient music" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Interface sounds" }),
  ).not.toBeChecked();
  await expect(page.getByRole("slider", { name: "Music volume" })).toHaveValue(
    "31",
  );
  await expect(page.getByRole("slider", { name: "Sound volume" })).toHaveValue(
    "52",
  );
});
