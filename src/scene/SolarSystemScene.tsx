import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
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
  Vector3,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
import { focusDistanceAu } from "./camera-focus";
import { GravityWellLayer } from "./GravityWellLayer";
import type {
  GravityPotentialSource,
  GravityWellMode,
} from "./gravity-potential";
import type { SimulationFrame } from "./interpolation";
import {
  bodyOrientationAngles,
  bodyOrientationQuaternion,
} from "./orientation";
import type {
  CameraNavigationCommand,
  CameraOrientationPreset,
} from "./camera-view";
import { PARENT_BODY_ID } from "./body-facts";
import {
  interpolateLogarithmicDistance,
  sampleCameraTransition,
} from "./camera-transition";
import { osculatingOrbitPositionsM } from "./osculating-orbit";
import { surfaceObserverViewpoint } from "./observer-camera";
import { icrfToScene, j2000EclipticToScene } from "./reference-frames";
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
import type { ObjectVisibility } from "./visibility";
import { isMajorBodyVisible } from "./visibility";
import {
  nasaEarthCloudAsset,
  nasaMaterialPresentationByBodyId,
  nasaMoonHeightAsset,
  nasaSaturnRingAsset,
  nasaTextureByBodyId,
} from "./visual-assets";
import type { ReferenceFrame, SemanticZoomLevel, ViewMode } from "./view-mode";

const ECLIPTIC_NORTH = j2000EclipticToScene({ x: 0, y: 0, z: 1 }).normalize();
const ECLIPTIC_FORWARD = j2000EclipticToScene({ x: 0, y: 1, z: 0 }).normalize();
const PERSPECTIVE_CAMERA_DIRECTION = ECLIPTIC_FORWARD.clone()
  .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.48))
  .normalize();
const SOLAR_SYSTEM_CAMERA_POSITION =
  PERSPECTIVE_CAMERA_DIRECTION.clone().multiplyScalar(90);

function interpolateCameraTransitionLeg(
  outputPosition: Vector3,
  outputTarget: Vector3,
  startPosition: Vector3,
  startTarget: Vector3,
  endPosition: Vector3,
  endTarget: Vector3,
  progress: number,
): void {
  outputTarget.lerpVectors(startTarget, endTarget, progress);
  const startOffset = startPosition.clone().sub(startTarget);
  const endOffset = endPosition.clone().sub(endTarget);
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
    .add(outputTarget);
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
const ISS_FOCUS_DISTANCE_AU = 500 / ASTRONOMICAL_UNIT_M;
const DEFAULT_CAMERA_NEAR_AU = 0.000_001;
const DEFAULT_CAMERA_FAR_AU = 200_000;
const SMALL_BODY_GPU_UPDATE_INTERVAL_MS = 200;
const SUN_GUIDE_UPDATE_INTERVAL_MS = 100;
const STAR_SPHERE_RADIUS_AU = 1_500;
const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_POLAR_RADIUS_KM = 54_364;
const SATURN_RING_PROFILE_INNER_RADIUS_KM = 74_565;
const SATURN_RING_PROFILE_OUTER_RADIUS_KM = 136_780;
const JULIAN_YEAR_SECONDS = 365.25 * 86_400;
const SOLAR_SYSTEM_EPOCH_JULIAN_YEAR =
  2000 + (majorBodySnapshot.epoch.value - 2_451_545) / 365.25;
const majorBodyById = new Map(
  majorBodySnapshot.bodies.map((body) => [body.id, body]),
);

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
    : (knownSatelliteById.get(bodyId)?.parentId ?? PARENT_BODY_ID[bodyId]);
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
  showMoonTrail: boolean;
  showPlanetTrails: boolean;
  showMinorBodyTrails: boolean;
  referenceFrame: ReferenceFrame;
  trailDurationSeconds: number;
  trailFade: number;
  clearTrailsToken: number;
  showEclipticPlane: boolean;
  showLabels: boolean;
  resetViewToken: number;
  cameraZoom: number;
  cameraDistanceOverrideAu: number | undefined;
  cameraTargetBodyId: string | undefined;
  cameraTransitionSequence: number;
  cameraTransitionDurationMs: number;
  cameraTransitionOverviewAnchorBodyId: string | undefined;
  cameraTransitionOverviewDistanceAu: number;
  cameraNavigationCommand: CameraNavigationCommand;
  orientationPreset: CameraOrientationPreset;
  orientationPresetToken: number;
  viewMode: Exclude<ViewMode, "schematic">;
  showTacticalOverlay: boolean;
  showOrbitGuides: boolean;
  orbitGuideScope: "system" | "all";
  gravityWellMode: GravityWellMode;
  objectVisibility: ObjectVisibility;
  onFocusBody(bodyId: string): void;
  onOrientationChange(preset: CameraOrientationPreset): void;
  onSemanticZoomChange(level: SemanticZoomLevel): void;
  onGpuStatus(status: SmallBodyGpuStatus): void;
  onGpuError(message: string): void;
}>;

export function SolarSystemScene({
  frame,
  displayedStateRef,
  bodyVisibility,
  focusBodyId,
  showMoonTrail,
  showPlanetTrails,
  showMinorBodyTrails,
  referenceFrame,
  trailDurationSeconds,
  trailFade,
  clearTrailsToken,
  showEclipticPlane,
  showLabels,
  resetViewToken,
  cameraZoom,
  cameraDistanceOverrideAu,
  cameraTargetBodyId,
  cameraTransitionSequence,
  cameraTransitionDurationMs,
  cameraTransitionOverviewAnchorBodyId,
  cameraTransitionOverviewDistanceAu,
  cameraNavigationCommand,
  orientationPreset,
  orientationPresetToken,
  viewMode,
  showTacticalOverlay,
  showOrbitGuides,
  orbitGuideScope,
  gravityWellMode,
  objectVisibility,
  onFocusBody,
  onOrientationChange,
  onSemanticZoomChange,
  onGpuStatus,
  onGpuError,
}: SolarSystemSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const bodyVisibilityRef = useRef(bodyVisibility);
  const focusBodyIdRef = useRef(focusBodyId);
  const showMoonTrailRef = useRef(showMoonTrail);
  const showPlanetTrailsRef = useRef(showPlanetTrails);
  const showMinorBodyTrailsRef = useRef(showMinorBodyTrails);
  const referenceFrameRef = useRef(referenceFrame);
  const trailDurationSecondsRef = useRef(trailDurationSeconds);
  const trailFadeRef = useRef(trailFade);
  const clearTrailsTokenRef = useRef(clearTrailsToken);
  const showEclipticPlaneRef = useRef(showEclipticPlane);
  const showLabelsRef = useRef(showLabels);
  const resetViewTokenRef = useRef(resetViewToken);
  const cameraZoomRef = useRef(cameraZoom);
  const cameraDistanceOverrideAuRef = useRef(cameraDistanceOverrideAu);
  const cameraTargetBodyIdRef = useRef(cameraTargetBodyId);
  const cameraTransitionSequenceRef = useRef(cameraTransitionSequence);
  const cameraTransitionDurationMsRef = useRef(cameraTransitionDurationMs);
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
  const orbitGuideScopeRef = useRef(orbitGuideScope);
  const gravityWellModeRef = useRef(gravityWellMode);
  const objectVisibilityRef = useRef(objectVisibility);
  frameRef.current = frame;
  bodyVisibilityRef.current = bodyVisibility;
  focusBodyIdRef.current = focusBodyId;
  showMoonTrailRef.current = showMoonTrail;
  showPlanetTrailsRef.current = showPlanetTrails;
  showMinorBodyTrailsRef.current = showMinorBodyTrails;
  referenceFrameRef.current = referenceFrame;
  trailDurationSecondsRef.current = trailDurationSeconds;
  trailFadeRef.current = trailFade;
  clearTrailsTokenRef.current = clearTrailsToken;
  showEclipticPlaneRef.current = showEclipticPlane;
  showLabelsRef.current = showLabels;
  resetViewTokenRef.current = resetViewToken;
  cameraZoomRef.current = cameraZoom;
  cameraDistanceOverrideAuRef.current = cameraDistanceOverrideAu;
  cameraTargetBodyIdRef.current = cameraTargetBodyId;
  cameraTransitionSequenceRef.current = cameraTransitionSequence;
  cameraTransitionDurationMsRef.current = cameraTransitionDurationMs;
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
  orbitGuideScopeRef.current = orbitGuideScope;
  gravityWellModeRef.current = gravityWellMode;
  objectVisibilityRef.current = objectVisibility;

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
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.className = "major-body-layer";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(renderer.domElement);
    const gpuCanvas = document.createElement("canvas");
    gpuCanvas.className = "small-body-layer";
    gpuCanvas.hidden = true;
    gpuCanvas.setAttribute("aria-hidden", "true");
    container.append(gpuCanvas);
    const labelLayer = document.createElement("div");
    labelLayer.className = "body-label-layer";
    container.append(labelLayer);
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
    issLabel.addEventListener("click", () => onFocusBody(ISS_BODY_ID));
    issLabel.hidden = true;
    labelLayer.append(issLabel);
    const issMarker = document.createElement("span");
    issMarker.className = "orrery-marker";
    issMarker.hidden = true;
    markerLayer.append(issMarker);
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
    sunGuideOverlay.append(sunGuideDefinitions);
    const sunGuideLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    sunGuideLine.classList.add("sun-guide-line");
    sunGuideLine.setAttribute("marker-end", "url(#sun-guide-arrow)");
    sunGuideOverlay.append(sunGuideLine);
    const sunGuideEndpoint = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    sunGuideEndpoint.classList.add("sun-guide-endpoint");
    sunGuideEndpoint.setAttribute("r", "3");
    sunGuideOverlay.append(sunGuideEndpoint);
    container.append(sunGuideOverlay);
    const sunGuideLabel = document.createElement("button");
    sunGuideLabel.type = "button";
    sunGuideLabel.className = "sun-guide-label";
    sunGuideLabel.setAttribute("aria-label", "Focus Sun");
    sunGuideLabel.addEventListener("click", () => onFocusBody("sun"));
    sunGuideLabel.hidden = true;
    container.append(sunGuideLabel);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    const handleControlStart = (): void => {
      onOrientationChange("custom");
      container.dataset["cameraOrientation"] = "custom";
    };
    controls.addEventListener("start", handleControlStart);
    scene.add(new AmbientLight(0x9bb7dd, 0.12));
    const sunlight = new PointLight(0xffffff, 4.5, 0, 0);
    sunlight.name = "Sunlight direction source";
    scene.add(sunlight);

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

    const unitSphere = new SphereGeometry(1, 64, 48);
    const bodyMeshes = new Map<string, Mesh>();
    const surfaceMaterials = new Map<string, MeshStandardMaterial>();
    const bodyLabels = new Map<string, HTMLButtonElement>();
    const materials: Material[] = [starMaterial];
    const geometries: BufferGeometry[] = [unitSphere, starGeometry];
    const textures: Texture[] = [];
    const textureLoader = new TextureLoader();
    const textureRequestedBodyIds = new Set<string>();
    const loadedSurfaceAssetBodyIds = new Set<string>();
    const loadTexture = (
      url: string,
      isColor: boolean,
      onLoad?: () => void,
      onError?: () => void,
    ): Texture => {
      const texture = textureLoader.load(url, onLoad, undefined, onError);
      if (isColor) {
        texture.colorSpace = SRGBColorSpace;
      }
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(texture);
      return texture;
    };

    const solarCoronaTexture = createSolarCoronaTexture();
    textures.push(solarCoronaTexture);

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
              vec3 umber = vec3(0.82, 0.34, 0.055);
              vec3 warmWhite = vec3(1.0, 0.88, 0.61);
              vec3 photosphere = vec3(1.0, 0.72, 0.27);
              float cellContrast = smoothstep(0.28, 0.76, granulation);
              vec3 color = mix(umber, photosphere, 0.54 + cellContrast * 0.34);
              color = mix(color, warmWhite, smoothstep(0.48, 0.84, largerCells) * 0.2);
              color *= 0.42 + pow(limb, 0.42) * 0.62;
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
              gl_FragColor = vec4(glowColor, rim * 0.17);
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
          color: 0xffd39a,
          transparent: true,
          opacity: 0.32,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
        });
        materials.push(coronaMaterial);
        const corona = new Sprite(coronaMaterial);
        corona.name = "Sun procedural corona presentation";
        corona.userData["bodyId"] = body.id;
        corona.scale.set(2.7, 2.7, 1);
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
      label.addEventListener("click", () => onFocusBody(body.id));
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

      const atmosphereColors: Readonly<Record<string, number>> = {
        earth: 0x5ba9ff,
        venus: 0xf4d7a1,
        mars: 0xd59772,
        jupiter: 0xe4c7a0,
        saturn: 0xe9d29c,
        uranus: 0x9eeaff,
        neptune: 0x5b83ff,
        titan: 0xe6a24d,
      };
      const atmosphereColor = atmosphereColors[body.id];
      if (atmosphereColor !== undefined) {
        const atmosphereMaterial = new ShaderMaterial({
          uniforms: {
            glowColor: { value: new Color(atmosphereColor) },
            glowOpacity: { value: body.id === "earth" ? 0.58 : 0.34 },
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
            uniform float glowOpacity;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              float rim = pow(1.0 - max(dot(vNormal, normalize(-vViewPosition)), 0.0), 2.4);
              gl_FragColor = vec4(glowColor, rim * glowOpacity);
            }
          `,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        materials.push(atmosphereMaterial);
        const atmosphere = new Mesh(unitSphere, atmosphereMaterial);
        atmosphere.name = `${body.name} atmosphere visualization`;
        atmosphere.scale.setScalar(1.04);
        mesh.add(atmosphere);
      }

      if (body.id === "saturn" || body.id === "uranus") {
        if (body.id === "saturn" && nasaSaturnRingAsset === undefined) {
          throw new Error("Cassini Saturn ring profile is missing");
        }
        const observedRingProfile =
          body.id === "saturn" ? nasaSaturnRingAsset : undefined;
        const innerRadius =
          body.id === "saturn"
            ? SATURN_RING_PROFILE_INNER_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM
            : 1.45;
        const outerRadius =
          body.id === "saturn"
            ? SATURN_RING_PROFILE_OUTER_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM
            : 2.05;
        const ringGeometry = new RingGeometry(innerRadius, outerRadius, 192);
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
            baseOpacity: { value: body.id === "saturn" ? 0.7 : 0.36 },
            observedRingProfile: { value: observedRingTexture ?? null },
            useObservedRingProfile: {
              value: observedRingTexture === undefined ? 0 : 1,
            },
          },
          vertexShader: `
            varying float vRadius;
            void main() {
              vRadius = length(position.xy);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 ringColor;
            uniform float innerRadius;
            uniform float outerRadius;
            uniform float baseOpacity;
            uniform sampler2D observedRingProfile;
            uniform float useObservedRingProfile;
            varying float vRadius;
            void main() {
              float normalizedRadius = (vRadius - innerRadius) / (outerRadius - innerRadius);
              float edge = smoothstep(0.0, 0.025, normalizedRadius) * (1.0 - smoothstep(0.975, 1.0, normalizedRadius));
              if (useObservedRingProfile > 0.5) {
                vec3 observed = texture2D(
                  observedRingProfile,
                  vec2(clamp(normalizedRadius, 0.0, 1.0), 0.5)
                ).rgb;
                float luminance = dot(observed, vec3(0.2126, 0.7152, 0.0722));
                float opacity = smoothstep(0.012, 0.11, luminance);
                gl_FragColor = vec4(observed * 1.08, opacity * 0.88 * edge);
              } else {
                float bands = 0.62 + 0.28 * sin(normalizedRadius * 84.0) + 0.10 * sin(normalizedRadius * 233.0);
                gl_FragColor = vec4(ringColor * (0.72 + bands * 0.28), baseOpacity * bands * edge);
              }
            }
          `,
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        materials.push(ringMaterial);
        const rings = new Mesh(ringGeometry, ringMaterial);
        rings.name =
          body.id === "saturn"
            ? "Saturn Cassini-observed ring radial profile"
            : `${body.name} ring-plane visualization`;
        rings.rotation.x = Math.PI / 2;
        mesh.add(rings);
      }
    }

    const issGroup = new Group();
    issGroup.name = "NASA-dimensioned International Space Station model";
    issGroup.visible = false;
    scene.add(issGroup);
    const issStructureMaterial = new MeshStandardMaterial({
      color: 0xf0f3f5,
      emissive: 0x2d343b,
      emissiveIntensity: 0.7,
      roughness: 0.58,
      metalness: 0.42,
    });
    const issSolarMaterial = new MeshStandardMaterial({
      color: 0x345f9f,
      emissive: 0x10264a,
      emissiveIntensity: 0.85,
      roughness: 0.68,
      metalness: 0.16,
      side: DoubleSide,
    });
    materials.push(issStructureMaterial, issSolarMaterial);
    const issSelectableMeshes: Mesh[] = [];
    const addIssBox = (
      name: string,
      dimensionsM: readonly [number, number, number],
      positionM: readonly [number, number, number],
      material: MeshStandardMaterial,
    ): void => {
      const geometry = new BoxGeometry(
        dimensionsM[0] / ASTRONOMICAL_UNIT_M,
        dimensionsM[1] / ASTRONOMICAL_UNIT_M,
        dimensionsM[2] / ASTRONOMICAL_UNIT_M,
      );
      geometries.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.name = name;
      mesh.position.set(
        positionM[0] / ASTRONOMICAL_UNIT_M,
        positionM[1] / ASTRONOMICAL_UNIT_M,
        positionM[2] / ASTRONOMICAL_UNIT_M,
      );
      mesh.userData["bodyId"] = ISS_BODY_ID;
      issSelectableMeshes.push(mesh);
      issGroup.add(mesh);
    };
    addIssBox(
      "ISS main truss",
      [issSnapshot.physicalDimensions.trussLengthM, 1.3, 1.3],
      [0, 0, 0],
      issStructureMaterial,
    );
    addIssBox(
      "ISS pressurized modules",
      [5, 5, issSnapshot.physicalDimensions.pressurizedModuleLengthM],
      [0, -2, 0],
      issStructureMaterial,
    );
    for (const xM of [-49.5, -16.5, 16.5, 49.5]) {
      for (const zM of [-19.25, 19.25]) {
        addIssBox(
          "ISS solar array wing",
          [10, 0.2, 34.5],
          [xM, 0, zM],
          issSolarMaterial,
        );
      }
    }
    addIssBox(
      "ISS central radiator",
      [24, 0.18, 6],
      [0, 3, 0],
      issStructureMaterial,
    );

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const handleDoubleClick = (event: MouseEvent): void => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const selected = raycaster
        .intersectObjects(
          [...bodyMeshes.values(), ...issSelectableMeshes],
          true,
        )
        .find((intersection) => intersection.object.visible);
      const bodyId: unknown = selected?.object.userData["bodyId"];
      if (typeof bodyId === "string") {
        onFocusBody(bodyId);
      }
    };
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
        surfaceMaterial.bumpScale = 0.035;
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
        });
        materials.push(cloudMaterial);
        const clouds = new Mesh(unitSphere, cloudMaterial);
        clouds.name = "NASA Blue Marble static Earth cloud composite";
        clouds.scale.setScalar(1.018);
        bodyMeshes.get("earth")?.add(clouds);
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
          sequence: number;
          startedAtMs: number;
          durationMs: number;
          startPosition: Vector3;
          startTarget: Vector3;
          startUp: Vector3;
          overviewPosition: Vector3;
          overviewTarget: Vector3;
          endPosition: Vector3;
          endTarget: Vector3;
          endUp: Vector3;
          endNear: number;
          endFar: number;
          endMinimumDistance: number;
          endMaximumDistance: number;
        }
      | undefined;
    let lastCameraZoom = Number.NaN;
    let activeFrameEndTime: number | undefined;
    let lastSemanticZoomLevel: SemanticZoomLevel | undefined;
    let lastSmallBodyGpuUpdateAt = Number.NEGATIVE_INFINITY;
    let lastSunGuideUpdateAt = Number.NEGATIVE_INFINITY;
    let lastSmallBodiesVisible: boolean | undefined;
    let lastSceneMutationKey = "";

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
          onGpuError,
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
        controls.minDistance = 0;
        controls.maxDistance = Number.POSITIVE_INFINITY;
        delete container.dataset["focusDistanceAu"];
        delete container.dataset["cameraObserverBody"];
        delete container.dataset["cameraTargetBody"];
        delete container.dataset["cameraObserverAltitudeKm"];
        return;
      }
      const focusDefinition = majorBodySnapshot.bodies.find(
        (body) => body.id === requestedFocusBodyId,
      );
      const knownFocusDefinition = knownSatelliteById.get(requestedFocusBodyId);
      const isIssFocus = requestedFocusBodyId === ISS_BODY_ID;
      const focusState = bodyStateById(current, requestedFocusBodyId);
      if (
        (focusDefinition === undefined &&
          knownFocusDefinition === undefined &&
          !isIssFocus) ||
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
      camera.near = isIssFocus
        ? 0.5 / ASTRONOMICAL_UNIT_M
        : DEFAULT_CAMERA_NEAR_AU;
      camera.far = isIssFocus ? 0.1 : DEFAULT_CAMERA_FAR_AU;
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
        controls.maxDistance = Math.max(1, observerDistance * 100);
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
          : isIssFocus
            ? ISS_FOCUS_DISTANCE_AU
            : focusDefinition === undefined
              ? 0.003
              : focusDistanceAu(focusDefinition, bodyVisibilityRef.current));
      if (!Number.isFinite(focusDistance) || focusDistance <= 0) {
        throw new Error("Camera focus distance must be positive and finite");
      }
      const sunState = bodyStateById(current, "sun");
      const cameraDirection =
        requestedFocusBodyId === "sun" || sunState === undefined
          ? PERSPECTIVE_CAMERA_DIRECTION.clone()
          : scenePosition(sunState.positionM)
              .sub(focusPosition)
              .normalize()
              .add(
                j2000EclipticToScene({ x: 0, y: 0, z: 1 })
                  .normalize()
                  .multiplyScalar(0.2),
              )
              .normalize();
      camera.position
        .copy(focusPosition)
        .add(cameraDirection.multiplyScalar(focusDistance));
      controls.target.copy(focusPosition);
      controls.minDistance = Math.max(
        isIssFocus
          ? 20 / ASTRONOMICAL_UNIT_M
          : focusDefinition === undefined
            ? camera.near * 2
            : focusDefinition.meanRadiusM / ASTRONOMICAL_UNIT_M / 2,
        camera.near * 2,
      );
      controls.maxDistance = Math.max(1, focusDistance * 100);
      container.dataset["focusDistanceAu"] = focusDistance.toFixed(
        isIssFocus ? 12 : 8,
      );
    };

    const applyOrientationPreset = (
      preset: Exclude<CameraOrientationPreset, "custom">,
      requestedFocusBodyId: string | null,
      current: SimulationState | undefined,
    ): void => {
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
      let direction: Vector3;
      if (preset === "overhead") {
        direction = ECLIPTIC_NORTH.clone();
        camera.up.copy(ECLIPTIC_FORWARD);
      } else if (preset === "edge-on") {
        direction = ECLIPTIC_FORWARD.clone();
        camera.up.copy(ECLIPTIC_NORTH);
      } else if (preset === "parent-facing" && focusState !== undefined) {
        direction =
          parentState === undefined
            ? PERSPECTIVE_CAMERA_DIRECTION.clone()
            : scenePosition(parentState.positionM)
                .sub(target)
                .normalize()
                .add(ECLIPTIC_NORTH.clone().multiplyScalar(0.2))
                .normalize();
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
      activeCameraTransition = undefined;
      container.dataset["cameraTransitionPhase"] = "settled";
      container.dataset["cameraTransitionSequence"] = String(
        transition.sequence,
      );
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
            : "parent-facing"
          : requestedPreset,
        requestedFocusBodyId,
        current,
      );
      const overviewAnchorBodyId =
        cameraTransitionOverviewAnchorBodyIdRef.current ?? "sun";
      const overviewAnchorState = bodyStateById(current, overviewAnchorBodyId);
      if (overviewAnchorState === undefined) {
        throw new Error(
          `Camera transition anchor ${overviewAnchorBodyId} is unavailable`,
        );
      }
      const overviewDistanceAu = cameraTransitionOverviewDistanceAuRef.current;
      if (!Number.isFinite(overviewDistanceAu) || overviewDistanceAu <= 0) {
        throw new Error(
          "Camera transition overview distance must be positive and finite",
        );
      }
      const overviewTarget = scenePosition(overviewAnchorState.positionM);
      activeCameraTransition = {
        sequence,
        startedAtMs: performance.now(),
        durationMs,
        startPosition,
        startTarget,
        startUp,
        overviewPosition: overviewTarget
          .clone()
          .add(
            PERSPECTIVE_CAMERA_DIRECTION.clone().multiplyScalar(
              overviewDistanceAu,
            ),
          ),
        overviewTarget,
        endPosition: camera.position.clone(),
        endTarget: controls.target.clone(),
        endUp: camera.up.clone(),
        endNear: camera.near,
        endFar: camera.far,
        endMinimumDistance: controls.minDistance,
        endMaximumDistance: controls.maxDistance,
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
      controls.enabled = false;
      container.dataset["cameraTransitionPhase"] = "outbound";
      container.dataset["cameraTransitionSequence"] = String(sequence);
      container.dataset["cameraTransitionOverviewAnchor"] =
        overviewAnchorBodyId;
      container.dataset["cameraTransitionDurationMs"] = String(durationMs);
      container.dataset["cameraTransitionInterpolation"] =
        "logarithmic-distance";
      return true;
    };

    const updateCameraTransition = (nowMs: number): void => {
      const transition = activeCameraTransition;
      if (transition === undefined) {
        return;
      }
      const sample = sampleCameraTransition(
        nowMs - transition.startedAtMs,
        transition.durationMs,
      );
      container.dataset["cameraTransitionPhase"] = sample.phase;
      if (sample.phase === "settled") {
        completeCameraTransition();
        return;
      }
      if (sample.phase === "outbound") {
        interpolateCameraTransitionLeg(
          camera.position,
          controls.target,
          transition.startPosition,
          transition.startTarget,
          transition.overviewPosition,
          transition.overviewTarget,
          sample.segmentProgress,
        );
        camera.up
          .lerpVectors(
            transition.startUp,
            ECLIPTIC_NORTH,
            sample.segmentProgress,
          )
          .normalize();
      } else if (sample.phase === "overview") {
        camera.position.copy(transition.overviewPosition);
        controls.target.copy(transition.overviewTarget);
        camera.up.copy(ECLIPTIC_NORTH);
        container.dataset["cameraTransitionOverviewVisited"] = String(
          transition.sequence,
        );
        container.dataset["cameraTransitionOverviewDistanceAu"] =
          transition.overviewPosition
            .distanceTo(transition.overviewTarget)
            .toFixed(6);
      } else {
        interpolateCameraTransitionLeg(
          camera.position,
          controls.target,
          transition.overviewPosition,
          transition.overviewTarget,
          transition.endPosition,
          transition.endTarget,
          sample.segmentProgress,
        );
        camera.up
          .lerpVectors(ECLIPTIC_NORTH, transition.endUp, sample.segmentProgress)
          .normalize();
      }
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
              : "parent-facing"
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
    const render = (): void => {
      const requestedFrame = frameRef.current;
      if (clearTrailsTokenRef.current !== lastClearTrailsToken) {
        lastClearTrailsToken = clearTrailsTokenRef.current;
        clearTrails();
        container.dataset["clearTrailsToken"] = String(lastClearTrailsToken);
      }
      const currentVisibility = objectVisibilityRef.current;
      stars.visible = currentVisibility.stars;
      container.dataset["starsVisible"] = String(stars.visible);
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
        showMinorBodyTrailsRef.current,
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
          centerAu: [gravityCenter.x, gravityCenter.y, gravityCenter.z],
          extentAu: gravityFieldExtentAu(
            gravityFocusId,
            bodyVisibilityRef.current,
          ),
          sources: gravitySources,
        });
        container.dataset["gravityWellMode"] = gravityMode;
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
              if (otherBodyId !== body.id && otherBodyId !== ISS_BODY_ID) {
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
            if (body.id === "saturn") {
              const meanRadiusKm = body.meanRadiusM / 1_000;
              mesh.scale.set(
                (radius * SATURN_EQUATORIAL_RADIUS_KM) / meanRadiusKm,
                (radius * SATURN_POLAR_RADIUS_KM) / meanRadiusKm,
                (radius * SATURN_EQUATORIAL_RADIUS_KM) / meanRadiusKm,
              );
              container.dataset["saturnEquatorialToPolarRatio"] = (
                SATURN_EQUATORIAL_RADIUS_KM / SATURN_POLAR_RADIUS_KM
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
          sunlight.position.copy(scenePosition(sunState.positionM));
          eclipticGrid.position.copy(scenePosition(sunState.positionM));
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
            gpuLayer.setTimeSeconds(current.timeSeconds, [
              sunState.positionM[0] / ASTRONOMICAL_UNIT_M,
              sunState.positionM[1] / ASTRONOMICAL_UNIT_M,
              sunState.positionM[2] / ASTRONOMICAL_UNIT_M,
            ]);
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
                  : "parent-facing"
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
                requestedPreset === "custom"
                  ? "parent-facing"
                  : requestedPreset,
                requestedFocusBodyId,
                current,
              );
              if (requestedPreset === "custom") {
                onOrientationChange("parent-facing");
              }
            } else {
              const requestedPreset = orientationPresetRef.current;
              const requestedTargetBodyId = cameraTargetBodyIdRef.current;
              const targetState =
                requestedTargetBodyId === undefined
                  ? undefined
                  : bodyStateById(current, requestedTargetBodyId);
              const presetContinuouslyTracked =
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
                const trackingDelta = focusPosition
                  .clone()
                  .sub(controls.target);
                camera.position.add(trackingDelta);
                controls.target.copy(focusPosition);
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
          cameraZoomRef.current < 0.5 ||
          cameraZoomRef.current > 8
        ) {
          throw new Error("Camera zoom must be between 0.5x and 8x");
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

      const renderNowMs = performance.now();
      updateCameraTransition(renderNowMs);
      controls.update();
      container.dataset["cameraDistanceAu"] = camera.position
        .distanceTo(controls.target)
        .toFixed(12);
      stars.position.copy(camera.position);
      camera.updateMatrixWorld();
      if (activeCameraTransition === undefined) {
        delete container.dataset["cameraTransitionAnchorScreenX"];
        delete container.dataset["cameraTransitionAnchorScreenY"];
      } else {
        const projectedTransitionAnchor = activeCameraTransition.overviewTarget
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
      const activeCameraTargetBodyId = cameraTargetBodyIdRef.current;
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

      if (renderNowMs - lastSunGuideUpdateAt >= SUN_GUIDE_UPDATE_INTERVAL_MS) {
        lastSunGuideUpdateAt = renderNowMs;
        const sunGuideFocusId = focusBodyIdRef.current;
        const sunGuideFocusState =
          current === undefined || sunGuideFocusId === null
            ? undefined
            : bodyStateById(current, sunGuideFocusId);
        const sunGuideSunState =
          current === undefined ? undefined : bodyStateById(current, "sun");
        if (current === undefined || sunGuideSunState === undefined) {
          sunGuideOverlay.style.display = "none";
          sunGuideLabel.hidden = true;
          container.dataset["sunGuideVisible"] = "false";
        } else {
          const viewportWidth = container.clientWidth;
          const viewportHeight = container.clientHeight;
          const viewportMargin = Math.min(
            110,
            viewportWidth / 3,
            viewportHeight / 3,
          );
          const sunPosition = scenePosition(sunGuideSunState.positionM);
          const focusPosition =
            sunGuideFocusState === undefined
              ? undefined
              : scenePosition(sunGuideFocusState.positionM);
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
          const sunProjected = sunPosition.clone().project(camera);
          const rawSunScreen = {
            x: ((sunProjected.x + 1) * viewportWidth) / 2,
            y: ((-sunProjected.y + 1) * viewportHeight) / 2,
          };
          const sunCameraPosition = sunPosition
            .clone()
            .applyMatrix4(camera.matrixWorldInverse);
          const sunInFront = sunCameraPosition.z < -camera.near;
          const sunOnScreen =
            sunInFront &&
            sunProjected.z >= -1 &&
            sunProjected.z <= 1 &&
            pointInsideViewport(
              rawSunScreen,
              viewportWidth,
              viewportHeight,
              viewportMargin,
            );
          let location: "behind" | "off-screen" | "on-screen" = "on-screen";
          let endpoint = rawSunScreen;
          if (!sunOnScreen) {
            location = sunInFront ? "off-screen" : "behind";
            let direction = sunInFront
              ? {
                  x: rawSunScreen.x - guideOrigin.x,
                  y: rawSunScreen.y - guideOrigin.y,
                }
              : { x: sunCameraPosition.x, y: -sunCameraPosition.y };
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
          const hasFocusToSunLine =
            focusPosition !== undefined && sunGuideFocusId !== "sun";
          sunGuideLine.style.display = hasFocusToSunLine ? "" : "none";
          if (hasFocusToSunLine) {
            sunGuideLine.setAttribute("x1", String(guideOrigin.x));
            sunGuideLine.setAttribute("y1", String(guideOrigin.y));
            sunGuideLine.setAttribute("x2", String(endpoint.x));
            sunGuideLine.setAttribute("y2", String(endpoint.y));
          }
          sunGuideEndpoint.setAttribute("cx", String(endpoint.x));
          sunGuideEndpoint.setAttribute("cy", String(endpoint.y));
          const distanceAu =
            focusPosition === undefined
              ? undefined
              : focusPosition.distanceTo(sunPosition);
          const distanceLabel =
            distanceAu === undefined || sunGuideFocusId === "sun"
              ? ""
              : ` · ${formatTacticalDistance(distanceAu)}`;
          const locationLabel = location === "behind" ? " behind view" : "";
          sunGuideLabel.textContent = `Sun${locationLabel}${distanceLabel}`;
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
          const labelY = Math.min(
            viewportHeight - 30,
            Math.max(30, endpoint.y),
          );
          sunGuideLabel.style.transform = `translate(${String(labelX)}px, ${String(labelY)}px)`;
          sunGuideOverlay.style.display = "";
          sunGuideLabel.hidden = false;
          container.dataset["sunGuideVisible"] = "true";
          container.dataset["sunGuideLocation"] = location;
          container.dataset["sunGuideDistanceAu"] =
            distanceAu === undefined ? "unavailable" : distanceAu.toFixed(8);
          container.dataset["sunGuideLineVisible"] = String(hasFocusToSunLine);
          container.dataset["sunGuideEndpointX"] = endpoint.x.toFixed(2);
          container.dataset["sunGuideEndpointY"] = endpoint.y.toFixed(2);
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
        tacticalFocusId === ISS_BODY_ID
          ? issGroup
          : tacticalFocusId === null
            ? undefined
            : bodyMeshes.get(tacticalFocusId);
      const semanticCameraDistance =
        semanticFocusMesh === undefined
          ? Number.POSITIVE_INFINITY
          : camera.position.distanceTo(semanticFocusMesh.position) /
            camera.zoom;
      const semanticPhysicalRadiusAu =
        tacticalFocusId === ISS_BODY_ID
          ? ISS_BOUNDING_RADIUS_M / ASTRONOMICAL_UNIT_M
          : semanticFocusDefinition === undefined
            ? 0
            : semanticFocusDefinition.meanRadiusM / ASTRONOMICAL_UNIT_M;
      const semanticZoomLevel =
        tacticalFocusId === ISS_BODY_ID
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
        const isOverviewPlanet =
          (focusBodyIdRef.current === null ||
            focusBodyIdRef.current === "sun") &&
          (body.type === "planet" || body.type === "dwarf-planet");
        const focusedBodyId = focusBodyIdRef.current;
        const isCameraTarget = body.id === cameraTargetBodyIdRef.current;
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
          body.id === focusBodyIdRef.current,
        );
        label.classList.toggle("is-camera-target", isCameraTarget);
        label.setAttribute(
          "aria-pressed",
          String(body.id === focusBodyIdRef.current),
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
              body.id === focusBodyIdRef.current,
            );
            marker.style.transform = `translate(${String(projectedLabelX)}px, ${String(projectedLabelY)}px)`;
          }
        }
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
          focusBodyIdRef.current === ISS_BODY_ID,
        );
        issLabel.setAttribute(
          "aria-pressed",
          String(focusBodyIdRef.current === ISS_BODY_ID),
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
          focusedKnownMoonLabel.setAttribute("aria-pressed", "true");
          focusedKnownMoonLabel.style.transform = `translate(${String(((projected.x + 1) * container.clientWidth) / 2)}px, ${String(((-projected.y + 1) * container.clientHeight) / 2)}px)`;
          visibleLabelCount += 1;
        }
      } else {
        focusedKnownMoonLabel.hidden = true;
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
    render();

    return () => {
      active = false;
      snapshotAbortController.abort();
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      controls.removeEventListener("start", handleControlStart);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      gpuLayer?.dispose();
      gravityWellLayer.dispose();
      renderer.dispose();
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
      container.removeChild(focusBracket);
      container.removeChild(sunGuideLabel);
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
      data-star-field-count={hipparcosStarSnapshot.stars.length}
      data-star-catalogue="ESA Hipparcos I/239"
      data-star-reference-frame="ICRS"
      data-surface-lighting="solar-point-light"
      data-atmosphere-rendering="fresnel-rim"
    >
      {gravityWellMode === "off" ? null : (
        <span className="gravity-field-legend" aria-hidden="true">
          <strong>Newtonian potential</strong>
          <span data-gravity-potential-range>Calculating J/kg range...</span>
          <small>Combined field · logarithmic display</small>
        </span>
      )}
    </div>
  );
}
