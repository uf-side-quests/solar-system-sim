export type VisualQuality = "battery" | "balanced" | "photographic";

export type VisualQualityProfile = Readonly<{
  label: string;
  maximumPixelRatio: number;
  baseExposure: number;
  exposureHalfLifeSeconds: number;
  atmosphereStrength: number;
  coronaOpacity: number;
  textureAnisotropyLimit: number;
}>;

export const VISUAL_QUALITY_PROFILES: Readonly<
  Record<VisualQuality, VisualQualityProfile>
> = {
  battery: {
    label: "Battery",
    maximumPixelRatio: 1,
    baseExposure: 0.95,
    exposureHalfLifeSeconds: 0.35,
    atmosphereStrength: 0.58,
    coronaOpacity: 0.003,
    textureAnisotropyLimit: 4,
  },
  balanced: {
    label: "Balanced",
    maximumPixelRatio: 1.5,
    baseExposure: 1,
    exposureHalfLifeSeconds: 0.6,
    atmosphereStrength: 0.82,
    coronaOpacity: 0.005,
    textureAnisotropyLimit: 8,
  },
  photographic: {
    label: "Photographic",
    maximumPixelRatio: 2,
    baseExposure: 1.05,
    exposureHalfLifeSeconds: 0.9,
    atmosphereStrength: 1,
    coronaOpacity: 0.008,
    textureAnisotropyLimit: 16,
  },
};

const MINIMUM_SOLAR_EXPOSURE_MULTIPLIER = 0.04;
const MAXIMUM_SOLAR_EXPOSURE_MULTIPLIER = 4_096;

export function solarExposureForDistanceAu(
  quality: VisualQuality,
  distanceFromSunAu: number | undefined,
): number {
  const profile = VISUAL_QUALITY_PROFILES[quality];
  if (distanceFromSunAu === undefined) {
    return profile.baseExposure;
  }
  if (!Number.isFinite(distanceFromSunAu) || distanceFromSunAu <= 0) {
    throw new Error("Solar exposure distance must be positive and finite");
  }
  const inverseSquareCompensation = Math.min(
    MAXIMUM_SOLAR_EXPOSURE_MULTIPLIER,
    Math.max(
      MINIMUM_SOLAR_EXPOSURE_MULTIPLIER,
      distanceFromSunAu * distanceFromSunAu,
    ),
  );
  return profile.baseExposure * inverseSquareCompensation;
}

export function adaptExposure(
  currentExposure: number,
  targetExposure: number,
  elapsedSeconds: number,
  halfLifeSeconds: number,
): number {
  for (const [name, value] of [
    ["Current exposure", currentExposure],
    ["Target exposure", targetExposure],
    ["Elapsed time", elapsedSeconds],
    ["Exposure half-life", halfLifeSeconds],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be positive and finite`);
    }
  }
  const retainedDifference = 2 ** (-elapsedSeconds / halfLifeSeconds);
  return (
    targetExposure + (currentExposure - targetExposure) * retainedDifference
  );
}
