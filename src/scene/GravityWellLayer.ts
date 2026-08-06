import {
  DoubleSide,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
} from "three";

import {
  gravityPotentialDisplayRange,
  absoluteGravityPotentialDisplayRange,
  gravityWellDisplayDepthAu,
  MAX_GRAVITY_WELL_BODIES,
  validateGravityPotentialSources,
  type GravityPotentialRange,
  type GravityPotentialSource,
  type GravityWellMode,
  type GravityWellScale,
} from "./gravity-potential";

const SUN_GRAVITATIONAL_PARAMETER_M3_S2 = 1.3271244004127942e20;

type GravityWellUniforms = Readonly<{
  bodyPositionRadius: { value: Vector4[] };
  bodyMuRatio: { value: Float32Array };
  bodyCount: { value: number };
  minimumLog2Potential: { value: number };
  maximumLog2Potential: { value: number };
  wellDepthAu: { value: number };
  displayMode: { value: number };
}>;

export type GravityWellUpdate = Readonly<{
  mode: GravityWellMode;
  scale: GravityWellScale;
  centerAu: readonly [number, number, number];
  extentAu: number;
  sources: readonly GravityPotentialSource[];
}>;

export type GravityWellDiagnostics = GravityPotentialRange &
  Readonly<{
    sourceCount: number;
    extentAu: number;
    depthAu: number;
  }>;

export class GravityWellLayer {
  readonly #geometry: PlaneGeometry;
  readonly #material: ShaderMaterial;
  readonly #mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly #uniforms: GravityWellUniforms;
  readonly #planeFirstAxis: Vector3;
  readonly #planeSecondAxis: Vector3;

  public constructor(scene: Scene, eclipticNorth: Vector3) {
    this.#geometry = new PlaneGeometry(1, 1, 192, 192);
    this.#uniforms = {
      bodyPositionRadius: {
        value: Array.from(
          { length: MAX_GRAVITY_WELL_BODIES },
          () => new Vector4(),
        ),
      },
      bodyMuRatio: { value: new Float32Array(MAX_GRAVITY_WELL_BODIES) },
      bodyCount: { value: 0 },
      minimumLog2Potential: { value: 0 },
      maximumLog2Potential: { value: 1 },
      wellDepthAu: { value: 0 },
      displayMode: { value: 0 },
    };
    this.#material = new ShaderMaterial({
      uniforms: this.#uniforms,
      vertexShader: `
        #define MAX_GRAVITY_BODIES ${String(MAX_GRAVITY_WELL_BODIES)}

        uniform vec4 bodyPositionRadius[MAX_GRAVITY_BODIES];
        uniform float bodyMuRatio[MAX_GRAVITY_BODIES];
        uniform int bodyCount;
        uniform float minimumLog2Potential;
        uniform float maximumLog2Potential;
        uniform float wellDepthAu;
        uniform float displayMode;

        varying float vDisplayPotential;
        varying vec3 vWorldPosition;

        float potentialMagnitude(vec3 samplePosition) {
          float potential = 0.0;
          for (int index = 0; index < MAX_GRAVITY_BODIES; index += 1) {
            if (index >= bodyCount) {
              break;
            }
            vec4 source = bodyPositionRadius[index];
            float distanceAu = max(distance(samplePosition, source.xyz), source.w);
            potential += bodyMuRatio[index] / distanceAu;
          }
          return potential;
        }

        void main() {
          vec4 undisplacedWorld = modelMatrix * vec4(position, 1.0);
          float magnitude = max(potentialMagnitude(undisplacedWorld.xyz), 1.0e-30);
          float logPotential = log2(magnitude);
          float range = max(maximumLog2Potential - minimumLog2Potential, 1.0e-6);
          float displayPotential = clamp(
            (logPotential - minimumLog2Potential) / range,
            0.0,
            1.0
          );
          vec3 displacedPosition = position;
          if (displayMode > 1.5) {
            displacedPosition.z = -pow(displayPotential, 1.35) * wellDepthAu;
          }
          vec4 displacedWorld = modelMatrix * vec4(displacedPosition, 1.0);
          vDisplayPotential = displayPotential;
          vWorldPosition = displacedWorld.xyz;
          gl_Position = projectionMatrix * viewMatrix * displacedWorld;
        }
      `,
      fragmentShader: `
        uniform float displayMode;

        varying float vDisplayPotential;
        varying vec3 vWorldPosition;

        void main() {
          float contourCoordinate = vDisplayPotential * 14.0;
          float contourDistance = abs(fract(contourCoordinate) - 0.5);
          float contourWidth = max(fwidth(contourCoordinate) * 0.9, 0.018);
          float contour = 1.0 - smoothstep(0.0, contourWidth, contourDistance);

          vec3 shallowColor = vec3(0.055, 0.23, 0.34);
          vec3 deepColor = vec3(0.28, 0.08, 0.48);
          vec3 contourColor = vec3(0.35, 0.82, 1.0);
          vec3 color = mix(shallowColor, deepColor, pow(vDisplayPotential, 0.72));

          if (displayMode > 1.5) {
            vec3 surfaceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
            float lighting = 0.42 + 0.58 * abs(dot(surfaceNormal, normalize(vec3(0.35, 0.88, 0.31))));
            color *= lighting;
          }
          float contourStrength = displayMode > 1.5 ? 0.38 : 0.72;
          color = mix(color, contourColor, contour * contourStrength);
          float alpha = displayMode > 1.5
            ? 0.3 + contour * 0.18
            : 0.11 + contour * 0.62;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.#mesh = new Mesh(this.#geometry, this.#material);
    this.#mesh.name = "Newtonian combined gravitational potential field";
    this.#mesh.quaternion.setFromUnitVectors(
      new Vector3(0, 0, 1),
      eclipticNorth.clone().normalize(),
    );
    this.#mesh.renderOrder = -5;
    this.#mesh.visible = false;
    this.#planeFirstAxis = new Vector3(1, 0, 0).applyQuaternion(
      this.#mesh.quaternion,
    );
    this.#planeSecondAxis = new Vector3(0, 1, 0).applyQuaternion(
      this.#mesh.quaternion,
    );
    scene.add(this.#mesh);
  }

  public update(update: GravityWellUpdate): GravityWellDiagnostics | undefined {
    if (update.mode === "off") {
      this.#mesh.visible = false;
      this.#uniforms.displayMode.value = 0;
      return undefined;
    }
    validateGravityPotentialSources(update.sources);
    if (!Number.isFinite(update.extentAu) || update.extentAu <= 0) {
      throw new Error("Gravity well extent must be positive and finite");
    }
    const center = new Vector3(...update.centerAu);
    this.#mesh.position.copy(center);
    this.#mesh.scale.set(update.extentAu, update.extentAu, 1);
    const depthAu =
      update.mode === "surface"
        ? gravityWellDisplayDepthAu(update.extentAu)
        : 0;
    this.#uniforms.wellDepthAu.value = depthAu;
    this.#uniforms.displayMode.value = update.mode === "surface" ? 2 : 1;
    this.#uniforms.bodyCount.value = update.sources.length;
    this.#uniforms.bodyMuRatio.value.fill(0);
    for (let index = 0; index < MAX_GRAVITY_WELL_BODIES; index += 1) {
      const uniformPosition = this.#uniforms.bodyPositionRadius.value[index];
      if (uniformPosition === undefined) {
        throw new Error(`Gravity well uniform ${String(index)} is unavailable`);
      }
      const source = update.sources[index];
      if (source === undefined) {
        uniformPosition.set(0, 0, 0, 1);
        continue;
      }
      uniformPosition.set(
        source.positionAu[0],
        source.positionAu[1],
        source.positionAu[2],
        source.radiusAu,
      );
      this.#uniforms.bodyMuRatio.value[index] =
        source.gravitationalParameterM3S2 / SUN_GRAVITATIONAL_PARAMETER_M3_S2;
    }
    const range =
      update.scale === "absolute"
        ? absoluteGravityPotentialDisplayRange()
        : gravityPotentialDisplayRange(
            update.centerAu,
            [
              this.#planeFirstAxis.x,
              this.#planeFirstAxis.y,
              this.#planeFirstAxis.z,
            ],
            [
              this.#planeSecondAxis.x,
              this.#planeSecondAxis.y,
              this.#planeSecondAxis.z,
            ],
            update.extentAu,
            update.sources,
          );
    this.#uniforms.minimumLog2Potential.value = range.minimumLog2SunUnits;
    this.#uniforms.maximumLog2Potential.value = range.maximumLog2SunUnits;
    this.#mesh.visible = true;
    return {
      ...range,
      sourceCount: update.sources.length,
      extentAu: update.extentAu,
      depthAu,
    };
  }

  public dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
