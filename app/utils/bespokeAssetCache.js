import { SRGBColorSpace, TextureLoader } from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { BESPOKE_SCENE_GLBS, getSceneTextFontLoads } from '~/config/bespokeAssets'

const gltfCache = new Map()
const textureCache = new Map()

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

const textureLoader = new TextureLoader()
textureLoader.setCrossOrigin('anonymous')

export function preloadGltf(src) {
  if (!src) return Promise.resolve(null)
  if (!gltfCache.has(src)) {
    gltfCache.set(src, gltfLoader.loadAsync(src))
  }
  return gltfCache.get(src)
}

export function preloadTexture(src) {
  if (!src) return Promise.resolve(null)
  if (!textureCache.has(src)) {
    textureCache.set(
      src,
      textureLoader.loadAsync(src).then((texture) => {
        texture.colorSpace = SRGBColorSpace
        return texture
      }),
    )
  }
  return textureCache.get(src)
}

export function getCachedGltf(src) {
  return gltfCache.get(src) ?? null
}

export function getCachedTexture(src) {
  return textureCache.get(src) ?? null
}

export async function preloadBespokeExperience({
  sceneText,
  destinationImage = '',
  burnTo = '',
  burnBehind = '',
  burnFrom = '',
} = {}) {
  await Promise.all([
    ...BESPOKE_SCENE_GLBS.map(preloadGltf),
    preloadTexture(destinationImage),
    preloadTexture(burnTo),
    preloadTexture(burnBehind),
    preloadTexture(burnFrom),
    ...getSceneTextFontLoads(sceneText),
  ])
}
