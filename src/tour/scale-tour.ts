import type { CameraOrientationPreset } from "../scene/camera-view";

export type ScaleTourStep = Readonly<{
  id: string;
  focusBodyId: string;
  cameraTargetBodyId?: string;
  orientation: Exclude<CameraOrientationPreset, "custom">;
  cameraDistanceAu: number | "observer-separation";
  transitionOverviewAnchorBodyId: string;
  transitionOverviewDistanceAu: number;
  cameraZoom: number;
  timeRateSecondsPerSecond: number;
  timeRateLabel: string;
  viewMode: "reality" | "orrery";
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
  eyebrow: string;
  title: string;
  scale: string;
  description: string;
  visualKey: string;
}>;

export const SCALE_TOUR_STEP_DURATION_MS = 16_000;
export const SCALE_TOUR_TRANSITION_DURATION_MS = 7_500;

export const SCALE_TOUR_STEPS: readonly ScaleTourStep[] = [
  {
    id: "earth",
    focusBodyId: "earth",
    orientation: "parent-facing",
    cameraDistanceAu: 0.000_18,
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.006,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · Earth visibly rotates",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "Start with home",
    title: "Earth is already enormous",
    scale: "12,742 km across",
    description:
      "This shot fits Earth itself, not the entire Earth-Moon system. At walking speed, a trip around the planet would take more than a year without stopping.",
    visualKey: "Physical sizes · no guides or trails",
  },
  {
    id: "moon-gap",
    focusBodyId: "earth",
    orientation: "parent-facing",
    cameraDistanceAu: 0.007,
    transitionOverviewAnchorBodyId: "earth",
    transitionOverviewDistanceAu: 0.012,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 86_400,
    timeRateLabel: "1 day per second · the Moon advances in orbit",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: true,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The Earth-Moon system",
    title: "Most of the picture is empty space",
    scale: "384,400 km average separation",
    description:
      "All eight planets could fit side by side between Earth and the Moon at their average distance, with room left over.",
    visualKey: "Thin blue curve · the Moon's orbital path around Earth",
  },
  {
    id: "sun-atmosphere",
    focusBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: 0.032,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 3,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 86_400,
    timeRateLabel: "1 day per second · solar rotation becomes visible",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The active star",
    title: "The Sun is more than a yellow ball",
    scale: "1.39 million km across",
    description:
      "The visible photosphere sits below a thin chromosphere and the much fainter corona. A restrained limb glow is shown, but no invented flare is added without a time-specific observation.",
    visualKey:
      "Procedural photosphere and restrained limb glow · no invented flare state",
  },
  {
    id: "sun-from-mars",
    focusBodyId: "mars",
    cameraTargetBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "mars",
    transitionOverviewDistanceAu: 0.01,
    cameraZoom: 8,
    timeRateSecondsPerSecond: 86_400,
    timeRateLabel: "1 day per second · Mars moves against the star field",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "Stand on another world",
    title: "The Sun seen from Mars",
    scale: "About two-thirds its Earth-sky diameter",
    description:
      "This physical line of sight places the camera at Mars and points it toward the live Sun. The greater distance makes the solar disc look distinctly smaller than it does from Earth.",
    visualKey:
      "Physical sizes and separation · 8× optical camera zoom · observer at Mars",
  },
  {
    id: "jupiter",
    focusBodyId: "jupiter",
    orientation: "parent-facing",
    cameraDistanceAu: 0.025,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 12,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · rapid giant-planet rotation",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: true,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "A giant planet",
    title: "Jupiter is a system of its own",
    scale: "About 11 Earths wide",
    description:
      "Jupiter holds most of the planetary mass in the Solar System. Its major moons orbit across millions of kilometres.",
    visualKey:
      "Thin blue curves · major-moon orbits; all bodies retain physical size",
  },
  {
    id: "jupiter-from-io",
    focusBodyId: "io",
    cameraTargetBodyId: "jupiter",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "io",
    transitionOverviewDistanceAu: 0.008,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · Io moves around Jupiter",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "A moon's-eye view",
    title: "Jupiter fills Io's sky",
    scale: "Roughly 19° across",
    description:
      "The camera rides at Io's live position and tracks Jupiter. From this close volcanic moon, the giant planet spans dozens of times the apparent width of Earth's Moon in our sky.",
    visualKey:
      "Physical sizes and live separation · observer at Io · no display enlargement",
  },
  {
    id: "earth-from-jupiter",
    focusBodyId: "jupiter",
    cameraTargetBodyId: "earth",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "jupiter",
    transitionOverviewDistanceAu: 0.025,
    cameraZoom: 8,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · Earth rotates while centred",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "Look back toward home",
    title: "Earth seen from Jupiter",
    scale: "Only a sub-pixel point at true scale",
    description:
      "This line of sight starts at Jupiter and follows the live Earth. At true scale, a planet-sized world several astronomical units away is below screen resolution, so its label identifies the physical sub-pixel position.",
    visualKey:
      "Physical sub-pixel target · 8× optical camera zoom · observer at Jupiter",
  },
  {
    id: "saturn",
    focusBodyId: "saturn",
    orientation: "parent-facing",
    cameraDistanceAu: 0.004_2,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 22,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · Saturn rotates beneath its rings",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "A vast ring system",
    title: "Saturn's rings dwarf Earth",
    scale: "273,560 km across the observed main rings",
    description:
      "The main rings are broad enough to span more than 21 Earths, but their vertical thickness is tiny compared with their width.",
    visualKey: "Physical globe and ring dimensions · no guide lines",
  },
  {
    id: "saturn-from-titan",
    focusBodyId: "titan",
    cameraTargetBodyId: "saturn",
    orientation: "perspective",
    cameraDistanceAu: "observer-separation",
    transitionOverviewAnchorBodyId: "titan",
    transitionOverviewDistanceAu: 0.015,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    timeRateLabel: "1 hour per second · Titan advances around Saturn",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "Beyond Titan's haze",
    title: "Saturn seen from Titan",
    scale: "The rings span several degrees of sky",
    description:
      "This clear-space viewpoint uses Titan's live orbital position and looks back at Saturn. It omits Titan's opaque atmospheric haze so the scene teaches orbital geometry rather than a fictional surface view.",
    visualKey:
      "Physical sizes and live separation · clear-space observer at Titan",
  },
  {
    id: "neptune",
    focusBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: 36,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 75,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 604_800,
    timeRateLabel: "1 week per second · outer-system motion remains legible",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: true,
      orbitGuideScope: "all",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The outer planets",
    title: "Neptune is thirty times farther out",
    scale: "About 30 AU from the Sun",
    description:
      "Sunlight takes roughly four hours to reach Neptune. One Neptune year lasts nearly 165 Earth years.",
    visualKey:
      "Physical sizes · blue curves are planetary orbital paths · labels mark sub-pixel worlds",
  },
  {
    id: "solar-system",
    focusBodyId: "",
    orientation: "perspective",
    cameraDistanceAu: 90,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 90,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 2_592_000,
    timeRateLabel: "30 days per second · planetary orbits sweep smoothly",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The complete view",
    title: "At true scale, planets almost disappear",
    scale: "A 90 AU camera view",
    description:
      "The final view keeps positions and sizes physical. Tiny worlds becoming sub-pixel points is not a rendering failure: it is the scale of space.",
    visualKey:
      "Physical sizes and positions · labels identify sub-pixel worlds",
  },
] as const;
