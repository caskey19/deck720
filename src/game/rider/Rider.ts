import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { DECKS, HATS, PANTS, SHOES, SHIRTS, findCosmetic } from '../cosmetics'
import type { KitSelection } from '../../storage/persist'

export class Rider {
  readonly group = new THREE.Group()
  readonly board: THREE.Group
  private deckArt = document.createElement('canvas')
  private deckArtMap: THREE.CanvasTexture
  private hood: THREE.Mesh
  private sleeves: THREE.Mesh[] = []
  private feet = new THREE.Group()
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
  private legs: { thigh: THREE.Mesh; shin: THREE.Mesh; hip: THREE.Vector3 }[] = []
  private poseState = { crouch: 0, lean: 0, armsOut: 0, push: 0 }
  get replayPose() { return { ...this.poseState } }
  private inverseBody = new THREE.Matrix4()
  private ankle = new THREE.Vector3()
  private knee = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private bend = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)

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
    for (const [x, z] of [[-0.09, 0.18], [0.09, -0.18]]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.78, 3, 8), this.pantsMesh.material)
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.81, 3, 8), this.pantsMesh.material)
      thigh.name = `rig thigh ${this.legs.length}`
      shin.name = `rig shin ${this.legs.length}`
      this.legs.push({ thigh, shin, hip: new THREE.Vector3(x, 0.85, z) })
      this.body.add(thigh, shin)
    }
    // Hoodie hood, sleeve caps, nose and ears give the silhouette volume.
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.shirtMesh.material)
    this.hood = hood
    hood.scale.set(1, 0.7, 0.7)
    hood.position.set(0, 1.43, -0.11)
    this.shirtMesh.add(hood)
    hood.position.set(0, 0.23, -0.1)
    for (const x of [-0.27, 0.27]) {
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.12, 3, 8), this.shirtMesh.material)
      sleeve.position.set(x, 0.08, 0)
      this.shirtMesh.add(sleeve)
      this.sleeves.push(sleeve)
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), this.headMesh.material)
    nose.position.set(0, 0, 0.145)
    this.headMesh.add(nose)
    const brim = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.025, 0.2, 2, 0.015), this.hatMesh.material)
    brim.name = 'cap brim'
    brim.position.set(0, -0.02, 0.12)
    this.hatMesh.add(brim)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 16), this.hatMesh.material)
    rim.name = 'bucket rim'
    rim.position.y = -0.05
    rim.visible = false
    this.hatMesh.add(rim)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.157, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48), new THREE.MeshStandardMaterial({color:'#3e3026',roughness:1}))
    hair.position.y = 0.035
    this.headMesh.add(hair)
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
    const gripUv = grip.geometry.getAttribute('uv')
    for(let i=0;i<gripUv.count;i++)gripUv.setXY(i,(gripUv.getX(i)+0.14)/0.28,(gripUv.getY(i)+0.51)/1.02)
    grip.rotation.x = -Math.PI / 2
    grip.position.y = 0.02
    grip.scale.set(0.92, 0.96, 1)
    const gripCanvas = document.createElement('canvas')
    gripCanvas.width = 128; gripCanvas.height = 512
    const gripCtx = gripCanvas.getContext('2d')!
    gripCtx.fillStyle = '#252b2d'; gripCtx.fillRect(0,0,128,512)
    let grainSeed = 721
    for(let i=0;i<2200;i++){
      grainSeed=(grainSeed*1664525+1013904223)>>>0
      const x=grainSeed%128,y=(grainSeed>>>8)%512
      gripCtx.fillStyle=i%2?'#303638':'#1a2021';gripCtx.fillRect(x,y,1,1)
    }
    gripCtx.fillStyle='#b9bea8';gripCtx.fillRect(59,120,10,5);gripCtx.fillRect(59,380,10,5)
    const gripMap = new THREE.CanvasTexture(gripCanvas);gripMap.colorSpace=THREE.SRGBColorSpace
    ;(grip.material as THREE.MeshStandardMaterial).map=gripMap
    this.board.add(grip)
    this.deckArt.width=128;this.deckArt.height=512
    this.deckArtMap=new THREE.CanvasTexture(this.deckArt)
    this.deckArtMap.colorSpace=THREE.SRGBColorSpace
    const graphic=new THREE.Mesh(new THREE.PlaneGeometry(0.23,0.77),new THREE.MeshStandardMaterial({map:this.deckArtMap,roughness:0.7}))
    graphic.rotation.x=Math.PI/2;graphic.position.y=-0.043
    this.board.add(graphic)
    for (const shoe of [this.shoeL, this.shoeR]) {
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.028, 0.31, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#e7e4d9' }))
      sole.position.y = -0.05
      shoe.add(sole)
    }
    this.board.add(this.deckMesh, truckF, truckB, ...wheels)
    this.feet.add(this.shoeL, this.shoeR)
    this.feet.position.y = 0.025
    this.board.position.y = 0.025

    this.group.add(this.board, this.feet, this.body)
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

    const ctx = this.deckArt.getContext('2d')!
    ctx.fillStyle=deck.color;ctx.fillRect(0,0,128,512)
    ctx.fillStyle=deck.secondary ?? '#172327'
    ctx.fillRect(12,0,13,512);ctx.fillRect(30,0,4,512)
    for(let i=0;i<7;i++)ctx.fillRect(46,90+i*24,70-i*7,10)
    ctx.font='bold 65px sans-serif';ctx.fillText('D7',38,405)
    ctx.font='12px sans-serif';ctx.fillText('DECK7',43,435)
    this.deckArtMap.needsUpdate=true
    this.hood.visible=kit.shirt==='rust'
    for(const sleeve of this.sleeves){sleeve.scale.y=kit.shirt==='rust'?1.8:1;sleeve.position.y=kit.shirt==='rust'?-0.03:0.08}
    ;(this.deckMesh.material as THREE.MeshStandardMaterial).color.set(deck.color)
    ;(this.shirtMesh.material as THREE.MeshStandardMaterial).color.set(shirt.color)
    ;(this.pantsMesh.material as THREE.MeshStandardMaterial).color.set(pants.color)
    ;(this.shoeL.material as THREE.MeshStandardMaterial).color.set(shoes.color)
    ;(this.shoeR.material as THREE.MeshStandardMaterial).color.set(shoes.color)

    this.hatMesh.getObjectByName('cap brim')!.visible = kit.hat === 'cap'
    this.hatMesh.getObjectByName('bucket rim')!.visible = kit.hat === 'bucket'
    this.hatMesh.scale.set(1, kit.hat === 'beanie' ? 1.5 : 1, 1)
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
    push?: number
    airborne?: boolean
  }): void {
    const crouch = THREE.MathUtils.clamp(opts.crouch, 0, 1)
    const grab = THREE.MathUtils.clamp(opts.armsOut, 0, 1)
    const push = THREE.MathUtils.clamp(opts.push ?? 0, 0, 1)
    this.poseState = { crouch, lean: opts.lean, armsOut: grab, push }
    // Back foot traces a short push stroke while the front foot stays planted.
    this.shoeR.position.set(0.035 + push * 0.28, 0.09 - Math.sin(push * Math.PI) * 0.16, -0.25 - push * 0.35)
    // Stronger crouch read while charging pop
    this.body.position.y = 0.02 - 0.28 * crouch
    this.body.rotation.x = 0.28 * crouch
    this.body.rotation.z = opts.lean * 0.28
    this.pantsMesh.position.y = 0.87 + 0.12 * crouch
    this.shirtMesh.position.y = 1.2 - 0.12 * crouch
    this.headMesh.position.y = 1.62 - 0.14 * crouch
    this.hatMesh.position.y = 1.78 - 0.14 * crouch

    this.board.rotation.z = opts.boardSpin
    this.board.rotation.x = opts.boardRoll
    this.feet.rotation.x = opts.boardRoll
    this.feet.position.y = 0.025 + (opts.airborne ? 0.16 : 0)

    // Grab: arms reach down/out toward the board
    this.armL.rotation.x = -1.15 * grab
    this.armR.rotation.x = -1.15 * grab
    this.armL.rotation.z = 0.55 * grab
    this.armR.rotation.z = -0.55 * grab
    this.armL.position.y = 1.15 - 0.08 * grab - 0.12 * crouch
    this.armR.position.y = 1.15 - 0.08 * grab - 0.12 * crouch
    this.armL.rotation.x -= push * 0.25
    this.armR.rotation.x += push * 0.2
    this.solveLegs()
  }

  /** Two equal-length segments bend toward the nose and keep ankles at the shoes. */
  private solveLegs(): void {
    this.body.updateMatrix()
    this.feet.updateMatrix()
    this.inverseBody.copy(this.body.matrix).invert()
    const shoes = [this.shoeL, this.shoeR]
    for (let i = 0; i < this.legs.length; i++) {
      const { thigh, shin, hip } = this.legs[i]
      this.ankle.copy(shoes[i].position)
      this.ankle.y += 0.07
      this.ankle.applyMatrix4(this.feet.matrix).applyMatrix4(this.inverseBody)
      this.direction.subVectors(this.ankle, hip)
      const distance = this.direction.length()
      this.direction.normalize()
      this.bend.set(0, 0, 1).addScaledVector(this.direction, -this.direction.z).normalize()
      this.knee.copy(hip).lerp(this.ankle, 0.5).addScaledVector(this.bend, Math.sqrt(Math.max(0, 0.4 ** 2 - (distance / 2) ** 2)))
      this.placeLimb(thigh, hip, this.knee)
      this.placeLimb(shin, this.knee, this.ankle)
    }
  }

  private placeLimb(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    this.direction.subVectors(to, from)
    const length = this.direction.length()
    mesh.position.copy(from).lerp(to, 0.5)
    mesh.scale.y = length
    mesh.quaternion.setFromUnitVectors(this.up, this.direction.normalize())
  }

}
