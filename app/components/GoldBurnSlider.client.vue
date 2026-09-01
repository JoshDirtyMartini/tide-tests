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

const props = defineProps({
  images: {
    type: Array,
    required: true,
  },
  duration: {
    type: Number,
    default: 1.3,
  },
  burnDuration: {
    type: Number,
    default: 1.7,
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

const textureCache = new Map()
const loader = new TextureLoader()
loader.setCrossOrigin('anonymous')

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const START_ZOOM = 1.5
const REST_ZOOM = 1.0

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress;
uniform float uZoomProgress;
uniform float uRestZoom;
uniform vec2 uResolution;
varying vec2 vUv;

const float START_ZOOM = ${START_ZOOM.toFixed(1)};
const float REST_ZOOM = ${REST_ZOOM.toFixed(1)};

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

vec2 zoomUv(vec2 uv, float zoom) {
  return (uv - 0.5) / max(zoom, 1.0) + 0.5;
}

void main() {
  vec2 uv = vUv;
  float t = clamp(uProgress, 0.0, 1.0);
  float z = clamp(uZoomProgress, 0.0, 1.0);

  if (t <= 0.0 && z <= 0.0) {
    gl_FragColor = texture2D(uFrom, zoomUv(uv, uRestZoom));
    return;
  }

  float fromZoom = uRestZoom;
  float toZoom = mix(START_ZOOM, REST_ZOOM, z);
  vec4 from = texture2D(uFrom, zoomUv(uv, fromZoom));
  vec4 to = texture2D(uTo, zoomUv(uv, toZoom));

  if (t <= 0.0) {
    gl_FragColor = from;
    return;
  }
  if (t >= 1.0) {
    gl_FragColor = to;
    return;
  }

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);

  float edgeLife = t * (1.0 - t) * 4.0;

  vec2 drift = vec2(
    fbm(uv * 2.8 + vec2(t * 0.35, 1.7)),
    fbm(uv * 2.8 + vec2(5.1, t * 0.35))
  );
  vec2 warped = centered + (drift - 0.5) * 0.12 * edgeLife;
  float dist = length(warped);

  float n = fbm(uv * 4.2 + t * 0.55);
  float n2 = fbmRich(warped * 2.6 + t * 0.3);
  float grain = valueNoise(uv * 14.0 + t * 1.2);

  float maxDist = length(vec2(aspect * 0.5, 0.5)) * 1.14;
  float radius = t * maxDist;

  float field = dist - radius;
  field -= (n - 0.5) * 0.2 * edgeLife;
  field -= (n2 - 0.5) * 0.12 * edgeLife;
  field -= (grain - 0.5) * 0.06 * edgeLife;

  float feather = max(0.004, 0.2 * t);
  float reveal = 1.0 - smoothstep(0.0, feather, field);
  reveal = max(reveal, smoothstep(0.94, 1.0, t));

  float edge = smoothstep(0.18, 0.0, abs(field)) * edgeLife;
  float flicker = 0.96 + 0.04 * sin(t * 12.0 + n * 6.0);

  vec3 F0 = vec3(0.88, 0.68, 0.38);
  vec3 hot = vec3(0.95, 0.84, 0.62);
  vec3 ash = vec3(0.18, 0.12, 0.08);
  vec3 emberEnv = mix(vec3(0.08, 0.05, 0.03), vec3(0.65, 0.52, 0.32), n);

  float charring = smoothstep(0.28, -0.03, field) * (1.0 - reveal) * edgeLife;
  vec3 fromBurned = mix(from.rgb, ash, charring * 0.28);
  fromBurned = mix(fromBurned, F0, charring * 0.18);
  fromBurned += emberEnv * charring * 0.08;

  vec3 color = mix(fromBurned, to.rgb, reveal);

  float specSharp = pow(edge, 2.4) * flicker;
  float specBroad = pow(edge, 5.0) * grain;
  color += hot * specSharp * 0.45;
  color += F0 * specBroad * 0.22;
  color += vec3(0.98, 0.94, 0.86) * pow(edge, 12.0) * 0.25;

  gl_FragColor = vec4(color, 1.0);
}
`

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

function preloadTextures() {
  return Promise.all(props.images.map((url) => loadTexture(url)))
}

function resize() {
  if (!renderer || !material) return false

  const size = getSize()
  if (!size) return false

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(size.width, size.height, false)
  material.uniforms.uResolution.value.set(
    size.width * dpr,
    size.height * dpr,
  )
  renderFrame()
  return true
}

function renderFrame() {
  if (!renderer || !scene || !camera || disposed) return
  renderer.render(scene, camera)
}

function setTextures(fromIndex, toIndex) {
  material.uniforms.uFrom.value = textureCache.get(props.images[fromIndex])
  material.uniforms.uTo.value = textureCache.get(props.images[toIndex])
  material.uniforms.uProgress.value = 0
  material.uniforms.uZoomProgress.value = 0
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
  material.uniforms.uRestZoom.value = REST_ZOOM
  material.uniforms.uProgress.value = 0
  material.uniforms.uZoomProgress.value = 0
  currentIndex.value = nextIndex
  isTransitioning.value = false
  renderFrame()
}

async function transitionTo(nextIndex) {
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

  setTextures(fromIndex, nextIndex)
  renderFrame()

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    finishTransition(nextIndex)
    return
  }

  transitionTimeline = gsap.timeline({
    onUpdate: renderFrame,
    onComplete: () => finishTransition(nextIndex),
  })

  transitionTimeline.fromTo(
    material.uniforms.uZoomProgress,
    { value: 0 },
    {
      value: 1,
      duration: props.duration,
      ease: 'power2.out',
      immediateRender: false,
    },
    0,
  )

  transitionTimeline.fromTo(
    material.uniforms.uProgress,
    { value: 0 },
    {
      value: 1,
      duration: props.burnDuration,
      ease: 'power2.inOut',
      immediateRender: false,
    },
    0,
  )
}

function prevImage() {
  transitionTo((currentIndex.value - 1 + props.images.length) % props.images.length)
}

function nextImage() {
  transitionTo((currentIndex.value + 1) % props.images.length)
}

function onWindowResize() {
  resize()
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
      uProgress: { value: 0 },
      uZoomProgress: { value: 0 },
      uRestZoom: { value: 1 },
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
  window.addEventListener('resize', onWindowResize, { passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(rootRef.value)
  }

  try {
    await preloadTextures()
    if (disposed) return

    const first = textureCache.get(props.images[0])
    material.uniforms.uFrom.value = first
    material.uniforms.uTo.value = first
    material.uniforms.uProgress.value = 0
    material.uniforms.uZoomProgress.value = 0

    resize()
    isReady.value = true
    renderFrame()
  } catch (error) {
    console.error('[GoldBurnSlider] failed to load textures', error)
    loadError.value = 'Could not load images'
  }
})

onBeforeUnmount(() => {
  disposed = true
  killTransition()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', onWindowResize)

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
  <div ref="rootRef" class="absolute inset-0 overflow-hidden bg-black">
    <img
      v-if="!isReady && !loadError"
      :src="images[0]"
      alt=""
      class="absolute inset-0 w-full h-full object-cover"
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

    <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-10">
      <button
        class="px-4 py-2 rounded-full bg-white/30 hover:bg-white/60 focus:outline-none transition disabled:opacity-40"
        :disabled="isTransitioning || !isReady"
        aria-label="Previous image"
        @click="prevImage"
      >
        &#8592;
      </button>
      <button
        class="px-4 py-2 rounded-full bg-white/30 hover:bg-white/60 focus:outline-none transition disabled:opacity-40"
        :disabled="isTransitioning || !isReady"
        aria-label="Next image"
        @click="nextImage"
      >
        &#8594;
      </button>
    </div>
  </div>
</template>
