import type { SolidBox } from './TheYard'
import { surface } from './materials'
import * as THREE from 'three'

/** Lightweight shared props — keep counts low for FPS. */
export function addBollards(group: THREE.Group, spots: [number, number][], color = '#3a3632', solids?: SolidBox[]): void {
  const mat = surface('steel', color)
  for (const [x, z] of spots) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8), mat)
    post.position.set(x, 0.42, z)
    post.castShadow = true
    group.add(post)
    propSolid(solids,x,z,0.3,0.3,0.85)
  }
}

export function addPlanters(group: THREE.Group, spots: [number, number][], solids?: SolidBox[]): void {
  const boxMat = surface('concrete', '#9b9483')
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6b48', roughness: 0.85 })
  for (const [x, z] of spots) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 1.1), boxMat)
    box.position.set(x, 0.22, z)
    box.castShadow = true
    group.add(box)
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), leafMat)
    leaf.position.set(x, 0.7, z)
    group.add(leaf)
    propSolid(solids,x,z,1.1,1.1,0.45)
  }
}

export function addFenceRun(group: THREE.Group, x: number, z0: number, z1: number, color = '#2e2a26'): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 })
  const midZ = (z0 + z1) / 2
  const len = Math.abs(z1 - z0)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), mat)
  rail.position.set(x, 1.1, midZ)
  group.add(rail)
  const rail2 = rail.clone()
  rail2.position.y = 0.7
  group.add(rail2)
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 3) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), mat)
    post.position.set(x, 0.6, z)
    group.add(post)
  }
}

/** Simple benches — visual only unless a solid is added by the park. */
export function addBenches(group: THREE.Group, spots: [number, number][], color = '#6a645c', solids?: SolidBox[]): void {
  const mat = surface('wood', color)
  for (const [x, z] of spots) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), mat)
    seat.position.set(x, 0.42, z)
    seat.castShadow = true
    group.add(seat)
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), mat)
    back.position.set(x, 0.7, z - 0.22)
    group.add(back)
    propSolid(solids,x,z,1.8,0.5,0.93)
    for (const dx of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), mat)
      leg.position.set(x + dx, 0.2, z)
      group.add(leg)
    }
  }
}

/** Simple lamp posts for plaza edges — keep spots sparse. */
export function addLamps(group: THREE.Group, spots: [number, number][], solids?: SolidBox[]): void {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2c2a28', roughness: 0.7, metalness: 0.35 })
  const headMat = new THREE.MeshStandardMaterial({
    color: '#f0d9a0',
    roughness: 0.4,
    emissive: '#c9a45a',
    emissiveIntensity: 0.35,
  })
  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), poleMat)
    pole.position.set(x, 1.3, z)
    pole.castShadow = true
    group.add(pole)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.35), headMat)
    head.position.set(x, 2.65, z)
    group.add(head)
    propSolid(solids,x,z,0.18,0.18,2.6)
  }
}


function propSolid(solids: SolidBox[] | undefined,x: number,z: number,width: number,depth: number,height: number): void {
  solids?.push({min:new THREE.Vector3(x-width/2,0,z-depth/2),max:new THREE.Vector3(x+width/2,height,z+depth/2)})
}
