<script setup>
import { NoToneMapping } from 'three'

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
    clear-color="#FCF4EE"
    :alpha="false"
    :antialias="false"
    :dpr="dpr"
    :tone-mapping="NoToneMapping"
    power-preference="low-power"
    render-mode="always"
    window-size
    class="cloud-canvas"
  >
    <TresPerspectiveCamera :position="[0, 0, 15]" :fov="20" />
    <CloudField />
  </TresCanvas>
</template>

<style scoped>
.cloud-canvas {
  position: fixed !important;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
