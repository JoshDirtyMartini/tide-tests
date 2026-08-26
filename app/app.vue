<script setup>
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { VueLenis } from 'lenis/vue'

gsap.registerPlugin(ScrollTrigger)

const lenisRef = ref(null)

watchEffect((onInvalidate) => {
  const lenis = unref(lenisRef.value?.lenis)
  if (!lenis) return

  lenis.on('scroll', ScrollTrigger.update)

  function update(time) {
    lenis.raf(time * 1000)
  }

  gsap.ticker.add(update)
  gsap.ticker.lagSmoothing(0)

  onInvalidate(() => {
    lenis.off('scroll', ScrollTrigger.update)
    gsap.ticker.remove(update)
  })
})
</script>

<template>
  <VueLenis root ref="lenisRef" :auto-raf="false">
    <NuxtPage />
  </VueLenis>
</template>
