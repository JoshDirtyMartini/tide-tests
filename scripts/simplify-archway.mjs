import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, prune, draco, compactPrimitive } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'

const INPUT = 'public/archway.glb'
const OUTPUT = 'public/archway-optimized.glb'
const RATIO = 0.04

const [decoder, encoder] = await Promise.all([
  draco3d.createDecoderModule(),
  draco3d.createEncoderModule(),
  MeshoptSimplifier.ready,
])

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': decoder,
    'draco3d.encoder': encoder,
  })

function countTris(document) {
  let tris = 0
  let verts = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      tris += (indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()) / 3
      verts += prim.getAttribute('POSITION').getCount()
    }
  }
  return { tris, verts }
}

function aggressiveSimplify(ratio) {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const position = prim.getAttribute('POSITION')
        const srcIndices = prim.getIndices()
        if (!position || !srcIndices) continue

        const positionArray = position.getArray()
        const indicesArray = new Uint32Array(srcIndices.getArray())
        const targetCount = Math.max(3, Math.floor((ratio * indicesArray.length) / 3) * 3)

        let [dst] = MeshoptSimplifier.simplify(
          indicesArray,
          positionArray,
          3,
          targetCount,
          1,
          ['Sparse', 'Prune', 'Permissive'],
        )

        if (dst.length > targetCount * 1.25) {
          ;[dst] = MeshoptSimplifier.simplifySloppy(
            indicesArray,
            positionArray,
            3,
            null,
            targetCount,
            1,
          )
        }

        srcIndices.setArray(dst)
        compactPrimitive(prim)
        console.log(
          `  ${mesh.getName() || 'mesh'}: ${(indicesArray.length / 3).toFixed(0)} → ${(dst.length / 3).toFixed(0)} tris`,
        )
      }
    }
  }
}

console.log(`Simplifying ${INPUT} → ratio ${RATIO}`)
const document = await io.read(INPUT)
const before = countTris(document)
console.log(`  before: ${before.verts.toLocaleString()} verts, ${before.tris.toLocaleString()} tris`)

await document.transform(weld())
aggressiveSimplify(RATIO)(document)
await document.transform(prune(), draco())

const after = countTris(document)
console.log(`  after:  ${after.verts.toLocaleString()} verts, ${after.tris.toLocaleString()} tris`)
await io.write(OUTPUT, document)
console.log(`  wrote ${OUTPUT}`)
