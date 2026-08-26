<template>
  <TresCanvas
    clear-color="#FCF4EE"
    :alpha="false"
    window-size
    class="cloud-canvas"
  >
    <TresPerspectiveCamera  :position="[0, 0, 15]" :fov="20" />
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
