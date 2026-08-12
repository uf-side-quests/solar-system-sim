export type CameraTransitionPhase =
  "orienting" | "outbound" | "overview" | "inbound" | "settled";

export type CameraTransitionSample = Readonly<{
  phase: CameraTransitionPhase;
  segmentProgress: number;
}>;

export type DirectCameraTransitionPhase =
  "orienting" | "travelling" | "arriving" | "settled";

export type DirectCameraTransitionSample = Readonly<{
  phase: DirectCameraTransitionPhase;
  segmentProgress: number;
}>;

export type OrientationTransitionSample = Readonly<{
  settled: boolean;
  progress: number;
}>;

const AUTHORED_ORIENTATION_END = 0.3;
const OUTBOUND_END = 0.5;
const INBOUND_START = 0.75;
const DIRECT_ORIENTATION_END = 0.34;
const DIRECT_ARRIVAL_START = 0.68;
const SPEED_OF_LIGHT_MPS = 299_792_458;

function smootherStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

export function formatViewpointSpeed(speedMps: number): string {
  if (!Number.isFinite(speedMps) || speedMps < 0) {
    throw new Error("Viewpoint speed must be finite and non-negative");
  }
  if (speedMps < 1_000) {
    return `${speedMps.toFixed(0)} m/s`;
  }
  if (speedMps < SPEED_OF_LIGHT_MPS) {
    return `${(speedMps / 1_000).toLocaleString("en-GB", {
      maximumFractionDigits: speedMps < 100_000 ? 1 : 0,
    })} km/s`;
  }
  const lightSpeedMultiple = speedMps / SPEED_OF_LIGHT_MPS;
  return `${lightSpeedMultiple.toLocaleString("en-GB", {
    maximumFractionDigits: lightSpeedMultiple < 10 ? 2 : 0,
  })}× light speed`;
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
  if (progress < AUTHORED_ORIENTATION_END) {
    return {
      phase: "orienting",
      segmentProgress: smootherStep(progress / AUTHORED_ORIENTATION_END),
    };
  }
  if (progress < OUTBOUND_END) {
    return {
      phase: "outbound",
      segmentProgress: smootherStep(
        (progress - AUTHORED_ORIENTATION_END) /
          (OUTBOUND_END - AUTHORED_ORIENTATION_END),
      ),
    };
  }
  if (progress <= INBOUND_START) {
    return {
      phase: "overview",
      segmentProgress: smootherStep(
        (progress - OUTBOUND_END) / (INBOUND_START - OUTBOUND_END),
      ),
    };
  }
  return {
    phase: "inbound",
    segmentProgress: smootherStep(
      (progress - INBOUND_START) / (1 - INBOUND_START),
    ),
  };
}

export function sampleDirectCameraTransition(
  elapsedMs: number,
  durationMs: number,
): DirectCameraTransitionSample {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error(
      "Direct camera transition elapsed time must be finite and non-negative",
    );
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(
      "Direct camera transition duration must be positive and finite",
    );
  }
  const progress = Math.min(1, elapsedMs / durationMs);
  if (progress >= 1) {
    return { phase: "settled", segmentProgress: 1 };
  }
  if (progress < DIRECT_ORIENTATION_END) {
    return {
      phase: "orienting",
      segmentProgress: smootherStep(progress / DIRECT_ORIENTATION_END),
    };
  }
  const flightProgress =
    (progress - DIRECT_ORIENTATION_END) / (1 - DIRECT_ORIENTATION_END);
  return {
    phase: flightProgress < DIRECT_ARRIVAL_START ? "travelling" : "arriving",
    segmentProgress: smootherStep(flightProgress),
  };
}

export function sampleOrientationTransition(
  elapsedMs: number,
  durationMs: number,
): OrientationTransitionSample {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error(
      "Orientation transition elapsed time must be finite and non-negative",
    );
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(
      "Orientation transition duration must be positive and finite",
    );
  }
  const progress = Math.min(1, elapsedMs / durationMs);
  return {
    settled: progress >= 1,
    progress: smootherStep(progress),
  };
}
