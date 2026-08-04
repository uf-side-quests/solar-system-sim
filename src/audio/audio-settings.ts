export const AUDIO_SETTINGS_STORAGE_KEY =
  "solar-system-time-explorer.audio-settings.v1";

export type AudioSettings = Readonly<{
  musicEnabled: boolean;
  effectsEnabled: boolean;
  musicVolume: number;
  effectsVolume: number;
}>;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicEnabled: true,
  effectsEnabled: true,
  musicVolume: 0.22,
  effectsVolume: 0.45,
};

function normalizedVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

export function parseAudioSettings(serialized: string | null): AudioSettings {
  if (serialized === null) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_AUDIO_SETTINGS;
    }
    const candidate = parsed as Record<string, unknown>;
    return {
      musicEnabled:
        typeof candidate["musicEnabled"] === "boolean"
          ? candidate["musicEnabled"]
          : DEFAULT_AUDIO_SETTINGS.musicEnabled,
      effectsEnabled:
        typeof candidate["effectsEnabled"] === "boolean"
          ? candidate["effectsEnabled"]
          : DEFAULT_AUDIO_SETTINGS.effectsEnabled,
      musicVolume: normalizedVolume(
        candidate["musicVolume"],
        DEFAULT_AUDIO_SETTINGS.musicVolume,
      ),
      effectsVolume: normalizedVolume(
        candidate["effectsVolume"],
        DEFAULT_AUDIO_SETTINGS.effectsVolume,
      ),
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}
