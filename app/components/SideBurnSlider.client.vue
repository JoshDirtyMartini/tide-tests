<script setup>
import gsap from 'gsap'
import {
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three'
import { SIDE_BURN_FRAGMENT_SHADER, SIDE_BURN_VERTEX_SHADER } from '~/utils/sideBurnShader'

const props = defineProps({
  images: {
    type: Array,
    required: true,
  },
  burnDuration: {
    type: Number,
    default: 1.6,
  },
  spread: {
    type: Number,
    default: 0.32,
  },
})

const rootRef = ref(null)
const canvasRef = ref(null)
const currentIndex = ref(0)
const isTransitioning = ref(false)
const isReady = ref(false)
const loadError = ref('')

let renderer
let scene
let camera
let material
let mesh
let resizeObserver
let transitionTimeline
let disposed = false
let rafId = null
let clockStart = 0

const textureCache = new Map()
const loader = new TextureLoader()
loader.setCrossOrigin('anonymous')

const VERTEX_SHADER = SIDE_BURN_VERTEX_SHADER
const FRAGMENT_SHADER = SIDE_BURN_FRAGMENT_SHADER

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

function loadTexture(url) {
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url))
  }
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = SRGBColorSpace
    textureCache.set(url, texture)
    return texture
  })
}

function resize() {
  if (!renderer || !material) return false
  const size = getSize()
  if (!size) return false
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
  renderer.setPixelRatio(dpr)
  renderer.setSize(size.width, size.height, false)
  material.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr)
  renderFrame()
  return true
}

function renderFrame() {
  if (!renderer || !scene || !camera || disposed) return
  renderer.render(scene, camera)
}

function tick(now) {
  if (disposed) return
  rafId = requestAnimationFrame(tick)
  if (!material) return

  material.uniforms.uTime.value = (now - clockStart) * 0.001

  const progress = material.uniforms.uProgress.value
  if (progress > 0.001 && progress < 0.999) {
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

function setTextures(fromIndex, toIndex) {
  material.uniforms.uFrom.value = textureCache.get(props.images[fromIndex])
  material.uniforms.uTo.value = textureCache.get(props.images[toIndex])
  material.uniforms.uProgress.value = 0
  material.uniforms.uSlide.value.set(0, 0)
  renderFrame()
}

function killTransition() {
  transitionTimeline?.kill()
  transitionTimeline = null
}

function finishTransition(nextIndex) {
  if (disposed) return
  const next = textureCache.get(props.images[nextIndex])
  material.uniforms.uFrom.value = next
  material.uniforms.uTo.value = next
  material.uniforms.uProgress.value = 0
  material.uniforms.uSlide.value.set(0, 0)
  currentIndex.value = nextIndex
  isTransitioning.value = false
  renderFrame()
}

async function transitionTo(nextIndex, direction) {
  if (
    disposed
    || !isReady.value
    || isTransitioning.value
    || nextIndex === currentIndex.value
    || nextIndex < 0
    || nextIndex >= props.images.length
  ) {
    return
  }

  const fromIndex = currentIndex.value
  isTransitioning.value = true
  killTransition()

  await loadTexture(props.images[fromIndex])
  await loadTexture(props.images[nextIndex])
  if (disposed) return

  material.uniforms.uDirection.value = direction
  setTextures(fromIndex, nextIndex)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    finishTransition(nextIndex)
    return
  }

  const slideX = direction > 0 ? 0.05 : -0.05
  const slideY = 0.03

  transitionTimeline = gsap.timeline({
    onUpdate: renderFrame,
    onComplete: () => finishTransition(nextIndex),
  })

  const ease = 'none'

  transitionTimeline.to(material.uniforms.uProgress, {
    value: 1,
    duration: props.burnDuration,
    ease,
  }, 0)

  transitionTimeline.to(material.uniforms.uSlide.value, {
    x: slideX,
    y: slideY,
    duration: props.burnDuration,
    ease: 'power2.out',
  }, 0)
}

function prevImage() {
  transitionTo((currentIndex.value - 1 + props.images.length) % props.images.length, -1)
}

function nextImage() {
  transitionTo((currentIndex.value + 1) % props.images.length, 1)
}

onMounted(async () => {
  await nextTick()
  await waitForLayout()
  if (!canvasRef.value || !rootRef.value || !props.images.length) return

  renderer = new WebGLRenderer({
    canvas: canvasRef.value,
    antialias: false,
    alpha: false,
    powerPreference: 'default',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.setClearColor(0x000000, 1)

  scene = new Scene()
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  material = new ShaderMaterial({
    uniforms: {
      uFrom: { value: null },
      uTo: { value: null },
      uBehind: { value: null },
      uProgress: { value: 0 },
      uDirection: { value: 1 },
      uSpread: { value: props.spread },
      uCenterBurn: { value: 0 },
      uRevealBehind: { value: 0 },
      uUseBehind: { value: 0 },
      uSketchLead: { value: 0 },
      uSketchSpeed: { value: 1 },
      uSketchOpacity: { value: 1 },
      uBehindOpacity: { value: 1 },
      uTime: { value: 0 },
      uSlide: { value: new Vector2(0, 0) },
      uResolution: { value: new Vector2(1, 1) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
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
    await Promise.all(props.images.map((url) => loadTexture(url)))
    if (disposed) return

    const first = textureCache.get(props.images[0])
    material.uniforms.uFrom.value = first
    material.uniforms.uTo.value = first
    isReady.value = true
    startBurnLoop()
    renderFrame()
  } catch (error) {
    console.error('[SideBurnSlider] failed to load textures', error)
    loadError.value = 'Could not load images'
  }
})

onBeforeUnmount(() => {
  disposed = true
  stopBurnLoop()
  killTransition()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resize)
  mesh?.geometry?.dispose()
  material?.dispose()
  renderer?.dispose()
  for (const texture of textureCache.values()) {
    texture.dispose()
  }
  textureCache.clear()
})
</script>

<template>
  <div ref="rootRef" class="side-burn-slider">
    <img
      v-if="!isReady && !loadError"
      :src="images[0]"
      alt=""
      class="side-burn-slider__fallback"
      draggable="false"
    >

    <canvas
      ref="canvasRef"
      class="side-burn-slider__canvas"
      :class="{ 'side-burn-slider__canvas--ready': isReady }"
    />

    <p
      v-if="loadError"
      class="side-burn-slider__error"
    >
      {{ loadError }}
    </p>

    <div class="side-burn-slider__controls">
      <button
        class="side-burn-slider__btn"
        :disabled="isTransitioning || !isReady"
        aria-label="Previous image"
        @click="prevImage"
      >
        &#8592;
      </button>
      <button
        class="side-burn-slider__btn"
        :disabled="isTransitioning || !isReady"
        aria-label="Next image"
        @click="nextImage"
      >
        &#8594;
      </button>
    </div>
  </div>
</template>

<style scoped>
.side-burn-slider {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
}

.side-burn-slider__fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.side-burn-slider__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
}

.side-burn-slider__canvas--ready {
  opacity: 1;
}

.side-burn-slider__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: rgb(255 255 255 / 0.7);
  font-size: 0.875rem;
}

.side-burn-slider__controls {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  z-index: 10;
  display: flex;
  gap: 1rem;
  transform: translateX(-50%);
}

.side-burn-slider__btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.3);
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.side-burn-slider__btn:hover {
  background: rgb(255 255 255 / 0.6);
}

.side-burn-slider__btn:focus {
  outline: none;
}

.side-burn-slider__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
