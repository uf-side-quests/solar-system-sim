export type CameraOrientationPreset =
  | "perspective"
  | "overhead"
  | "edge-on"
  | "sun-facing"
  | "parent-facing"
  | "velocity"
  | "orbital-plane"
  | "custom";

export type CameraNavigationAction = "fit-selection" | "zoom-in" | "zoom-out";

export type CameraNavigationCommand = Readonly<{
  sequence: number;
  action: CameraNavigationAction;
}>;
