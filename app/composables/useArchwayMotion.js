import { PerspectiveCamera, Vector3 } from 'three'

export const ARCHWAY_MOTION = {
  SCROLL_TRAVEL: 20,
  TRAVEL_END: 0.8,
  ZOOM_START: 0.5,
  CAMERA_Z: 12,
  ZOOM_AMOUNT: 30,
  FOV: 20,
}

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1)
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function smoothstep01(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

const pointer = { x: 10, y: 10 }
const smooth = reactive({ x: 10, y: 10, scroll: 0 })
const frame = ref(0)
const liveCamera = shallowRef(null)

let targetScroll = 0
let hasPointer = false
let refCount = 0
let renderSyncRefCount = 0
let rafId = null
let scrollTriggerEl = null

const tmpCamera = new PerspectiveCamera()
const tmpVector = new Vector3()


function readScrollProgress() {
  if (typeof window === 'undefined') return

  if (scrollTriggerEl) {
    const rect = scrollTriggerEl.getBoundingClientRect()
    const range = window.innerHeight + rect.height
    targetScroll = range > 0 ? clamp01((window.innerHeight / 2 - rect.top) / range) : 0
    return
  }

  const max = document.documentElement.scrollHeight - window.innerHeight
  targetScroll = max > 0 ? window.scrollY / max : 0
}

function tick() {
  smooth.x += (pointer.x - smooth.x) * 0.07
  smooth.y += (pointer.y - smooth.y) * 0.07
  smooth.scroll = targetScroll
  if (renderSyncRefCount === 0) frame.value++
  rafId = requestAnimationFrame(tick)
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  if (!hasPointer) {
    smooth.x = pointer.x
    smooth.y = pointer.y
    hasPointer = true
  }
}

function onScroll() {
  readScrollProgress()
}

function start() {
  if (typeof window === 'undefined' || rafId) return
  readScrollProgress()
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', readScrollProgress, { passive: true })
  rafId = requestAnimationFrame(tick)
}

function stop() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', readScrollProgress)
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
}

function getTravelScroll(scroll = smooth.scroll) {
  const travelT = clamp01(scroll / Math.max(ARCHWAY_MOTION.TRAVEL_END, 1e-4))
  return easeOutCubic(travelT) * ARCHWAY_MOTION.TRAVEL_END
}

function getZoom(scroll = smooth.scroll) {
  return smoothstep01(
    (scroll - ARCHWAY_MOTION.ZOOM_START) / Math.max(1 - ARCHWAY_MOTION.ZOOM_START, 1e-4),
  )
}

function getCameraZ(scroll = smooth.scroll) {
  return ARCHWAY_MOTION.CAMERA_Z - getZoom(scroll) * ARCHWAY_MOTION.ZOOM_AMOUNT
}

function getWorldPosition(config, scroll = smooth.scroll) {
  const mouseAmp = config.mouseAmp ?? 0
  const scrollSpeed = config.scrollSpeed ?? 0.5
  const travelScroll = getTravelScroll(scroll)

  return {
    x: config.x + smooth.x * mouseAmp,
    y:
      config.y +
      travelScroll * ARCHWAY_MOTION.SCROLL_TRAVEL * scrollSpeed +
      smooth.y * mouseAmp * 0.55,
    z: config.z ?? 0,
  }
}

function getPerspectiveScale(z, cameraZ) {
  const currentDepth = cameraZ - z
  const baseDepth = ARCHWAY_MOTION.CAMERA_Z - z
  if (currentDepth <= 0.1) return 8
  return Math.max(0.05, Math.min(8, baseDepth / currentDepth))
}

function getProjectionCamera(cameraZ = getCameraZ()) {
  if (liveCamera.value) return liveCamera.value

  tmpCamera.fov = ARCHWAY_MOTION.FOV
  tmpCamera.aspect = window.innerWidth / Math.max(window.innerHeight, 1)
  tmpCamera.near = 0.1
  tmpCamera.far = 1000
  tmpCamera.position.set(0, 0, cameraZ)
  tmpCamera.rotation.set(0, 0, 0)
  tmpCamera.updateProjectionMatrix()
  tmpCamera.updateMatrixWorld(true)
  return tmpCamera
}

function projectWorldPoint(x, y, z, cameraZ = getCameraZ()) {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0, scale: 1 }
  }

  const cam = getProjectionCamera(cameraZ)
  const cz = cam.position.z

  tmpVector.set(x, y, z)
  tmpVector.project(cam)

  return {
    x: (tmpVector.x * 0.5 + 0.5) * window.innerWidth,
    y: (-tmpVector.y * 0.5 + 0.5) * window.innerHeight,
    scale: getPerspectiveScale(z, cz),
  }
}

function projectAnchor(config) {
  const world = getWorldPosition(config)
  return projectWorldPoint(world.x, world.y, world.z)
}

export function setArchwayCamera(camera) {
  liveCamera.value = camera
}

export function setArchwayScrollTrigger(el) {
  scrollTriggerEl = el ?? null
  readScrollProgress()
}

export function refreshArchwayScrollProgress() {
  readScrollProgress()
}

export function registerArchwayRenderSync() {
  renderSyncRefCount++
}

export function unregisterArchwayRenderSync() {
  renderSyncRefCount = Math.max(0, renderSyncRefCount - 1)
}

export function notifyArchwayRenderSync() {
  frame.value++
}

export function useArchwayMotion() {
  onMounted(() => {
    refCount++
    if (refCount === 1) start()
  })

  onBeforeUnmount(() => {
    refCount--
    if (refCount === 0) stop()
  })

  const travelScroll = computed(() => getTravelScroll())
  const zoom = computed(() => getZoom())
  const cameraZ = computed(() => getCameraZ())

  return {
    smooth,
    frame,
    pointer,
    travelScroll,
    zoom,
    cameraZ,
    getWorldPosition,
    projectAnchor,
    ARCHWAY_MOTION,
  }
}
