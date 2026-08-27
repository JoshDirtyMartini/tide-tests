<template>
  <div class="page">

    <section class="nextSection flex items-center justify-center" aria-label="Beyond the arch">
      <img src="https://res.cloudinary.com/aenetworks/image/upload/c_fill,ar_1.7777777777777777,w_3840,h_2160,g_auto/dpr_auto/f_auto/q_auto:eco/v1/hith-sistine-chape-2?_a=BAVMn6E80" alt="placeholder" class="w-full h-full absolute top-0 left-0" />
      <h1 class="text-white text-4xl font-bold">birds n that</h1>
    </section>

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
      <section class="panel"></section>
      <section class="panel"></section>
      <section class="panel"></section>
      <section class="panel" aria-hidden="true"></section>
    </main>
  </div>
</template>

<style scoped>
.page {
  position: relative;
  min-height: 100svh;
  background: #fcf4ee;
}

.nextSection {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #0a0a0a;
  pointer-events: none;
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
</style>
