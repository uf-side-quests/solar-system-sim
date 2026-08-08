import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  PointLight,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  type IUniform,
  type Object3D,
  Vector3,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

import { loadSbdbSnapshot } from "../catalogue/sbdb";
import type { BodyState, SimulationState } from "../physics/contracts";
import {
  ISS_BODY_ID,
  ISS_BOUNDING_RADIUS_M,
  ISS_EPOCH_SIMULATION_SECONDS,
  ISS_PARENT_BODY_ID,
  isIssEphemerisWithinValidity,
  issSnapshot,
} from "../physics/iss-ephemeris";
import {
  additionalAvailableKnownSatellites,
  knownSatelliteById,
  knownSatelliteSnapshot,
} from "../physics/known-satellites";
import {
  ASTRONOMICAL_UNIT_M,
  majorBodySnapshot,
} from "../physics/solar-system";
import {
  isVoyagerBodyId,
  voyagerById,
  voyagerSnapshot,
} from "../physics/voyager-ephemeris";
import {
  isOperationalSpacecraftBodyId,
  operationalSpacecraftSnapshot,
} from "../physics/operational-spacecraft";
import { focusDistanceAu, focusNearPlaneAu } from "./camera-focus";
import { GravityWellLayer } from "./GravityWellLayer";
import type {
  GravityPotentialSource,
  GravityWellMode,
  GravityWellScale,
} from "./gravity-potential";
import type { SimulationFrame } from "./interpolation";
import {
  bodyOrientationAngles,
  bodyOrientationQuaternion,
} from "./orientation";
import {
  apolloLandingSites,
  isApolloLandingSiteId,
  moonFixedSurfaceUnitVector,
} from "./lunar-landing-sites";
import {
  createApolloSurfaceSiteModel,
  MOON_SURFACE_RADIUS_M,
} from "./apollo-surface-model";
import type {
  CameraNavigationCommand,
  CameraOrientationPreset,
} from "./camera-view";
import { PARENT_BODY_ID } from "./body-facts";
import {
  formatViewpointSpeed,
  interpolateLogarithmicDistance,
  sampleDirectCameraTransition,
  sampleCameraTransition,
} from "./camera-transition";
import {
  JOVIAN_MONOLITH_BODY_ID,
  JOVIAN_MONOLITH_BOUNDING_RADIUS_M,
  JOVIAN_MONOLITH_DIMENSIONS_M,
  JOVIAN_MONOLITH_NAME,
  jovianMonolithState,
} from "./jovian-monolith";
import { createDeathStarModel } from "./death-star-model";
import {
  FICTIONAL_ORBITERS,
  fictionalOrbiterById,
  fictionalOrbiterStateById,
  isFictionalOrbiterId,
} from "./fictional-orbiters";
import { osculatingOrbitPositionsM } from "./osculating-orbit";
import { surfaceObserverViewpoint } from "./observer-camera";
import {
  DISCRETE_RING_SYSTEMS,
  discreteRingSystemExtent,
  isDiscreteRingBodyId,
  JUPITER_EQUATORIAL_RADIUS_KM,
  JUPITER_POLAR_RADIUS_KM,
  NEPTUNE_EQUATORIAL_RADIUS_KM,
  NEPTUNE_POLAR_RADIUS_KM,
  ringRadiusRatio,
  SATURN_EQUATORIAL_RADIUS_KM,
  SATURN_MAIN_RING_INNER_RADIUS_KM,
  SATURN_MAIN_RING_OUTER_RADIUS_KM,
  SATURN_POLAR_RADIUS_KM,
  URANUS_EQUATORIAL_RADIUS_KM,
  URANUS_POLAR_RADIUS_KM,
} from "./ring-system";
import { icrfToScene, j2000EclipticToScene } from "./reference-frames";
import {
  surfaceHorizonPoint,
  surfaceObserverFrame,
  type SurfaceObserverConfiguration,
  type SurfaceObserverFrame,
} from "./surface-observer";
import {
  isPhysicalBodyResolvable,
  nonOverlappingDisplayedRadiusAu,
} from "./scale";
import { SmallBodyGpuLayer } from "./SmallBodyGpuLayer";
import type { SmallBodyGpuStatus } from "./SmallBodyGpuLayer";
import { pointInsideViewport, rayToViewportEdge } from "./sun-guide";
import {
  hipparcosStarSnapshot,
  starDirectionIcrs,
  starDisplayColor,
  starDisplayOpacity,
  starDisplaySizeCssPixels,
} from "./star-catalogue";
import type { HipparcosStar } from "./star-catalogue";
import type { ObjectVisibility } from "./visibility";
import { isMajorBodyVisible } from "./visibility";
import {
  nearestPlanetWayfinders,
  wayfinderPlanetCount,
  type WayfinderMode,
} from "./wayfinder";
import {
  nasaEarthCloudAsset,
  nasaMaterialPresentationByBodyId,
  nasaMoonHeightAsset,
  nasaSaturnRingAsset,
  nasaTextureByBodyId,
} from "./visual-assets";
import type { ReferenceFrame, SemanticZoomLevel, ViewMode } from "./view-mode";
import {
  adaptExposure,
  solarExposureForDistanceAu,
  VISUAL_QUALITY_PROFILES,
  type VisualQuality,
} from "./visual-quality";
import { spacecraftAssets } from "./spacecraft-assets";
import {
  createRoadsterAndStarmanModel,
  ROADSTER_BODY_ID,
} from "./roadster-model";
import {
  eclipticDirection,
  eclipticSkyDirection,
  TROPICAL_ZODIAC_SIGNS,
} from "./zodiac";

const ECLIPTIC_NORTH = j2000EclipticToScene({ x: 0, y: 0, z: 1 }).normalize();
const ECLIPTIC_FORWARD = j2000EclipticToScene({ x: 0, y: 1, z: 0 }).normalize();
const ECLIPTIC_RIGHT = ECLIPTIC_FORWARD.clone()
  .cross(ECLIPTIC_NORTH)
  .normalize();
const PERSPECTIVE_CAMERA_DIRECTION = ECLIPTIC_FORWARD.clone()
  .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.48))
  .normalize();
const SOLAR_SYSTEM_CAMERA_POSITION =
  PERSPECTIVE_CAMERA_DIRECTION.clone().multiplyScalar(90);
const VOYAGER_MODEL_HGA_BORESIGHT = new Vector3(0, 1, 0);

function voyagerEarthPointingQuaternion(
  probePosition: Vector3,
  earthPosition: Vector3,
): Quaternion {
  const boresight = earthPosition.clone().sub(probePosition);
  if (boresight.lengthSq() <= Number.EPSILON) {
    throw new Error("Voyager and Earth positions cannot coincide");
  }
  boresight.normalize();
  let crossAxis = ECLIPTIC_NORTH.clone().cross(boresight);
  if (crossAxis.lengthSq() <= 1e-12) {
    crossAxis = ECLIPTIC_FORWARD.clone().cross(boresight);
  }
  crossAxis.normalize();
  const rollAxis = crossAxis.clone().cross(boresight).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(crossAxis, boresight, rollAxis),
  );
}

function interpolateCameraPositionAroundAnchor(
  outputPosition: Vector3,
  startPosition: Vector3,
  endPosition: Vector3,
  anchor: Vector3,
  progress: number,
): void {
  const startOffset = startPosition.clone().sub(anchor);
  const endOffset = endPosition.clone().sub(anchor);
  const startDistance = startOffset.length();
  const endDistance = endOffset.length();
  const distance = interpolateLogarithmicDistance(
    startDistance,
    endDistance,
    progress,
  );
  const startDirection = startOffset.normalize();
  const endDirection = endOffset.normalize();
  const completeRotation = new Quaternion().setFromUnitVectors(
    startDirection,
    endDirection,
  );
  const interpolatedRotation = new Quaternion().slerp(
    completeRotation,
    progress,
  );
  outputPosition
    .copy(startDirection)
    .applyQuaternion(interpolatedRotation)
    .multiplyScalar(distance)
    .add(anchor);
}
const MAX_MOON_TRAIL_POINTS = 8_192;
const MAX_PLANET_TRAIL_POINTS = 8_192;
const PLANET_TRAIL_BODY_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;
const LABEL_MINIMUM_RADIUS_PIXELS = 0.5;
const LABEL_CHARACTER_WIDTH_PX = 5;
const LABEL_HORIZONTAL_CHROME_PX = 14;
const LABEL_HALF_HEIGHT_PX = 9;
const SPACECRAFT_FOCUS_CLEARANCE = 6;
const DEFAULT_CAMERA_NEAR_AU = 0.000_001;
const DEFAULT_CAMERA_FAR_AU = 1_000_000;
const ALPHA_CENTAURI_DISTANCE_AU = 272_000;
const VOYAGER_1_HELIOPAUSE_AU = 122;
const VOYAGER_2_HELIOPAUSE_AU = 119;
const OORT_CLOUD_INNER_MIN_AU = 2_000;
const OORT_CLOUD_INNER_MAX_AU = 5_000;
const OORT_CLOUD_OUTER_MIN_AU = 10_000;
const OORT_CLOUD_OUTER_MAX_AU = 100_000;
const PREVIOUS_SOLAR_SYSTEM_VIEW_AU = 220;
const SMALL_BODY_GPU_UPDATE_INTERVAL_MS = 200;
const SUN_GUIDE_UPDATE_INTERVAL_MS = 100;
const STAR_SPHERE_RADIUS_AU = 1_500;
const ZODIAC_SPHERE_RADIUS_AU = STAR_SPHERE_RADIUS_AU * 0.985;
const STAR_TOOLTIP_DELAY_MS = 1_000;
const STAR_TOOLTIP_PICK_RADIUS_CSS_PIXELS = 7;
const STAR_COMMON_NAMES = new Map<number, string>([
  [32_349, "Sirius"],
  [71_683, "Alpha Centauri"],
  [91_262, "Vega"],
]);

function starTooltipText(star: HipparcosStar): string {
  const commonName = STAR_COMMON_NAMES.get(star.hipId);
  const title =
    commonName === undefined
      ? `HIP ${String(star.hipId)}`
      : `${commonName} · HIP ${String(star.hipId)}`;
  const colourIndex =
    star.colorIndexBv === null
      ? "B−V unavailable"
      : `B−V ${star.colorIndexBv.toFixed(2)}`;
  return `${title} · V ${star.visualMagnitude.toFixed(2)} · RA ${star.raDeg.toFixed(2)}° · Dec ${star.decDeg.toFixed(2)}° · ${colourIndex}`;
}
const JULIAN_YEAR_SECONDS = 365.25 * 86_400;
const SOLAR_SYSTEM_EPOCH_JULIAN_YEAR =
  2000 + (majorBodySnapshot.epoch.value - 2_451_545) / 365.25;
const majorBodyById = new Map(
  majorBodySnapshot.bodies.map((body) => [body.id, body]),
);

function spacecraftBoundingRadiusM(bodyId: string): number | undefined {
  if (bodyId === JOVIAN_MONOLITH_BODY_ID) {
    return JOVIAN_MONOLITH_BOUNDING_RADIUS_M;
  }
  const fictionalOrbiter = fictionalOrbiterById.get(
    isFictionalOrbiterId(bodyId) ? bodyId : "death-star-1",
  );
  if (isFictionalOrbiterId(bodyId)) {
    if (fictionalOrbiter === undefined) {
      throw new Error(`Fictional orbiter ${bodyId} is unavailable`);
    }
    return fictionalOrbiter.diameterM / 2;
  }
  const asset = spacecraftAssets.find(
    (candidate) => candidate.bodyId === bodyId,
  );
  const operationalSpacecraft = operationalSpacecraftSnapshot.spacecraft.find(
    (candidate) => candidate.id === bodyId,
  );
  return asset?.maximumDimensionM === undefined
    ? operationalSpacecraft?.maximumDimensionM === undefined
      ? undefined
      : operationalSpacecraft.maximumDimensionM / 2
    : asset.maximumDimensionM / 2;
}

function spacecraftFocusDistanceAu(bodyId: string): number {
  const radiusM = spacecraftBoundingRadiusM(bodyId);
  if (radiusM === undefined) {
    throw new Error(`Physical dimensions are unavailable for ${bodyId}`);
  }
  return (radiusM * SPACECRAFT_FOCUS_CLEARANCE) / ASTRONOMICAL_UNIT_M;
}

type TimedTrailPoint = Readonly<{
  position: Vector3;
  timeSeconds: number;
}>;

function writeTrailColors(
  colors: Float32Array,
  pointCount: number,
  fade: number,
  color: readonly [number, number, number],
): void {
  const denominator = Math.max(1, pointCount - 1);
  for (let index = 0; index < pointCount; index += 1) {
    const ageFraction = index / denominator;
    const brightness = 1 - fade * (1 - ageFraction) * 0.92;
    colors[index * 3] = color[0] * brightness;
    colors[index * 3 + 1] = color[1] * brightness;
    colors[index * 3 + 2] = color[2] * brightness;
  }
}

function scenePosition(positionM: readonly [number, number, number]): Vector3 {
  return icrfToScene({
    x: positionM[0] / ASTRONOMICAL_UNIT_M,
    y: positionM[1] / ASTRONOMICAL_UNIT_M,
    z: positionM[2] / ASTRONOMICAL_UNIT_M,
  });
}

function setRequiredNumberUniform(
  material: ShaderMaterial,
  name: string,
  value: number,
): void {
  const uniform: unknown = material.uniforms[name];
  if (
    typeof uniform !== "object" ||
    uniform === null ||
    !("value" in uniform) ||
    typeof uniform.value !== "number"
  ) {
    throw new Error(
      `Shader material is missing required numeric uniform ${name}`,
    );
  }
  uniform.value = value;
}

function requiredVectorUniform(
  material: ShaderMaterial,
  name: string,
): IUniform<Vector3> {
  const uniform: unknown = material.uniforms[name];
  if (
    typeof uniform !== "object" ||
    uniform === null ||
    !("value" in uniform)
  ) {
    throw new Error(
      `Shader material is missing required Vector3 uniform ${name}`,
    );
  }
  const value: unknown = uniform.value;
  if (!(value instanceof Vector3)) {
    throw new Error(
      `Shader material is missing required Vector3 uniform ${name}`,
    );
  }
  return { value };
}

function createSolarCoronaTexture(): CanvasTexture {
  const size = 512;
  const center = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Solar corona canvas context is unavailable");
  }

  const corona = context.createRadialGradient(
    center,
    center,
    size * 0.17,
    center,
    center,
    size * 0.49,
  );
  corona.addColorStop(0, "rgba(255, 244, 217, 0.36)");
  corona.addColorStop(0.42, "rgba(255, 213, 154, 0.11)");
  corona.addColorStop(0.72, "rgba(255, 190, 125, 0.025)");
  corona.addColorStop(1, "rgba(255, 180, 115, 0)");
  context.fillStyle = corona;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function bodyStateById(
  state: SimulationState,
  bodyId: string,
): BodyState | undefined {
  if (bodyId === JOVIAN_MONOLITH_BODY_ID) {
    return jovianMonolithState(state);
  }
  if (isFictionalOrbiterId(bodyId)) {
    return fictionalOrbiterStateById(state, bodyId);
  }
  return state.bodies.find((body) => body.id === bodyId);
}

function gravityFieldExtentAu(
  focusBodyId: string | null,
  bodyVisibility: number,
): number {
  if (focusBodyId === null || focusBodyId === "sun") {
    return 80;
  }
  if (focusBodyId === ISS_BODY_ID) {
    return 0.000_12;
  }
  if (
    isVoyagerBodyId(focusBodyId) ||
    isOperationalSpacecraftBodyId(focusBodyId) ||
    focusBodyId === JOVIAN_MONOLITH_BODY_ID ||
    isFictionalOrbiterId(focusBodyId)
  ) {
    return 0.000_001;
  }
  const definition = majorBodyById.get(focusBodyId);
  if (definition !== undefined) {
    return Math.max(
      focusDistanceAu(definition, bodyVisibility) * 1.2,
      (definition.meanRadiusM / ASTRONOMICAL_UNIT_M) * 24,
    );
  }
  if (knownSatelliteById.has(focusBodyId)) {
    return 0.006;
  }
  throw new Error(`Gravity field focus ${focusBodyId} is unavailable`);
}

function formatPotentialMagnitude(valueJPerKg: number): string {
  if (!Number.isFinite(valueJPerKg) || valueJPerKg <= 0) {
    throw new Error(
      "Gravity potential legend requires a positive finite value",
    );
  }
  return valueJPerKg.toExponential(2).replace("e+", "e");
}

function parentBodyId(bodyId: string): string | undefined {
  return bodyId === ISS_BODY_ID
    ? ISS_PARENT_BODY_ID
    : bodyId === "hubble"
      ? "earth"
      : bodyId === JOVIAN_MONOLITH_BODY_ID
        ? "jupiter"
        : isFictionalOrbiterId(bodyId)
          ? fictionalOrbiterById.get(bodyId)?.parentBodyId
          : bodyId === "jwst" || isVoyagerBodyId(bodyId)
            ? "sun"
            : (knownSatelliteById.get(bodyId)?.parentId ??
              PARENT_BODY_ID[bodyId]);
}

function formatTacticalDistance(distanceAu: number): string {
  if (distanceAu >= 0.1) {
    return `${distanceAu.toLocaleString(undefined, { maximumFractionDigits: 2 })} AU`;
  }
  const distanceKm = (distanceAu * ASTRONOMICAL_UNIT_M) / 1_000;
  if (distanceKm >= 1_000_000) {
    return `${(distanceKm / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} million km`;
  }
  return `${distanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
}

type SolarSystemSceneProps = Readonly<{
  frame: SimulationFrame | undefined;
  displayedStateRef: RefObject<SimulationState | undefined>;
  bodyVisibility: number;
  focusBodyId: string | null;
  selectedBodyId: string | null;
  apolloInspectionSiteId: string | null;
  showMoonTrail: boolean;
  showPlanetTrails: boolean;
  showMinorBodyTrails: boolean;
  referenceFrame: ReferenceFrame;
  trailDurationSeconds: number;
  trailFade: number;
  clearTrailsToken: number;
  showEclipticPlane: boolean;
  showZodiac: boolean;
  showLabels: boolean;
  showApolloSites: boolean;
  spacecraftLabelBodyIds: readonly string[] | undefined;
  resetViewToken: number;
  cameraZoom: number;
  cameraDistanceOverrideAu: number | undefined;
  cameraTargetBodyId: string | undefined;
  cameraTransitionSequence: number;
  cameraTransitionDurationMs: number;
  cameraTransitionAutoFrame: boolean;
  cameraTransitionOverviewAnchorBodyId: string | undefined;
  cameraTransitionOverviewDistanceAu: number;
  cameraNavigationCommand: CameraNavigationCommand;
  orientationPreset: CameraOrientationPreset;
  orientationPresetToken: number;
  viewMode: Exclude<ViewMode, "schematic">;
  showTacticalOverlay: boolean;
  showOrbitGuides: boolean;
  wayfinderMode: WayfinderMode;
  orbitGuideScope: "system" | "all";
  gravityWellMode: GravityWellMode;
  gravityWellScale: GravityWellScale;
  objectVisibility: ObjectVisibility;
  surfaceObserver: SurfaceObserverConfiguration | null;
  surfaceObserverLookResetToken: number;
  visualQuality: VisualQuality;
  deepSpacePresentation:
    "heliosphere-scale" | "oort-cloud-scale" | "interstellar-scale" | undefined;
  onSelectBody(bodyId: string): void;
  onFocusBody(bodyId: string): void;
  onOrientationChange(preset: CameraOrientationPreset): void;
  onSemanticZoomChange(level: SemanticZoomLevel): void;
  onViewZoomChange(zoom: number): void;
  onGpuStatus(status: SmallBodyGpuStatus): void;
  onGpuError(message: string): void;
}>;

export function SolarSystemScene({
  frame,
  displayedStateRef,
  bodyVisibility,
  focusBodyId,
  selectedBodyId,
  apolloInspectionSiteId,
  showMoonTrail,
  showPlanetTrails,
  showMinorBodyTrails,
  referenceFrame,
  trailDurationSeconds,
  trailFade,
  clearTrailsToken,
  showEclipticPlane,
  showZodiac,
  showLabels,
  showApolloSites,
  spacecraftLabelBodyIds,
  resetViewToken,
  cameraZoom,
  cameraDistanceOverrideAu,
  cameraTargetBodyId,
  cameraTransitionSequence,
  cameraTransitionDurationMs,
  cameraTransitionAutoFrame,
  cameraTransitionOverviewAnchorBodyId,
  cameraTransitionOverviewDistanceAu,
  cameraNavigationCommand,
  orientationPreset,
  orientationPresetToken,
  viewMode,
  showTacticalOverlay,
  showOrbitGuides,
  wayfinderMode,
  orbitGuideScope,
  gravityWellMode,
  gravityWellScale,
  objectVisibility,
  surfaceObserver,
  surfaceObserverLookResetToken,
  visualQuality,
  deepSpacePresentation,
  onSelectBody,
  onFocusBody,
  onOrientationChange,
  onSemanticZoomChange,
  onViewZoomChange,
  onGpuStatus,
  onGpuError,
}: SolarSystemSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const bodyVisibilityRef = useRef(bodyVisibility);
  const focusBodyIdRef = useRef(focusBodyId);
  const selectedBodyIdRef = useRef(selectedBodyId);
  const apolloInspectionSiteIdRef = useRef(apolloInspectionSiteId);
  const showMoonTrailRef = useRef(showMoonTrail);
  const showPlanetTrailsRef = useRef(showPlanetTrails);
  const showMinorBodyTrailsRef = useRef(showMinorBodyTrails);
  const referenceFrameRef = useRef(referenceFrame);
  const trailDurationSecondsRef = useRef(trailDurationSeconds);
  const trailFadeRef = useRef(trailFade);
  const clearTrailsTokenRef = useRef(clearTrailsToken);
  const showEclipticPlaneRef = useRef(showEclipticPlane);
  const showZodiacRef = useRef(showZodiac);
  const showLabelsRef = useRef(showLabels);
  const showApolloSitesRef = useRef(showApolloSites);
  const spacecraftLabelBodyIdsRef = useRef(spacecraftLabelBodyIds);
  const resetViewTokenRef = useRef(resetViewToken);
  const cameraZoomRef = useRef(cameraZoom);
  const cameraDistanceOverrideAuRef = useRef(cameraDistanceOverrideAu);
  const cameraTargetBodyIdRef = useRef(cameraTargetBodyId);
  const cameraTransitionSequenceRef = useRef(cameraTransitionSequence);
  const cameraTransitionDurationMsRef = useRef(cameraTransitionDurationMs);
  const cameraTransitionAutoFrameRef = useRef(cameraTransitionAutoFrame);
  const cameraTransitionOverviewAnchorBodyIdRef = useRef(
    cameraTransitionOverviewAnchorBodyId,
  );
  const cameraTransitionOverviewDistanceAuRef = useRef(
    cameraTransitionOverviewDistanceAu,
  );
  const cameraNavigationCommandRef = useRef(cameraNavigationCommand);
  const orientationPresetRef = useRef(orientationPreset);
  const orientationPresetTokenRef = useRef(orientationPresetToken);
  const viewModeRef = useRef(viewMode);
  const showTacticalOverlayRef = useRef(showTacticalOverlay);
  const showOrbitGuidesRef = useRef(showOrbitGuides);
  const wayfinderModeRef = useRef(wayfinderMode);
  const orbitGuideScopeRef = useRef(orbitGuideScope);
  const gravityWellModeRef = useRef(gravityWellMode);
  const gravityWellScaleRef = useRef(gravityWellScale);
  const objectVisibilityRef = useRef(objectVisibility);
  const surfaceObserverRef = useRef(surfaceObserver);
  const surfaceObserverLookResetTokenRef = useRef(
    surfaceObserverLookResetToken,
  );
  const visualQualityRef = useRef(visualQuality);
  const deepSpacePresentationRef = useRef(deepSpacePresentation);
  const onViewZoomChangeRef = useRef(onViewZoomChange);
  frameRef.current = frame;
  bodyVisibilityRef.current = bodyVisibility;
  focusBodyIdRef.current = focusBodyId;
  selectedBodyIdRef.current = selectedBodyId;
  apolloInspectionSiteIdRef.current = apolloInspectionSiteId;
  showMoonTrailRef.current = showMoonTrail;
  showPlanetTrailsRef.current = showPlanetTrails;
  showMinorBodyTrailsRef.current = showMinorBodyTrails;
  referenceFrameRef.current = referenceFrame;
  trailDurationSecondsRef.current = trailDurationSeconds;
  trailFadeRef.current = trailFade;
  clearTrailsTokenRef.current = clearTrailsToken;
  showEclipticPlaneRef.current = showEclipticPlane;
  showZodiacRef.current = showZodiac;
  showLabelsRef.current = showLabels;
  showApolloSitesRef.current = showApolloSites;
  spacecraftLabelBodyIdsRef.current = spacecraftLabelBodyIds;
  resetViewTokenRef.current = resetViewToken;
  cameraZoomRef.current = cameraZoom;
  cameraDistanceOverrideAuRef.current = cameraDistanceOverrideAu;
  cameraTargetBodyIdRef.current = cameraTargetBodyId;
  cameraTransitionSequenceRef.current = cameraTransitionSequence;
  cameraTransitionDurationMsRef.current = cameraTransitionDurationMs;
  cameraTransitionAutoFrameRef.current = cameraTransitionAutoFrame;
  cameraTransitionOverviewAnchorBodyIdRef.current =
    cameraTransitionOverviewAnchorBodyId;
  cameraTransitionOverviewDistanceAuRef.current =
    cameraTransitionOverviewDistanceAu;
  cameraNavigationCommandRef.current = cameraNavigationCommand;
  orientationPresetRef.current = orientationPreset;
  orientationPresetTokenRef.current = orientationPresetToken;
  viewModeRef.current = viewMode;
  showTacticalOverlayRef.current = showTacticalOverlay;
  showOrbitGuidesRef.current = showOrbitGuides;
  wayfinderModeRef.current = wayfinderMode;
  orbitGuideScopeRef.current = orbitGuideScope;
  gravityWellModeRef.current = gravityWellMode;
  gravityWellScaleRef.current = gravityWellScale;
  objectVisibilityRef.current = objectVisibility;
  surfaceObserverRef.current = surfaceObserver;
  surfaceObserverLookResetTokenRef.current = surfaceObserverLookResetToken;
  visualQualityRef.current = visualQuality;
  deepSpacePresentationRef.current = deepSpacePresentation;
  onViewZoomChangeRef.current = onViewZoomChange;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      throw new Error("Scene container is missing");
    }

    const scene = new Scene();
    const gravityWellLayer = new GravityWellLayer(scene, ECLIPTIC_NORTH);
    const camera = new PerspectiveCamera(
      45,
      1,
      DEFAULT_CAMERA_NEAR_AU,
      DEFAULT_CAMERA_FAR_AU,
    );
    camera.position.copy(SOLAR_SYSTEM_CAMERA_POSITION);
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure =
      VISUAL_QUALITY_PROFILES[visualQualityRef.current].baseExposure;
    renderer.domElement.className = "major-body-layer";
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        VISUAL_QUALITY_PROFILES[visualQualityRef.current].maximumPixelRatio,
      ),
    );
    container.append(renderer.domElement);
    const gpuCanvas = document.createElement("canvas");
    gpuCanvas.className = "small-body-layer";
    gpuCanvas.hidden = true;
    gpuCanvas.setAttribute("aria-hidden", "true");
    container.append(gpuCanvas);
    const labelLayer = document.createElement("div");
    labelLayer.className = "body-label-layer";
    container.append(labelLayer);
    const cameraJourney = document.createElement("div");
    cameraJourney.className = "camera-journey";
    cameraJourney.setAttribute("aria-live", "polite");
    cameraJourney.hidden = true;
    container.append(cameraJourney);
    const markerLayer = document.createElement("div");
    markerLayer.className = "body-marker-layer";
    markerLayer.setAttribute("aria-hidden", "true");
    container.append(markerLayer);
    const bodyMarkers = new Map<string, HTMLSpanElement>();
    for (const body of majorBodySnapshot.bodies) {
      const marker = document.createElement("span");
      marker.className = "orrery-marker";
      marker.hidden = true;
      markerLayer.append(marker);
      bodyMarkers.set(body.id, marker);
    }
    const focusedKnownMoonLabel = document.createElement("button");
    focusedKnownMoonLabel.type = "button";
    focusedKnownMoonLabel.className = "body-label";
    focusedKnownMoonLabel.hidden = true;
    focusedKnownMoonLabel.addEventListener("click", () => {
      const bodyId = focusedKnownMoonLabel.dataset["bodyId"];
      if (bodyId !== undefined) {
        onSelectBody(bodyId);
      }
    });
    focusedKnownMoonLabel.addEventListener("dblclick", () => {
      const bodyId = focusedKnownMoonLabel.dataset["bodyId"];
      if (bodyId !== undefined) {
        onFocusBody(bodyId);
      }
    });
    labelLayer.append(focusedKnownMoonLabel);
    const issLabel = document.createElement("button");
    issLabel.type = "button";
    issLabel.className = "body-label";
    issLabel.textContent = "International Space Station";
    issLabel.dataset["bodyId"] = ISS_BODY_ID;
    issLabel.setAttribute("aria-label", "Focus International Space Station");
    issLabel.title = "Click to select; double-click to focus";
    issLabel.addEventListener("click", () => onSelectBody(ISS_BODY_ID));
    issLabel.addEventListener("dblclick", () => onFocusBody(ISS_BODY_ID));
    issLabel.hidden = true;
    labelLayer.append(issLabel);
    const issMarker = document.createElement("span");
    issMarker.className = "orrery-marker";
    issMarker.hidden = true;
    markerLayer.append(issMarker);
    const voyagerLabels = new Map<string, HTMLButtonElement>();
    const voyagerMarkers = new Map<string, HTMLSpanElement>();
    for (const probe of voyagerSnapshot.probes) {
      const label = document.createElement("button");
      label.type = "button";
      label.className = "body-label";
      label.textContent = probe.name;
      label.dataset["bodyId"] = probe.id;
      label.setAttribute("aria-label", `Focus ${probe.name}`);
      label.title = "Click to select; double-click to focus";
      label.addEventListener("click", () => onSelectBody(probe.id));
      label.addEventListener("dblclick", () => onFocusBody(probe.id));
      label.hidden = true;
      labelLayer.append(label);
      voyagerLabels.set(probe.id, label);
      const marker = document.createElement("span");
      marker.className = "orrery-marker";
      marker.hidden = true;
      markerLayer.append(marker);
      voyagerMarkers.set(probe.id, marker);
    }
    const operationalSpacecraftLabels = new Map<string, HTMLButtonElement>();
    const operationalSpacecraftMarkers = new Map<string, HTMLSpanElement>();
    for (const spacecraft of operationalSpacecraftSnapshot.spacecraft) {
      const label = document.createElement("button");
      label.type = "button";
      label.className = "body-label";
      label.textContent = spacecraft.name;
      label.dataset["bodyId"] = spacecraft.id;
      label.setAttribute("aria-label", `Focus ${spacecraft.name}`);
      label.title = "Click to select; double-click to focus";
      label.addEventListener("click", () => onSelectBody(spacecraft.id));
      label.addEventListener("dblclick", () => onFocusBody(spacecraft.id));
      label.hidden = true;
      labelLayer.append(label);
      operationalSpacecraftLabels.set(spacecraft.id, label);
      const marker = document.createElement("span");
      marker.className = "orrery-marker";
      marker.hidden = true;
      markerLayer.append(marker);
      operationalSpacecraftMarkers.set(spacecraft.id, marker);
    }
    const apolloSiteLabels = new Map<string, HTMLButtonElement>();
    for (const site of apolloLandingSites) {
      const label = document.createElement("button");
      label.type = "button";
      label.className = "body-label apollo-site-label";
      label.textContent = site.mission;
      label.dataset["bodyId"] = site.id;
      label.setAttribute(
        "aria-label",
        `Select ${site.mission} landing site at ${site.siteName}`,
      );
      label.title = `${site.siteName} · click for mission details`;
      label.addEventListener("click", () => onSelectBody(site.id));
      label.hidden = true;
      labelLayer.append(label);
      apolloSiteLabels.set(site.id, label);
    }
    const tacticalOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    tacticalOverlay.classList.add("tactical-overlay");
    tacticalOverlay.setAttribute("aria-hidden", "true");
    const createTacticalLine = (className: string): SVGLineElement => {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.classList.add(className);
      tacticalOverlay.append(line);
      return line;
    };
    const parentConnection = createTacticalLine("tactical-parent-line");
    const planeDropLine = createTacticalLine("tactical-plane-line");
    const velocityVector = createTacticalLine("tactical-velocity-line");
    velocityVector.setAttribute("marker-end", "url(#tactical-arrow)");
    const definitions = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs",
    );
    const arrowMarker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    arrowMarker.id = "tactical-arrow";
    arrowMarker.setAttribute("viewBox", "0 0 10 10");
    arrowMarker.setAttribute("refX", "8");
    arrowMarker.setAttribute("refY", "5");
    arrowMarker.setAttribute("markerWidth", "5");
    arrowMarker.setAttribute("markerHeight", "5");
    arrowMarker.setAttribute("orient", "auto-start-reverse");
    const arrowPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowMarker.append(arrowPath);
    definitions.append(arrowMarker);
    tacticalOverlay.prepend(definitions);
    const rangeRings = Array.from({ length: 3 }, () => {
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.classList.add("tactical-range-ring");
      tacticalOverlay.append(circle);
      return circle;
    });
    container.append(tacticalOverlay);
    const focusBracket = document.createElement("div");
    focusBracket.className = "focus-bracket";
    focusBracket.setAttribute("aria-hidden", "true");
    focusBracket.hidden = true;
    container.append(focusBracket);
    const rangeLegend = document.createElement("span");
    rangeLegend.className = "range-legend";
    rangeLegend.hidden = true;
    container.append(rangeLegend);

    const sunGuideOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    sunGuideOverlay.classList.add("sun-guide-overlay");
    sunGuideOverlay.setAttribute("aria-hidden", "true");
    const sunGuideDefinitions = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs",
    );
    const sunGuideArrow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    sunGuideArrow.id = "sun-guide-arrow";
    sunGuideArrow.setAttribute("viewBox", "0 0 10 10");
    sunGuideArrow.setAttribute("refX", "8");
    sunGuideArrow.setAttribute("refY", "5");
    sunGuideArrow.setAttribute("markerWidth", "5");
    sunGuideArrow.setAttribute("markerHeight", "5");
    sunGuideArrow.setAttribute("orient", "auto");
    const sunGuideArrowPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    sunGuideArrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    sunGuideArrow.append(sunGuideArrowPath);
    sunGuideDefinitions.append(sunGuideArrow);
    const planetGuideArrow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "marker",
    );
    planetGuideArrow.id = "planet-guide-arrow";
    planetGuideArrow.setAttribute("viewBox", "0 0 10 10");
    planetGuideArrow.setAttribute("refX", "8");
    planetGuideArrow.setAttribute("refY", "5");
    planetGuideArrow.setAttribute("markerWidth", "5");
    planetGuideArrow.setAttribute("markerHeight", "5");
    planetGuideArrow.setAttribute("orient", "auto");
    const planetGuideArrowPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    planetGuideArrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    planetGuideArrow.append(planetGuideArrowPath);
    sunGuideDefinitions.append(planetGuideArrow);
    sunGuideOverlay.append(sunGuideDefinitions);
    const sunGuideLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    sunGuideLine.classList.add("wayfinder-line", "sun-guide-line");
    sunGuideLine.setAttribute("marker-end", "url(#sun-guide-arrow)");
    sunGuideOverlay.append(sunGuideLine);
    const sunGuideEndpoint = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    sunGuideEndpoint.classList.add("wayfinder-endpoint", "sun-guide-endpoint");
    sunGuideEndpoint.setAttribute("r", "3");
    sunGuideOverlay.append(sunGuideEndpoint);
    container.append(sunGuideOverlay);
    const sunGuideLabel = document.createElement("button");
    sunGuideLabel.type = "button";
    sunGuideLabel.className = "wayfinder-label sun-guide-label";
    sunGuideLabel.setAttribute("aria-label", "Focus Sun");
    sunGuideLabel.title = "Click to select; double-click to focus";
    sunGuideLabel.addEventListener("click", () => onSelectBody("sun"));
    sunGuideLabel.addEventListener("dblclick", () => onFocusBody("sun"));
    sunGuideLabel.hidden = true;
    container.append(sunGuideLabel);
    const planetWayfinderVisuals = Array.from({ length: 2 }, (_, index) => {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.classList.add("wayfinder-line", "planet-guide-line");
      line.setAttribute("marker-end", "url(#planet-guide-arrow)");
      line.dataset["wayfinderRank"] = String(index + 1);
      sunGuideOverlay.append(line);
      const endpoint = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      endpoint.classList.add("wayfinder-endpoint", "planet-guide-endpoint");
      endpoint.setAttribute("r", "3");
      endpoint.dataset["wayfinderRank"] = String(index + 1);
      sunGuideOverlay.append(endpoint);
      const label = document.createElement("button");
      label.type = "button";
      label.className = "wayfinder-label planet-guide-label";
      label.dataset["wayfinderRank"] = String(index + 1);
      const labelBodyId = (): string => {
        const targetBodyId = label.dataset["targetBodyId"];
        if (targetBodyId === undefined || targetBodyId === "") {
          throw new Error("Planet wayfinder target is unavailable");
        }
        return targetBodyId;
      };
      label.addEventListener("click", () => onSelectBody(labelBodyId()));
      label.addEventListener("dblclick", () => onFocusBody(labelBodyId()));
      label.hidden = true;
      container.append(label);
      return { line, endpoint, label };
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    let interruptCameraTransition: () => void = () => undefined;
    const handleControlStart = (): void => {
      interruptCameraTransition();
      onOrientationChange("custom");
      container.dataset["cameraOrientation"] = "custom";
    };
    controls.addEventListener("start", handleControlStart);
    const ambientLight = new AmbientLight(0x7894b4, 0.045);
    scene.add(ambientLight);
    const sunlight = new PointLight(0xfff8ec, 7, 0, 2);
    sunlight.name = "Sunlight direction source";
    scene.add(sunlight);
    container.dataset["solarIlluminationModel"] = "inverse-square";

    const starGeometry = new BufferGeometry();
    const starCount = hipparcosStarSnapshot.stars.length;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starOpacities = new Float32Array(starCount);
    for (const [index, star] of hipparcosStarSnapshot.stars.entries()) {
      const color = starDisplayColor(star.colorIndexBv);
      starColors[index * 3] = color[0];
      starColors[index * 3 + 1] = color[1];
      starColors[index * 3 + 2] = color[2];
      starSizes[index] = starDisplaySizeCssPixels(star.visualMagnitude);
      starOpacities[index] = starDisplayOpacity(star.visualMagnitude);
    }
    const starPositionAttribute = new BufferAttribute(starPositions, 3);
    starPositionAttribute.setUsage(DynamicDrawUsage);
    starGeometry.setAttribute("position", starPositionAttribute);
    starGeometry.setAttribute("starColor", new BufferAttribute(starColors, 3));
    starGeometry.setAttribute("pointSize", new BufferAttribute(starSizes, 1));
    starGeometry.setAttribute(
      "pointOpacity",
      new BufferAttribute(starOpacities, 1),
    );
    const starMaterial = new ShaderMaterial({
      uniforms: {
        pixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute vec3 starColor;
        attribute float pointSize;
        attribute float pointOpacity;
        uniform float pixelRatio;
        varying vec3 vStarColor;
        varying float vPointOpacity;
        void main() {
          vStarColor = starColor;
          vPointOpacity = pointOpacity;
          gl_PointSize = pointSize * pixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vStarColor;
        varying float vPointOpacity;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float edge = 1.0 - smoothstep(0.28, 0.5, radius);
          if (edge <= 0.0) {
            discard;
          }
          gl_FragColor = vec4(vStarColor, vPointOpacity * edge);
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const stars = new Points(starGeometry, starMaterial);
    stars.name = "ESA Hipparcos ICRS visible-star catalogue";
    scene.add(stars);
    let lastStarUpdateJulianYear = Number.NaN;
    const updateStarPositions = (simulationTimeSeconds: number): void => {
      const julianYear =
        SOLAR_SYSTEM_EPOCH_JULIAN_YEAR +
        simulationTimeSeconds / JULIAN_YEAR_SECONDS;
      if (
        Number.isFinite(lastStarUpdateJulianYear) &&
        Math.abs(julianYear - lastStarUpdateJulianYear) < 1 / 365.25
      ) {
        return;
      }
      for (const [index, star] of hipparcosStarSnapshot.stars.entries()) {
        const direction = starDirectionIcrs(star, julianYear);
        starPositions[index * 3] = direction[0] * STAR_SPHERE_RADIUS_AU;
        starPositions[index * 3 + 1] = direction[2] * STAR_SPHERE_RADIUS_AU;
        starPositions[index * 3 + 2] = -direction[1] * STAR_SPHERE_RADIUS_AU;
      }
      starPositionAttribute.needsUpdate = true;
      lastStarUpdateJulianYear = julianYear;
      container.dataset["starEpochJulianYear"] = julianYear.toFixed(6);
    };
    updateStarPositions(0);
    const brightStarCandidateIndexes = hipparcosStarSnapshot.stars
      .map((star, index) => ({ index, magnitude: star.visualMagnitude }))
      .sort((left, right) => left.magnitude - right.magnitude)
      .slice(0, 96)
      .map(({ index }) => index);

    const unitSphere = new SphereGeometry(1, 256, 192);
    const bodyMeshes = new Map<string, Mesh>();
    const atmosphereMeshes = new Map<string, Mesh>();
    const atmosphereMaterials = new Map<string, ShaderMaterial>();
    const surfaceMaterials = new Map<string, MeshStandardMaterial>();
    const ringVisuals = new Map<
      string,
      Readonly<{
        referenceMesh: Mesh;
        materials: readonly ShaderMaterial[];
        surfaceShadowSunDirectionLocal?: IUniform<Vector3>;
      }>
    >();
    const bodyLabels = new Map<string, HTMLButtonElement>();
    const additionalSelectableMeshes: Mesh[] = [];
    const materials: Material[] = [starMaterial];
    const geometries: BufferGeometry[] = [unitSphere, starGeometry];
    const textures: Texture[] = [];

    const monolithGeometry = new BoxGeometry(
      JOVIAN_MONOLITH_DIMENSIONS_M.thickness / ASTRONOMICAL_UNIT_M,
      JOVIAN_MONOLITH_DIMENSIONS_M.length / ASTRONOMICAL_UNIT_M,
      JOVIAN_MONOLITH_DIMENSIONS_M.width / ASTRONOMICAL_UNIT_M,
    );
    const monolithMaterial = new MeshStandardMaterial({
      color: 0x020303,
      roughness: 0.28,
      metalness: 0.16,
    });
    const monolithMesh = new Mesh(monolithGeometry, monolithMaterial);
    monolithMesh.name = JOVIAN_MONOLITH_NAME;
    monolithMesh.userData["bodyId"] = JOVIAN_MONOLITH_BODY_ID;
    monolithMesh.visible = false;
    bodyMeshes.set(JOVIAN_MONOLITH_BODY_ID, monolithMesh);
    scene.add(monolithMesh);
    geometries.push(monolithGeometry);
    materials.push(monolithMaterial);

    const monolithLabel = document.createElement("button");
    monolithLabel.type = "button";
    monolithLabel.className = "body-label";
    monolithLabel.textContent = JOVIAN_MONOLITH_NAME;
    monolithLabel.dataset["bodyId"] = JOVIAN_MONOLITH_BODY_ID;
    monolithLabel.setAttribute("aria-label", `Focus ${JOVIAN_MONOLITH_NAME}`);
    monolithLabel.title = "Click to select; double-click to focus";
    monolithLabel.addEventListener("click", () =>
      onSelectBody(JOVIAN_MONOLITH_BODY_ID),
    );
    monolithLabel.addEventListener("dblclick", () =>
      onFocusBody(JOVIAN_MONOLITH_BODY_ID),
    );
    monolithLabel.hidden = true;
    labelLayer.append(monolithLabel);
    bodyLabels.set(JOVIAN_MONOLITH_BODY_ID, monolithLabel);
    const monolithMarker = document.createElement("span");
    monolithMarker.className = "orrery-marker";
    monolithMarker.hidden = true;
    markerLayer.append(monolithMarker);
    bodyMarkers.set(JOVIAN_MONOLITH_BODY_ID, monolithMarker);
    container.dataset["jovianMonolithPhysics"] =
      "display-only-jupiter-io-l1-no-gravity";
    container.dataset["jovianMonolithDimensionsM"] = [
      JOVIAN_MONOLITH_DIMENSIONS_M.thickness,
      JOVIAN_MONOLITH_DIMENSIONS_M.width,
      JOVIAN_MONOLITH_DIMENSIONS_M.length,
    ]
      .map((value) => value.toFixed(3))
      .join(",");

    const fictionalOrbiterGroups = new Map<string, Group>();
    const fictionalOrbiterLabels = new Map<string, HTMLButtonElement>();
    const fictionalOrbiterMarkers = new Map<string, HTMLSpanElement>();
    for (const orbiter of FICTIONAL_ORBITERS) {
      const group = createDeathStarModel(orbiter);
      group.visible = false;
      scene.add(group);
      fictionalOrbiterGroups.set(orbiter.id, group);
      group.traverse((object) => {
        if (object.type === "Mesh") {
          const modelMesh = object as Mesh;
          additionalSelectableMeshes.push(modelMesh);
          geometries.push(modelMesh.geometry);
          const objectMaterials = Array.isArray(modelMesh.material)
            ? modelMesh.material
            : [modelMesh.material];
          materials.push(...objectMaterials);
        }
      });
      const label = document.createElement("button");
      label.type = "button";
      label.className = "body-label fictional-object-label";
      label.textContent = orbiter.name;
      label.dataset["bodyId"] = orbiter.id;
      label.setAttribute("aria-label", `Focus ${orbiter.name}`);
      label.title = "Click to select; double-click to focus";
      label.addEventListener("click", () => onSelectBody(orbiter.id));
      label.addEventListener("dblclick", () => onFocusBody(orbiter.id));
      label.hidden = true;
      labelLayer.append(label);
      fictionalOrbiterLabels.set(orbiter.id, label);
      const marker = document.createElement("span");
      marker.className = "orrery-marker";
      marker.hidden = true;
      markerLayer.append(marker);
      fictionalOrbiterMarkers.set(orbiter.id, marker);
    }
    container.dataset["fictionalOrbiterPhysics"] =
      "hypothetical-massless-two-body-no-gravity-backreaction";
    container.dataset["fictionalOrbiterCount"] = String(
      FICTIONAL_ORBITERS.length,
    );

    const zodiacGroup = new Group();
    zodiacGroup.name = "Tropical zodiac reference on the J2000 ecliptic";
    zodiacGroup.visible = false;
    scene.add(zodiacGroup);
    const zodiacCirclePositions = new Float32Array(360 * 3);
    for (let longitudeDeg = 0; longitudeDeg < 360; longitudeDeg += 1) {
      const [x, y, z] = eclipticDirection(longitudeDeg);
      const direction = j2000EclipticToScene({ x, y, z }).multiplyScalar(
        ZODIAC_SPHERE_RADIUS_AU,
      );
      const offset = longitudeDeg * 3;
      zodiacCirclePositions[offset] = direction.x;
      zodiacCirclePositions[offset + 1] = direction.y;
      zodiacCirclePositions[offset + 2] = direction.z;
    }
    const zodiacCircleGeometry = new BufferGeometry();
    zodiacCircleGeometry.setAttribute(
      "position",
      new BufferAttribute(zodiacCirclePositions, 3),
    );
    const zodiacMaterial = new LineBasicMaterial({
      color: 0xd8b770,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      toneMapped: false,
    });
    const zodiacCircle = new LineLoop(zodiacCircleGeometry, zodiacMaterial);
    zodiacCircle.name = "Twelve-sign tropical zodiac ecliptic circle";
    zodiacGroup.add(zodiacCircle);

    const zodiacTickPositions = new Float32Array(
      TROPICAL_ZODIAC_SIGNS.length * 2 * 3,
    );
    for (const [index, sign] of TROPICAL_ZODIAC_SIGNS.entries()) {
      const [innerX, innerY, innerZ] = eclipticSkyDirection(
        sign.startLongitudeDeg,
        -10,
      );
      const [outerX, outerY, outerZ] = eclipticSkyDirection(
        sign.startLongitudeDeg,
        10,
      );
      const inner = j2000EclipticToScene({
        x: innerX,
        y: innerY,
        z: innerZ,
      }).multiplyScalar(ZODIAC_SPHERE_RADIUS_AU);
      const outer = j2000EclipticToScene({
        x: outerX,
        y: outerY,
        z: outerZ,
      }).multiplyScalar(ZODIAC_SPHERE_RADIUS_AU);
      const offset = index * 6;
      zodiacTickPositions.set([inner.x, inner.y, inner.z], offset);
      zodiacTickPositions.set([outer.x, outer.y, outer.z], offset + 3);
    }
    const zodiacTickGeometry = new BufferGeometry();
    zodiacTickGeometry.setAttribute(
      "position",
      new BufferAttribute(zodiacTickPositions, 3),
    );
    const zodiacTicks = new LineSegments(zodiacTickGeometry, zodiacMaterial);
    zodiacTicks.name = "Tropical zodiac thirty-degree boundaries";
    zodiacGroup.add(zodiacTicks);
    const zodiacLabels = TROPICAL_ZODIAC_SIGNS.map((sign, index) => {
      const [x, y, z] = eclipticSkyDirection(
        sign.centreLongitudeDeg,
        index % 2 === 0 ? 14 : -14,
      );
      const label = document.createElement("span");
      label.className = "zodiac-label";
      label.textContent = `${sign.glyph}\uFE0E ${sign.name}`;
      label.dataset["zodiacSign"] = sign.name;
      label.setAttribute("aria-hidden", "true");
      label.hidden = true;
      container.append(label);
      return {
        element: label,
        direction: j2000EclipticToScene({ x, y, z }).normalize(),
      };
    });
    const zodiacLegend = document.createElement("div");
    zodiacLegend.className = "zodiac-legend";
    zodiacLegend.setAttribute("aria-label", "Twelve tropical zodiac signs");
    const zodiacLegendTitle = document.createElement("strong");
    zodiacLegendTitle.textContent = "ZODIAC SKY REFERENCE";
    zodiacLegend.append(zodiacLegendTitle);
    const zodiacLegendSigns = document.createElement("div");
    for (const sign of TROPICAL_ZODIAC_SIGNS) {
      const item = document.createElement("span");
      item.textContent = `${sign.glyph}\uFE0E ${sign.name}`;
      zodiacLegendSigns.append(item);
    }
    zodiacLegend.append(zodiacLegendSigns);
    zodiacLegend.hidden = true;
    container.append(zodiacLegend);
    geometries.push(zodiacCircleGeometry, zodiacTickGeometry);
    materials.push(zodiacMaterial);
    container.dataset["zodiacReference"] =
      "tropical-twelve-equal-signs-on-j2000-ecliptic";
    container.dataset["zodiacSignCount"] = String(TROPICAL_ZODIAC_SIGNS.length);
    container.dataset["zodiacSolarSystemParallax"] =
      "negligible-at-display-scale";

    const alphaCentauri = hipparcosStarSnapshot.stars.find(
      (star) => star.hipId === 71_683,
    );
    if (alphaCentauri === undefined) {
      throw new Error("Alpha Centauri is missing from the Hipparcos snapshot");
    }
    const alphaDirectionIcrs = starDirectionIcrs(alphaCentauri, 2000);
    const alphaCentauriOffset = new Vector3(
      alphaDirectionIcrs[0],
      alphaDirectionIcrs[2],
      -alphaDirectionIcrs[1],
    ).multiplyScalar(ALPHA_CENTAURI_DISTANCE_AU);
    const deepSpaceGroup = new Group();
    deepSpaceGroup.name = "Solar outer regions and Alpha Centauri scale";
    scene.add(deepSpaceGroup);
    const makeBoundarySphere = (
      radiusAu: number,
      color: number,
      opacity: number,
    ): Mesh => {
      const geometry = new SphereGeometry(radiusAu, 64, 40);
      const tint = new Color(color);
      const material = new ShaderMaterial({
        uniforms: {
          boundaryColor: { value: tint },
          boundaryOpacity: { value: opacity },
        },
        vertexShader: `
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 boundaryColor;
          uniform float boundaryOpacity;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormalView, vViewDirection)), 3.2);
            float alpha = boundaryOpacity * (0.08 + rim * 0.92);
            gl_FragColor = vec4(boundaryColor, alpha);
          }
        `,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const sphere = new Mesh(geometry, material);
      deepSpaceGroup.add(sphere);
      geometries.push(geometry);
      materials.push(material);
      return sphere;
    };
    const terminationShock = makeBoundarySphere(90, 0x64b5df, 0.16);
    terminationShock.name = "Approximate termination shock";
    const heliopause = makeBoundarySphere(120, 0x7cd6ff, 0.32);
    heliopause.name = "Approximate heliopause";
    const innerOortBoundary = makeBoundarySphere(
      OORT_CLOUD_INNER_MIN_AU,
      0x8fa8d7,
      0.12,
    );
    const outerOortBoundary = makeBoundarySphere(
      OORT_CLOUD_OUTER_MAX_AU,
      0xaebde8,
      0.2,
    );
    const oortPositions = new Float32Array(8_000 * 3);
    const deterministicUnit = (seed: number): number => {
      const value = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
      return value - Math.floor(value);
    };
    for (let index = 0; index < 8_000; index += 1) {
      const unit = deterministicUnit(index * 3 + 1);
      const radius =
        OORT_CLOUD_INNER_MIN_AU +
        Math.cbrt(unit) * (OORT_CLOUD_OUTER_MAX_AU - OORT_CLOUD_INNER_MIN_AU);
      const z = 1 - 2 * deterministicUnit(index * 3 + 2);
      const angle = deterministicUnit(index * 3 + 3) * Math.PI * 2;
      const radial = Math.sqrt(1 - z * z);
      oortPositions[index * 3] = radius * radial * Math.cos(angle);
      oortPositions[index * 3 + 1] = radius * z;
      oortPositions[index * 3 + 2] = radius * radial * Math.sin(angle);
    }
    const oortGeometry = new BufferGeometry();
    oortGeometry.setAttribute(
      "position",
      new BufferAttribute(oortPositions, 3),
    );
    const oortMaterial = new PointsMaterial({
      color: 0xaec6ee,
      size: 0.85,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      toneMapped: false,
    });
    const oortCloud = new Points(oortGeometry, oortMaterial);
    oortCloud.name = "Illustrative Oort Cloud population";
    deepSpaceGroup.add(oortCloud);
    geometries.push(oortGeometry);
    materials.push(oortMaterial);
    const alphaGeometry = new BufferGeometry();
    alphaGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(alphaCentauriOffset.toArray()), 3),
    );
    const alphaMaterial = new PointsMaterial({
      color: 0xffe2aa,
      size: 9,
      sizeAttenuation: false,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    const alphaMarker = new Points(alphaGeometry, alphaMaterial);
    alphaMarker.name = "Alpha Centauri Hipparcos locator";
    deepSpaceGroup.add(alphaMarker);
    geometries.push(alphaGeometry);
    materials.push(alphaMaterial);
    const surfaceHorizonGeometry = new BufferGeometry();
    const surfaceHorizonPositions = new Float32Array(96 * 3);
    const surfaceHorizonPositionAttribute = new BufferAttribute(
      surfaceHorizonPositions,
      3,
    );
    surfaceHorizonPositionAttribute.setUsage(DynamicDrawUsage);
    surfaceHorizonGeometry.setAttribute(
      "position",
      surfaceHorizonPositionAttribute,
    );
    const surfaceHorizonMaterial = new LineBasicMaterial({
      color: 0x9bd7ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const surfaceHorizon = new LineLoop(
      surfaceHorizonGeometry,
      surfaceHorizonMaterial,
    );
    surfaceHorizon.name = "Geometric surface horizon guide";
    surfaceHorizon.visible = false;
    scene.add(surfaceHorizon);
    geometries.push(surfaceHorizonGeometry);
    materials.push(surfaceHorizonMaterial);
    const compassLabels = new Map<number, HTMLSpanElement>();
    for (const [azimuthDeg, labelText] of [
      [0, "N"],
      [90, "E"],
      [180, "S"],
      [270, "W"],
    ] as const) {
      const label = document.createElement("span");
      label.className = "surface-compass-label";
      label.textContent = labelText;
      label.hidden = true;
      labelLayer.append(label);
      compassLabels.set(azimuthDeg, label);
    }
    const textureLoader = new TextureLoader();
    const loadedTextures = new WeakSet<Texture>();
    const textureRequestedBodyIds = new Set<string>();
    const loadedSurfaceAssetBodyIds = new Set<string>();
    const loadTexture = (
      url: string,
      isColor: boolean,
      onLoad?: () => void,
      onError?: () => void,
    ): Texture => {
      const texture = textureLoader.load(
        url,
        (loadedTexture) => {
          loadedTextures.add(loadedTexture);
          onLoad?.();
        },
        undefined,
        onError,
      );
      if (isColor) {
        texture.colorSpace = SRGBColorSpace;
      }
      texture.anisotropy = Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        VISUAL_QUALITY_PROFILES[visualQualityRef.current]
          .textureAnisotropyLimit,
      );
      textures.push(texture);
      return texture;
    };

    const solarCoronaTexture = createSolarCoronaTexture();
    textures.push(solarCoronaTexture);
    let solarCoronaMaterial: SpriteMaterial | undefined;
    let earthCloudMaterial: MeshStandardMaterial | undefined;

    const atmospherePresentations: Readonly<
      Record<
        string,
        Readonly<{
          rayleighColor: number;
          mieColor: number;
          rayleighStrength: number;
          mieStrength: number;
          mieG: number;
        }>
      >
    > = {
      earth: {
        rayleighColor: 0x4e9cff,
        mieColor: 0xffd5ad,
        rayleighStrength: 0.42,
        mieStrength: 0.1,
        mieG: 0.74,
      },
      venus: {
        rayleighColor: 0xf1d8ab,
        mieColor: 0xffb56f,
        rayleighStrength: 0.32,
        mieStrength: 0.28,
        mieG: 0.8,
      },
      mars: {
        rayleighColor: 0xc98262,
        mieColor: 0xf0ad72,
        rayleighStrength: 0.12,
        mieStrength: 0.16,
        mieG: 0.72,
      },
      jupiter: {
        rayleighColor: 0xd9c4a8,
        mieColor: 0xffe3bd,
        rayleighStrength: 0.09,
        mieStrength: 0.08,
        mieG: 0.68,
      },
      saturn: {
        rayleighColor: 0xe1cca4,
        mieColor: 0xffe5b6,
        rayleighStrength: 0.1,
        mieStrength: 0.09,
        mieG: 0.7,
      },
      uranus: {
        rayleighColor: 0x91dfe7,
        mieColor: 0xd8fbff,
        rayleighStrength: 0.13,
        mieStrength: 0.05,
        mieG: 0.65,
      },
      neptune: {
        rayleighColor: 0x4b78e8,
        mieColor: 0xb5ceff,
        rayleighStrength: 0.15,
        mieStrength: 0.05,
        mieG: 0.66,
      },
      titan: {
        rayleighColor: 0xc78643,
        mieColor: 0xf3a24c,
        rayleighStrength: 0.1,
        mieStrength: 0.34,
        mieG: 0.82,
      },
    };

    for (const body of majorBodySnapshot.bodies) {
      const asset = nasaTextureByBodyId.get(body.id);
      const materialPresentation = nasaMaterialPresentationByBodyId.get(
        body.id,
      );
      let material: Material;
      if (body.type === "star") {
        material = new ShaderMaterial({
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              vUv = uv;
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewPosition = viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }
          `,
          fragmentShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            float hash(vec2 point) {
              return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
            }

            float noise(vec2 point) {
              vec2 cell = floor(point);
              vec2 local = fract(point);
              local = local * local * (3.0 - 2.0 * local);
              return mix(
                mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
                mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
                local.y
              );
            }

            float fbm(vec2 point) {
              float value = 0.0;
              float amplitude = 0.5;
              mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
              for (int octave = 0; octave < 4; octave++) {
                value += noise(point) * amplitude;
                point = rotation * point * 2.03 + vec2(13.4, 7.9);
                amplitude *= 0.5;
              }
              return value;
            }

            void main() {
              float granulation = fbm(vUv * vec2(240.0, 120.0));
              float largerCells = fbm(vUv * vec2(54.0, 27.0) + vec2(8.7, 3.1));
              float limb = max(dot(vNormal, normalize(-vViewPosition)), 0.0);
              vec3 granuleEdge = vec3(0.92, 0.46, 0.08);
              vec3 warmWhite = vec3(1.0, 0.94, 0.78);
              vec3 photosphere = vec3(1.0, 0.78, 0.38);
              float cellContrast = smoothstep(0.28, 0.76, granulation);
              vec3 color = mix(granuleEdge, photosphere, 0.68 + cellContrast * 0.25);
              color = mix(color, warmWhite, smoothstep(0.45, 0.82, largerCells) * 0.38);
              color *= 0.56 + pow(limb, 0.5) * 0.48;
              gl_FragColor = vec4(color, 1.0);
            }
          `,
          toneMapped: false,
        });
      } else {
        const surfaceMaterial = new MeshStandardMaterial({
          color:
            asset !== undefined
              ? 0xffffff
              : (materialPresentation?.color ?? 0x9a9a9a),
          roughness: body.type === "moon" ? 0.92 : 0.74,
          metalness: 0,
        });
        surfaceMaterials.set(body.id, surfaceMaterial);
        material = surfaceMaterial;
      }
      materials.push(material);
      const mesh = new Mesh(unitSphere, material);
      mesh.name = body.name;
      mesh.userData["bodyId"] = body.id;
      bodyMeshes.set(body.id, mesh);
      scene.add(mesh);

      if (body.type === "star") {
        const chromosphereMaterial = new ShaderMaterial({
          uniforms: {
            glowColor: { value: new Color(0xffb066) },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewPosition = viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }
          `,
          fragmentShader: `
            uniform vec3 glowColor;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              float rim = pow(1.0 - max(dot(vNormal, normalize(-vViewPosition)), 0.0), 5.0);
              gl_FragColor = vec4(glowColor, rim * 0.075);
            }
          `,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        materials.push(chromosphereMaterial);
        const chromosphere = new Mesh(unitSphere, chromosphereMaterial);
        chromosphere.name = "Sun chromosphere presentation rim";
        chromosphere.userData["bodyId"] = body.id;
        chromosphere.scale.setScalar(1.018);
        mesh.add(chromosphere);

        const coronaMaterial = new SpriteMaterial({
          map: solarCoronaTexture,
          color: 0xfff0d4,
          transparent: true,
          opacity:
            VISUAL_QUALITY_PROFILES[visualQualityRef.current].coronaOpacity,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
        });
        solarCoronaMaterial = coronaMaterial;
        materials.push(coronaMaterial);
        const corona = new Sprite(coronaMaterial);
        corona.name = "Sun procedural corona presentation";
        corona.userData["bodyId"] = body.id;
        corona.scale.set(2.12, 2.12, 1);
        corona.renderOrder = -1;
        mesh.add(corona);

        container.dataset["solarPresentation"] = "procedural-non-observational";
        container.dataset["solarPhotosphere"] = "procedural-granulation";
        container.dataset["solarCoronaLayers"] = "2";
        container.dataset["solarProminenceCount"] = "0";
      }

      const label = document.createElement("button");
      label.type = "button";
      label.className = "body-label";
      label.textContent = body.name;
      label.dataset["bodyId"] = body.id;
      label.setAttribute("aria-label", `Focus ${body.name}`);
      label.title = "Click to select; double-click to focus";
      label.addEventListener("click", () => onSelectBody(body.id));
      label.addEventListener("dblclick", () => onFocusBody(body.id));
      label.dataset["surfaceAssetState"] =
        body.type === "star"
          ? "procedural"
          : asset !== undefined
            ? "pending"
            : materialPresentation !== undefined
              ? "material"
              : "neutral";
      labelLayer.append(label);
      bodyLabels.set(body.id, label);

      const atmospherePresentation = atmospherePresentations[body.id];
      if (atmospherePresentation !== undefined) {
        const atmosphereMaterial = new ShaderMaterial({
          uniforms: {
            rayleighColor: {
              value: new Color(atmospherePresentation.rayleighColor),
            },
            mieColor: { value: new Color(atmospherePresentation.mieColor) },
            rayleighStrength: {
              value: atmospherePresentation.rayleighStrength,
            },
            mieStrength: { value: atmospherePresentation.mieStrength },
            mieG: { value: atmospherePresentation.mieG },
            qualityStrength: {
              value:
                VISUAL_QUALITY_PROFILES[visualQualityRef.current]
                  .atmosphereStrength,
            },
            solarFlux: { value: 1 },
            sunPositionWorld: { value: sunlight.position },
          },
          vertexShader: `
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewNormal;
            varying vec3 vViewPosition;
            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vWorldNormal = normalize(mat3(modelMatrix) * normal);
              vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
              vViewNormal = normalize(normalMatrix * normal);
              vViewPosition = viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }
          `,
          fragmentShader: `
            const float PI = 3.141592653589793;
            uniform vec3 rayleighColor;
            uniform vec3 mieColor;
            uniform float rayleighStrength;
            uniform float mieStrength;
            uniform float mieG;
            uniform float qualityStrength;
            uniform float solarFlux;
            uniform vec3 sunPositionWorld;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewNormal;
            varying vec3 vViewPosition;
            void main() {
              vec3 normal = normalize(vWorldNormal);
              vec3 lightDirection = normalize(sunPositionWorld - vWorldPosition);
              vec3 viewDirection = normalize(-vViewPosition);
              float viewCosine = max(
                dot(normalize(vViewNormal), viewDirection),
                0.0
              );
              float tangentPath = pow(1.0 - viewCosine, 0.58);
              float sunCosine = dot(normal, lightDirection);
              float daylight = smoothstep(-0.24, 0.18, sunCosine);
              float scatteringAngleCosine = dot(viewDirection, lightDirection);
              float rayleighPhase =
                3.0 * (1.0 + scatteringAngleCosine * scatteringAngleCosine) /
                (16.0 * PI);
              float mieDenominator = max(
                1.0 + mieG * mieG - 2.0 * mieG * scatteringAngleCosine,
                0.001
              );
              float miePhase =
                (1.0 - mieG * mieG) /
                (4.0 * PI * pow(mieDenominator, 1.5));
              vec3 scattering =
                rayleighColor * rayleighStrength * rayleighPhase +
                mieColor * mieStrength * min(miePhase, 2.4);
              float opticalDepth =
                tangentPath * daylight * qualityStrength * solarFlux;
              float alpha = clamp(
                opticalDepth * (rayleighStrength + mieStrength) * 2.1,
                0.0,
                0.62
              );
              gl_FragColor = vec4(scattering * opticalDepth * 3.4, alpha);
            }
          `,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        materials.push(atmosphereMaterial);
        const atmosphere = new Mesh(unitSphere, atmosphereMaterial);
        atmosphere.name = `${body.name} atmosphere visualization`;
        atmosphere.scale.setScalar(
          body.id === "earth" ? 1.025 : body.type === "moon" ? 1.02 : 1.012,
        );
        mesh.add(atmosphere);
        atmosphereMeshes.set(body.id, atmosphere);
        atmosphereMaterials.set(body.id, atmosphereMaterial);
        container.dataset["atmosphereModel"] =
          "sunlit-single-scattering-approximation";
      }

      if (body.id === "saturn" || isDiscreteRingBodyId(body.id)) {
        if (body.id === "saturn" && nasaSaturnRingAsset === undefined) {
          throw new Error("Cassini Saturn ring profile is missing");
        }
        const observedRingProfile =
          body.id === "saturn" ? nasaSaturnRingAsset : undefined;
        const discreteRingSystem = isDiscreteRingBodyId(body.id)
          ? DISCRETE_RING_SYSTEMS[body.id]
          : undefined;
        const discreteRingExtent =
          discreteRingSystem === undefined
            ? undefined
            : discreteRingSystemExtent(discreteRingSystem);
        const innerRadius =
          body.id === "saturn"
            ? ringRadiusRatio(
                SATURN_MAIN_RING_INNER_RADIUS_KM,
                SATURN_EQUATORIAL_RADIUS_KM,
              )
            : ringRadiusRatio(
                discreteRingExtent?.innerRadiusKm ??
                  (() => {
                    throw new Error(`${body.name} ring extent is missing`);
                  })(),
                discreteRingSystem?.equatorialRadiusKm ??
                  (() => {
                    throw new Error(`${body.name} ring scale is missing`);
                  })(),
              );
        const outerRadius =
          body.id === "saturn"
            ? ringRadiusRatio(
                SATURN_MAIN_RING_OUTER_RADIUS_KM,
                SATURN_EQUATORIAL_RADIUS_KM,
              )
            : ringRadiusRatio(
                discreteRingExtent?.outerRadiusKm ??
                  (() => {
                    throw new Error(`${body.name} ring extent is missing`);
                  })(),
                discreteRingSystem?.equatorialRadiusKm ??
                  (() => {
                    throw new Error(`${body.name} ring scale is missing`);
                  })(),
              );
        const ringGeometry = new RingGeometry(innerRadius, outerRadius, 192);
        ringGeometry.rotateX(Math.PI / 2);
        geometries.push(ringGeometry);
        let observedRingTexture: Texture | undefined;
        if (observedRingProfile !== undefined) {
          container.dataset["saturnRingAssetState"] = "loading";
          observedRingTexture = loadTexture(
            observedRingProfile.file,
            true,
            () => {
              container.dataset["saturnRingAssetState"] = "loaded";
            },
            () => {
              container.dataset["saturnRingAssetState"] = "failed";
              onGpuError(
                `Authority ring asset ${observedRingProfile.file} failed to load for Saturn`,
              );
            },
          );
          container.dataset["saturnRingProfile"] = "Cassini PIA06175";
        }
        const ringMaterial = new ShaderMaterial({
          uniforms: {
            ringColor: {
              value: new Color(body.id === "saturn" ? 0xd9c49a : 0x9fb2b4),
            },
            innerRadius: { value: innerRadius },
            outerRadius: { value: outerRadius },
            observedRingProfile: { value: observedRingTexture ?? null },
            useObservedRingProfile: {
              value: observedRingTexture === undefined ? 0 : 1,
            },
            sunDirectionLocal: { value: new Vector3(0, 0, 1) },
            cameraPositionLocal: { value: new Vector3(0, 1, 4) },
            solarFlux: { value: 1 },
            displayExposure: { value: 1 },
            visibilityGain: { value: 1 },
            discreteRingCount: {
              value: discreteRingSystem?.rings.length ?? 0,
            },
            discreteRingCenters: {
              value: new Float32Array(
                Array.from({ length: 13 }, (_, index) => {
                  const ring = discreteRingSystem?.rings[index];
                  return ring === undefined || discreteRingSystem === undefined
                    ? 0
                    : ringRadiusRatio(
                        ring.radiusKm,
                        discreteRingSystem.equatorialRadiusKm,
                      );
                }),
              ),
            },
            discreteRingWidths: {
              value: new Float32Array(
                Array.from({ length: 13 }, (_, index) => {
                  const ring = discreteRingSystem?.rings[index];
                  return ring === undefined || discreteRingSystem === undefined
                    ? 0
                    : ringRadiusRatio(
                        ring.widthKm,
                        discreteRingSystem.equatorialRadiusKm,
                      );
                }),
              ),
            },
            discreteRingOpticalDepths: {
              value: new Float32Array(
                Array.from(
                  { length: 13 },
                  (_, index) =>
                    discreteRingSystem?.rings[index]?.opticalDepth ?? 0,
                ),
              ),
            },
          },
          vertexShader: `
            #include <common>
            #include <logdepthbuf_pars_vertex>
            varying float vRadius;
            varying vec3 vLocalPosition;
            void main() {
              vRadius = length(position.xz);
              vLocalPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              #include <logdepthbuf_vertex>
            }
          `,
          fragmentShader: `
            #include <common>
            #include <logdepthbuf_pars_fragment>
            const float OBSERVED_ICE_LIGHT_NORMALIZATION = 1.2;
            uniform vec3 ringColor;
            uniform float innerRadius;
            uniform float outerRadius;
            uniform sampler2D observedRingProfile;
            uniform float useObservedRingProfile;
            uniform vec3 sunDirectionLocal;
            uniform vec3 cameraPositionLocal;
            uniform float solarFlux;
            uniform float displayExposure;
            uniform float visibilityGain;
            uniform int discreteRingCount;
            uniform float discreteRingCenters[13];
            uniform float discreteRingWidths[13];
            uniform float discreteRingOpticalDepths[13];
            varying float vRadius;
            varying vec3 vLocalPosition;
            void main() {
              #include <logdepthbuf_fragment>
              float normalizedRadius = (vRadius - innerRadius) / (outerRadius - innerRadius);
              float edge = smoothstep(0.0, 0.025, normalizedRadius) * (1.0 - smoothstep(0.975, 1.0, normalizedRadius));
              vec3 ringNormal = vec3(0.0, gl_FrontFacing ? 1.0 : -1.0, 0.0);
              float incidence = abs(dot(ringNormal, normalize(sunDirectionLocal)));
              float directLight = 0.08 + 0.92 * sqrt(incidence);
              vec3 rayOrigin = vec3(vLocalPosition.x, 0.0, vLocalPosition.z);
              vec3 rayDirection = normalize(sunDirectionLocal);
              float rayProjection = dot(rayOrigin, rayDirection);
              float discriminant =
                rayProjection * rayProjection - (dot(rayOrigin, rayOrigin) - 1.0);
              float planetShadow = 1.0;
              if (discriminant > 0.0) {
                float nearestHit = -rayProjection - sqrt(discriminant);
                if (nearestHit > 0.0) {
                  planetShadow = 0.045;
                }
              }
              if (useObservedRingProfile > 0.5) {
                vec3 observed = texture2D(
                  observedRingProfile,
                  vec2(clamp(normalizedRadius, 0.0, 1.0), 0.5)
                ).rgb;
                float luminance = dot(observed, vec3(0.2126, 0.7152, 0.0722));
                float opticalDensity = clamp(
                  pow(max(luminance, 0.0), 0.42) * 1.05,
                  0.0,
                  1.0
                );
                vec3 observedChromaticity = clamp(
                  observed / max(luminance, 0.004),
                  vec3(0.65),
                  vec3(1.35)
                );
                float measuredReflectance =
                  0.12 + 0.88 * opticalDensity;
                // The Cassini mosaic supplies the radial natural-colour
                // structure. Slightly reduce its photographic colour cast,
                // while retaining the measured warm ice and fine banding.
                vec3 iceAlbedo = clamp(
                  vec3(measuredReflectance) *
                    mix(vec3(1.0), observedChromaticity, 0.18) *
                    vec3(1.04, 1.015, 0.96),
                  vec3(0.0),
                  vec3(1.0)
                );
                // A rendered texel is an unresolved column of separate ice
                // particles. Dense bands scatter more light between particles;
                // sparse divisions transmit the background instead of becoming
                // opaque black paint.
                float particleScattering =
                  (0.08 + 0.18 * (1.0 - incidence)) *
                  (0.20 + 0.80 * opticalDensity);
                float illumination =
                  (directLight * planetShadow + particleScattering) *
                  solarFlux * displayExposure *
                  OBSERVED_ICE_LIGHT_NORMALIZATION;
                float viewSine = max(
                  abs(normalize(cameraPositionLocal - vLocalPosition).y),
                  0.06
                );
                float slantOpticalDepth =
                  opticalDensity / viewSine;
                float alpha =
                  smoothstep(0.001, 0.012, luminance) *
                  (1.0 - exp(-slantOpticalDepth * 1.2)) * edge;
                gl_FragColor = vec4(
                  iceAlbedo * illumination,
                  clamp(alpha, 0.0, 0.995)
                );
              } else {
                float radialPixelFootprint = max(fwidth(vRadius), 0.000001);
                float accumulatedAlpha = 0.0;
                vec3 accumulatedColor = vec3(0.0);
                for (int ringIndex = 0; ringIndex < 13; ringIndex++) {
                  if (ringIndex >= discreteRingCount) {
                    continue;
                  }
                  float ringWidth = discreteRingWidths[ringIndex];
                  float distanceFromCenter = abs(
                    vRadius - discreteRingCenters[ringIndex]
                  );
                  float radialEnvelope = 1.0 - smoothstep(
                    ringWidth * 0.5,
                    ringWidth * 0.5 + radialPixelFootprint,
                    distanceFromCenter
                  );
                  float subpixelCoverage = min(
                    1.0,
                    ringWidth / radialPixelFootprint
                  );
                  float opticalAlpha = 1.0 - exp(
                    -discreteRingOpticalDepths[ringIndex]
                  );
                  float presentationAlpha = 1.0 - exp(
                    -opticalAlpha * visibilityGain
                  );
                  float ringAlpha =
                    radialEnvelope * subpixelCoverage * presentationAlpha;
                  vec3 particleColor =
                    ${body.id === "uranus" ? "ringIndex == 11" : "false"}
                      ? vec3(0.46, 0.20, 0.16)
                      : ${body.id === "uranus" ? "ringIndex == 12" : "false"}
                        ? vec3(0.16, 0.34, 0.50)
                        : ${body.id === "uranus" ? "vec3(0.34, 0.36, 0.35)" : "vec3(0.27, 0.23, 0.19)"};
                  accumulatedColor += particleColor * ringAlpha;
                  accumulatedAlpha = 1.0 -
                    (1.0 - accumulatedAlpha) * (1.0 - ringAlpha);
                }
                if (accumulatedAlpha < 0.0000001) {
                  discard;
                }
                float particleScattering = 0.08 + 0.07 * (1.0 - incidence);
                float physicalIllumination =
                  (directLight * planetShadow + particleScattering) *
                  solarFlux * displayExposure;
                float illumination = visibilityGain > 1.0
                  ? 0.65 + 0.35 * directLight * planetShadow
                  : physicalIllumination;
                gl_FragColor = vec4(
                  accumulatedColor /
                    max(accumulatedAlpha, 0.0000001) * illumination,
                  accumulatedAlpha * edge
                );
              }
            }
          `,
          side: DoubleSide,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          toneMapped: true,
        });
        materials.push(ringMaterial);
        const rings = new Mesh(ringGeometry, ringMaterial);
        rings.name =
          body.id === "saturn"
            ? "Saturn continuous Cassini-observed ring sheet"
            : `${body.name} continuous physical ring sheet`;
        rings.renderOrder = 0;
        mesh.add(rings);
        let surfaceShadowSunDirectionLocal: IUniform<Vector3> | undefined;
        if (body.id === "saturn") {
          const saturnSurfaceMaterial = surfaceMaterials.get(body.id);
          if (
            saturnSurfaceMaterial === undefined ||
            observedRingTexture === undefined
          ) {
            throw new Error(
              "Saturn ring shadow requires its surface and ring profile",
            );
          }
          surfaceShadowSunDirectionLocal = { value: new Vector3(0, 1, 0) };
          const shadowSunUniform = surfaceShadowSunDirectionLocal;
          saturnSurfaceMaterial.onBeforeCompile = (shader) => {
            shader.uniforms["ringShadowProfile"] = {
              value: observedRingTexture,
            };
            shader.uniforms["ringShadowSunDirectionLocal"] = shadowSunUniform;
            shader.vertexShader = shader.vertexShader
              .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vRingShadowLocalPosition;",
              )
              .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nvRingShadowLocalPosition = position;",
              );
            shader.fragmentShader = shader.fragmentShader
              .replace(
                "#include <common>",
                `#include <common>
uniform sampler2D ringShadowProfile;
uniform vec3 ringShadowSunDirectionLocal;
varying vec3 vRingShadowLocalPosition;

float saturnRingTransmission(vec3 surfacePosition) {
  vec3 sunDirection = normalize(ringShadowSunDirectionLocal);
  if (abs(sunDirection.y) < 0.00001) {
    return 1.0;
  }
  float rayDistance = -surfacePosition.y / sunDirection.y;
  if (rayDistance <= 0.0) {
    return 1.0;
  }
  vec3 ringPlaneIntersection =
    surfacePosition + sunDirection * rayDistance;
  float ringRadius = length(ringPlaneIntersection.xz);
  float normalizedRadius =
    (ringRadius - ${innerRadius.toFixed(9)}) /
    ${String(outerRadius - innerRadius)};
  if (normalizedRadius <= 0.0 || normalizedRadius >= 1.0) {
    return 1.0;
  }
  vec3 observed = texture2D(
    ringShadowProfile,
    vec2(clamp(normalizedRadius, 0.0, 1.0), 0.5)
  ).rgb;
  float luminance = dot(observed, vec3(0.2126, 0.7152, 0.0722));
  float opticalDensity = clamp(
    pow(max(luminance, 0.0), 0.42) * 1.05,
    0.0,
    1.0
  );
  float slantPath = 1.0 / max(abs(sunDirection.y), 0.08);
  float directTransmission = exp(
    -opticalDensity * min(slantPath, 8.0) * 0.82
  );
  return 0.38 + 0.62 * directTransmission;
}`,
              )
              .replace(
                "#include <opaque_fragment>",
                `outgoingLight *= saturnRingTransmission(
  vRingShadowLocalPosition
);
#include <opaque_fragment>`,
              );
          };
          saturnSurfaceMaterial.customProgramCacheKey = () =>
            "saturn-cassini-ring-shadow-v3";
          saturnSurfaceMaterial.needsUpdate = true;
        }
        ringVisuals.set(body.id, {
          referenceMesh: rings,
          materials: [ringMaterial],
          ...(surfaceShadowSunDirectionLocal === undefined
            ? {}
            : { surfaceShadowSunDirectionLocal }),
        });
        if (body.id === "saturn") {
          container.dataset["saturnRingLighting"] =
            "cassini-profile-solar-incidence-mutual-shadowing-and-depth-occlusion";
          container.dataset["saturnRingExposure"] = "live-camera-exposure";
          container.dataset["saturnRingOcclusion"] =
            "continuous-sheet-against-opaque-globe-logarithmic-depth-buffer";
        } else if (
          discreteRingSystem !== undefined &&
          discreteRingExtent !== undefined
        ) {
          container.dataset[`${body.id}RingModel`] =
            body.id === "uranus"
              ? "pds-13-ring-radii-widths-optical-depths"
              : "pds-radii-widths-optical-depths";
          container.dataset[`${body.id}RingCount`] = String(
            discreteRingSystem.rings.length,
          );
          container.dataset[`${body.id}RingInnerRadiusKm`] = String(
            discreteRingExtent.innerRadiusKm,
          );
          container.dataset[`${body.id}RingOuterRadiusKm`] = String(
            discreteRingExtent.outerRadiusKm,
          );
        }
      }
    }

    const apolloSiteGroups = new Map<string, Group>();
    const moonSurfaceMesh = bodyMeshes.get("moon");
    if (moonSurfaceMesh === undefined) {
      throw new Error("Apollo surface assets require the Moon mesh");
    }
    for (const site of apolloLandingSites) {
      const siteGroup = createApolloSurfaceSiteModel(site);
      const [localX, localY, localZ] = moonFixedSurfaceUnitVector(
        site.latitudeDeg,
        site.longitudeDeg,
      );
      const surfaceNormal = new Vector3(localX, localY, localZ).normalize();
      const longitudeRad = (site.longitudeDeg * Math.PI) / 180;
      const latitudeRad = (site.latitudeDeg * Math.PI) / 180;
      const east = new Vector3(
        -Math.sin(longitudeRad),
        0,
        -Math.cos(longitudeRad),
      ).normalize();
      const north = new Vector3(
        -Math.sin(latitudeRad) * Math.cos(longitudeRad),
        Math.cos(latitudeRad),
        Math.sin(latitudeRad) * Math.sin(longitudeRad),
      ).normalize();
      siteGroup.position.copy(
        surfaceNormal.clone().multiplyScalar(1 + 0.04 / MOON_SURFACE_RADIUS_M),
      );
      siteGroup.quaternion.setFromRotationMatrix(
        new Matrix4().makeBasis(east, surfaceNormal, north.multiplyScalar(-1)),
      );
      siteGroup.visible = false;
      moonSurfaceMesh.add(siteGroup);
      apolloSiteGroups.set(site.id, siteGroup);
      siteGroup.traverse((object) => {
        if (object.type === "Mesh") {
          const modelMesh = object as Mesh;
          additionalSelectableMeshes.push(modelMesh);
          geometries.push(modelMesh.geometry);
          const objectMaterials = Array.isArray(modelMesh.material)
            ? modelMesh.material
            : [modelMesh.material];
          materials.push(...objectMaterials);
        } else if (object.type === "Line" || object.type === "LineSegments") {
          const line = object as Line;
          geometries.push(line.geometry);
          const lineMaterials = Array.isArray(line.material)
            ? line.material
            : [line.material];
          materials.push(...lineMaterials);
        }
      });
    }
    container.dataset["apolloSurfaceAssets"] =
      "physical-lm-flags-alsep-retroreflectors-lrv";
    container.dataset["apolloTraverseAuthority"] = "NASA-LROC-PDS";

    const spacecraftGroups = new Map<string, Group>();
    const spacecraftSelectableMeshes: Mesh[] = [];
    const spacecraftModelStatus = document.createElement("span");
    spacecraftModelStatus.className = "scene-error";
    spacecraftModelStatus.setAttribute("role", "alert");
    spacecraftModelStatus.hidden = true;
    container.append(spacecraftModelStatus);
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    dracoLoader.setWorkerLimit(2);
    gltfLoader.setDRACOLoader(dracoLoader);
    let modelLoadingActive = true;
    const modelLoadPromises = spacecraftAssets.map(async (asset) => {
      const group = new Group();
      group.name = `${asset.bodyId} official NASA 3D model`;
      group.visible = false;
      spacecraftGroups.set(asset.bodyId, group);
      scene.add(group);
      try {
        const gltf = await gltfLoader.loadAsync(asset.modelUrl);
        const model = gltf.scene;
        if (!modelLoadingActive) {
          model.traverse((object) => {
            if (object.type === "Mesh") {
              const mesh = object as Mesh;
              mesh.geometry.dispose();
              const loadedMaterials = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              for (const material of loadedMaterials) material.dispose();
            }
          });
          return;
        }
        model.updateMatrixWorld(true);
        const sourceBounds = new Box3().setFromObject(model);
        const sourceSize = new Vector3();
        const sourceCenter = new Vector3();
        sourceBounds.getSize(sourceSize);
        sourceBounds.getCenter(sourceCenter);
        const sourceMaximumDimension = Math.max(
          sourceSize.x,
          sourceSize.y,
          sourceSize.z,
        );
        if (
          !Number.isFinite(sourceMaximumDimension) ||
          sourceMaximumDimension <= 0
        ) {
          throw new Error(
            `${asset.bodyId} model has invalid source dimensions`,
          );
        }
        const physicalScale =
          asset.maximumDimensionM /
          ASTRONOMICAL_UNIT_M /
          sourceMaximumDimension;
        model.scale.setScalar(physicalScale);
        model.position.copy(sourceCenter).multiplyScalar(-physicalScale);
        model.traverse((object) => {
          object.userData["bodyId"] = asset.bodyId;
          if (object.type === "Mesh") {
            const mesh = object as Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            spacecraftSelectableMeshes.push(mesh);
            geometries.push(mesh.geometry);
            const loadedMaterials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            for (const material of loadedMaterials) {
              materials.push(material);
              for (const propertyName of Object.keys(material)) {
                const value: unknown = Reflect.get(material, propertyName);
                if (value instanceof Texture) {
                  textures.push(value as Texture);
                }
              }
            }
          }
        });
        group.add(model);
        container.dataset[`${asset.bodyId.replaceAll("-", "")}ModelLoaded`] =
          "true";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        spacecraftModelStatus.hidden = false;
        spacecraftModelStatus.textContent = `Official spacecraft model failed to load: ${message}`;
        container.dataset["spacecraftModelError"] = message;
        throw error;
      }
    });
    void Promise.all(modelLoadPromises)
      .then(() => {
        container.dataset["spacecraftModelsLoaded"] = String(
          spacecraftAssets.length + 1,
        );
      })
      .catch(() => undefined);
    const roadsterGroup = createRoadsterAndStarmanModel();
    roadsterGroup.visible = false;
    spacecraftGroups.set(ROADSTER_BODY_ID, roadsterGroup);
    scene.add(roadsterGroup);
    const roadsterMaterials = new Set<Material>();
    roadsterGroup.traverse((object) => {
      if (object.type !== "Mesh") {
        return;
      }
      const roadsterMesh = object as Mesh;
      spacecraftSelectableMeshes.push(roadsterMesh);
      geometries.push(roadsterMesh.geometry);
      const meshMaterials = Array.isArray(roadsterMesh.material)
        ? roadsterMesh.material
        : [roadsterMesh.material];
      for (const material of meshMaterials) {
        roadsterMaterials.add(material);
      }
    });
    materials.push(...roadsterMaterials);
    container.dataset["roadsterModelLoaded"] = "true";
    container.dataset["roadsterModelProvenance"] =
      "original-physical-scale-reconstruction";
    const issGroup = spacecraftGroups.get(ISS_BODY_ID);
    if (issGroup === undefined) {
      throw new Error("ISS official model group is unavailable");
    }
    const voyagerGroups = new Map(
      voyagerSnapshot.probes.map((probe) => {
        const group = spacecraftGroups.get(probe.id);
        if (group === undefined) {
          throw new Error(`${probe.name} official model group is unavailable`);
        }
        return [probe.id, group] as const;
      }),
    );

    const bodyHoverTooltip = document.createElement("div");
    bodyHoverTooltip.className = "body-hover-tooltip";
    bodyHoverTooltip.setAttribute("role", "tooltip");
    bodyHoverTooltip.hidden = true;
    container.append(bodyHoverTooltip);

    const deepSpaceLabels = [
      { id: "heliopause", text: "Heliopause · about 120 AU" },
      { id: "oort-cloud", text: "Oort Cloud · estimated 2,000-100,000 AU" },
      { id: "alpha-centauri", text: "Alpha Centauri · 4.3 light-years" },
    ].map(({ id, text: labelText }) => {
      const label = document.createElement("span");
      label.className = "deep-space-label";
      label.dataset["regionId"] = id;
      label.textContent = labelText;
      label.hidden = true;
      container.append(label);
      return label;
    });
    const deepSunLabel = document.createElement("span");
    deepSunLabel.className = "deep-space-label deep-space-sun-label";
    deepSunLabel.textContent = "Sun · Solar System origin";
    deepSunLabel.hidden = true;
    container.append(deepSunLabel);
    const navigationMap = document.createElement("div");
    navigationMap.className = "reality-navigation-map";
    navigationMap.setAttribute("aria-label", "Solar System navigation map");
    const navigationMapTitle = document.createElement("strong");
    navigationMapTitle.textContent = "NAVIGATION";
    const navigationMapCanvas = document.createElement("canvas");
    navigationMapCanvas.width = 320;
    navigationMapCanvas.height = 240;
    navigationMapCanvas.setAttribute("role", "img");
    navigationMapCanvas.setAttribute(
      "aria-label",
      "Top-down map showing the Sun, planets, current location and view direction",
    );
    const navigationMapScale = document.createElement("small");
    navigationMap.append(
      navigationMapTitle,
      navigationMapCanvas,
      navigationMapScale,
    );
    container.append(navigationMap);
    const navigationContext = navigationMapCanvas.getContext("2d");
    if (navigationContext === null) {
      throw new Error("Reality navigation map 2D context is unavailable");
    }

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let surfacePointerId: number | undefined;
    let selectionPointerId: number | undefined;
    let selectionPointerStartX = 0;
    let selectionPointerStartY = 0;
    let selectionPointerMoved = false;
    let surfacePointerX = 0;
    let surfacePointerY = 0;
    let surfaceFreeLook = false;
    let surfaceLookAzimuthDeg = 0;
    let surfaceLookAltitudeDeg = 0;
    let latestSurfaceObservation: SurfaceObserverFrame | undefined;
    let lastSurfaceConfigurationKey = "";
    let lastSurfaceLookResetToken = surfaceObserverLookResetTokenRef.current;

    const bodyIdFromIntersection = (
      intersection: ReturnType<Raycaster["intersectObjects"]>[number],
    ): string | undefined => {
      let object: Object3D | null = intersection.object;
      while (object !== null) {
        const bodyId: unknown = object.userData["bodyId"];
        if (typeof bodyId === "string") {
          return bodyId;
        }
        object = object.parent;
      }
      return undefined;
    };

    const bodyTooltipText = (bodyId: string): string => {
      const body = majorBodyById.get(bodyId);
      if (body !== undefined) {
        const parentName = majorBodyById.get(
          PARENT_BODY_ID[bodyId] ?? "",
        )?.name;
        const typeLabel = body.type.replace("-", " ");
        return parentName === undefined
          ? `${body.name} · ${typeLabel}`
          : `${body.name} · ${typeLabel} of ${parentName}`;
      }
      const knownMoon = knownSatelliteById.get(bodyId);
      if (knownMoon !== undefined) {
        const parentName = majorBodyById.get(knownMoon.parentId)?.name;
        return `${knownMoon.name} · moon${parentName === undefined ? "" : ` of ${parentName}`}`;
      }
      if (bodyId === ISS_BODY_ID) {
        return "International Space Station · spacecraft orbiting Earth";
      }
      if (bodyId === JOVIAN_MONOLITH_BODY_ID) {
        return "Jovian Monolith · fictional 2001 / 2010 object near Jupiter-Io L1";
      }
      const voyager = isVoyagerBodyId(bodyId)
        ? voyagerById.get(bodyId)
        : undefined;
      if (voyager !== undefined) {
        return `${voyager.name} · interstellar spacecraft`;
      }
      const operational = operationalSpacecraftSnapshot.spacecraft.find(
        (spacecraft) => spacecraft.id === bodyId,
      );
      if (operational !== undefined) {
        return `${operational.name} · spacecraft`;
      }
      const fictionalOrbiter = isFictionalOrbiterId(bodyId)
        ? fictionalOrbiterById.get(bodyId)
        : undefined;
      if (fictionalOrbiter !== undefined) {
        return `${fictionalOrbiter.name} · fictional massless visualization`;
      }
      const apolloSite = apolloLandingSites.find((site) => site.id === bodyId);
      if (apolloSite !== undefined) {
        return `${apolloSite.mission} · ${apolloSite.siteName} · NASA/LROC surface artefacts`;
      }
      throw new Error(`Hover target ${bodyId} has no display definition`);
    };

    const updatePointer = (event: MouseEvent | PointerEvent): void => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
    };

    const bodyIdAtPointer = (
      event: MouseEvent | PointerEvent,
    ): string | undefined => {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersection = raycaster
        .intersectObjects(
          [
            ...bodyMeshes.values(),
            ...spacecraftSelectableMeshes,
            ...additionalSelectableMeshes,
          ],
          true,
        )
        .find((candidate) => candidate.object.visible);
      return intersection === undefined
        ? undefined
        : bodyIdFromIntersection(intersection);
    };

    const starIndexAtPointer = (
      event: MouseEvent | PointerEvent,
    ): number | undefined => {
      if (!stars.visible) {
        return undefined;
      }
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const worldHeight =
        (2 * STAR_SPHERE_RADIUS_AU * Math.tan((camera.fov * Math.PI) / 360)) /
        camera.zoom;
      raycaster.params.Points = {
        threshold:
          (worldHeight / Math.max(1, renderer.domElement.clientHeight)) *
          STAR_TOOLTIP_PICK_RADIUS_CSS_PIXELS,
      };
      return raycaster.intersectObject(stars, false)[0]?.index;
    };

    let hoveredStarIndex: number | undefined;
    let starTooltipTimer: number | undefined;
    let latestTooltipClientX = 0;
    let latestTooltipClientY = 0;

    const positionHoverTooltip = (clientX: number, clientY: number): void => {
      const bounds = renderer.domElement.getBoundingClientRect();
      const margin = 10;
      const pointerGap = 14;
      const pointerX = clientX - bounds.left;
      const pointerY = clientY - bounds.top;
      const tooltipWidth = bodyHoverTooltip.offsetWidth;
      const tooltipHeight = bodyHoverTooltip.offsetHeight;
      const fitsRight =
        pointerX + pointerGap + tooltipWidth <= container.clientWidth - margin;
      const fitsAbove = pointerY - pointerGap - tooltipHeight >= margin;
      const preferredLeft = fitsRight
        ? pointerX + pointerGap
        : pointerX - pointerGap - tooltipWidth;
      const preferredTop = fitsAbove
        ? pointerY - pointerGap - tooltipHeight
        : pointerY + pointerGap;
      const left = Math.min(
        container.clientWidth - tooltipWidth - margin,
        Math.max(margin, preferredLeft),
      );
      const top = Math.min(
        container.clientHeight - tooltipHeight - margin,
        Math.max(margin, preferredTop),
      );
      bodyHoverTooltip.dataset["placement"] =
        `${fitsAbove ? "above" : "below"}-${fitsRight ? "right" : "left"}`;
      bodyHoverTooltip.style.transform = `translate(${String(left)}px, ${String(top)}px)`;
    };

    const cancelStarTooltip = (): void => {
      if (starTooltipTimer !== undefined) {
        window.clearTimeout(starTooltipTimer);
        starTooltipTimer = undefined;
      }
      hoveredStarIndex = undefined;
    };

    const hideBodyHoverTooltip = (): void => {
      bodyHoverTooltip.hidden = true;
      delete bodyHoverTooltip.dataset["bodyId"];
      delete bodyHoverTooltip.dataset["starHipId"];
    };

    const updateBodyHoverTooltip = (event: PointerEvent): void => {
      if (surfacePointerId !== undefined) {
        hideBodyHoverTooltip();
        return;
      }
      const bodyId = bodyIdAtPointer(event);
      if (bodyId !== undefined) {
        cancelStarTooltip();
        bodyHoverTooltip.textContent = bodyTooltipText(bodyId);
        bodyHoverTooltip.dataset["bodyId"] = bodyId;
        delete bodyHoverTooltip.dataset["starHipId"];
        bodyHoverTooltip.hidden = false;
        positionHoverTooltip(event.clientX, event.clientY);
        return;
      }
      const starIndex = starIndexAtPointer(event);
      if (starIndex === undefined) {
        cancelStarTooltip();
        hideBodyHoverTooltip();
        return;
      }
      latestTooltipClientX = event.clientX;
      latestTooltipClientY = event.clientY;
      const star = hipparcosStarSnapshot.stars[starIndex];
      if (star === undefined) {
        throw new Error(
          `Hipparcos hover index ${String(starIndex)} is invalid`,
        );
      }
      if (hoveredStarIndex === starIndex) {
        if (!bodyHoverTooltip.hidden) {
          positionHoverTooltip(event.clientX, event.clientY);
        }
        return;
      }
      cancelStarTooltip();
      hideBodyHoverTooltip();
      hoveredStarIndex = starIndex;
      starTooltipTimer = window.setTimeout(() => {
        starTooltipTimer = undefined;
        if (!active || hoveredStarIndex !== starIndex || !stars.visible) {
          return;
        }
        bodyHoverTooltip.textContent = starTooltipText(star);
        bodyHoverTooltip.dataset["starHipId"] = String(star.hipId);
        delete bodyHoverTooltip.dataset["bodyId"];
        bodyHoverTooltip.hidden = false;
        positionHoverTooltip(latestTooltipClientX, latestTooltipClientY);
      }, STAR_TOOLTIP_DELAY_MS);
    };

    const handleSurfacePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      if (surfaceObserverRef.current === null) {
        selectionPointerId = event.pointerId;
        selectionPointerStartX = event.clientX;
        selectionPointerStartY = event.clientY;
        selectionPointerMoved = false;
        return;
      }
      surfacePointerId = event.pointerId;
      surfacePointerX = event.clientX;
      surfacePointerY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.dataset["surfaceLookDragging"] = "true";
      cancelStarTooltip();
      hideBodyHoverTooltip();
      event.preventDefault();
    };

    const handleSurfacePointerMove = (event: PointerEvent): void => {
      if (selectionPointerId === event.pointerId) {
        selectionPointerMoved =
          selectionPointerMoved ||
          Math.hypot(
            event.clientX - selectionPointerStartX,
            event.clientY - selectionPointerStartY,
          ) > 5;
        if (selectionPointerMoved) {
          cancelStarTooltip();
          hideBodyHoverTooltip();
          return;
        }
      }
      if (surfacePointerId !== event.pointerId) {
        updateBodyHoverTooltip(event);
        return;
      }
      const observation = latestSurfaceObservation;
      if (observation === undefined) {
        throw new Error("Surface free-look has no current observer frame");
      }
      if (!surfaceFreeLook) {
        surfaceLookAzimuthDeg = observation.targetAzimuthDeg;
        surfaceLookAltitudeDeg = observation.targetAltitudeDeg;
        surfaceFreeLook = true;
      }
      const deltaX = event.clientX - surfacePointerX;
      const deltaY = event.clientY - surfacePointerY;
      surfacePointerX = event.clientX;
      surfacePointerY = event.clientY;
      surfaceLookAzimuthDeg =
        (surfaceLookAzimuthDeg - deltaX * 0.16 + 360) % 360;
      surfaceLookAltitudeDeg = Math.max(
        -89.5,
        Math.min(89.5, surfaceLookAltitudeDeg - deltaY * 0.16),
      );
      container.dataset["surfaceFreeLook"] = "true";
      event.preventDefault();
    };

    const handleSurfacePointerUp = (event: PointerEvent): void => {
      if (selectionPointerId === event.pointerId) {
        if (!selectionPointerMoved) {
          const bodyId = bodyIdAtPointer(event);
          if (bodyId !== undefined) {
            onSelectBody(bodyId);
          }
        }
        selectionPointerId = undefined;
        selectionPointerMoved = false;
        return;
      }
      if (surfacePointerId !== event.pointerId) {
        return;
      }
      renderer.domElement.releasePointerCapture(event.pointerId);
      surfacePointerId = undefined;
      delete renderer.domElement.dataset["surfaceLookDragging"];
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      cancelStarTooltip();
      hideBodyHoverTooltip();
      if (selectionPointerId === event.pointerId) {
        selectionPointerId = undefined;
        selectionPointerMoved = false;
      }
      if (surfacePointerId === event.pointerId) {
        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        surfacePointerId = undefined;
        delete renderer.domElement.dataset["surfaceLookDragging"];
      }
    };

    const handleDoubleClick = (event: MouseEvent): void => {
      if (surfaceObserverRef.current !== null) {
        surfaceFreeLook = false;
        container.dataset["surfaceFreeLook"] = "false";
        return;
      }
      const bodyId = bodyIdAtPointer(event);
      if (bodyId !== undefined) {
        onFocusBody(bodyId);
      }
    };
    const handlePointerLeave = (): void => {
      cancelStarTooltip();
      hideBodyHoverTooltip();
    };
    renderer.domElement.addEventListener(
      "pointerdown",
      handleSurfacePointerDown,
    );
    renderer.domElement.addEventListener(
      "pointermove",
      handleSurfacePointerMove,
    );
    renderer.domElement.addEventListener("pointerup", handleSurfacePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);

    const knownMoonPointMaterial = new PointsMaterial({
      color: 0xc8d2e2,
      size: 0.000_02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    materials.push(knownMoonPointMaterial);
    const knownMoonSystems = new Map<
      string,
      Readonly<{
        definitions: typeof additionalAvailableKnownSatellites;
        geometry: BufferGeometry;
        positions: Float32Array;
        points: Points;
      }>
    >();
    for (const parentId of [
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "pluto",
    ]) {
      const definitions = additionalAvailableKnownSatellites.filter(
        (body) => body.parentId === parentId,
      );
      if (definitions.length === 0) {
        continue;
      }
      const geometry = new BufferGeometry();
      const positions = new Float32Array(definitions.length * 3);
      const attribute = new BufferAttribute(positions, 3);
      attribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute("position", attribute);
      geometries.push(geometry);
      const points = new Points(geometry, knownMoonPointMaterial);
      points.name = `${parentId} Horizons massless two-body moon points`;
      points.visible = false;
      scene.add(points);
      knownMoonSystems.set(parentId, {
        definitions,
        geometry,
        positions,
        points,
      });
    }

    const ensureSurfaceAsset = (bodyId: string): void => {
      if (textureRequestedBodyIds.has(bodyId)) {
        return;
      }
      const asset = nasaTextureByBodyId.get(bodyId);
      const surfaceMaterial = surfaceMaterials.get(bodyId);
      if (asset === undefined || surfaceMaterial === undefined) {
        return;
      }
      textureRequestedBodyIds.add(bodyId);
      const label = bodyLabels.get(bodyId);
      if (label !== undefined) {
        label.dataset["surfaceAssetState"] = "loading";
      }
      surfaceMaterial.map = loadTexture(
        asset.file,
        true,
        () => {
          loadedSurfaceAssetBodyIds.add(bodyId);
          if (label !== undefined) {
            label.dataset["surfaceAssetState"] = "loaded";
          }
          container.dataset["surfaceAssetLoadedCount"] = String(
            loadedSurfaceAssetBodyIds.size,
          );
        },
        () => {
          if (label !== undefined) {
            label.dataset["surfaceAssetState"] = "failed";
          }
          onGpuError(
            `Authority surface asset ${asset.file} failed to load for ${bodyId}`,
          );
        },
      );
      if (bodyId === "moon" && nasaMoonHeightAsset !== undefined) {
        surfaceMaterial.bumpMap = loadTexture(nasaMoonHeightAsset.file, false);
        surfaceMaterial.bumpScale = 0.018;
      }
      if (bodyId === "earth" && nasaEarthCloudAsset !== undefined) {
        const cloudMaterial = new MeshStandardMaterial({
          color: 0xffffff,
          alphaMap: loadTexture(nasaEarthCloudAsset.file, false),
          transparent: true,
          opacity: 0.72,
          roughness: 1,
          metalness: 0,
          depthWrite: false,
          alphaTest: 0.018,
        });
        earthCloudMaterial = cloudMaterial;
        materials.push(cloudMaterial);
        const clouds = new Mesh(unitSphere, cloudMaterial);
        clouds.name = "NASA Blue Marble static Earth cloud composite";
        clouds.scale.setScalar(1.018);
        bodyMeshes.get("earth")?.add(clouds);
        container.dataset["earthCloudPresentation"] =
          "static-authority-composite-not-live-weather";
      }
      surfaceMaterial.needsUpdate = true;
    };

    const eclipticGrid = new GridHelper(80, 40, 0x426b96, 0x1a3048);
    eclipticGrid.name = "J2000 ecliptic reference plane";
    eclipticGrid.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      j2000EclipticToScene({ x: 0, y: 0, z: 1 }).normalize(),
    );
    const gridMaterials: Material[] = Array.isArray(eclipticGrid.material)
      ? (eclipticGrid.material as Material[])
      : [eclipticGrid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.16;
      material.depthWrite = false;
      materials.push(material);
    }
    scene.add(eclipticGrid);

    const orbitGuides = new Map<
      string,
      Readonly<{
        geometry: BufferGeometry;
        positions: Float32Array;
        positionAttribute: BufferAttribute;
        material: LineBasicMaterial;
        line: LineLoop;
      }>
    >();
    for (const body of majorBodySnapshot.bodies) {
      if (PARENT_BODY_ID[body.id] === undefined) {
        continue;
      }
      const geometry = new BufferGeometry();
      const positions = new Float32Array(192 * 3);
      const positionAttribute = new BufferAttribute(positions, 3);
      positionAttribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute("position", positionAttribute);
      geometry.setDrawRange(0, 0);
      const material = new LineBasicMaterial({
        color: 0x6f91ad,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      });
      const line = new LineLoop(geometry, material);
      line.name = `Instantaneous osculating orbit for ${body.name}`;
      line.visible = false;
      line.renderOrder = 1;
      geometries.push(geometry);
      materials.push(material);
      scene.add(line);
      orbitGuides.set(body.id, {
        geometry,
        positions,
        positionAttribute,
        material,
        line,
      });
    }

    const updateOrbitGuides = (exactState: SimulationState): void => {
      for (const [bodyId, guide] of orbitGuides) {
        const parentId = PARENT_BODY_ID[bodyId];
        const bodyState = bodyStateById(exactState, bodyId);
        const parentState =
          parentId === undefined
            ? undefined
            : bodyStateById(exactState, parentId);
        if (bodyState === undefined || parentState === undefined) {
          guide.geometry.setDrawRange(0, 0);
          continue;
        }
        const positionsM = osculatingOrbitPositionsM(
          bodyState,
          parentState,
          192,
        );
        for (const [index, positionM] of positionsM.entries()) {
          const position = scenePosition(positionM);
          guide.positions[index * 3] = position.x;
          guide.positions[index * 3 + 1] = position.y;
          guide.positions[index * 3 + 2] = position.z;
        }
        guide.positionAttribute.needsUpdate = true;
        guide.geometry.setDrawRange(0, positionsM.length);
        guide.geometry.computeBoundingSphere();
      }
    };

    const moonTrailGeometry = new BufferGeometry();
    geometries.push(moonTrailGeometry);
    const moonTrailPositions = new Float32Array(MAX_MOON_TRAIL_POINTS * 3);
    const moonTrailColors = new Float32Array(MAX_MOON_TRAIL_POINTS * 3);
    const moonTrailPositionAttribute = new BufferAttribute(
      moonTrailPositions,
      3,
    );
    moonTrailPositionAttribute.setUsage(DynamicDrawUsage);
    moonTrailGeometry.setAttribute("position", moonTrailPositionAttribute);
    const moonTrailColorAttribute = new BufferAttribute(moonTrailColors, 3);
    moonTrailColorAttribute.setUsage(DynamicDrawUsage);
    moonTrailGeometry.setAttribute("color", moonTrailColorAttribute);
    moonTrailGeometry.setDrawRange(0, 0);
    const moonTrailMaterial = new LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
    });
    materials.push(moonTrailMaterial);
    const moonTrail = new Line(moonTrailGeometry, moonTrailMaterial);
    moonTrail.name = "Physics-sampled Moon trail";
    moonTrail.renderOrder = 2;
    scene.add(moonTrail);
    const moonTrailPoints: TimedTrailPoint[] = [];
    const planetTrailMaterial = new LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthTest: false,
    });
    materials.push(planetTrailMaterial);
    const planetTrails = new Map<
      (typeof PLANET_TRAIL_BODY_IDS)[number],
      Readonly<{
        geometry: BufferGeometry;
        line: Line;
        positionAttribute: BufferAttribute;
        positions: Float32Array;
        colors: Float32Array;
        colorAttribute: BufferAttribute;
        points: TimedTrailPoint[];
      }>
    >();
    for (const bodyId of PLANET_TRAIL_BODY_IDS) {
      const geometry = new BufferGeometry();
      geometries.push(geometry);
      const positions = new Float32Array(MAX_PLANET_TRAIL_POINTS * 3);
      const colors = new Float32Array(MAX_PLANET_TRAIL_POINTS * 3);
      const positionAttribute = new BufferAttribute(positions, 3);
      positionAttribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute("position", positionAttribute);
      const colorAttribute = new BufferAttribute(colors, 3);
      colorAttribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute("color", colorAttribute);
      geometry.setDrawRange(0, 0);
      const line = new Line(geometry, planetTrailMaterial);
      line.name = `Physics-sampled ${bodyId} trail`;
      line.renderOrder = 2;
      scene.add(line);
      planetTrails.set(bodyId, {
        geometry,
        line,
        positionAttribute,
        positions,
        colors,
        colorAttribute,
        points: [],
      });
    }
    let lastMoonTrailTime: number | undefined;
    let lastTrailDirection = 0;
    let activeReferenceFrame = referenceFrameRef.current;
    let lastFocusBodyId: string | null | undefined;
    let lastResetViewToken = resetViewTokenRef.current;
    let lastClearTrailsToken = clearTrailsTokenRef.current;
    let lastOrientationPresetToken = orientationPresetTokenRef.current;
    let lastCameraNavigationSequence =
      cameraNavigationCommandRef.current.sequence;
    let lastCameraTransitionSequence = cameraTransitionSequenceRef.current;
    let activeCameraTransition:
      | {
          style: "direct" | "authored";
          sequence: number;
          startedAtMs: number;
          durationMs: number;
          startPosition: Vector3;
          startTarget: Vector3;
          startUp: Vector3;
          overviewStartPosition: Vector3;
          overviewStartTarget: Vector3;
          departureAnchor: Vector3;
          overviewEndPosition: Vector3;
          overviewEndTarget: Vector3;
          destinationAnchor: Vector3;
          destinationOverviewAnchorBodyId: string | undefined;
          overviewEndDistanceAu: number;
          isObserverDestination: boolean;
          endPosition: Vector3;
          endTarget: Vector3;
          endOffset: Vector3;
          destinationFocusBodyId: string | null;
          destinationTargetBodyId: string | undefined;
          departureName: string;
          destinationName: string;
          journeyDistanceAu: number;
          endUp: Vector3;
          endNear: number;
          endFar: number;
          endMinimumDistance: number;
          endMaximumDistance: number;
          lastSpeedSampleAtMs: number;
          smoothedSpeedMps: number;
        }
      | undefined;
    let lastCameraZoom = Number.NaN;
    let viewZoomReferenceDistanceAu = SOLAR_SYSTEM_CAMERA_POSITION.length();
    let lastReportedViewZoom = Number.NaN;
    let activeFrameEndTime: number | undefined;
    let lastSemanticZoomLevel: SemanticZoomLevel | undefined;
    let lastSmallBodyGpuUpdateAt = Number.NEGATIVE_INFINITY;
    let lastSunGuideUpdateAt = Number.NEGATIVE_INFINITY;
    let lastNavigationMapUpdateAt = Number.NEGATIVE_INFINITY;
    let lastSmallBodiesVisible: boolean | undefined;
    let lastSceneMutationKey = "";
    let lastVisualQuality: VisualQuality | undefined;
    let currentExposure = renderer.toneMappingExposure;
    let lastRenderedAtMs = performance.now();
    let frameIntervalEmaMs = 1000 / 60;

    const resize = (width: number, height: number): void => {
      if (width <= 0 || height <= 0) {
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      lastSunGuideUpdateAt = Number.NEGATIVE_INFINITY;
    };
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    resizeObserver.observe(container);
    resize(container.clientWidth, container.clientHeight);

    const applyVisualQuality = (quality: VisualQuality): void => {
      const profile = VISUAL_QUALITY_PROFILES[quality];
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, profile.maximumPixelRatio),
      );
      for (const texture of textures) {
        texture.anisotropy = Math.min(
          renderer.capabilities.getMaxAnisotropy(),
          profile.textureAnisotropyLimit,
        );
        if (loadedTextures.has(texture)) {
          texture.needsUpdate = true;
        }
      }
      for (const material of atmosphereMaterials.values()) {
        setRequiredNumberUniform(
          material,
          "qualityStrength",
          profile.atmosphereStrength,
        );
      }
      if (solarCoronaMaterial !== undefined) {
        solarCoronaMaterial.opacity = profile.coronaOpacity;
      }
      if (earthCloudMaterial !== undefined) {
        earthCloudMaterial.opacity =
          quality === "battery" ? 0.5 : quality === "balanced" ? 0.62 : 0.72;
      }
      resize(container.clientWidth, container.clientHeight);
      container.dataset["visualQuality"] = quality;
      container.dataset["renderPixelRatio"] = renderer
        .getPixelRatio()
        .toFixed(2);
      container.dataset["textureAnisotropy"] = String(
        Math.min(
          renderer.capabilities.getMaxAnisotropy(),
          profile.textureAnisotropyLimit,
        ),
      );
      lastVisualQuality = quality;
    };
    applyVisualQuality(visualQualityRef.current);

    const snapshotAbortController = new AbortController();
    let gpuLayer: SmallBodyGpuLayer | undefined;
    let gpuInitializationStarted = false;
    let active = true;
    const initializeGpuLayer = async (): Promise<void> => {
      try {
        const snapshot = await loadSbdbSnapshot(snapshotAbortController.signal);
        const created = await SmallBodyGpuLayer.create(
          gpuCanvas,
          snapshot,
          (message) => {
            if (active) {
              onGpuError(message);
            }
          },
        );
        const validatedRenderPixels =
          await created.layer.validateRenderedFrame(camera);
        if (!active) {
          created.layer.dispose();
          return;
        }
        gpuLayer = created.layer;
        container.dataset["gpuAuthorityPositions"] = String(
          created.status.validatedAuthorityPositions,
        );
        container.dataset["gpuPresentation"] = "direct-webgpu";
        onGpuStatus({ ...created.status, validatedRenderPixels });
      } catch (cause: unknown) {
        if (active && !snapshotAbortController.signal.aborted) {
          onGpuError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };
    const ensureGpuLayer = (): void => {
      if (gpuInitializationStarted) {
        return;
      }
      gpuInitializationStarted = true;
      void initializeGpuLayer();
    };

    const clearTrails = (): void => {
      moonTrailPoints.length = 0;
      moonTrailGeometry.setDrawRange(0, 0);
      for (const trail of planetTrails.values()) {
        trail.points.length = 0;
        trail.geometry.setDrawRange(0, 0);
      }
      lastMoonTrailTime = undefined;
      lastTrailDirection = 0;
    };

    const referenceOrigin = (
      exactState: SimulationState,
      bodyId: string,
      requestedReferenceFrame: ReferenceFrame,
    ): BodyState | undefined => {
      if (requestedReferenceFrame === "barycentric") {
        return undefined;
      }
      const originId =
        requestedReferenceFrame === "heliocentric"
          ? "sun"
          : PARENT_BODY_ID[bodyId];
      if (originId === undefined) {
        return undefined;
      }
      const origin = bodyStateById(exactState, originId);
      if (origin === undefined) {
        throw new Error(`Reference frame origin ${originId} is unavailable`);
      }
      return origin;
    };

    const relativeScenePosition = (
      bodyState: BodyState,
      originState: BodyState | undefined,
    ): Vector3 => {
      const position = scenePosition(bodyState.positionM);
      return originState === undefined
        ? position
        : position.sub(scenePosition(originState.positionM));
    };

    const updateTrail = (exactState: SimulationState): void => {
      const requestedReferenceFrame = referenceFrameRef.current;
      if (requestedReferenceFrame !== activeReferenceFrame) {
        activeReferenceFrame = requestedReferenceFrame;
        clearTrails();
      }
      if (exactState.timeSeconds === lastMoonTrailTime) {
        return;
      }
      if (
        !Number.isFinite(trailDurationSecondsRef.current) ||
        trailDurationSecondsRef.current <= 0
      ) {
        throw new Error("Trail duration must be a positive finite value");
      }
      if (
        !Number.isFinite(trailFadeRef.current) ||
        trailFadeRef.current < 0 ||
        trailFadeRef.current > 1
      ) {
        throw new Error("Trail fade must be between zero and one");
      }
      const trailDirection =
        lastMoonTrailTime === undefined
          ? 0
          : Math.sign(exactState.timeSeconds - lastMoonTrailTime);
      if (
        trailDirection !== 0 &&
        lastTrailDirection !== 0 &&
        trailDirection !== lastTrailDirection
      ) {
        clearTrails();
      }
      if (trailDirection !== 0) {
        lastTrailDirection = trailDirection;
      }
      const moonState = bodyStateById(exactState, "moon");
      if (moonState === undefined) {
        return;
      }
      const moonOriginState = referenceOrigin(
        exactState,
        "moon",
        requestedReferenceFrame,
      );
      moonTrailPoints.push({
        position: relativeScenePosition(moonState, moonOriginState),
        timeSeconds: exactState.timeSeconds,
      });
      while (
        moonTrailPoints.length > MAX_MOON_TRAIL_POINTS ||
        Math.abs(
          exactState.timeSeconds -
            (moonTrailPoints[0]?.timeSeconds ?? exactState.timeSeconds),
        ) > trailDurationSecondsRef.current
      ) {
        moonTrailPoints.shift();
      }
      for (const [index, point] of moonTrailPoints.entries()) {
        moonTrailPositions[index * 3] = point.position.x;
        moonTrailPositions[index * 3 + 1] = point.position.y;
        moonTrailPositions[index * 3 + 2] = point.position.z;
      }
      writeTrailColors(
        moonTrailColors,
        moonTrailPoints.length,
        trailFadeRef.current,
        [0.87, 0.91, 0.96],
      );
      moonTrailPositionAttribute.needsUpdate = true;
      moonTrailColorAttribute.needsUpdate = true;
      moonTrailGeometry.setDrawRange(0, moonTrailPoints.length);
      moonTrailGeometry.computeBoundingSphere();
      for (const bodyId of PLANET_TRAIL_BODY_IDS) {
        const bodyState = bodyStateById(exactState, bodyId);
        const trail = planetTrails.get(bodyId);
        if (bodyState === undefined || trail === undefined) {
          throw new Error(`Planet trail state is missing body ${bodyId}`);
        }
        const planetOriginState = referenceOrigin(
          exactState,
          bodyId,
          requestedReferenceFrame,
        );
        trail.points.push({
          position: relativeScenePosition(bodyState, planetOriginState),
          timeSeconds: exactState.timeSeconds,
        });
        while (
          trail.points.length > MAX_PLANET_TRAIL_POINTS ||
          Math.abs(
            exactState.timeSeconds -
              (trail.points[0]?.timeSeconds ?? exactState.timeSeconds),
          ) > trailDurationSecondsRef.current
        ) {
          trail.points.shift();
        }
        for (const [index, point] of trail.points.entries()) {
          trail.positions[index * 3] = point.position.x;
          trail.positions[index * 3 + 1] = point.position.y;
          trail.positions[index * 3 + 2] = point.position.z;
        }
        writeTrailColors(
          trail.colors,
          trail.points.length,
          trailFadeRef.current,
          [0.47, 0.66, 0.83],
        );
        trail.positionAttribute.needsUpdate = true;
        trail.colorAttribute.needsUpdate = true;
        trail.geometry.setDrawRange(0, trail.points.length);
        trail.geometry.computeBoundingSphere();
      }
      lastMoonTrailTime = exactState.timeSeconds;
    };

    const observerViewpoint = (
      observerBodyId: string,
      observerState: BodyState,
      targetPosition: Vector3,
    ): Vector3 => {
      const observerDefinition = majorBodyById.get(observerBodyId);
      if (observerDefinition === undefined) {
        throw new Error(
          `Camera observer body ${observerBodyId} has no physical definition`,
        );
      }
      const observerCenter = scenePosition(observerState.positionM);
      const viewpoint = surfaceObserverViewpoint(
        observerCenter,
        targetPosition,
        observerDefinition.meanRadiusM,
      );
      container.dataset["cameraObserverAltitudeKm"] =
        viewpoint.altitudeKm.toFixed(3);
      return viewpoint.position;
    };

    const parentFacingCameraDirection = (
      bodyId: string,
      bodyPosition: Vector3,
      parentPosition: Vector3 | undefined,
      elapsedSeconds: number,
    ): Vector3 => {
      if (parentPosition === undefined) {
        return PERSPECTIVE_CAMERA_DIRECTION.clone();
      }
      const parentDirection = parentPosition
        .clone()
        .sub(bodyPosition)
        .normalize();
      if (bodyId !== "saturn" && bodyId !== "uranus") {
        return parentDirection
          .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.2))
          .normalize();
      }
      const spinPole = new Vector3(0, 1, 0).applyQuaternion(
        bodyOrientationQuaternion(bodyId, elapsedSeconds),
      );
      const polePerpendicularToParent = spinPole.addScaledVector(
        parentDirection,
        -spinPole.dot(parentDirection),
      );
      if (polePerpendicularToParent.lengthSq() < 1e-12) {
        return parentDirection;
      }
      return parentDirection
        .add(polePerpendicularToParent.normalize().multiplyScalar(0.38))
        .normalize();
    };

    const apolloInspectionPose = (): Readonly<{
      siteId: string;
      position: Vector3;
      target: Vector3;
      up: Vector3;
    }> | null => {
      const siteId = apolloInspectionSiteIdRef.current;
      if (siteId === null || focusBodyIdRef.current !== "moon") {
        return null;
      }
      const siteGroup = apolloSiteGroups.get(siteId);
      if (siteGroup === undefined) {
        throw new Error(`Apollo inspection site ${siteId} is unavailable`);
      }
      siteGroup.updateWorldMatrix(true, false);
      const origin = siteGroup.localToWorld(new Vector3(0, 0, 0));
      const target = siteGroup.localToWorld(new Vector3(0, 1.1, 0));
      const position = siteGroup.localToWorld(new Vector3(24, 11, 22));
      const up = siteGroup
        .localToWorld(new Vector3(0, 1, 0))
        .sub(origin)
        .normalize();
      return { siteId, position, target, up };
    };

    const applyApolloInspectionCamera = (): boolean => {
      const pose = apolloInspectionPose();
      if (pose === null) {
        delete container.dataset["apolloInspectionSite"];
        return false;
      }
      camera.near = 0.01 / ASTRONOMICAL_UNIT_M;
      camera.far = DEFAULT_CAMERA_FAR_AU;
      camera.updateProjectionMatrix();
      camera.position.copy(pose.position);
      camera.up.copy(pose.up);
      controls.target.copy(pose.target);
      controls.minDistance = 0.25 / ASTRONOMICAL_UNIT_M;
      controls.maxDistance = 500 / ASTRONOMICAL_UNIT_M;
      camera.lookAt(pose.target);
      viewZoomReferenceDistanceAu = camera.position.distanceTo(pose.target);
      container.dataset["focusDistanceAu"] =
        viewZoomReferenceDistanceAu.toFixed(12);
      container.dataset["apolloInspectionSite"] = pose.siteId;
      container.dataset["cameraOrientation"] = "apollo-site-inspection";
      return true;
    };

    const resetCamera = (
      requestedFocusBodyId: string | null,
      current: SimulationState | undefined,
    ): void => {
      if (requestedFocusBodyId === null || current === undefined) {
        camera.near = DEFAULT_CAMERA_NEAR_AU;
        camera.far = DEFAULT_CAMERA_FAR_AU;
        camera.updateProjectionMatrix();
        camera.position.copy(SOLAR_SYSTEM_CAMERA_POSITION);
        controls.target.set(0, 0, 0);
        viewZoomReferenceDistanceAu = SOLAR_SYSTEM_CAMERA_POSITION.length();
        controls.minDistance = 0;
        controls.maxDistance = Number.POSITIVE_INFINITY;
        delete container.dataset["focusDistanceAu"];
        delete container.dataset["cameraObserverBody"];
        delete container.dataset["cameraTargetBody"];
        delete container.dataset["cameraObserverAltitudeKm"];
        return;
      }
      if (applyApolloInspectionCamera()) {
        return;
      }
      const focusDefinition = majorBodySnapshot.bodies.find(
        (body) => body.id === requestedFocusBodyId,
      );
      const knownFocusDefinition = knownSatelliteById.get(requestedFocusBodyId);
      const isIssFocus = requestedFocusBodyId === ISS_BODY_ID;
      const isVoyagerFocus = isVoyagerBodyId(requestedFocusBodyId);
      const isOperationalSpacecraftFocus =
        isOperationalSpacecraftBodyId(requestedFocusBodyId);
      const isJovianMonolithFocus =
        requestedFocusBodyId === JOVIAN_MONOLITH_BODY_ID;
      const isFictionalOrbiterFocus =
        isFictionalOrbiterId(requestedFocusBodyId);
      const isSpacecraftFocus =
        isIssFocus ||
        isVoyagerFocus ||
        isOperationalSpacecraftFocus ||
        isJovianMonolithFocus ||
        isFictionalOrbiterFocus;
      const focusState = bodyStateById(current, requestedFocusBodyId);
      if (
        (focusDefinition === undefined &&
          knownFocusDefinition === undefined &&
          !isIssFocus &&
          !isVoyagerFocus &&
          !isOperationalSpacecraftFocus &&
          !isJovianMonolithFocus &&
          !isFictionalOrbiterFocus) ||
        focusState === undefined
      ) {
        throw new Error(`Focus body ${requestedFocusBodyId} is unavailable`);
      }
      const focusPosition = scenePosition(focusState.positionM);
      const requestedTargetBodyId = cameraTargetBodyIdRef.current;
      const targetState =
        requestedTargetBodyId === undefined
          ? undefined
          : bodyStateById(current, requestedTargetBodyId);
      if (requestedTargetBodyId !== undefined && targetState === undefined) {
        throw new Error(
          `Camera target body ${requestedTargetBodyId} is unavailable`,
        );
      }
      camera.near = isSpacecraftFocus
        ? 0.05 / ASTRONOMICAL_UNIT_M
        : DEFAULT_CAMERA_NEAR_AU;
      camera.far = DEFAULT_CAMERA_FAR_AU;
      camera.updateProjectionMatrix();
      if (targetState !== undefined && requestedTargetBodyId !== undefined) {
        const targetPosition = scenePosition(targetState.positionM);
        const observerPosition = observerViewpoint(
          requestedFocusBodyId,
          focusState,
          targetPosition,
        );
        const observerDistance = observerPosition.distanceTo(targetPosition);
        if (!Number.isFinite(observerDistance) || observerDistance <= 0) {
          throw new Error(
            "Camera observer distance must be positive and finite",
          );
        }
        camera.position.copy(observerPosition);
        camera.up.copy(ECLIPTIC_NORTH);
        controls.target.copy(targetPosition);
        controls.minDistance = camera.near * 2;
        controls.maxDistance = DEFAULT_CAMERA_FAR_AU * 0.9;
        viewZoomReferenceDistanceAu = observerDistance;
        camera.lookAt(targetPosition);
        container.dataset["cameraObserverBody"] = requestedFocusBodyId;
        container.dataset["cameraTargetBody"] = requestedTargetBodyId;
        container.dataset["focusDistanceAu"] = observerDistance.toFixed(8);
        return;
      }
      delete container.dataset["cameraObserverBody"];
      delete container.dataset["cameraTargetBody"];
      delete container.dataset["cameraObserverAltitudeKm"];
      const focusDistance =
        cameraDistanceOverrideAuRef.current ??
        (requestedFocusBodyId === "sun"
          ? SOLAR_SYSTEM_CAMERA_POSITION.length()
          : isSpacecraftFocus
            ? spacecraftFocusDistanceAu(requestedFocusBodyId)
            : focusDefinition === undefined
              ? 0.003
              : focusDistanceAu(focusDefinition, bodyVisibilityRef.current));
      if (!Number.isFinite(focusDistance) || focusDistance <= 0) {
        throw new Error("Camera focus distance must be positive and finite");
      }
      if (!isSpacecraftFocus) {
        camera.near = focusNearPlaneAu(focusDistance, DEFAULT_CAMERA_NEAR_AU);
        camera.updateProjectionMatrix();
      }
      const sunState = bodyStateById(current, "sun");
      const cameraDirection =
        requestedFocusBodyId === "sun" || sunState === undefined
          ? PERSPECTIVE_CAMERA_DIRECTION.clone()
          : parentFacingCameraDirection(
              requestedFocusBodyId,
              focusPosition,
              scenePosition(sunState.positionM),
              current.timeSeconds,
            );
      camera.position
        .copy(focusPosition)
        .add(cameraDirection.multiplyScalar(focusDistance));
      if (
        requestedFocusBodyId === "sun" &&
        deepSpacePresentationRef.current === "interstellar-scale"
      ) {
        const midpoint = focusPosition
          .clone()
          .add(alphaCentauriOffset.clone().multiplyScalar(0.5));
        const viewingDirection = alphaCentauriOffset
          .clone()
          .normalize()
          .cross(ECLIPTIC_NORTH)
          .normalize()
          .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.22))
          .normalize();
        camera.position
          .copy(midpoint)
          .add(viewingDirection.multiplyScalar(focusDistance));
        controls.target.copy(midpoint);
      } else {
        controls.target.copy(focusPosition);
      }
      controls.minDistance = Math.max(
        isSpacecraftFocus
          ? (spacecraftBoundingRadiusM(requestedFocusBodyId) ?? 1) /
              ASTRONOMICAL_UNIT_M /
              8
          : focusDefinition === undefined
            ? camera.near * 2
            : focusDefinition.meanRadiusM / ASTRONOMICAL_UNIT_M / 2,
        camera.near * 2,
      );
      controls.maxDistance = DEFAULT_CAMERA_FAR_AU * 0.9;
      viewZoomReferenceDistanceAu = camera.position.distanceTo(controls.target);
      container.dataset["focusDistanceAu"] = focusDistance.toFixed(
        isSpacecraftFocus ? 12 : 8,
      );
    };

    const applyOrientationPreset = (
      preset: Exclude<CameraOrientationPreset, "custom">,
      requestedFocusBodyId: string | null,
      current: SimulationState | undefined,
    ): void => {
      if (applyApolloInspectionCamera()) {
        controls.update();
        return;
      }
      const requestedTargetBodyId = cameraTargetBodyIdRef.current;
      if (
        requestedTargetBodyId !== undefined &&
        current !== undefined &&
        requestedFocusBodyId !== null
      ) {
        const observerState = bodyStateById(current, requestedFocusBodyId);
        const targetState = bodyStateById(current, requestedTargetBodyId);
        if (observerState === undefined || targetState === undefined) {
          throw new Error(
            `Observer view ${requestedFocusBodyId} to ${requestedTargetBodyId} is unavailable`,
          );
        }
        const targetPosition = scenePosition(targetState.positionM);
        camera.position.copy(
          observerViewpoint(
            requestedFocusBodyId,
            observerState,
            targetPosition,
          ),
        );
        controls.target.copy(targetPosition);
        camera.up.copy(ECLIPTIC_NORTH);
        camera.lookAt(controls.target);
        controls.update();
        container.dataset["cameraOrientation"] = "observer-facing";
        container.dataset["cameraObserverBody"] = requestedFocusBodyId;
        container.dataset["cameraTargetBody"] = requestedTargetBodyId;
        return;
      }
      if (
        requestedFocusBodyId === "sun" &&
        deepSpacePresentationRef.current === "interstellar-scale"
      ) {
        camera.up.copy(ECLIPTIC_NORTH);
        camera.lookAt(controls.target);
        controls.update();
        container.dataset["cameraOrientation"] = "interstellar-scale";
        return;
      }
      const currentDistance = camera.position.distanceTo(controls.target);
      const distance =
        Number.isFinite(currentDistance) && currentDistance > camera.near * 2
          ? currentDistance
          : SOLAR_SYSTEM_CAMERA_POSITION.length();
      const focusState =
        current === undefined || requestedFocusBodyId === null
          ? undefined
          : bodyStateById(current, requestedFocusBodyId);
      const target =
        focusState === undefined
          ? requestedFocusBodyId === null
            ? new Vector3(0, 0, 0)
            : controls.target.clone()
          : scenePosition(focusState.positionM);
      const parentId =
        requestedFocusBodyId === null
          ? undefined
          : parentBodyId(requestedFocusBodyId);
      const parentState =
        current === undefined || parentId === undefined
          ? undefined
          : bodyStateById(current, parentId);
      const sunState =
        current === undefined ? undefined : bodyStateById(current, "sun");
      let direction: Vector3;
      if (preset === "overhead") {
        direction = ECLIPTIC_NORTH.clone();
        camera.up.copy(ECLIPTIC_FORWARD);
      } else if (preset === "edge-on") {
        direction = ECLIPTIC_FORWARD.clone();
        camera.up.copy(ECLIPTIC_NORTH);
      } else if (
        preset === "sun-facing" &&
        focusState !== undefined &&
        sunState !== undefined
      ) {
        direction = parentFacingCameraDirection(
          requestedFocusBodyId ?? "sun",
          target,
          scenePosition(sunState.positionM),
          current?.timeSeconds ?? 0,
        );
        camera.up.copy(ECLIPTIC_NORTH);
      } else if (preset === "parent-facing" && focusState !== undefined) {
        direction = parentFacingCameraDirection(
          requestedFocusBodyId ?? "sun",
          target,
          parentState === undefined
            ? undefined
            : scenePosition(parentState.positionM),
          current?.timeSeconds ?? 0,
        );
        camera.up.copy(ECLIPTIC_NORTH);
      } else if (
        preset === "velocity" &&
        focusState !== undefined &&
        parentState !== undefined
      ) {
        direction = icrfToScene({
          x: parentState.velocityMps[0] - focusState.velocityMps[0],
          y: parentState.velocityMps[1] - focusState.velocityMps[1],
          z: parentState.velocityMps[2] - focusState.velocityMps[2],
        })
          .normalize()
          .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.12))
          .normalize();
        camera.up.copy(ECLIPTIC_NORTH);
      } else if (
        preset === "orbital-plane" &&
        focusState !== undefined &&
        parentState !== undefined
      ) {
        const relativePosition = scenePosition(focusState.positionM).sub(
          scenePosition(parentState.positionM),
        );
        const relativeVelocity = icrfToScene({
          x: focusState.velocityMps[0] - parentState.velocityMps[0],
          y: focusState.velocityMps[1] - parentState.velocityMps[1],
          z: focusState.velocityMps[2] - parentState.velocityMps[2],
        });
        direction = relativePosition.cross(relativeVelocity).normalize();
        camera.up.copy(ECLIPTIC_FORWARD);
      } else {
        direction = PERSPECTIVE_CAMERA_DIRECTION.clone();
        camera.up.copy(ECLIPTIC_NORTH);
      }
      camera.position.copy(target).add(direction.multiplyScalar(distance));
      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      container.dataset["cameraOrientation"] = preset;
    };

    const completeCameraTransition = (): void => {
      if (activeCameraTransition === undefined) {
        return;
      }
      const transition = activeCameraTransition;
      camera.position.copy(transition.endPosition);
      controls.target.copy(transition.endTarget);
      camera.up.copy(transition.endUp);
      camera.near = transition.endNear;
      camera.far = transition.endFar;
      camera.updateProjectionMatrix();
      controls.minDistance = transition.endMinimumDistance;
      controls.maxDistance = transition.endMaximumDistance;
      controls.enabled = true;
      camera.lookAt(transition.endTarget);
      viewZoomReferenceDistanceAu = camera.position.distanceTo(controls.target);
      lastReportedViewZoom = camera.zoom;
      container.dataset["viewMagnification"] = camera.zoom.toFixed(4);
      onViewZoomChangeRef.current(camera.zoom);
      const settledPreset = orientationPresetRef.current;
      container.dataset["cameraTracking"] =
        transition.destinationTargetBodyId !== undefined
          ? "observer-and-target"
          : settledPreset === "sun-facing" ||
              settledPreset === "parent-facing" ||
              settledPreset === "velocity" ||
              settledPreset === "orbital-plane"
            ? "continuous"
            : "position-only";
      activeCameraTransition = undefined;
      cameraJourney.hidden = true;
      container.dataset["cameraTransitionPhase"] = "settled";
      container.dataset["cameraTransitionSpeedMps"] = "0.000";
      container.dataset["cameraTransitionSequence"] = String(
        transition.sequence,
      );
    };

    interruptCameraTransition = (): void => {
      if (activeCameraTransition === undefined) {
        return;
      }
      const sequence = activeCameraTransition.sequence;
      activeCameraTransition = undefined;
      controls.enabled = true;
      cameraJourney.hidden = true;
      container.dataset["cameraTransitionPhase"] = "settled";
      container.dataset["cameraTransitionSpeedMps"] = "0.000";
      container.dataset["cameraTransitionInterrupted"] = String(sequence);
    };

    const beginCameraTransition = (
      requestedFocusBodyId: string | null,
      current: SimulationState,
    ): boolean => {
      const sequence = cameraTransitionSequenceRef.current;
      const durationMs = cameraTransitionDurationMsRef.current;
      if (
        sequence === lastCameraTransitionSequence ||
        !Number.isFinite(durationMs) ||
        durationMs <= 0
      ) {
        return false;
      }
      if (activeCameraTransition !== undefined) {
        completeCameraTransition();
      }
      const startPosition = camera.position.clone();
      const startTarget = controls.target.clone();
      const startUp = camera.up.clone();
      resetCamera(requestedFocusBodyId, current);
      const requestedPreset = orientationPresetRef.current;
      applyOrientationPreset(
        requestedPreset === "custom"
          ? requestedFocusBodyId === null
            ? "perspective"
            : "sun-facing"
          : requestedPreset,
        requestedFocusBodyId,
        current,
      );
      const overviewDistanceAu = cameraTransitionOverviewDistanceAuRef.current;
      if (!Number.isFinite(overviewDistanceAu) || overviewDistanceAu <= 0) {
        throw new Error(
          "Camera transition overview distance must be positive and finite",
        );
      }
      const endPosition = camera.position.clone();
      const endTarget = controls.target.clone();
      const departureBodyId = lastFocusBodyId;
      const departureState =
        departureBodyId === null || departureBodyId === undefined
          ? undefined
          : bodyStateById(current, departureBodyId);
      const departureAnchor =
        departureState === undefined
          ? startTarget.clone()
          : scenePosition(departureState.positionM);
      const destinationOverviewAnchorBodyId =
        cameraTransitionOverviewAnchorBodyIdRef.current;
      const destinationOverviewAnchorState =
        destinationOverviewAnchorBodyId === undefined
          ? undefined
          : bodyStateById(current, destinationOverviewAnchorBodyId);
      if (
        destinationOverviewAnchorBodyId !== undefined &&
        destinationOverviewAnchorState === undefined
      ) {
        throw new Error(
          `Camera overview anchor ${destinationOverviewAnchorBodyId} is unavailable`,
        );
      }
      const destinationAnchor =
        destinationOverviewAnchorState === undefined
          ? endTarget.clone()
          : scenePosition(destinationOverviewAnchorState.positionM);
      const journeyDistanceAu = departureAnchor.equals(destinationAnchor)
        ? 0
        : departureAnchor.distanceTo(destinationAnchor);
      const framingDistanceAu = Math.max(
        overviewDistanceAu,
        cameraTransitionAutoFrameRef.current ? journeyDistanceAu * 1.4 : 0,
      );
      const isObserverDestination = cameraTargetBodyIdRef.current !== undefined;
      const observerSeparationAu = destinationAnchor.distanceTo(endTarget);
      const overviewEndDistanceAu = isObserverDestination
        ? Math.min(framingDistanceAu, observerSeparationAu * 0.35)
        : framingDistanceAu;
      if (
        !Number.isFinite(overviewEndDistanceAu) ||
        overviewEndDistanceAu <= 0
      ) {
        throw new Error(
          "Camera transition destination overview distance must be positive and finite",
        );
      }
      const overviewStartTarget = startTarget.clone();
      const overviewEndTarget = isObserverDestination
        ? endTarget.clone()
        : destinationAnchor.clone();
      const destinationOverviewDirection = isObserverDestination
        ? endPosition.clone().sub(destinationAnchor).normalize()
        : PERSPECTIVE_CAMERA_DIRECTION.clone();
      const bodyName = (bodyId: string | null | undefined): string => {
        if (bodyId === null || bodyId === undefined || bodyId === "") {
          return "the Solar System";
        }
        return (
          majorBodyById.get(bodyId)?.name ??
          knownSatelliteById.get(bodyId)?.name ??
          (isVoyagerBodyId(bodyId)
            ? voyagerById.get(bodyId)?.name
            : undefined) ??
          (bodyId === ISS_BODY_ID ? "the ISS" : bodyId)
        );
      };
      const transitionStartedAtMs = performance.now();
      activeCameraTransition = {
        style: cameraTransitionAutoFrameRef.current ? "direct" : "authored",
        sequence,
        startedAtMs: transitionStartedAtMs,
        durationMs,
        startPosition,
        startTarget,
        startUp,
        overviewStartPosition: departureAnchor
          .clone()
          .add(
            PERSPECTIVE_CAMERA_DIRECTION.clone().multiplyScalar(
              framingDistanceAu,
            ),
          ),
        overviewStartTarget,
        departureAnchor,
        overviewEndPosition: destinationAnchor
          .clone()
          .add(
            destinationOverviewDirection.multiplyScalar(overviewEndDistanceAu),
          ),
        overviewEndTarget,
        destinationAnchor,
        destinationOverviewAnchorBodyId,
        overviewEndDistanceAu,
        isObserverDestination,
        endPosition,
        endTarget,
        endOffset: endPosition.clone().sub(endTarget),
        destinationFocusBodyId: requestedFocusBodyId,
        destinationTargetBodyId: cameraTargetBodyIdRef.current,
        departureName: bodyName(departureBodyId),
        destinationName: bodyName(requestedFocusBodyId),
        journeyDistanceAu,
        endUp: camera.up.clone(),
        endNear: camera.near,
        endFar: camera.far,
        endMinimumDistance: controls.minDistance,
        endMaximumDistance: controls.maxDistance,
        lastSpeedSampleAtMs: transitionStartedAtMs,
        smoothedSpeedMps: 0,
      };
      lastCameraTransitionSequence = sequence;
      camera.position.copy(startPosition);
      controls.target.copy(startTarget);
      camera.up.copy(startUp);
      camera.near = DEFAULT_CAMERA_NEAR_AU;
      camera.far = DEFAULT_CAMERA_FAR_AU;
      camera.updateProjectionMatrix();
      controls.minDistance = 0;
      controls.maxDistance = Number.POSITIVE_INFINITY;
      controls.enabled = true;
      container.dataset["cameraTransitionPhase"] =
        activeCameraTransition.style === "direct" ? "orienting" : "outbound";
      container.dataset["cameraTransitionSequence"] = String(sequence);
      container.dataset["cameraTransitionOverviewAnchor"] =
        activeCameraTransition.style === "direct"
          ? "not-used-direct-flight"
          : "moving-route";
      container.dataset["cameraTransitionDestinationAnchor"] =
        destinationOverviewAnchorBodyId ?? "camera-target";
      container.dataset["cameraTransitionDurationMs"] = String(durationMs);
      container.dataset["cameraTransitionSpeedDefinition"] =
        "camera-displacement-per-real-second";
      container.dataset["cameraTransitionSpeedMps"] = "0.000";
      container.dataset["cameraTransitionInterpolation"] =
        activeCameraTransition.style === "direct"
          ? "orient-then-logarithmic-approach"
          : "depart-coast-arrive";
      cameraJourney.hidden = false;
      cameraJourney.title =
        "Viewpoint speed is camera displacement per real second, not a physical spacecraft velocity";
      cameraJourney.textContent =
        activeCameraTransition.style === "direct"
          ? `Turning toward ${activeCameraTransition.destinationName}`
          : `Departing ${activeCameraTransition.departureName}`;
      return true;
    };

    const updateCameraTransition = (
      nowMs: number,
      current: SimulationState | undefined,
    ): void => {
      const transition = activeCameraTransition;
      if (transition === undefined) {
        return;
      }
      const previousCameraPosition = camera.position.clone();
      const updateJourneyStatus = (
        status: string,
        displaySpeed: boolean,
      ): void => {
        const sampleIntervalSeconds = Math.max(
          (nowMs - transition.lastSpeedSampleAtMs) / 1_000,
          1 / 240,
        );
        const instantaneousSpeedMps =
          (camera.position.distanceTo(previousCameraPosition) *
            ASTRONOMICAL_UNIT_M) /
          sampleIntervalSeconds;
        if (!Number.isFinite(instantaneousSpeedMps)) {
          throw new Error("Camera transition speed is not finite");
        }
        if (displaySpeed) {
          const smoothingFactor = 1 - Math.exp(-sampleIntervalSeconds / 0.18);
          transition.smoothedSpeedMps +=
            (instantaneousSpeedMps - transition.smoothedSpeedMps) *
            smoothingFactor;
        } else {
          transition.smoothedSpeedMps = 0;
        }
        transition.lastSpeedSampleAtMs = nowMs;
        container.dataset["cameraTransitionSpeedMps"] =
          transition.smoothedSpeedMps.toFixed(3);
        cameraJourney.textContent = displaySpeed
          ? `${status} · Viewpoint speed ${formatViewpointSpeed(
              transition.smoothedSpeedMps,
            )}`
          : status;
      };
      const elapsedMs = Math.max(0, nowMs - transition.startedAtMs);
      container.dataset["cameraTransitionElapsedMs"] = elapsedMs.toFixed(1);
      const inspectionPose = apolloInspectionPose();
      if (
        inspectionPose !== null &&
        transition.destinationFocusBodyId === "moon"
      ) {
        transition.endPosition.copy(inspectionPose.position);
        transition.endTarget.copy(inspectionPose.target);
        transition.endUp.copy(inspectionPose.up);
        transition.destinationAnchor.copy(inspectionPose.target);
        transition.overviewEndTarget.copy(inspectionPose.target);
        transition.overviewEndPosition.copy(inspectionPose.position);
        transition.endOffset.copy(
          inspectionPose.position.clone().sub(inspectionPose.target),
        );
      } else if (
        current !== undefined &&
        transition.destinationFocusBodyId !== null
      ) {
        const focusState = bodyStateById(
          current,
          transition.destinationFocusBodyId,
        );
        const targetState =
          transition.destinationTargetBodyId === undefined
            ? undefined
            : bodyStateById(current, transition.destinationTargetBodyId);
        const overviewAnchorState =
          transition.destinationOverviewAnchorBodyId === undefined
            ? undefined
            : bodyStateById(
                current,
                transition.destinationOverviewAnchorBodyId,
              );
        if (focusState !== undefined) {
          transition.endTarget.copy(
            targetState === undefined
              ? scenePosition(focusState.positionM)
              : scenePosition(targetState.positionM),
          );
          transition.destinationAnchor.copy(
            overviewAnchorState === undefined
              ? transition.endTarget
              : scenePosition(overviewAnchorState.positionM),
          );
          if (
            targetState !== undefined &&
            transition.destinationTargetBodyId !== undefined
          ) {
            transition.endPosition.copy(
              observerViewpoint(
                transition.destinationFocusBodyId,
                focusState,
                transition.endTarget,
              ),
            );
          } else {
            transition.endPosition
              .copy(transition.endTarget)
              .add(transition.endOffset);
          }
          transition.overviewEndTarget.copy(
            transition.isObserverDestination
              ? transition.endTarget
              : transition.destinationAnchor,
          );
          transition.overviewEndPosition
            .copy(transition.destinationAnchor)
            .add(
              (transition.isObserverDestination
                ? transition.endPosition
                    .clone()
                    .sub(transition.destinationAnchor)
                    .normalize()
                : PERSPECTIVE_CAMERA_DIRECTION.clone()
              ).multiplyScalar(transition.overviewEndDistanceAu),
            );
        }
      }
      if (transition.style === "direct") {
        const directSample = sampleDirectCameraTransition(
          elapsedMs,
          transition.durationMs,
        );
        container.dataset["cameraTransitionPhase"] = directSample.phase;
        if (directSample.phase === "settled") {
          completeCameraTransition();
          return;
        }
        if (directSample.phase === "orienting") {
          camera.position.copy(transition.startPosition);
          controls.target.lerpVectors(
            transition.startTarget,
            transition.endTarget,
            directSample.segmentProgress,
          );
          camera.up
            .lerpVectors(
              transition.startUp,
              ECLIPTIC_NORTH,
              directSample.segmentProgress,
            )
            .normalize();
          updateJourneyStatus(
            `Turning toward ${transition.destinationName}`,
            false,
          );
        } else {
          interpolateCameraPositionAroundAnchor(
            camera.position,
            transition.startPosition,
            transition.endPosition,
            transition.endTarget,
            directSample.segmentProgress,
          );
          controls.target.copy(transition.endTarget);
          camera.up
            .lerpVectors(
              ECLIPTIC_NORTH,
              transition.endUp,
              directSample.segmentProgress,
            )
            .normalize();
          updateJourneyStatus(
            directSample.phase === "arriving"
              ? `Approaching ${transition.destinationName}`
              : `Travelling to ${transition.destinationName}`,
            true,
          );
        }
        camera.lookAt(controls.target);
        return;
      }
      const sample = sampleCameraTransition(elapsedMs, transition.durationMs);
      container.dataset["cameraTransitionPhase"] = sample.phase;
      if (sample.phase === "settled") {
        completeCameraTransition();
        return;
      }
      let journeyStatus = `Departing ${transition.departureName}`;
      if (sample.phase === "outbound") {
        interpolateCameraPositionAroundAnchor(
          camera.position,
          transition.startPosition,
          transition.overviewStartPosition,
          transition.departureAnchor,
          sample.segmentProgress,
        );
        controls.target.copy(transition.startTarget);
        camera.up
          .lerpVectors(
            transition.startUp,
            ECLIPTIC_NORTH,
            sample.segmentProgress,
          )
          .normalize();
      } else if (sample.phase === "overview") {
        camera.position.lerpVectors(
          transition.overviewStartPosition,
          transition.overviewEndPosition,
          sample.segmentProgress,
        );
        controls.target.lerpVectors(
          transition.overviewStartTarget,
          transition.overviewEndTarget,
          sample.segmentProgress,
        );
        camera.up.copy(ECLIPTIC_NORTH);
        container.dataset["cameraTransitionOverviewVisited"] = String(
          transition.sequence,
        );
        container.dataset["cameraTransitionOverviewDistanceAu"] =
          transition.overviewStartPosition
            .distanceTo(transition.overviewStartTarget)
            .toFixed(6);
        journeyStatus = `Crossing ${formatTacticalDistance(
          transition.journeyDistanceAu,
        )} toward ${transition.destinationName}`;
      } else {
        interpolateCameraPositionAroundAnchor(
          camera.position,
          transition.overviewEndPosition,
          transition.endPosition,
          transition.destinationAnchor,
          sample.segmentProgress,
        );
        controls.target.lerpVectors(
          transition.overviewEndTarget,
          transition.endTarget,
          sample.segmentProgress,
        );
        camera.up
          .lerpVectors(ECLIPTIC_NORTH, transition.endUp, sample.segmentProgress)
          .normalize();
        journeyStatus = `Arriving at ${transition.destinationName}`;
      }
      updateJourneyStatus(journeyStatus, true);
      camera.lookAt(controls.target);
    };

    const applyCameraNavigationCommand = (
      command: CameraNavigationCommand,
      requestedFocusBodyId: string | null,
      current: SimulationState | undefined,
    ): boolean => {
      completeCameraTransition();
      if (
        command.action === "fit-selection" &&
        requestedFocusBodyId !== null &&
        current === undefined
      ) {
        return false;
      }
      if (command.action === "fit-selection") {
        resetCamera(requestedFocusBodyId, current);
        const requestedPreset = orientationPresetRef.current;
        applyOrientationPreset(
          requestedPreset === "custom"
            ? requestedFocusBodyId === null
              ? "perspective"
              : "sun-facing"
            : requestedPreset,
          requestedFocusBodyId,
          current,
        );
      } else {
        const currentDistance = camera.position.distanceTo(controls.target);
        const distanceMultiplier = command.action === "zoom-in" ? 1 / 1.7 : 1.7;
        const maximumDistance = Number.isFinite(controls.maxDistance)
          ? controls.maxDistance
          : camera.far / 2;
        const nextDistance = Math.min(
          maximumDistance,
          Math.max(controls.minDistance, currentDistance * distanceMultiplier),
        );
        const direction = camera.position
          .clone()
          .sub(controls.target)
          .normalize();
        camera.position
          .copy(controls.target)
          .add(direction.multiplyScalar(nextDistance));
        controls.update();
      }
      container.dataset["cameraNavigationAction"] = command.action;
      container.dataset["cameraNavigationSequence"] = String(command.sequence);
      return true;
    };

    let animationFrame = 0;
    let startupTimer = 0;
    const render = (): void => {
      const frameRenderStartedAtMs = performance.now();
      const frameIntervalMs = Math.max(
        0.001,
        frameRenderStartedAtMs - lastRenderedAtMs,
      );
      lastRenderedAtMs = frameRenderStartedAtMs;
      frameIntervalEmaMs = frameIntervalEmaMs * 0.92 + frameIntervalMs * 0.08;
      const activeVisualQuality = visualQualityRef.current;
      if (activeVisualQuality !== lastVisualQuality) {
        applyVisualQuality(activeVisualQuality);
      }
      const requestedFrame = frameRef.current;
      if (clearTrailsTokenRef.current !== lastClearTrailsToken) {
        lastClearTrailsToken = clearTrailsTokenRef.current;
        clearTrails();
        container.dataset["clearTrailsToken"] = String(lastClearTrailsToken);
      }
      const currentVisibility = objectVisibilityRef.current;
      stars.visible = currentVisibility.stars;
      container.dataset["starsVisible"] = String(stars.visible);
      zodiacGroup.visible = showZodiacRef.current;
      zodiacLegend.hidden = !zodiacGroup.visible;
      container.dataset["zodiacVisible"] = String(zodiacGroup.visible);
      const smallBodiesVisible =
        viewModeRef.current === "orrery" &&
        (currentVisibility.asteroids || currentVisibility.comets);
      gpuCanvas.hidden = !smallBodiesVisible;
      if (smallBodiesVisible) {
        ensureGpuLayer();
      }
      if (
        requestedFrame !== undefined &&
        requestedFrame.end.timeSeconds !== activeFrameEndTime
      ) {
        activeFrameEndTime = requestedFrame.end.timeSeconds;
        const simulatedSecondsPerSecond =
          requestedFrame.transitionDurationMs <= 0
            ? 0
            : (Math.abs(
                requestedFrame.end.timeSeconds -
                  requestedFrame.start.timeSeconds,
              ) /
                requestedFrame.transitionDurationMs) *
              1_000;
        const motionTreatment =
          simulatedSecondsPerSecond >= 7 * 86_400
            ? "high-speed"
            : simulatedSecondsPerSecond >= 86_400
              ? "accelerated"
              : "precise";
        container.dataset["motionTreatment"] = motionTreatment;
        planetTrailMaterial.opacity =
          motionTreatment === "high-speed"
            ? 0.82
            : motionTreatment === "accelerated"
              ? 0.7
              : 0.62;
        moonTrailMaterial.opacity =
          motionTreatment === "high-speed"
            ? 0.92
            : motionTreatment === "accelerated"
              ? 0.84
              : 0.78;
        updateOrbitGuides(requestedFrame.end);
        for (const trailState of requestedFrame.trailStates ?? [
          requestedFrame.end,
        ]) {
          updateTrail(trailState);
        }
      }
      const current = displayedStateRef.current;
      if (requestedFrame !== undefined && current !== undefined) {
        const frameDurationSeconds =
          requestedFrame.end.timeSeconds - requestedFrame.start.timeSeconds;
        const transitionFraction =
          frameDurationSeconds === 0
            ? 1
            : (current.timeSeconds - requestedFrame.start.timeSeconds) /
              frameDurationSeconds;
        container.dataset["interpolationFraction"] = Math.max(
          0,
          Math.min(1, transitionFraction),
        ).toFixed(4);
        container.dataset["renderedTimeSeconds"] =
          current.timeSeconds.toFixed(3);
      }

      const exposureReferenceBodyId =
        surfaceObserverRef.current?.bodyId ?? focusBodyIdRef.current;
      let exposureDistanceFromSunAu: number | undefined;
      if (
        current !== undefined &&
        exposureReferenceBodyId !== null &&
        exposureReferenceBodyId !== "sun"
      ) {
        const exposureBodyState = bodyStateById(
          current,
          exposureReferenceBodyId,
        );
        const exposureSunState = bodyStateById(current, "sun");
        if (exposureBodyState !== undefined && exposureSunState !== undefined) {
          exposureDistanceFromSunAu = scenePosition(
            exposureBodyState.positionM,
          ).distanceTo(scenePosition(exposureSunState.positionM));
        }
      }
      const activeVisualProfile = VISUAL_QUALITY_PROFILES[activeVisualQuality];
      const targetExposure = solarExposureForDistanceAu(
        activeVisualQuality,
        exposureDistanceFromSunAu,
      );
      currentExposure = adaptExposure(
        currentExposure,
        targetExposure,
        Math.min(frameIntervalMs, 250) / 1_000,
        activeVisualProfile.exposureHalfLifeSeconds,
      );
      renderer.toneMappingExposure = currentExposure;
      for (const ringVisual of ringVisuals.values()) {
        for (const material of ringVisual.materials) {
          setRequiredNumberUniform(
            material,
            "displayExposure",
            currentExposure,
          );
        }
      }
      ambientLight.intensity = 0.045 / currentExposure;
      container.dataset["cameraExposure"] = currentExposure.toFixed(5);
      container.dataset["cameraExposureTarget"] = targetExposure.toFixed(5);
      container.dataset["exposureReferenceDistanceAu"] =
        exposureDistanceFromSunAu?.toFixed(6) ?? "system-overview";

      for (const body of majorBodySnapshot.bodies) {
        const mesh = bodyMeshes.get(body.id);
        if (mesh !== undefined) {
          mesh.visible = isMajorBodyVisible(body.type, currentVisibility);
        }
      }
      const asteroidsVisible =
        viewModeRef.current === "orrery" && currentVisibility.asteroids;
      const cometsVisible =
        viewModeRef.current === "orrery" && currentVisibility.comets;
      gpuCanvas.dataset["asteroidsVisible"] = String(asteroidsVisible);
      gpuCanvas.dataset["cometsVisible"] = String(cometsVisible);
      gpuCanvas.dataset["locatorMode"] =
        viewModeRef.current === "orrery" ? "orrery" : "disabled";
      gpuLayer?.setCategoryVisibility(asteroidsVisible, cometsVisible);
      gpuLayer?.setTrailSettings(
        showMinorBodyTrailsRef.current && activeCameraTransition === undefined,
        trailDurationSecondsRef.current,
        trailFadeRef.current,
        clearTrailsTokenRef.current,
      );
      const sceneMutationKey =
        current === undefined
          ? ""
          : [
              current.timeSeconds,
              currentVisibility.planets,
              currentVisibility.moons,
              currentVisibility.spacecraft,
              focusBodyIdRef.current,
              bodyVisibilityRef.current,
              viewModeRef.current,
              showMoonTrailRef.current,
              showPlanetTrailsRef.current,
              showOrbitGuidesRef.current,
              orbitGuideScopeRef.current,
              showEclipticPlaneRef.current,
              gravityWellModeRef.current,
              gravityWellScaleRef.current,
              referenceFrameRef.current,
              trailDurationSecondsRef.current,
              trailFadeRef.current,
              clearTrailsTokenRef.current,
              resetViewTokenRef.current,
            ].join("|");
      if (current !== undefined && sceneMutationKey !== lastSceneMutationKey) {
        lastSceneMutationKey = sceneMutationKey;
        updateStarPositions(current.timeSeconds);
        const sceneBodyPositions = new Map(
          current.bodies.map((body) => [
            body.id,
            scenePosition(body.positionM),
          ]),
        );
        for (const orbiter of FICTIONAL_ORBITERS) {
          const orbiterState = fictionalOrbiterStateById(current, orbiter.id);
          sceneBodyPositions.set(
            orbiter.id,
            scenePosition(orbiterState.positionM),
          );
        }
        const gravityMode = gravityWellModeRef.current;
        const gravityFocusId = focusBodyIdRef.current;
        const gravityCenterState = bodyStateById(
          current,
          gravityFocusId ?? "sun",
        );
        if (gravityCenterState === undefined) {
          throw new Error("Gravity field center state is unavailable");
        }
        const gravitySources: GravityPotentialSource[] = current.bodies
          .filter((body) => body.gravitationalParameterM3S2 > 0)
          .map((body) => {
            const definition = majorBodyById.get(body.id);
            if (definition === undefined) {
              throw new Error(
                `Positive-GM body ${body.id} has no sourced gravity-well radius`,
              );
            }
            const position = scenePosition(body.positionM);
            return {
              id: body.id,
              gravitationalParameterM3S2: body.gravitationalParameterM3S2,
              positionAu: [position.x, position.y, position.z],
              radiusAu: definition.meanRadiusM / ASTRONOMICAL_UNIT_M,
            };
          });
        const gravityCenter = scenePosition(gravityCenterState.positionM);
        const gravityDiagnostics = gravityWellLayer.update({
          mode: gravityMode,
          scale: gravityWellScaleRef.current,
          centerAu: [gravityCenter.x, gravityCenter.y, gravityCenter.z],
          extentAu: gravityFieldExtentAu(
            gravityFocusId,
            bodyVisibilityRef.current,
          ),
          sources: gravitySources,
        });
        container.dataset["gravityWellMode"] = gravityMode;
        container.dataset["gravityWellScale"] = gravityWellScaleRef.current;
        container.dataset["gravityWellVisible"] = String(
          gravityDiagnostics !== undefined,
        );
        container.dataset["gravityPotentialEquation"] =
          "negative-sum-gm-over-r";
        container.dataset["gravityPotentialInterior"] =
          "mean-radius-surface-cap";
        container.dataset["gravityPotentialDisplay"] = "log2-only";
        if (gravityDiagnostics === undefined) {
          delete container.dataset["gravityPotentialSourceCount"];
          delete container.dataset["gravityPotentialMinimumJPerKg"];
          delete container.dataset["gravityPotentialMaximumJPerKg"];
          delete container.dataset["gravityWellExtentAu"];
          delete container.dataset["gravityWellDepthAu"];
          delete container.dataset["gravityFieldTimeSeconds"];
        } else {
          container.dataset["gravityPotentialSourceCount"] = String(
            gravityDiagnostics.sourceCount,
          );
          container.dataset["gravityPotentialMinimumJPerKg"] =
            gravityDiagnostics.minimumMagnitudeJPerKg.toPrecision(10);
          container.dataset["gravityPotentialMaximumJPerKg"] =
            gravityDiagnostics.maximumMagnitudeJPerKg.toPrecision(10);
          container.dataset["gravityWellExtentAu"] =
            gravityDiagnostics.extentAu.toPrecision(10);
          container.dataset["gravityWellDepthAu"] =
            gravityDiagnostics.depthAu.toPrecision(10);
          container.dataset["gravityFieldTimeSeconds"] =
            current.timeSeconds.toFixed(3);
          const legendRange = container.querySelector<HTMLElement>(
            "[data-gravity-potential-range]",
          );
          if (legendRange !== null) {
            legendRange.textContent = `−${formatPotentialMagnitude(
              gravityDiagnostics.maximumMagnitudeJPerKg,
            )} to −${formatPotentialMagnitude(
              gravityDiagnostics.minimumMagnitudeJPerKg,
            )} J/kg`;
          }
        }
        const currentFocusBodyId = focusBodyIdRef.current;
        let visibleKnownMoonPointCount = 0;
        for (const system of knownMoonSystems.values()) {
          const visible =
            currentVisibility.moons && viewModeRef.current === "orrery";
          system.points.visible = visible;
          if (!visible) {
            continue;
          }
          for (const [index, definition] of system.definitions.entries()) {
            const position = sceneBodyPositions.get(definition.id);
            if (position === undefined) {
              throw new Error(
                `Integrated state is missing known moon ${definition.name}`,
              );
            }
            system.positions[index * 3] = position.x;
            system.positions[index * 3 + 1] = position.y;
            system.positions[index * 3 + 2] = position.z;
          }
          const attribute = system.geometry.getAttribute("position");
          if (!(attribute instanceof BufferAttribute)) {
            throw new Error("Known-moon position attribute is unavailable");
          }
          attribute.needsUpdate = true;
          system.geometry.computeBoundingSphere();
          visibleKnownMoonPointCount += system.definitions.length;
        }
        container.dataset["knownMoonCatalogueCount"] = String(
          knownSatelliteSnapshot.bodies.length,
        );
        container.dataset["knownMoonPointCount"] = String(
          visibleKnownMoonPointCount,
        );
        for (const body of majorBodySnapshot.bodies) {
          const bodyState = bodyStateById(current, body.id);
          const mesh = bodyMeshes.get(body.id);
          if (bodyState !== undefined && mesh !== undefined) {
            mesh.position.copy(scenePosition(bodyState.positionM));
            const bodyPosition = sceneBodyPositions.get(body.id);
            if (bodyPosition === undefined) {
              throw new Error(`Scene position is missing body ${body.id}`);
            }
            let nearestBodyDistanceAu = Number.POSITIVE_INFINITY;
            for (const [otherBodyId, otherPosition] of sceneBodyPositions) {
              const otherBodyIsSpacecraft =
                otherBodyId === ISS_BODY_ID ||
                isVoyagerBodyId(otherBodyId) ||
                isOperationalSpacecraftBodyId(otherBodyId);
              if (otherBodyId !== body.id && !otherBodyIsSpacecraft) {
                const otherMajorBody = majorBodyById.get(otherBodyId);
                const isHiddenOverviewMoon =
                  (currentFocusBodyId === null ||
                    currentFocusBodyId === "sun") &&
                  body.type !== "moon" &&
                  (otherMajorBody?.type === "moon" ||
                    knownSatelliteById.has(otherBodyId));
                if (isHiddenOverviewMoon) {
                  continue;
                }
                nearestBodyDistanceAu = Math.min(
                  nearestBodyDistanceAu,
                  bodyPosition.distanceTo(otherPosition),
                );
              }
            }
            const radius = nonOverlappingDisplayedRadiusAu(
              body,
              bodyVisibilityRef.current,
              nearestBodyDistanceAu,
            );
            if (body.id === "saturn" || isDiscreteRingBodyId(body.id)) {
              const meanRadiusKm = body.meanRadiusM / 1_000;
              const equatorialRadiusKm =
                body.id === "saturn"
                  ? SATURN_EQUATORIAL_RADIUS_KM
                  : body.id === "jupiter"
                    ? JUPITER_EQUATORIAL_RADIUS_KM
                    : body.id === "uranus"
                      ? URANUS_EQUATORIAL_RADIUS_KM
                      : NEPTUNE_EQUATORIAL_RADIUS_KM;
              const polarRadiusKm =
                body.id === "saturn"
                  ? SATURN_POLAR_RADIUS_KM
                  : body.id === "jupiter"
                    ? JUPITER_POLAR_RADIUS_KM
                    : body.id === "uranus"
                      ? URANUS_POLAR_RADIUS_KM
                      : NEPTUNE_POLAR_RADIUS_KM;
              mesh.scale.set(
                (radius * equatorialRadiusKm) / meanRadiusKm,
                (radius * polarRadiusKm) / meanRadiusKm,
                (radius * equatorialRadiusKm) / meanRadiusKm,
              );
              container.dataset[`${body.id}EquatorialToPolarRatio`] = (
                equatorialRadiusKm / polarRadiusKm
              ).toFixed(6);
            } else {
              mesh.scale.setScalar(radius);
            }
            const bodyLabel = bodyLabels.get(body.id);
            if (bodyLabel !== undefined) {
              bodyLabel.dataset["displayedRadiusAu"] = radius.toPrecision(9);
            }
            mesh.quaternion.copy(
              bodyOrientationQuaternion(body.id, current.timeSeconds),
            );
            if (body.id === focusBodyIdRef.current) {
              const primeMeridian = bodyOrientationAngles(
                body.id,
                current.timeSeconds,
              ).primeMeridianDeg;
              container.dataset["focusedPrimeMeridianDeg"] = (
                ((primeMeridian % 360) + 360) %
                360
              ).toFixed(6);
            }
          }
        }

        const monolithState = jovianMonolithState(current);
        const jupiterStateForMonolith = bodyStateById(current, "jupiter");
        const ioStateForMonolith = bodyStateById(current, "io");
        if (
          jupiterStateForMonolith === undefined ||
          ioStateForMonolith === undefined
        ) {
          throw new Error("Jovian monolith requires Jupiter and Io state");
        }
        const jupiterPositionForMonolith = scenePosition(
          jupiterStateForMonolith.positionM,
        );
        const ioPositionForMonolith = scenePosition(
          ioStateForMonolith.positionM,
        );
        const radialDirection = ioPositionForMonolith
          .clone()
          .sub(jupiterPositionForMonolith)
          .normalize();
        const relativeVelocityDirection = icrfToScene({
          x:
            ioStateForMonolith.velocityMps[0] -
            jupiterStateForMonolith.velocityMps[0],
          y:
            ioStateForMonolith.velocityMps[1] -
            jupiterStateForMonolith.velocityMps[1],
          z:
            ioStateForMonolith.velocityMps[2] -
            jupiterStateForMonolith.velocityMps[2],
        }).normalize();
        const longAxis = radialDirection
          .clone()
          .cross(relativeVelocityDirection)
          .normalize();
        if (longAxis.lengthSq() < 0.5) {
          throw new Error("Jupiter-Io orbital plane is unavailable");
        }
        const thinAxis = longAxis.clone().cross(radialDirection).normalize();
        monolithMesh.position.copy(scenePosition(monolithState.positionM));
        monolithMesh.quaternion.setFromRotationMatrix(
          new Matrix4().makeBasis(thinAxis, longAxis, radialDirection),
        );
        container.dataset["jovianMonolithDistanceFromIoKm"] = (
          Math.hypot(
            monolithState.positionM[0] - ioStateForMonolith.positionM[0],
            monolithState.positionM[1] - ioStateForMonolith.positionM[1],
            monolithState.positionM[2] - ioStateForMonolith.positionM[2],
          ) / 1_000
        ).toFixed(3);

        for (const orbiter of FICTIONAL_ORBITERS) {
          const group = fictionalOrbiterGroups.get(orbiter.id);
          const position = sceneBodyPositions.get(orbiter.id);
          const parentPosition = sceneBodyPositions.get(orbiter.parentBodyId);
          if (
            group === undefined ||
            position === undefined ||
            parentPosition === undefined
          ) {
            throw new Error(`${orbiter.name} scene state is unavailable`);
          }
          group.position.copy(position);
          group.lookAt(parentPosition);
          const distanceFromParentKm =
            (position.distanceTo(parentPosition) * ASTRONOMICAL_UNIT_M) / 1_000;
          container.dataset[
            `${orbiter.id.replaceAll("-", "")}DistanceFromParentKm`
          ] = distanceFromParentKm.toFixed(3);
        }

        const issState = bodyStateById(current, ISS_BODY_ID);
        const earthStateForIss = bodyStateById(current, ISS_PARENT_BODY_ID);
        if (issState === undefined || earthStateForIss === undefined) {
          throw new Error("ISS or Earth scene state is unavailable");
        }
        const issPosition = scenePosition(issState.positionM);
        const earthPositionForIss = scenePosition(earthStateForIss.positionM);
        issGroup.position.copy(issPosition);
        const zenith = issPosition.clone().sub(earthPositionForIss).normalize();
        const relativeVelocity = icrfToScene({
          x: issState.velocityMps[0] - earthStateForIss.velocityMps[0],
          y: issState.velocityMps[1] - earthStateForIss.velocityMps[1],
          z: issState.velocityMps[2] - earthStateForIss.velocityMps[2],
        });
        const alongTrack = relativeVelocity
          .clone()
          .sub(
            zenith.clone().multiplyScalar(relativeVelocity.clone().dot(zenith)),
          )
          .normalize();
        const orbitNormal = zenith.clone().cross(alongTrack).normalize();
        issGroup.quaternion.setFromRotationMatrix(
          new Matrix4().makeBasis(orbitNormal, zenith, alongTrack),
        );
        container.dataset["issEphemerisValid"] = String(
          isIssEphemerisWithinValidity(current.timeSeconds),
        );
        container.dataset["issEpochSimulationSeconds"] =
          ISS_EPOCH_SIMULATION_SECONDS.toFixed(3);

        const sunPositionForSpacecraft = sceneBodyPositions.get("sun");
        if (sunPositionForSpacecraft === undefined) {
          throw new Error(
            "Sun scene position is unavailable for Voyager attitude",
          );
        }
        const earthPositionForVoyagers = sceneBodyPositions.get("earth");
        if (earthPositionForVoyagers === undefined) {
          throw new Error(
            "Earth scene position is unavailable for Voyager attitude",
          );
        }
        for (const probe of voyagerSnapshot.probes) {
          const probePosition = sceneBodyPositions.get(probe.id);
          const group = voyagerGroups.get(probe.id);
          if (probePosition === undefined || group === undefined) {
            throw new Error(
              `Integrated Voyager state ${probe.id} is unavailable`,
            );
          }
          group.position.copy(probePosition);
          group.quaternion.copy(
            voyagerEarthPointingQuaternion(
              probePosition,
              earthPositionForVoyagers,
            ),
          );
          const earthDirection = earthPositionForVoyagers
            .clone()
            .sub(probePosition)
            .normalize();
          const renderedBoresight = VOYAGER_MODEL_HGA_BORESIGHT.clone()
            .applyQuaternion(group.quaternion)
            .normalize();
          const datasetPrefix =
            probe.id === "voyager-1" ? "voyager1" : "voyager2";
          container.dataset[`${datasetPrefix}AntennaEarthAlignment`] =
            renderedBoresight.dot(earthDirection).toFixed(9);
        }
        container.dataset["voyagerAntennaTarget"] = "earth";
        for (const spacecraft of operationalSpacecraftSnapshot.spacecraft) {
          const spacecraftPosition = sceneBodyPositions.get(spacecraft.id);
          const group = spacecraftGroups.get(spacecraft.id);
          if (group === undefined) {
            throw new Error(
              `${spacecraft.name} official model group is unavailable`,
            );
          }
          if (spacecraftPosition === undefined) {
            group.visible = false;
            continue;
          }
          group.position.copy(spacecraftPosition);
          if (spacecraft.id === ROADSTER_BODY_ID) {
            group.lookAt(camera.position);
            group.rotateY(Math.PI * 0.62);
            group.rotateX(-0.16);
            container.dataset["roadsterAttitude"] =
              "camera-relative-presentation-only-no-physical-attitude-claim";
          } else {
            group.lookAt(sunPositionForSpacecraft);
          }
        }

        let visibleOrbitGuideCount = 0;
        for (const [bodyId, guide] of orbitGuides) {
          const definition = majorBodyById.get(bodyId);
          const parentId = PARENT_BODY_ID[bodyId];
          const focusId = focusBodyIdRef.current;
          const isSelectedOrbit =
            orbitGuideScopeRef.current === "all" && bodyId === focusId;
          const isFocusedSystemMoon =
            definition?.type === "moon" &&
            (parentId === focusId ||
              PARENT_BODY_ID[focusId ?? ""] === parentId);
          const isOrreryPlanetOrbit =
            orbitGuideScopeRef.current === "all" &&
            viewModeRef.current === "orrery" &&
            definition !== undefined &&
            definition.type !== "moon";
          guide.line.visible =
            showOrbitGuidesRef.current &&
            (isSelectedOrbit || isFocusedSystemMoon || isOrreryPlanetOrbit);
          guide.material.opacity = isSelectedOrbit ? 0.8 : 0.22;
          guide.material.color.setHex(isSelectedOrbit ? 0x8fc7f7 : 0x63819b);
          if (guide.line.visible) {
            visibleOrbitGuideCount += 1;
          }
        }
        container.dataset["orbitGuideCount"] = String(visibleOrbitGuideCount);
        container.dataset["viewMode"] = viewModeRef.current;

        const earthState = bodyStateById(current, "earth");
        const sunState = bodyStateById(current, "sun");
        if (earthState !== undefined && sunState !== undefined) {
          const sunScenePosition = scenePosition(sunState.positionM);
          sunlight.position.copy(sunScenePosition);
          eclipticGrid.position.copy(sunScenePosition);
          for (const [bodyId, atmosphereMaterial] of atmosphereMaterials) {
            const bodyState = bodyStateById(current, bodyId);
            if (bodyState === undefined) {
              throw new Error(`Atmosphere state ${bodyId} is unavailable`);
            }
            const distanceFromSunAu = scenePosition(
              bodyState.positionM,
            ).distanceTo(sunScenePosition);
            setRequiredNumberUniform(
              atmosphereMaterial,
              "solarFlux",
              1 / Math.max(distanceFromSunAu * distanceFromSunAu, 0.0016),
            );
          }
          for (const [bodyId, ringVisual] of ringVisuals) {
            const bodyState = bodyStateById(current, bodyId);
            if (bodyState === undefined) {
              throw new Error(`Ring-system state ${bodyId} is unavailable`);
            }
            const bodyPosition = scenePosition(bodyState.positionM);
            const distanceFromSunAu = bodyPosition.distanceTo(sunScenePosition);
            ringVisual.referenceMesh.updateWorldMatrix(true, false);
            const localSun = ringVisual.referenceMesh.worldToLocal(
              sunScenePosition.clone(),
            );
            const localCenter =
              ringVisual.referenceMesh.worldToLocal(bodyPosition);
            const localSunDirection = localSun.sub(localCenter).normalize();
            const localCameraPosition = ringVisual.referenceMesh.worldToLocal(
              camera.position.clone(),
            );
            for (const material of ringVisual.materials) {
              requiredVectorUniform(material, "sunDirectionLocal").value.copy(
                localSunDirection,
              );
              requiredVectorUniform(material, "cameraPositionLocal").value.copy(
                localCameraPosition,
              );
            }
            ringVisual.surfaceShadowSunDirectionLocal?.value.copy(
              localSunDirection,
            );
            for (const material of ringVisual.materials) {
              setRequiredNumberUniform(
                material,
                "solarFlux",
                1 / Math.max(distanceFromSunAu * distanceFromSunAu, 0.0016),
              );
              const orreryGain =
                bodyId === "jupiter" ? 12_000 : bodyId === "neptune" ? 250 : 1;
              setRequiredNumberUniform(
                material,
                "visibilityGain",
                viewModeRef.current === "orrery" ? orreryGain : 1,
              );
            }
          }
          const moonOrigin = referenceOrigin(
            current,
            "moon",
            referenceFrameRef.current,
          );
          moonTrail.position.copy(
            moonOrigin === undefined
              ? new Vector3()
              : scenePosition(moonOrigin.positionM),
          );
          for (const [bodyId, trail] of planetTrails) {
            const planetOrigin = referenceOrigin(
              current,
              bodyId,
              referenceFrameRef.current,
            );
            trail.line.position.copy(
              planetOrigin === undefined
                ? new Vector3()
                : scenePosition(planetOrigin.positionM),
            );
          }
          if (
            gpuLayer !== undefined &&
            smallBodiesVisible &&
            performance.now() - lastSmallBodyGpuUpdateAt >=
              SMALL_BODY_GPU_UPDATE_INTERVAL_MS
          ) {
            void gpuLayer
              .setTimeSeconds(current.timeSeconds, [
                sunState.positionM[0] / ASTRONOMICAL_UNIT_M,
                sunState.positionM[1] / ASTRONOMICAL_UNIT_M,
                sunState.positionM[2] / ASTRONOMICAL_UNIT_M,
              ])
              .catch((cause: unknown) => {
                if (active) {
                  onGpuError(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              });
            lastSmallBodyGpuUpdateAt = performance.now();
          }
        }
        moonTrail.visible =
          showMoonTrailRef.current &&
          currentVisibility.moons &&
          moonTrailPoints.length > 1;
        let visiblePlanetTrailCount = 0;
        for (const trail of planetTrails.values()) {
          trail.line.visible =
            showPlanetTrailsRef.current &&
            currentVisibility.planets &&
            trail.points.length > 1;
          if (trail.line.visible) {
            visiblePlanetTrailCount += 1;
          }
        }
        eclipticGrid.visible = showEclipticPlaneRef.current;
        container.dataset["moonTrailPoints"] = String(moonTrailPoints.length);
        container.dataset["moonTrailVisible"] = String(moonTrail.visible);
        container.dataset["moonTrailFrame"] = referenceFrameRef.current;
        container.dataset["referenceFrame"] = referenceFrameRef.current;
        container.dataset["trailDurationSeconds"] = String(
          trailDurationSecondsRef.current,
        );
        container.dataset["trailFade"] = trailFadeRef.current.toFixed(2);
        container.dataset["planetTrailPoints"] = String(
          planetTrails.get("earth")?.points.length ?? 0,
        );
        container.dataset["planetTrailCount"] = String(visiblePlanetTrailCount);
        container.dataset["planetTrailsVisible"] = String(
          visiblePlanetTrailCount > 0,
        );

        if (
          activeCameraTransition !== undefined &&
          cameraTransitionDurationMsRef.current <= 0
        ) {
          completeCameraTransition();
        }
        const requestedFocusBodyId = focusBodyIdRef.current;
        const resetRequested = resetViewTokenRef.current !== lastResetViewToken;
        if (resetRequested) {
          lastResetViewToken = resetViewTokenRef.current;
          if (!beginCameraTransition(requestedFocusBodyId, current)) {
            resetCamera(requestedFocusBodyId, current);
            const requestedPreset = orientationPresetRef.current;
            applyOrientationPreset(
              requestedPreset === "custom"
                ? requestedFocusBodyId === null
                  ? "perspective"
                  : "sun-facing"
                : requestedPreset,
              requestedFocusBodyId,
              current,
            );
          }
          container.dataset["resetViewToken"] = String(lastResetViewToken);
        } else if (
          activeCameraTransition === undefined &&
          requestedFocusBodyId !== null
        ) {
          const focusState = bodyStateById(current, requestedFocusBodyId);
          if (focusState !== undefined) {
            const focusPosition = scenePosition(focusState.positionM);
            if (lastFocusBodyId !== requestedFocusBodyId) {
              resetCamera(requestedFocusBodyId, current);
              const requestedPreset = orientationPresetRef.current;
              applyOrientationPreset(
                requestedPreset === "custom" ? "sun-facing" : requestedPreset,
                requestedFocusBodyId,
                current,
              );
              if (requestedPreset === "custom") {
                onOrientationChange("sun-facing");
              }
            } else {
              const requestedPreset = orientationPresetRef.current;
              const requestedTargetBodyId = cameraTargetBodyIdRef.current;
              const targetState =
                requestedTargetBodyId === undefined
                  ? undefined
                  : bodyStateById(current, requestedTargetBodyId);
              const presetContinuouslyTracked =
                requestedPreset === "sun-facing" ||
                requestedPreset === "parent-facing" ||
                requestedPreset === "velocity" ||
                requestedPreset === "orbital-plane";
              const continuouslyTracked =
                requestedTargetBodyId !== undefined ||
                presetContinuouslyTracked;
              if (
                requestedTargetBodyId !== undefined &&
                targetState !== undefined
              ) {
                const targetPosition = scenePosition(targetState.positionM);
                camera.position.copy(
                  observerViewpoint(
                    requestedFocusBodyId,
                    focusState,
                    targetPosition,
                  ),
                );
                controls.target.copy(targetPosition);
                camera.up.copy(ECLIPTIC_NORTH);
                camera.lookAt(targetPosition);
                container.dataset["cameraOrientation"] = "observer-facing";
                container.dataset["cameraObserverBody"] = requestedFocusBodyId;
                container.dataset["cameraTargetBody"] = requestedTargetBodyId;
                container.dataset["focusDistanceAu"] = camera.position
                  .distanceTo(targetPosition)
                  .toFixed(8);
              } else if (presetContinuouslyTracked) {
                applyOrientationPreset(
                  requestedPreset,
                  requestedFocusBodyId,
                  current,
                );
              } else {
                const trackingTarget =
                  requestedFocusBodyId === "sun" &&
                  deepSpacePresentationRef.current === "interstellar-scale"
                    ? focusPosition
                        .clone()
                        .add(alphaCentauriOffset.clone().multiplyScalar(0.5))
                    : focusPosition;
                const trackingDelta = trackingTarget
                  .clone()
                  .sub(controls.target);
                camera.position.add(trackingDelta);
                controls.target.copy(trackingTarget);
              }
              container.dataset["cameraTracking"] =
                requestedTargetBodyId !== undefined
                  ? "observer-and-target"
                  : continuouslyTracked
                    ? "continuous"
                    : "position-only";
            }
          }
        } else if (
          activeCameraTransition === undefined &&
          lastFocusBodyId !== null &&
          lastFocusBodyId !== undefined
        ) {
          resetCamera(null, current);
          const requestedPreset = orientationPresetRef.current;
          applyOrientationPreset(
            requestedPreset === "custom" ? "perspective" : requestedPreset,
            null,
            current,
          );
          if (requestedPreset === "custom") {
            onOrientationChange("perspective");
          }
        }
        lastFocusBodyId = requestedFocusBodyId;
        container.dataset["focusBody"] = requestedFocusBodyId ?? "solar-system";
      }
      container.dataset["selectedBody"] = selectedBodyIdRef.current ?? "none";

      const requestedCameraCommand = cameraNavigationCommandRef.current;
      if (
        requestedCameraCommand.sequence !== lastCameraNavigationSequence &&
        applyCameraNavigationCommand(
          requestedCameraCommand,
          focusBodyIdRef.current,
          current,
        )
      ) {
        lastCameraNavigationSequence = requestedCameraCommand.sequence;
      }

      const earthPosition = bodyMeshes.get("earth")?.position.clone();
      const moonPosition = bodyMeshes.get("moon")?.position.clone();

      if (cameraZoomRef.current !== lastCameraZoom) {
        if (
          !Number.isFinite(cameraZoomRef.current) ||
          cameraZoomRef.current < 2 ** -32 ||
          cameraZoomRef.current > 128
        ) {
          throw new Error("Camera zoom must be between 2^-32x and 128x");
        }
        lastCameraZoom = cameraZoomRef.current;
        camera.zoom = lastCameraZoom;
        camera.updateProjectionMatrix();
        container.dataset["cameraZoom"] = lastCameraZoom.toFixed(2);
      }

      if (
        orientationPresetTokenRef.current !== lastOrientationPresetToken &&
        orientationPresetRef.current !== "custom"
      ) {
        lastOrientationPresetToken = orientationPresetTokenRef.current;
        if (activeCameraTransition === undefined) {
          applyOrientationPreset(
            orientationPresetRef.current,
            focusBodyIdRef.current,
            current,
          );
        }
      }

      const renderNowMs = frameRenderStartedAtMs;
      const surfaceConfiguration = surfaceObserverRef.current;
      if (surfaceConfiguration === null || current === undefined) {
        controls.enabled = true;
        latestSurfaceObservation = undefined;
        surfaceFreeLook = false;
        lastSurfaceConfigurationKey = "";
        updateCameraTransition(renderNowMs, current);
        controls.update();
        surfaceHorizon.visible = false;
        for (const label of compassLabels.values()) {
          label.hidden = true;
        }
        for (const atmosphere of atmosphereMeshes.values()) {
          atmosphere.visible = true;
        }
        delete container.dataset["surfaceObserverBody"];
        delete container.dataset["surfaceObserverTarget"];
        delete container.dataset["surfaceObserverLatitudeDeg"];
        delete container.dataset["surfaceObserverLongitudeDeg"];
        delete container.dataset["surfaceHorizonVisible"];
        delete container.dataset["surfaceFreeLook"];
        delete container.dataset["surfaceLookAzimuthDeg"];
        delete container.dataset["surfaceLookAltitudeDeg"];
      } else {
        interruptCameraTransition();
        controls.enabled = false;
        const observation = surfaceObserverFrame(current, surfaceConfiguration);
        latestSurfaceObservation = observation;
        const surfaceConfigurationKey = [
          surfaceConfiguration.bodyId,
          surfaceConfiguration.targetBodyId,
          surfaceConfiguration.latitudeDeg.toFixed(8),
          surfaceConfiguration.longitudeDeg.toFixed(8),
        ].join(":");
        if (
          surfaceConfigurationKey !== lastSurfaceConfigurationKey ||
          surfaceObserverLookResetTokenRef.current !== lastSurfaceLookResetToken
        ) {
          lastSurfaceConfigurationKey = surfaceConfigurationKey;
          lastSurfaceLookResetToken = surfaceObserverLookResetTokenRef.current;
          surfaceFreeLook = false;
        }
        camera.near = 0.05 / ASTRONOMICAL_UNIT_M;
        camera.far = DEFAULT_CAMERA_FAR_AU;
        camera.position.copy(observation.observerPositionAu);
        const lookDirection = surfaceFreeLook
          ? observation.north
              .clone()
              .multiplyScalar(
                Math.cos((surfaceLookAzimuthDeg * Math.PI) / 180) *
                  Math.cos((surfaceLookAltitudeDeg * Math.PI) / 180),
              )
              .add(
                observation.east
                  .clone()
                  .multiplyScalar(
                    Math.sin((surfaceLookAzimuthDeg * Math.PI) / 180) *
                      Math.cos((surfaceLookAltitudeDeg * Math.PI) / 180),
                  ),
              )
              .add(
                observation.zenith
                  .clone()
                  .multiplyScalar(
                    Math.sin((surfaceLookAltitudeDeg * Math.PI) / 180),
                  ),
              )
              .normalize()
          : observation.targetDirection;
        camera.up.copy(
          Math.abs(lookDirection.dot(observation.zenith)) > 0.999
            ? observation.north
            : observation.zenith,
        );
        controls.target.copy(camera.position).add(lookDirection);
        camera.lookAt(controls.target);
        camera.updateProjectionMatrix();
        const observerDefinition = majorBodyById.get(
          surfaceConfiguration.bodyId,
        );
        if (observerDefinition === undefined) {
          throw new Error(
            `Surface observer definition ${surfaceConfiguration.bodyId} is unavailable`,
          );
        }
        for (let index = 0; index < 96; index += 1) {
          const point = surfaceHorizonPoint(
            observation,
            observerDefinition.meanRadiusM,
            (index / 96) * 360,
          ).sub(observation.surfacePositionAu);
          surfaceHorizonPositions[index * 3] = point.x;
          surfaceHorizonPositions[index * 3 + 1] = point.y;
          surfaceHorizonPositions[index * 3 + 2] = point.z;
        }
        surfaceHorizon.position.copy(observation.surfacePositionAu);
        surfaceHorizonPositionAttribute.needsUpdate = true;
        surfaceHorizonGeometry.computeBoundingSphere();
        surfaceHorizon.visible = true;
        for (const [azimuthDeg, label] of compassLabels) {
          const projected = surfaceHorizonPoint(
            observation,
            observerDefinition.meanRadiusM,
            azimuthDeg,
          ).project(camera);
          const visible =
            projected.z >= -1 &&
            projected.z <= 1 &&
            Math.abs(projected.x) <= 1 &&
            Math.abs(projected.y) <= 1;
          label.hidden = !visible;
          if (visible) {
            label.style.transform = `translate(${String(
              ((projected.x + 1) * container.clientWidth) / 2,
            )}px, ${String(
              ((-projected.y + 1) * container.clientHeight) / 2,
            )}px)`;
          }
        }
        for (const [bodyId, atmosphere] of atmosphereMeshes) {
          atmosphere.visible = bodyId !== surfaceConfiguration.bodyId;
        }
        container.dataset["cameraTracking"] = "surface-observer";
        container.dataset["cameraOrientation"] = "local-horizontal";
        container.dataset["cameraObserverBody"] = surfaceConfiguration.bodyId;
        container.dataset["cameraTargetBody"] =
          surfaceConfiguration.targetBodyId;
        container.dataset["cameraObserverAltitudeKm"] = "0.002";
        container.dataset["surfaceObserverBody"] = surfaceConfiguration.bodyId;
        container.dataset["surfaceObserverTarget"] =
          surfaceConfiguration.targetBodyId;
        container.dataset["surfaceObserverLatitudeDeg"] =
          surfaceConfiguration.latitudeDeg.toFixed(6);
        container.dataset["surfaceObserverLongitudeDeg"] =
          surfaceConfiguration.longitudeDeg.toFixed(6);
        container.dataset["surfaceFreeLook"] = String(surfaceFreeLook);
        container.dataset["surfaceLookAzimuthDeg"] = (
          surfaceFreeLook ? surfaceLookAzimuthDeg : observation.targetAzimuthDeg
        ).toFixed(4);
        container.dataset["surfaceLookAltitudeDeg"] = (
          surfaceFreeLook
            ? surfaceLookAltitudeDeg
            : observation.targetAltitudeDeg
        ).toFixed(4);
        container.dataset["surfaceObserverPosition"] = [
          camera.position.x,
          camera.position.y,
          camera.position.z,
        ]
          .map((value) => value.toFixed(12))
          .join(",");
        container.dataset["surfaceTargetAltitudeDeg"] =
          observation.targetAltitudeDeg.toFixed(6);
        container.dataset["surfaceTargetAzimuthDeg"] =
          observation.targetAzimuthDeg.toFixed(6);
        container.dataset["surfaceTargetAngularDiameterDeg"] =
          observation.targetAngularDiameterDeg.toFixed(9);
        container.dataset["surfaceLocalSolarTimeHours"] =
          observation.localSolarTimeHours.toFixed(9);
        container.dataset["surfaceHorizonModel"] =
          "mean-radius-geometric-no-refraction";
        container.dataset["surfaceHorizonVisible"] = "true";
      }
      container.dataset["cameraDistanceAu"] = camera.position
        .distanceTo(controls.target)
        .toFixed(12);
      const currentViewDistanceAu = camera.position.distanceTo(controls.target);
      const effectiveViewZoom =
        currentViewDistanceAu > 0
          ? camera.zoom * (viewZoomReferenceDistanceAu / currentViewDistanceAu)
          : camera.zoom;
      const reportedViewZoom =
        Math.round(effectiveViewZoom * 1_000_000) / 1_000_000;
      if (
        Number.isFinite(reportedViewZoom) &&
        (Number.isNaN(lastReportedViewZoom) ||
          Math.abs(Math.log2(reportedViewZoom / lastReportedViewZoom)) > 0.002)
      ) {
        lastReportedViewZoom = reportedViewZoom;
        container.dataset["viewMagnification"] = reportedViewZoom.toFixed(4);
        onViewZoomChangeRef.current(reportedViewZoom);
      }
      stars.position.copy(camera.position);
      zodiacGroup.position.copy(camera.position);
      camera.updateMatrixWorld();
      for (const { element, direction } of zodiacLabels) {
        if (!zodiacGroup.visible) {
          element.hidden = true;
          continue;
        }
        const projected = camera.position
          .clone()
          .add(direction.clone().multiplyScalar(ZODIAC_SPHERE_RADIUS_AU))
          .project(camera);
        const visible =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 0.94 &&
          Math.abs(projected.y) <= 0.94;
        element.hidden = !visible;
        if (visible) {
          element.style.transform = `translate(${String(
            ((projected.x + 1) * container.clientWidth) / 2,
          )}px, ${String(
            ((-projected.y + 1) * container.clientHeight) / 2,
          )}px)`;
        }
      }
      container.dataset["zodiacVisibleLabelCount"] = String(
        zodiacLabels.filter(({ element }) => !element.hidden).length,
      );
      let brightVisibleStarFound = false;
      if (stars.visible) {
        for (const starIndex of brightStarCandidateIndexes) {
          const offset = starIndex * 3;
          const projected = camera.position
            .clone()
            .add(
              new Vector3(
                starPositions[offset],
                starPositions[offset + 1],
                starPositions[offset + 2],
              ),
            )
            .project(camera);
          if (
            projected.z < -1 ||
            projected.z > 1 ||
            Math.abs(projected.x) > 0.8 ||
            Math.abs(projected.y) > 0.8
          ) {
            continue;
          }
          const star = hipparcosStarSnapshot.stars[starIndex];
          if (star === undefined) {
            throw new Error(
              `Bright Hipparcos diagnostic index ${String(starIndex)} is invalid`,
            );
          }
          container.dataset["brightVisibleStarHipId"] = String(star.hipId);
          container.dataset["brightVisibleStarScreenX"] = (
            ((projected.x + 1) * container.clientWidth) /
            2
          ).toFixed(3);
          container.dataset["brightVisibleStarScreenY"] = (
            ((-projected.y + 1) * container.clientHeight) /
            2
          ).toFixed(3);
          brightVisibleStarFound = true;
          break;
        }
      }
      if (!brightVisibleStarFound) {
        delete container.dataset["brightVisibleStarHipId"];
        delete container.dataset["brightVisibleStarScreenX"];
        delete container.dataset["brightVisibleStarScreenY"];
      }
      const liveSunPosition =
        bodyMeshes.get("sun")?.position.clone() ?? new Vector3();
      deepSpaceGroup.position.copy(liveSunPosition);
      const distanceFromSunAu = camera.position.distanceTo(liveSunPosition);
      const activeDeepPresentation = deepSpacePresentationRef.current;
      const showHeliosphere =
        distanceFromSunAu >= 150 || activeDeepPresentation !== undefined;
      const showOortCloud =
        distanceFromSunAu >= 500 ||
        activeDeepPresentation === "oort-cloud-scale" ||
        activeDeepPresentation === "interstellar-scale";
      const showAlphaCentauri =
        distanceFromSunAu >= 40_000 ||
        activeDeepPresentation === "interstellar-scale";
      terminationShock.visible = showHeliosphere;
      heliopause.visible = showHeliosphere;
      innerOortBoundary.visible = showOortCloud;
      outerOortBoundary.visible = showOortCloud;
      oortCloud.visible = showOortCloud;
      alphaMarker.visible = showAlphaCentauri;
      container.dataset["deepSpaceLayer"] = "same-three-scene";
      container.dataset["heliosphereVisible"] = String(showHeliosphere);
      container.dataset["oortCloudVisible"] = String(showOortCloud);
      container.dataset["alphaCentauriVisible"] = String(showAlphaCentauri);
      const sunToCameraDirection = camera.position
        .clone()
        .sub(liveSunPosition)
        .normalize();
      const boundaryLabelPosition = (radiusAu: number): Vector3 =>
        liveSunPosition
          .clone()
          .add(sunToCameraDirection.clone().multiplyScalar(radiusAu * 0.82))
          .add(
            camera.up
              .clone()
              .normalize()
              .multiplyScalar(radiusAu * 0.45),
          );
      const deepLabelPositions = [
        boundaryLabelPosition(120),
        boundaryLabelPosition(OORT_CLOUD_OUTER_MAX_AU),
        liveSunPosition.clone().add(alphaCentauriOffset),
      ];
      for (const [index, label] of deepSpaceLabels.entries()) {
        const visible = [
          showHeliosphere && !showOortCloud,
          showOortCloud,
          showAlphaCentauri,
        ][index];
        const authoredPresentation = [
          "heliosphere-scale",
          "oort-cloud-scale",
          "interstellar-scale",
        ][index];
        const position = deepLabelPositions[index];
        if (!visible || position === undefined) {
          label.hidden = true;
          continue;
        }
        const projected = position.clone().project(camera);
        const inView =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const keepVisibleForAuthoredScene =
          activeDeepPresentation === authoredPresentation;
        label.hidden = !inView && !keepVisibleForAuthoredScene;
        if (inView) {
          label.style.transform = `translate(${String(
            ((projected.x + 1) * container.clientWidth) / 2,
          )}px, ${String(
            ((-projected.y + 1) * container.clientHeight) / 2,
          )}px)`;
        } else if (keepVisibleForAuthoredScene) {
          label.style.transform = `translate(${String(
            container.clientWidth * 0.66,
          )}px, ${String(container.clientHeight * 0.2)}px)`;
        }
      }
      const projectedDeepSun = liveSunPosition.clone().project(camera);
      const deepSunInView =
        showHeliosphere &&
        projectedDeepSun.z >= -1 &&
        projectedDeepSun.z <= 1 &&
        Math.abs(projectedDeepSun.x) <= 1 &&
        Math.abs(projectedDeepSun.y) <= 1;
      deepSunLabel.hidden = !deepSunInView;
      if (deepSunInView) {
        deepSunLabel.style.transform = `translate(${String(
          ((projectedDeepSun.x + 1) * container.clientWidth) / 2,
        )}px, ${String(
          ((-projectedDeepSun.y + 1) * container.clientHeight) / 2,
        )}px)`;
      }

      navigationMap.hidden = viewModeRef.current !== "reality";
      if (
        !navigationMap.hidden &&
        frameRenderStartedAtMs - lastNavigationMapUpdateAt >= 100
      ) {
        lastNavigationMapUpdateAt = frameRenderStartedAtMs;
        const width = navigationMapCanvas.width;
        const height = navigationMapCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const observerBodyId =
          surfaceObserverRef.current?.bodyId ?? focusBodyIdRef.current;
        const observerPosition =
          observerBodyId === null
            ? camera.position
            : (bodyMeshes.get(observerBodyId)?.position ?? camera.position);
        const observerDistanceAu = observerPosition.distanceTo(liveSunPosition);
        const mapScaleAu = Math.max(
          2,
          observerDistanceAu * 1.35,
          distanceFromSunAu * 1.1,
        );
        const pixelsPerAu = (Math.min(width, height) * 0.42) / mapScaleAu;
        const mapPoint = (position: Vector3): readonly [number, number] => {
          const relative = position.clone().sub(liveSunPosition);
          return [
            centerX + relative.dot(ECLIPTIC_RIGHT) * pixelsPerAu,
            centerY - relative.dot(ECLIPTIC_FORWARD) * pixelsPerAu,
          ];
        };
        navigationContext.clearRect(0, 0, width, height);
        navigationContext.fillStyle = "rgba(3, 10, 19, 0.86)";
        navigationContext.fillRect(0, 0, width, height);
        navigationContext.strokeStyle = "rgba(132, 181, 222, 0.14)";
        navigationContext.lineWidth = 1;
        for (const fraction of [0.33, 0.66, 1]) {
          navigationContext.beginPath();
          navigationContext.arc(
            centerX,
            centerY,
            mapScaleAu * fraction * pixelsPerAu,
            0,
            Math.PI * 2,
          );
          navigationContext.stroke();
        }
        navigationContext.fillStyle = "#ffd27a";
        navigationContext.beginPath();
        navigationContext.arc(centerX, centerY, 4, 0, Math.PI * 2);
        navigationContext.fill();
        for (const planetId of PLANET_TRAIL_BODY_IDS) {
          const planetPosition = bodyMeshes.get(planetId)?.position;
          if (planetPosition === undefined) continue;
          const [x, y] = mapPoint(planetPosition);
          if (x < 0 || y < 0 || x > width || y > height) continue;
          navigationContext.fillStyle = "#83bde4";
          navigationContext.beginPath();
          navigationContext.arc(
            x,
            y,
            planetId === observerBodyId ? 5 : 2.3,
            0,
            Math.PI * 2,
          );
          navigationContext.fill();
        }
        const [observerX, observerY] = mapPoint(observerPosition);
        const cameraDirection = camera.getWorldDirection(new Vector3());
        const directionX = cameraDirection.dot(ECLIPTIC_RIGHT);
        const directionY = -cameraDirection.dot(ECLIPTIC_FORWARD);
        const directionLength = Math.hypot(directionX, directionY) || 1;
        navigationContext.strokeStyle = "#f1f7ff";
        navigationContext.lineWidth = 3;
        navigationContext.beginPath();
        navigationContext.moveTo(observerX, observerY);
        navigationContext.lineTo(
          observerX + (directionX / directionLength) * 32,
          observerY + (directionY / directionLength) * 32,
        );
        navigationContext.stroke();
        navigationContext.fillStyle = "#ffffff";
        navigationContext.beginPath();
        navigationContext.arc(observerX, observerY, 3.5, 0, Math.PI * 2);
        navigationContext.fill();
        navigationMapScale.textContent = `Radius ${formatTacticalDistance(mapScaleAu)}`;
        navigationMap.dataset["scaleAu"] = mapScaleAu.toFixed(4);
        navigationMap.dataset["observerBody"] = observerBodyId ?? "camera";
        navigationMap.dataset["viewBearingDeg"] = (
          (Math.atan2(directionX, -directionY) * 180) / Math.PI +
          360
        ).toFixed(2);
      }
      if (activeCameraTransition === undefined) {
        delete container.dataset["cameraTransitionAnchorScreenX"];
        delete container.dataset["cameraTransitionAnchorScreenY"];
      } else {
        const projectedTransitionAnchor = controls.target
          .clone()
          .project(camera);
        container.dataset["cameraTransitionAnchorScreenX"] = (
          ((projectedTransitionAnchor.x + 1) * container.clientWidth) /
          2
        ).toFixed(3);
        container.dataset["cameraTransitionAnchorScreenY"] = (
          ((-projectedTransitionAnchor.y + 1) * container.clientHeight) /
          2
        ).toFixed(3);
      }
      const activeCameraTargetBodyId =
        surfaceObserverRef.current?.targetBodyId ??
        cameraTargetBodyIdRef.current;
      const activeCameraTargetState =
        current === undefined || activeCameraTargetBodyId === undefined
          ? undefined
          : bodyStateById(current, activeCameraTargetBodyId);
      if (activeCameraTargetState === undefined) {
        delete container.dataset["cameraTargetScreenX"];
        delete container.dataset["cameraTargetScreenY"];
      } else {
        const projectedTarget = scenePosition(
          activeCameraTargetState.positionM,
        ).project(camera);
        container.dataset["cameraTargetScreenX"] = (
          ((projectedTarget.x + 1) * container.clientWidth) /
          2
        ).toFixed(3);
        container.dataset["cameraTargetScreenY"] = (
          ((-projectedTarget.y + 1) * container.clientHeight) /
          2
        ).toFixed(3);
      }
      container.dataset["cameraEclipticNorthDot"] = camera.position
        .clone()
        .sub(controls.target)
        .normalize()
        .dot(ECLIPTIC_NORTH)
        .toFixed(6);
      const cameraDirection = camera.position
        .clone()
        .sub(controls.target)
        .normalize();
      container.dataset["cameraDirection"] = [
        cameraDirection.x,
        cameraDirection.y,
        cameraDirection.z,
      ]
        .map((value) => value.toFixed(8))
        .join(",");
      const illuminatedFocusBodyId = focusBodyIdRef.current;
      const illuminatedFocusState =
        current === undefined ||
        illuminatedFocusBodyId === null ||
        illuminatedFocusBodyId === "sun"
          ? undefined
          : bodyStateById(current, illuminatedFocusBodyId);
      const illuminationSunState =
        current === undefined ? undefined : bodyStateById(current, "sun");
      if (
        illuminatedFocusState === undefined ||
        illuminationSunState === undefined
      ) {
        delete container.dataset["focusedSunCameraAlignment"];
      } else {
        const focusPosition = scenePosition(illuminatedFocusState.positionM);
        const focusToSun = scenePosition(illuminationSunState.positionM)
          .sub(focusPosition)
          .normalize();
        const focusToCamera = camera.position
          .clone()
          .sub(focusPosition)
          .normalize();
        container.dataset["focusedSunCameraAlignment"] = focusToSun
          .dot(focusToCamera)
          .toFixed(6);
      }

      if (renderNowMs - lastSunGuideUpdateAt >= SUN_GUIDE_UPDATE_INTERVAL_MS) {
        lastSunGuideUpdateAt = renderNowMs;
        const activeWayfinderMode = wayfinderModeRef.current;
        container.dataset["wayfinderMode"] = activeWayfinderMode;
        const wayfinderVisuals = [
          {
            line: sunGuideLine,
            endpoint: sunGuideEndpoint,
            label: sunGuideLabel,
          },
          ...planetWayfinderVisuals,
        ];
        const hideAllWayfinders = (): void => {
          sunGuideOverlay.style.display = "none";
          for (const visual of wayfinderVisuals) {
            visual.line.style.display = "none";
            visual.endpoint.style.display = "none";
            visual.label.hidden = true;
            delete visual.label.dataset["targetBodyId"];
          }
          container.dataset["sunGuideVisible"] = "false";
          container.dataset["sunGuideLineVisible"] = "false";
          container.dataset["wayfinderCount"] = "0";
          container.dataset["wayfinderPlanetCount"] = "0";
          container.dataset["wayfinderTargets"] = "";
        };
        const wayfinderFocusId = focusBodyIdRef.current;
        const wayfinderFocusState =
          current === undefined || wayfinderFocusId === null
            ? undefined
            : bodyStateById(current, wayfinderFocusId);
        const wayfinderSunState =
          current === undefined ? undefined : bodyStateById(current, "sun");
        if (
          current === undefined ||
          wayfinderSunState === undefined ||
          activeWayfinderMode === "off" ||
          (wayfinderFocusId === "sun" && activeDeepPresentation !== undefined)
        ) {
          hideAllWayfinders();
        } else {
          const viewportWidth = container.clientWidth;
          const viewportHeight = container.clientHeight;
          const viewportMargin = Math.min(
            110,
            viewportWidth / 3,
            viewportHeight / 3,
          );
          const sunPosition = scenePosition(wayfinderSunState.positionM);
          const focusPosition =
            wayfinderFocusState === undefined
              ? undefined
              : scenePosition(wayfinderFocusState.positionM);
          const originBodyId =
            wayfinderFocusState === undefined || wayfinderFocusId === null
              ? "sun"
              : wayfinderFocusId;
          const originPosition = focusPosition ?? sunPosition;
          const wayfinderState = current.bodies.some(
            (body) => body.id === originBodyId,
          )
            ? current
            : wayfinderFocusState === undefined
              ? current
              : {
                  ...current,
                  bodies: [...current.bodies, wayfinderFocusState],
                };
          const focusScreen =
            focusPosition === undefined ||
            cameraTargetBodyIdRef.current !== undefined
              ? { x: viewportWidth / 2, y: viewportHeight / 2 }
              : (() => {
                  const projected = focusPosition.clone().project(camera);
                  return {
                    x: ((projected.x + 1) * viewportWidth) / 2,
                    y: ((-projected.y + 1) * viewportHeight) / 2,
                  };
                })();
          if (focusPosition === undefined) {
            delete container.dataset["focusedTargetScreenX"];
            delete container.dataset["focusedTargetScreenY"];
          } else {
            container.dataset["focusedTargetScreenX"] =
              focusScreen.x.toFixed(3);
            container.dataset["focusedTargetScreenY"] =
              focusScreen.y.toFixed(3);
          }
          const guideOrigin = {
            x: Math.min(
              viewportWidth - viewportMargin,
              Math.max(viewportMargin, focusScreen.x),
            ),
            y: Math.min(
              viewportHeight - viewportMargin,
              Math.max(viewportMargin, focusScreen.y),
            ),
          };
          const planetTargets = nearestPlanetWayfinders(
            wayfinderState,
            originBodyId,
            wayfinderPlanetCount(activeWayfinderMode),
          );
          const wayfinderTargetIds = [
            "sun",
            ...planetTargets.map((target) => target.bodyId),
          ];
          let sunLocation: "behind" | "off-screen" | "on-screen" = "on-screen";
          let sunDistanceAu = 0;
          let sunLineVisible = false;
          for (const [index, visual] of wayfinderVisuals.entries()) {
            const targetBodyId = wayfinderTargetIds[index];
            if (targetBodyId === undefined) {
              visual.line.style.display = "none";
              visual.endpoint.style.display = "none";
              visual.label.hidden = true;
              delete visual.label.dataset["targetBodyId"];
              continue;
            }
            const targetState = bodyStateById(current, targetBodyId);
            const targetDefinition = majorBodyById.get(targetBodyId);
            if (targetState === undefined || targetDefinition === undefined) {
              throw new Error(
                `Wayfinder target ${targetBodyId} is unavailable`,
              );
            }
            const targetPosition = scenePosition(targetState.positionM);
            const targetProjected = targetPosition.clone().project(camera);
            const rawTargetScreen = {
              x: ((targetProjected.x + 1) * viewportWidth) / 2,
              y: ((-targetProjected.y + 1) * viewportHeight) / 2,
            };
            const targetCameraPosition = targetPosition
              .clone()
              .applyMatrix4(camera.matrixWorldInverse);
            const targetInFront = targetCameraPosition.z < -camera.near;
            const targetOnScreen =
              targetInFront &&
              targetProjected.z >= -1 &&
              targetProjected.z <= 1 &&
              pointInsideViewport(
                rawTargetScreen,
                viewportWidth,
                viewportHeight,
                viewportMargin,
              );
            let location: "behind" | "off-screen" | "on-screen" = "on-screen";
            let endpoint = rawTargetScreen;
            if (!targetOnScreen) {
              location = targetInFront ? "off-screen" : "behind";
              let direction = targetInFront
                ? {
                    x: rawTargetScreen.x - guideOrigin.x,
                    y: rawTargetScreen.y - guideOrigin.y,
                  }
                : {
                    x: targetCameraPosition.x,
                    y: -targetCameraPosition.y,
                  };
              if (Math.hypot(direction.x, direction.y) < 1e-12) {
                direction = { x: 0, y: -1 };
              }
              endpoint = rayToViewportEdge(
                guideOrigin,
                direction,
                viewportWidth,
                viewportHeight,
                viewportMargin,
              );
            }
            const hasLine = originBodyId !== targetBodyId;
            visual.line.style.display = hasLine ? "" : "none";
            if (hasLine) {
              visual.line.setAttribute("x1", String(guideOrigin.x));
              visual.line.setAttribute("y1", String(guideOrigin.y));
              visual.line.setAttribute("x2", String(endpoint.x));
              visual.line.setAttribute("y2", String(endpoint.y));
            }
            visual.endpoint.style.display = "";
            visual.endpoint.setAttribute("cx", String(endpoint.x));
            visual.endpoint.setAttribute("cy", String(endpoint.y));
            const distanceAu = originPosition.distanceTo(targetPosition);
            const distanceLabel = hasLine
              ? ` · ${formatTacticalDistance(distanceAu)}`
              : "";
            const locationLabel = location === "behind" ? " behind view" : "";
            visual.label.textContent = `${targetDefinition.name}${locationLabel}${distanceLabel}`;
            visual.label.setAttribute(
              "aria-label",
              `Focus ${targetDefinition.name}`,
            );
            visual.label.title = "Click to select; double-click to focus";
            visual.label.dataset["targetBodyId"] = targetBodyId;
            visual.label.dataset["distanceAu"] = distanceAu.toFixed(8);
            visual.label.dataset["location"] = location;
            const targetIsSelected = targetBodyId === selectedBodyIdRef.current;
            visual.label.classList.toggle("is-selected", targetIsSelected);
            visual.label.classList.toggle(
              "is-focused",
              targetBodyId === focusBodyIdRef.current,
            );
            visual.label.setAttribute("aria-pressed", String(targetIsSelected));
            const labelWidthAllowance = Math.min(240, viewportWidth - 16);
            const labelX = Math.min(
              viewportWidth - labelWidthAllowance - 8,
              Math.max(
                8,
                endpoint.x > viewportWidth / 2
                  ? endpoint.x - labelWidthAllowance - 8
                  : endpoint.x + 8,
              ),
            );
            const laneOffset = index === 1 ? 28 : index === 2 ? -28 : 0;
            const labelY = Math.min(
              viewportHeight - 30,
              Math.max(30, endpoint.y + laneOffset),
            );
            visual.label.style.transform = `translate(${String(labelX)}px, ${String(labelY)}px)`;
            visual.label.hidden = false;
            if (targetBodyId === "sun") {
              sunLocation = location;
              sunDistanceAu = distanceAu;
              sunLineVisible = hasLine;
            }
          }
          sunGuideOverlay.style.display = "";
          container.dataset["sunGuideVisible"] = "true";
          container.dataset["sunGuideLocation"] = sunLocation;
          container.dataset["sunGuideDistanceAu"] = sunDistanceAu.toFixed(8);
          container.dataset["sunGuideLineVisible"] = String(sunLineVisible);
          container.dataset["sunGuideEndpointX"] =
            sunGuideEndpoint.getAttribute("cx") ?? "unavailable";
          container.dataset["sunGuideEndpointY"] =
            sunGuideEndpoint.getAttribute("cy") ?? "unavailable";
          container.dataset["wayfinderCount"] = String(
            wayfinderTargetIds.length,
          );
          container.dataset["wayfinderPlanetCount"] = String(
            planetTargets.length,
          );
          container.dataset["wayfinderTargets"] = wayfinderTargetIds.join(",");
        }
      }

      const tacticalFocusId = focusBodyIdRef.current;
      const tacticalFocusState =
        current === undefined || tacticalFocusId === null
          ? undefined
          : bodyStateById(current, tacticalFocusId);
      const tacticalVisible =
        showTacticalOverlayRef.current &&
        tacticalFocusState !== undefined &&
        (tacticalFocusId !== ISS_BODY_ID ||
          (current !== undefined &&
            isIssEphemerisWithinValidity(current.timeSeconds)));
      tacticalOverlay.classList.toggle("is-visible", tacticalVisible);
      focusBracket.hidden = !tacticalVisible;
      rangeLegend.hidden = !tacticalVisible;
      container.dataset["tacticalOverlayVisible"] = String(tacticalVisible);
      if (
        tacticalVisible &&
        current !== undefined &&
        tacticalFocusId !== null
      ) {
        const focusPosition = scenePosition(tacticalFocusState.positionM);
        const focusProjected = focusPosition.clone().project(camera);
        const focusScreen = {
          x: ((focusProjected.x + 1) * container.clientWidth) / 2,
          y: ((-focusProjected.y + 1) * container.clientHeight) / 2,
        };
        focusBracket.style.transform = `translate(${String(focusScreen.x)}px, ${String(focusScreen.y)}px)`;
        const cameraDistance = camera.position.distanceTo(focusPosition);
        const worldHeight =
          (2 * cameraDistance * Math.tan((camera.fov * Math.PI) / 360)) /
          camera.zoom;
        const auPerPixel = worldHeight / Math.max(1, container.clientHeight);
        const desiredRingAu = Math.max(auPerPixel * 70, 1e-9);
        const magnitude = 10 ** Math.floor(Math.log10(desiredRingAu));
        const normalized = desiredRingAu / magnitude;
        const niceMultiplier =
          normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
        const ringStepAu = niceMultiplier * magnitude;
        for (const [index, ring] of rangeRings.entries()) {
          const radiusPixels = (ringStepAu * (index + 1)) / auPerPixel;
          ring.setAttribute("cx", String(focusScreen.x));
          ring.setAttribute("cy", String(focusScreen.y));
          ring.setAttribute("r", String(radiusPixels));
        }
        const outerRingRadiusPixels =
          (ringStepAu * rangeRings.length) / auPerPixel;
        rangeLegend.textContent = formatTacticalDistance(
          ringStepAu * rangeRings.length,
        );
        rangeLegend.style.transform = `translate(${String(focusScreen.x + outerRingRadiusPixels)}px, ${String(focusScreen.y)}px)`;

        const setLine = (
          line: SVGLineElement,
          from: Readonly<{ x: number; y: number }>,
          to: Readonly<{ x: number; y: number }>,
          visible: boolean,
        ): void => {
          line.style.display = visible ? "" : "none";
          if (!visible) {
            return;
          }
          line.setAttribute("x1", String(from.x));
          line.setAttribute("y1", String(from.y));
          line.setAttribute("x2", String(to.x));
          line.setAttribute("y2", String(to.y));
        };
        const tacticalParentId = parentBodyId(tacticalFocusId);
        const tacticalParentState =
          tacticalParentId === undefined
            ? undefined
            : bodyStateById(current, tacticalParentId);
        if (tacticalParentState === undefined) {
          setLine(parentConnection, focusScreen, focusScreen, false);
          setLine(velocityVector, focusScreen, focusScreen, false);
        } else {
          const parentProjected = scenePosition(
            tacticalParentState.positionM,
          ).project(camera);
          const parentScreen = {
            x: ((parentProjected.x + 1) * container.clientWidth) / 2,
            y: ((-parentProjected.y + 1) * container.clientHeight) / 2,
          };
          setLine(parentConnection, focusScreen, parentScreen, true);
          const relativeVelocity = icrfToScene({
            x:
              tacticalFocusState.velocityMps[0] -
              tacticalParentState.velocityMps[0],
            y:
              tacticalFocusState.velocityMps[1] -
              tacticalParentState.velocityMps[1],
            z:
              tacticalFocusState.velocityMps[2] -
              tacticalParentState.velocityMps[2],
          }).normalize();
          const velocityProjected = focusPosition
            .clone()
            .add(relativeVelocity.multiplyScalar(cameraDistance * 0.14))
            .project(camera);
          setLine(
            velocityVector,
            focusScreen,
            {
              x: ((velocityProjected.x + 1) * container.clientWidth) / 2,
              y: ((-velocityProjected.y + 1) * container.clientHeight) / 2,
            },
            true,
          );
        }
        const sunState = bodyStateById(current, "sun");
        if (sunState === undefined) {
          setLine(planeDropLine, focusScreen, focusScreen, false);
        } else {
          const sunPosition = scenePosition(sunState.positionM);
          const projectedOnPlane = focusPosition
            .clone()
            .sub(
              ECLIPTIC_NORTH.clone().multiplyScalar(
                focusPosition.clone().sub(sunPosition).dot(ECLIPTIC_NORTH),
              ),
            )
            .project(camera);
          setLine(
            planeDropLine,
            focusScreen,
            {
              x: ((projectedOnPlane.x + 1) * container.clientWidth) / 2,
              y: ((-projectedOnPlane.y + 1) * container.clientHeight) / 2,
            },
            true,
          );
        }
      }
      const semanticFocusDefinition =
        tacticalFocusId === null
          ? undefined
          : majorBodyById.get(tacticalFocusId);
      const semanticKnownSatellite =
        tacticalFocusId === null
          ? undefined
          : knownSatelliteById.get(tacticalFocusId);
      const semanticFocusMesh =
        tacticalFocusId !== null &&
        (tacticalFocusId === ISS_BODY_ID ||
          isVoyagerBodyId(tacticalFocusId) ||
          isOperationalSpacecraftBodyId(tacticalFocusId))
          ? spacecraftGroups.get(tacticalFocusId)
          : tacticalFocusId === null
            ? undefined
            : bodyMeshes.get(tacticalFocusId);
      const semanticCameraDistance =
        semanticFocusMesh === undefined
          ? Number.POSITIVE_INFINITY
          : camera.position.distanceTo(semanticFocusMesh.position) /
            camera.zoom;
      const semanticPhysicalRadiusAu =
        tacticalFocusId !== null &&
        spacecraftBoundingRadiusM(tacticalFocusId) !== undefined
          ? (spacecraftBoundingRadiusM(tacticalFocusId) ?? 0) /
            ASTRONOMICAL_UNIT_M
          : semanticFocusDefinition === undefined
            ? 0
            : semanticFocusDefinition.meanRadiusM / ASTRONOMICAL_UNIT_M;
      const semanticZoomLevel: SemanticZoomLevel =
        distanceFromSunAu >= 200_000
          ? "interstellar"
          : distanceFromSunAu >= 1_000
            ? "oort-cloud"
            : distanceFromSunAu >= 150
              ? "heliosphere"
              : tacticalFocusId !== null &&
                  spacecraftBoundingRadiusM(tacticalFocusId) !== undefined
                ? semanticCameraDistance < semanticPhysicalRadiusAu * 80
                  ? "surface"
                  : "moon-system"
                : semanticKnownSatellite !== undefined
                  ? "moon-system"
                  : semanticFocusDefinition === undefined ||
                      semanticFocusMesh === undefined
                    ? "solar-system"
                    : semanticCameraDistance < semanticPhysicalRadiusAu * 80
                      ? "surface"
                      : semanticFocusDefinition.type === "moon"
                        ? "moon-system"
                        : "planetary-system";
      container.dataset["semanticZoomLevel"] = semanticZoomLevel;
      if (semanticZoomLevel !== lastSemanticZoomLevel) {
        lastSemanticZoomLevel = semanticZoomLevel;
        onSemanticZoomChange(semanticZoomLevel);
      }
      let visibleLabelCount = 0;
      let visibleOrreryMarkerCount = 0;
      const occupiedLabelRectangles: Readonly<{
        left: number;
        right: number;
        top: number;
        bottom: number;
      }>[] = [];
      for (const body of majorBodySnapshot.bodies) {
        const mesh = bodyMeshes.get(body.id);
        const label = bodyLabels.get(body.id);
        if (mesh === undefined || label === undefined) {
          continue;
        }
        const projected = mesh.position.clone().project(camera);
        const cameraDistance = camera.position.distanceTo(mesh.position);
        const radiusPixels =
          (mesh.scale.x / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        label.dataset["radiusPixels"] = radiusPixels.toFixed(3);
        const bodyLayerVisible = isMajorBodyVisible(
          body.type,
          currentVisibility,
        );
        const bodyRendered =
          bodyLayerVisible &&
          (viewModeRef.current === "orrery" ||
            isPhysicalBodyResolvable(radiusPixels));
        mesh.visible = bodyRendered;
        label.dataset["bodyRendered"] = String(bodyRendered);
        const isInCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        label.dataset["screenX"] = (
          ((projected.x + 1) * container.clientWidth) /
          2
        ).toFixed(3);
        label.dataset["screenY"] = (
          ((-projected.y + 1) * container.clientHeight) /
          2
        ).toFixed(3);
        label.dataset["inCameraFrustum"] = String(isInCameraFrustum);
        const isOverviewPlanet =
          (focusBodyIdRef.current === null ||
            focusBodyIdRef.current === "sun") &&
          (body.type === "planet" || body.type === "dwarf-planet");
        const focusedBodyId = focusBodyIdRef.current;
        const isCameraTarget =
          body.id ===
          (surfaceObserverRef.current?.targetBodyId ??
            cameraTargetBodyIdRef.current);
        const focusedParentId =
          focusedBodyId === null ? undefined : parentBodyId(focusedBodyId);
        const bodyParentId = PARENT_BODY_ID[body.id];
        const semanticLabelVisible =
          isCameraTarget ||
          (semanticZoomLevel === "solar-system"
            ? body.type === "star" || isOverviewPlanet
            : semanticZoomLevel === "planetary-system"
              ? body.id === focusedBodyId ||
                bodyParentId === focusedBodyId ||
                body.id === focusedParentId
              : semanticZoomLevel === "moon-system"
                ? body.id === focusedBodyId ||
                  body.id === focusedParentId ||
                  (focusedParentId !== undefined &&
                    bodyParentId === focusedParentId)
                : body.id === focusedBodyId);
        const projectedLabelX = ((projected.x + 1) * container.clientWidth) / 2;
        const projectedLabelY =
          ((-projected.y + 1) * container.clientHeight) / 2;
        const labelWidth =
          body.name.length * LABEL_CHARACTER_WIDTH_PX +
          LABEL_HORIZONTAL_CHROME_PX;
        const candidateOffsets = isCameraTarget
          ? [
              [18, 24],
              [18, -24],
              [-labelWidth - 18, 24],
              [-labelWidth - 18, -24],
            ]
          : isOverviewPlanet
            ? [
                [0, 0],
                [0, -22],
                [0, 22],
                [52, -11],
                [52, 11],
                [-labelWidth - 22, -11],
                [-labelWidth - 22, 11],
                [52, -33],
                [52, 33],
                [-labelWidth - 22, -33],
                [-labelWidth - 22, 33],
              ]
            : [[0, 0]];
        const placement = candidateOffsets
          .map(([offsetX, offsetY]) => {
            const x = Math.min(
              container.clientWidth - labelWidth - 12,
              Math.max(12, projectedLabelX + (offsetX ?? 0)),
            );
            const y = Math.min(
              container.clientHeight - 18,
              Math.max(18, projectedLabelY + (offsetY ?? 0)),
            );
            return {
              x,
              y,
              rectangle: {
                left: x,
                right: x + labelWidth,
                top: y - LABEL_HALF_HEIGHT_PX,
                bottom: y + LABEL_HALF_HEIGHT_PX,
              },
            };
          })
          .find(({ rectangle }) =>
            occupiedLabelRectangles.every(
              (occupied) =>
                rectangle.left >= occupied.right ||
                rectangle.right <= occupied.left ||
                rectangle.top >= occupied.bottom ||
                rectangle.bottom <= occupied.top,
            ),
          );
        const labelX = placement?.x ?? projectedLabelX;
        const labelY = placement?.y ?? projectedLabelY;
        const candidateRectangle = placement?.rectangle ?? {
          left: labelX,
          right: labelX + labelWidth,
          top: labelY - LABEL_HALF_HEIGHT_PX,
          bottom: labelY + LABEL_HALF_HEIGHT_PX,
        };
        const overlapsExistingLabel = occupiedLabelRectangles.some(
          (rectangle) =>
            candidateRectangle.left < rectangle.right &&
            candidateRectangle.right > rectangle.left &&
            candidateRectangle.top < rectangle.bottom &&
            candidateRectangle.bottom > rectangle.top,
        );
        let labelVisible =
          showLabelsRef.current &&
          (bodyLayerVisible || isCameraTarget) &&
          isInCameraFrustum &&
          semanticLabelVisible &&
          (semanticZoomLevel !== "surface" ||
            body.id === focusBodyIdRef.current ||
            isCameraTarget ||
            radiusPixels >= LABEL_MINIMUM_RADIUS_PIXELS);
        if (body.id === "sun") {
          labelVisible = false;
        }
        if (
          overlapsExistingLabel &&
          !isOverviewPlanet &&
          body.id !== focusBodyIdRef.current &&
          !isCameraTarget
        ) {
          labelVisible = false;
        }
        if (
          body.id === focusBodyIdRef.current ||
          isCameraTarget ||
          radiusPixels >= LABEL_MINIMUM_RADIUS_PIXELS / 2
        ) {
          ensureSurfaceAsset(body.id);
        }
        label.hidden = !labelVisible;
        label.classList.toggle("is-bracket", viewModeRef.current === "orrery");
        label.classList.toggle(
          "is-selected",
          body.id === selectedBodyIdRef.current,
        );
        label.classList.toggle(
          "is-focused",
          body.id === focusBodyIdRef.current,
        );
        label.classList.toggle("is-camera-target", isCameraTarget);
        label.setAttribute(
          "aria-pressed",
          String(body.id === selectedBodyIdRef.current),
        );
        const leaderX = projectedLabelX - labelX;
        const leaderY = projectedLabelY - labelY;
        const leaderLength = Math.hypot(leaderX, leaderY);
        label.classList.toggle("has-leader", labelVisible && leaderLength > 8);
        label.style.setProperty("--leader-length", `${String(leaderLength)}px`);
        label.style.setProperty(
          "--leader-angle",
          `${String(Math.atan2(leaderY, leaderX))}rad`,
        );
        if (labelVisible) {
          visibleLabelCount += 1;
          occupiedLabelRectangles.push(candidateRectangle);
          label.style.transform = `translate(${String(labelX)}px, ${String(labelY)}px)`;
        }
        const marker = bodyMarkers.get(body.id);
        if (marker !== undefined) {
          const markerVisible =
            viewModeRef.current === "orrery" &&
            mesh.visible &&
            isInCameraFrustum &&
            radiusPixels < 3;
          marker.hidden = !markerVisible;
          if (markerVisible) {
            visibleOrreryMarkerCount += 1;
            marker.classList.toggle(
              "is-selected",
              body.id === selectedBodyIdRef.current,
            );
            marker.style.transform = `translate(${String(projectedLabelX)}px, ${String(projectedLabelY)}px)`;
          }
        }
      }
      if (current !== undefined) {
        const monolithPosition = monolithMesh.position;
        const projected = monolithPosition.clone().project(camera);
        const cameraDistance = Math.max(
          camera.position.distanceTo(monolithPosition),
          1e-15,
        );
        const radiusAu =
          JOVIAN_MONOLITH_BOUNDING_RADIUS_M / ASTRONOMICAL_UNIT_M;
        const radiusPixels =
          (radiusAu / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const layerVisible = currentVisibility.spacecraft;
        const geometryVisible =
          layerVisible && isPhysicalBodyResolvable(radiusPixels);
        monolithMesh.visible = geometryVisible;
        const labelVisible =
          showLabelsRef.current &&
          layerVisible &&
          inCameraFrustum &&
          (focusBodyIdRef.current === JOVIAN_MONOLITH_BODY_ID ||
            selectedBodyIdRef.current === JOVIAN_MONOLITH_BODY_ID);
        monolithLabel.hidden = !labelVisible;
        monolithLabel.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === JOVIAN_MONOLITH_BODY_ID,
        );
        monolithLabel.classList.toggle(
          "is-focused",
          focusBodyIdRef.current === JOVIAN_MONOLITH_BODY_ID,
        );
        monolithLabel.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === JOVIAN_MONOLITH_BODY_ID),
        );
        const screenX = ((projected.x + 1) * container.clientWidth) / 2;
        const screenY = ((-projected.y + 1) * container.clientHeight) / 2;
        if (labelVisible) {
          monolithLabel.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleLabelCount += 1;
        }
        const markerVisible =
          viewModeRef.current === "orrery" &&
          layerVisible &&
          inCameraFrustum &&
          !geometryVisible;
        monolithMarker.hidden = !markerVisible;
        if (markerVisible) {
          monolithMarker.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleOrreryMarkerCount += 1;
        }
        container.dataset["jovianMonolithRadiusPixels"] =
          radiusPixels.toFixed(3);
        container.dataset["jovianMonolithGeometryVisible"] =
          String(geometryVisible);
      } else {
        monolithMesh.visible = false;
        monolithLabel.hidden = true;
        monolithMarker.hidden = true;
      }
      for (const orbiter of FICTIONAL_ORBITERS) {
        const group = fictionalOrbiterGroups.get(orbiter.id);
        const label = fictionalOrbiterLabels.get(orbiter.id);
        const marker = fictionalOrbiterMarkers.get(orbiter.id);
        if (
          group === undefined ||
          label === undefined ||
          marker === undefined
        ) {
          throw new Error(`${orbiter.name} scene objects are unavailable`);
        }
        const orbiterState =
          current === undefined
            ? undefined
            : fictionalOrbiterStateById(current, orbiter.id);
        if (orbiterState === undefined) {
          group.visible = false;
          label.hidden = true;
          marker.hidden = true;
          continue;
        }
        if (
          focusBodyIdRef.current === orbiter.id ||
          selectedBodyIdRef.current === orbiter.id
        ) {
          group.lookAt(camera.position);
          container.dataset[
            orbiter.constructionState === "incomplete"
              ? "deathstar2Attitude"
              : "deathstar1Attitude"
          ] = "camera-relative-fictional-presentation";
        }
        const position = scenePosition(orbiterState.positionM);
        const projected = position.clone().project(camera);
        const cameraDistance = Math.max(
          camera.position.distanceTo(position),
          1e-15,
        );
        const radiusAu = orbiter.diameterM / 2 / ASTRONOMICAL_UNIT_M;
        const radiusPixels =
          (radiusAu / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const layerVisible = currentVisibility.spacecraft;
        const geometryVisible =
          layerVisible && isPhysicalBodyResolvable(radiusPixels);
        group.visible = geometryVisible;
        const labelVisible =
          showLabelsRef.current &&
          layerVisible &&
          inCameraFrustum &&
          (focusBodyIdRef.current === orbiter.id ||
            selectedBodyIdRef.current === orbiter.id);
        label.hidden = !labelVisible;
        label.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === orbiter.id,
        );
        label.classList.toggle(
          "is-focused",
          focusBodyIdRef.current === orbiter.id,
        );
        label.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === orbiter.id),
        );
        const screenX = ((projected.x + 1) * container.clientWidth) / 2;
        const screenY = ((-projected.y + 1) * container.clientHeight) / 2;
        if (labelVisible) {
          label.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleLabelCount += 1;
        }
        const markerVisible =
          viewModeRef.current === "orrery" &&
          layerVisible &&
          inCameraFrustum &&
          !geometryVisible;
        marker.hidden = !markerVisible;
        if (markerVisible) {
          marker.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleOrreryMarkerCount += 1;
        }
        const datasetPrefix = orbiter.id.replaceAll("-", "");
        container.dataset[`${datasetPrefix}RadiusPixels`] =
          radiusPixels.toFixed(3);
        container.dataset[`${datasetPrefix}GeometryVisible`] =
          String(geometryVisible);
      }
      const issState =
        current === undefined ? undefined : bodyStateById(current, ISS_BODY_ID);
      if (issState !== undefined && current !== undefined) {
        const issPosition = scenePosition(issState.positionM);
        const projected = issPosition.clone().project(camera);
        const cameraDistance = Math.max(
          camera.position.distanceTo(issPosition),
          1e-15,
        );
        const issRadiusAu = ISS_BOUNDING_RADIUS_M / ASTRONOMICAL_UNIT_M;
        const radiusPixels =
          (issRadiusAu / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const ephemerisValid = isIssEphemerisWithinValidity(
          current.timeSeconds,
        );
        const layerVisible = currentVisibility.spacecraft && ephemerisValid;
        const geometryVisible =
          layerVisible && isPhysicalBodyResolvable(radiusPixels);
        issGroup.visible = geometryVisible;
        issLabel.hidden = !(
          showLabelsRef.current &&
          layerVisible &&
          inCameraFrustum &&
          focusBodyIdRef.current === ISS_BODY_ID
        );
        const markerVisible =
          viewModeRef.current === "orrery" &&
          layerVisible &&
          inCameraFrustum &&
          radiusPixels < 3;
        issMarker.hidden = !markerVisible;
        issMarker.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === ISS_BODY_ID,
        );
        issLabel.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === ISS_BODY_ID),
        );
        issLabel.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === ISS_BODY_ID,
        );
        issLabel.classList.toggle(
          "is-focused",
          focusBodyIdRef.current === ISS_BODY_ID,
        );
        const screenX = ((projected.x + 1) * container.clientWidth) / 2;
        const screenY = ((-projected.y + 1) * container.clientHeight) / 2;
        if (!issLabel.hidden) {
          issLabel.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleLabelCount += 1;
        }
        if (markerVisible) {
          issMarker.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleOrreryMarkerCount += 1;
        }
        container.dataset["issRadiusPixels"] = radiusPixels.toFixed(3);
        container.dataset["issGeometryVisible"] = String(geometryVisible);
        container.dataset["issMarkerVisible"] = String(markerVisible);
        container.dataset["issMaximumDimensionM"] = String(
          issSnapshot.physicalDimensions.overallEndToEndM,
        );
        container.dataset["issModelScale"] = "physical";
      } else {
        issGroup.visible = false;
        issLabel.hidden = true;
        issMarker.hidden = true;
      }
      for (const probe of voyagerSnapshot.probes) {
        const probeState =
          current === undefined ? undefined : bodyStateById(current, probe.id);
        const group = voyagerGroups.get(probe.id);
        const label = voyagerLabels.get(probe.id);
        const marker = voyagerMarkers.get(probe.id);
        if (
          group === undefined ||
          label === undefined ||
          marker === undefined
        ) {
          throw new Error(`Voyager scene objects ${probe.id} are unavailable`);
        }
        if (current === undefined) {
          group.visible = false;
          label.hidden = true;
          marker.hidden = true;
          continue;
        }
        if (probeState === undefined) {
          throw new Error(
            `Integrated state is missing ${probe.id}; received ${String(
              current.bodies.length,
            )} bodies ending with ${current.bodies
              .slice(-4)
              .map((body) => body.id)
              .join(",")}`,
          );
        }
        const position = scenePosition(probeState.positionM);
        const projected = position.clone().project(camera);
        const cameraDistance = Math.max(
          camera.position.distanceTo(position),
          1e-15,
        );
        const radiusAu = probe.maximumDimensionM / 2 / ASTRONOMICAL_UNIT_M;
        const radiusPixels =
          (radiusAu / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const layerVisible = currentVisibility.spacecraft;
        const geometryVisible =
          layerVisible && isPhysicalBodyResolvable(radiusPixels);
        group.visible = geometryVisible;
        const labelVisible =
          showLabelsRef.current &&
          layerVisible &&
          inCameraFrustum &&
          surfaceObserverRef.current === null &&
          (spacecraftLabelBodyIdsRef.current === undefined ||
            spacecraftLabelBodyIdsRef.current.includes(probe.id));
        label.hidden = !labelVisible;
        label.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === probe.id,
        );
        label.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === probe.id),
        );
        label.classList.toggle(
          "is-focused",
          focusBodyIdRef.current === probe.id,
        );
        const markerVisible =
          viewModeRef.current === "orrery" && layerVisible && inCameraFrustum;
        marker.hidden = !markerVisible;
        const screenX = ((projected.x + 1) * container.clientWidth) / 2;
        const screenY = ((-projected.y + 1) * container.clientHeight) / 2;
        if (labelVisible) {
          label.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleLabelCount += 1;
        }
        if (markerVisible) {
          marker.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleOrreryMarkerCount += 1;
        }
        const datasetPrefix =
          probe.id === "voyager-1" ? "voyager1" : "voyager2";
        container.dataset[`${datasetPrefix}DistanceAu`] = (
          Math.hypot(...probeState.positionM) / ASTRONOMICAL_UNIT_M
        ).toFixed(6);
        container.dataset[`${datasetPrefix}RadiusPixels`] =
          radiusPixels.toFixed(3);
        container.dataset[`${datasetPrefix}GeometryVisible`] =
          String(geometryVisible);
      }
      container.dataset["voyagerCount"] = String(voyagerSnapshot.probes.length);
      container.dataset["voyagerModelScale"] = "physical";
      container.dataset["voyagerPhysics"] = "REBOUND-massless-test-particle";
      for (const spacecraft of operationalSpacecraftSnapshot.spacecraft) {
        const group = spacecraftGroups.get(spacecraft.id);
        const label = operationalSpacecraftLabels.get(spacecraft.id);
        const marker = operationalSpacecraftMarkers.get(spacecraft.id);
        if (
          group === undefined ||
          label === undefined ||
          marker === undefined
        ) {
          throw new Error(`${spacecraft.name} scene objects are unavailable`);
        }
        const spacecraftState =
          current === undefined
            ? undefined
            : bodyStateById(current, spacecraft.id);
        if (spacecraftState === undefined) {
          group.visible = false;
          label.hidden = true;
          marker.hidden = true;
          continue;
        }
        const position = scenePosition(spacecraftState.positionM);
        const projected = position.clone().project(camera);
        const cameraDistance = Math.max(
          camera.position.distanceTo(position),
          1e-15,
        );
        const radiusAu = spacecraft.maximumDimensionM / 2 / ASTRONOMICAL_UNIT_M;
        const radiusPixels =
          (radiusAu / cameraDistance) *
          (container.clientHeight /
            (2 * Math.tan((camera.fov * Math.PI) / 360))) *
          camera.zoom;
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const layerVisible = currentVisibility.spacecraft;
        const geometryVisible =
          layerVisible && isPhysicalBodyResolvable(radiusPixels);
        group.visible = geometryVisible;
        const labelVisible =
          showLabelsRef.current &&
          layerVisible &&
          inCameraFrustum &&
          surfaceObserverRef.current === null &&
          (geometryVisible ||
            selectedBodyIdRef.current === spacecraft.id ||
            focusBodyIdRef.current === spacecraft.id) &&
          (spacecraftLabelBodyIdsRef.current === undefined ||
            spacecraftLabelBodyIdsRef.current.includes(spacecraft.id));
        label.hidden = !labelVisible;
        label.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === spacecraft.id,
        );
        label.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === spacecraft.id),
        );
        label.classList.toggle(
          "is-focused",
          focusBodyIdRef.current === spacecraft.id,
        );
        const markerVisible =
          viewModeRef.current === "orrery" && layerVisible && inCameraFrustum;
        marker.hidden = !markerVisible;
        const screenX = ((projected.x + 1) * container.clientWidth) / 2;
        const screenY = ((-projected.y + 1) * container.clientHeight) / 2;
        if (labelVisible) {
          label.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleLabelCount += 1;
        }
        if (markerVisible) {
          marker.style.transform = `translate(${String(screenX)}px, ${String(screenY)}px)`;
          visibleOrreryMarkerCount += 1;
        }
        container.dataset[`${spacecraft.id}RadiusPixels`] =
          radiusPixels.toFixed(3);
        container.dataset[`${spacecraft.id}GeometryVisible`] =
          String(geometryVisible);
      }
      let visibleApolloSiteCount = 0;
      const moonMesh = bodyMeshes.get("moon");
      const moonState =
        current === undefined ? undefined : bodyStateById(current, "moon");
      const apolloContextVisible =
        focusBodyIdRef.current === "moon" ||
        (selectedBodyIdRef.current !== null &&
          isApolloLandingSiteId(selectedBodyIdRef.current)) ||
        surfaceObserverRef.current?.bodyId === "moon";
      for (const site of apolloLandingSites) {
        const label = apolloSiteLabels.get(site.id);
        const siteGroup = apolloSiteGroups.get(site.id);
        if (label === undefined || siteGroup === undefined) {
          throw new Error(`${site.mission} scene assets are unavailable`);
        }
        siteGroup.visible =
          current !== undefined &&
          showApolloSitesRef.current &&
          currentVisibility.moons &&
          apolloContextVisible;
        if (
          current === undefined ||
          moonMesh === undefined ||
          moonState === undefined ||
          !showApolloSitesRef.current ||
          !showLabelsRef.current ||
          !currentVisibility.moons ||
          !apolloContextVisible ||
          surfaceObserverRef.current !== null
        ) {
          label.hidden = true;
          continue;
        }
        const [localX, localY, localZ] = moonFixedSurfaceUnitVector(
          site.latitudeDeg,
          site.longitudeDeg,
        );
        const surfaceNormal = new Vector3(localX, localY, localZ)
          .applyQuaternion(
            bodyOrientationQuaternion("moon", current.timeSeconds),
          )
          .normalize();
        const sitePosition = moonMesh.position
          .clone()
          .add(surfaceNormal.clone().multiplyScalar(moonMesh.scale.x * 1.012));
        const projected = sitePosition.clone().project(camera);
        const inCameraFrustum =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        const facingCamera =
          surfaceNormal.dot(
            camera.position.clone().sub(sitePosition).normalize(),
          ) > 0;
        const visible = inCameraFrustum && facingCamera;
        label.hidden = !visible;
        label.classList.toggle(
          "is-selected",
          selectedBodyIdRef.current === site.id,
        );
        label.setAttribute(
          "aria-pressed",
          String(selectedBodyIdRef.current === site.id),
        );
        if (visible) {
          label.style.transform = `translate(${String(((projected.x + 1) * container.clientWidth) / 2)}px, ${String(((-projected.y + 1) * container.clientHeight) / 2)}px)`;
          visibleLabelCount += 1;
          visibleApolloSiteCount += 1;
        }
      }
      container.dataset["apolloSiteCount"] = String(apolloLandingSites.length);
      container.dataset["apolloSiteLabelsVisible"] = String(
        visibleApolloSiteCount,
      );
      container.dataset["apolloSiteCoordinates"] =
        "LRO-derived-ME-planetocentric";
      container.dataset["operationalSpacecraftPhysics"] =
        "NASA-JPL-Horizons-cubic-Hermite";
      container.dataset["visibleBodyLabels"] = String(visibleLabelCount);
      container.dataset["orreryMarkerCount"] = String(visibleOrreryMarkerCount);

      const focusedKnownSatelliteId = focusBodyIdRef.current;
      const focusedKnownSatellite =
        focusedKnownSatelliteId === null
          ? undefined
          : knownSatelliteById.get(focusedKnownSatelliteId);
      const focusedKnownSatelliteState =
        current === undefined || focusedKnownSatelliteId === null
          ? undefined
          : bodyStateById(current, focusedKnownSatelliteId);
      if (
        showLabelsRef.current &&
        focusedKnownSatellite?.availability === "available" &&
        focusedKnownSatelliteState !== undefined
      ) {
        const projected = scenePosition(
          focusedKnownSatelliteState.positionM,
        ).project(camera);
        const visible =
          projected.z >= -1 &&
          projected.z <= 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        focusedKnownMoonLabel.hidden = !visible;
        if (visible) {
          focusedKnownMoonLabel.textContent = focusedKnownSatellite.name;
          focusedKnownMoonLabel.dataset["bodyId"] = focusedKnownSatellite.id;
          focusedKnownMoonLabel.setAttribute(
            "aria-label",
            `Focus ${focusedKnownSatellite.name}`,
          );
          focusedKnownMoonLabel.title =
            "Click to select; double-click to focus";
          const focusedMoonIsSelected =
            selectedBodyIdRef.current === focusedKnownSatellite.id;
          focusedKnownMoonLabel.setAttribute(
            "aria-pressed",
            String(focusedMoonIsSelected),
          );
          focusedKnownMoonLabel.classList.toggle(
            "is-selected",
            focusedMoonIsSelected,
          );
          focusedKnownMoonLabel.classList.add("is-focused");
          focusedKnownMoonLabel.style.transform = `translate(${String(((projected.x + 1) * container.clientWidth) / 2)}px, ${String(((-projected.y + 1) * container.clientHeight) / 2)}px)`;
          visibleLabelCount += 1;
        }
      } else {
        focusedKnownMoonLabel.hidden = true;
        focusedKnownMoonLabel.classList.remove("is-selected");
        focusedKnownMoonLabel.classList.remove("is-focused");
      }
      container.dataset["visibleBodyLabels"] = String(visibleLabelCount);

      if (earthPosition !== undefined && moonPosition !== undefined) {
        const projectedEarth = earthPosition.clone().project(camera);
        const projectedMoon = moonPosition.clone().project(camera);
        const separationPixels = Math.hypot(
          ((projectedMoon.x - projectedEarth.x) * container.clientWidth) / 2,
          ((projectedMoon.y - projectedEarth.y) * container.clientHeight) / 2,
        );
        container.dataset["earthMoonSeparationPixels"] =
          separationPixels.toFixed(2);
      }
      renderer.render(scene, camera);
      container.dataset["renderFrameIntervalMs"] =
        frameIntervalEmaMs.toFixed(2);
      container.dataset["renderFps"] = (
        1_000 / Math.max(frameIntervalEmaMs, 0.001)
      ).toFixed(1);
      container.dataset["renderCpuSubmissionMs"] = (
        performance.now() - frameRenderStartedAtMs
      ).toFixed(2);
      container.dataset["renderCalls"] = String(renderer.info.render.calls);
      container.dataset["renderTriangles"] = String(
        renderer.info.render.triangles,
      );
      if (gpuLayer !== undefined) {
        const requestedFocusBodyId = focusBodyIdRef.current;
        const focusState =
          current === undefined || requestedFocusBodyId === null
            ? undefined
            : bodyStateById(current, requestedFocusBodyId);
        if (focusState === undefined) {
          gpuLayer.setFocusRegion(null, 0);
          delete gpuCanvas.dataset["focusRegionRadiusAu"];
        } else {
          const focusDefinition = majorBodySnapshot.bodies.find(
            (body) => body.id === requestedFocusBodyId,
          );
          const focusRegionRadiusAu =
            focusDefinition?.type === "moon" ||
            (requestedFocusBodyId !== null &&
              knownSatelliteById.has(requestedFocusBodyId))
              ? 0.01
              : 0.05;
          const focusPosition = scenePosition(focusState.positionM);
          gpuLayer.setFocusRegion(
            [focusPosition.x, focusPosition.y, focusPosition.z],
            focusRegionRadiusAu,
          );
          gpuCanvas.dataset["focusRegionRadiusAu"] =
            focusRegionRadiusAu.toFixed(3);
        }
        if (smallBodiesVisible || lastSmallBodiesVisible !== false) {
          gpuLayer.render(camera);
        }
        lastSmallBodiesVisible = smallBodiesVisible;
      }
      animationFrame = requestAnimationFrame(render);
    };
    // React Strict Mode mounts effects once for verification and immediately
    // tears them down. Starting from a cancellable macrotask guarantees that
    // disposable mount cannot allocate a second 1.56-million-body GPU layer.
    startupTimer = window.setTimeout(() => {
      if (active) {
        render();
      }
    }, 0);

    return () => {
      active = false;
      cancelStarTooltip();
      modelLoadingActive = false;
      snapshotAbortController.abort();
      window.clearTimeout(startupTimer);
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      dracoLoader.dispose();
      controls.removeEventListener("start", handleControlStart);
      renderer.domElement.removeEventListener(
        "pointerdown",
        handleSurfacePointerDown,
      );
      renderer.domElement.removeEventListener(
        "pointermove",
        handleSurfacePointerMove,
      );
      renderer.domElement.removeEventListener(
        "pointerup",
        handleSurfacePointerUp,
      );
      renderer.domElement.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );
      renderer.domElement.removeEventListener(
        "pointerleave",
        handlePointerLeave,
      );
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      gpuLayer?.dispose();
      gravityWellLayer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      for (const texture of textures) {
        texture.dispose();
      }
      container.removeChild(rangeLegend);
      container.removeChild(spacecraftModelStatus);
      container.removeChild(cameraJourney);
      container.removeChild(bodyHoverTooltip);
      for (const { element } of zodiacLabels) {
        container.removeChild(element);
      }
      container.removeChild(zodiacLegend);
      for (const label of deepSpaceLabels) {
        container.removeChild(label);
      }
      container.removeChild(deepSunLabel);
      container.removeChild(navigationMap);
      container.removeChild(focusBracket);
      container.removeChild(sunGuideLabel);
      for (const visual of planetWayfinderVisuals) {
        container.removeChild(visual.label);
      }
      container.removeChild(sunGuideOverlay);
      container.removeChild(tacticalOverlay);
      container.removeChild(markerLayer);
      container.removeChild(labelLayer);
      container.removeChild(gpuCanvas);
      container.removeChild(renderer.domElement);
    };
  }, [
    onFocusBody,
    onGpuError,
    onGpuStatus,
    onOrientationChange,
    onSelectBody,
    onSemanticZoomChange,
  ]);

  return (
    <div
      ref={containerRef}
      className="scene"
      role="img"
      aria-label="Physics-driven Solar System with NASA surfaces and GPU-propagated NASA/JPL asteroid and comet catalogue"
      data-view-mode={viewMode}
      data-planets-visible={String(objectVisibility.planets)}
      data-moons-visible={String(objectVisibility.moons)}
      data-spacecraft-visible={String(objectVisibility.spacecraft)}
      data-apollo-sites-visible={String(showApolloSites)}
      data-wayfinder-mode={wayfinderMode}
      data-star-field-count={hipparcosStarSnapshot.stars.length}
      data-star-catalogue="ESA Hipparcos I/239"
      data-star-reference-frame="ICRS"
      data-star-tooltip-delay-ms={STAR_TOOLTIP_DELAY_MS}
      data-surface-lighting="inverse-square-solar-point-light-auto-exposure"
      data-atmosphere-rendering="sunlit-single-scattering-phase-functions"
      data-heliopause-voyager-1-au={VOYAGER_1_HELIOPAUSE_AU}
      data-heliopause-voyager-2-au={VOYAGER_2_HELIOPAUSE_AU}
      data-oort-inner-min-au={OORT_CLOUD_INNER_MIN_AU}
      data-oort-inner-max-au={OORT_CLOUD_INNER_MAX_AU}
      data-oort-outer-min-au={OORT_CLOUD_OUTER_MIN_AU}
      data-oort-outer-max-au={OORT_CLOUD_OUTER_MAX_AU}
      data-alpha-distance-au={ALPHA_CENTAURI_DISTANCE_AU}
      data-solar-system-share-percent={(
        (PREVIOUS_SOLAR_SYSTEM_VIEW_AU / ALPHA_CENTAURI_DISTANCE_AU) *
        100
      ).toFixed(6)}
      data-oort-cloud-share-percent={(
        (OORT_CLOUD_OUTER_MAX_AU / ALPHA_CENTAURI_DISTANCE_AU) *
        100
      ).toFixed(6)}
    >
      {gravityWellMode === "off" ? null : (
        <span className="gravity-field-legend" aria-hidden="true">
          <strong>Newtonian potential</strong>
          <span data-gravity-potential-range>Calculating J/kg range...</span>
          <small>
            Combined field · logarithmic display ·{" "}
            {gravityWellScale === "local"
              ? "locally normalised detail"
              : "fixed absolute comparison"}
          </small>
        </span>
      )}
    </div>
  );
}
