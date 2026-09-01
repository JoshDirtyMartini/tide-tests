export const ARCH_CLOUD_OPACITY_KEY = Symbol('archCloudOpacity')

export function provideArchCloudOpacity(opacity) {
  provide(ARCH_CLOUD_OPACITY_KEY, opacity)
}

export function useArchCloudOpacity() {
  return inject(ARCH_CLOUD_OPACITY_KEY, ref(1))
}
