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
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three'
import { SIDE_BURN_FRAGMENT_SHADER, SIDE_BURN_VERTEX_SHADER } from '~/utils/sideBurnShader'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

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
const isReady = ref(false)
const loadError = ref('')

const titleRef = ref(null)
const subtitleRef = ref(null)

const showBehind = computed(() => Boolean(props.behind))
const useOpaqueBehind = computed(() => showBehind.value)
const useRevealBehind = computed(() => !showBehind.value && props.revealBehind)

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
let scrollCtx

const loader = new TextureLoader()
loader.setCrossOrigin('anonymous')

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
    const texture = await loader.loadAsync(props.from)
    texture.colorSpace = SRGBColorSpace
    return texture
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

function getScrollTriggerTarget() {
  return rootRef.value?.closest('section') ?? rootRef.value
}

function setupScrollAnimations() {
  scrollCtx?.revert()

  const trigger = getScrollTriggerTarget()
  if (!trigger || !titleRef.value) return

  scrollCtx = gsap.context(() => {
    gsap.to(titleRef.value, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger,
        start: '90% bottom',
        end: '105% bottom',
        scrub: true,
        invalidateOnRefresh: true,
        // markers: true,
      },
    })
    gsap.to(subtitleRef.value, {
      opacity: 1,
      ease: 'none',

      scrollTrigger: {
        trigger,
        start: '95% bottom',
        end: '105% bottom',
        scrub: true,
        invalidateOnRefresh: true,
        // markers: true,
      },
    })
  }, rootRef.value)

  ScrollTrigger.refresh()
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

defineExpose({ setProgress, isReady })

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
    resizeObserver = new ResizeObserver(() => {
      resize()
      ScrollTrigger.refresh()
    })
    resizeObserver.observe(rootRef.value)
    const scrollTarget = getScrollTriggerTarget()
    if (scrollTarget && scrollTarget !== rootRef.value) {
      resizeObserver.observe(scrollTarget)
    }
  }

  try {
    const loads = [
      loadFromTexture(),
      loader.loadAsync(props.to),
    ]
    if (showBehind.value) {
      loads.push(loader.loadAsync(props.behind))
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
    await waitForLayout()
    setupScrollAnimations()
    isReady.value = true
  } catch (error) {
    console.error('[SideBurnScroll] failed to load textures', error)
    loadError.value = 'Could not load images'
  }

 

})

onBeforeUnmount(() => {
  disposed = true
  scrollCtx?.revert()
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
    class="absolute inset-0 overflow-hidden"
    :style="{ backgroundColor: showBehind ? '#000' : baseColor }"
  >
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-fit h-fit text-white text-center  z-10">


    <h1 ref="titleRef" class="text-[3vw] tracking-widest opacity-0">BESPOKE TITLE</h1>
    <span ref="subtitleRef" class="underline underline-offset-4 text-[0.7vw] font-thin tracking-widest opacity-0">DISCOVER BESPOKE</span>


  </div>
    <img
      v-if="behind && !isReady && !loadError"
      :src="behind"
      alt=""
      class="absolute inset-0 w-full h-full object-cover grayscale "
      draggable="false"
    >

    <img
      v-if="!isReady && !loadError && from"
      :src="from"
      alt=""
      class="absolute inset-0 w-full h-full object-cover grayscale "
      draggable="false"
    >

    <canvas
      ref="canvasRef"
      class="absolute inset-0 block w-full h-full"
      :class="{ 'opacity-0': !isReady, 'opacity-100': isReady }"
    />

    <p
      v-if="loadError"
      class="absolute inset-0 flex items-center justify-center text-white/70 text-sm"
    >
      {{ loadError }}
    </p>
  </div>
</template>
