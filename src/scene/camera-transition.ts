export type CameraTransitionPhase =
  "outbound" | "overview" | "inbound" | "settled";

export type CameraTransitionSample = Readonly<{
  phase: CameraTransitionPhase;
  segmentProgress: number;
}>;

const OUTBOUND_END = 0.4;
const INBOUND_START = 0.58;

function smootherStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

export function interpolateLogarithmicDistance(
  startDistance: number,
  endDistance: number,
  progress: number,
): number {
  if (
    !Number.isFinite(startDistance) ||
    !Number.isFinite(endDistance) ||
    startDistance <= 0 ||
    endDistance <= 0
  ) {
    throw new Error("Camera transition distances must be positive and finite");
  }
  if (!Number.isFinite(progress)) {
    throw new Error("Camera transition progress must be finite");
  }
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return Math.exp(
    Math.log(startDistance) +
      (Math.log(endDistance) - Math.log(startDistance)) * clampedProgress,
  );
}

export function sampleCameraTransition(
  elapsedMs: number,
  durationMs: number,
): CameraTransitionSample {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error(
      "Camera transition elapsed time must be finite and non-negative",
    );
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Camera transition duration must be positive and finite");
  }
  const progress = Math.min(1, elapsedMs / durationMs);
  if (progress >= 1) {
    return { phase: "settled", segmentProgress: 1 };
  }
  if (progress < OUTBOUND_END) {
    return {
      phase: "outbound",
      segmentProgress: smootherStep(progress / OUTBOUND_END),
    };
  }
  if (progress <= INBOUND_START) {
    return { phase: "overview", segmentProgress: 1 };
  }
  return {
    phase: "inbound",
    segmentProgress: smootherStep(
      (progress - INBOUND_START) / (1 - INBOUND_START),
    ),
  };
}
