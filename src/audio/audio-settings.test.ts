import { describe, expect, it } from "vitest";

import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings } from "./audio-settings";

describe("audio settings", () => {
  it("uses restrained audible defaults when no preferences exist", () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("restores valid persisted preferences", () => {
    expect(
      parseAudioSettings(
        JSON.stringify({
          musicEnabled: false,
          effectsEnabled: true,
          musicVolume: 0.35,
          effectsVolume: 0.6,
        }),
      ),
    ).toEqual({
      musicEnabled: false,
      effectsEnabled: true,
      musicVolume: 0.35,
      effectsVolume: 0.6,
    });
  });

  it("clamps persisted volume and repairs malformed fields", () => {
    expect(
      parseAudioSettings(
        JSON.stringify({
          musicEnabled: "yes",
          effectsEnabled: false,
          musicVolume: 4,
          effectsVolume: Number.NaN,
        }),
      ),
    ).toEqual({
      musicEnabled: true,
      effectsEnabled: false,
      musicVolume: 1,
      effectsVolume: DEFAULT_AUDIO_SETTINGS.effectsVolume,
    });
    expect(parseAudioSettings("not json")).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
