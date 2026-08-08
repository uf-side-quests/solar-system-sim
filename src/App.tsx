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
import { useCombobox } from "downshift";

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
import {
  isVoyagerBodyId,
  voyagerById,
  voyagerSnapshot,
} from "./physics/voyager-ephemeris";
import {
  isOperationalSpacecraftBodyId,
  isOperationalSpacecraftWithinValidity,
  operationalSpacecraftRecommendedTimeSeconds,
  operationalSpacecraftSnapshot,
} from "./physics/operational-spacecraft";
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
import type {
  GravityWellMode,
  GravityWellScale,
} from "./scene/gravity-potential";
import { type SimulationFrame } from "./scene/interpolation";
import { interpolateDisplayedSimulationFrame } from "./scene/display-interpolation";
import {
  JOVIAN_MONOLITH_BODY_ID,
  JOVIAN_MONOLITH_DIMENSIONS_M,
  JOVIAN_MONOLITH_NAME,
  jovianMonolithState,
} from "./scene/jovian-monolith";
import {
  FICTIONAL_ORBITERS,
  fictionalOrbiterById,
  fictionalOrbiterStateById,
  isFictionalOrbiterId,
} from "./scene/fictional-orbiters";
import {
  APOLLO_COORDINATES_SOURCE_URL,
  apolloLandingSiteById,
  isApolloLandingSiteId,
} from "./scene/lunar-landing-sites";
import {
  bodyOrientationAngles,
  siderealRotationPeriodHours,
} from "./scene/orientation";
import type { SmallBodyGpuStatus } from "./scene/SmallBodyGpuLayer";
import { SchematicSystemMap } from "./scene/SchematicSystemMap";
import {
  surfaceObserverBodies,
  surfaceObserverFrame,
  type SurfaceObserverConfiguration,
} from "./scene/surface-observer";
import {
  nasaMaterialPresentationByBodyId,
  nasaTextureByBodyId,
} from "./scene/visual-assets";
import {
  VISUAL_QUALITY_PROFILES,
  type VisualQuality,
} from "./scene/visual-quality";
import {
  DEFAULT_OBJECT_VISIBILITY,
  type ObjectVisibility,
} from "./scene/visibility";
import type {
  ReferenceFrame,
  SemanticZoomLevel,
  ViewMode,
} from "./scene/view-mode";
import type { WayfinderMode } from "./scene/wayfinder";
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
const MANUAL_CAMERA_TRANSITION_DURATION_MS = 12_000;
const ORIENTATION_CAMERA_TRANSITION_DURATION_MS = 4_000;
const CAMERA_ZOOM_PRESETS = [
  { id: "system", label: "System context (0.063x)", zoom: 0.0625 },
  { id: "wide", label: "Wide (0.25x)", zoom: 0.25 },
  { id: "fit", label: "Fit object (1x)", zoom: 1 },
  { id: "close", label: "Close (4x)", zoom: 4 },
  { id: "detail", label: "Surface detail (16x)", zoom: 16 },
  { id: "inspection", label: "Inspection (64x)", zoom: 64 },
] as const;
const SEMANTIC_ZOOM_LABELS: Readonly<Record<SemanticZoomLevel, string>> = {
  interstellar: "Interstellar",
  "oort-cloud": "Oort Cloud",
  heliosphere: "Heliosphere",
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

const FOCUS_SYSTEM_KEY = "__solar-system__";
type FocusOption = Readonly<{
  id: string;
  key: string;
  label: string;
  group: string;
  searchText: string;
  disabled: boolean;
}>;
const FOCUS_OPTIONS: readonly FocusOption[] = [
  {
    id: "",
    key: FOCUS_SYSTEM_KEY,
    label: "Solar System",
    group: "Overview",
    searchText: "Solar System overview home all planets",
    disabled: false,
  },
  ...majorBodySnapshot.bodies.map((body) => ({
    id: body.id,
    key: body.id,
    label: body.name,
    group:
      body.id === "sun"
        ? "Star"
        : PLANET_FOCUS_ORDER.some((id) => id === body.id)
          ? "Planets"
          : "Major bodies",
    searchText: `${body.name} ${body.id}`,
    disabled: false,
  })),
  ...additionalKnownSatellites.map((body) => {
    const parentName = majorBodySnapshot.bodies.find(
      (candidate) => candidate.id === body.parentId,
    )?.name;
    return {
      id: body.id,
      key: body.id,
      label: `${body.name} (${parentName ?? body.parentId})${
        body.availability === "unavailable" ? " - unavailable at epoch" : ""
      }`,
      group: `${parentName ?? body.parentId} moons`,
      searchText: `${body.name} ${body.id} ${parentName ?? body.parentId} moon satellite`,
      disabled: body.availability === "unavailable",
    };
  }),
  {
    id: ISS_BODY_ID,
    key: ISS_BODY_ID,
    label: "International Space Station (Earth)",
    group: "Spacecraft",
    searchText: "International Space Station ISS Earth spacecraft satellite",
    disabled: false,
  },
  ...voyagerSnapshot.probes.map((probe) => ({
    id: probe.id,
    key: probe.id,
    label: `${probe.name} (interstellar space)`,
    group: "Spacecraft",
    searchText: `${probe.name} ${probe.id} probe interstellar spacecraft`,
    disabled: false,
  })),
  ...operationalSpacecraftSnapshot.spacecraft.map((spacecraft) => ({
    id: spacecraft.id,
    key: spacecraft.id,
    label: spacecraft.name,
    group: "Spacecraft",
    searchText: `${spacecraft.name} ${spacecraft.id} ${spacecraft.id === "roadster" ? "Tesla Starman Falcon Heavy car" : "telescope"} spacecraft`,
    disabled: false,
  })),
  {
    id: JOVIAN_MONOLITH_BODY_ID,
    key: JOVIAN_MONOLITH_BODY_ID,
    label: JOVIAN_MONOLITH_NAME,
    group: "Fictional references",
    searchText:
      "Jovian Monolith TMA-2 2001 2010 Space Odyssey Jupiter Io L1 fictional",
    disabled: false,
  },
  ...FICTIONAL_ORBITERS.map((orbiter) => ({
    id: orbiter.id,
    key: orbiter.id,
    label: orbiter.name,
    group: "Fictional references",
    searchText: `${orbiter.name} Star Wars ${orbiter.parentBodyId} fictional battle station`,
    disabled: false,
  })),
];

const NAVIGABLE_FOCUS_OPTIONS = FOCUS_OPTIONS.filter(
  (option) => option.id !== "" && !option.disabled,
);

const FOCUS_GROUPS = Array.from(
  new Set(FOCUS_OPTIONS.map((option) => option.group)),
).map((label) => ({
  label,
  options: FOCUS_OPTIONS.filter((option) => option.group === label),
}));

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
  const [filteredOptions, setFilteredOptions] = useState<FocusOption[]>([
    ...FOCUS_OPTIONS,
  ]);
  const resetFilteredOptions = (): void => {
    setFilteredOptions([...FOCUS_OPTIONS]);
  };
  const selectTypedOption = (candidate: string): boolean => {
    const normalizedCandidate = candidate.trim().toLocaleLowerCase();
    const option = FOCUS_OPTIONS.find(
      (focusOption) =>
        focusOption.label.toLocaleLowerCase() === normalizedCandidate &&
        !focusOption.disabled,
    );
    if (option === undefined) return false;
    onSelect(option.id);
    return true;
  };
  const {
    getInputProps,
    getItemProps,
    getLabelProps,
    getMenuProps,
    getToggleButtonProps,
    closeMenu,
    isOpen,
    openMenu,
  } = useCombobox<FocusOption>({
    items: filteredOptions,
    selectedItem: selectedOption,
    itemToString: (item) => item?.label ?? "",
    isItemDisabled: (item) => item.disabled,
    defaultHighlightedIndex: 0,
    onInputValueChange: ({ inputValue }) => {
      const normalizedInput = inputValue.toLocaleLowerCase();
      setFilteredOptions(
        FOCUS_OPTIONS.filter((option) =>
          option.searchText.toLocaleLowerCase().includes(normalizedInput),
        ),
      );
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem !== null) {
        onSelect(selectedItem.id);
      }
    },
  });
  return (
    <div className="focus-control">
      <label {...getLabelProps()}>Focus</label>
      <div className="focus-input-group">
        <input
          {...getInputProps({
            "aria-label": "Focus",
            spellCheck: false,
            onFocus: () => {
              resetFilteredOptions();
              openMenu();
            },
            onKeyDown: (event) => {
              if (event.key === "ArrowDown" && !isOpen) {
                resetFilteredOptions();
              }
              if (
                event.key === "Enter" &&
                selectTypedOption(event.currentTarget.value)
              ) {
                event.preventDefault();
                (
                  event.nativeEvent as KeyboardEvent & {
                    preventDownshiftDefault?: boolean;
                  }
                ).preventDownshiftDefault = true;
                closeMenu();
              }
            },
          })}
        />
        <button
          type="button"
          aria-label="Open focus list"
          {...getToggleButtonProps({
            onClick: resetFilteredOptions,
          })}
        >
          ⌄
        </button>
      </div>
      <ul
        {...getMenuProps()}
        className="focus-popover focus-listbox"
        hidden={!isOpen}
      >
        {FOCUS_GROUPS.map((group) => {
          const visibleOptions = group.options.filter((option) =>
            filteredOptions.includes(option),
          );
          return visibleOptions.length === 0 ? null : (
            <li className="focus-list-group" key={group.label} role="group">
              <span className="focus-list-header" role="presentation">
                {group.label}
              </span>
              <ul role="presentation">
                {visibleOptions.map((option) => (
                  <li
                    key={option.key}
                    {...getItemProps({
                      item: option,
                      index: filteredOptions.indexOf(option),
                    })}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
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

function formatLocalSolarTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60) % (24 * 60);
  const normalizedMinutes = (totalMinutes + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatAngularDiameter(degrees: number): string {
  if (degrees >= 1) {
    return `${degrees.toLocaleString(undefined, { maximumFractionDigits: 2 })}°`;
  }
  const arcminutes = degrees * 60;
  if (arcminutes >= 1) {
    return `${arcminutes.toLocaleString(undefined, { maximumFractionDigits: 2 })}′`;
  }
  return `${(arcminutes * 60).toLocaleString(undefined, { maximumFractionDigits: 2 })}″`;
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
      const nextState = interpolateDisplayedSimulationFrame(frame, fraction);
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
  const [selectedBodyId, setSelectedBodyId] = useState("");
  const [showMoonTrail, setShowMoonTrail] = useState(false);
  const [showPlanetTrails, setShowPlanetTrails] = useState(false);
  const [showMinorBodyTrails, setShowMinorBodyTrails] = useState(false);
  const [referenceFrame, setReferenceFrame] =
    useState<ReferenceFrame>("heliocentric");
  const [trailDurationDays, setTrailDurationDays] = useState(365);
  const [trailFadePercent, setTrailFadePercent] = useState(85);
  const [clearTrailsToken, setClearTrailsToken] = useState(0);
  const [showEclipticPlane, setShowEclipticPlane] = useState(false);
  const [showZodiac, setShowZodiac] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showApolloSites, setShowApolloSites] = useState(true);
  const [apolloInspectionSiteId, setApolloInspectionSiteId] = useState<
    string | null
  >(null);
  const [showTacticalOverlay, setShowTacticalOverlay] = useState(false);
  const [showOrbitGuides, setShowOrbitGuides] = useState(false);
  const [wayfinderMode, setWayfinderMode] = useState<WayfinderMode>("sun");
  const [gravityWellMode, setGravityWellMode] =
    useState<GravityWellMode>("off");
  const [gravityWellScale, setGravityWellScale] =
    useState<GravityWellScale>("local");
  const [semanticZoom, setSemanticZoom] =
    useState<SemanticZoomLevel>("solar-system");
  const [resetViewToken, setResetViewToken] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_CAMERA_ZOOM);
  const [viewMagnification, setViewMagnification] =
    useState(DEFAULT_CAMERA_ZOOM);
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
  const [surfaceObserverEnabled, setSurfaceObserverEnabled] = useState(false);
  const [surfaceObserverBodyId, setSurfaceObserverBodyId] = useState("earth");
  const [surfaceObserverTargetBodyId, setSurfaceObserverTargetBodyId] =
    useState("sun");
  const [surfaceObserverLatitudeDeg, setSurfaceObserverLatitudeDeg] =
    useState(51.4779);
  const [surfaceObserverLongitudeDeg, setSurfaceObserverLongitudeDeg] =
    useState(0);
  const [surfaceObserverLookResetToken, setSurfaceObserverLookResetToken] =
    useState(0);
  const [visualQuality, setVisualQuality] =
    useState<VisualQuality>("photographic");
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string>();
  const [objectVisibility, setObjectVisibility] = useState<ObjectVisibility>(
    DEFAULT_OBJECT_VISIBILITY,
  );
  const [gpuStatus, setGpuStatus] = useState<SmallBodyGpuStatus>();
  const [gpuError, setGpuError] = useState<string>();
  const [simulationRunToken, setSimulationRunToken] = useState(0);
  const playingRef = useRef(playing);
  const directionRef = useRef(direction);
  const timeRateIndexRef = useRef(timeRateIndex);
  const manualDeltaSecondsRef = useRef(0);
  const directSeekTimeSecondsRef = useRef<number | undefined>(undefined);
  const focusBodyIdRef = useRef(focusBodyId);
  const focusHistoryRef = useRef<string[]>([]);
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const displayPanelRef = useRef<HTMLElement>(null);
  const displayPanelWasOpenRef = useRef(false);
  const appShellRef = useRef<HTMLElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const immersiveExitButtonRef = useRef<HTMLButtonElement>(null);
  playingRef.current = playing;
  directionRef.current = direction;
  timeRateIndexRef.current = timeRateIndex;
  focusBodyIdRef.current = focusBodyId;

  const surfaceObserverConfiguration =
    useMemo<SurfaceObserverConfiguration | null>(
      () =>
        surfaceObserverEnabled
          ? {
              bodyId: surfaceObserverBodyId,
              latitudeDeg: surfaceObserverLatitudeDeg,
              longitudeDeg: surfaceObserverLongitudeDeg,
              targetBodyId: surfaceObserverTargetBodyId,
            }
          : null,
      [
        surfaceObserverBodyId,
        surfaceObserverEnabled,
        surfaceObserverLatitudeDeg,
        surfaceObserverLongitudeDeg,
        surfaceObserverTargetBodyId,
      ],
    );
  const surfaceObservation = useMemo(
    () =>
      state === undefined || surfaceObserverConfiguration === null
        ? undefined
        : surfaceObserverFrame(state, surfaceObserverConfiguration),
    [state, surfaceObserverConfiguration],
  );

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
    const handleFullscreenChange = (): void => {
      const isImmersive = document.fullscreenElement === appShellRef.current;
      setImmersiveMode(isImmersive);
      if (isImmersive) {
        setControlPanelOpen(false);
        requestAnimationFrame(() => immersiveExitButtonRef.current?.focus());
        return;
      }
      if (document.fullscreenElement === null) {
        requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterImmersiveMode = (): void => {
    const appShell = appShellRef.current;
    if (appShell === null) {
      throw new Error("Application shell is unavailable for fullscreen mode");
    }
    setFullscreenError(undefined);
    void appShell
      .requestFullscreen({ navigationUI: "hide" })
      .catch((fullscreenFailure: unknown) => {
        setFullscreenError(
          fullscreenFailure instanceof Error
            ? `Fullscreen failed: ${fullscreenFailure.message}`
            : "Fullscreen failed for an unknown browser reason",
        );
      });
  };

  const exitImmersiveMode = (): void => {
    setFullscreenError(undefined);
    if (document.fullscreenElement !== appShellRef.current) {
      throw new Error("The Solar System Explorer is not fullscreen");
    }
    void document.exitFullscreen().catch((fullscreenFailure: unknown) => {
      setFullscreenError(
        fullscreenFailure instanceof Error
          ? `Leaving fullscreen failed: ${fullscreenFailure.message}`
          : "Leaving fullscreen failed for an unknown browser reason",
      );
    });
  };

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
        const rawInitialState = await client.api.initialize(majorBodySystem);
        let previousState = withKnownSatellites(rawInitialState);
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
          const directSeekTimeSeconds = directSeekTimeSecondsRef.current;
          if (directSeekTimeSeconds !== undefined) {
            directSeekTimeSecondsRef.current = undefined;
            const rawNextState = await client.api.integrateTo(
              directSeekTimeSeconds,
            );
            solverTime = rawNextState.timeSeconds;
            const nextState = withKnownSatellites(rawNextState);
            previousState = nextState;
            resetMeasuredRate(nextState.timeSeconds);
            if (isActive()) {
              setFrame({
                start: nextState,
                end: nextState,
                transitionDurationMs: 0,
              });
              setSeeking(false);
              setPlaybackBuffered(false);
            }
            continue;
          }
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
  }, [simulationRunToken]);

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
    setSurfaceObserverEnabled(false);
    setTourPlaying(false);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation(
      focusBodyIdRef.current === "" ? "perspective" : "sun-facing",
    );
    setTourTransitionDurationMs(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : ORIENTATION_CAMERA_TRANSITION_DURATION_MS,
    );
    setTourTransitionSequence((current) => current + 1);
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
    setTourTransitionDurationMs(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : ORIENTATION_CAMERA_TRANSITION_DURATION_MS,
    );
    setResetViewToken((current) => current + 1);
    setTourTransitionSequence((current) => current + 1);
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

  const handleSceneBodySelection = useCallback((bodyId: string): void => {
    setApolloInspectionSiteId(null);
    setSelectedBodyId(bodyId);
  }, []);

  const navigateToFocus = useCallback(
    (bodyId: string): void => {
      setApolloInspectionSiteId(null);
      setTourPlaying(false);
      setTourStepIndex(null);
      if (tourStepIndex !== null) {
        setPlaying(false);
      }
      const currentBodyId = focusBodyIdRef.current;
      setSelectedBodyId(bodyId);
      if (bodyId === currentBodyId) {
        setCameraZoom(DEFAULT_CAMERA_ZOOM);
        setCameraOrientation(bodyId === "" ? "perspective" : "sun-facing");
        issueCameraNavigation("fit-selection");
        return;
      }
      focusHistoryRef.current.push(currentBodyId);
      focusBodyIdRef.current = bodyId;
      setFocusBodyId(bodyId);
      setTourTransitionDurationMs(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : MANUAL_CAMERA_TRANSITION_DURATION_MS,
      );
      setResetViewToken((current) => current + 1);
      setTourTransitionSequence((current) => current + 1);
      if (bodyId === ISS_BODY_ID) {
        const currentTime = displayedStateRef.current?.timeSeconds ?? 0;
        if (!isIssEphemerisWithinValidity(currentTime)) {
          playingRef.current = false;
          setPlaying(false);
          manualDeltaSecondsRef.current = 0;
          directSeekTimeSecondsRef.current = ISS_EPOCH_SIMULATION_SECONDS;
          setSeeking(true);
          setSimulationRunToken((current) => current + 1);
        }
      }
      if (isOperationalSpacecraftBodyId(bodyId)) {
        const currentTime = displayedStateRef.current?.timeSeconds ?? 0;
        if (!isOperationalSpacecraftWithinValidity(bodyId, currentTime)) {
          playingRef.current = false;
          setPlaying(false);
          manualDeltaSecondsRef.current = 0;
          directSeekTimeSecondsRef.current =
            operationalSpacecraftRecommendedTimeSeconds(bodyId);
          setSeeking(true);
          setSimulationRunToken((current) => current + 1);
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
        setCameraOrientation("sun-facing");
      }
    },
    [issueCameraNavigation, tourStepIndex],
  );

  const navigateBack = (): void => {
    setSurfaceObserverEnabled(false);
    setTourPlaying(false);
    setTourStepIndex(null);
    setPlaying(false);
    const previousBodyId = focusHistoryRef.current.pop();
    if (previousBodyId === undefined) {
      return;
    }
    focusBodyIdRef.current = previousBodyId;
    setFocusBodyId(previousBodyId);
    setSelectedBodyId(previousBodyId);
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
    if (selectedBodyId === "") {
      return;
    }
    if (isApolloLandingSiteId(selectedBodyId)) {
      setSelectedBodyId("moon");
      return;
    }
    const parentId =
      (selectedBodyId === ISS_BODY_ID ? ISS_PARENT_BODY_ID : undefined) ??
      (selectedBodyId === "hubble" ? "earth" : undefined) ??
      (selectedBodyId === "jwst" || isVoyagerBodyId(selectedBodyId)
        ? "sun"
        : undefined) ??
      (selectedBodyId === JOVIAN_MONOLITH_BODY_ID ? "jupiter" : undefined) ??
      (isFictionalOrbiterId(selectedBodyId)
        ? fictionalOrbiterById.get(selectedBodyId)?.parentBodyId
        : undefined) ??
      knownSatelliteById.get(selectedBodyId)?.parentId ??
      PARENT_BODY_ID[selectedBodyId] ??
      "";
    setSelectedBodyId(parentId);
  };

  const navigateToNextObject = (): void => {
    const currentIndex = NAVIGABLE_FOCUS_OPTIONS.findIndex(
      (option) => option.id === selectedBodyId,
    );
    const nextIndex = (currentIndex + 1) % NAVIGABLE_FOCUS_OPTIONS.length;
    setSelectedBodyId(NAVIGABLE_FOCUS_OPTIONS[nextIndex]?.id ?? "sun");
  };

  const navigateHome = (): void => {
    setSurfaceObserverEnabled(false);
    setTourPlaying(false);
    setPlaying(false);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("perspective");
    if (focusBodyIdRef.current === "") {
      issueCameraNavigation("fit-selection");
      setSelectedBodyId("");
      return;
    }
    navigateToFocus("");
  };

  const recenterView = (): void => {
    requestResetView();
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
    setSurfaceObserverEnabled(false);
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

  const enterSurfaceObserver = (): void => {
    setTourPlaying(false);
    setTourStepIndex(null);
    setViewMode("reality");
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("custom");
    navigateToFocus(surfaceObserverBodyId);
    setSurfaceObserverEnabled(true);
    setControlPanelOpen(false);
  };

  const focusApolloLandingSite = (siteId: string): void => {
    if (!isApolloLandingSiteId(siteId)) {
      throw new Error(`Apollo landing site ${siteId} is unavailable`);
    }
    setShowApolloSites(true);
    setSurfaceObserverEnabled(false);
    setApolloInspectionSiteId(siteId);
    if (focusBodyIdRef.current !== "moon") {
      focusHistoryRef.current.push(focusBodyIdRef.current);
      focusBodyIdRef.current = "moon";
      setFocusBodyId("moon");
    }
    setSelectedBodyId(siteId);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("sun-facing");
    setTourTransitionDurationMs(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : ORIENTATION_CAMERA_TRANSITION_DURATION_MS,
    );
    setResetViewToken((current) => current + 1);
    setTourTransitionSequence((current) => current + 1);
  };

  const enterApolloLandingSiteObserver = (siteId: string): void => {
    if (!isApolloLandingSiteId(siteId)) {
      throw new Error(`Apollo landing site ${siteId} is unavailable`);
    }
    const site = apolloLandingSiteById.get(siteId);
    if (site === undefined) {
      throw new Error(`Apollo landing site ${siteId} has no installed data`);
    }
    setTourPlaying(false);
    setTourStepIndex(null);
    setShowApolloSites(true);
    setApolloInspectionSiteId(null);
    setViewMode("reality");
    setSurfaceObserverBodyId("moon");
    setSurfaceObserverTargetBodyId("earth");
    setSurfaceObserverLatitudeDeg(site.latitudeDeg);
    setSurfaceObserverLongitudeDeg(site.longitudeDeg);
    navigateToFocus("moon");
    setSelectedBodyId(site.id);
    setCameraZoom(DEFAULT_CAMERA_ZOOM);
    setCameraOrientation("custom");
    setSurfaceObserverEnabled(true);
    setSurfaceObserverLookResetToken((current) => current + 1);
    setControlPanelOpen(false);
  };

  const exitSurfaceObserver = (): void => {
    setSurfaceObserverEnabled(false);
    setCameraOrientation("sun-facing");
    setResetViewToken((current) => current + 1);
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
    setTourTransitionDurationMs(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : SCALE_TOUR_TRANSITION_DURATION_MS,
    );
    focusHistoryRef.current = [];
    focusBodyIdRef.current = step.focusBodyId;
    setFocusBodyId(step.focusBodyId);
    setSelectedBodyId(step.focusBodyId);
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

  useEffect(() => {
    if (activeTourStep === undefined || !audio.settings.narrationEnabled) {
      audio.clearNarration();
      return;
    }
    audio.loadNarration(activeTourStep.narration.audioSource, tourPlaying);
  }, [
    activeTourStep?.id,
    audio.clearNarration,
    audio.loadNarration,
    audio.settings.narrationEnabled,
  ]);

  useEffect(() => {
    audio.setNarrationPlaying(tourPlaying);
  }, [audio.setNarrationPlaying, tourPlaying]);

  const activeZoomPreset =
    CAMERA_ZOOM_PRESETS.find(
      (preset) => Math.abs(Math.log2(preset.zoom / viewMagnification)) < 0.01,
    )?.id ?? "custom";

  const setRequestedViewMagnification = (requested: number): void => {
    if (
      !Number.isFinite(requested) ||
      requested < 2 ** -32 ||
      requested > 128
    ) {
      throw new Error("View magnification must be between 2^-32x and 128x");
    }
    setCameraZoom(requested);
    setViewMagnification(requested);
  };

  const selectedTimeRate = TIME_RATES[timeRateIndex];
  if (selectedTimeRate === undefined) {
    throw new Error("Selected simulation time rate is unavailable");
  }

  const selectedBodyDetail = useMemo(() => {
    if (selectedBodyId === "") {
      return undefined;
    }
    const bodyId = selectedBodyId;
    if (isApolloLandingSiteId(bodyId)) {
      const apolloSite = apolloLandingSiteById.get(bodyId);
      if (apolloSite === undefined) {
        throw new Error(`Apollo landing site ${bodyId} has no installed data`);
      }
      return {
        name: `${apolloSite.mission} · ${apolloSite.siteName}`,
        surface: `${apolloSite.lunarModule} descent stage and deployed equipment remain at the landing site`,
        parentName: "Moon",
        distanceLabel: "LRO landing coordinates",
        distance: `${Math.abs(apolloSite.latitudeDeg).toFixed(5)}° ${apolloSite.latitudeDeg < 0 ? "S" : "N"} · ${Math.abs(apolloSite.longitudeDeg).toFixed(5)}° ${apolloSite.longitudeDeg < 0 ? "W" : "E"}`,
        mass: "Not represented as a gravitational source",
        composition: {
          summary:
            "Lunar Module descent stage, scientific instruments, tracks and human-made surface artefacts",
          authority: "NASA Apollo by the Numbers and LROC",
          sourceUrl: APOLLO_COORDINATES_SOURCE_URL,
        },
        ephemerisStatus:
          "Moon-fixed planetocentric coordinates derived from Lunar Reconnaissance Orbiter imagery",
      };
    }
    if (state === undefined) {
      return undefined;
    }
    const definition = majorBodySnapshot.bodies.find(
      (body) => body.id === bodyId,
    );
    const isJovianMonolith = bodyId === JOVIAN_MONOLITH_BODY_ID;
    const isFictionalOrbiter = isFictionalOrbiterId(bodyId);
    const bodyState = isJovianMonolith
      ? jovianMonolithState(state)
      : isFictionalOrbiter
        ? fictionalOrbiterStateById(state, bodyId)
        : state.bodies.find((body) => body.id === bodyId);
    const knownSatellite = knownSatelliteById.get(bodyId);
    const isIss = bodyId === ISS_BODY_ID;
    const voyager = voyagerById.get(
      isVoyagerBodyId(bodyId) ? bodyId : "voyager-1",
    );
    const isVoyager = isVoyagerBodyId(bodyId);
    const operationalSpacecraft = operationalSpacecraftSnapshot.spacecraft.find(
      (spacecraft) => spacecraft.id === bodyId,
    );
    const isOperationalSpacecraft = isOperationalSpacecraftBodyId(bodyId);
    if (
      bodyState === undefined ||
      (definition === undefined &&
        knownSatellite === undefined &&
        !isIss &&
        !isVoyager &&
        !isOperationalSpacecraft &&
        !isJovianMonolith &&
        !isFictionalOrbiter)
    ) {
      return undefined;
    }
    const parentId = isJovianMonolith
      ? "jupiter"
      : isFictionalOrbiter
        ? fictionalOrbiterById.get(bodyId)?.parentBodyId
        : definition === undefined
          ? isIss
            ? ISS_PARENT_BODY_ID
            : isVoyager
              ? "sun"
              : (PARENT_BODY_ID[bodyId] ?? knownSatellite?.parentId)
          : PARENT_BODY_ID[bodyId];
    const parentState = state.bodies.find((body) => body.id === parentId);
    const parentDefinition = majorBodySnapshot.bodies.find(
      (body) => body.id === parentId,
    );
    const composition = BODY_COMPOSITION_BY_ID[bodyId];
    const speedLabel =
      parentDefinition === undefined
        ? undefined
        : `Speed relative to ${parentDefinition.name}`;
    if (isJovianMonolith) {
      return {
        name: JOVIAN_MONOLITH_NAME,
        surface:
          "Fictional black rectangular object from 2001 / 2010 · physical scale",
        parentName: parentDefinition?.name,
        distance:
          parentState === undefined
            ? undefined
            : formatDistance(
                bodyDistanceM(bodyState, parentState),
                semanticZoom,
              ),
        distanceLabel: "Distance from Jupiter",
        speed:
          parentState === undefined
            ? undefined
            : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
        speedLabel,
        mass: "Unknown · fictional",
        composition: {
          summary:
            "Unknown fictional material; the story does not provide a physical composition",
          authority: "NASA History Office - 2001: A Space Odyssey",
          sourceUrl:
            "https://www.nasa.gov/history/50-years-ago-1968-welcomed-2001/",
        },
        dimensionsM: `${JOVIAN_MONOLITH_DIMENSIONS_M.thickness.toFixed(1)} × ${JOVIAN_MONOLITH_DIMENSIONS_M.width.toFixed(1)} × ${JOVIAN_MONOLITH_DIMENSIONS_M.length.toLocaleString()} m · 1:4:9`,
        ephemerisStatus:
          "Display-only at the approximate live Jupiter-Io L1 point · excluded from gravity",
      };
    }
    if (isFictionalOrbiter) {
      const orbiter = fictionalOrbiterById.get(bodyId);
      if (orbiter === undefined) {
        throw new Error(`Fictional orbiter ${bodyId} is unavailable`);
      }
      return {
        name: orbiter.name,
        surface:
          orbiter.constructionState === "complete"
            ? "Original procedural complete battle-station visualization · physical scale"
            : "Original procedural incomplete battle-station visualization with exposed construction frame · physical scale",
        parentName: parentDefinition?.name,
        distance:
          parentState === undefined
            ? undefined
            : formatDistance(
                bodyDistanceM(bodyState, parentState),
                semanticZoom,
              ),
        distanceLabel: `Distance from ${parentDefinition?.name ?? orbiter.parentBodyId}`,
        speed:
          parentState === undefined
            ? undefined
            : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
        speedLabel:
          parentDefinition === undefined
            ? undefined
            : `Speed relative to ${parentDefinition.name}`,
        mass: "Fictional · treated as a massless visualization",
        composition: {
          summary:
            "Fictional armoured space station; no real mass or material properties are assigned",
          authority: "Star Wars Databank",
          sourceUrl: orbiter.sourceUrl,
        },
        dimensionsM: `${(orbiter.diameterM / 1_000).toLocaleString()} km diameter`,
        ephemerisStatus:
          "Hypothetical live circular two-body orbit using the moon's gravity · excluded from Solar System gravity",
      };
    }
    if (definition === undefined) {
      if (isOperationalSpacecraft) {
        if (operationalSpacecraft === undefined) {
          throw new Error(`Operational spacecraft ${bodyId} is unavailable`);
        }
        return {
          name: operationalSpacecraft.name,
          surface:
            bodyId === "roadster"
              ? "Original physical-scale Roadster and Starman reconstruction · Horizons tracks the complete attached payload stack"
              : "Official NASA 3D model · physical scale",
          parentName: parentDefinition?.name,
          distance:
            parentState === undefined
              ? undefined
              : formatDistance(
                  bodyDistanceM(bodyState, parentState),
                  semanticZoom,
                ),
          distanceLabel:
            bodyId === "hubble"
              ? "Distance from Earth"
              : "Distance from the Sun",
          speed:
            parentState === undefined
              ? undefined
              : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
          speedLabel:
            parentDefinition === undefined
              ? undefined
              : `Speed relative to ${parentDefinition.name}`,
          mass:
            bodyId === "roadster"
              ? `${formatMassKg(operationalSpacecraft.massKg)} Roadster only · complete attached stack mass is not installed`
              : formatMassKg(operationalSpacecraft.massKg),
          composition: BODY_COMPOSITION_BY_ID[bodyId],
          dimensionsM: `${String(operationalSpacecraft.maximumDimensionM)} m maximum dimension`,
          ephemerisStatus:
            bodyId === "roadster"
              ? "NASA/JPL Horizons solution 11 · 374 optical observations · includes measured solar-radiation-pressure acceleration · cubic Hermite interpolation through 2090"
              : "NASA/JPL Horizons trajectory · cubic Hermite interpolation within published coverage",
        };
      }
      if (isVoyager) {
        if (voyager === undefined) {
          throw new Error(`Voyager definition ${bodyId} is unavailable`);
        }
        return {
          name: voyager.name,
          surface: "Official NASA 3D model · physical scale",
          parentName: parentDefinition?.name,
          distance:
            parentState === undefined
              ? undefined
              : formatDistance(
                  bodyDistanceM(bodyState, parentState),
                  semanticZoom,
                ),
          distanceLabel: "Distance from the Sun",
          speed:
            parentState === undefined
              ? undefined
              : bodyRelativeSpeedMps(bodyState, parentState) / 1_000,
          speedLabel: "Speed relative to the Sun",
          mass: formatMassKg(voyager.massKg),
          composition: BODY_COMPOSITION_BY_ID[bodyId],
          dimensionsM: `${String(voyager.maximumDimensionM)} m span · ${String(voyager.highGainAntennaDiameterM)} m antenna`,
          ephemerisStatus:
            "JPL Horizons 2026 barycentric state · REBOUND massless test-particle propagation",
        };
      }
      if (isIss) {
        return {
          name: "International Space Station",
          surface: "Official NASA 3D model · physical scale · SGP4 trajectory",
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
        name: knownSatellite?.name ?? bodyId,
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
  }, [selectedBodyId, semanticZoom, state]);

  const selectedApolloSite = isApolloLandingSiteId(selectedBodyId)
    ? apolloLandingSiteById.get(selectedBodyId)
    : undefined;

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
  const focusedVoyager = isVoyagerBodyId(focusBodyId)
    ? voyagerById.get(focusBodyId)
    : undefined;
  const focusedParentId =
    (focusBodyId === ISS_BODY_ID ? ISS_PARENT_BODY_ID : undefined) ??
    (focusBodyId === JOVIAN_MONOLITH_BODY_ID ? "jupiter" : undefined) ??
    (isFictionalOrbiterId(focusBodyId)
      ? fictionalOrbiterById.get(focusBodyId)?.parentBodyId
      : undefined) ??
    focusedKnownSatellite?.parentId ??
    PARENT_BODY_ID[focusBodyId];
  const focusedParentName = majorBodySnapshot.bodies.find(
    (body) => body.id === focusedParentId,
  )?.name;
  const outsideValidatedWindow =
    Math.abs(state?.timeSeconds ?? 0) > 365 * DAY_SECONDS;

  return (
    <main
      ref={appShellRef}
      className={`app-shell${immersiveMode ? " is-immersive" : ""}`}
      data-immersive-mode={String(immersiveMode)}
      data-view-mode={viewMode}
      data-audio-state={audio.status}
      data-narration-state={audio.narrationStatus}
      data-tour-presentation={activeTourStep?.presentation}
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
                    setSurfaceObserverEnabled(false);
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
        <FocusSelect
          value={focusBodyId}
          onSelect={(bodyId) => {
            setSurfaceObserverEnabled(false);
            navigateToFocus(bodyId);
          }}
        />
        <div className="command-actions">
          <button type="button" onClick={requestResetView}>
            Reset
          </button>
          <button
            ref={fullscreenButtonRef}
            type="button"
            className="fullscreen-button"
            aria-pressed={immersiveMode}
            onClick={enterImmersiveMode}
          >
            Full screen
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

      {immersiveMode ? (
        <button
          ref={immersiveExitButtonRef}
          type="button"
          className="immersive-exit-button"
          onClick={exitImmersiveMode}
        >
          Exit full screen
        </button>
      ) : null}

      <section className="workspace">
        {fullscreenError === undefined ? null : (
          <p className="fullscreen-error error" role="alert">
            {fullscreenError}
          </p>
        )}
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
                  focusedVoyager?.name ??
                  (focusBodyId === JOVIAN_MONOLITH_BODY_ID
                    ? JOVIAN_MONOLITH_NAME
                    : undefined) ??
                  (isFictionalOrbiterId(focusBodyId)
                    ? fictionalOrbiterById.get(focusBodyId)?.name
                    : undefined) ??
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
            Simulation stopped: {error}{" "}
            <button
              type="button"
              onClick={() => {
                manualDeltaSecondsRef.current = 0;
                directSeekTimeSecondsRef.current = undefined;
                setSeeking(false);
                setPlaybackBuffered(false);
                setError(undefined);
                setSimulationRunToken((current) => current + 1);
              }}
            >
              Restart simulation
            </button>
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
              selectedBodyId={selectedBodyId === "" ? null : selectedBodyId}
              apolloInspectionSiteId={apolloInspectionSiteId}
              showMoonTrail={showMoonTrail}
              showPlanetTrails={showPlanetTrails}
              showMinorBodyTrails={showMinorBodyTrails}
              referenceFrame={referenceFrame}
              trailDurationSeconds={trailDurationDays * DAY_SECONDS}
              trailFade={trailFadePercent / 100}
              clearTrailsToken={clearTrailsToken}
              showEclipticPlane={showEclipticPlane}
              showZodiac={showZodiac}
              showLabels={showLabels}
              showApolloSites={showApolloSites}
              spacecraftLabelBodyIds={
                activeTourStep === undefined
                  ? undefined
                  : (activeTourStep.spacecraftLabelBodyIds ?? [])
              }
              showTacticalOverlay={showTacticalOverlay}
              showOrbitGuides={showOrbitGuides}
              wayfinderMode={wayfinderMode}
              orbitGuideScope={
                activeTourStep?.overlays.orbitGuideScope ?? "all"
              }
              gravityWellMode={gravityWellMode}
              gravityWellScale={gravityWellScale}
              resetViewToken={resetViewToken}
              cameraZoom={cameraZoom}
              cameraDistanceOverrideAu={
                typeof activeTourStep?.cameraDistanceAu === "number"
                  ? activeTourStep.cameraDistanceAu
                  : undefined
              }
              cameraTargetBodyId={activeCameraTargetBodyId}
              cameraTransitionSequence={tourTransitionSequence}
              cameraTransitionDurationMs={tourTransitionDurationMs}
              cameraTransitionAutoFrame={activeTourStep === undefined}
              cameraTransitionOverviewAnchorBodyId={
                activeTourStep?.transitionOverviewAnchorBodyId
              }
              cameraTransitionOverviewDistanceAu={
                activeTourStep?.transitionOverviewDistanceAu ??
                (focusBodyId === "" || focusBodyId === "sun"
                  ? 90
                  : focusBodyId === ISS_BODY_ID ||
                      isVoyagerBodyId(focusBodyId) ||
                      isOperationalSpacecraftBodyId(focusBodyId)
                    ? 0.000_001
                    : 0.01)
              }
              cameraNavigationCommand={cameraNavigationCommand}
              orientationPreset={cameraOrientation}
              orientationPresetToken={orientationPresetToken}
              viewMode={viewMode}
              objectVisibility={objectVisibility}
              surfaceObserver={surfaceObserverConfiguration}
              surfaceObserverLookResetToken={surfaceObserverLookResetToken}
              visualQuality={visualQuality}
              deepSpacePresentation={activeTourStep?.presentation}
              onSelectBody={handleSceneBodySelection}
              onFocusBody={navigateToFocus}
              onOrientationChange={handleSceneOrientationChange}
              onSemanticZoomChange={setSemanticZoom}
              onViewZoomChange={setViewMagnification}
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
              disabled={viewMode === "schematic" || surfaceObserverEnabled}
              onClick={() => handleCameraNavigation("zoom-out")}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={viewMode === "schematic" || surfaceObserverEnabled}
              onClick={() => handleCameraNavigation("zoom-in")}
            >
              +
            </button>
            <button
              type="button"
              disabled={viewMode === "schematic" || surfaceObserverEnabled}
              title="Restore the selected focus to its default framing"
              onClick={recenterView}
            >
              Re-centre
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

        {surfaceObservation === undefined ? null : (
          <aside
            className="surface-observer-hud"
            aria-label="Surface observer measurements"
            data-surface-observer-body={surfaceObserverBodyId}
            data-surface-observer-target={surfaceObserverTargetBodyId}
          >
            <div className="surface-observer-heading">
              <div>
                <span>Surface observer</span>
                <strong>
                  {surfaceObservation.observerName} ·{" "}
                  {surfaceObserverLatitudeDeg.toFixed(4)}°,{" "}
                  {surfaceObserverLongitudeDeg.toFixed(4)}° E
                </strong>
              </div>
              <button type="button" onClick={exitSurfaceObserver}>
                Exit
              </button>
            </div>
            <label className="surface-target-control">
              Look at
              <select
                value={surfaceObserverTargetBodyId}
                onChange={(event) =>
                  setSurfaceObserverTargetBodyId(event.currentTarget.value)
                }
              >
                {majorBodySnapshot.bodies
                  .filter((body) => body.id !== surfaceObserverBodyId)
                  .map((body) => (
                    <option key={body.id} value={body.id}>
                      {body.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="surface-centre-target"
              onClick={() =>
                setSurfaceObserverLookResetToken((current) => current + 1)
              }
            >
              Centre target
            </button>
            <div className="surface-compass" aria-label="Local compass">
              <span className="surface-compass-target" aria-hidden="true">
                <i
                  style={{
                    left: `${String(surfaceObservation.targetAzimuthDeg / 3.6)}%`,
                  }}
                />
              </span>
              <span>N</span>
              <span>E</span>
              <span>S</span>
              <span>W</span>
              <span>N</span>
            </div>
            <div className="surface-observer-metrics">
              <span>
                <small>{surfaceObservation.targetName} position</small>
                {surfaceObservation.targetAltitudeDeg.toFixed(2)}° altitude ·{" "}
                {surfaceObservation.targetAzimuthDeg.toFixed(2)}° azimuth
              </span>
              <span>
                <small>Apparent diameter</small>
                {formatAngularDiameter(
                  surfaceObservation.targetAngularDiameterDeg,
                )}
              </span>
              {surfaceObservation.targetIlluminatedFraction ===
              undefined ? null : (
                <span>
                  <small>Illuminated disc</small>
                  {(surfaceObservation.targetIlluminatedFraction * 100).toFixed(
                    1,
                  )}
                  %
                </span>
              )}
              <span>
                <small>North-pole position angle</small>
                {surfaceObservation.targetNorthPolePositionAngleDeg.toFixed(2)}°
              </span>
              {surfaceObservation.brightLimbPositionAngleDeg ===
              undefined ? null : (
                <span>
                  <small>Bright-limb position angle</small>
                  {surfaceObservation.brightLimbPositionAngleDeg.toFixed(2)}°
                </span>
              )}
              <span>
                <small>Local solar time</small>
                {formatLocalSolarTime(surfaceObservation.localSolarTimeHours)}
              </span>
              <span>
                <small>Sun</small>
                {surfaceObservation.sunAltitudeDeg.toFixed(2)}° altitude ·{" "}
                {formatAngularDiameter(
                  surfaceObservation.sunAngularDiameterDeg,
                )}
              </span>
              <span>
                <small>Sunrise and sunset</small>
                {surfaceObservation.solarHorizonEvents.regime === "normal"
                  ? `${formatLocalSolarTime(
                      surfaceObservation.solarHorizonEvents
                        .sunriseLocalSolarHours,
                    )} / ${formatLocalSolarTime(
                      surfaceObservation.solarHorizonEvents
                        .sunsetLocalSolarHours,
                    )} local solar time`
                  : surfaceObservation.solarHorizonEvents.regime === "polar-day"
                    ? "Sun remains above the geometric horizon"
                    : "Sun remains below the geometric horizon"}
              </span>
              <span>
                <small>Geometric horizon</small>
                {surfaceObservation.targetAltitudeDeg >= 0
                  ? `${surfaceObservation.targetName} is above it`
                  : `${surfaceObservation.targetName} is below it`}
                {" · "}
                {(surfaceObservation.geometricHorizonDistanceM / 1_000).toFixed(
                  2,
                )}{" "}
                km away
              </span>
            </div>
            <small className="surface-observer-disclosure">
              Mean-radius reference sphere · 2 m eye height · geometric horizon
              · no terrain, atmosphere or refraction
            </small>
          </aside>
        )}

        {activeTourStep === undefined || tourStepIndex === null ? null : (
          <aside
            className="scale-tour"
            role="dialog"
            aria-modal="false"
            aria-label="Scale of the Solar System tour"
            data-tour-step={activeTourStep.id}
            data-tour-playing={String(tourPlaying)}
            data-tour-narration-state={audio.narrationStatus}
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
        activeTourStep !== undefined ||
        surfaceObserverEnabled ? null : (
          <aside className="selected-body-detail">
            <div className="selected-body-heading">
              <div>
                <span>
                  {selectedApolloSite === undefined
                    ? "Selected body"
                    : "Apollo landing site"}
                </span>
                <strong>{selectedBodyDetail.name}</strong>
              </div>
              <div className="selected-body-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() =>
                    selectedApolloSite === undefined
                      ? navigateToFocus(selectedBodyId)
                      : focusApolloLandingSite(selectedApolloSite.id)
                  }
                >
                  {selectedApolloSite === undefined ? "Focus" : "Show on Moon"}
                </button>
                {selectedApolloSite === undefined ? (
                  <>
                    <button type="button" onClick={navigateToParent}>
                      Parent
                    </button>
                    <button type="button" onClick={navigateToNextObject}>
                      Next object
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      enterApolloLandingSiteObserver(selectedApolloSite.id)
                    }
                  >
                    Stand at site
                  </button>
                )}
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
              {selectedApolloSite === undefined ? null : (
                <span className="apollo-mission-detail">
                  <small>Mission record</small>
                  <strong>
                    Landed {selectedApolloSite.landingDateUtc} · Lunar Module{" "}
                    {selectedApolloSite.lunarModule}
                  </strong>
                  <span>
                    Moonwalkers: {selectedApolloSite.moonwalkers.join(" and ")}
                  </span>
                  <span>
                    Command Module Pilot:{" "}
                    {selectedApolloSite.commandModulePilot}
                  </span>
                  <span>
                    {selectedApolloSite.surfaceStayHours.toFixed(1)} hours on
                    the surface · {selectedApolloSite.evaHours.toFixed(1)} EVA
                    hours · {selectedApolloSite.traverseDistanceKm.toFixed(2)}{" "}
                    km traversed
                  </span>
                  <span>
                    Experiments: {selectedApolloSite.experiments.join("; ")}
                  </span>
                  <span className="apollo-source-links">
                    <a
                      href={selectedApolloSite.mappingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      LROC traverse map
                    </a>
                    <a
                      href={selectedApolloSite.photoArchiveUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Surface photographs
                    </a>
                    <a
                      href={selectedApolloSite.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mission record
                    </a>
                  </span>
                </span>
              )}
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

          <details open>
            <summary>Image quality</summary>
            <div className="control-section visual-quality-controls">
              <label>
                Rendering
                <select
                  aria-label="Rendering quality"
                  value={visualQuality}
                  onChange={(event) =>
                    setVisualQuality(event.currentTarget.value as VisualQuality)
                  }
                >
                  {(
                    Object.entries(VISUAL_QUALITY_PROFILES) as [
                      VisualQuality,
                      (typeof VISUAL_QUALITY_PROFILES)[VisualQuality],
                    ][]
                  ).map(([quality, profile]) => (
                    <option key={quality} value={quality}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
              <small className="visual-quality-note">
                Photographic uses full display resolution, high texture
                filtering, inverse-square sunlight and slower exposure
                adaptation. Balanced and Battery reduce GPU work without
                changing positions or physics.
              </small>
            </div>
          </details>

          <details open>
            <summary>Surface observer</summary>
            <div className="control-section surface-observer-controls">
              <label>
                Observer body
                <select
                  value={surfaceObserverBodyId}
                  onChange={(event) => {
                    const nextBodyId = event.currentTarget.value;
                    setSurfaceObserverBodyId(nextBodyId);
                    if (surfaceObserverTargetBodyId === nextBodyId) {
                      setSurfaceObserverTargetBodyId("sun");
                    }
                    if (surfaceObserverEnabled) {
                      navigateToFocus(nextBodyId);
                    }
                  }}
                >
                  {surfaceObserverBodies.map((body) => (
                    <option key={body.id} value={body.id}>
                      {body.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Look at
                <select
                  value={surfaceObserverTargetBodyId}
                  onChange={(event) =>
                    setSurfaceObserverTargetBodyId(event.currentTarget.value)
                  }
                >
                  {majorBodySnapshot.bodies
                    .filter((body) => body.id !== surfaceObserverBodyId)
                    .map((body) => (
                      <option key={body.id} value={body.id}>
                        {body.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Latitude
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="0.0001"
                  value={surfaceObserverLatitudeDeg}
                  onChange={(event) => {
                    const latitudeDeg = event.currentTarget.valueAsNumber;
                    if (
                      Number.isFinite(latitudeDeg) &&
                      latitudeDeg >= -90 &&
                      latitudeDeg <= 90
                    ) {
                      setSurfaceObserverLatitudeDeg(latitudeDeg);
                    }
                  }}
                />
              </label>
              <label>
                Longitude °E
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="0.0001"
                  value={surfaceObserverLongitudeDeg}
                  onChange={(event) => {
                    const longitudeDeg = event.currentTarget.valueAsNumber;
                    if (
                      Number.isFinite(longitudeDeg) &&
                      longitudeDeg >= -180 &&
                      longitudeDeg <= 180
                    ) {
                      setSurfaceObserverLongitudeDeg(longitudeDeg);
                    }
                  }}
                />
              </label>
              <small className="surface-observer-control-note">
                Planetographic coordinates on the sourced mean-radius reference
                sphere. Giant planets are excluded because they have no solid
                surface.
              </small>
              <button
                type="button"
                className="primary-action"
                onClick={
                  surfaceObserverEnabled
                    ? exitSurfaceObserver
                    : enterSurfaceObserver
                }
              >
                {surfaceObserverEnabled
                  ? "Exit surface view"
                  : "Enter surface view"}
              </button>
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
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={audio.settings.narrationEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "narrationEnabled",
                      event.currentTarget.checked,
                    )
                  }
                />
                <span>Tour narration</span>
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
              <label className="range-control">
                <span>Narration volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(audio.settings.narrationVolume * 100)}
                  disabled={!audio.settings.narrationEnabled}
                  onChange={(event) =>
                    audio.updateSetting(
                      "narrationVolume",
                      Number(event.currentTarget.value) / 100,
                    )
                  }
                />
                <output>
                  {Math.round(audio.settings.narrationVolume * 100)}%
                </output>
              </label>
              <span className="audio-status" role="status">
                {audio.narrationStatus === "error"
                  ? "Tour narration could not be loaded"
                  : audio.narrationStatus === "playing"
                    ? "Tour narration playing"
                    : audio.status === "running"
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
                  <option value="sun-facing">Face Sun</option>
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
                    setRequestedViewMagnification(preset.zoom);
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
                  min="-32"
                  max="7"
                  step="0.000001"
                  value={Math.max(
                    -32,
                    Math.min(7, Math.log2(viewMagnification)),
                  )}
                  disabled={viewMode === "schematic"}
                  onChange={(event) =>
                    setRequestedViewMagnification(
                      2 ** Number(event.currentTarget.value),
                    )
                  }
                />
                <output>
                  {viewMagnification < 0.001
                    ? viewMagnification.toExponential(2)
                    : viewMagnification < 0.1
                      ? viewMagnification.toFixed(3)
                      : viewMagnification.toFixed(2).replace(/\.00$/u, "")}
                  x
                </output>
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
              <label className="wayfinder-control">
                Wayfinders
                <select
                  value={wayfinderMode}
                  disabled={viewMode === "schematic"}
                  onChange={(event) =>
                    setWayfinderMode(event.currentTarget.value as WayfinderMode)
                  }
                >
                  <option value="off">Off</option>
                  <option value="sun">Sun</option>
                  <option value="sun-planet">Sun + nearest planet</option>
                  <option value="sun-two-planets">
                    Sun + two nearest planets
                  </option>
                </select>
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
              <label>
                Gravity scale
                <select
                  value={gravityWellScale}
                  disabled={
                    viewMode === "schematic" || gravityWellMode === "off"
                  }
                  onChange={(event) =>
                    setGravityWellScale(
                      event.currentTarget.value as GravityWellScale,
                    )
                  }
                >
                  <option value="local">Local detail</option>
                  <option value="absolute">Absolute comparison</option>
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
                  ["Zodiac signs", showZodiac, setShowZodiac],
                  ["Apollo landing sites", showApolloSites, setShowApolloSites],
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
