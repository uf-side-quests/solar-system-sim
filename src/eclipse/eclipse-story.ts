import {
  AstroTime,
  EclipseKind,
  Observer,
  SearchLocalSolarEclipse,
} from "astronomy-engine";

import { majorBodySnapshot } from "../physics/solar-system";
import type { CameraOrientationPreset } from "../scene/camera-view";
import { narrationFor, type TourNarration } from "../tour/narration";

const SECONDS_PER_DAY = 86_400;
const J2000_JULIAN_DAY = 2_451_545;

export const ECLIPSE_SOURCE_URL =
  "https://science.nasa.gov/eclipses/future-eclipses/total-solar-eclipse-on-august-12-2026/";
export const ECLIPSE_PATH_SOURCE_URL =
  "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html";

export const LONDON_ECLIPSE_OBSERVER = Object.freeze({
  name: "London",
  latitudeDeg: 51.5074,
  longitudeDeg: -0.1278,
});

export const SPAIN_CENTRE_LINE_OBSERVER = Object.freeze({
  name: "Northern Spain centre line",
  latitudeDeg: 43 + 22.3 / 60,
  longitudeDeg: -(6 + 11.3 / 60),
});

function simulationSecondsForUtc(isoUtc: string): number {
  const time = new AstroTime(new Date(isoUtc));
  const epochDaysSinceJ2000 = majorBodySnapshot.epoch.value - J2000_JULIAN_DAY;
  return (time.tt - epochDaysSinceJ2000) * SECONDS_PER_DAY;
}

const londonEclipse = SearchLocalSolarEclipse(
  new Date("2026-08-11T00:00:00.000Z"),
  new Observer(
    LONDON_ECLIPSE_OBSERVER.latitudeDeg,
    LONDON_ECLIPSE_OBSERVER.longitudeDeg,
    0,
  ),
);

if (londonEclipse.kind !== EclipseKind.Partial) {
  throw new Error("The 12 August 2026 London eclipse must be partial");
}

export const LONDON_ECLIPSE = Object.freeze({
  partialBeginUtc: londonEclipse.partial_begin.time.date.toISOString(),
  maximumUtc: londonEclipse.peak.time.date.toISOString(),
  partialEndUtc: londonEclipse.partial_end.time.date.toISOString(),
  maximumObscuration: londonEclipse.obscuration,
  beginSunAltitudeDeg: londonEclipse.partial_begin.altitude,
  maximumSunAltitudeDeg: londonEclipse.peak.altitude,
  endSunAltitudeDeg: londonEclipse.partial_end.altitude,
});

export type EclipseStoryStep = Readonly<{
  id: string;
  focusBodyId: string;
  cameraTargetBodyId?: string;
  orientation: Exclude<CameraOrientationPreset, "custom">;
  cameraDistanceAu: number | "observer-separation";
  observerCameraStyle?: "surface-facing" | "limb";
  transitionOverviewAnchorBodyId: string;
  transitionOverviewDistanceAu: number;
  cameraZoom: number;
  timeRateSecondsPerSecond: number;
  timeRateLabel: string;
  timeUtc: string;
  timeSeconds: number;
  viewMode: "reality";
  bodyVisibilityPercent: number;
  overlays: Readonly<{
    labels: boolean;
    orbitGuides: boolean;
    orbitGuideScope: "system" | "all";
    tactical: boolean;
    eclipticGrid: boolean;
    planetTrails: boolean;
    moonTrail: boolean;
  }>;
  surfaceObserver?: Readonly<{
    latitudeDeg: number;
    longitudeDeg: number;
    targetBodyId: "sun";
  }>;
  eyebrow: string;
  title: string;
  scale: string;
  description: string;
  visualKey: string;
  narration: TourNarration;
  presentation?: never;
  spacecraftLabelBodyIds?: readonly string[];
}>;

const noDecorativeOverlays = Object.freeze({
  labels: true,
  orbitGuides: false,
  orbitGuideScope: "system" as const,
  tactical: false,
  eclipticGrid: false,
  planetTrails: false,
  moonTrail: false,
});

export const ECLIPSE_STORY_STEP_DURATION_MS = 24_000;
export const ECLIPSE_STORY_TRANSITION_DURATION_MS = 8_000;

export const ECLIPSE_STORY_STEPS: readonly EclipseStoryStep[] = [
  {
    id: "eclipse-alignment",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: 0.009,
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.012,
    cameraZoom: 1.5,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · the Moon advances along its orbit",
    timeUtc: "2026-08-12T17:45:53.800Z",
    timeSeconds: simulationSecondsForUtc("2026-08-12T17:45:53.800Z"),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      ...noDecorativeOverlays,
      orbitGuides: true,
    },
    eyebrow: "Establish the three bodies",
    title: "The eclipse begins when the Moon crosses the Sun-Earth line",
    scale: "Moon: 384,000 km away · Sun: 150 million km away",
    description:
      "This three-quarter view keeps Earth and Moon separate on screen. The yellow guide fixes the Sun's direction while the Moon advances along its physical orbit.",
    visualKey:
      "Physical Earth-Moon sizes · thin blue curve is the lunar orbit · yellow guide gives the Sun direction",
    narration: narrationFor("eclipse-alignment"),
  },
  {
    id: "london-before-contact",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 24,
    timeRateSecondsPerSecond: 60,
    timeRateLabel:
      "1 minute per second · the Moon approaches from the lower right",
    timeUtc: "2026-08-12T17:07:12.171Z",
    timeSeconds: simulationSecondsForUtc("2026-08-12T17:07:12.171Z"),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    surfaceObserver: {
      latitudeDeg: LONDON_ECLIPSE_OBSERVER.latitudeDeg,
      longitudeDeg: LONDON_ECLIPSE_OBSERVER.longitudeDeg,
      targetBodyId: "sun",
    },
    eyebrow: "London · 18:07 BST",
    title: "The Moon is ten minutes from first contact",
    scale: "The Sun is about 21° above the western horizon",
    description:
      "The Moon and Sun already have almost the same apparent diameter. The dark lunar disc remains separate for a few more minutes.",
    visualKey:
      "True apparent sizes · 24× optical view · use certified eclipse glasses outdoors",
    narration: narrationFor("london-before-contact"),
  },
  {
    id: "london-first-contact",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 32,
    timeRateSecondsPerSecond: 60,
    timeRateLabel: "1 minute per second · the lunar silhouette advances",
    timeUtc: LONDON_ECLIPSE.partialBeginUtc,
    timeSeconds: simulationSecondsForUtc(LONDON_ECLIPSE.partialBeginUtc),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    surfaceObserver: {
      latitudeDeg: LONDON_ECLIPSE_OBSERVER.latitudeDeg,
      longitudeDeg: LONDON_ECLIPSE_OBSERVER.longitudeDeg,
      targetBodyId: "sun",
    },
    eyebrow: "London · 18:17 BST",
    title: "First contact: the Moon touches the Sun",
    scale: "The Sun is about 19° above the western horizon",
    description:
      "The Moon's leading edge meets the Sun's edge. The partial eclipse now grows for 56 minutes as the Moon moves across the solar disc.",
    visualKey:
      "True apparent sizes · 32× optical view · eye protection remains essential",
    narration: narrationFor("london-first-contact"),
  },
  {
    id: "london-maximum",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 32,
    timeRateSecondsPerSecond: 1,
    timeRateLabel: "real time · the maximum remains easy to examine",
    timeUtc: LONDON_ECLIPSE.maximumUtc,
    timeSeconds: simulationSecondsForUtc(LONDON_ECLIPSE.maximumUtc),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    surfaceObserver: {
      latitudeDeg: LONDON_ECLIPSE_OBSERVER.latitudeDeg,
      longitudeDeg: LONDON_ECLIPSE_OBSERVER.longitudeDeg,
      targetBodyId: "sun",
    },
    eyebrow: "London · 19:13 BST",
    title: "Maximum: about 91% of the Sun is hidden",
    scale: "The Sun is only 10.4° above the west-northwest horizon",
    description:
      "NASA predicts 91.3% obscuration for London. This live physical model shows about 91.0%. A bright crescent remains because the central shadow passes northwest.",
    visualKey:
      "True apparent sizes and topocentric geometry · direct viewing still needs a solar filter",
    narration: narrationFor("london-maximum"),
  },
  {
    id: "shadow-axis",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: 0.009,
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.012,
    cameraZoom: 1.5,
    timeRateSecondsPerSecond: 60,
    timeRateLabel: "1 minute per second · the shadow moves across Earth",
    timeUtc: "2026-08-12T17:45:53.800Z",
    timeSeconds: simulationSecondsForUtc("2026-08-12T17:45:53.800Z"),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      ...noDecorativeOverlays,
      orbitGuides: true,
    },
    eyebrow: "Return to the same line",
    title: "Pull back: the Moon has reached the Sun-Earth line",
    scale: "The same three-quarter direction returns after the London view",
    description:
      "We leave London and return to the opening three-body view. The yellow guide shows the Sun direction, while the Moon now crosses that line beside Earth.",
    visualKey:
      "Physical sizes and separation · Moon, Earth, and Sun direction shown together",
    narration: narrationFor("shadow-axis"),
  },
  {
    id: "shadow-from-moon",
    focusBodyId: "moon",
    cameraTargetBodyId: "earth",
    observerCameraStyle: "limb",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "moon",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 4,
    timeRateSecondsPerSecond: 60,
    timeRateLabel:
      "1 minute per second · Earth turns beneath the Moon's shadow",
    timeUtc: "2026-08-12T17:45:53.800Z",
    timeSeconds: simulationSecondsForUtc("2026-08-12T17:45:53.800Z"),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    eyebrow: "Move to the lunar horizon",
    title: "Look from above the Moon's limb toward Earth",
    scale: "The central shadow crosses the North Atlantic",
    description:
      "The camera now enters a low lunar orbit, 350 kilometres above the Moon's sunlit limb. Earth stays ahead, and the horizon fixes the shadow direction.",
    visualKey:
      "Physical Earth-Moon separation · 4× optical view · lunar horizon in the lower frame",
    narration: narrationFor("shadow-from-moon"),
  },
  {
    id: "spain-totality",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 32,
    timeRateSecondsPerSecond: 1,
    timeRateLabel: "real time · totality lasts about 1 minute 49 seconds here",
    timeUtc: "2026-08-12T18:28:00.000Z",
    timeSeconds: simulationSecondsForUtc("2026-08-12T18:28:00.000Z"),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    surfaceObserver: {
      latitudeDeg: SPAIN_CENTRE_LINE_OBSERVER.latitudeDeg,
      longitudeDeg: SPAIN_CENTRE_LINE_OBSERVER.longitudeDeg,
      targetBodyId: "sun",
    },
    eyebrow: "Northern Spain centre line · 20:28 CEST",
    title: "On the centre line, the Moon covers the Sun",
    scale: "The Sun is about 10° above the western horizon",
    description:
      "This observer stands on the Moon's central shadow line. The slightly larger lunar disc hides the photosphere and briefly reveals the solar corona.",
    visualKey:
      "True apparent sizes · 32× optical view · corona shape is illustrative · NASA centre-line coordinates",
    narration: narrationFor("spain-totality"),
  },
  {
    id: "london-final-contact",
    focusBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 8,
    timeRateSecondsPerSecond: 60,
    timeRateLabel: "1 minute per second · the Moon leaves the solar disc",
    timeUtc: LONDON_ECLIPSE.partialEndUtc,
    timeSeconds: simulationSecondsForUtc(LONDON_ECLIPSE.partialEndUtc),
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: noDecorativeOverlays,
    surfaceObserver: {
      latitudeDeg: LONDON_ECLIPSE_OBSERVER.latitudeDeg,
      longitudeDeg: LONDON_ECLIPSE_OBSERVER.longitudeDeg,
      targetBodyId: "sun",
    },
    eyebrow: "London · 20:06 BST",
    title: "Final contact arrives just above the horizon",
    scale: "The Sun is only 2.7° high",
    description:
      "The Moon's trailing edge leaves the Sun after one hour and 49 minutes. A clear western horizon matters because the eclipse ends shortly before sunset.",
    visualKey:
      "True apparent sizes · 8× optical view includes the geometric horizon",
    narration: narrationFor("london-final-contact"),
  },
];
