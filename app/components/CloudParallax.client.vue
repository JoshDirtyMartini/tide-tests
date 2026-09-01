<script setup>
import { NoToneMapping } from 'three'

defineProps({
  archway: {
    type: Boolean,
    default: false,
  },
  burn: {
    type: Boolean,
    default: false,
  },
})

const enabled = ref(false)
const dpr = ref([1, 1.5])

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches

  dpr.value = coarsePointer ? 1 : [1, 1.5]

  if (reducedMotion) return

  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl')
  enabled.value = Boolean(gl)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<template>
  <TresCanvas
    v-if="enabled"
    clear-color="#00000000"
    :alpha="true"
    :antialias="false"
    :dpr="dpr"
    :tone-mapping="NoToneMapping"
    power-preference="low-power"
    render-mode="always"
    window-size
    class="cloud-canvas"
  >
    <TresPerspectiveCamera :position="[0, 0, 12]" :fov="20" />
    <CloudField v-if="!archway" />
    <CloudFieldArchwayBurn v-else-if="archway && burn" />
    <CloudFieldArchway v-else />
  </TresCanvas>
</template>

<style scoped>
.cloud-canvas {
  position: fixed !important;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
</style>
