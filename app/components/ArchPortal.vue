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
  imageScaleStart: {
    type: Number,
    default: 0.3,
  },
  imageScaleEnd: {
    type: Number,
    default: 1.4,
  },
  imageParallaxDuration: {
    type: Number,
    default: 3,
  },
  imageScaleDuration: {
    type: Number,
    default: 3.25,
  },
  sceneText: {
    type: Object,
    default: null,
  },
  burnTo: {
    type: String,
    default: '',
  },
  burnBehind: {
    type: String,
    default: '',
  },
  burnFrom: {
    type: String,
    default: '',
  },
  sketchSpeed: {
    type: Number,
    default: 1.1,
  },
  sketchLead: {
    type: Number,
    default: 0.05,
  },
  behindOpacity: {
    type: Number,
    default: 0.5,
  },
  sketchOpacity: {
    type: Number,
    default: 0.6,
  },
})

const useBurn = computed(() => Boolean(props.burnTo))

provideArchSceneText(toRef(() => props.sceneText))
const { suspended: sceneSuspended } = provideArchSceneControl()

const root = ref(null)
const trackEl = ref(null)
const contentEl = ref(null)
const imageEl = ref(null)
const imageItemEl = ref(null)
const nextSectionEl = ref(null)
const burnScrollRef = ref(null)
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
  const nextSection = nextSectionEl.value
  if (!track || !image || !item) return

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
      { y: 0, ease: 'power2.out', duration: props.imageParallaxDuration },
      0,
    )

    tl.fromTo(
      image,
      { scale: props.imageScaleStart },
      {
        scale: props.imageScaleEnd,
        ease: 'none',
        duration: props.imageScaleDuration,
      },
      props.motionStart,
    )

    if (useBurn.value && nextSection) {
      ScrollTrigger.create({
        trigger: nextSection,
        start: '60% top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          burnScrollRef.value?.setProgress(self.progress)
          sceneSuspended.value = self.progress > 0.4
        },
        onRefresh: (self) => {
          burnScrollRef.value?.setProgress(self.progress)
          sceneSuspended.value = self.progress > 0.4
        },
      })
    } else if (!useBurn.value) {
      tl.fromTo(
        item,
        { opacity: 0.5 },
        { opacity: 1, ease: 'none', duration: props.imageScaleDuration },
        props.motionStart,
      )
    }
  }, root.value)

  ScrollTrigger.refresh()
}

onMounted(async () => {
  await nextTick()
  await setupMotion()

  watch(
    () => burnScrollRef.value?.isReady,
    (ready) => {
      if (ready) {
        ScrollTrigger.refresh()
      }
    },
    { immediate: true },
  )

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        setupMotion()
      }, 100)
    })
    if (contentEl.value) resizeObserver.observe(contentEl.value)
    if (trackEl.value) resizeObserver.observe(trackEl.value)
    if (nextSectionEl.value) resizeObserver.observe(nextSectionEl.value)
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
  <div ref="root" class="arch-portal">
    <CloudParallax archway burn />

    <div
      ref="trackEl"
      class="arch-portal__track"
      :style="{ height: trackPx ? `${trackPx}px` : `${minTrack * 100}svh` }"
    >
      <main ref="contentEl" class="arch-portal__content">
        <slot name="content" />
      </main>
    </div>

    <section
      ref="nextSectionEl"
      class="arch-portal__next"
      :style="{
        height: trackPx ? `${trackPx}px` : `${minTrack * 100}svh`,
        marginTop: trackPx ? `-${trackPx}px` : `-${minTrack * 100}svh`,
      }"
      aria-label="Beyond the arch"
    >
      <div
        ref="imageEl"
        class="arch-portal__image"
      >
        <div ref="imageItemEl" class="arch-portal__image-item">
          <SideBurnScroll
            v-if="useBurn"
            ref="burnScrollRef"
            :to="burnTo"
            :from="burnFrom"
            :behind="burnBehind"
            :sketch-speed="sketchSpeed"
            :sketch-lead="sketchLead"
            :behind-opacity="behindOpacity"
            :sketch-opacity="sketchOpacity"
          >
            <slot name="burn-overlay" />
          </SideBurnScroll>
          <slot v-else name="destination" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.arch-portal {
  position: relative;
  min-height: 100svh;
  background: #fcf4ee;
}

.arch-portal__track {
  position: relative;
  z-index: 2;
}

.arch-portal__content {
  position: relative;
}

.arch-portal__content :deep(.arch-portal__panel) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
}

.arch-portal__next {
  position: relative;
  width: 100%;
  z-index: 0;
  min-height: 100svh;
  margin-bottom: 100svh;
  overflow-x: clip;
  background: #fcf4ee;
}

.arch-portal__image {
  position: sticky;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.arch-portal__image-item {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
