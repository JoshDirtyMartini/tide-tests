<script setup>
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);



onMounted(() => {

  gsap.to('.nextSection--image', {
    scale: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '.nextSection',
      start: 'top 50%',
      end: '65% top',
      scrub: true,
    }
  })
  gsap.to('.nextSection--image-item', {
    opacity: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '.nextSection',
      start: 'top top',
      end: '70% top',
      scrub: true,
    }
  })

  gsap.to('.nextSection--image', {
    translateY: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '.nextSection',
      start: 'top top',
      end: '80% bottom',
      scrub: true,
    }
  })
  

})




</script>



<template>
  <div class="page">
    <CloudParallax archway />

    <main class="content">
      <section class="panel hero">
        <div class="w-screen h-screen flex items-center pl-[60vw]">
          <div class="w-[30vw] h-[60svh] bg-white"></div>
        </div>
      </section>

      <section class="panel">
        <div class="w-screen h-screen flex items-center pl-[10vw]">
          <div class="w-[30vw] h-[60svh] bg-white"></div>
        </div>
      </section>

      <section class="panel">
        <div class="w-screen h-screen flex items-center pl-[60vw]">
          <div class="w-[30vw] h-[60svh] bg-white"></div>
        </div>
      </section>

      <section class="panel"></section>
      <section class="panel"></section>



      <section class="panel" aria-hidden="true"></section>


    </main>

    <section
      class="nextSection relative"
      aria-label="Beyond the arch"
    >
    <div class=" nextSection--image sticky top-0 left-0 w-screen h-screen relative scale-[0.1] translate-y-[50svh] bg-black">
      <img
        src="https://res.cloudinary.com/aenetworks/image/upload/c_fill,ar_1.7777777777777777,w_3840,h_2160,g_auto/dpr_auto/f_auto/q_auto:eco/v1/hith-sistine-chape-2?_a=BAVMn6E80"
        alt="placeholder"
        class="w-full h-full object-cover nextSection--image-item opacity-50"
      />

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

.content {
  position: relative;
  z-index: 2;
  pointer-events: none;
}

.panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
}

.hero {
  max-width: 42rem;
}

.nextSection {
  position: relative;
  width: 100%;
  height: 500svh;
  z-index: 0;
  margin-top: -500svh;
  min-height: 100svh;
  margin-bottom: 100svh;
  background: #fcf4ee;

}
</style>
