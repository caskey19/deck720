import { parkLook } from './atmosphere'
import { bigAirScenery } from './scenicParks'
import { launchWedge, flatSurface } from './features'
import { surface, skyDome } from './materials'
import * as THREE from 'three'
import type { ParkData, RailSeg, RampZone, SolidBox } from './TheYard'
import { addBollards, addFenceRun, addLamps } from './decor'

function concrete(color = '#746e64'): THREE.MeshStandardMaterial { return surface('concrete', color) }

function solidFromCenter(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): SolidBox {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  }
}

/** Big Air — run-up, mega gap launch, landing bank, short finish rail. */
export function buildBigAir(): ParkData {
  const group = new THREE.Group()
  const rails: RailSeg[] = []
  const ramps: RampZone[] = []
  const solids: SolidBox[] = []

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.4, 140),
    surface('asphalt'),
  )
  ground.position.set(0, -0.2, 50)
  ground.receiveShadow = true
  group.add(ground)

  for (const x of [-15, 15]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 140), concrete('#504b44'))
    wall.position.set(x, 1.0, 50)
    group.add(wall)
    solids.push(solidFromCenter(x, 1.0, 50, 0.6, 2.4, 140))
  }

  const start = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), concrete('#8a8378'))
  start.position.set(0, 0.15, 0)
  group.add(start)

  // Speed stripe markings
  const stripe = new THREE.MeshStandardMaterial({ color: '#ff6b3d', roughness: 0.7 })
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 1.4), stripe)
    s.position.set(0, 0.02, 10 + i * 4)
    group.add(s)
  }

  // Mega hub
  launchWedge(group,0,43.3,51,10,1.5,'#bfb29a')
  solids.push(solidFromCenter(-4.2,0.7,46,1.4,1.6,5))
  solids.push(solidFromCenter(4.2,0.7,46,1.4,1.6,5))
  ramps.push({
    min: new THREE.Vector3(-4.5, 0, 43.1),
    max: new THREE.Vector3(4.5, 3.2, 53),
    launchDir: new THREE.Vector3(0, 0, 1),
    launchSpeed: 5.2,
    launchUp: 13.5,
  })

  // Landing bank — pulled slightly closer so mega-gap stomps are reachable
  const bank = new THREE.Mesh(new THREE.BoxGeometry(14, 1.0, 12), concrete('#6d675e'))
  bank.position.set(0, 0.3, 74)
  bank.receiveShadow = true
  group.add(bank)
  solids.push(solidFromCenter(-6.4, 0.55, 74, 0.8, 1.1, 12))
  solids.push(solidFromCenter(6.4, 0.55, 74, 0.8, 1.1, 12))

  // Short celebration rail
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 8, 10),
    new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.35, metalness: 0.75 }),
  )
  rail.rotation.z = Math.PI / 2
  rail.rotation.y = Math.PI / 2
  rail.position.set(0, 0.55, 92)
  group.add(rail)
  rails.push({
    start: new THREE.Vector3(0, 0.55, 88.2),
    end: new THREE.Vector3(0, 0.55, 95.8),
    radius: 0.4,
  })

  addBollards(group, [
    [-11, 15],
    [11, 35],
    [-11, 60],
    [11, 95],
  ], undefined, solids)
  addLamps(group, [
    [-12, 25],
    [12, 55],
    [-12, 85],
  ], solids)
  addFenceRun(group, -14.4, 5, 112)
  addFenceRun(group, 14.4, 5, 112)

  const finish = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.08, 0.45),
    new THREE.MeshStandardMaterial({ color: '#ff6b3d', roughness: 0.5, emissive: '#4a1808', emissiveIntensity: 0.4 }),
  )
  finish.position.set(0, 0.22, 104)
  group.add(finish)

  flatSurface(group,0,35,10,14,0.2)
  flatSurface(group,0,91,10,14,0.22)
  flatSurface(group,0,106,12,12,0.2)
  bigAirScenery(group)

  const sky = skyDome(parkLook('big-air').sky,parkLook('big-air').horizon)
  group.add(sky)

  return {
    group,
    spawn: new THREE.Vector3(0, 0.35, 2),
    spawnYaw: 0,
    finishZ: 104,
    groundY: 0,
    rails,
    ramps,
    solids,
    pads: [
      { min: new THREE.Vector3(-4, 0, -4), max: new THREE.Vector3(4, 0.4, 4) },
      // Run-in before mega hub
      { min: new THREE.Vector3(-5, 0, 28), max: new THREE.Vector3(5, 0.2, 42) },
      // Landing bowl shelf
      { min: new THREE.Vector3(-7, 0.2, 68), max: new THREE.Vector3(7, 0.8, 80) },
      // Transition apron into finish
      { min: new THREE.Vector3(-5, 0, 84), max: new THREE.Vector3(5, 0.22, 98) },
      { min: new THREE.Vector3(-6, 0, 100), max: new THREE.Vector3(6, 0.2, 112) },
    ],
    bounds: { minX: -14, maxX: 14, minZ: -2, maxZ: 118 },
  }
}
