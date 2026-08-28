<script setup>
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({

  minTrack: {
    type: Number,
    default: 6,
  },
  motionStart: {
    type: Number,
    default: 0.05,
  },
  sceneText: {
    type: Object,
    default: null,
  },
})

provideArchSceneText(toRef(() => props.sceneText))

const root = ref(null)
const trackEl = ref(null)
const contentEl = ref(null)
const imageEl = ref(null)
const imageItemEl = ref(null)
const trackPx = ref(0)

let ctx
let resizeObserver
let resizeTimer

function syncTrack() {
  const contentH = contentEl.value?.scrollHeight ?? 0
  const minH = props.minTrack * window.innerHeight
  trackPx.value = Math.max(contentH, minH)
}

async function setupMotion() {
  ctx?.revert()
  syncTrack()
  await nextTick()

  const track = trackEl.value
  const image = imageEl.value
  const item = imageItemEl.value
  if (!track || !image || !item) return

  const motionDur = 1 - props.motionStart

  ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
      },
    })

    tl.fromTo(
      image,
      { y: () => window.innerHeight * 1.5 },
      { y: 0, ease: 'power2.out', duration: 1  },
      0,
    )

    tl.fromTo(
      image,
      { scale: 0.5 },
      { scale: 1, ease: 'none', duration: motionDur - 0.32 },
      props.motionStart + 0.15,
    )

    tl.fromTo(
      item,
      { opacity: 0.5 },
      { opacity: 1, ease: 'none', duration: motionDur },
      props.motionStart,
    )
  }, root.value)

  ScrollTrigger.refresh()
}

onMounted(async () => {
  await nextTick()
  await setupMotion()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        setupMotion()
      }, 100)
    })
    if (contentEl.value) resizeObserver.observe(contentEl.value)
    if (trackEl.value) resizeObserver.observe(trackEl.value)
  }

  window.addEventListener('resize', setupMotion, { passive: true })
})

onBeforeUnmount(() => {
  clearTimeout(resizeTimer)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', setupMotion)
  ctx?.revert()
})
</script>

<template>
  <div ref="root" class="page">
    <CloudParallax archway />

    <div
      ref="trackEl"
      class="track"
      :style="{ height: trackPx ? `${trackPx}px` : `${minTrack * 100}svh` }"
    >
      <main ref="contentEl" class="content">
        <slot name="content" />
      </main>
    </div>

    <section
      class="nextSection relative"
      :style="{
        height: trackPx ? `${trackPx}px` : `${minTrack * 100}svh`,
        marginTop: trackPx ? `-${trackPx}px` : `-${minTrack * 100}svh`,
      }"
      aria-label="Beyond the arch"
    >
      <div
        ref="imageEl"
        class="nextSection--image sticky top-0 left-0 w-screen h-screen relative bg-black"
      >
        <div ref="imageItemEl" class="nextSection--image-item w-full h-full">
          <slot name="destination" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  position: relative;
  min-height: 100svh;
  background: #fcf4ee;
}

.track {
  position: relative;
  z-index: 2;
}

.content {
  position: relative;
}

.content :deep(.panel) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
}

.nextSection {
  position: relative;
  width: 100%;
  z-index: 0;
  min-height: 100svh;
  margin-bottom: 100svh;
  background: #fcf4ee;
}
</style>
