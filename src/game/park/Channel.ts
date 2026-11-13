import { channelScenery } from './scenicParks'
import { launchWedge, flatSurface } from './features'
import { surface, skyDome } from './materials'
import * as THREE from 'three'
import type { LandPad, ParkData, RailSeg, RampZone, SolidBox } from './TheYard'
import { addBenches, addBollards, addFenceRun, addPlanters } from './decor'

function asphalt(): THREE.MeshStandardMaterial { return surface('asphalt') }

function concrete(color = '#7a746a'): THREE.MeshStandardMaterial { return surface('concrete', color) }

function steel(): THREE.MeshStandardMaterial { return surface('steel') }

function solidFromCenter(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): SolidBox {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  }
}

/** Channel — street plaza: curb ledges, out-rail, bank-to-bank, handrail. */
export function buildChannel(): ParkData {
  const group = new THREE.Group()
  const rails: RailSeg[] = []
  const ramps: RampZone[] = []
  const solids: SolidBox[] = []
  const pads: LandPad[] = []

  const ground = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 125), asphalt())
  ground.position.set(0, -0.2, 46)
  ground.receiveShadow = true
  group.add(ground)

  for (const x of [-14, 14]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 125), concrete('#555048'))
    wall.position.set(x, 0.175, 46)
    wall.castShadow = true
    group.add(wall)
    solids.push(solidFromCenter(x, 0.175, 46, 0.55, 0.65, 125))
  }

  // Plaza start
  const pad = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 8), concrete('#8a8378'))
  pad.position.set(0, 0.1, 0)
  pad.receiveShadow = true
  group.add(pad)

  // Curb ledge left
  const curbL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 11), concrete('#9a9388'))
  curbL.position.set(-4.2, 0.22, 18)
  curbL.castShadow = true
  group.add(curbL)
  solids.push(solidFromCenter(-4.2, 0.22, 18, 1.0, 0.42, 11))
  rails.push({
    start: new THREE.Vector3(-4.2, 0.46, 12.8),
    end: new THREE.Vector3(-4.2, 0.46, 23.2),
    radius: 0.45,
  })

  // Curb ledge right (offset)
  const curbR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 9), concrete('#9a9388'))
  curbR.position.set(4.5, 0.22, 28)
  curbR.castShadow = true
  group.add(curbR)
  solids.push(solidFromCenter(4.5, 0.22, 28, 1.0, 0.42, 9))
  rails.push({
    start: new THREE.Vector3(4.5, 0.46, 23.8),
    end: new THREE.Vector3(4.5, 0.46, 32.2),
    radius: 0.45,
  })

  // Bench (prop + solid)
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.55), concrete('#6a645c'))
  bench.position.set(-8.5, 0.25, 22)
  group.add(bench)
  solids.push(solidFromCenter(-8.5, 0.25, 22, 2.4, 0.35, 0.55))

  // Bank-to-bank kicker
  launchWedge(group,0,39.3,45,6,0.9,'#c0b4a0')
  solids.push(solidFromCenter(-2.7,0.45,42,0.7,1,5))
  solids.push(solidFromCenter(2.7,0.45,42,0.7,1,5))
  ramps.push({
    min: new THREE.Vector3(-2.8, 0, 39.1),
    max: new THREE.Vector3(2.8, 2.4, 48),
    launchDir: new THREE.Vector3(0, 0, 1),
    launchSpeed: 3.2,
    launchUp: 8.4,
  })

  // Out-rail after bank
  const out = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 10), steel())
  out.rotation.z = Math.PI / 2
  out.rotation.y = Math.PI / 2
  out.position.set(-2.2, 0.55, 62)
  out.castShadow = true
  group.add(out)
  for (const z of [57, 62, 67]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), steel())
    post.position.set(-2.2, 0.28, z)
    group.add(post)
  }
  rails.push({
    start: new THREE.Vector3(-2.2, 0.55, 56.2),
    end: new THREE.Vector3(-2.2, 0.55, 67.8),
    radius: 0.42,
  })

  // Stair set (visual + solids on sides) with angled handrail
  const stairZ0 = 77.5
  const stairSteps = 6
  for (let i = 0; i < stairSteps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.22, 0.75), concrete('#6d675e'))
    step.position.set(3.5, 0.12 + i * 0.24, stairZ0 + i * 0.75)
    step.receiveShadow = true
    group.add(step)
    pads.push({min:new THREE.Vector3(1.25,0,stairZ0+i*0.75-0.375),max:new THREE.Vector3(5.75,0.23+i*0.24,stairZ0+i*0.75+0.375)})
  }
  solids.push(solidFromCenter(1.35, 0.85, 80.5, 0.45, 1.6, 5.2))
  solids.push(solidFromCenter(5.65, 0.85, 80.5, 0.45, 1.6, 5.2))

  const railStart = new THREE.Vector3(5.55, 0.55, stairZ0 - 0.2)
  const railEnd = new THREE.Vector3(5.55, 0.55 + stairSteps * 0.24, stairZ0 + stairSteps * 0.75)
  const handLen = railStart.distanceTo(railEnd)
  const hand = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, handLen, 10), steel())
  hand.position.copy(railStart).add(railEnd).multiplyScalar(0.5)
  // Orient cylinder (default Y-up) along stair rail
  hand.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    railEnd.clone().sub(railStart).normalize(),
  )
  hand.castShadow = true
  group.add(hand)
  for (const t of [0.15, 0.5, 0.85]) {
    const p = railStart.clone().lerp(railEnd, t)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, Math.max(0.35, p.y), 0.1), steel())
    post.position.set(p.x, p.y * 0.5, p.z)
    group.add(post)
  }
  rails.push({
    start: railStart,
    end: railEnd,
    radius: 0.48,
  })

  // Finish plaza
  const finishPad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 9), concrete('#948d82'))
  finishPad.position.set(0, 0.05, 100)
  finishPad.receiveShadow = true
  group.add(finishPad)
  pads.push({ min: new THREE.Vector3(-4, 0, -4), max: new THREE.Vector3(4, 0.275, 4) })
  // Curb tops
  pads.push({ min: new THREE.Vector3(-4.7, 0.2, 12.5), max: new THREE.Vector3(-3.7, 0.43, 23.5) })
  pads.push({ min: new THREE.Vector3(4, 0.2, 23.5), max: new THREE.Vector3(5, 0.43, 32.5) })
  // Plaza floor between curb lines and the bank
  pads.push({ min: new THREE.Vector3(-4, 0, 26), max: new THREE.Vector3(4, 0.16, 38) })
  pads.push({ min: new THREE.Vector3(-6, 0, 95.5), max: new THREE.Vector3(6, 0.175, 104.5) })
  // Soft landing after bank before stairs
  pads.push({ min: new THREE.Vector3(-4, 0, 46), max: new THREE.Vector3(4, 0.18, 58) })
  // Full landing deck starts where the last tread ends.
  const stairTop = 0.23 + (stairSteps-1)*0.24
  const stairEnd = stairZ0 + (stairSteps-1)*0.75 + 0.375
  const landing = new THREE.Mesh(new THREE.BoxGeometry(4.5,0.3,2),concrete('#a8aa99'))
  landing.position.set(3.5,stairTop-0.15,stairEnd+1);landing.receiveShadow=true;group.add(landing)
  pads.push({min:new THREE.Vector3(1.25,0,stairEnd),max:new THREE.Vector3(5.75,stairTop,stairEnd+2)})

  const finish = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: '#e8a838', roughness: 0.55, emissive: '#3a2808', emissiveIntensity: 0.35 }),
  )
  finish.position.set(0, 0.22, 98)
  group.add(finish)

  addBollards(group, [
    [-9, 12],
    [9, 35],
    [-9, 55],
    [9, 88],
  ])
  addPlanters(group, [
    [-9.5, 45],
    [9.5, 72],
  ])
  addBenches(group, [
    [10, 18],
    [-10, 62],
  ])
  addFenceRun(group, -13.2, 8, 105)
  addFenceRun(group, 13.2, 8, 105)

  // Street lights
  for (const [x, z] of [
    [-11, 15],
    [11, 40],
    [-11, 70],
    [11, 95],
  ] as const) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 0.7 }),
    )
    pole.position.set(x, 2.7, z)
    group.add(pole)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.12,0.35),surface('paint','#e8d7ad'))
    lamp.position.set(x, 5.4, z)
    group.add(lamp)
  }

  flatSurface(group,0,32,8,12,0.16)
  flatSurface(group,0,52,8,12,0.18)
  channelScenery(group)

  const sky = skyDome('#788ab3', '#e1bca8')
  group.add(sky)

  return {
    group,
    spawn: new THREE.Vector3(0, 0.35, 2),
    spawnYaw: 0,
    finishZ: 98,
    groundY: 0,
    rails,
    ramps,
    solids,
    pads,
    bounds: { minX: -13, maxX: 13, minZ: -2, maxZ: 112 },
  }
}
