<template>
  <div
    v-if="!ready"
    class="bespoke bespoke--loading"
    aria-busy="true"
    aria-label="Loading experience"
  />

  <ArchPortal
    v-else
    :scene-text="sceneText"
  >
    <template #content>
      <div class="bespoke__panel bespoke__panel--right" />
      <div class="bespoke__panel bespoke__panel--left" />
      <div class="bespoke__panel bespoke__panel--right" />
    </template>

    <template #destination>
      <img
        :src="destinationImage"
        alt=""
        class="bespoke__destination"
      >
    </template>
  </ArchPortal>
</template>

<script setup>
import { preloadBespokeExperience } from '~/utils/bespokeAssetCache'

const sceneText = {
  lines: [
    { text: 'HEADING ABOUT BESPOKE', size: 0.07, weight: 300, y: 0.22 },
    { text: 'BESPOKE', size: 0.38, weight: 400, y: -0.18, letterSpacing: 0.12 },
  ],
  x: 0,
  y: -14,
  z: -1,
  scrollSpeed: 0.95,
  mouseAmp: 0.1,
  color: '#C29A65',
}

const destinationImage = '/placeholder.webp'

const ready = ref(false)

onMounted(async () => {
  await preloadBespokeExperience({ sceneText, destinationImage })
  ready.value = true
})
</script>

<style scoped>
.bespoke--loading {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #fcf4ee;
}

.bespoke__panel {
  width: 30vw;
  height: 70svh;
  background: #fff;
}

.bespoke__panel--right {
  margin-left: 60vw;
  margin-block: 30svh;
}

.bespoke__panel--left {
  margin-left: 10vw;
  margin-bottom: 30svh;
}

.bespoke__destination {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
