import * as THREE from 'three'

/** Release scene-owned resources once; shared surface maps survive park switches. */
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.userData.sharedSurface) materials.add(material)
      }
    }
    if (object instanceof THREE.InstancedMesh) object.dispose()
    if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight) object.shadow.dispose()
  })
  geometries.forEach(geometry => geometry.dispose())
  const textures = new Set<THREE.Texture>()
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    material.dispose()
  }
  textures.forEach(texture => texture.dispose())
}
