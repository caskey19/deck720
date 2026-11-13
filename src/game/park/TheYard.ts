import { parkLook } from './atmosphere'
import * as THREE from 'three'
import { yardScenery } from './yardScenery'
import { surface, skyDome } from './materials'
import { addBollards, addFenceRun, addPlanters } from './decor'

export type RailSeg = {
  start: THREE.Vector3
  end: THREE.Vector3
  radius: number
}

export type RampZone = {
  /** World AABB-ish for launch detection */
  min: THREE.Vector3
  max: THREE.Vector3
  launchDir: THREE.Vector3
  launchSpeed: number
  launchUp: number
}

/** Solid obstacle AABB — skater is pushed out horizontally when overlapping. */
export type SolidBox = {
  min: THREE.Vector3
  max: THREE.Vector3
}

/** Rideable elevated surface — top face is max.y within min/max XZ. */
export type LandPad = {
  min: THREE.Vector3
  max: THREE.Vector3
}

export type ParkData = {
  group: THREE.Group
  spawn: THREE.Vector3
  spawnYaw: number
  finishZ: number
  groundY: number
  rails: RailSeg[]
  ramps: RampZone[]
  solids: SolidBox[]
  /** Optional elevated landable tops (finish plazas, banks). */
  pads?: LandPad[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** The Yard: an open industrial courtyard with three readable lines. */
export function buildTheYard(): ParkData {
  const group = new THREE.Group()
  const rails: RailSeg[] = [], ramps: RampZone[] = [], solids: SolidBox[] = [], pads: LandPad[] = []
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat = surface('concrete')) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
    return mesh
  }
  const pad = (x: number, z: number, w: number, d: number, h: number) => {
    box(x, h / 2, z, w, h, d)
    pads.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, h, z + d / 2) })
  }
  const rail = (x: number, z0: number, z1: number, y: number) => {
    const start = new THREE.Vector3(x, y, z0), end = new THREE.Vector3(x, y, z1)
    rails.push({ start, end, radius: 0.45 })
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, z1-z0, 10), surface('steel'))
    mesh.rotation.x = Math.PI / 2; mesh.position.copy(start).lerp(end, 0.5); mesh.castShadow = true; group.add(mesh)
    for (let z = z0 + 0.4; z < z1; z += 3) box(x, y/2, z, 0.08, y, 0.08, surface('steel', '#495956'))
  }
  // Geometry matches the declared ground plane. Inlaid paving stays flush.
  box(0, -0.2, 82, 28, 0.4, 204, surface('asphalt'))
  for (const x of [-10, 10]) box(x, -0.055, 82, 7, 0.1, 204)
  for (const x of [-14.2, 14.2]) {
    box(x, 0.2, 82, 0.4, 0.8, 204, surface('concrete', '#9d9d91'))
    solids.push({min: new THREE.Vector3(x-0.2, -0.2, -20), max: new THREE.Vector3(x+0.2, 0.6, 184)})
  }
  for (let z = 6; z < 174; z += 9) for (const x of [-6.1, 6.1]) box(x, 0.006, z, 0.09, 0.01, 2.2, surface('paint', '#d8b26e'))
  // Street ledges have coping and recessed bases instead of anonymous slabs.
  for (const [x,z,w,d,h] of [[-3.7,26,1.3,10,0.52],[5,62,1.5,9,0.48],[-4,115,1.4,12,0.6]]) {
    pad(x,z,w,d,h)
    box(x,0.08,z,w+0.16,0.16,d+0.16,surface('concrete','#626e69'))
    box(x,h+0.012,z,0.075,0.025,d,surface('steel'))
    rails.push({start:new THREE.Vector3(x,h+0.04,z-d/2+0.2),end:new THREE.Vector3(x,h+0.04,z+d/2-0.2),radius:0.5})
  }
  rail(3.1, 18, 31, 0.62)
  // Launch wedges: no solid rear face across the approach.
  const kicker = (x: number, z: number, w: number, h: number, up: number) => {
    const profile = new THREE.Shape()
    profile.moveTo(-2,0); profile.lineTo(2,h); profile.lineTo(2,0); profile.closePath()
    const geo = new THREE.ExtrudeGeometry(profile,{depth:w,bevelEnabled:false})
    // Profile x becomes world z and extrusion becomes world x.
    geo.rotateY(-Math.PI/2)
    geo.translate(w/2,0,0)
    const m = new THREE.Mesh(geo,surface('concrete','#c3baaa'));m.position.set(x,0,z);m.castShadow=true;m.receiveShadow=true;group.add(m)
    box(x,h+0.015,z+1.98,w,0.04,0.1,surface('paint','#dca160'))
    ramps.push({min:new THREE.Vector3(x-w/2,0,z-2.2),max:new THREE.Vector3(x+w/2,h+0.6,z+2.3),launchDir:new THREE.Vector3(0,0,1),launchSpeed:3.4,launchUp:up})
  }
  kicker(0,42,5.2,1.15,8.8)
  pad(0,55,7,7,0.5)
  for(const x of [-3,3]) box(x,0.507,55,0.12,0.012,6,surface('paint','#e3cf9b'))
  // Smooth quarter transition made from one continuous sampled profile.
  const profile = new THREE.Shape(); profile.moveTo(-3,0)
  for(let i=0;i<=32;i++){const t=i/32; profile.lineTo(-3+5.5*Math.sin(t*Math.PI/2),3.2*(1-Math.cos(t*Math.PI/2)))}
  profile.lineTo(4,3.2); profile.lineTo(4,0); profile.closePath()
  const quarterGeo=new THREE.ExtrudeGeometry(profile,{depth:7,bevelEnabled:false});quarterGeo.rotateY(-Math.PI/2);quarterGeo.translate(3.5,0,0)
  const quarter=new THREE.Mesh(quarterGeo,surface('concrete','#a6b6af'));quarter.position.set(5.3,0,78);quarter.castShadow=true;quarter.receiveShadow=true;group.add(quarter)
  ramps.push({min:new THREE.Vector3(1.8,0,74.8),max:new THREE.Vector3(8.8,4,81),launchDir:new THREE.Vector3(-0.12,0,1),launchSpeed:2.4,launchUp:11.2})
  pads.push({min:new THREE.Vector3(1.8,0,80.5),max:new THREE.Vector3(8.8,3.2,82)})
  const coping=box(5.3,3.23,80.5,7.1,0.08,0.09,surface('steel'));coping.name='quarter coping'
  rail(-2,77,94,0.55);rail(3,98,109,0.7)
  kicker(-5,134,4.5,0.9,7.8);pad(-5,145,5,6,0.35)
  rail(2,137,152,0.58)
  // Flat finish: banked score flow remains reachable on the center line.
  pad(0,172,12,12,0.14)
  for(let i=0;i<20;i++)box(-5.7+i*0.6,0.148,170,0.6,0.014,0.5,surface('paint',i%2?'#e9ddc3':'#334a49'))
  for(const x of [-6.4,6.4])box(x,1.5,170,0.15,3,0.15,surface('steel'))
  addBollards(group,[[-12,15],[12,48],[-12,98],[12,153]], undefined, solids)
  addPlanters(group,[[-11,43],[11,112]], solids)
  addFenceRun(group,-13.7,-8,180);addFenceRun(group,13.7,-8,180)
  yardScenery(group)
  group.add(skyDome(parkLook('the-yard').sky,parkLook('the-yard').horizon))
  return {group,rails,ramps,solids,pads,spawn:new THREE.Vector3(0,0.12,2),spawnYaw:0,finishZ:170,groundY:0,bounds:{minX:-13,maxX:13,minZ:-8,maxZ:182}}
}
