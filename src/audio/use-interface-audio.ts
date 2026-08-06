import { useCallback, useEffect, useRef, useState } from "react";

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  type AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  parseAudioSettings,
} from "./audio-settings";
import {
  type AudioEngineStatus,
  type InterfaceSound,
  type NarrationStatus,
  SolarAudioEngine,
} from "./SolarAudioEngine";

type AudioSetting = keyof AudioSettings;

export function useInterfaceAudio(): Readonly<{
  settings: AudioSettings;
  status: AudioEngineStatus;
  narrationStatus: NarrationStatus;
  interact(sound: InterfaceSound): void;
  loadNarration(sourceUrl: string | undefined, autoplay: boolean): void;
  setNarrationPlaying(playing: boolean): void;
  clearNarration(): void;
  updateSetting<T extends AudioSetting>(
    setting: T,
    value: AudioSettings[T],
  ): void;
}> {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    try {
      return parseAudioSettings(
        window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  });
  const [status, setStatus] = useState<AudioEngineStatus>(
    "awaiting-interaction",
  );
  const [narrationStatus, setNarrationStatus] =
    useState<NarrationStatus>("idle");
  const engineRef = useRef<SolarAudioEngine | undefined>(undefined);

  useEffect(() => {
    const engine = new SolarAudioEngine(
      settings,
      setStatus,
      setNarrationStatus,
    );
    engineRef.current = engine;
    const handleVisibilityChange = (): void => {
      void engine.setDocumentVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      engineRef.current = undefined;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
    try {
      window.localStorage.setItem(
        AUDIO_SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );
    } catch {
      // Audio remains usable for the current session when storage is unavailable.
    }
  }, [settings]);

  const interact = useCallback((sound: InterfaceSound): void => {
    engineRef.current?.interact(sound);
  }, []);

  const loadNarration = useCallback(
    (sourceUrl: string | undefined, autoplay: boolean): void => {
      void engineRef.current?.loadNarration(sourceUrl, autoplay);
    },
    [],
  );

  const setNarrationPlaying = useCallback((playing: boolean): void => {
    engineRef.current?.setNarrationPlaying(playing);
  }, []);

  const clearNarration = useCallback((): void => {
    engineRef.current?.clearNarration();
  }, []);

  const updateSetting = useCallback(
    <T extends AudioSetting>(setting: T, value: AudioSettings[T]): void => {
      setSettings((current) => ({ ...current, [setting]: value }));
    },
    [],
  );

  return {
    settings,
    status,
    narrationStatus,
    interact,
    loadNarration,
    setNarrationPlaying,
    clearNarration,
    updateSetting,
  };
}
