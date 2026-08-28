<script setup>
import { useLoop, useTres } from '@tresjs/core'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
} from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const CLOUD_OPACITY = 0.2
const HOVER_OPACITY = 0.5
const CULL_Y = 7

const OCCLUDER_COLOR = 0xfcf4ee
const OCCLUDER_OUTER = 45
const OCCLUDER_HOLE_W = 0.2
const OCCLUDER_HOLE_BOTTOM = 0.1
const OCCLUDER_HOLE_TOP = 0.95
const OCCLUDER_Z_BIAS = -1

const SCENE_MODELS = [
  {
    src: '/clouds.glb',
    baseRotation: { x: 90, y: 0, z: 0 },
    instances: [
      { x: -3.0, y: 1, z: -4.2, scale: 1.1, scrollSpeed: 0.42, mouseAmp: 0.05, rotY: 0, rotX: -0.001, rotZ: -0.1 },
      { x: 2.4, y: -4.6, z: -2.0, scale: 0.85, scrollSpeed: 0.6, mouseAmp: 0.05, rotY: 0, rotX: -0.1, rotZ: 0.1 },
      { x: -1, y: -12, z: 6, scale: 0.3, scrollSpeed: 0.8, mouseAmp: 0.05, rotY: 0, rotX: -0.1, rotZ: -0.1 },
      { x: 1.4, y: -12.5, z: 2, scale: 0.3, scrollSpeed: 0.8, mouseAmp: 0.05, rotY: 0, rotX: -0.1, rotZ: -0.1 },
    ],
  },
  {
    src: '/cherub.glb',
    instances: [
      {
        x: 1.8,
        y: -6.2,
        z: 2,
        scale: 0.1,
        scrollSpeed: 0.5,
        mouseAmp: 0.05,
        rotY: 0,
        rotX: -0.08,
        rotZ: 0.06,
        opacity: 0.6,
        hoverOpacity: 1,
        depthWrite: true,
      },
    ],
  },
  {
    src: '/archway.glb',
    instances: [
      {
        x: 0,
        y: -15.6,
        z: -3.0,
        scale: 0.28,
        scrollSpeed: 0.95,
        mouseAmp: 0.1,
        rotY: 0,
        rotX: -0.04,
        rotZ: 0,
        opacity: 0.2,
        hoverOpacity: 0.3,
        depthWrite: false,
        portal: true,
      },
    ],
  },
  {
    src: '/bird1-optimized.glb',
    instances: [
      {
        x: -0.22,
        y: -8.5,
        z: 10,
        scale: 0.02,
        scrollSpeed: 0.55,
        mouseAmp: 0.06,
        rotY: 0.1,
        rotX: -0.05,
        rotZ: 0,
        opacity: 0.8,
        hoverOpacity: 1,
        depthWrite: true,
      },
    ],
  },
  {
    src: '/bird2-optimized.glb',
    instances: [
      {
        x: 0.4,
        y: -8.4,
        z: 8.5,
        scale: 0.02,
        scrollSpeed: 0.55,
        mouseAmp: 0.06,
        rotY: -0.2,
        rotX: 0.05,
        rotZ: 0,
        opacity: 0.8,
        hoverOpacity: 1,
        depthWrite: true,
      },
    ],
  },
]

const waterMouse = { value: new Vector2(2, 2) }
const waterVelocity = { value: new Vector2(0, 0) }
const waterResolution = { value: new Vector2(1, 1) }
const waterMotion = { value: 0 }

const CLOUD_SHARED_FUNCS = `
float cursorInfluence(vec2 screenUv, vec2 mouseUv, vec2 velocity) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 delta = screenUv - mouseUv;
  delta.x *= aspect;

  vec2 vel = velocity;
  vel.x *= aspect;
  float speed = length(vel);
  vec2 velDir = speed > 0.001 ? vel / speed : vec2(1.0, 0.0);

  float along = dot(delta, velDir);
  vec2 perp = delta - velDir * along;
  float stretch = 1.0 + saturate(speed * 0.35) * 1.6;
  float behind = saturate(-along * 6.0);
  vec2 wake = perp + velDir * (along / mix(1.0, stretch, behind));

  float radius = 0.22 + saturate(speed * 0.1) * 0.06;
  return smoothstep(radius, 0.0, length(wake)) * uMotion;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) {
    v += a * valueNoise(p);
    p = p * 2.11 + vec2(17.2, 9.1);
    a *= 0.5;
  }
  return v;
}

float fbmRich(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = p * 2.17 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return v;
}

float reliefHeight(vec3 worldPos) {
  vec2 p = worldPos.xz * 2.6 + worldPos.y * 1.1;
  float coarse = fbmRich(p);
  float mid = fbm(p * 3.4);
  float grit = valueNoise(p * 11.0);
  return saturate(coarse * 0.55 + mid * 0.3 + grit * 0.15);
}
`

const CLOUD_VERTEX_HEAD = `
uniform float uMotion;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
varying vec3 vCloudWorldPos;
varying float vHover;
varying float vRelief;

${CLOUD_SHARED_FUNCS}
`

const CLOUD_VERTEX_DISPLACE = `
  {
    vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vec4 clipPre = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    vec2 screenUv = clipPre.xy / max(abs(clipPre.w), 1e-4) * 0.5 + 0.5;
    vec2 mouseUv = uMouse * 0.5 + 0.5;
    float influence = uMotion > 0.001
      ? cursorInfluence(screenUv, mouseUv, uVelocity)
      : 0.0;
    float height = reliefHeight(worldPos);
    float amt = height * influence * 0.14;
    vec3 worldDisp = normalize(cameraPosition - worldPos) * amt;
    mat3 linear = mat3(modelMatrix);
    float scale2 = max(dot(linear[0], linear[0]), 1e-6);
    transformed += transpose(linear) * worldDisp / scale2;
    vHover = influence;
    vRelief = height;
  }
`

const CLOUD_SHADER_HEAD = `
uniform float uBaseOpacity;
uniform float uHoverOpacity;
uniform float uMotion;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
varying vec3 vCloudWorldPos;
varying float vHover;
varying float vRelief;

${CLOUD_SHARED_FUNCS}
`

const CLOUD_MAP_FRAGMENT = `
#ifdef USE_MAP
  vec2 mouseUv = uMouse * 0.5 + 0.5;
  vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float influence = uMotion > 0.001
    ? cursorInfluence(screenUv, mouseUv, uVelocity)
    : 0.0;
  influence = max(influence, vHover);

  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  diffuseColor *= sampledDiffuseColor;

  if (influence > 0.001) {
    float h = reliefHeight(vCloudWorldPos);
    float hx = dFdx(h);
    float hy = dFdy(h);
    vec3 bumpN = normalize(vec3(-hx * 12.0, -hy * 12.0, 1.0));
    vec3 fakeN = normalize(mix(vec3(0.0, 0.0, 1.0), bumpN, 0.65));

    vec3 lightDir = normalize(vec3(0.55, 0.8, 0.45));
    vec3 lightDir2 = normalize(vec3(-0.7, 0.3, 0.35));
    vec3 viewDir = normalize(vec3((screenUv - 0.5) * vec2(-1.5, 1.5), 1.0));
    vec3 R = reflect(-viewDir, fakeN);

    float envY = R.y * 0.5 + 0.5;
    vec3 env = mix(vec3(0.05, 0.03, 0.015), vec3(0.9, 0.75, 0.4), envY);
    env += vec3(1.0, 0.95, 0.82) * pow(saturate(R.y + 0.05), 10.0);
    float brush = fbm(vec2(R.x * 6.0, R.y * 14.0) + vCloudWorldPos.xz * 2.4);
    env *= mix(0.55, 1.55, brush);

    float ndl = saturate(dot(fakeN, lightDir));
    float ndl2 = saturate(dot(fakeN, lightDir2));
    float ndv = max(dot(fakeN, viewDir), 0.001);
    vec3 H = normalize(lightDir + viewDir);
    float ndh = saturate(dot(fakeN, H));
    float ndh2 = saturate(dot(fakeN, normalize(lightDir2 + viewDir)));

    vec3 F0 = vec3(1.0, 0.71, 0.29);
    float fresnel = pow(1.0 - ndv, 5.0);
    vec3 F = mix(F0, vec3(1.0, 0.98, 0.92), fresnel);

    float roughness = mix(0.22, 0.48, 1.0 - h);
    float a = max(roughness * roughness, 0.002);
    float a2 = a * a;
    float denom = ndh * ndh * (a2 - 1.0) + 1.0;
    float D = a2 / (3.14159265 * denom * denom);

    float specSharp = D * ndl * 2.8;
    float specBroad = pow(ndh2, mix(70.0, 18.0, roughness)) * ndl2 * 1.4;
    float hot = pow(ndh, 120.0) * 2.6;

    vec3 metal = env * F0 * (0.45 + ndl * 0.55 + h * 0.15);
    metal += F * (specSharp + specBroad);
    metal += vec3(1.0, 0.93, 0.72) * hot;
    metal += F0 * fresnel * 0.4;

    float detail = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    metal *= mix(0.88, 1.18, detail);

    diffuseColor.rgb = mix(diffuseColor.rgb, metal, saturate(influence * 1.1));
  }

  diffuseColor.a *= mix(uBaseOpacity, uHoverOpacity, influence);
  if (diffuseColor.a < 0.01) discard;
#endif
`

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

const gltfsBySrc = shallowRef({})
const instances = shallowRef([])
const archOccluder = shallowRef(null)
const textInstance = shallowRef(null)
const sceneTextConfig = useArchSceneText()
const waterFollow = { x: 10, y: 10 }
let lastWaterX = 10
let lastWaterY = 10
let disposed = false

const { pointer, cameraZ, getWorldPosition } = useArchwayMotion()
const { invalidate, camera } = useTres()
const { onBeforeRender } = useLoop()

function requestFrame(frames = 1) {
  if (disposed || (typeof document !== 'undefined' && document.hidden)) return
  invalidate(frames)
}

function disposeTextMesh(mesh) {
  mesh.geometry?.dispose?.()
  if (mesh.material?.map) {
    mesh.material.map.dispose()
    mesh.material.map = null
  }
  mesh.material?.dispose?.()
}

const DEFAULT_TEXT_FONT = 'Inter, sans-serif'

function getLineFont(line) {
  const fontSize = line.canvasSize ?? 128
  const weight = line.weight ?? 400
  const family = line.font ?? DEFAULT_TEXT_FONT
  const lineHeight = line.lineHeight ?? 0.9;
  return { font: `${weight} ${fontSize}px ${family}`, fontSize, lineHeight }
}

function measureTextLine(ctx, text, fontSize, letterSpacing) {
  const spacing = letterSpacing ? fontSize * letterSpacing : 0
  const chars = text.split('')
  const widths = chars.map((char) => ctx.measureText(char).width)
  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) + spacing * Math.max(chars.length - 1, 0)
  return { chars, widths, totalWidth, spacing }
}

function drawCanvasLine(ctx, line, width, height, color) {
  const { font, fontSize, lineHeight } = getLineFont(line)

  ctx.clearRect(0, 0, width, height)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const textLines = line.text.split('\n')
  const rowHeight = fontSize * lineHeight
  const blockHeight = rowHeight * textLines.length
  let y = height / 2 - blockHeight / 2 + rowHeight / 2

  for (const textLine of textLines) {
    const { chars, widths, totalWidth, spacing } = measureTextLine(
      ctx,
      textLine,
      fontSize,
      line.letterSpacing,
    )

    let x = width / 2 - totalWidth / 2

    for (let i = 0; i < chars.length; i++) {
      const charWidth = widths[i]
      ctx.fillText(chars[i], x + charWidth / 2, y)
      x += charWidth + spacing
    }

    y += rowHeight
  }
}

function createTextPlane(line, colorHex) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const { font, fontSize, lineHeight } = getLineFont(line)
  const textLines = line.text.split('\n')
  const rowHeight = fontSize * lineHeight

  ctx.font = font
  const totalWidth = textLines.reduce(
    (max, textLine) =>
      Math.max(max, measureTextLine(ctx, textLine, fontSize, line.letterSpacing).totalWidth),
    0,
  )

  canvas.width = Math.ceil(totalWidth + fontSize)
  canvas.height = Math.ceil(rowHeight * textLines.length)

  drawCanvasLine(ctx, line, canvas.width, canvas.height, colorHex)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  const planeHeight = line.size ?? 0.2
  const planeWidth = planeHeight * (canvas.width / canvas.height)
  const geometry = new PlaneGeometry(planeWidth, planeHeight)
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })

  const mesh = new Mesh(geometry, material)
  mesh.position.y = line.y ?? 0
  return mesh
}

function disposeTextInstance() {
  const inst = textInstance.value
  if (!inst) return

  inst.object.traverse((child) => {
    if (child.isMesh) disposeTextMesh(child)
  })
  inst.object.removeFromParent?.()
  textInstance.value = null
}

async function buildTextInstance(config) {
  disposeTextInstance()
  if (!config?.lines?.length) return

  await Promise.all(config.lines.map((line) => document.fonts.load(getLineFont(line).font)))

  const group = new Group()
  const color = new Color(config.color ?? '#C29A65').getStyle()

  for (const line of config.lines) {
    group.add(createTextPlane(line, color))
  }

  textInstance.value = { object: group, config }
  nextTick(() => requestFrame(4))
}

watch(
  sceneTextConfig,
  (config) => {
    if (disposed) return
    buildTextInstance(config)
  },
  { immediate: true, deep: true },
)

function createArchOccluder() {
  const o = OCCLUDER_OUTER
  const shape = new Shape()
  shape.moveTo(-o, -o)
  shape.lineTo(o, -o)
  shape.lineTo(o, o)
  shape.lineTo(-o, o)
  shape.closePath()

  const hw = OCCLUDER_HOLE_W
  const bottom = OCCLUDER_HOLE_BOTTOM
  const top = OCCLUDER_HOLE_TOP
  const spring = top - hw
  const hole = new Shape()
  hole.moveTo(-hw, bottom)
  hole.lineTo(hw, bottom)
  hole.lineTo(hw, spring)
  hole.absarc(0, spring, hw, 0, Math.PI, false)
  hole.lineTo(-hw, bottom)
  shape.holes.push(hole)

  const geometry = new ShapeGeometry(shape)
  const material = new MeshBasicMaterial({
    color: OCCLUDER_COLOR,
    side: DoubleSide,
    depthWrite: true,
    toneMapped: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -2
  return mesh
}

async function loadSceneModels() {
  const srcs = [...new Set(SCENE_MODELS.map((model) => model.src))]
  try {
    const entries = await Promise.all(
      srcs.map(async (src) => [src, await gltfLoader.loadAsync(src)]),
    )
    if (disposed) return
    gltfsBySrc.value = Object.fromEntries(entries)
    rebuildInstances()
  } catch (error) {
    console.error('[CloudFieldArchway] failed to load scene models', error)
  }
}

function applyCloudMaterial(sourceMat, opacity, hoverOpacity, depthWrite) {
  const map = sourceMat.map ? toRaw(sourceMat.map) : null
  if (map) map.colorSpace = SRGBColorSpace

  const next = new MeshBasicMaterial({
    map,
    side: DoubleSide,
    transparent: true,
    depthWrite,
    toneMapped: false,
  })

  next.customProgramCacheKey = () => 'cloud-basic-gltf-metal-gold-v4'
  next.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseOpacity = { value: opacity }
    shader.uniforms.uHoverOpacity = { value: hoverOpacity }
    shader.uniforms.uMotion = waterMotion
    shader.uniforms.uMouse = waterMouse
    shader.uniforms.uVelocity = waterVelocity
    shader.uniforms.uResolution = waterResolution
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${CLOUD_VERTEX_HEAD}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${CLOUD_VERTEX_DISPLACE}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vCloudWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${CLOUD_SHADER_HEAD}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      CLOUD_MAP_FRAGMENT,
    )
  }
  next.needsUpdate = true
  return next
}

function prepareMaterials(root, opacity, hoverOpacity, depthWrite) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const next = mats.map((mat) =>
      applyCloudMaterial(toRaw(mat), opacity, hoverOpacity, depthWrite),
    )
    child.material = Array.isArray(child.material) ? next : next[0]
    child.frustumCulled = true
  })
}

function spawnInstances(gltf, configs, baseRotation = { x: 0, y: 0, z: 0 }) {
  if (!gltf?.scene || !configs?.length) return []

  const scene = toRaw(gltf.scene)
  const rotation = {
    x: baseRotation.x ?? 0,
    y: baseRotation.y ?? 0,
    z: baseRotation.z ?? 0,
  }

  return configs.map((config) => {
    const object = scene.clone(true)
    object.position.set(config.x, config.y, config.z)
    object.scale.setScalar(config.scale)
    object.rotation.set(
      MathUtils.degToRad(rotation.x) + (config.rotX ?? 0),
      MathUtils.degToRad(rotation.y) + (config.rotY ?? 0),
      MathUtils.degToRad(rotation.z) + (config.rotZ ?? 0),
    )
    prepareMaterials(
      object,
      config.opacity ?? CLOUD_OPACITY,
      config.hoverOpacity ?? HOVER_OPACITY,
      config.depthWrite ?? false,
    )
    return { object, config, baseRotation: rotation }
  })
}

function disposeInstance(object) {
  object.removeFromParent?.()
  object.traverse((child) => {
    if (!child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      mat.map = null
      mat.dispose()
    }
  })
}

function clearInstances() {
  for (const { object } of instances.value) {
    disposeInstance(object)
  }
  instances.value = []

  const occluder = archOccluder.value
  if (occluder) {
    occluder.removeFromParent?.()
    occluder.geometry?.dispose?.()
    occluder.material?.dispose?.()
    archOccluder.value = null
  }
}

function rebuildInstances() {
  if (disposed) return

  const loaded = gltfsBySrc.value
  if (!SCENE_MODELS.every((model) => loaded[model.src])) return

  clearInstances()
  instances.value = SCENE_MODELS.flatMap((model) =>
    spawnInstances(loaded[model.src], model.instances, model.baseRotation),
  )
  archOccluder.value = createArchOccluder()
  nextTick(() => requestFrame(4))
}

loadSceneModels()

let removeVisibility

onMounted(() => {
  registerArchwayRenderSync()
  waterFollow.x = pointer.x
  waterFollow.y = pointer.y
  lastWaterX = pointer.x
  lastWaterY = pointer.y

  const onVisibility = () => {
    if (!document.hidden) requestFrame()
  }
  document.addEventListener('visibilitychange', onVisibility)
  removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility)
  requestFrame(2)
})

onBeforeUnmount(() => {
  disposed = true
  unregisterArchwayRenderSync()
  removeVisibility?.()
  clearInstances()
  disposeTextInstance()
  for (const gltf of Object.values(gltfsBySrc.value)) {
    gltf?.scene?.traverse((child) => {
      child.geometry?.dispose?.()
    })
  }
  gltfsBySrc.value = {}
  dracoLoader.dispose()
})

onBeforeRender(({ delta, renderer }) => {
  if (disposed || (typeof document !== 'undefined' && document.hidden)) return

  waterFollow.x += (pointer.x - waterFollow.x) * 0.22
  waterFollow.y += (pointer.y - waterFollow.y) * 0.22

  const invDelta = 1 / Math.max(delta, 0.001)
  const vx = (waterFollow.x - lastWaterX) * invDelta
  const vy = (waterFollow.y - lastWaterY) * invDelta
  waterVelocity.value.x += (vx - waterVelocity.value.x) * 0.18
  waterVelocity.value.y += (vy - waterVelocity.value.y) * 0.18
  lastWaterX = waterFollow.x
  lastWaterY = waterFollow.y

  const speed = Math.hypot(waterVelocity.value.x, waterVelocity.value.y)
  const target = Math.min(1, Math.max(0, (speed - 0.1) / 0.55))
  const blend = target > waterMotion.value
    ? 1 - Math.exp(-delta / 0.08)
    : 1 - Math.exp(-delta / 0.85)
  waterMotion.value += (target - waterMotion.value) * blend

  waterMouse.value.set(waterFollow.x, waterFollow.y)
  waterResolution.value.set(renderer.domElement.width, renderer.domElement.height)

  const cam = camera.value
  if (cam) {
    cam.position.z = cameraZ.value
    setArchwayCamera(cam)
  }

  let portalArch = null

  for (const { object, config, baseRotation } of instances.value) {
    const world = getWorldPosition(config)

    object.position.x = world.x
    object.position.y = world.y
    object.position.z = world.z

    object.rotation.x = MathUtils.degToRad(baseRotation.x) + (config.rotX ?? 0)
    object.rotation.y = MathUtils.degToRad(baseRotation.y) + (config.rotY ?? 0)
    object.rotation.z = MathUtils.degToRad(baseRotation.z) + (config.rotZ ?? 0)

    if (config.portal) {
      object.visible = true
      portalArch = object
    } else {
      object.visible = Math.abs(world.y) < CULL_Y + 3
    }
  }

  const textInst = textInstance.value
  if (textInst) {
    const world = getWorldPosition(textInst.config)

    textInst.object.position.x = world.x
    textInst.object.position.y = world.y
    textInst.object.position.z = world.z
    textInst.object.visible = Math.abs(world.y) < CULL_Y + 3
  }

  const occluder = archOccluder.value
  if (occluder && portalArch) {
    occluder.position.copy(portalArch.position)
    occluder.position.z += OCCLUDER_Z_BIAS
    occluder.rotation.copy(portalArch.rotation)
    occluder.scale.set(1, 1, 1)
    occluder.visible = true
  }

  notifyArchwayRenderSync()
})
</script>

<template>
  <primitive
    v-for="(inst, index) in instances"
    :key="index"
    :object="inst.object"
  />
  <primitive v-if="textInstance" :object="textInstance.object" />
  <primitive v-if="archOccluder" :object="archOccluder" />
</template>
