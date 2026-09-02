export const BESPOKE_SCENE_GLBS = [
  '/clouds.glb',
  '/cherub.glb',
  '/archway-optimized.glb',
  '/bird1-optimized.glb',
  '/bird2-optimized.glb',
]

export const DEFAULT_TEXT_FONT = 'Inter, sans-serif'

export function getSceneTextFontLoads(sceneText) {
  if (!sceneText?.lines?.length) return []

  return sceneText.lines.map((line) => {
    const fontSize = line.canvasSize ?? 128
    const weight = line.weight ?? 400
    const family = line.font ?? DEFAULT_TEXT_FONT
    return document.fonts.load(`${weight} ${fontSize}px ${family}`)
  })
}
