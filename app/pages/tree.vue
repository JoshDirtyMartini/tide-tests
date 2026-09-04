<template>
  <div class="tree-page">
    <img
      v-if="showFallback"
      src="/tree.png"
      alt="tree"
      class="tree-page__fallback"
    >
    <TreeImageHover
      v-else
      src="/tree.png"
      depth-src="/tree-depth.png"
      :depth-strength="1"
      @failed="webGLFailed = true"
    />
  </div>
</template>

<script setup>
const useWebGL = ref(false)
const webGLFailed = ref(false)

const showFallback = computed(() => !useWebGL.value || webGLFailed.value)

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) return

  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl')
  useWebGL.value = Boolean(gl)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<style scoped>
.tree-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.tree-page__fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
