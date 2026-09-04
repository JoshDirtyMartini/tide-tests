<script setup>
import {
  Color,
  DataTexture,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three'
import { SIDE_BURN_FRAGMENT_SHADER, SIDE_BURN_VERTEX_SHADER } from '~/utils/sideBurnShader'
import { collectScrollRevealAnimations, useScrollReveal } from '~/composables/useScrollReveal'
import { getCachedTexture, preloadTexture } from '~/utils/bespokeAssetCache'

const props = defineProps({
  to: {
    type: String,
    required: true,
  },
  from: {
    type: String,
    default: '',
  },
  behind: {
    type: String,
    default: '',
  },
  baseColor: {
    type: String,
    default: '#fcf4ee',
  },
  spread: {
    type: Number,
    default: 0.32,
  },
  sketchLead: {
    type: Number,
    default: 0.08,
  },
  sketchSpeed: {
    type: Number,
    default: 1.75,
  },
  behindOpacity: {
    type: Number,
    default: 0.08,
  },
  sketchOpacity: {
    type: Number,
    default: 0.6,
  },
  revealBehind: {
    type: Boolean,
    default: false,
  },
  centerBurn: {
    type: Boolean,
    default: true,
  },
  direction: {
    type: Number,
    default: 1,
  },
})

const rootRef = ref(null)
const canvasRef = ref(null)
const overlayRef = ref(null)
const isReady = ref(false)
const loadError = ref('')

const showBehind = computed(() => Boolean(props.behind))
const useOpaqueBehind = computed(() => showBehind.value)
const useRevealBehind = computed(() => !showBehind.value && props.revealBehind)

const scrollReveal = useScrollReveal(rootRef)

let renderer
let scene
let camera
let material
let mesh
let resizeObserver
let disposed = false
let fromTexture
let toTexture
let behindTexture
let rafId = null
let clockStart = 0
let burnProgress = 0

function createSolidTexture(hex) {
  const color = new Color(hex)
  const data = new Uint8Array([
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
    255,
  ])
  const texture = new DataTexture(data, 1, 1)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createPlaceholderTexture() {
  return createSolidTexture('#000000')
}

async function loadFromTexture() {
  if (props.from) {
    return getCachedTexture(props.from) ?? preloadTexture(props.from)
  }
  return createSolidTexture(props.baseColor)
}

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function getSize() {
  const root = rootRef.value
  if (!root) return null
  const width = root.clientWidth || window.innerWidth
  const height = root.clientHeight || window.innerHeight
  if (!width || !height) return null
  return { width, height }
}

function renderFrame() {
  if (!renderer || !scene || !camera || disposed) return
  renderer.render(scene, camera)
}

const BURN_MAX_DPR = 1.25

function shouldAnimate() {
  return burnProgress > 0.001 && burnProgress < 0.999
}

function tick(now) {
  if (disposed) return
  rafId = requestAnimationFrame(tick)
  if (!material) return

  material.uniforms.uTime.value = (now - clockStart) * 0.001

  if (shouldAnimate()) {
    renderFrame()
  }
}

function startBurnLoop() {
  if (rafId !== null) return
  clockStart = performance.now()
  rafId = requestAnimationFrame(tick)
}

function stopBurnLoop() {
  if (rafId === null) return
  cancelAnimationFrame(rafId)
  rafId = null
}

function resize() {
  if (!renderer || !material) return false
  const size = getSize()
  if (!size) return false
  const dpr = Math.min(window.devicePixelRatio || 1, BURN_MAX_DPR)
  renderer.setPixelRatio(dpr)
  renderer.setSize(size.width, size.height, false)
  material.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr)
  renderFrame()
  return true
}

function getRevealAnimations() {
  return collectScrollRevealAnimations(overlayRef.value)
}

async function setupScrollReveal() {
  const animations = getRevealAnimations()
  if (!animations.length) return
  await scrollReveal.setup(animations)
  scrollReveal.observeResize()
}

function setProgress(value) {
  if (!material || disposed) return
  const t = Math.min(Math.max(value, 0), 1)
  burnProgress = t

  material.uniforms.uProgress.value = t

  if (props.centerBurn) {
    material.uniforms.uSlide.value.set(0, 0)
  } else {
    const burnT = t * t * (3 - 2 * t)
    material.uniforms.uSlide.value.set(
      props.direction * 0.05 * burnT,
      0.03 * burnT,
    )
  }

  renderFrame()

  if (t >= 0.999 || t <= 0.001) {
    stopBurnLoop()
  } else {
    startBurnLoop()
  }
}

defineExpose({ setProgress, isReady, refreshScroll: scrollReveal.refresh })

onMounted(async () => {
  await nextTick()
  await waitForLayout()

  if (!canvasRef.value || !rootRef.value) return

  const opaqueBehind = useOpaqueBehind.value
  const revealBehind = useRevealBehind.value

  renderer = new WebGLRenderer({
    canvas: canvasRef.value,
    antialias: false,
    alpha: !opaqueBehind && revealBehind,
    premultipliedAlpha: false,
    powerPreference: 'default',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.setClearColor(0x000000, opaqueBehind || !revealBehind ? 1 : 0)

  scene = new Scene()
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  material = new ShaderMaterial({
    uniforms: {
      uFrom: { value: null },
      uTo: { value: null },
      uBehind: { value: createPlaceholderTexture() },
      uProgress: { value: 0 },
      uDirection: { value: props.direction },
      uSpread: { value: props.spread },
      uCenterBurn: { value: props.centerBurn ? 1 : 0 },
      uRevealBehind: { value: revealBehind ? 1 : 0 },
      uUseBehind: { value: opaqueBehind ? 1 : 0 },
      uSketchLead: { value: props.sketchLead },
      uSketchSpeed: { value: props.sketchSpeed },
      uSketchOpacity: { value: props.sketchOpacity },
      uBehindOpacity: { value: props.behindOpacity },
      uTime: { value: 0 },
      uSlide: { value: new Vector2(0, 0) },
      uResolution: { value: new Vector2(1, 1) },
    },
    vertexShader: SIDE_BURN_VERTEX_SHADER,
    fragmentShader: SIDE_BURN_FRAGMENT_SHADER,
    transparent: !opaqueBehind && revealBehind,
    depthTest: false,
    depthWrite: false,
  })

  mesh = new Mesh(new PlaneGeometry(2, 2), material)
  scene.add(mesh)

  resize()
  window.addEventListener('resize', resize, { passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(rootRef.value)
  }

  try {
    const loads = [
      loadFromTexture(),
      getCachedTexture(props.to) ?? preloadTexture(props.to),
    ]
    if (showBehind.value) {
      loads.push(getCachedTexture(props.behind) ?? preloadTexture(props.behind))
    }

    const textures = await Promise.all(loads)
    if (disposed) return

    fromTexture = textures[0]
    toTexture = textures[1]
    toTexture.colorSpace = SRGBColorSpace
    material.uniforms.uFrom.value = fromTexture
    material.uniforms.uTo.value = toTexture

    if (showBehind.value) {
      behindTexture = textures[2]
      behindTexture.colorSpace = SRGBColorSpace
      material.uniforms.uBehind.value = behindTexture
    }

    setProgress(0)
    await setupScrollReveal()
    isReady.value = true
  } catch (error) {
    console.error('[SideBurnScroll] failed to load textures', error)
    loadError.value = 'Could not load images'
  }
})

onBeforeUnmount(() => {
  disposed = true
  scrollReveal.cleanup()
  stopBurnLoop()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resize)
  mesh?.geometry?.dispose()
  material?.dispose()
  renderer?.dispose()
  fromTexture?.dispose()
  toTexture?.dispose()
  behindTexture?.dispose()
})
</script>

<template>
  <div
    ref="rootRef"
    class="side-burn-scroll"
    :style="{ backgroundColor: showBehind ? '#000' : baseColor }"
  >
    <div
      v-if="$slots.default"
      ref="overlayRef"
      class="side-burn-scroll__overlay"
    >
      <slot />
    </div>

    <canvas
      ref="canvasRef"
      class="side-burn-scroll__canvas"
      :class="{ 'side-burn-scroll__canvas--ready': isReady }"
    />

    <p
      v-if="loadError"
      class="side-burn-scroll__error"
    >
      {{ loadError }}
    </p>
  </div>
</template>

<style scoped>
.side-burn-scroll {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.side-burn-scroll__overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
  width: fit-content;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #fff;
}

.side-burn-scroll__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
}

.side-burn-scroll__canvas--ready {
  opacity: 1;
}

.side-burn-scroll__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: rgb(255 255 255 / 0.7);
  font-size: 0.875rem;
}
</style>
