// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@tresjs/nuxt', 'lenis/nuxt'],
  css: ['~/assets/css/main.css'],
  tres: {
    devtools: process.env.NODE_ENV === 'development',
  },
})
