import { Matrix4, PerspectiveCamera } from "three";

import type { SbdbSnapshot } from "../catalogue/sbdb";
import { J2000_MEAN_OBLIQUITY_RAD } from "./reference-frames";
import {
  categoryVisibilityFraction,
  smallBodyLevelOfDetail,
} from "./small-body-lod";
import {
  propagateSmallBodyPositionAu,
  readSmallBodyOrbitRecord,
} from "./small-body-propagation";

const COMPUTE_WORKGROUP_SIZE = 256;
const POSITION_STRIDE_BYTES = 16;
const MINIMUM_CATEGORY_CATALOGUE_SAMPLES = 1_024;
const MAXIMUM_DENSITY_RENDER_WIDTH = 1_920;
const MAXIMUM_FALLBACK_CATEGORY_DRAW_COUNT = 50_000;
const J2000_OBLIQUITY_COSINE = Math.cos(J2000_MEAN_OBLIQUITY_RAD);
const J2000_OBLIQUITY_SINE = Math.sin(J2000_MEAN_OBLIQUITY_RAD);

function greatestCommonDivisor(left: number, right: number): number {
  let first = left;
  let second = right;
  while (second !== 0) {
    const remainder = first % second;
    first = second;
    second = remainder;
  }
  return first;
}

function permutationStep(count: number): number {
  if (count <= 1) {
    return 1;
  }
  let step = Math.max(1, Math.floor(count * 0.618_033_988_749_894_8));
  while (greatestCommonDivisor(step, count) !== 1) {
    step += 1;
  }
  return step;
}

function createRenderIndexBuffer(
  device: GPUDevice,
  snapshot: SbdbSnapshot,
): GPUBuffer {
  const { asteroids, comets, total } = snapshot.manifest.counts;
  const asteroidIndices = new Uint32Array(asteroids);
  const cometIndices = new Uint32Array(comets);
  let asteroidCursor = 0;
  let cometCursor = 0;
  for (let index = 0; index < total; index += 1) {
    const record = readSmallBodyOrbitRecord(snapshot.orbitalRecords, index);
    if ((record.flags & 2) === 0) {
      asteroidIndices[asteroidCursor] = index;
      asteroidCursor += 1;
    } else {
      cometIndices[cometCursor] = index;
      cometCursor += 1;
    }
  }
  if (asteroidCursor !== asteroids || cometCursor !== comets) {
    throw new Error("Small-body category counts do not match the snapshot");
  }

  const indexBuffer = device.createBuffer({
    label: "Deterministically permuted small-body render indices",
    size: total * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  const renderIndices = new Uint32Array(indexBuffer.getMappedRange());
  const asteroidStep = permutationStep(asteroids);
  const cometStep = permutationStep(comets);
  for (let outputIndex = 0; outputIndex < asteroids; outputIndex += 1) {
    renderIndices[outputIndex] =
      asteroidIndices[(outputIndex * asteroidStep) % asteroids] ?? 0;
  }
  for (let outputIndex = 0; outputIndex < comets; outputIndex += 1) {
    renderIndices[asteroids + outputIndex] =
      cometIndices[(outputIndex * cometStep) % comets] ?? 0;
  }
  indexBuffer.unmap();
  return indexBuffer;
}

function densityRenderSize(canvas: HTMLCanvasElement): Readonly<{
  width: number;
  height: number;
}> {
  const clientWidth = Math.max(1, canvas.clientWidth);
  const clientHeight = Math.max(1, canvas.clientHeight);
  const width = Math.max(
    1,
    Math.min(Math.floor(clientWidth), MAXIMUM_DENSITY_RENDER_WIDTH),
  );
  return {
    width,
    height: Math.max(1, Math.floor((width * clientHeight) / clientWidth)),
  };
}

const COMPUTE_SHADER = /* wgsl */ `
struct OrbitRecord {
  semiMajorAxisAu: f32,
  eccentricity: f32,
  perihelionAu: f32,
  inclinationRad: f32,
  ascendingNodeRad: f32,
  argumentPerihelionRad: f32,
  meanAnomalyAtReferenceRad: f32,
  meanMotionRadPerDay: f32,
  spkId: u32,
  flags: u32,
  sourceEpochDeltaDays: f32,
  sourceIndex: u32,
}

struct SimulationUniforms {
  elapsedDays: f32,
  objectCount: u32,
  sunXAu: f32,
  sunYAu: f32,
  sunZAu: f32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
}

@group(0) @binding(0) var<storage, read> orbits: array<OrbitRecord>;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> simulation: SimulationUniforms;

fn wrapPi(value: f32) -> f32 {
  let twoPi = 6.283185307179586;
  return value - round(value / twoPi) * twoPi;
}

fn accurateSin(value: f32) -> f32 {
  var x = wrapPi(value);
  if (x > 1.5707963267948966) {
    x = 3.141592653589793 - x;
  } else if (x < -1.5707963267948966) {
    x = -3.141592653589793 - x;
  }
  let x2 = x * x;
  return x * (1.0 + x2 * (
    -0.16666666666666666 + x2 * (
      0.008333333333333333 + x2 * (
        -0.0001984126984126984 + x2 * (
          0.0000027557319223985893 + x2 * -0.00000002505210838544172
        )
      )
    )
  ));
}

fn accurateCos(value: f32) -> f32 {
  return accurateSin(value + 1.5707963267948966);
}

fn accurateExp(value: f32) -> f32 {
  let exponent = i32(round(value / 0.6931471805599453));
  let remainder = value - f32(exponent) * 0.6931471805599453;
  let polynomial = 1.0 + remainder * (
    1.0 + remainder * (
      0.5 + remainder * (
        0.16666666666666666 + remainder * (
          0.041666666666666664 + remainder * (
            0.008333333333333333 + remainder * 0.001388888888888889
          )
        )
      )
    )
  );
  return ldexp(polynomial, exponent);
}

fn accurateSinh(value: f32) -> f32 {
  return 0.5 * (accurateExp(value) - accurateExp(-value));
}

fn accurateCosh(value: f32) -> f32 {
  return 0.5 * (accurateExp(value) + accurateExp(-value));
}

fn solveElliptic(meanAnomaly: f32, eccentricity: f32) -> f32 {
  var eccentricAnomaly = meanAnomaly;
  if (eccentricity > 0.8) {
    let direction = select(-0.85, 0.85, meanAnomaly >= 0.0);
    eccentricAnomaly = meanAnomaly + direction * eccentricity;
  }
  for (var iteration = 0u; iteration < 10u; iteration += 1u) {
    let residual = eccentricAnomaly - eccentricity * accurateSin(eccentricAnomaly) - meanAnomaly;
    if (abs(residual) <= 0.0000001) {
      break;
    }
    let derivative = 1.0 - eccentricity * accurateCos(eccentricAnomaly);
    eccentricAnomaly -= residual / derivative;
  }
  return eccentricAnomaly;
}

fn solveHyperbolic(meanAnomaly: f32, eccentricity: f32) -> f32 {
  var hyperbolicAnomaly = asinh(meanAnomaly / eccentricity);
  if (eccentricity < 1.1 && meanAnomaly != 0.0) {
    hyperbolicAnomaly = sign(meanAnomaly) * pow(
      6.0 * abs(meanAnomaly) / eccentricity,
      0.3333333333333333,
    );
  }
  for (var iteration = 0u; iteration < 12u; iteration += 1u) {
    let residual = eccentricity * accurateSinh(hyperbolicAnomaly) - hyperbolicAnomaly - meanAnomaly;
    if (abs(residual) <= 0.0000001) {
      break;
    }
    let derivative = eccentricity * accurateCosh(hyperbolicAnomaly) - 1.0;
    hyperbolicAnomaly -= residual / derivative;
  }
  return hyperbolicAnomaly;
}

fn rotateFromOrbitalPlane(
  orbitalPosition: vec2<f32>,
  inclination: f32,
  ascendingNode: f32,
  argumentPerihelion: f32,
) -> vec3<f32> {
  let cosNode = accurateCos(ascendingNode);
  let sinNode = accurateSin(ascendingNode);
  let cosArgument = accurateCos(argumentPerihelion);
  let sinArgument = accurateSin(argumentPerihelion);
  let cosInclination = accurateCos(inclination);
  let sinInclination = accurateSin(inclination);
  let x =
    (cosNode * cosArgument - sinNode * sinArgument * cosInclination) * orbitalPosition.x +
    (-cosNode * sinArgument - sinNode * cosArgument * cosInclination) * orbitalPosition.y;
  let y =
    (sinNode * cosArgument + cosNode * sinArgument * cosInclination) * orbitalPosition.x +
    (-sinNode * sinArgument + cosNode * cosArgument * cosInclination) * orbitalPosition.y;
  let z = sinArgument * sinInclination * orbitalPosition.x +
    cosArgument * sinInclination * orbitalPosition.y;
  let icrfY = ${J2000_OBLIQUITY_COSINE.toPrecision(12)} * y -
    ${J2000_OBLIQUITY_SINE.toPrecision(12)} * z;
  let icrfZ = ${J2000_OBLIQUITY_SINE.toPrecision(12)} * y +
    ${J2000_OBLIQUITY_COSINE.toPrecision(12)} * z;
  return vec3<f32>(x, icrfZ, -icrfY);
}

@compute @workgroup_size(${String(COMPUTE_WORKGROUP_SIZE)})
fn propagate(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let index = invocation.x;
  if (index >= simulation.objectCount) {
    return;
  }
  let orbit = orbits[index];
  if ((orbit.flags & 1u) == 0u || abs(orbit.eccentricity - 1.0) <= 0.00001) {
    positions[index] = vec4<f32>(0.0, 0.0, 0.0, -1.0);
    return;
  }

  let meanAnomaly = orbit.meanAnomalyAtReferenceRad +
    orbit.meanMotionRadPerDay * simulation.elapsedDays;
  var orbitalPosition: vec2<f32>;
  if (orbit.eccentricity < 1.0) {
    let wrappedMeanAnomaly = wrapPi(meanAnomaly);
    let eccentricAnomaly = solveElliptic(wrappedMeanAnomaly, orbit.eccentricity);
    orbitalPosition = vec2<f32>(
      orbit.semiMajorAxisAu * (accurateCos(eccentricAnomaly) - orbit.eccentricity),
      orbit.semiMajorAxisAu * sqrt(1.0 - orbit.eccentricity * orbit.eccentricity) * accurateSin(eccentricAnomaly),
    );
  } else {
    let hyperbolicAnomaly = solveHyperbolic(meanAnomaly, orbit.eccentricity);
    orbitalPosition = vec2<f32>(
      orbit.perihelionAu + orbit.semiMajorAxisAu * (accurateCosh(hyperbolicAnomaly) - 1.0),
      -orbit.semiMajorAxisAu * sqrt(orbit.eccentricity * orbit.eccentricity - 1.0) * accurateSinh(hyperbolicAnomaly),
    );
  }

  let heliocentricPosition = rotateFromOrbitalPlane(
    orbitalPosition,
    orbit.inclinationRad,
    orbit.ascendingNodeRad,
    orbit.argumentPerihelionRad,
  );
  let worldPosition = heliocentricPosition + vec3<f32>(
    simulation.sunXAu,
    simulation.sunZAu,
    -simulation.sunYAu,
  );
  let kind = select(0.0, 1.0, (orbit.flags & 2u) != 0u);
  positions[index] = vec4<f32>(worldPosition, kind);
}
`;

const RENDER_SHADER = /* wgsl */ `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  asteroidVisibilityFraction: f32,
  cometVisibilityFraction: f32,
  pointOpacity: f32,
  showAsteroids: u32,
  showComets: u32,
  focusCenter: vec3<f32>,
  focusRadiusAu: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) kind: f32,
  @location(1) opacity: f32,
}

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let body = positions[vertexIndex];
  let categoryVisible = select(
    camera.showAsteroids != 0u,
    camera.showComets != 0u,
    body.w > 0.5,
  );
  var output: VertexOutput;
  if (
    body.w < 0.0 ||
    !categoryVisible ||
    (camera.focusRadiusAu > 0.0 && distance(body.xyz, camera.focusCenter) > camera.focusRadiusAu)
  ) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    output.kind = -1.0;
    output.opacity = 0.0;
  } else {
    output.position = camera.viewProjection * vec4<f32>(body.xyz, 1.0);
    output.kind = body.w;
    output.opacity = camera.pointOpacity;
  }
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.kind < 0.0) {
    discard;
  }
  if (input.kind > 0.5) {
    return vec4<f32>(0.45, 0.82, 1.0, input.opacity);
  }
  return vec4<f32>(0.92, 0.84, 0.62, input.opacity);
}
`;

const TRAIL_FADE_SHADER = /* wgsl */ `
struct FadeUniforms {
  opacity: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
}

@group(0) @binding(0) var<uniform> fade: FadeUniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  return vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
  return vec4<f32>(0.008, 0.012, 0.04, fade.opacity);
}
`;

export type SmallBodyGpuStatus = Readonly<{
  renderer: string;
  loadedObjects: number;
  integrableObjects: number;
  unavailableObjects: number;
  asteroids: number;
  comets: number;
  retrievedAt: string;
  validatedSamplePositions: number;
  validatedNearPositions: number;
  validatedAuthorityPositions: number;
  validatedRenderPixels: number;
}>;

type PositionSampleValidation = Readonly<{
  finitePositions: number;
  nearPositions: number;
}>;

export class SmallBodyGpuLayer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: GPUCanvasContext;
  readonly #gpu: GPU;
  readonly #adapter: GPUAdapter;
  readonly #device: GPUDevice;
  readonly #computePipeline: GPUComputePipeline;
  readonly #renderPipeline: GPURenderPipeline;
  readonly #trailFadePipeline: GPURenderPipeline;
  readonly #computeBindGroup: GPUBindGroup;
  readonly #renderBindGroup: GPUBindGroup;
  readonly #trailFadeBindGroup: GPUBindGroup;
  readonly #simulationUniformBuffer: GPUBuffer;
  readonly #cameraUniformBuffer: GPUBuffer;
  readonly #trailFadeUniformBuffer: GPUBuffer;
  readonly #positionBuffer: GPUBuffer;
  readonly #renderIndexBuffer: GPUBuffer;
  readonly #objectCount: number;
  readonly #asteroidCount: number;
  readonly #cometCount: number;
  readonly #maximumCategoryDrawCount: number;
  readonly #format: GPUTextureFormat;
  readonly #viewProjection = new Matrix4();
  readonly #lastRenderedViewProjection = new Float32Array(16).fill(Number.NaN);
  #renderTarget: GPUTexture;
  #disposed = false;
  #lastElapsedSeconds: number | undefined;
  #lastSunXAu = Number.NaN;
  #lastSunYAu = Number.NaN;
  #lastSunZAu = Number.NaN;
  #positionRevision = 0;
  #lastRenderedPositionRevision = -1;
  #showAsteroids = true;
  #showComets = true;
  #categoryRevision = 0;
  #lastRenderedCategoryRevision = -1;
  #focusCenterXAu = 0;
  #focusCenterYAu = 0;
  #focusCenterZAu = 0;
  #focusRadiusAu = 0;
  #focusRevision = 0;
  #lastRenderedFocusRevision = -1;
  #minorBodyTrailsEnabled = false;
  #trailDurationSeconds = 365 * 86_400;
  #trailFade = 0.85;
  #trailClearToken = 0;
  #historyValid = false;
  #lastTrailTimeSeconds: number | undefined;

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    gpu: GPU,
    adapter: GPUAdapter,
    device: GPUDevice,
    computePipeline: GPUComputePipeline,
    renderPipeline: GPURenderPipeline,
    trailFadePipeline: GPURenderPipeline,
    computeBindGroup: GPUBindGroup,
    renderBindGroup: GPUBindGroup,
    trailFadeBindGroup: GPUBindGroup,
    simulationUniformBuffer: GPUBuffer,
    cameraUniformBuffer: GPUBuffer,
    trailFadeUniformBuffer: GPUBuffer,
    positionBuffer: GPUBuffer,
    renderIndexBuffer: GPUBuffer,
    objectCount: number,
    asteroidCount: number,
    cometCount: number,
    maximumCategoryDrawCount: number,
    format: GPUTextureFormat,
    renderTarget: GPUTexture,
  ) {
    this.#canvas = canvas;
    this.#context = context;
    this.#gpu = gpu;
    this.#adapter = adapter;
    this.#device = device;
    this.#computePipeline = computePipeline;
    this.#renderPipeline = renderPipeline;
    this.#trailFadePipeline = trailFadePipeline;
    this.#computeBindGroup = computeBindGroup;
    this.#renderBindGroup = renderBindGroup;
    this.#trailFadeBindGroup = trailFadeBindGroup;
    this.#simulationUniformBuffer = simulationUniformBuffer;
    this.#cameraUniformBuffer = cameraUniformBuffer;
    this.#trailFadeUniformBuffer = trailFadeUniformBuffer;
    this.#positionBuffer = positionBuffer;
    this.#renderIndexBuffer = renderIndexBuffer;
    this.#objectCount = objectCount;
    this.#asteroidCount = asteroidCount;
    this.#cometCount = cometCount;
    this.#maximumCategoryDrawCount = maximumCategoryDrawCount;
    this.#format = format;
    this.#renderTarget = renderTarget;
  }

  public static async create(
    canvas: HTMLCanvasElement,
    snapshot: SbdbSnapshot,
    onDeviceError: (message: string) => void,
  ): Promise<
    Readonly<{ layer: SmallBodyGpuLayer; status: SmallBodyGpuStatus }>
  > {
    const gpuValue: unknown = Reflect.get(navigator, "gpu");
    if (gpuValue === undefined) {
      throw new Error("WebGPU is unavailable in this browser");
    }
    const gpu = gpuValue as GPU;
    const adapter = await gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (adapter === null) {
      throw new Error("No local WebGPU adapter is available");
    }

    const inputBytes = snapshot.orbitalRecords.byteLength;
    const outputBytes = snapshot.manifest.counts.total * POSITION_STRIDE_BYTES;
    if (
      inputBytes > adapter.limits.maxStorageBufferBindingSize ||
      outputBytes > adapter.limits.maxStorageBufferBindingSize ||
      Math.max(inputBytes, outputBytes) > adapter.limits.maxBufferSize
    ) {
      throw new Error(
        `Local GPU buffer limits cannot hold the ${String(snapshot.manifest.counts.total)}-object NASA/JPL snapshot`,
      );
    }

    const device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: Math.max(inputBytes, outputBytes),
        maxStorageBufferBindingSize: Math.max(inputBytes, outputBytes),
      },
    });
    const renderSize = densityRenderSize(canvas);
    canvas.width = renderSize.width;
    canvas.height = renderSize.height;
    const context = canvas.getContext("webgpu");
    if (context === null) {
      device.destroy();
      throw new Error("WebGPU presentation canvas is unavailable");
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "opaque",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
    });

    const orbitBuffer = device.createBuffer({
      label: "NASA/JPL SBDB orbital records",
      size: inputBytes,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Uint8Array(orbitBuffer.getMappedRange()).set(
      new Uint8Array(snapshot.orbitalRecords),
    );
    orbitBuffer.unmap();
    const positionBuffer = device.createBuffer({
      label: "GPU-propagated small-body positions",
      size: outputBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const renderIndexBuffer = createRenderIndexBuffer(device, snapshot);
    const simulationUniformBuffer = device.createBuffer({
      label: "Small-body simulation time",
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cameraUniformBuffer = device.createBuffer({
      label: "Small-body view-projection matrix",
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const trailFadeUniformBuffer = device.createBuffer({
      label: "Small-body trail fade",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const computePipeline = await device.createComputePipelineAsync({
      label: "Two-body Kepler propagation",
      layout: "auto",
      compute: {
        module: device.createShaderModule({
          label: "Small-body propagation shader",
          code: COMPUTE_SHADER,
        }),
        entryPoint: "propagate",
      },
    });
    const renderPipeline = await device.createRenderPipelineAsync({
      label: "Small-body point renderer",
      layout: "auto",
      vertex: {
        module: device.createShaderModule({
          label: "Small-body render shader",
          code: RENDER_SHADER,
        }),
        entryPoint: "vertexMain",
      },
      fragment: {
        module: device.createShaderModule({ code: RENDER_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "point-list" },
    });
    const trailFadePipeline = await device.createRenderPipelineAsync({
      label: "GPU trail fade",
      layout: "auto",
      vertex: {
        module: device.createShaderModule({ code: TRAIL_FADE_SHADER }),
        entryPoint: "vertexMain",
      },
      fragment: {
        module: device.createShaderModule({ code: TRAIL_FADE_SHADER }),
        entryPoint: "fragmentMain",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
    const computeBindGroup = device.createBindGroup({
      label: "Small-body compute resources",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: orbitBuffer } },
        { binding: 1, resource: { buffer: positionBuffer } },
        { binding: 2, resource: { buffer: simulationUniformBuffer } },
      ],
    });
    const renderBindGroup = device.createBindGroup({
      label: "Small-body render resources",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: positionBuffer } },
        { binding: 1, resource: { buffer: cameraUniformBuffer } },
      ],
    });
    const trailFadeBindGroup = device.createBindGroup({
      label: "Small-body trail fade resources",
      layout: trailFadePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: trailFadeUniformBuffer } }],
    });
    const renderTarget = device.createTexture({
      label: "Small-body GPU trail accumulation",
      size: renderSize,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const layer = new SmallBodyGpuLayer(
      canvas,
      context,
      gpu,
      adapter,
      device,
      computePipeline,
      renderPipeline,
      trailFadePipeline,
      computeBindGroup,
      renderBindGroup,
      trailFadeBindGroup,
      simulationUniformBuffer,
      cameraUniformBuffer,
      trailFadeUniformBuffer,
      positionBuffer,
      renderIndexBuffer,
      snapshot.manifest.counts.total,
      snapshot.manifest.counts.asteroids,
      snapshot.manifest.counts.comets,
      adapter.info.isFallbackAdapter
        ? MAXIMUM_FALLBACK_CATEGORY_DRAW_COUNT
        : Number.MAX_SAFE_INTEGER,
      format,
      renderTarget,
    );
    void device.lost.then((information) => {
      if (!layer.#disposed) {
        onDeviceError(
          `WebGPU device lost (${information.reason}): ${information.message || "no device message"}`,
        );
      }
    });
    const validatedAuthorityPositions =
      await layer.validateAuthoritativePositions(snapshot);
    layer.setTimeSeconds(0, [0, 0, 0]);
    const positionValidation = await layer.validatePositionSample();
    const adapterName =
      layer.#adapter.info.description ||
      layer.#adapter.info.device ||
      `${layer.#gpu.getPreferredCanvasFormat()} WebGPU adapter`;
    return {
      layer,
      status: {
        renderer: adapterName,
        loadedObjects: snapshot.manifest.counts.total,
        integrableObjects: snapshot.manifest.counts.integrable,
        unavailableObjects: snapshot.manifest.counts.unavailableForSimulation,
        asteroids: snapshot.manifest.counts.asteroids,
        comets: snapshot.manifest.counts.comets,
        retrievedAt: snapshot.manifest.retrievedAt,
        validatedSamplePositions: positionValidation.finitePositions,
        validatedNearPositions: positionValidation.nearPositions,
        validatedAuthorityPositions,
        validatedRenderPixels: 0,
      },
    };
  }

  public setTimeSeconds(
    elapsedSeconds: number,
    sunPositionAu: readonly [number, number, number],
  ): void {
    const unchangedSunPosition =
      sunPositionAu[0] === this.#lastSunXAu &&
      sunPositionAu[1] === this.#lastSunYAu &&
      sunPositionAu[2] === this.#lastSunZAu;
    if (
      !Number.isFinite(elapsedSeconds) ||
      (elapsedSeconds === this.#lastElapsedSeconds && unchangedSunPosition)
    ) {
      return;
    }
    const uniforms = new ArrayBuffer(32);
    const view = new DataView(uniforms);
    view.setFloat32(0, elapsedSeconds / 86_400, true);
    view.setUint32(4, this.#objectCount, true);
    view.setFloat32(8, sunPositionAu[0], true);
    view.setFloat32(12, sunPositionAu[1], true);
    view.setFloat32(16, sunPositionAu[2], true);
    this.#device.queue.writeBuffer(this.#simulationUniformBuffer, 0, uniforms);
    const encoder = this.#device.createCommandEncoder({
      label: "Small-body propagation commands",
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.#computePipeline);
    pass.setBindGroup(0, this.#computeBindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this.#objectCount / COMPUTE_WORKGROUP_SIZE),
    );
    pass.end();
    this.#device.queue.submit([encoder.finish()]);
    this.#lastElapsedSeconds = elapsedSeconds;
    this.#lastSunXAu = sunPositionAu[0];
    this.#lastSunYAu = sunPositionAu[1];
    this.#lastSunZAu = sunPositionAu[2];
    this.#positionRevision += 1;
  }

  public setCategoryVisibility(
    showAsteroids: boolean,
    showComets: boolean,
  ): void {
    if (
      showAsteroids === this.#showAsteroids &&
      showComets === this.#showComets
    ) {
      return;
    }
    this.#showAsteroids = showAsteroids;
    this.#showComets = showComets;
    this.#categoryRevision += 1;
  }

  public setFocusRegion(
    centerAu: readonly [number, number, number] | null,
    radiusAu: number,
  ): void {
    if (!Number.isFinite(radiusAu) || radiusAu < 0) {
      throw new Error(
        "Small-body focus radius must be finite and non-negative",
      );
    }
    const x = centerAu?.[0] ?? 0;
    const y = centerAu?.[1] ?? 0;
    const z = centerAu?.[2] ?? 0;
    const effectiveRadius = centerAu === null ? 0 : radiusAu;
    if (
      x === this.#focusCenterXAu &&
      y === this.#focusCenterYAu &&
      z === this.#focusCenterZAu &&
      effectiveRadius === this.#focusRadiusAu
    ) {
      return;
    }
    this.#focusCenterXAu = x;
    this.#focusCenterYAu = y;
    this.#focusCenterZAu = z;
    this.#focusRadiusAu = effectiveRadius;
    this.#focusRevision += 1;
  }

  public setTrailSettings(
    enabled: boolean,
    durationSeconds: number,
    fade: number,
    clearToken: number,
  ): void {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error("Small-body trail duration must be positive and finite");
    }
    if (!Number.isFinite(fade) || fade < 0 || fade > 1) {
      throw new Error("Small-body trail fade must be between zero and one");
    }
    const changed =
      enabled !== this.#minorBodyTrailsEnabled ||
      durationSeconds !== this.#trailDurationSeconds ||
      fade !== this.#trailFade ||
      clearToken !== this.#trailClearToken;
    if (!changed) {
      return;
    }
    const resetHistory =
      !enabled ||
      clearToken !== this.#trailClearToken ||
      durationSeconds !== this.#trailDurationSeconds;
    this.#minorBodyTrailsEnabled = enabled;
    this.#trailDurationSeconds = durationSeconds;
    this.#trailFade = fade;
    this.#trailClearToken = clearToken;
    if (resetHistory) {
      this.#historyValid = false;
      this.#lastTrailTimeSeconds = undefined;
    }
    this.#categoryRevision += 1;
  }

  public render(camera: PerspectiveCamera): void {
    if (this.#disposed) {
      return;
    }
    const resized = this.#resizeCanvas();
    camera.updateMatrixWorld();
    this.#viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const viewProjectionElements = this.#viewProjection.elements;
    const cameraChanged = viewProjectionElements.some(
      (value, index) => value !== this.#lastRenderedViewProjection[index],
    );
    if (
      !resized &&
      !cameraChanged &&
      this.#lastRenderedPositionRevision === this.#positionRevision &&
      this.#lastRenderedCategoryRevision === this.#categoryRevision &&
      this.#lastRenderedFocusRevision === this.#focusRevision
    ) {
      return;
    }
    const cameraUniforms = new ArrayBuffer(112);
    new Float32Array(cameraUniforms, 0, 16).set(viewProjectionElements);
    const levelOfDetail = smallBodyLevelOfDetail(camera.position.length());
    const asteroidVisibilityFraction = categoryVisibilityFraction(
      levelOfDetail.visibilityFraction,
      this.#asteroidCount,
      MINIMUM_CATEGORY_CATALOGUE_SAMPLES,
    );
    const cometVisibilityFraction = categoryVisibilityFraction(
      levelOfDetail.visibilityFraction,
      this.#cometCount,
      MINIMUM_CATEGORY_CATALOGUE_SAMPLES,
    );
    const asteroidDrawCount = Math.min(
      this.#maximumCategoryDrawCount,
      Math.ceil(this.#asteroidCount * asteroidVisibilityFraction),
    );
    const cometDrawCount = Math.min(
      this.#maximumCategoryDrawCount,
      Math.ceil(this.#cometCount * cometVisibilityFraction),
    );
    const cameraUniformView = new DataView(cameraUniforms);
    cameraUniformView.setFloat32(64, asteroidVisibilityFraction, true);
    cameraUniformView.setFloat32(68, cometVisibilityFraction, true);
    cameraUniformView.setFloat32(72, levelOfDetail.pointOpacity, true);
    cameraUniformView.setUint32(76, this.#showAsteroids ? 1 : 0, true);
    cameraUniformView.setUint32(80, this.#showComets ? 1 : 0, true);
    cameraUniformView.setFloat32(96, this.#focusCenterXAu, true);
    cameraUniformView.setFloat32(100, this.#focusCenterYAu, true);
    cameraUniformView.setFloat32(104, this.#focusCenterZAu, true);
    cameraUniformView.setFloat32(108, this.#focusRadiusAu, true);
    this.#device.queue.writeBuffer(
      this.#cameraUniformBuffer,
      0,
      cameraUniforms,
    );
    const encoder = this.#device.createCommandEncoder({
      label: "Small-body render commands",
    });
    const retainHistory =
      this.#minorBodyTrailsEnabled &&
      this.#historyValid &&
      !cameraChanged &&
      !resized;
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.#renderTarget.createView(),
          clearValue: { r: 0.008, g: 0.012, b: 0.04, a: 1 },
          loadOp: retainHistory ? "load" : "clear",
          storeOp: "store",
        },
      ],
    });
    const renderedTimeSeconds = this.#lastElapsedSeconds ?? 0;
    if (retainHistory) {
      const elapsedTrailSeconds = Math.abs(
        renderedTimeSeconds -
          (this.#lastTrailTimeSeconds ?? renderedTimeSeconds),
      );
      const retention = Math.exp(
        (-elapsedTrailSeconds / this.#trailDurationSeconds) *
          (0.5 + this.#trailFade * 4),
      );
      this.#device.queue.writeBuffer(
        this.#trailFadeUniformBuffer,
        0,
        new Float32Array([1 - retention, 0, 0, 0]),
      );
      pass.setPipeline(this.#trailFadePipeline);
      pass.setBindGroup(0, this.#trailFadeBindGroup);
      pass.draw(3);
    }
    pass.setPipeline(this.#renderPipeline);
    pass.setBindGroup(0, this.#renderBindGroup);
    pass.setIndexBuffer(this.#renderIndexBuffer, "uint32");
    if (this.#showAsteroids) {
      pass.drawIndexed(asteroidDrawCount);
    }
    if (this.#showComets) {
      pass.drawIndexed(cometDrawCount, 1, this.#asteroidCount);
    }
    pass.end();
    encoder.copyTextureToTexture(
      { texture: this.#renderTarget },
      { texture: this.#context.getCurrentTexture() },
      { width: this.#canvas.width, height: this.#canvas.height },
    );
    this.#device.queue.submit([encoder.finish()]);
    this.#canvas.dataset["presentation"] = "direct-webgpu";
    this.#canvas.dataset["visibilityFraction"] =
      asteroidVisibilityFraction.toFixed(8);
    this.#canvas.dataset["cometVisibilityFraction"] =
      cometVisibilityFraction.toFixed(8);
    this.#canvas.dataset["submittedAsteroids"] = String(asteroidDrawCount);
    this.#canvas.dataset["submittedComets"] = String(cometDrawCount);
    this.#canvas.dataset["pointOpacity"] =
      levelOfDetail.pointOpacity.toFixed(4);
    this.#canvas.dataset["asteroidsVisible"] = String(this.#showAsteroids);
    this.#canvas.dataset["cometsVisible"] = String(this.#showComets);
    this.#canvas.dataset["minorBodyTrails"] = String(
      this.#minorBodyTrailsEnabled,
    );
    this.#lastRenderedViewProjection.set(viewProjectionElements);
    this.#lastRenderedPositionRevision = this.#positionRevision;
    this.#lastRenderedCategoryRevision = this.#categoryRevision;
    this.#lastRenderedFocusRevision = this.#focusRevision;
    this.#historyValid = this.#minorBodyTrailsEnabled;
    this.#lastTrailTimeSeconds = renderedTimeSeconds;
  }

  public dispose(): void {
    this.#disposed = true;
    this.#renderTarget.destroy();
    this.#trailFadeUniformBuffer.destroy();
    this.#device.destroy();
  }

  public async validateAuthoritativePositions(
    snapshot: SbdbSnapshot,
  ): Promise<number> {
    const selectedIndices: number[] = [];
    for (
      let index = 0;
      index < snapshot.manifest.counts.total && selectedIndices.length < 2;
      index += 1
    ) {
      const record = readSmallBodyOrbitRecord(snapshot.orbitalRecords, index);
      const categoryAlreadySelected = selectedIndices.some((selectedIndex) => {
        const selected = readSmallBodyOrbitRecord(
          snapshot.orbitalRecords,
          selectedIndex,
        );
        return selected.eccentricity < 1 === record.eccentricity < 1;
      });
      if (
        (record.flags & 1) !== 0 &&
        Math.abs(record.eccentricity - 1) > 0.000_01 &&
        !categoryAlreadySelected
      ) {
        selectedIndices.push(index);
      }
    }
    if (selectedIndices.length !== 2) {
      throw new Error(
        "NASA/JPL snapshot must contain authoritative elliptic and hyperbolic validation records",
      );
    }
    const validationRecordBytes =
      selectedIndices.length * snapshot.manifest.binary.recordStrideBytes;
    const validationRecords = this.#device.createBuffer({
      label: "Authoritative small-body orbit records",
      size: validationRecordBytes,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    const validationRecordView = new Uint8Array(
      validationRecords.getMappedRange(),
    );
    const sourceRecords = new Uint8Array(snapshot.orbitalRecords);
    for (const [outputIndex, sourceIndex] of selectedIndices.entries()) {
      const sourceOffset =
        sourceIndex * snapshot.manifest.binary.recordStrideBytes;
      validationRecordView.set(
        sourceRecords.subarray(
          sourceOffset,
          sourceOffset + snapshot.manifest.binary.recordStrideBytes,
        ),
        outputIndex * snapshot.manifest.binary.recordStrideBytes,
      );
    }
    validationRecords.unmap();
    const validationPositions = this.#device.createBuffer({
      label: "Authoritative small-body GPU positions",
      size: selectedIndices.length * POSITION_STRIDE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const validationUniforms = this.#device.createBuffer({
      label: "Authoritative small-body simulation time",
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformBytes = new ArrayBuffer(32);
    new DataView(uniformBytes).setUint32(4, selectedIndices.length, true);
    this.#device.queue.writeBuffer(validationUniforms, 0, uniformBytes);
    const validationBindGroup = this.#device.createBindGroup({
      label: "Authoritative small-body validation resources",
      layout: this.#computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: validationRecords } },
        { binding: 1, resource: { buffer: validationPositions } },
        { binding: 2, resource: { buffer: validationUniforms } },
      ],
    });
    const readback = this.#device.createBuffer({
      label: "Authoritative small-body position validation",
      size: selectedIndices.length * POSITION_STRIDE_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.#device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.#computePipeline);
    pass.setBindGroup(0, validationBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(
      validationPositions,
      0,
      readback,
      0,
      selectedIndices.length * POSITION_STRIDE_BYTES,
    );
    this.#device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const actual = new Float32Array(readback.getMappedRange());
    for (const [outputIndex, sourceIndex] of selectedIndices.entries()) {
      const record = readSmallBodyOrbitRecord(
        snapshot.orbitalRecords,
        sourceIndex,
      );
      const expected = propagateSmallBodyPositionAu(record, 0);
      if (expected === undefined) {
        throw new Error("Selected authoritative orbit is not propagatable");
      }
      const offset = outputIndex * 4;
      const errorAu = Math.hypot(
        (actual[offset] ?? Number.NaN) - expected[0],
        (actual[offset + 1] ?? Number.NaN) - expected[1],
        (actual[offset + 2] ?? Number.NaN) - expected[2],
      );
      const allowedErrorAu = Math.max(0.000_01, Math.hypot(...expected) * 1e-5);
      if (!Number.isFinite(errorAu) || errorAu > allowedErrorAu) {
        throw new Error(
          `WebGPU position differs from the authoritative ${record.eccentricity < 1 ? "elliptic" : "hyperbolic"} model by ${String(errorAu)} AU (GPU ${String(actual[offset])}, ${String(actual[offset + 1])}, ${String(actual[offset + 2])}; authority ${expected.map(String).join(", ")})`,
        );
      }
    }
    readback.unmap();
    readback.destroy();
    validationUniforms.destroy();
    validationPositions.destroy();
    validationRecords.destroy();
    return selectedIndices.length;
  }

  public async validatePositionSample(): Promise<PositionSampleValidation> {
    const sampleCount = Math.min(this.#objectCount, 4_096);
    const sampleBytes = sampleCount * POSITION_STRIDE_BYTES;
    const readback = this.#device.createBuffer({
      label: "Small-body propagation validation sample",
      size: sampleBytes,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.#device.createCommandEncoder();
    encoder.copyBufferToBuffer(
      this.#positionBuffer,
      0,
      readback,
      0,
      sampleBytes,
    );
    this.#device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const values = new Float32Array(readback.getMappedRange());
    let finitePositions = 0;
    let nearPositions = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const valueOffset = index * 4;
      const x = values[valueOffset];
      const y = values[valueOffset + 1];
      const z = values[valueOffset + 2];
      const kind = values[valueOffset + 3];
      if (
        x !== undefined &&
        y !== undefined &&
        z !== undefined &&
        kind !== undefined &&
        kind >= 0 &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z)
      ) {
        finitePositions += 1;
        const radiusAu = Math.hypot(x, y, z);
        if (radiusAu >= 0.001 && radiusAu <= 100) {
          nearPositions += 1;
        }
      }
    }
    readback.unmap();
    readback.destroy();
    if (finitePositions === 0) {
      throw new Error(
        "WebGPU propagation produced no finite positions in its validation sample",
      );
    }
    if (nearPositions === 0) {
      throw new Error(
        "WebGPU propagation produced no validation positions within 100 AU",
      );
    }
    return { finitePositions, nearPositions };
  }

  public async validateRenderedFrame(
    camera: PerspectiveCamera,
  ): Promise<number> {
    const width = 512;
    const height = 256;
    const bytesPerRow = width * 4;
    camera.updateMatrixWorld();
    this.#viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const cameraUniforms = new ArrayBuffer(112);
    new Float32Array(cameraUniforms, 0, 16).set(this.#viewProjection.elements);
    const levelOfDetail = smallBodyLevelOfDetail(camera.position.length());
    const asteroidVisibilityFraction = categoryVisibilityFraction(
      levelOfDetail.visibilityFraction,
      this.#asteroidCount,
      MINIMUM_CATEGORY_CATALOGUE_SAMPLES,
    );
    const cometVisibilityFraction = categoryVisibilityFraction(
      levelOfDetail.visibilityFraction,
      this.#cometCount,
      MINIMUM_CATEGORY_CATALOGUE_SAMPLES,
    );
    const asteroidDrawCount = Math.min(
      this.#maximumCategoryDrawCount,
      Math.ceil(this.#asteroidCount * asteroidVisibilityFraction),
    );
    const cometDrawCount = Math.min(
      this.#maximumCategoryDrawCount,
      Math.ceil(this.#cometCount * cometVisibilityFraction),
    );
    const cameraUniformView = new DataView(cameraUniforms);
    cameraUniformView.setFloat32(64, asteroidVisibilityFraction, true);
    cameraUniformView.setFloat32(68, cometVisibilityFraction, true);
    cameraUniformView.setFloat32(72, levelOfDetail.pointOpacity, true);
    cameraUniformView.setUint32(76, 1, true);
    cameraUniformView.setUint32(80, 1, true);
    cameraUniformView.setFloat32(108, 0, true);
    this.#device.queue.writeBuffer(
      this.#cameraUniformBuffer,
      0,
      cameraUniforms,
    );

    const renderTarget = this.#device.createTexture({
      label: "Small-body render validation target",
      size: { width, height },
      format: this.#format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const readback = this.#device.createBuffer({
      label: "Small-body render validation read-back",
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.#device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.#renderPipeline);
    pass.setBindGroup(0, this.#renderBindGroup);
    pass.setIndexBuffer(this.#renderIndexBuffer, "uint32");
    pass.drawIndexed(asteroidDrawCount);
    pass.drawIndexed(cometDrawCount, 1, this.#asteroidCount);
    pass.end();
    encoder.copyTextureToBuffer(
      { texture: renderTarget },
      { buffer: readback, bytesPerRow, rowsPerImage: height },
      { width, height },
    );
    this.#device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const pixels = new Uint8Array(readback.getMappedRange());
    let litPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const first = pixels[offset];
      const second = pixels[offset + 1];
      const third = pixels[offset + 2];
      if (
        first !== undefined &&
        second !== undefined &&
        third !== undefined &&
        Math.max(first, second, third) > 32
      ) {
        litPixels += 1;
      }
    }
    readback.unmap();
    readback.destroy();
    renderTarget.destroy();
    if (litPixels === 0) {
      throw new Error(
        "WebGPU render validation produced no visible small-body pixels",
      );
    }
    return litPixels;
  }

  #resizeCanvas(): boolean {
    const { width, height } = densityRenderSize(this.#canvas);
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#renderTarget.destroy();
      this.#context.configure({
        device: this.#device,
        format: this.#format,
        alphaMode: "opaque",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
      });
      this.#renderTarget = this.#device.createTexture({
        label: "Small-body GPU trail accumulation",
        size: { width, height },
        format: this.#format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      this.#historyValid = false;
      this.#lastTrailTimeSeconds = undefined;
      return true;
    }
    return false;
  }
}
