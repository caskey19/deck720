import { surface, skyDome } from './materials'
import * as THREE from 'three'
import type { ParkData, RailSeg, RampZone, SolidBox } from './TheYard'
import { addBenches, addBollards, addPlanters } from './decor'

function bark(): THREE.MeshStandardMaterial { return surface('wood') }

function moss(): THREE.MeshStandardMaterial { return surface('rubber') }

function steel(): THREE.MeshStandardMaterial { return surface('steel') }

function solidFromCenter(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): SolidBox {
  return {
    min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  }
}

/** Woodland rail park — long steel lines and a timber ledge gap. */
export function buildForestLine(): ParkData {
  const group = new THREE.Group()
  const rails: RailSeg[] = []
  const ramps: RampZone[] = []
  const solids: SolidBox[] = []

  const ground = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 130), moss())
  ground.position.set(0, -0.2, 48)
  ground.receiveShadow = true
  group.add(ground)

  const wallMat = bark()
  for (const x of [-13.2, 13.2]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.0, 130), wallMat)
    wall.position.set(x, 0.85, 48)
    wall.castShadow = true
    group.add(wall)
    solids.push(solidFromCenter(x, 0.85, 48, 0.55, 2.0, 130))
  }

  // Start clearing
  const pad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 7), bark())
  pad.position.set(0, 0.1, 0)
  pad.receiveShadow = true
  group.add(pad)

  // Timber ledge
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 14), bark())
  ledge.position.set(-4, 0.28, 24)
  ledge.castShadow = true
  group.add(ledge)
  solids.push(solidFromCenter(-4, 0.28, 24, 1.1, 0.5, 14))
  rails.push({
    start: new THREE.Vector3(-4, 0.55, 17.2),
    end: new THREE.Vector3(-4, 0.55, 30.8),
    radius: 0.5,
  })

  // Long flatbar
  const flatbar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 18, 10), steel())
  flatbar.rotation.z = Math.PI / 2
  flatbar.rotation.y = Math.PI / 2
  flatbar.position.set(2.2, 0.58, 48)
  flatbar.castShadow = true
  group.add(flatbar)
  for (const z of [40, 48, 56]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), steel())
    post.position.set(2.2, 0.29, z)
    group.add(post)
  }
  rails.push({
    start: new THREE.Vector3(2.2, 0.58, 39.2),
    end: new THREE.Vector3(2.2, 0.58, 56.8),
    radius: 0.42,
  })

  // Kicker into gap
  const kicker = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 3.4), bark())
  kicker.position.set(0, 0.7, 66)
  kicker.rotation.x = -0.38
  kicker.castShadow = true
  group.add(kicker)
  ramps.push({
    min: new THREE.Vector3(-2.8, 0, 64),
    max: new THREE.Vector3(2.8, 2.4, 69),
    launchDir: new THREE.Vector3(0, 0, 1),
    launchSpeed: 3.8,
    launchUp: 9.2,
  })
  solids.push(solidFromCenter(-2.4, 0.55, 65.2, 0.7, 1.1, 3))
  solids.push(solidFromCenter(2.4, 0.55, 65.2, 0.7, 1.1, 3))

  // Handrail after landing
  const hand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 11, 10), steel())
  hand.rotation.z = Math.PI / 2
  hand.rotation.y = Math.PI / 2
  hand.position.set(-2.5, 0.72, 82)
  hand.castShadow = true
  group.add(hand)
  rails.push({
    start: new THREE.Vector3(-2.5, 0.72, 76.8),
    end: new THREE.Vector3(-2.5, 0.72, 87.2),
    radius: 0.4,
  })

  // Downhill log ledge before finish
  const log = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.48, 8), bark())
  log.position.set(3.8, 0.26, 94)
  log.castShadow = true
  group.add(log)
  solids.push(solidFromCenter(3.8, 0.26, 94, 1.05, 0.48, 8))
  rails.push({
    start: new THREE.Vector3(3.8, 0.52, 90.2),
    end: new THREE.Vector3(3.8, 0.52, 97.8),
    radius: 0.42,
  })

  // Finish
  const finish = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: '#3ecf8e', roughness: 0.55, emissive: '#0a2a18', emissiveIntensity: 0.35 }),
  )
  finish.position.set(0, 0.2, 100)
  group.add(finish)

  addBollards(
    group,
    [
      [-8, 8],
      [8, 35],
      [-8, 72],
    ],
    '#2c2620',
  )
  addPlanters(group, [
    [9, 50],
    [-9, 88],
  ])
  addBenches(group, [
    [9.5, 20],
    [-9.5, 78],
  ], '#5a4a38')

  // Trees (visual)
  for (const [x, z] of [
    [-10, 12],
    [10, 30],
    [-11, 55],
    [11, 70],
    [-9, 90],
  ] as const) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 5, 8), bark())
    trunk.position.set(x, 2.4, z)
    group.add(trunk)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 8), moss())
    canopy.position.set(x, 5.4, z)
    group.add(canopy)
  }

  const sky = skyDome('#597d72', '#c4c7a8')
  group.add(sky)

  return {
    group,
    spawn: new THREE.Vector3(0, 0.35, 2),
    spawnYaw: 0,
    finishZ: 100,
    groundY: 0,
    rails,
    ramps,
    solids,
    pads: [
      { min: new THREE.Vector3(-3.5, 0, -2), max: new THREE.Vector3(3.5, 0.3, 3.5) },
      // Timber ledge top
      { min: new THREE.Vector3(-4.6, 0.2, 17), max: new THREE.Vector3(-3.4, 0.55, 31) },
      // Path between ledge and kicker
      { min: new THREE.Vector3(-3, 0, 34), max: new THREE.Vector3(3, 0.16, 58) },
      // Kicker deck top (approach lip)
      { min: new THREE.Vector3(-2.5, 0.4, 62.5), max: new THREE.Vector3(2.5, 0.95, 67.5) },
      // Soft landing after kicker
      { min: new THREE.Vector3(-4, 0, 72), max: new THREE.Vector3(4, 0.18, 86) },
      // Log top
      { min: new THREE.Vector3(3.2, 0.2, 90), max: new THREE.Vector3(4.4, 0.52, 98) },
      // Finish clearing
      { min: new THREE.Vector3(-5, 0, 96), max: new THREE.Vector3(5, 0.15, 108) },
    ],
    bounds: { minX: -12, maxX: 12, minZ: -2, maxZ: 112 },
  }
}
