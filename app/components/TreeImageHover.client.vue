<script setup>
import { NoToneMapping } from 'three'

defineProps({
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

const rootRef = ref(null)
const enabled = ref(false)
const dpr = ref(1)
const isHovering = ref(false)
const pointer = reactive({ x: 10, y: 10 })

provide('treeHoverActive', isHovering)
provide('treePointer', pointer)

function onPlaneFailed() {
  emit('failed')
}

function updatePointer(event) {
  const el = rootRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function onPointerEnter(event) {
  updatePointer(event)
  isHovering.value = true
}

function onPointerMove(event) {
  isHovering.value = true
  updatePointer(event)
}

function onPointerLeave() {
  isHovering.value = false
}

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches

  dpr.value = coarsePointer ? 1 : [1, 1.25]

  if (reducedMotion) return

  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl')
  enabled.value = Boolean(gl)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<template>
  <div
    ref="rootRef"
    class="tree-stage"
    @pointerenter="onPointerEnter"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <TresCanvas
      v-if="enabled"
      clear-color="#000000"
      :alpha="false"
      :antialias="false"
      :dpr="dpr"
      :tone-mapping="NoToneMapping"
      power-preference="low-power"
      render-mode="on-demand"
      class="tree-canvas"
    >
      <TresPerspectiveCamera :position="[0, 0, 12]" :fov="20" />
      <TreeImagePlane
        :src="src"
        :depth-src="depthSrc"
        :depth-strength="depthStrength"
        @failed="onPlaneFailed"
      />
    </TresCanvas>
  </div>
</template>

<style scoped>
.tree-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tree-canvas {
  width: 100% !important;
  height: 100% !important;
}

.tree-canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
