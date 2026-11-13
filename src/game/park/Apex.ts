import { parkLook } from './atmosphere'
import { apexScenery } from './scenicParks'
import { launchWedge, flatSurface } from './features'
import { surface, skyDome } from './materials'
import * as THREE from 'three'
import type { ParkData, RailSeg, RampZone, SolidBox } from './TheYard'
import { addBenches, addBollards, addFenceRun, addLamps } from './decor'

function concrete(color = '#6e6860'): THREE.MeshStandardMaterial { return surface('concrete', color) }

function steel(): THREE.MeshStandardMaterial { return surface('steel') }

function solidFromCenter(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): SolidBox {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  }
}

/** Apex — tighter precision ledges and a spine-style launch. */
export function buildApex(): ParkData {
  const group = new THREE.Group()
  const rails: RailSeg[] = []
  const ramps: RampZone[] = []
  const solids: SolidBox[] = []

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.4, 120),
    surface('asphalt','#646b68'),
  )
  ground.position.set(0, -0.2, 45)
  ground.receiveShadow = true
  group.add(ground)

  for (const x of [-12.2, 12.2]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 120), concrete('#555048'))
    wall.position.set(x, 0.15, 45)
    group.add(wall)
    solids.push(solidFromCenter(x, 0.15, 45, 0.5, 0.6, 120))
  }

  const start = new THREE.Mesh(new THREE.BoxGeometry(6, 0.45, 6), concrete('#8a8378'))
  start.position.set(0, 0.12, 0)
  group.add(start)

  // Precision ledge A
  const ledgeA = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.48, 9), concrete('#9a9388'))
  ledgeA.position.set(-3.2, 0.26, 18)
  ledgeA.castShadow = true
  group.add(ledgeA)
  solids.push(solidFromCenter(-3.2, 0.26, 18, 0.9, 0.48, 9))
  rails.push({
    start: new THREE.Vector3(-3.2, 0.52, 13.8),
    end: new THREE.Vector3(-3.2, 0.52, 22.2),
    radius: 0.42,
  })

  // Offset ledge B
  const ledgeB = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.48, 8), concrete('#9a9388'))
  ledgeB.position.set(3.4, 0.26, 32)
  ledgeB.castShadow = true
  group.add(ledgeB)
  solids.push(solidFromCenter(3.4, 0.26, 32, 0.9, 0.48, 8))
  rails.push({
    start: new THREE.Vector3(3.4, 0.52, 28.2),
    end: new THREE.Vector3(3.4, 0.52, 35.8),
    radius: 0.42,
  })

  // Spine / hub
  launchWedge(group,0,46.2,51.5,5.5,1.05,'#bac3b8')
  solids.push(solidFromCenter(-2.2,0.45,48,0.9,1,3.2))
  solids.push(solidFromCenter(2.2,0.45,48,0.9,1,3.2))
  ramps.push({
    min: new THREE.Vector3(-2.6, 0, 46.1),
    max: new THREE.Vector3(2.6, 2.5, 53),
    launchDir: new THREE.Vector3(0, 0, 1),
    launchSpeed: 4.0,
    launchUp: 10.2,
  })

  // Out-rail
  const outRail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 10, 10), steel())
  outRail.rotation.z = Math.PI / 2
  outRail.rotation.y = Math.PI / 2
  outRail.position.set(-1.5, 0.62, 72)
  group.add(outRail)
  rails.push({
    start: new THREE.Vector3(-1.5, 0.62, 67.2),
    end: new THREE.Vector3(-1.5, 0.62, 76.8),
    radius: 0.4,
  })

  // Euro gap ledge after out-rail
  const euro = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 7), concrete('#9a9388'))
  euro.position.set(2.8, 0.28, 84)
  euro.castShadow = true
  group.add(euro)
  solids.push(solidFromCenter(2.8, 0.28, 84, 1.0, 0.5, 7))
  rails.push({
    start: new THREE.Vector3(2.8, 0.55, 80.8),
    end: new THREE.Vector3(2.8, 0.55, 87.2),
    radius: 0.42,
  })

  addBollards(group, [
    [-8, 12],
    [8, 40],
    [-8, 65],
    [8, 88],
  ], undefined, solids)
  addLamps(group, [
    [-9.5, 22],
    [9.5, 50],
    [-9.5, 78],
  ], solids)
  addBenches(group, [
    [9, 14],
    [-9, 70],
  ], '#6a7280', solids)
  addFenceRun(group, -11.4, 4, 100, '#3a424a')
  addFenceRun(group, 11.4, 4, 100, '#3a424a')

  const finish = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: '#7ec8ff', roughness: 0.5, emissive: '#0a2030', emissiveIntensity: 0.4 }),
  )
  finish.position.set(0, 0.2, 96)
  group.add(finish)

  flatSurface(group,0,63,7,18,0.18)
  flatSurface(group,0,98,10,12,0.15)
  apexScenery(group)

  const sky = skyDome(parkLook('apex').sky,parkLook('apex').horizon)
  group.add(sky)

  return {
    group,
    spawn: new THREE.Vector3(0, 0.35, 2),
    spawnYaw: 0,
    finishZ: 96,
    groundY: 0,
    rails,
    ramps,
    solids,
    pads: [
      { min: new THREE.Vector3(-3, 0, -3), max: new THREE.Vector3(3, 0.345, 3) },
      // Precision ledge A / B tops
      { min: new THREE.Vector3(-3.65, 0.2, 13.5), max: new THREE.Vector3(-2.75, 0.5, 22.5) },
      { min: new THREE.Vector3(2.95, 0.2, 28), max: new THREE.Vector3(3.85, 0.5, 36) },
      // Mid plaza between spine and euro
      { min: new THREE.Vector3(-3.5, 0, 54), max: new THREE.Vector3(3.5, 0.18, 72) },
      // Euro ledge top
      { min: new THREE.Vector3(2.3, 0.3, 80.5), max: new THREE.Vector3(3.3, 0.53, 87.5) },
      // Finish apron
      { min: new THREE.Vector3(-5, 0, 92), max: new THREE.Vector3(5, 0.15, 104) },
    ],
    bounds: { minX: -11, maxX: 11, minZ: -2, maxZ: 108 },
  }
}
