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
    </main>
  </div>
</template>

<style scoped>
.page {
  position: relative;
  min-height: 100svh;
  background: transparent;
}

.content {
  position: relative;
  z-index: 1;
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

.eyebrow {
  margin: 0 0 0.75rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6b5344;
}

h1,
h2 {
  margin: 0 0 1rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  font-weight: 500;
  color: #2c2118;
  line-height: 1.05;
}

h1 {
  font-size: clamp(2.6rem, 7vw, 4.8rem);
}

h2 {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.lede,
.panel p {
  margin: 0;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: clamp(1rem, 2.2vw, 1.15rem);
  line-height: 1.55;
  color: #4a3a2f;
  max-width: 28rem;
}
</style>
