import type { CameraOrientationPreset } from "../scene/camera-view";
import tourNarrationData from "../data/tour-narration.json";

type TourNarration = Readonly<{
  audioSource: string;
  text: string;
}>;

const tourNarrationById = new Map(
  tourNarrationData.map((entry) => [
    entry.id,
    { audioSource: entry.audioSource, text: entry.text },
  ]),
);

function narrationFor(stepId: string): TourNarration {
  const narration = tourNarrationById.get(stepId);
  if (narration === undefined) {
    throw new Error(`Tour narration for ${stepId} is unavailable`);
  }
  return narration;
}

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
  narration: TourNarration;
  presentation?:
    "heliosphere-scale" | "oort-cloud-scale" | "interstellar-scale";
  spacecraftLabelBodyIds?: readonly string[];
}>;

export const SCALE_TOUR_STEP_DURATION_MS = 28_000;
export const SCALE_TOUR_TRANSITION_DURATION_MS = 12_000;

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
      "This shot fits Earth itself. Its 40,075 km equatorial circumference would take more than a year to walk without stopping, while the one-hour-per-second clock makes the planet's rotation visible.",
    visualKey: "Physical sizes · no guides or trails",
    narration: narrationFor("earth"),
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
      "The average centre-to-centre gap is about 30 Earth diameters. All eight planets could fit side by side across it, while the thin curve shows the Moon's modelled orbit rather than a decorative ring.",
    visualKey: "Thin blue curve · the Moon's orbital path around Earth",
    narration: narrationFor("moon-gap"),
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
      "The Sun contains 99.86% of the Solar System's mass. Its visible photosphere lies beneath a thin chromosphere and an immense, faint corona that streams into space.",
    visualKey:
      "Photosphere, chromosphere and quiet corona · solar activity is illustrative",
    narration: narrationFor("sun-atmosphere"),
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
      "Mars is about half again as far from the Sun as Earth. From here the solar disc spans only about two-thirds of the angle it does in Earth's sky, so daylight is weaker and the Sun looks noticeably smaller.",
    visualKey:
      "Physical sizes and separation · 8× optical camera zoom · observer at Mars",
    narration: narrationFor("sun-from-mars"),
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
      "Jupiter holds most of the mass in all the planets and rotates in about ten hours. Its major moons span millions of kilometres, with their physical orbital paths shown as thin curves.",
    visualKey:
      "Thin blue curves · major-moon orbits; all bodies retain physical size",
    narration: narrationFor("jupiter"),
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
      "Io circles only 422,000 kilometres from Jupiter's centre. The giant planet spans roughly 19 degrees here, more than thirty times the apparent width of the Moon in Earth's sky.",
    visualKey:
      "Physical sizes and live separation · observer at Io · no display enlargement",
    narration: narrationFor("jupiter-from-io"),
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
      "Across several astronomical units, Earth shrinks below the resolution of a screen pixel. Its label marks the calculated direction of home; the planet itself has not been enlarged.",
    visualKey:
      "Physical sub-pixel target · 8× optical camera zoom · observer at Jupiter",
    narration: narrationFor("earth-from-jupiter"),
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
      "The observed main rings span more than 21 Earth diameters but are extraordinarily thin. They are countless orbiting particles, rendered from a Cassini radial mosaic rather than as a solid disc.",
    visualKey: "Physical globe and ring dimensions · no guide lines",
    narration: narrationFor("saturn"),
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
      "Titan orbits about 1.2 million kilometres from Saturn. Above its dense orange atmosphere, Saturn and its rings would stretch across several degrees of sky.",
    visualKey:
      "Physical sizes and live separation · clear-space observer at Titan",
    narration: narrationFor("saturn-from-titan"),
  },
  {
    id: "neptune",
    focusBodyId: "neptune",
    orientation: "parent-facing",
    cameraDistanceAu: 0.001_2,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 75,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 604_800,
    timeRateLabel: "1 week per second · outer-system motion remains legible",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: true,
      orbitGuides: false,
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
      "The camera moves to Neptune's sunward side, where its physical globe remains visible while the Sun wayfinder carries the full distance. Sunlight takes roughly four hours to arrive, and one orbit lasts nearly 165 Earth years.",
    visualKey:
      "Physical size · sunward view · wayfinder preserves the live Sun distance",
    narration: narrationFor("neptune"),
  },
  {
    id: "voyager-2",
    focusBodyId: "voyager-2",
    orientation: "parent-facing",
    cameraDistanceAu: 90 / 149_597_870_700,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 165,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 2_592_000,
    timeRateLabel:
      "30 days per second · the probe continues through interstellar space",
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
    eyebrow: "Beyond the heliosphere",
    title: "Voyager 2 follows a different road",
    scale: "More than 140 AU from the Sun at the 2026 epoch",
    description:
      "Voyager 2 crossed the heliopause in 2018 and now samples interstellar space. From this distance, a one-way radio signal takes almost 20 hours, so its 3.7 metre dish must remain aimed back at Earth.",
    visualKey:
      "Physical 13 m spacecraft · live Earth-pointing antenna · true Sun distance",
    narration: narrationFor("voyager-2"),
    spacecraftLabelBodyIds: ["voyager-2"],
  },
  {
    id: "voyager-1",
    focusBodyId: "voyager-1",
    orientation: "parent-facing",
    cameraDistanceAu: 90 / 149_597_870_700,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 190,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 2_592_000,
    timeRateLabel:
      "30 days per second · humanity's farthest probe keeps receding",
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
    eyebrow: "The human frontier",
    title: "Voyager 1 is almost lost in the dark",
    scale: "More than 160 AU from the Sun at the 2026 epoch",
    description:
      "A one-way radio signal now takes more than 23 hours to reach Voyager 1. Its 3.7 metre dish points toward a barely distinguishable Earth near the Sun, while the 13 metre spacecraft itself would be far below one screen pixel at true distance.",
    visualKey:
      "Physical 13 m spacecraft · live Earth-pointing antenna · no display enlargement",
    narration: narrationFor("voyager-1"),
    spacecraftLabelBodyIds: ["voyager-1"],
  },
  {
    id: "solar-system",
    focusBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: 320,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 240,
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
    eyebrow: "The Sun's wind bubble",
    title: "The heliosphere is not the edge of the Solar System",
    scale: "Voyager crossings reveal a boundary around 120 AU",
    description:
      "The solar wind inflates a magnetised region called the heliosphere. Its outer boundary, the heliopause, separates solar-wind plasma from interstellar space; both Voyagers have crossed it.",
    visualKey:
      "Live Solar System · approximate plasma boundaries are not spherical in nature",
    narration: narrationFor("solar-system"),
    spacecraftLabelBodyIds: ["voyager-1", "voyager-2"],
    presentation: "heliosphere-scale",
  },
  {
    id: "oort-cloud",
    focusBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: 135_000,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 240,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 2_592_000,
    timeRateLabel:
      "30 days per second · the planets continue moving at the centre",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: false,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The Sun's distant comet reservoir",
    title:
      "The Oort Cloud may reach more than a third of the way to the next star",
    scale: "Estimated from about 2,000 to as far as 100,000 AU",
    description:
      "The Oort Cloud is a predicted spherical shell of icy bodies on extremely long solar orbits. It is not the heliosphere, no spacecraft has reached it, and its individual objects have not been mapped.",
    visualKey:
      "Continuous physical scale · points show an estimated population, not mapped objects",
    narration: narrationFor("oort-cloud"),
    presentation: "oort-cloud-scale",
  },
  {
    id: "alpha-centauri",
    focusBodyId: "sun",
    orientation: "perspective",
    cameraDistanceAu: 390_000,
    transitionOverviewAnchorBodyId: "sun",
    transitionOverviewDistanceAu: 240,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 2_592_000,
    timeRateLabel:
      "30 days per second · the Solar System remains live but vanishingly small",
    viewMode: "reality",
    bodyVisibilityPercent: 0,
    overlays: {
      labels: false,
      orbitGuides: false,
      orbitGuideScope: "system",
      tactical: false,
      eclipticGrid: false,
      planetTrails: false,
      moonTrail: false,
    },
    eyebrow: "The nearest stellar neighbours",
    title: "Alpha Centauri is another scale entirely",
    scale: "About 4.3 light-years · roughly 272,000 AU",
    description:
      "Even a possible 100,000 AU outer Oort Cloud reaches only about 37% of this distance. Light needs 4.3 years; Voyager 1 would need about 75,000 years at its present speed and is not heading there.",
    visualKey:
      "One continuous 3D scale · Alpha Centauri is a Hipparcos direction marker, not an N-body object",
    narration: narrationFor("alpha-centauri"),
    presentation: "interstellar-scale",
  },
] as const;
