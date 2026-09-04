<template>
  <div class="slider-page">
    <GoldBurnSlider :images="images" />
  </div>
</template>

<script setup>
const images = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1465101162946-4377e57745c3?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80',
]
</script>

<style scoped>
.slider-page {
  position: relative;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  background: #000;
}
</style>
