import type { CameraOrientationPreset } from "../scene/camera-view";
import type { ViewMode } from "../scene/view-mode";

export type CinematicShot = Readonly<{
  id: string;
  name: string;
  description: string;
  focusBodyId: string;
  cameraTargetBodyId?: string;
  orientation: Exclude<CameraOrientationPreset, "custom">;
  cameraDistanceAu?: number;
  cameraZoom: number;
  timeRateSecondsPerSecond: number;
  viewMode: Exclude<ViewMode, "schematic">;
  bodyVisibilityPercent: number;
  orbitGuides: boolean;
  labels: boolean;
}>;

export const CINEMATIC_SHOTS: readonly CinematicShot[] = [
  {
    id: "earth-daylight",
    name: "Earth in daylight",
    description:
      "A true-scale portrait from the sunward side, with the living world fully illuminated.",
    focusBodyId: "earth",
    orientation: "sun-facing",
    cameraDistanceAu: 0.00018,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
  {
    id: "saturn-ring-skimming",
    name: "Saturn and its rings",
    description:
      "A sunlit, oblique portrait that makes the ring structure and Saturn's shadow readable.",
    focusBodyId: "saturn",
    orientation: "sun-facing",
    cameraDistanceAu: 0.0024,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
  {
    id: "jupiter-daylight",
    name: "Jupiter in daylight",
    description:
      "A true-scale sunward portrait of Jupiter's cloud bands and storms.",
    focusBodyId: "jupiter",
    orientation: "sun-facing",
    cameraDistanceAu: 0.0018,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 3_600,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
  {
    id: "moon-daylight",
    name: "Moon in sunlight",
    description:
      "A true-scale sunward portrait of the Moon's cratered, height-mapped surface.",
    focusBodyId: "moon",
    orientation: "sun-facing",
    cameraDistanceAu: 0.00005,
    cameraZoom: 1,
    timeRateSecondsPerSecond: 600,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
  {
    id: "voyager-looking-home",
    name: "Voyager beyond the planets",
    description:
      "Voyager 1 in interstellar space with its antenna aligned toward Earth.",
    focusBodyId: "voyager-1",
    orientation: "sun-facing",
    cameraZoom: 1.8,
    timeRateSecondsPerSecond: 86_400,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
  {
    id: "sun-from-mercury",
    name: "Sun from Mercury",
    description:
      "The Sun at its live apparent size from a viewpoint just above Mercury's sunward surface.",
    focusBodyId: "mercury",
    cameraTargetBodyId: "sun",
    orientation: "parent-facing",
    cameraZoom: 16,
    timeRateSecondsPerSecond: 3_600,
    viewMode: "reality",
    bodyVisibilityPercent: 100,
    orbitGuides: false,
    labels: false,
  },
];
