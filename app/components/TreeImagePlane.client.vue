<script setup>
import { useLoop, useTres } from '@tresjs/core'
import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { applyCloudHoverMaterial } from '~/utils/cloudHoverMaterial'
import { useCloudHoverMotion } from '~/composables/useCloudHoverMotion'

const props = defineProps({
  src: {
    type: String,
    default: '/tree.png',
  },
  depthSrc: {
    type: String,
    default: '',
  },
  depthStrength: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['failed'])

const isHovering = inject('treeHoverActive', ref(false))
const pointer = inject('treePointer', reactive({ x: 10, y: 10 }))
const BASE_OPACITY = 1
const HOVER_OPACITY = 0.45
const BRIGHTNESS = 1.1
const CAMERA_Z = 12
const loadFailed = ref(false)
const imageMesh = shallowRef(null)
const hoverTime = { value: 0 }

let disposed = false
let elapsed = 0
let texture
let depthTexture
let geometry
let material

const { invalidate, camera } = useTres()
const { onBeforeRender } = useLoop()

const {
  waterMouse,
  waterVelocity,
  waterResolution,
  waterMotion,
  waterTrail,
  trailIsActive,
  update: updateHoverMotion,
} = useCloudHoverMotion(pointer, {
  active: isHovering,
  fluidHover: true,
  followEase: 0.09,
  velocityEase: 0.05,
  velocityDecay: 0.96,
  motionFadeIn: 0.1,
  motionFadeOut: 0.38,
  stillDelay: 0,
  trailMinStep: 0.007,
  trailDecay: 0.28,
})

function requestFrame(frames = 1) {
  if (disposed || (typeof document !== 'undefined' && document.hidden)) return
  invalidate(frames)
}

watch(isHovering, () => requestFrame(2))

watch(
  () => [pointer.x, pointer.y],
  () => {
    if (isHovering.value) requestFrame(2)
  },
)

function getCoverSize(cam, imageAspect) {
  const distance = CAMERA_Z - 0
  const vFov = (cam.fov * Math.PI) / 180
  const viewHeight = 2 * Math.tan(vFov / 2) * distance
  const viewWidth = viewHeight * cam.aspect
  const viewAspect = viewWidth / viewHeight

  if (viewAspect > imageAspect) {
    return { width: viewWidth, height: viewWidth / imageAspect }
  }
  return { width: viewHeight * imageAspect, height: viewHeight }
}

function fitPlaneToView() {
  const mesh = imageMesh.value
  const cam = camera.value
  if (!mesh || !cam || !texture?.image) return

  const imageAspect = texture.image.width / Math.max(texture.image.height, 1)
  const { width, height } = getCoverSize(cam, imageAspect)
  mesh.scale.set(width, height, 1)
}

async function loadImagePlane() {
  try {
    const loader = new TextureLoader()
    texture = await loader.loadAsync(props.src)
    if (disposed) return

    texture.colorSpace = SRGBColorSpace

    if (props.depthSrc) {
      try {
        depthTexture = await loader.loadAsync(props.depthSrc)
      } catch (error) {
        console.warn('[TreeImagePlane] depth map not found, continuing without it', error)
      }
    }

    const baseMat = new MeshBasicMaterial({ map: texture })
    material = applyCloudHoverMaterial(baseMat, {
      opacity: BASE_OPACITY,
      hoverOpacity: HOVER_OPACITY,
      brightness: BRIGHTNESS,
      depthMap: depthTexture,
      depthStrength: props.depthStrength,
      fluidCursor: true,
      opaque: true,
      timeUniform: hoverTime,
      depthWrite: false,
      motionUniform: waterMotion,
      mouseUniform: waterMouse,
      velocityUniform: waterVelocity,
      resolutionUniform: waterResolution,
      trailUniform: waterTrail,
    })

    geometry = new PlaneGeometry(1, 1)
    const mesh = new Mesh(geometry, material)
    imageMesh.value = mesh
    fitPlaneToView()
    nextTick(() => requestFrame(4))
  } catch (error) {
    console.error('[TreeImagePlane] failed to load image', error)
    loadFailed.value = true
    emit('failed')
  }
}

loadImagePlane()

let removeVisibility
let removeResize

onMounted(() => {
  const onResize = () => {
    fitPlaneToView()
    requestFrame()
  }
  window.addEventListener('resize', onResize, { passive: true })
  removeResize = () => window.removeEventListener('resize', onResize)

  const onVisibility = () => {
    if (!document.hidden) requestFrame()
  }
  document.addEventListener('visibilitychange', onVisibility)
  removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility)
  requestFrame(2)
})

onBeforeUnmount(() => {
  disposed = true
  removeVisibility?.()
  removeResize?.()
  geometry?.dispose()
  material?.dispose()
  texture?.dispose()
  depthTexture?.dispose()
  imageMesh.value = null
})

onBeforeRender(({ delta, renderer }) => {
  if (disposed || (typeof document !== 'undefined' && document.hidden)) return
  elapsed += delta
  hoverTime.value = elapsed
  updateHoverMotion({ delta, renderer })
  const speed = Math.hypot(waterVelocity.value.x, waterVelocity.value.y)
  if (isHovering.value || speed > 0.015 || waterMotion.value > 0.01 || trailIsActive()) {
    requestFrame()
  }
})

watch(imageMesh, (mesh) => {
  if (mesh) requestFrame(4)
}, { immediate: true })
</script>

<template>
  <primitive v-if="imageMesh" :object="imageMesh" />
</template>
