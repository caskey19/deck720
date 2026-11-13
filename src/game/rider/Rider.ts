import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { DECKS, HATS, PANTS, SHOES, SHIRTS, findCosmetic } from '../cosmetics'
import type { KitSelection } from '../../storage/persist'

export class Rider {
  readonly group = new THREE.Group()
  readonly board: THREE.Group
  private body: THREE.Group
  private shirtMesh: THREE.Mesh
  private pantsMesh: THREE.Mesh
  private shoeL: THREE.Mesh
  private shoeR: THREE.Mesh
  private hatMesh: THREE.Mesh
  private deckMesh: THREE.Mesh
  private headMesh: THREE.Mesh
  private armL: THREE.Mesh
  private armR: THREE.Mesh
  private legs: THREE.Group[] = []

  constructor() {
    this.body = new THREE.Group()
    this.board = new THREE.Group()

    // Legs / pants — slightly taller silhouette for chase-cam readability
    const pantsGeo = new RoundedBoxGeometry(0.4, 0.26, 0.3, 2, 0.07)
    this.pantsMesh = new THREE.Mesh(pantsGeo, new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.9 }))
    this.pantsMesh.position.y = 0.87
    this.pantsMesh.castShadow = true

    // Torso
    const shirtGeo = new RoundedBoxGeometry(0.53, 0.58, 0.34, 3, 0.1)
    this.shirtMesh = new THREE.Mesh(shirtGeo, new THREE.MeshStandardMaterial({ color: '#1d1a17', roughness: 0.85 }))
    this.shirtMesh.position.y = 1.2
    this.shirtMesh.castShadow = true

    // Arms
    const armMat = new THREE.MeshStandardMaterial({ color: '#c4a07a', roughness: 0.8 })
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.37, 3, 8)
    this.armL = new THREE.Mesh(armGeo, armMat)
    this.armL.position.set(-0.33, 1.15, 0)
    this.armR = new THREE.Mesh(armGeo, armMat)
    this.armR.position.set(0.33, 1.15, 0)
    this.armL.castShadow = this.armR.castShadow = true

    // Head
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#c4a07a', roughness: 0.75 }),
    )
    this.headMesh.position.y = 1.62
    this.headMesh.castShadow = true

    // Hat
    this.hatMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.19, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.85 }),
    )
    this.hatMesh.position.y = 1.78
    this.hatMesh.visible = false

    this.body.add(this.pantsMesh, this.shirtMesh, this.armL, this.armR, this.headMesh, this.hatMesh)
    for (const [x, z] of [[-0.09, 0.22], [0.09, -0.22]]) {
      const leg = new THREE.Group()
      leg.position.set(x, 0.88, z)
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.23, 3, 8), this.pantsMesh.material)
      thigh.position.set(0, -0.17, 0.035)
      thigh.rotation.x = -0.22
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.23, 3, 8), this.pantsMesh.material)
      shin.position.set(0, -0.52, 0)
      shin.rotation.x = 0.2
      leg.add(thigh, shin)
      this.legs.push(leg)
      this.body.add(leg)
    }
    // Hoodie hood, sleeve caps, nose and ears give the silhouette volume.
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.shirtMesh.material)
    hood.scale.set(1, 0.7, 0.7)
    hood.position.set(0, 1.43, -0.11)
    this.shirtMesh.add(hood)
    hood.position.set(0, 0.23, -0.1)
    for (const x of [-0.27, 0.27]) {
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.12, 3, 8), this.shirtMesh.material)
      sleeve.position.set(x, 0.08, 0)
      this.shirtMesh.add(sleeve)
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), this.headMesh.material)
    nose.position.set(0, 0, 0.145)
    this.headMesh.add(nose)
    const brim = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.025, 0.2, 2, 0.015), this.hatMesh.material)
    brim.position.set(0, -0.02, 0.12)
    this.hatMesh.add(brim)
    this.body.position.y = 0.02

    // Board — longer deck silhouette
    const outline = new THREE.Shape()
    outline.moveTo(-0.14, -0.34)
    outline.quadraticCurveTo(-0.14, -0.51, 0, -0.51)
    outline.quadraticCurveTo(0.14, -0.51, 0.14, -0.34)
    outline.lineTo(0.14, 0.34)
    outline.quadraticCurveTo(0.14, 0.51, 0, 0.51)
    outline.quadraticCurveTo(-0.14, 0.51, -0.14, 0.34)
    outline.closePath()
    const deckGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.032, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.012, bevelThickness: 0.008 })
    deckGeo.rotateX(Math.PI / 2)
    this.deckMesh = new THREE.Mesh(
      deckGeo,
      new THREE.MeshStandardMaterial({ color: '#e8a838', roughness: 0.55, metalness: 0.05 }),
    )
    this.deckMesh.castShadow = true
    this.deckMesh.receiveShadow = true

    const truckMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.7, roughness: 0.35 })
    const truckGeo = new THREE.BoxGeometry(0.32, 0.05, 0.08)
    const truckF = new THREE.Mesh(truckGeo, truckMat)
    truckF.position.set(0, -0.05, 0.28)
    const truckB = new THREE.Mesh(truckGeo, truckMat)
    truckB.position.set(0, -0.05, -0.28)

    const wheelMat = new THREE.MeshStandardMaterial({ color: '#f0ece4', roughness: 0.4 })
    const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10)
    const wheels: THREE.Mesh[] = []
    for (const [x, z] of [
      [-0.14, 0.28],
      [0.14, 0.28],
      [-0.14, -0.28],
      [0.14, -0.28],
    ] as const) {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x, -0.1, z)
      wheels.push(w)
    }

    this.shoeL = new THREE.Mesh(
      new RoundedBoxGeometry(0.17, 0.12, 0.3, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: '#c4a574', roughness: 0.8 }),
    )
    this.shoeL.position.set(-0.035, 0.09, 0.26)
    this.shoeL.rotation.y = 1.1
    this.shoeR = this.shoeL.clone()
    this.shoeR.position.set(0.035, 0.09, -0.25)
    this.shoeR.rotation.y = 1.35

    const grip = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshStandardMaterial({color: '#24292b', roughness: 1}))
    grip.rotation.x = -Math.PI / 2
    grip.position.y = 0.02
    grip.scale.set(0.92, 0.96, 1)
    this.board.add(grip)
    for (const shoe of [this.shoeL, this.shoeR]) {
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.028, 0.31, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#e7e4d9' }))
      sole.position.y = -0.05
      shoe.add(sole)
    }
    this.board.add(this.deckMesh, truckF, truckB, ...wheels, this.shoeL, this.shoeR)
    this.board.position.y = 0.12

    // Soft ground blob for readable contact
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.02
    shadow.renderOrder = -1

    this.group.add(shadow, this.board, this.body)
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  applyKit(kit: KitSelection): void {
    const deck = findCosmetic(DECKS, kit.deck)
    const shirt = findCosmetic(SHIRTS, kit.shirt)
    const pants = findCosmetic(PANTS, kit.pants)
    const shoes = findCosmetic(SHOES, kit.shoes)
    const hat = findCosmetic(HATS, kit.hat)

    ;(this.deckMesh.material as THREE.MeshStandardMaterial).color.set(deck.color)
    ;(this.shirtMesh.material as THREE.MeshStandardMaterial).color.set(shirt.color)
    ;(this.pantsMesh.material as THREE.MeshStandardMaterial).color.set(pants.color)
    ;(this.shoeL.material as THREE.MeshStandardMaterial).color.set(shoes.color)
    ;(this.shoeR.material as THREE.MeshStandardMaterial).color.set(shoes.color)

    if (kit.hat === 'none') {
      this.hatMesh.visible = false
    } else {
      this.hatMesh.visible = true
      ;(this.hatMesh.material as THREE.MeshStandardMaterial).color.set(hat.color)
    }
  }

  setPose(opts: {
    crouch: number
    boardSpin: number
    boardRoll: number
    lean: number
    armsOut: number
  }): void {
    const crouch = THREE.MathUtils.clamp(opts.crouch, 0, 1)
    const grab = THREE.MathUtils.clamp(opts.armsOut, 0, 1)
    // Stronger crouch read while charging pop
    this.body.position.y = 0.02 - 0.28 * crouch
    this.body.rotation.x = 0.28 * crouch
    this.body.rotation.z = opts.lean * 0.28
    this.pantsMesh.position.y = 0.87 + 0.12 * crouch
    for (const leg of this.legs) {
      leg.scale.y = 1 - 0.18 * crouch
      leg.rotation.x = -0.28 * crouch
      leg.position.y = 0.88 + 0.12 * crouch
    }
    this.shirtMesh.position.y = 1.2 - 0.12 * crouch
    this.headMesh.position.y = 1.62 - 0.14 * crouch
    this.hatMesh.position.y = 1.78 - 0.14 * crouch

    this.board.rotation.z = opts.boardSpin
    this.board.rotation.x = opts.boardRoll

    // Grab: arms reach down/out toward the board
    this.armL.rotation.x = -1.15 * grab
    this.armR.rotation.x = -1.15 * grab
    this.armL.rotation.z = 0.55 * grab
    this.armR.rotation.z = -0.55 * grab
    this.armL.position.y = 1.15 - 0.08 * grab - 0.12 * crouch
    this.armR.position.y = 1.15 - 0.08 * grab - 0.12 * crouch
  }
}
