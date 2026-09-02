export const ARCH_SCENE_CONTROL_KEY = Symbol('archSceneControl')

function detectReducedEffects() {
  if (typeof window === 'undefined') return false

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const cores = navigator.hardwareConcurrency ?? 8
  const memory = navigator.deviceMemory ?? 8

  return coarse || reducedMotion || cores <= 4 || memory <= 4
}

export function provideArchSceneControl() {
  const suspended = ref(false)
  const reducedEffects = ref(detectReducedEffects())
  const ready = ref(false)

  provide(ARCH_SCENE_CONTROL_KEY, { suspended, reducedEffects, ready })

  return { suspended, reducedEffects, ready }
}

export function useArchSceneControl() {
  return inject(ARCH_SCENE_CONTROL_KEY, {
    suspended: ref(false),
    reducedEffects: ref(false),
    ready: ref(false),
  })
}
