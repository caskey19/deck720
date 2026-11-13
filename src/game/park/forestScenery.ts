import * as THREE from 'three'
import { surface } from './materials'

/** Seeded, instanced woodland surrounds a clear, original skate trail. */
export function forestScenery(group: THREE.Group): void {
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material)
    object.position.set(x,y,z); object.castShadow = true; object.receiveShadow = true; group.add(object)
    return object
  }
  const floor = mesh(new THREE.BoxGeometry(180,0.6,240),surface('rubber','#788365'),0,-0.6,52)
  floor.castShadow = false
  // Tree tiers are instanced; only five tree draw calls even at this density.
  const count = 96, matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion()
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16,0.27,5,7),surface('wood','#6a5842'),count)
  const canopy = [0,1,2].map(i=>new THREE.InstancedMesh(new THREE.ConeGeometry(2-i*0.35,3.5,8),surface('rubber',i%2?'#546f59':'#3e5d50'),count))
  let seed = 765
  const random = () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<count;i++){
    const side=i%2?-1:1, x=side*(15+random()*48),z=-35+random()*190,s=0.7+random()*1.1
    rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),random()*Math.PI)
    trunk.setMatrixAt(i,matrix.compose(new THREE.Vector3(x,2.5*s-0.3,z),rotation,new THREE.Vector3(s,s,s)))
    for(let t=0;t<3;t++)canopy[t].setMatrixAt(i,matrix.compose(new THREE.Vector3(x,(4+t*1.5)*s,z),rotation,new THREE.Vector3(s,s,s)))
  }
  trunk.castShadow = true; group.add(trunk)
  for(const crowns of canopy){crowns.castShadow=true;group.add(crowns)}
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),surface('concrete','#828b7e'),32)
  for(let i=0;i<32;i++){
    const x=(i%2?-1:1)*(14+random()*15),z=-5+random()*125
    rocks.setMatrixAt(i,matrix.compose(new THREE.Vector3(x,0.2,z),rotation,new THREE.Vector3(0.6+random()*1.8,0.4+random(),0.6+random()*2)))
  }
  rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks)
  // Side boardwalk and timber posts create human scale without blocking a line.
  for(const side of [-1,1]){
    mesh(new THREE.BoxGeometry(1.8,0.16,126),surface('wood','#a38c66'),side*14.2,0,-0.5+63)
    for(let z=0;z<112;z+=8){
      mesh(new THREE.CylinderGeometry(0.09,0.1,0.9,8),surface('wood','#8c7656'),side*15,0.4,z)
      mesh(new THREE.BoxGeometry(0.06,0.06,8),surface('steel','#6d7466'),side*15,0.78,z+4)
    }
  }
  // Small shelter beyond the ride boundary.
  for(const x of [17,22])for(const z of [18,24])mesh(new THREE.BoxGeometry(0.2,3,0.2),surface('wood'),x,1.5,z)
  const roof=mesh(new THREE.BoxGeometry(7,0.2,8),surface('steel','#526962'),19.5,3.1,21)
  roof.rotation.z=0.08
  mesh(new THREE.BoxGeometry(4.5,0.15,1.2),surface('wood'),19.5,0.7,21)
  // Distant low hills frame the trail instead of leaving the sky horizon empty.
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const hill=mesh(new THREE.IcosahedronGeometry(1,1),surface('rubber','#6b7d6c'),side*(55+i*7),0,15+i*27)
    hill.scale.set(20,8+i*2,28)
  }
}
