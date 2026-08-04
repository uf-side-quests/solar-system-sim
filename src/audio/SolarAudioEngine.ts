import type { AudioSettings } from "./audio-settings";

export type AudioEngineStatus =
  "awaiting-interaction" | "running" | "suspended" | "unavailable";

export type InterfaceSound = "button" | "option" | "slider";

const CHORDS_HZ = [
  [55, 82.41, 110, 164.81],
  [49, 73.42, 98, 146.83],
  [65.41, 98, 130.81, 196],
  [43.65, 65.41, 87.31, 130.81],
] as const;
const CHIME_NOTES_HZ = [220, 261.63, 293.66, 329.63, 392, 440] as const;
const MUSIC_FADE_SECONDS = 0.8;

type AudioNodes = Readonly<{
  musicGain: GainNode;
  effectsGain: GainNode;
  padFilter: BiquadFilterNode;
  delayInput: GainNode;
}>;

export class SolarAudioEngine {
  private context: AudioContext | undefined;
  private nodes: AudioNodes | undefined;
  private settings: AudioSettings;
  private chordIndex = 0;
  private chimeIndex = 0;
  private chordTimer: number | undefined;
  private chimeTimer: number | undefined;
  private padOscillators: OscillatorNode[] = [];
  private disposed = false;

  public constructor(
    settings: AudioSettings,
    private readonly onStatusChange: (status: AudioEngineStatus) => void,
  ) {
    this.settings = settings;
    this.onStatusChange(
      typeof AudioContext === "undefined"
        ? "unavailable"
        : "awaiting-interaction",
    );
  }

  public setSettings(settings: AudioSettings): void {
    this.settings = settings;
    this.applySettings();
  }

  public interact(sound: InterfaceSound): void {
    const playEffect = this.settings.effectsEnabled;
    void this.unlock().then((unlocked) => {
      if (unlocked && playEffect) {
        this.playInterfaceSound(sound);
      }
    });
  }

  public async setDocumentVisible(visible: boolean): Promise<void> {
    if (this.context === undefined || this.disposed) {
      return;
    }
    if (!visible) {
      await this.context.suspend();
      this.publishStatus();
      return;
    }
    if (this.settings.musicEnabled) {
      await this.context.resume();
      this.publishStatus();
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.chordTimer !== undefined) {
      window.clearInterval(this.chordTimer);
    }
    if (this.chimeTimer !== undefined) {
      window.clearInterval(this.chimeTimer);
    }
    for (const oscillator of this.padOscillators) {
      oscillator.stop();
    }
    this.padOscillators = [];
    if (this.context !== undefined) {
      void this.context.close();
    }
  }

  private async unlock(): Promise<boolean> {
    if (this.disposed || typeof AudioContext === "undefined") {
      return false;
    }
    if (this.context === undefined) {
      this.createGraph();
    }
    if (this.context === undefined) {
      return false;
    }
    try {
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      this.publishStatus();
      return this.context.state === "running";
    } catch {
      this.publishStatus();
      return false;
    }
  }

  private createGraph(): void {
    const context = new AudioContext({ latencyHint: "interactive" });
    this.context = context;

    const master = context.createGain();
    master.gain.value = 0.82;
    master.connect(context.destination);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.35;
    compressor.connect(master);

    const musicGain = context.createGain();
    const effectsGain = context.createGain();
    musicGain.connect(compressor);
    effectsGain.connect(compressor);

    const padFilter = context.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 1_050;
    padFilter.Q.value = 0.7;
    padFilter.connect(musicGain);

    const delayInput = context.createGain();
    const delay = context.createDelay(1.5);
    const feedback = context.createGain();
    const delayTone = context.createBiquadFilter();
    const wet = context.createGain();
    delay.delayTime.value = 0.47;
    feedback.gain.value = 0.28;
    delayTone.type = "lowpass";
    delayTone.frequency.value = 1_900;
    wet.gain.value = 0.24;
    delayInput.connect(delay);
    delay.connect(delayTone);
    delayTone.connect(feedback);
    feedback.connect(delay);
    delayTone.connect(wet);
    wet.connect(musicGain);

    this.nodes = { musicGain, effectsGain, padFilter, delayInput };
    this.createPadVoices();
    this.startCompositionTimers();
    this.applySettings();
    context.addEventListener("statechange", this.publishStatus);
  }

  private createPadVoices(): void {
    if (this.context === undefined || this.nodes === undefined) {
      return;
    }
    const context = this.context;
    const nodes = this.nodes;
    CHORDS_HZ[0].forEach((frequency, voiceIndex) => {
      const oscillator = context.createOscillator();
      const voiceGain = context.createGain();
      const panner = context.createStereoPanner();
      oscillator.type = voiceIndex === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = voiceIndex % 2 === 0 ? -4 : 4;
      voiceGain.gain.value = voiceIndex === 0 ? 0.035 : 0.026;
      panner.pan.value = -0.55 + voiceIndex * 0.36;
      oscillator.connect(voiceGain);
      voiceGain.connect(panner);
      panner.connect(nodes.padFilter);
      panner.connect(nodes.delayInput);
      oscillator.start();
      this.padOscillators.push(oscillator);
    });

    const filterLfo = context.createOscillator();
    const filterDepth = context.createGain();
    filterLfo.frequency.value = 0.025;
    filterDepth.gain.value = 280;
    filterLfo.connect(filterDepth);
    filterDepth.connect(nodes.padFilter.frequency);
    filterLfo.start();
    this.padOscillators.push(filterLfo);
  }

  private startCompositionTimers(): void {
    this.chordTimer = window.setInterval(() => this.advanceChord(), 14_000);
    this.chimeTimer = window.setInterval(() => this.playChime(), 8_500);
  }

  private advanceChord(): void {
    if (this.context === undefined) {
      return;
    }
    this.chordIndex = (this.chordIndex + 1) % CHORDS_HZ.length;
    const chord = CHORDS_HZ[this.chordIndex];
    const now = this.context.currentTime;
    this.padOscillators.slice(0, 4).forEach((oscillator, voiceIndex) => {
      const frequency = chord?.[voiceIndex];
      if (frequency !== undefined) {
        oscillator.frequency.setTargetAtTime(frequency, now, 3.2);
      }
    });
  }

  private playChime(): void {
    if (
      this.context === undefined ||
      this.nodes === undefined ||
      !this.settings.musicEnabled ||
      this.context.state !== "running"
    ) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const frequency = CHIME_NOTES_HZ[this.chimeIndex % CHIME_NOTES_HZ.length];
    this.chimeIndex += 1;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency ?? 220;
    panner.pan.value = ((this.chimeIndex % 5) - 2) * 0.24;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(this.nodes.musicGain);
    panner.connect(this.nodes.delayInput);
    oscillator.start(now);
    oscillator.stop(now + 4.6);
  }

  private playInterfaceSound(sound: InterfaceSound): void {
    if (
      this.context === undefined ||
      this.nodes === undefined ||
      this.context.state !== "running"
    ) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequencies: Readonly<
      Record<InterfaceSound, readonly [number, number]>
    > = {
      button: [520, 330],
      option: [440, 690],
      slider: [360, 470],
    };
    const [startFrequency, endFrequency] = frequencies[sound];
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      now + 0.045,
    );
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    oscillator.connect(gain);
    gain.connect(this.nodes.effectsGain);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  }

  private applySettings(): void {
    if (this.context === undefined || this.nodes === undefined) {
      return;
    }
    const now = this.context.currentTime;
    const musicLevel = this.settings.musicEnabled
      ? this.settings.musicVolume
      : 0.0001;
    const effectsLevel = this.settings.effectsEnabled
      ? this.settings.effectsVolume
      : 0.0001;
    this.nodes.musicGain.gain.cancelScheduledValues(now);
    this.nodes.musicGain.gain.setTargetAtTime(
      musicLevel,
      now,
      MUSIC_FADE_SECONDS / 3,
    );
    this.nodes.effectsGain.gain.cancelScheduledValues(now);
    this.nodes.effectsGain.gain.setTargetAtTime(effectsLevel, now, 0.03);
  }

  private readonly publishStatus = (): void => {
    if (this.context === undefined) {
      this.onStatusChange(
        typeof AudioContext === "undefined"
          ? "unavailable"
          : "awaiting-interaction",
      );
      return;
    }
    this.onStatusChange(
      this.context.state === "running" ? "running" : "suspended",
    );
  };
}
