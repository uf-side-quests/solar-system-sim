import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";

import { useInterfaceAudio } from "./audio/use-interface-audio";
import { createPhysicsClient } from "./physics/client";
import type { BodyState, SimulationState } from "./physics/contracts";
import { withKnownSatellites } from "./physics/known-satellite-ephemeris";
import {
  ISS_BODY_ID,
  ISS_EPOCH_SIMULATION_SECONDS,
  ISS_PARENT_BODY_ID,
  isIssEphemerisWithinValidity,
  issSnapshot,
} from "./physics/iss-ephemeris";
import {
  additionalKnownSatellites,
  knownSatelliteById,
} from "./physics/known-satellites";
import {
  ASTRONOMICAL_UNIT_M,
  majorBodySnapshot,
  majorBodySystem,
} from "./physics/solar-system";
import { PARENT_BODY_ID } from "./scene/body-facts";
import {
  BODY_COMPOSITION_BY_ID,
  formatMassKg,
} from "./scene/body-physical-facts";
import type {
  CameraNavigationAction,
  CameraNavigationCommand,
  CameraOrientationPreset,
} from "./scene/camera-view";
import type { GravityWellMode } from "./scene/gravity-potential";
import {
  interpolateSimulationFrame,
  type SimulationFrame,
} from "./scene/interpolation";
import {
  bodyOrientationAngles,
  siderealRotationPeriodHours,
} from "./scene/orientation";
import type { SmallBodyGpuStatus } from "./scene/SmallBodyGpuLayer";
import { SchematicSystemMap } from "./scene/SchematicSystemMap";
import {
  nasaMaterialPresentationByBodyId,
  nasaTextureByBodyId,
} from "./scene/visual-assets";
import {
  DEFAULT_OBJECT_VISIBILITY,
  type ObjectVisibility,
} from "./scene/visibility";
import type {
  ReferenceFrame,
  SemanticZoomLevel,
  ViewMode,
} from "./scene/view-mode";
import {
  SCALE_TOUR_STEP_DURATION_MS,
  SCALE_TOUR_STEPS,
  SCALE_TOUR_TRANSITION_DURATION_MS,
} from "./tour/scale-tour";

const SolarSystemScene = lazy(async () => {
  const module = await import("./scene/SolarSystemScene");
  return { default: module.SolarSystemScene };
});

const DAY_SECONDS = 86_400;
const TARGET_SOLVER_FRAMES_PER_SECOND = 30;
const MAXIMUM_SOLVER_KEYFRAME_SECONDS = DAY_SECONDS;
const MINIMUM_TRANSITION_MS = 16;
const PLAYBACK_BATCH_SIZE = TARGET_SOLVER_FRAMES_PER_SECOND;
const DEFAULT_CAMERA_ZOOM = 1;
const CAMERA_ZOOM_PRESETS = [
  { id: "wide", label: "Wide (0.5x)", zoom: 0.5 },
  { id: "normal", label: "Normal (1x)", zoom: 1 },
  { id: "close", label: "Close (2x)", zoom: 2 },
  { id: "detail", label: "Detail (4x)", zoom: 4 },
] as const;
const SEMANTIC_ZOOM_LABELS: Readonly<Record<SemanticZoomLevel, string>> = {
  "solar-system": "Solar System",
  "planetary-system": "Planet system",
  "moon-system": "Moon system",
  surface: "Surface detail",
};
const VIEW_MODE_OPTIONS = [
  {
    mode: "reality",
    label: "Reality",
    description:
      "True physical sizes and positions. Bodies disappear when they are smaller than one screen pixel.",
  },
  {
    mode: "orrery",
    label: "Orrery",
    description:
      "Physical positions with enlarged bodies and markers so the system remains readable.",
  },
  {
    mode: "schematic",
    label: "Map",
    description:
      "A schematic navigation map for finding objects. It is not drawn to physical scale.",
  },
] as const satisfies readonly Readonly<{
  mode: ViewMode;
  label: string;
  description: string;
}>[];
const TIME_RATES = [
  { label: "1 second / second", secondsPerSecond: 1 },
  { label: "1 minute / second", secondsPerSecond: 60 },
  { label: "1 hour / second", secondsPerSecond: 3_600 },
  { label: "1 day / second", secondsPerSecond: DAY_SECONDS },
  { label: "1 week / second", secondsPerSecond: 7 * DAY_SECONDS },
  { label: "30 days / second", secondsPerSecond: 30 * DAY_SECONDS },
  { label: "1 year / second", secondsPerSecond: 365.25 * DAY_SECONDS },
] as const;
const PLANET_FOCUS_ORDER = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;

const FOCUS_OPTIONS: readonly Readonly<{
  id: string;
  label: string;
  disabled: boolean;
}>[] = [
  { id: "", label: "Solar System", disabled: false },
  ...majorBodySnapshot.bodies.map((body) => ({
    id: body.id,
    label: body.name,
    disabled: false,
  })),
  ...additionalKnownSatellites.map((body) => {
    const parentName = majorBodySnapshot.bodies.find(
      (candidate) => candidate.id === body.parentId,
    )?.name;
    return {
      id: body.id,
      label: `${body.name} (${parentName ?? body.parentId})${
        body.availability === "unavailable" ? " - unavailable at epoch" : ""
      }`,
      disabled: body.availability === "unavailable",
    };
  }),
  {
    id: ISS_BODY_ID,
    label: "International Space Station (Earth)",
    disabled: false,
  },
];

const FocusSelect = memo(function FocusSelect({
  value,
  onSelect,
}: Readonly<{
  value: string;
  onSelect(bodyId: string): void;
}>) {
  const selectedOption = FOCUS_OPTIONS.find((option) => option.id === value);
  if (selectedOption === undefined) {
    throw new Error(`Focus option ${value} is unavailable`);
  }
  const [query, setQuery] = useState(selectedOption.label);
  useEffect(() => setQuery(selectedOption.label), [selectedOption.label]);
  const selectExactMatch = (candidate: string): boolean => {
    const normalizedCandidate = candidate.trim().toLocaleLowerCase();
    const match = FOCUS_OPTIONS.find(
      (option) =>
        option.label.toLocaleLowerCase() === normalizedCandidate &&
        !option.disabled,
    );
    if (match === undefined) {
      return false;
    }
    setQuery(match.label);
    onSelect(match.id);
    return true;
  };

  return (
    <label className="focus-control">
      Focus
      <input
        type="search"
        list="solar-system-focus-options"
        value={query}
        autoComplete="off"
        spellCheck="false"
        onChange={(event) => {
          const nextQuery = event.currentTarget.value;
          setQuery(nextQuery);
          selectExactMatch(nextQuery);
        }}
        onBlur={() => {
          if (!selectExactMatch(query)) {
            setQuery(selectedOption.label);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            selectExactMatch(query);
          }
        }}
      />
      <datalist id="solar-system-focus-options">
        {FOCUS_OPTIONS.map((option) => (
          <option key={option.id || "solar-system"} value={option.label}>
            {option.disabled ? "Unavailable at epoch" : undefined}
          </option>
        ))}
      </datalist>
    </label>
  );
});

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function bodyDistanceM(first: BodyState, second: BodyState): number {
  return Math.hypot(
    first.positionM[0] - second.positionM[0],
    first.positionM[1] - second.positionM[1],
    first.positionM[2] - second.positionM[2],
  );
}

function bodyRelativeSpeedMps(first: BodyState, second: BodyState): number {
  return Math.hypot(
    first.velocityMps[0] - second.velocityMps[0],
    first.velocityMps[1] - second.velocityMps[1],
    first.velocityMps[2] - second.velocityMps[2],
  );
}

function formatDistance(
  distanceM: number,
  semanticZoom: SemanticZoomLevel,
): string {
  if (
    semanticZoom === "solar-system" &&
    distanceM >= 0.1 * ASTRONOMICAL_UNIT_M
  ) {
    return `${(distanceM / ASTRONOMICAL_UNIT_M).toLocaleString(undefined, { maximumFractionDigits: 5 })} AU`;
  }
  return `${(distanceM / 1_000).toLocaleString(undefined, {
    maximumFractionDigits: semanticZoom === "surface" ? 2 : 0,
  })} km`;
}

function formatEffectiveRate(secondsPerSecond: number): string {
  const absolute = Math.abs(secondsPerSecond);
  if (absolute >= DAY_SECONDS) {
    return `${(absolute / DAY_SECONDS).toLocaleString(undefined, { maximumFractionDigits: 1 })} days/s`;
  }
  if (absolute >= 3_600) {
    return `${(absolute / 3_600).toLocaleString(undefined, { maximumFractionDigits: 1 })} hours/s`;
  }
  if (absolute >= 60) {
    return `${(absolute / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} min/s`;
  }
  return `${absolute.toLocaleString(undefined, { maximumFractionDigits: 1 })} s/s`;
}

function formatSimulationOffset(seconds: number): string {
  if (seconds === 0) {
    return "0 days";
  }
  const sign = seconds > 0 ? "+" : "−";
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 60) {
    return `${sign}${absoluteSeconds.toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;
  }
  if (absoluteSeconds < 3_600) {
    return `${sign}${(absoluteSeconds / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
  }
  if (absoluteSeconds < DAY_SECONDS) {
    return `${sign}${(absoluteSeconds / 3_600).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
  }
  return `${sign}${(absoluteSeconds / DAY_SECONDS).toLocaleString(undefined, { maximumFractionDigits: 2 })} days`;
}

function normalizedDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function useDisplayedSimulationState(
  frame: SimulationFrame | undefined,
): Readonly<{
  state: SimulationState | undefined;
  stateRef: RefObject<SimulationState | undefined>;
}> {
  const [displayedState, setDisplayedState] = useState<SimulationState>();
  const displayedStateRef = useRef<SimulationState | undefined>(undefined);
  useEffect(() => {
    if (frame === undefined) {
      displayedStateRef.current = undefined;
      setDisplayedState(undefined);
      return;
    }
    if (
      frame.transitionDurationMs <= 0 ||
      frame.start.timeSeconds === frame.end.timeSeconds
    ) {
      displayedStateRef.current = frame.end;
      setDisplayedState(frame.end);
      return;
    }
    const startedAt = performance.now();
    let lastReactPresentationAt = Number.NEGATIVE_INFINITY;
    let animationFrame = 0;
    const present = (now: number): void => {
      const fraction = Math.min(
        1,
        Math.max(0, (now - startedAt) / frame.transitionDurationMs),
      );
      const nextState = interpolateSimulationFrame(frame, fraction);
      displayedStateRef.current = nextState;
      if (now - lastReactPresentationAt >= 100 || fraction === 1) {
        lastReactPresentationAt = now;
        setDisplayedState(nextState);
      }
      if (fraction < 1) {
        animationFrame = requestAnimationFrame(present);
      }
    };
    animationFrame = requestAnimationFrame(present);
    return () => cancelAnimationFrame(animationFrame);
  }, [frame]);
  return { state: displayedState, stateRef: displayedStateRef };
}

export function App() {
  const audio = useInterfaceAudio();
  const [frame, setFrame] = useState<SimulationFrame>();
  const { state, stateRef: displayedStateRef } =
    useDisplayedSimulationState(frame);
  const [error, setError] = useState<string>();
  const [playing, setPlaying] = useState(true);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const [timeRateIndex, setTimeRateIndex] = useState(2);
  const [effectiveRate, setEffectiveRate] = useState(0);
  const [playbackBuffered, setPlaybackBuffered] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [bodyVisibilityPercent, setBodyVisibilityPercent] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>("reality");
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [focusBodyId, setFocusBodyId] = useState("");
  const [showMoonTrail, setShowMoonTrail] = useState(false);
  const [showPlanetTrails, setShowPlanetTrails] = useState(false);
  const [showMinorBodyTrails, setShowMinorBodyTrails] = useState(false);
  const [referenceFrame, setReferenceFrame] =
    useState<ReferenceFrame>("heliocentric");
  const [trailDurationDays, setTrailDurationDays] = useState(365);
  const [trailFadePercent, setTrailFadePercent] = useState(85);
  const [clearTrailsToken, setClearTrailsToken] = useState(0);
  const [showEclipticPlane, setShowEclipticPlane] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showTacticalOverlay, setShowTacticalOverlay] = useState(false);
  const [showOrbitGuides, setShowOrbitGuides] = useState(false);
  const [gravityWellMode, setGravityWellMode] =
    useState<GravityWellMode>("off");
  const [semanticZoom, setSemanticZoom] =
    useState<SemanticZoomLevel>("solar-system");
  const [resetViewToken, setResetViewToken] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_CAMERA_ZOOM);
  const [cameraNavigationCommand, setCameraNavigationCommand] =
    useState<CameraNavigationCommand>({
      sequence: 0,
      action: "fit-selection",
    });
  const [cameraOrientation, setCameraOrientation] =
    useState<CameraOrientationPreset>("perspective");
  const [orientationPresetToken, setOrientationPresetToken] = useState(0);
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [tourPresentationToken, setTourPresentationToken] = useState(0);
  const [tourTransitionSequence, setTourTransitionSequence] = useState(0);
  const [tourTransitionDurationMs, setTourTransitionDurationMs] = useState(0);
  const [objectVisibility, setObjectVisibility] = useState<ObjectVisibility>(
    DEFAULT_OBJECT_VISIBILITY,
  );
  const [gpuStatus, setGpuStatus] = useState<SmallBodyGpuStatus>();
  const [gpuError, setGpuError] = useState<string>();
  const playingRef = useRef(playing);
  const directionRef = useRef(direction);
  const timeRateIndexRef = useRef(timeRateIndex);
  const manualDeltaSecondsRef = useRef(0);
  const focusBodyIdRef = useRef(focusBodyId);
  const focusHistoryRef = useRef<string[]>([]);
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const displayPanelRef = useRef<HTMLElement>(null);
  const displayPanelWasOpenRef = useRef(false);
  playingRef.current = playing;
  directionRef.current = direction;
  timeRateIndexRef.current = timeRateIndex;
  focusBodyIdRef.current = focusBodyId;

  useEffect(() => {
    if (controlPanelOpen) {
      displayPanelWasOpenRef.current = true;
      requestAnimationFrame(() => {
        displayPanelRef.current
          ?.querySelector<HTMLButtonElement>("button[data-initial-focus]")
          ?.focus();
      });
      return;
    }
    if (displayPanelWasOpenRef.current) {
      displayPanelWasOpenRef.current = false;
      displayButtonRef.current?.focus();
    }
  }, [controlPanelOpen]);

  useEffect(() => {
    const client = createPhysicsClient();
    const controller = new AbortController();
    const isActive = (): boolean => !controller.signal.aborted;
    let solverTime = 0;
    let rateSampleTime = performance.now();
    let rateSampleSimulationTime = 0;

    const resetMeasuredRate = (simulationTime: number): void => {
      rateSampleTime = performance.now();
      rateSampleSimulationTime = simulationTime;
      if (isActive()) {
        setEffectiveRate(0);
      }
    };

    const recordDisplayedState = (simulationTime: number): void => {
      const now = performance.now();
      const elapsedMs = now - rateSampleTime;
      if (elapsedMs < 500) {
        return;
      }
      if (isActive()) {
        setEffectiveRate(
          ((simulationTime - rateSampleSimulationTime) * 1_000) / elapsedMs,
        );
      }
      rateSampleTime = now;
      rateSampleSimulationTime = simulationTime;
    };

    const buildTargetTimes = (
      startTime: number,
      signedKeyframeSeconds: number,
      count: number,
    ): number[] =>
      Array.from(
        { length: count },
        (_, index) => startTime + signedKeyframeSeconds * (index + 1),
      );

    const run = async (): Promise<void> => {
      try {
        let previousState = await client.api.initialize(majorBodySystem);
        solverTime = previousState.timeSeconds;
        resetMeasuredRate(previousState.timeSeconds);
        if (isActive()) {
          setFrame({
            start: previousState,
            end: previousState,
            transitionDurationMs: 0,
          });
        }
        while (isActive()) {
          const manualRemaining = manualDeltaSecondsRef.current;
          const selectedRate = TIME_RATES[timeRateIndexRef.current];
          if (selectedRate === undefined) {
            throw new Error("Selected simulation time rate is unavailable");
          }
          if (manualRemaining === 0 && !playingRef.current) {
            if (isActive()) {
              setPlaybackBuffered(false);
            }
            await sleep(50);
            continue;
          }

          const isManual = manualRemaining !== 0;
          const requestedDirection = isManual
            ? Math.sign(manualRemaining)
            : directionRef.current;
          const keyframeSeconds = isManual
            ? Math.min(
                Math.abs(manualRemaining),
                MAXIMUM_SOLVER_KEYFRAME_SECONDS,
              )
            : Math.min(
                MAXIMUM_SOLVER_KEYFRAME_SECONDS,
                Math.max(
                  1,
                  selectedRate.secondsPerSecond /
                    TARGET_SOLVER_FRAMES_PER_SECOND,
                ),
              );
          const signedKeyframeSeconds = requestedDirection * keyframeSeconds;
          const requestedRateIndex = timeRateIndexRef.current;
          const batchSize = isManual ? 1 : PLAYBACK_BATCH_SIZE;
          const transitionDurationMs = isManual
            ? MINIMUM_TRANSITION_MS
            : Math.max(
                MINIMUM_TRANSITION_MS,
                (keyframeSeconds / selectedRate.secondsPerSecond) * 1_000,
              );
          const keyframeIntervalMs = isManual
            ? transitionDurationMs
            : (keyframeSeconds / selectedRate.secondsPerSecond) * 1_000;
          const targetTimes = buildTargetTimes(
            solverTime,
            signedKeyframeSeconds,
            batchSize,
          );
          let nextStates = await client.api.integrateSeries(targetTimes);
          solverTime = targetTimes.at(-1) ?? solverTime;

          const initialRequestChanged =
            !isManual &&
            (!playingRef.current ||
              directionRef.current !== requestedDirection ||
              timeRateIndexRef.current !== requestedRateIndex);
          if (initialRequestChanged) {
            await client.api.integrateTo(previousState.timeSeconds);
            solverTime = previousState.timeSeconds;
            resetMeasuredRate(previousState.timeSeconds);
            if (isActive()) {
              setPlaybackBuffered(false);
            }
            continue;
          }

          while (isActive()) {
            const nextBatchTargets = isManual
              ? undefined
              : buildTargetTimes(
                  solverTime,
                  signedKeyframeSeconds,
                  PLAYBACK_BATCH_SIZE,
                );
            const prefetchedStates =
              nextBatchTargets === undefined
                ? undefined
                : client.api.integrateSeries(nextBatchTargets);
            if (isActive()) {
              setPlaybackBuffered(!isManual);
            }
            let requestChanged = false;
            const batchPresentationStart = performance.now();
            const pendingTrailStates: SimulationState[] = [];

            for (const [stateIndex, rawNextState] of nextStates.entries()) {
              requestChanged =
                !isManual &&
                (!playingRef.current ||
                  directionRef.current !== requestedDirection ||
                  timeRateIndexRef.current !== requestedRateIndex);
              if (requestChanged) {
                break;
              }
              if (isManual) {
                manualDeltaSecondsRef.current -= signedKeyframeSeconds;
              }
              const scheduledFrameTime =
                batchPresentationStart + stateIndex * keyframeIntervalMs;
              const nextScheduledFrameTime =
                scheduledFrameTime + keyframeIntervalMs;
              const frameIsAlreadyLate =
                !isManual &&
                stateIndex < nextStates.length - 1 &&
                performance.now() >= nextScheduledFrameTime;
              if (frameIsAlreadyLate) {
                pendingTrailStates.push(rawNextState);
                continue;
              }
              const frameStartState = withKnownSatellites(previousState);
              const nextState = withKnownSatellites(rawNextState);
              if (isActive()) {
                setFrame({
                  start: frameStartState,
                  end: nextState,
                  transitionDurationMs,
                  trailStates: [...pendingTrailStates, nextState],
                });
                recordDisplayedState(nextState.timeSeconds);
              }
              pendingTrailStates.length = 0;
              previousState = nextState;
              await sleep(
                Math.max(0, nextScheduledFrameTime - performance.now()),
              );
            }

            if (prefetchedStates !== undefined) {
              const resolvedPrefetch = await prefetchedStates;
              solverTime = nextBatchTargets?.at(-1) ?? solverTime;
              if (requestChanged) {
                await client.api.integrateTo(previousState.timeSeconds);
                solverTime = previousState.timeSeconds;
                resetMeasuredRate(previousState.timeSeconds);
                if (isActive()) {
                  setPlaybackBuffered(false);
                }
                break;
              }
              nextStates = resolvedPrefetch;
              continue;
            }
            break;
          }
          if (isManual && manualDeltaSecondsRef.current === 0 && isActive()) {
            setSeeking(false);
            setPlaybackBuffered(false);
            resetMeasuredRate(previousState.timeSeconds);
          }
        }
      } catch (cause: unknown) {
        if (isActive()) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };
    void run();

    return () => {
      controller.abort();
      client.close();
    };
  }, []);

  const issueCameraNavigation = useCallback(
    (action: CameraNavigationAction): void => {
      setCameraNavigationCommand((current) => ({
        sequence: current.sequence + 1,
        action,
      }));
    },
    [],
  );

  const requestResetView = useCallback((): void => {
    setTourPlaying(false);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("parent-facing");
    setResetViewToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && tourStepIndex !== null) {
        event.preventDefault();
        setTourPlaying(false);
        setTourStepIndex(null);
        setPlaying(false);
        return;
      }
      if (event.key.toLowerCase() !== "r") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      requestResetView();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestResetView, tourStepIndex]);

  const applyOrientationPreset = (
    preset: Exclude<CameraOrientationPreset, "custom">,
  ): void => {
    setCameraOrientation(preset);
    setOrientationPresetToken((current) => current + 1);
  };

  const handleSceneOrientationChange = useCallback(
    (preset: CameraOrientationPreset): void => {
      setCameraOrientation(preset);
      if (preset === "custom") {
        setTourPlaying(false);
      }
    },
    [],
  );

  const navigateToFocus = useCallback(
    (bodyId: string): void => {
      setTourPlaying(false);
      setTourStepIndex(null);
      if (tourStepIndex !== null) {
        setPlaying(false);
      }
      const currentBodyId = focusBodyIdRef.current;
      if (bodyId === currentBodyId) {
        return;
      }
      focusHistoryRef.current.push(currentBodyId);
      focusBodyIdRef.current = bodyId;
      setFocusBodyId(bodyId);
      if (bodyId === ISS_BODY_ID) {
        const currentTime = displayedStateRef.current?.timeSeconds ?? 0;
        if (!isIssEphemerisWithinValidity(currentTime)) {
          setPlaying(false);
          manualDeltaSecondsRef.current =
            ISS_EPOCH_SIMULATION_SECONDS - currentTime;
          setSeeking(true);
        }
      }
      setFrame((currentFrame) =>
        currentFrame === undefined
          ? currentFrame
          : {
              ...currentFrame,
              start: withKnownSatellites(currentFrame.start),
              end: withKnownSatellites(currentFrame.end),
            },
      );
      if (bodyId !== "" && bodyId !== "sun") {
        setCameraZoom(DEFAULT_CAMERA_ZOOM);
        setCameraOrientation("parent-facing");
      }
    },
    [tourStepIndex],
  );

  const navigateBack = (): void => {
    setTourPlaying(false);
    setTourStepIndex(null);
    setPlaying(false);
    const previousBodyId = focusHistoryRef.current.pop();
    if (previousBodyId === undefined) {
      return;
    }
    focusBodyIdRef.current = previousBodyId;
    setFocusBodyId(previousBodyId);
    setFrame((currentFrame) =>
      currentFrame === undefined
        ? currentFrame
        : {
            ...currentFrame,
            start: withKnownSatellites(currentFrame.start),
            end: withKnownSatellites(currentFrame.end),
          },
    );
  };

  const navigateToParent = (): void => {
    if (focusBodyId === "") {
      return;
    }
    const parentId =
      (focusBodyId === ISS_BODY_ID ? ISS_PARENT_BODY_ID : undefined) ??
      knownSatelliteById.get(focusBodyId)?.parentId ??
      PARENT_BODY_ID[focusBodyId] ??
      "";
    navigateToFocus(parentId);
  };

  const navigateToNextPlanet = (): void => {
    const currentIndex = PLANET_FOCUS_ORDER.findIndex(
      (bodyId) => bodyId === focusBodyId,
    );
    navigateToFocus(
      PLANET_FOCUS_ORDER[(currentIndex + 1) % PLANET_FOCUS_ORDER.length] ??
        "mercury",
    );
  };

  const navigateHome = (): void => {
    setTourPlaying(false);
    setPlaying(false);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("perspective");
    if (focusBodyIdRef.current === "") {
      issueCameraNavigation("fit-selection");
      return;
    }
    navigateToFocus("");
  };

  const handleCameraNavigation = (action: CameraNavigationAction): void => {
    setTourPlaying(false);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    issueCameraNavigation(action);
  };

  const startScaleTour = (): void => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setControlPanelOpen(false);
    setTourPlaying(!reducedMotion);
    setTourTransitionDurationMs(
      reducedMotion ? 0 : SCALE_TOUR_TRANSITION_DURATION_MS,
    );
    setTourStepIndex(0);
    setTourPresentationToken((current) => current + 1);
  };

  const exitScaleTour = (): void => {
    setTourPlaying(false);
    setTourStepIndex(null);
    setPlaying(false);
  };

  const advanceScaleTour = (direction: -1 | 1): void => {
    if (tourStepIndex === null) {
      return;
    }
    const next = tourStepIndex + direction;
    if (next < 0) {
      setTourStepIndex(0);
      return;
    }
    if (next >= SCALE_TOUR_STEPS.length) {
      exitScaleTour();
      return;
    }
    setTourStepIndex(next);
  };

  useEffect(() => {
    if (tourStepIndex === null) {
      return;
    }
    const step = SCALE_TOUR_STEPS[tourStepIndex];
    if (step === undefined) {
      throw new Error(
        `Scale tour step ${String(tourStepIndex)} is unavailable`,
      );
    }
    const requestedTimeRateIndex = TIME_RATES.findIndex(
      (rate) => rate.secondsPerSecond === step.timeRateSecondsPerSecond,
    );
    if (requestedTimeRateIndex < 0) {
      throw new Error(
        `Scale tour step ${step.id} requests an unavailable time rate`,
      );
    }
    setDirection(1);
    setTimeRateIndex(requestedTimeRateIndex);
    setViewMode(step.viewMode);
    setBodyVisibilityPercent(step.bodyVisibilityPercent);
    setShowLabels(step.overlays.labels);
    setShowOrbitGuides(step.overlays.orbitGuides);
    setShowTacticalOverlay(step.overlays.tactical);
    setShowEclipticPlane(step.overlays.eclipticGrid);
    setShowPlanetTrails(step.overlays.planetTrails);
    setShowMoonTrail(step.overlays.moonTrail);
    setShowMinorBodyTrails(false);
    setGravityWellMode("off");
    setReferenceFrame("heliocentric");
    setCameraZoom(step.cameraZoom);
    setCameraOrientation(step.orientation);
    setOrientationPresetToken((current) => current + 1);
    focusHistoryRef.current = [];
    focusBodyIdRef.current = step.focusBodyId;
    setFocusBodyId(step.focusBodyId);
    setResetViewToken((current) => current + 1);
    setTourTransitionSequence((current) => current + 1);
  }, [tourPresentationToken, tourStepIndex]);

  useEffect(() => {
    if (tourStepIndex !== null) {
      setPlaying(tourPlaying);
    }
  }, [tourPlaying, tourStepIndex]);

  useEffect(() => {
    if (tourStepIndex === null || !tourPlaying) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (tourStepIndex === SCALE_TOUR_STEPS.length - 1) {
        setTourPlaying(false);
        return;
      }
      setTourStepIndex(tourStepIndex + 1);
    }, SCALE_TOUR_STEP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tourPlaying, tourStepIndex]);

  const activeTourStep =
    tourStepIndex === null ? undefined : SCALE_TOUR_STEPS[tourStepIndex];
  const activeCameraTargetBodyId =
    activeTourStep?.focusBodyId === focusBodyId
      ? activeTourStep.cameraTargetBodyId
      : undefined;

  const activeZoomPreset =
    CAMERA_ZOOM_PRESETS.find((preset) => preset.zoom === cameraZoom)?.id ??
    "custom";

  const selectedTimeRate = TIME_RATES[timeRateIndex];
  if (selectedTimeRate === undefined) {
    throw new Error("Selected simulation time rate is unavailable");
  }

  const selectedBodyDetail = useMemo(() => {
    if (focusBodyId === "" || state === undefined) {
      return undefined;
    }
    const definition = majorBodySnapshot.bodies.find(
      (body) => body.id === focusBodyId,
    );
    const bodyState = state.bodies.find((body) => body.id === focusBodyId);
    const knownSatellite = knownSatelliteById.get(focusBodyId);
    const isIss = focusBodyId === ISS_BODY_ID;
    if (
      bodyState === undefined ||
      (definition === undefined && knownSatellite === undefined && !isIss)
    ) {
      return undefined;
    }
    const parentId =
      definition === undefined
        ? isIss
          ? ISS_PARENT_BODY_ID
          : knownSatellite?.parentId
        : PARENT_BODY_ID[focusBodyId];
    const parentState = state.bodies.find((body) => body.id === parentId);
    const parentDefinition = majorBodySnapshot.bodies.find(
      (body) => body.id === parentId,
    );
    const composition = BODY_COMPOSITION_BY_ID[focusBodyId];
    const speedLabel =
      parentDefinition === undefined
        ? undefined
        : `Speed relative to ${parentDefinition.name}`;
    if (definition === undefined) {
      if (isIss) {
        return {
          name: "International Space Station",
          surface:
            "NASA-dimensioned procedural model · SGP4 from CelesTrak OMM",
          parentName: parentDefinition?.name,
          distance:
            parentState === undefined
              ? undefined
              : formatDistance(
                  bodyDistanceM(bodyState, parentState),
                  semanticZoom,
                ),
          distanceLabel: "Geocentric distance",
          altitudeKm:
            parentState === undefined || parentDefinition === undefined
              ? undefined
              : (bodyDistanceM(bodyState, parentState) -
                  parentDefinition.meanRadiusM) /
                1_000,
          speed:
            parentState === undefined
              ? undefined
              : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
          speedLabel,
          mass: formatMassKg(issSnapshot.physicalDimensions.massKg),
          composition,
          dimensionsM: `${String(issSnapshot.physicalDimensions.overallEndToEndM)} × ${String(issSnapshot.physicalDimensions.solarArrayLengthM)} m`,
          ephemerisStatus: isIssEphemerisWithinValidity(state.timeSeconds)
            ? "Within ±7 day OMM window"
            : "Hidden outside ±7 day OMM window",
        };
      }
      return {
        name: knownSatellite?.name ?? focusBodyId,
        surface: "Neutral point - no installed surface asset",
        parentName: parentDefinition?.name,
        distance:
          parentState === undefined
            ? undefined
            : formatDistance(
                bodyDistanceM(bodyState, parentState),
                semanticZoom,
              ),
        speed:
          parentState === undefined
            ? undefined
            : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
        speedLabel,
        mass: formatMassKg(undefined),
        composition,
      };
    }
    return {
      name: definition.name,
      surface:
        nasaTextureByBodyId.get(definition.id)?.classification ??
        nasaMaterialPresentationByBodyId.get(definition.id)?.classification ??
        "Neutral - no installed authoritative surface asset",
      diameterKm: (definition.meanRadiusM * 2) / 1_000,
      parentName: parentDefinition?.name,
      distance:
        parentState === undefined
          ? undefined
          : formatDistance(bodyDistanceM(bodyState, parentState), semanticZoom),
      speed:
        parentState === undefined
          ? undefined
          : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
      speedLabel,
      mass: formatMassKg(definition.massKg),
      composition,
      rotationHours: siderealRotationPeriodHours(definition),
      primeMeridianDeg: normalizedDegrees(
        bodyOrientationAngles(definition.id, state.timeSeconds)
          .primeMeridianDeg,
      ),
    };
  }, [focusBodyId, semanticZoom, state]);

  const startPlaying = (nextDirection: -1 | 1): void => {
    setDirection(nextDirection);
    setPlaying(true);
  };

  const queueStep = (stepDirection: -1 | 1): void => {
    setPlaying(false);
    manualDeltaSecondsRef.current +=
      stepDirection * selectedTimeRate.secondsPerSecond;
    setSeeking(true);
  };

  const setCategoryVisibility = (
    category: keyof ObjectVisibility,
    visible: boolean,
  ): void => {
    setObjectVisibility((current) => ({ ...current, [category]: visible }));
  };

  const focusedDefinition = majorBodySnapshot.bodies.find(
    (body) => body.id === focusBodyId,
  );
  const focusedKnownSatellite = knownSatelliteById.get(focusBodyId);
  const focusedParentId =
    (focusBodyId === ISS_BODY_ID ? ISS_PARENT_BODY_ID : undefined) ??
    focusedKnownSatellite?.parentId ??
    PARENT_BODY_ID[focusBodyId];
  const focusedParentName = majorBodySnapshot.bodies.find(
    (body) => body.id === focusedParentId,
  )?.name;
  const outsideValidatedWindow =
    Math.abs(state?.timeSeconds ?? 0) > 365 * DAY_SECONDS;

  return (
    <main
      className="app-shell"
      data-view-mode={viewMode}
      data-audio-state={audio.status}
      onClickCapture={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button:not(:disabled), summary") !== null
        ) {
          audio.interact("button");
        }
      }}
      onChangeCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement &&
            (target.type === "checkbox" || target.type === "radio"))
        ) {
          audio.interact("option");
        }
      }}
      onPointerUpCapture={(event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.type === "range") {
          audio.interact("slider");
        }
      }}
      onKeyUpCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement &&
          target.type === "range" &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        ) {
          audio.interact("slider");
        }
      }}
    >
      <header className="command-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Solar System Explorer</h1>
        </div>
        <nav className="view-switcher" aria-label="View mode">
          {VIEW_MODE_OPTIONS.map(({ mode, label, description }) => {
            const tooltipId = `view-mode-${mode}-tooltip`;
            return (
              <div className="view-mode-option" key={mode}>
                <button
                  type="button"
                  aria-pressed={viewMode === mode}
                  aria-describedby={tooltipId}
                  onClick={() => {
                    setTourPlaying(false);
                    setTourStepIndex(null);
                    setViewMode(mode);
                  }}
                >
                  {label}
                </button>
                <span
                  id={tooltipId}
                  className="view-mode-tooltip"
                  role="tooltip"
                >
                  {description}
                </span>
              </div>
            );
          })}
        </nav>
        <FocusSelect value={focusBodyId} onSelect={navigateToFocus} />
        <div className="command-actions">
          <button type="button" onClick={requestResetView}>
            Reset
          </button>
          <button
            ref={displayButtonRef}
            type="button"
            className="display-button"
            aria-expanded={controlPanelOpen}
            aria-controls="display-panel"
            onClick={() => setControlPanelOpen((open) => !open)}
          >
            Display
          </button>
        </div>
      </header>

      <section className="workspace">
        <nav className="focus-breadcrumb" aria-label="Current focus">
          <button type="button" onClick={navigateHome}>
            Solar System
          </button>
          {focusedParentId === undefined ||
          focusedParentName === undefined ? null : (
            <>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => navigateToFocus(focusedParentId)}
              >
                {focusedParentName}
              </button>
            </>
          )}
          {focusBodyId === "" ? null : (
            <>
              <span aria-hidden="true">/</span>
              <strong>
                {focusedDefinition?.name ??
                  focusedKnownSatellite?.name ??
                  focusBodyId}
              </strong>
            </>
          )}
        </nav>

        <div className="status-cluster">
          <span className={playing ? "status-dot is-active" : "status-dot"} />
          <span>
            {playing ? (direction > 0 ? "Forward" : "Reverse") : "Paused"}
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              gpuError === undefined ? "gpu-status" : "gpu-status error"
            }
          >
            {viewMode === "reality"
              ? "Physical scale"
              : gpuStatus !== undefined
                ? `${gpuStatus.integrableObjects.toLocaleString()} propagated · ${gpuStatus.unavailableObjects.toLocaleString()} unavailable`
                : gpuError !== undefined
                  ? "GPU error"
                  : objectVisibility.asteroids || objectVisibility.comets
                    ? "GPU loading"
                    : "Major bodies"}
          </span>
        </div>

        {error !== undefined ? (
          <p className="error" role="alert">
            Physics engine failed: {error}
          </p>
        ) : viewMode === "schematic" ? (
          <SchematicSystemMap
            state={state}
            focusBodyId={focusBodyId}
            objectVisibility={objectVisibility}
            onFocusBody={navigateToFocus}
          />
        ) : (
          <Suspense fallback={<p className="loading">Loading view...</p>}>
            <SolarSystemScene
              frame={frame}
              displayedStateRef={displayedStateRef}
              bodyVisibility={
                viewMode === "reality" ? 0 : bodyVisibilityPercent / 100
              }
              focusBodyId={focusBodyId === "" ? null : focusBodyId}
              showMoonTrail={showMoonTrail}
              showPlanetTrails={showPlanetTrails}
              showMinorBodyTrails={showMinorBodyTrails}
              referenceFrame={referenceFrame}
              trailDurationSeconds={trailDurationDays * DAY_SECONDS}
              trailFade={trailFadePercent / 100}
              clearTrailsToken={clearTrailsToken}
              showEclipticPlane={showEclipticPlane}
              showLabels={showLabels}
              showTacticalOverlay={showTacticalOverlay}
              showOrbitGuides={showOrbitGuides}
              orbitGuideScope={
                activeTourStep?.overlays.orbitGuideScope ?? "all"
              }
              gravityWellMode={gravityWellMode}
              resetViewToken={resetViewToken}
              cameraZoom={cameraZoom}
              cameraDistanceOverrideAu={
                typeof activeTourStep?.cameraDistanceAu === "number"
                  ? activeTourStep.cameraDistanceAu
                  : undefined
              }
              cameraTargetBodyId={activeCameraTargetBodyId}
              cameraTransitionSequence={tourTransitionSequence}
              cameraTransitionDurationMs={
                activeTourStep === undefined ? 0 : tourTransitionDurationMs
              }
              cameraTransitionOverviewAnchorBodyId={
                activeTourStep?.transitionOverviewAnchorBodyId
              }
              cameraTransitionOverviewDistanceAu={
                activeTourStep?.transitionOverviewDistanceAu ?? 90
              }
              cameraNavigationCommand={cameraNavigationCommand}
              orientationPreset={cameraOrientation}
              orientationPresetToken={orientationPresetToken}
              viewMode={viewMode}
              objectVisibility={objectVisibility}
              onFocusBody={navigateToFocus}
              onOrientationChange={handleSceneOrientationChange}
              onSemanticZoomChange={setSemanticZoom}
              onGpuStatus={setGpuStatus}
              onGpuError={setGpuError}
            />
          </Suspense>
        )}

        <nav className="camera-dock" aria-label="Camera navigation">
          <span className="camera-scale" aria-live="polite">
            <small>View scale</small>
            <strong>{SEMANTIC_ZOOM_LABELS[semanticZoom]}</strong>
          </span>
          <div className="camera-dock-actions">
            <button
              type="button"
              onClick={navigateBack}
              disabled={focusHistoryRef.current.length === 0}
            >
              Back
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={viewMode === "schematic"}
              onClick={() => handleCameraNavigation("zoom-out")}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={viewMode === "schematic"}
              onClick={() => handleCameraNavigation("zoom-in")}
            >
              +
            </button>
            <button
              type="button"
              disabled={viewMode === "schematic"}
              onClick={() => handleCameraNavigation("fit-selection")}
            >
              Fit
            </button>
            <button type="button" onClick={navigateHome}>
              Home
            </button>
            <button
              type="button"
              className="tour-launch-button"
              onClick={startScaleTour}
            >
              Scale tour
            </button>
          </div>
        </nav>

        {activeTourStep === undefined || tourStepIndex === null ? null : (
          <aside
            className="scale-tour"
            role="dialog"
            aria-modal="false"
            aria-label="Scale of the Solar System tour"
            data-tour-step={activeTourStep.id}
            data-tour-playing={String(tourPlaying)}
            data-tour-observer={
              activeTourStep.cameraTargetBodyId === undefined
                ? "none"
                : activeTourStep.focusBodyId
            }
            data-tour-target={
              activeTourStep.cameraTargetBodyId ?? activeTourStep.focusBodyId
            }
            data-tour-time-rate-seconds-per-second={String(
              activeTourStep.timeRateSecondsPerSecond,
            )}
          >
            <div className="tour-progress-heading">
              <span>
                Scale tour {tourStepIndex + 1} of {SCALE_TOUR_STEPS.length}
              </span>
              <button type="button" onClick={exitScaleTour}>
                Exit
              </button>
            </div>
            <div className="tour-progress" aria-hidden="true">
              <span
                key={`${activeTourStep.id}-${String(tourPlaying)}`}
                className={tourPlaying ? "is-playing" : undefined}
                style={{
                  animationDuration: `${String(SCALE_TOUR_STEP_DURATION_MS)}ms`,
                }}
              />
            </div>
            <div className="tour-copy" aria-live="polite">
              <span>{activeTourStep.eyebrow}</span>
              <h2>{activeTourStep.title}</h2>
              <strong>{activeTourStep.scale}</strong>
              <p>{activeTourStep.description}</p>
              <small className="tour-motion">
                Motion · {activeTourStep.timeRateLabel}
              </small>
              <small className="tour-visual-key">
                {activeTourStep.visualKey}
              </small>
            </div>
            <div className="tour-actions">
              <button
                type="button"
                disabled={tourStepIndex === 0}
                onClick={() => advanceScaleTour(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tourPlaying) {
                    setTourPlaying(false);
                    return;
                  }
                  setTourPlaying(true);
                  setTourPresentationToken((current) => current + 1);
                }}
              >
                {tourPlaying ? "Pause tour" : "Resume tour"}
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => advanceScaleTour(1)}
              >
                {tourStepIndex === SCALE_TOUR_STEPS.length - 1
                  ? "Finish"
                  : "Next"}
              </button>
            </div>
          </aside>
        )}

        {selectedBodyDetail === undefined ||
        activeTourStep !== undefined ? null : (
          <aside className="selected-body-detail">
            <div className="selected-body-heading">
              <div>
                <span>Selected body</span>
                <strong>{selectedBodyDetail.name}</strong>
              </div>
              <div className="selected-body-actions">
                <button type="button" onClick={navigateToParent}>
                  Parent
                </button>
                <button type="button" onClick={navigateToNextPlanet}>
                  Next planet
                </button>
              </div>
            </div>
            <div className="selected-body-metrics">
              {selectedBodyDetail.distance === undefined ? null : (
                <span>
                  <small>
                    {selectedBodyDetail.distanceLabel ?? "Distance"}
                  </small>
                  {selectedBodyDetail.distance}
                </span>
              )}
              {selectedBodyDetail.altitudeKm === undefined ? null : (
                <span>
                  <small>Altitude</small>
                  {selectedBodyDetail.altitudeKm.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  km
                </span>
              )}
              {selectedBodyDetail.speed === undefined ? null : (
                <span>
                  <small>
                    {selectedBodyDetail.speedLabel ?? "Relative speed"}
                  </small>
                  {selectedBodyDetail.speed.toLocaleString(undefined, {
                    maximumFractionDigits: 3,
                  })}{" "}
                  km/s
                </span>
              )}
              {selectedBodyDetail.dimensionsM === undefined ? null : (
                <span>
                  <small>Maximum footprint</small>
                  {selectedBodyDetail.dimensionsM}
                </span>
              )}
              {selectedBodyDetail.ephemerisStatus === undefined ? null : (
                <span>
                  <small>Orbit data</small>
                  {selectedBodyDetail.ephemerisStatus}
                </span>
              )}
              {selectedBodyDetail.diameterKm === undefined ? null : (
                <span>
                  <small>Diameter</small>
                  {selectedBodyDetail.diameterKm.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{" "}
                  km
                </span>
              )}
              {selectedBodyDetail.rotationHours === undefined ? null : (
                <span>
                  <small>Sidereal rotation</small>
                  {selectedBodyDetail.rotationHours.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  h
                </span>
              )}
              {selectedBodyDetail.primeMeridianDeg === undefined ? null : (
                <span>
                  <small>Rotation angle</small>
                  {selectedBodyDetail.primeMeridianDeg.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 1 },
                  )}
                  °
                </span>
              )}
              <span>
                <small>Mass</small>
                {selectedBodyDetail.mass}
              </span>
              <span className="selected-body-surface">
                <small>Surface</small>
                {selectedBodyDetail.surface}
              </span>
              <span className="selected-body-composition">
                <small>
                  <span>Composition</span>
                  {selectedBodyDetail.composition === undefined ? null : (
                    <a
                      href={selectedBodyDetail.composition.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Source: ${selectedBodyDetail.composition.authority}`}
                    >
                      Source
                    </a>
                  )}
                </small>
                {selectedBodyDetail.composition?.summary ??
                  "Not provided by the installed authority snapshot"}
              </span>
            </div>
          </aside>
        )}

        <aside
          ref={displayPanelRef}
          id="display-panel"
          className="display-panel"
          hidden={!controlPanelOpen}
          role="dialog"
          aria-modal="false"
          aria-label="Display controls"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setControlPanelOpen(false);
            }
          }}
        >
          <div className="panel-heading">
            <div>
              <span>Display</span>
              <strong>View settings</strong>
            </div>
            <button
              type="button"
              data-initial-focus
              onClick={() => setControlPanelOpen(false)}
            >
              Close
            </button>
          </div>

          {gpuError === undefined ? null : (
            <p className="gpu-error-detail" role="alert">
              {gpuError}
            </p>
          )}

          <details>
            <summary>Scientific model</summary>
            <div className="model-disclosure">
              <span>
                <small>Regime</small>
                Present-day gravitational propagation
              </span>
              <span>
                <small>Ephemeris validation</small>
                −365 to +365 days from the snapshot epoch
              </span>
              <span>
                <small>Deep time</small>
                Formation and stellar evolution require separate sourced models
              </span>
              <span>
                <small>Body scale</small>
                Reality uses sourced physical radii and hides unresolved or
                unknown-size bodies; Orrery provides scalable position markers
              </span>
              <span>
                <small>ISS</small>
                CelesTrak OMM propagated with SGP4 and displayed only within ±7
                days of its source epoch
              </span>
              <span>
                <small>Gravity field</small>
                Combined Newtonian −ΣGM/r, surface-capped at sourced mean radii;
                logarithmic compression changes only the display
              </span>
            </div>
          </details>

          <details open>
            <summary>Audio</summary>
            <div className="control-section audio-controls">
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={audio.settings.musicEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "musicEnabled",
                      event.currentTarget.checked,
                    )
                  }
                />
                <span>Ambient music</span>
              </label>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={audio.settings.effectsEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "effectsEnabled",
                      event.currentTarget.checked,
                    )
                  }
                />
                <span>Interface sounds</span>
              </label>
              <label className="range-control">
                <span>Music volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(audio.settings.musicVolume * 100)}
                  disabled={!audio.settings.musicEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "musicVolume",
                      Number(event.currentTarget.value) / 100,
                    )
                  }
                />
                <output>{Math.round(audio.settings.musicVolume * 100)}%</output>
              </label>
              <label className="range-control">
                <span>Sound volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(audio.settings.effectsVolume * 100)}
                  disabled={!audio.settings.effectsEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "effectsVolume",
                      Number(event.currentTarget.value) / 100,
                    )
                  }
                />
                <output>
                  {Math.round(audio.settings.effectsVolume * 100)}%
                </output>
              </label>
              <span className="audio-status" role="status">
                {audio.status === "running"
                  ? "Audio active"
                  : audio.status === "unavailable"
                    ? "Audio unavailable in this browser"
                    : "Starts after your next interaction"}
              </span>
            </div>
          </details>

          <details open>
            <summary>Camera and guides</summary>
            <div className="control-section">
              <label>
                Orientation
                <select
                  value={cameraOrientation}
                  disabled={viewMode === "schematic"}
                  onChange={(event) =>
                    applyOrientationPreset(
                      event.currentTarget.value as Exclude<
                        CameraOrientationPreset,
                        "custom"
                      >,
                    )
                  }
                >
                  <option value="perspective">Perspective</option>
                  <option value="overhead">Ecliptic overhead</option>
                  <option value="edge-on">Ecliptic edge-on</option>
                  <option value="parent-facing">Face parent</option>
                  <option value="velocity">Follow velocity</option>
                  <option value="orbital-plane">Orbital plane</option>
                  <option value="custom" disabled>
                    Custom
                  </option>
                </select>
              </label>
              <label>
                Zoom preset
                <select
                  value={activeZoomPreset}
                  disabled={viewMode === "schematic"}
                  onChange={(event) => {
                    const preset = CAMERA_ZOOM_PRESETS.find(
                      (candidate) => candidate.id === event.currentTarget.value,
                    );
                    if (preset === undefined) {
                      throw new Error(
                        "Selected camera zoom preset is unavailable",
                      );
                    }
                    setCameraZoom(preset.zoom);
                  }}
                >
                  {CAMERA_ZOOM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="custom" disabled>
                    Custom
                  </option>
                </select>
              </label>
              <label className="range-control">
                <span>Camera zoom</span>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.25"
                  value={cameraZoom}
                  disabled={viewMode === "schematic"}
                  onChange={(event) =>
                    setCameraZoom(Number(event.currentTarget.value))
                  }
                />
                <output>{cameraZoom.toFixed(2).replace(/\.00$/u, "")}x</output>
              </label>
              <label className="range-control">
                <span>Body size boost</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={bodyVisibilityPercent}
                  disabled={viewMode !== "orrery"}
                  onChange={(event) =>
                    setBodyVisibilityPercent(Number(event.currentTarget.value))
                  }
                />
                <output>
                  {viewMode === "reality" || bodyVisibilityPercent === 0
                    ? "Physical"
                    : `${String(bodyVisibilityPercent)}%`}
                </output>
              </label>
              <label>
                Gravity field
                <select
                  value={gravityWellMode}
                  disabled={viewMode === "schematic"}
                  onChange={(event) =>
                    setGravityWellMode(
                      event.currentTarget.value as GravityWellMode,
                    )
                  }
                >
                  <option value="off">Off</option>
                  <option value="contours">Potential contours</option>
                  <option value="surface">3D potential surface</option>
                </select>
              </label>
              {(
                [
                  ["Labels", showLabels, setShowLabels],
                  ["Orbit guides", showOrbitGuides, setShowOrbitGuides],
                  [
                    "Tactical overlay",
                    showTacticalOverlay,
                    setShowTacticalOverlay,
                  ],
                  ["Ecliptic grid", showEclipticPlane, setShowEclipticPlane],
                ] as const
              ).map(([label, checked, setter]) => (
                <label className="switch-control" key={label}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={viewMode === "schematic"}
                    onChange={(event) => setter(event.currentTarget.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>

          <details open>
            <summary>Objects</summary>
            <div className="category-grid">
              {(
                [
                  "planets",
                  "moons",
                  "spacecraft",
                  "asteroids",
                  "comets",
                  "stars",
                ] as const
              ).map((category) => (
                <label key={category} className="category-chip">
                  <input
                    type="checkbox"
                    checked={objectVisibility[category]}
                    disabled={
                      viewMode === "reality" &&
                      (category === "asteroids" || category === "comets")
                    }
                    onChange={(event) =>
                      setCategoryVisibility(
                        category,
                        event.currentTarget.checked,
                      )
                    }
                  />
                  <span>
                    {category[0]?.toUpperCase()}
                    {category.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </details>

          <details>
            <summary>Trails and frames</summary>
            <div className="control-section">
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={showPlanetTrails}
                  onChange={(event) =>
                    setShowPlanetTrails(event.currentTarget.checked)
                  }
                />
                <span>Planet trails</span>
              </label>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={showMoonTrail}
                  onChange={(event) =>
                    setShowMoonTrail(event.currentTarget.checked)
                  }
                />
                <span>Moon trail</span>
              </label>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={showMinorBodyTrails}
                  onChange={(event) =>
                    setShowMinorBodyTrails(event.currentTarget.checked)
                  }
                />
                <span>Minor-body trails</span>
              </label>
              <label>
                Reference frame
                <select
                  value={referenceFrame}
                  onChange={(event) =>
                    setReferenceFrame(
                      event.currentTarget.value as ReferenceFrame,
                    )
                  }
                >
                  <option value="heliocentric">Heliocentric</option>
                  <option value="barycentric">Solar System barycentric</option>
                  <option value="parent-relative">
                    Each body relative to parent
                  </option>
                </select>
              </label>
              <label>
                Trail length
                <select
                  value={trailDurationDays}
                  onChange={(event) =>
                    setTrailDurationDays(Number(event.currentTarget.value))
                  }
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="365">1 year</option>
                  <option value="3650">10 years</option>
                </select>
              </label>
              <label className="range-control">
                <span>Trail fade</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={trailFadePercent}
                  onChange={(event) =>
                    setTrailFadePercent(Number(event.currentTarget.value))
                  }
                />
                <output>{trailFadePercent}%</output>
              </label>
              <button
                type="button"
                onClick={() => setClearTrailsToken((current) => current + 1)}
              >
                Clear trails
              </button>
            </div>
          </details>
        </aside>

        <section className="timeline-dock" aria-label="Time controls">
          <div className="time-readout">
            <output data-time-seconds={state?.timeSeconds ?? 0}>
              TDB {formatSimulationOffset(state?.timeSeconds ?? 0)}
            </output>
            <span
              className="run-status"
              data-achieved-rate-seconds-per-second={effectiveRate}
            >
              {state === undefined
                ? "Starting physics"
                : seeking
                  ? "Seeking"
                  : playing
                    ? `${selectedTimeRate.label.replace(" / second", "/s")} requested · ${formatEffectiveRate(effectiveRate)} achieved${playbackBuffered ? " · buffered" : ""}`
                    : "Paused"}
            </span>
            <span
              className={`model-validity${outsideValidatedWindow ? " is-warning" : ""}`}
              data-model-regime="present-day-propagation"
              data-outside-validated-window={String(outsideValidatedWindow)}
            >
              {outsideValidatedWindow
                ? "Outside ±1 year ephemeris validation"
                : "Present-day model · validated ±1 year"}
            </span>
          </div>
          <div className="time-actions">
            <button type="button" onClick={() => queueStep(-1)}>
              Step backward
            </button>
            {playing ? (
              <button
                type="button"
                className="primary-action"
                onClick={() => setPlaying(false)}
              >
                Pause
              </button>
            ) : (
              <>
                <button type="button" onClick={() => startPlaying(-1)}>
                  Run backward
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => startPlaying(1)}
                >
                  Run forward
                </button>
              </>
            )}
            <button type="button" onClick={() => queueStep(1)}>
              Step forward
            </button>
          </div>
          <label className="playback-rate-control">
            <span>Playback rate</span>
            <input
              type="range"
              min="0"
              max={String(TIME_RATES.length - 1)}
              step="1"
              value={timeRateIndex}
              onChange={(event) =>
                setTimeRateIndex(Number(event.currentTarget.value))
              }
            />
            <output>{selectedTimeRate.label}</output>
          </label>
        </section>
      </section>
    </main>
  );
}
