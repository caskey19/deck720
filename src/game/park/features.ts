import * as THREE from 'three'
import { surface } from './materials'

export function launchWedge(group: THREE.Group, x: number, z0: number, z1: number, width: number, height: number, color = '#aab0a5'): void {
  const shape = new THREE.Shape()
  shape.moveTo(0,0)
  // Gentle convex transition, sampled once rather than stacked slabs.
  for(let i=1;i<=16;i++){const t=i/16;shape.lineTo((z1-z0)*t,height*t*t)}
  shape.lineTo(z1-z0,0);shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false})
  geometry.rotateY(-Math.PI/2);geometry.translate(x+width/2,0,z0)
  const ramp=new THREE.Mesh(geometry,surface('concrete',color));ramp.castShadow=true;ramp.receiveShadow=true;group.add(ramp)
  const coping=new THREE.Mesh(new THREE.BoxGeometry(width,0.06,0.1),surface('steel'))
  coping.position.set(x,height+0.015,z1-0.04);group.add(coping)
}

/** Flat pad from a declared footprint. Top and footprint are exact, even after batching. */
export function flatSurface(group: THREE.Group,x: number,z: number,width: number,depth: number,height: number,material = surface('concrete')): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material)
  mesh.position.set(x,height/2,z);mesh.receiveShadow=true;group.add(mesh)
}
