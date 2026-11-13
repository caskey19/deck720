import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ParkData } from './TheYard'

/** Merge only static opaque park meshes, preserving transforms and shadow policy. */
export function batchPark(park: ParkData): ParkData {
  const root = park.group
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const buckets = new Map<string, THREE.Mesh[]>()
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) return
    if (o.material.transparent || !(o.material instanceof THREE.MeshStandardMaterial)) return
    const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(o)
  })
  for (const meshes of buckets.values()) {
    const geometries = meshes.map(mesh => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld))
      if ((mesh.material as THREE.Material).userData.sharedSurface) {
        const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
        const uv = geometry.getAttribute('uv')
        // World-sized tiles prevent tiny ledges and warehouse facades stretching maps.
        for (let i = 0; i < positions.count; i++) {
          const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i))
          const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
          if (ny >= nx && ny >= nz) uv.setXY(i, x / 2, z / 2)
          else if (nx >= nz) uv.setXY(i, z / 2, y / 2)
          else uv.setXY(i, x / 2, y / 2)
        }
      }
      return geometry
    })
    const merged = mergeGeometries(geometries, false)
    geometries.forEach(g => g.dispose())
    if (!merged) continue
    merged.computeBoundingSphere()
    const batch = new THREE.Mesh(merged, meshes[0].material)
    batch.name = 'static surface batch'
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow
    root.add(batch)
    for (const mesh of meshes) mesh.removeFromParent()
    // Construction creates park-owned geometry; no live physics references meshes.
    for (const geometry of new Set(meshes.map(m => m.geometry))) geometry.dispose()
  }
  return park
}
