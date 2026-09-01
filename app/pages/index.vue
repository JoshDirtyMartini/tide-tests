<template>
  <ArchPortal
    :scene-text="sceneText"
    :burn-to="burnTo"
    :burn-behind="burnBehind"
  >
    <template #content>
      <div class="w-[30vw] h-[70svh] bg-white ml-[60vw] my-[30svh]" />

      <div class="w-[30vw] h-[70svh] bg-white ml-[10vw] mb-[30svh]" />
      <div class="w-[30vw] h-[70svh] bg-white ml-[60vw] my-[30svh]" />
    </template>
  </ArchPortal>
</template>

<script setup>
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

const burnTo = 'https://res.cloudinary.com/aenetworks/image/upload/c_fill,ar_1.7777777777777777,w_3840,h_2160,g_auto/dpr_auto/f_auto/q_auto:eco/v1/hith-sistine-chape-2?_a=BAVMn6E80'
const burnBehind = 'https://res.cloudinary.com/aenetworks/image/upload/c_fill,ar_1.7777777777777777,w_3840,h_2160,g_auto/dpr_auto/f_auto/q_auto:eco/v1/hith-sistine-chape-2?_a=BAVMn6E80' 
</script>
