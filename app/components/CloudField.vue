<script setup>
import { useGLTF } from '@tresjs/cientos'
import { useLoop } from '@tresjs/core'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DoubleSide, MathUtils, Vector2 } from 'three'

gsap.registerPlugin(ScrollTrigger)

const CLOUD_BASE_ROTATION_DEG = {
  x: 90,
  y: 0,
  z: 0,
}

const CHERUB_BASE_ROTATION_DEG = {
  x: 0,
  y: 0,
  z: 0,
}

const ARCHWAY_BASE_ROTATION_DEG = {
  x: 0,
  y: 0,
  z: 0,
}

const CLOUD_OPACITY = 0.2

const CLOUD_CONFIGS = [
  { x: -3.0, y: 2.0, z: -4.2, scale: 1.1, scrollSpeed: 0.42, mouseAmp: 0.05, rotAmp: 0, rotY: 0, rotX: -0.001, rotZ: -0.1 },
  { x: 2.4, y: -4.6, z: -2.0, scale: 0.85, scrollSpeed: 1.05, mouseAmp: 0.05, rotAmp: 0, rotY: 0, rotX: -0.1, rotZ: 0.1 },
  { x: -3, y: -11, z: -2.0, scale: 1.2, scrollSpeed: 1.05, mouseAmp: 0.05, rotAmp: 0, rotY: 0, rotX: -0.1, rotZ: -0.1 },
]

const HOVER_OPACITY = 0.5

const CHERUB_CONFIGS = [
  { x: 1.8, y: -6.2, z: -2.4, scale: 0.25, scrollSpeed: 0.8, mouseAmp: 0.05, rotAmp: 0, rotY: 0, rotX: -0.08, rotZ: 0.06, opacity: 0.6, hoverOpacity: 1 },
]

const ARCHWAY_CONFIGS = [
  { x: 0, y: -15, z: -3.0, scale: 0.7, scrollSpeed: 0.95, mouseAmp: 0.04, rotAmp: 0, rotY: 0, rotX: -0.04, rotZ: 0, opacity: 0.2, hoverOpacity: 1 },
]

const SCROLL_TRAVEL = 20

const waterMouse = { value: new Vector2(2, 2) }
const waterVelocity = { value: new Vector2(0, 0) }
const waterResolution = { value: new Vector2(1, 1) }
const waterMotion = { value: 0 }
const waterTime = { value: 0 }

const CLOUD_VERTEX_HEAD = `
varying vec3 vCloudWorldPos;
`

const CLOUD_SHADER_HEAD = `
uniform float uBaseOpacity;
uniform float uHoverOpacity;
uniform float uMotion;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uResolution;
varying vec3 vCloudWorldPos;

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

  float radius = 0.2 + saturate(speed * 0.1) * 0.06;
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
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = p * 2.11 + vec2(17.2, 9.1);
    a *= 0.5;
  }
  return v;
}

float appearMask(vec2 screenUv) {
  // vec2 drift = vec2(uTime * 0.00001, -uTime * 0.016);
  vec2 drift = vec2(0, 0);
  float n = fbm(vCloudWorldPos.xz * 0.36 + vCloudWorldPos.y * 0.18 + drift);

  float edgeDist = min(screenUv.y, 1.0 - screenUv.y);
  float warped = edgeDist + (n - 0.5) * 0.16;
  float viewport = smoothstep(0.15, 0.4, warped);

  return saturate(smoothstep(0.2, 0.9, n * 0.82 + viewport * 0.88));
}
`

const CLOUD_MAP_FRAGMENT = `
#ifdef USE_MAP
  vec2 mouseUv = uMouse * 0.5 + 0.5;
  vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float influence = cursorInfluence(screenUv, mouseUv, uVelocity);
  float appear = appearMask(screenUv);

  vec4 sampledDiffuseColor = texture2D(map, vMapUv);

  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
  #endif

  diffuseColor *= sampledDiffuseColor;
  diffuseColor.a *= mix(uBaseOpacity, uHoverOpacity, influence) * appear;
#else
  vec2 mouseUv = uMouse * 0.5 + 0.5;
  vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float influence = cursorInfluence(screenUv, mouseUv, uVelocity);
  diffuseColor.a *= mix(uBaseOpacity, uHoverOpacity, influence) * appearMask(screenUv);
#endif
`

const { state: cloudsState } = useGLTF('/clouds.glb', { draco: true })
const { state: cherubState } = useGLTF('/cherub.glb', { draco: true })
const { state: archwayState } = useGLTF('/archway.glb', { draco: true })

const instances = shallowRef([])
const pointer = reactive({ x: 10, y: 10 })
const smooth = reactive({ x: 10, y: 10, scroll: 0 })
const waterFollow = reactive({ x: 10, y: 10 })
const targetScroll = ref(0)
let hasPointer = false
let lastWaterX = 10
let lastWaterY = 10

function applyCloudMaterial(mat, opacity, hoverOpacity) {
  const next = mat.clone()
  next.side = DoubleSide
  next.transparent = true
  next.depthWrite = false
  next.opacity = 1
  if (next.map) next.map.colorSpace = 'srgb'
  next.customProgramCacheKey = () => `${CLOUD_VERTEX_HEAD}${CLOUD_SHADER_HEAD}${CLOUD_MAP_FRAGMENT}`
  next.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseOpacity = { value: opacity }
    shader.uniforms.uHoverOpacity = { value: hoverOpacity }
    shader.uniforms.uMotion = waterMotion
    shader.uniforms.uTime = waterTime
    shader.uniforms.uMouse = waterMouse
    shader.uniforms.uVelocity = waterVelocity
    shader.uniforms.uResolution = waterResolution
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${CLOUD_VERTEX_HEAD}`,
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

function prepareMaterials(root, opacity, hoverOpacity) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => applyCloudMaterial(mat, opacity, hoverOpacity))
    } else {
      child.material = applyCloudMaterial(child.material, opacity, hoverOpacity)
    }
  })
}

function spawnInstances(gltf, configs, baseRotation) {
  if (!gltf?.scene) return []

  const scene = toRaw(gltf.scene)

  return configs.map((config) => {
    const object = scene.clone(true)
    object.position.set(config.x, config.y, config.z)
    object.scale.setScalar(config.scale)
    object.rotation.set(
      MathUtils.degToRad(baseRotation.x) + config.rotX,
      MathUtils.degToRad(baseRotation.y) + config.rotY,
      MathUtils.degToRad(baseRotation.z) + config.rotZ,
    )
    prepareMaterials(object, config.opacity ?? CLOUD_OPACITY, config.hoverOpacity ?? HOVER_OPACITY)
    return { object, config, baseRotation }
  })
}

function rebuildInstances() {
  instances.value = [
    ...spawnInstances(cloudsState.value, CLOUD_CONFIGS, CLOUD_BASE_ROTATION_DEG),
    ...spawnInstances(cherubState.value, CHERUB_CONFIGS, CHERUB_BASE_ROTATION_DEG),
    ...spawnInstances(archwayState.value, ARCHWAY_CONFIGS, ARCHWAY_BASE_ROTATION_DEG),
  ]
}

watch(cloudsState, rebuildInstances, { immediate: true })
watch(cherubState, rebuildInstances, { immediate: true })
watch(archwayState, rebuildInstances, { immediate: true })

let removePointer
let scrollTrigger

onMounted(() => {
  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    if (!hasPointer) {
      smooth.x = pointer.x
      smooth.y = pointer.y
      waterFollow.x = pointer.x
      waterFollow.y = pointer.y
      lastWaterX = pointer.x
      lastWaterY = pointer.y
      hasPointer = true
    }
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  removePointer = () => window.removeEventListener('pointermove', onPointerMove)

  scrollTrigger = ScrollTrigger.create({
    trigger: document.documentElement,
    ease: 'none',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      targetScroll.value = self.progress
    },
  })
})

onBeforeUnmount(() => {
  removePointer?.()
  scrollTrigger?.kill()
})

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, renderer }) => {
  smooth.x += (pointer.x - smooth.x) * 0.07
  smooth.y += (pointer.y - smooth.y) * 0.07
  waterFollow.x += (pointer.x - waterFollow.x) * 0.22
  waterFollow.y += (pointer.y - waterFollow.y) * 0.22
  // smooth.scroll += (targetScroll.value - smooth.scroll) * 0.08
  smooth.scroll += (targetScroll.value - smooth.scroll)

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

  waterTime.value += delta
  waterMouse.value.set(waterFollow.x, waterFollow.y)
  waterResolution.value.set(renderer.domElement.width, renderer.domElement.height)

  const travel = SCROLL_TRAVEL

  for (const { object, config, baseRotation } of instances.value) {
    object.position.x = config.x + smooth.x * config.mouseAmp
    object.position.y =
      config.y +
      smooth.scroll * travel * config.scrollSpeed +
      smooth.y * config.mouseAmp * 0.55
    object.position.z = config.z

    object.rotation.x =
      MathUtils.degToRad(baseRotation.x) + config.rotX + smooth.y * config.rotAmp * 0.65
    object.rotation.y =
      MathUtils.degToRad(baseRotation.y) +
      config.rotY +
      smooth.x * config.rotAmp
    object.rotation.z =
      MathUtils.degToRad(baseRotation.z) + config.rotZ + smooth.x * config.rotAmp * 0.12
  }
})
</script>

<template>
  <TresAmbientLight :intensity="1.35" />
  <TresDirectionalLight :position="[4, 6, 5]" :intensity="1.6" />
  <TresDirectionalLight :position="[-5, 2, 3]" :intensity="0.55" color="#ffe8d6" />

  <primitive
    v-for="(inst, index) in instances"
    :key="index"
    :object="inst.object"
  />
</template>
