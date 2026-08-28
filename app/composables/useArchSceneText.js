export const ARCH_SCENE_TEXT_KEY = Symbol('archSceneText')

export function provideArchSceneText(config) {
  provide(ARCH_SCENE_TEXT_KEY, config)
}

export function useArchSceneText() {
  return inject(ARCH_SCENE_TEXT_KEY, ref(null))
}
