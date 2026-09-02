<template>
  <div
    v-if="!ready"
    class="fixed inset-0 z-50 bg-[#fcf4ee]"
    aria-busy="true"
    aria-label="Loading experience"
  />

  <ArchPortal
    v-else
    :scene-text="sceneText"
    :burn-to="burnTo"
    :burn-behind="burnBehind"
    :behind-opacity="0.25"
    :sketch-opacity="0.6"
  >
    <template #content>
      <div class="w-[30vw] h-[70svh] bg-white ml-[60vw] my-[30svh]" />
      <div class="w-[30vw] h-[70svh] bg-white ml-[10vw] mb-[30svh]" />
      <div class="w-[30vw] h-[70svh] bg-white ml-[60vw] my-[30svh]" />
    </template>

    <template #burn-overlay>
      <h1
        class="text-[3vw] tracking-widest opacity-0"
        data-scroll-reveal
        data-start="90% bottom"
        data-end="105% bottom"
      >
        BESPOKE TITLE
      </h1>
      <span
        class="text-[0.7vw] font-thin tracking-widest underline underline-offset-4 opacity-0"
        data-scroll-reveal
        data-start="95% bottom"
        data-end="105% bottom"
      >
        DISCOVER BESPOKE
      </span>
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

const burnTo = '/placeholder.webp'
const burnBehind = '/placeholder.webp'

const ready = ref(false)

onMounted(async () => {
  await preloadBespokeExperience({ sceneText, burnTo, burnBehind })
  ready.value = true
})
</script>
