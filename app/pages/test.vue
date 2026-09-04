<template>
  <div class="test-page">
    <CloudParallax />

    <main class="test-page__content">
      <section class="test-page__panel test-page__panel--hero">
        <div class="test-page__row test-page__row--right">
          <div class="test-page__block" />
        </div>
      </section>

      <section class="test-page__panel">
        <div class="test-page__row test-page__row--left">
          <div class="test-page__block" />
        </div>
      </section>

      <section class="test-page__panel" />

      <section class="test-page__panel">
        <div class="test-page__row test-page__row--right">
          <div class="test-page__block" />
        </div>
      </section>

      <section class="test-page__panel" />
      <section class="test-page__panel" />
      <section class="test-page__panel" />
      <section class="test-page__panel" />
    </main>
  </div>
</template>

<style scoped>
.test-page {
  position: relative;
  min-height: 100svh;
  background: transparent;
}

.test-page__content {
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.test-page__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100svh;
}

.test-page__panel--hero {
  max-width: 42rem;
}

.test-page__row {
  display: flex;
  align-items: center;
  width: 100vw;
  height: 100vh;
}

.test-page__row--right {
  padding-left: 60vw;
}

.test-page__row--left {
  padding-left: 10vw;
}

.test-page__block {
  width: 30vw;
  height: 60svh;
  background: #fff;
}

.test-page__eyebrow {
  margin: 0 0 0.75rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6b5344;
}

.test-page__title,
.test-page__heading {
  margin: 0 0 1rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  font-weight: 500;
  color: #2c2118;
  line-height: 1.05;
}

.test-page__title {
  font-size: clamp(2.6rem, 7vw, 4.8rem);
}

.test-page__heading {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.test-page__lede,
.test-page__panel p {
  margin: 0;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: clamp(1rem, 2.2vw, 1.15rem);
  line-height: 1.55;
  color: #4a3a2f;
  max-width: 28rem;
}
</style>
