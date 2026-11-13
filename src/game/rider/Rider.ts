import { ClothLimb } from './ClothLimb'
import { fabric } from './fabric'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { DECKS, HATS, PANTS, SHOES, SHIRTS, findCosmetic } from '../cosmetics'
import type { KitSelection } from '../../storage/persist'

export type RiderGrab = 'mute' | 'tail' | 'japan'

export class Rider {
  readonly group = new THREE.Group()
  readonly board: THREE.Group
  private deckArt = document.createElement('canvas')
  private deckArtMap: THREE.CanvasTexture
  private jacketDetails = new THREE.Group()
  private hoodLining = new THREE.MeshStandardMaterial({color:'#87918a',roughness:1})
  private hood: THREE.Mesh
  private skin = new THREE.MeshStandardMaterial({ color: '#c4a07a', roughness: 0.8 })
  private arms: { upper: THREE.Mesh; forearm: THREE.Mesh; hand: THREE.Mesh; sleeve: THREE.Mesh; elbow: THREE.Mesh; shoulderCap: THREE.Mesh; cloth: ClothLimb; shoulder: THREE.Vector3; side: number }[] = []
  private feet = new THREE.Group()
  private body: THREE.Group
  private shirtMesh: THREE.Mesh
  private pantsMesh: THREE.Mesh
  private shoeL: THREE.Mesh
  private shoeR: THREE.Mesh
  private hatMesh: THREE.Mesh
  private deckMesh: THREE.Mesh
  private headMesh: THREE.Mesh
  private legs: { thigh: THREE.Mesh; shin: THREE.Mesh; knee: THREE.Mesh; cloth: ClothLimb; hip: THREE.Vector3 }[] = []
  private poseState: { crouch: number; lean: number; armsOut: number; push: number; grab?: RiderGrab } = { crouch: 0, lean: 0, armsOut: 0, push: 0 }
  get replayPose() { return { ...this.poseState } }
  private inverseBody = new THREE.Matrix4()
  private ankle = new THREE.Vector3()
  private knee = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private bend = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)
  private armTarget = new THREE.Vector3()
  private armRest = new THREE.Vector3()
  private armElbow = new THREE.Vector3()
  private armBend = new THREE.Vector3()
  private sleeveEnd = new THREE.Vector3()

  constructor() {
    this.body = new THREE.Group()
    this.board = new THREE.Group()

    // Legs / pants — slightly taller silhouette for chase-cam readability
    const pantsGeo = new RoundedBoxGeometry(0.45, 0.26, 0.35, 3, 0.08)
    this.pantsMesh = new THREE.Mesh(pantsGeo, new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 1, map: fabric(true) }))
    this.pantsMesh.position.y = 0.87
    this.pantsMesh.scale.set(1,0.7,0.8)
    this.pantsMesh.castShadow = true

    // Torso
    const torsoCurve=new THREE.SplineCurve([
      new THREE.Vector2(0.22,-0.32),new THREE.Vector2(0.265,-0.25),new THREE.Vector2(0.28,-0.05),new THREE.Vector2(0.285,0.14),new THREE.Vector2(0.265,0.24),new THREE.Vector2(0.15,0.32),
    ])
    const torsoProfile=[new THREE.Vector2(0,-0.32),...torsoCurve.getPoints(32),new THREE.Vector2(0,0.32)]
    const shirtGeo=new THREE.LatheGeometry(torsoProfile,48)
    shirtGeo.scale(1,1,0.72)
    this.shirtMesh = new THREE.Mesh(shirtGeo, new THREE.MeshStandardMaterial({ color: '#1d1a17', roughness: 0.95, map: fabric() }))
    this.shirtMesh.position.y = 1.2
    this.shirtMesh.castShadow = true

    // Shoulder, elbow and hand anchors share the same pose solver as the legs.
    for (const side of [-1, 1]) {
      const index=this.arms.length
      const upper=new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.82,4,12),this.skin)
      const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(0.075,0.85,4,12),this.skin)
      const hand=new THREE.Mesh(new THREE.SphereGeometry(0.065,16,12),this.skin)
      const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(0.105,0.79,4,12),this.shirtMesh.material)
      upper.name=`rig upper arm ${index}`;forearm.name=`rig forearm ${index}`;hand.name=`rig hand ${index}`
      hand.scale.set(0.85,1.15,1)
      const elbow=new THREE.Mesh(new THREE.SphereGeometry(0.08,12,8),this.skin)
      const shoulderCap=new THREE.Mesh(new THREE.SphereGeometry(0.108,24,16),this.shirtMesh.material)
      const cloth=new ClothLimb([this.shirtMesh.material as THREE.Material,this.skin],[0.105,0.085,0.065],0.29)
      upper.visible=forearm.visible=sleeve.visible=elbow.visible=false
      this.arms.push({upper,forearm,hand,sleeve,elbow,shoulderCap,cloth,shoulder:new THREE.Vector3(side*0.32,1.4,0),side})
      this.body.add(upper,forearm,hand,sleeve,elbow,shoulderCap,cloth)
    }

    // Head
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#c4a07a', roughness: 0.75 }),
    )
    this.headMesh.scale.set(1,1.12,0.95)
    this.headMesh.position.y = 1.62
    this.headMesh.castShadow = true

    // Hat
    this.hatMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.19, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.85 }),
    )
    this.hatMesh.position.y = 1.78
    this.hatMesh.visible = false

    this.body.add(this.pantsMesh, this.shirtMesh, this.headMesh, this.hatMesh)
    for (const [x, z] of [[-0.09, 0.18], [0.09, -0.18]]) {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.71, 4, 12), this.pantsMesh.material)
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.74, 4, 12), this.pantsMesh.material)
      thigh.name = `rig thigh ${this.legs.length}`
      shin.name = `rig shin ${this.legs.length}`
      const knee=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10),this.pantsMesh.material)
      const cloth=new ClothLimb([this.pantsMesh.material as THREE.Material,this.pantsMesh.material as THREE.Material],[0.14,0.13,0.105])
      thigh.visible=shin.visible=knee.visible=false
      this.legs.push({ thigh, shin, knee, cloth, hip: new THREE.Vector3(x, 0.85, z) })
      this.body.add(thigh, shin, knee,cloth)
    }
    // Hoodie hood, sleeve caps, nose and ears give the silhouette volume.
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), this.shirtMesh.material)
    this.hood = hood
    hood.scale.set(1, 0.7, 0.7)
    hood.position.set(0, 1.43, -0.11)
    this.shirtMesh.add(hood)
    hood.position.set(0, 0.23, -0.1)
    // Layered collar and original seam details; no reference branding.
    this.shirtMesh.add(this.jacketDetails)
    const seamMat=new THREE.MeshStandardMaterial({color:'#a3aaa3',roughness:0.8})
    const zipperCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-0.28,0.17),new THREE.Vector3(0,0,0.211),new THREE.Vector3(0,0.21,0.16)])
    this.jacketDetails.add(new THREE.Mesh(new THREE.TubeGeometry(zipperCurve,14,0.006,5,false),seamMat))
    const pull=new THREE.Mesh(new RoundedBoxGeometry(0.023,0.035,0.012,2,0.003),seamMat);pull.position.set(0,0.06,0.218);this.jacketDetails.add(pull)
    for(const side of [-1,1]){
      const pocket=new THREE.CatmullRomCurve3([new THREE.Vector3(side*0.09,-0.24,0.18),new THREE.Vector3(side*0.15,-0.17,0.17),new THREE.Vector3(side*0.2,-0.12,0.15)])
      this.jacketDetails.add(new THREE.Mesh(new THREE.TubeGeometry(pocket,8,0.004,4,false),seamMat))
    }
    const collar=new THREE.Mesh(new THREE.TorusGeometry(0.115,0.025,6,16,Math.PI),this.hoodLining);collar.rotation.x=Math.PI/2;collar.position.set(0,0.29,0.015);this.jacketDetails.add(collar)
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
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.17,12,6,0,Math.PI*2,0,Math.PI/2),this.hatMesh.material)
    crown.name='beanie crown';crown.scale.y=0.6;crown.position.y=0.05;crown.visible=false;this.hatMesh.add(crown)
    for(const x of [-0.05,0.05]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.012,6,4),new THREE.MeshStandardMaterial({color:'#302a25',roughness:1}))
      eye.visible=false;eye.position.set(x,0.015,0.145);this.headMesh.add(eye)
    }
    const helmet = new THREE.Group();helmet.name='helmet details'
    const shell=new THREE.Mesh(new THREE.SphereGeometry(0.205,40,24,0,Math.PI*2,0,Math.PI/2),this.hatMesh.material)
    shell.position.y=-0.025;helmet.add(shell)
    const strapCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.18,-0.04,0),new THREE.Vector3(-0.14,-0.3,0.04),new THREE.Vector3(0,-0.34,0.09),new THREE.Vector3(0.14,-0.3,0.04),new THREE.Vector3(0.18,-0.04,0)])
    helmet.add(new THREE.Mesh(new THREE.TubeGeometry(strapCurve,20,0.009,5,false),new THREE.MeshStandardMaterial({color:'#272a2b',roughness:0.9})))
    helmet.visible=false;this.hatMesh.add(helmet)
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
      new RoundedBoxGeometry(0.19, 0.13, 0.32, 3, 0.04),
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
      const laceMat=new THREE.MeshStandardMaterial({color:'#ecebe2',roughness:1})
      for(const z of [-0.065,-0.025,0.015,0.055]){
        const lace=new THREE.Mesh(new THREE.BoxGeometry(0.105,0.008,0.012),laceMat);lace.position.set(0,0.066,z);shoe.add(lace)
      }
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
    const jacket=kit.shirt==='navy'
    this.jacketDetails.visible=jacket
    this.hood.visible=kit.shirt==='rust'||jacket
    this.hood.material=jacket?this.hoodLining:this.shirtMesh.material
    for(const arm of this.arms){arm.upper.material=(kit.shirt==='rust'||jacket)?this.shirtMesh.material:this.skin;arm.forearm.material=(kit.shirt==='rust'||jacket)?this.shirtMesh.material:this.skin;arm.elbow.material=arm.forearm.material;arm.cloth.setSleeve(kit.shirt==='rust'||jacket)}
    ;(this.deckMesh.material as THREE.MeshStandardMaterial).color.set(deck.color)
    ;(this.shirtMesh.material as THREE.MeshStandardMaterial).color.set(shirt.color)
    ;(this.pantsMesh.material as THREE.MeshStandardMaterial).color.set(pants.color)
    ;(this.shoeL.material as THREE.MeshStandardMaterial).color.set(shoes.color)
    ;(this.shoeR.material as THREE.MeshStandardMaterial).color.set(shoes.color)

    this.hatMesh.getObjectByName('helmet details')!.visible = kit.hat === 'helmet'
    this.hatMesh.getObjectByName('cap brim')!.visible = kit.hat === 'cap'
    this.hatMesh.getObjectByName('bucket rim')!.visible = kit.hat === 'bucket'
    this.hatMesh.getObjectByName('beanie crown')!.visible = kit.hat === 'beanie'
    this.hatMesh.scale.set(1, kit.hat === 'beanie' ? 1.5 : 1, 1)
    if (kit.hat === 'none') {
      this.hatMesh.visible = false
    } else {
      this.hatMesh.visible = true
      ;(this.hatMesh.material as THREE.MeshStandardMaterial).color.set(hat.color)
      ;(this.hatMesh.material as THREE.MeshStandardMaterial).roughness=kit.hat==='helmet'?0.42:0.85
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
    grab?: RiderGrab | null
  }): void {
    this.shoeL.position.set(-0.035,0.09,0.26);this.shoeL.rotation.y=1.1;this.shoeR.rotation.y=1.35
    this.legs.forEach((leg,i)=>leg.hip.set(i===0?-0.09:0.09,0.85,i===0?0.18:-0.18))
    const rawCrouch = THREE.MathUtils.clamp(opts.crouch, 0, 1)
    const grab = opts.airborne === false ? 0 : THREE.MathUtils.clamp(opts.armsOut, 0, 1)
    const crouch = Math.max(rawCrouch,grab*0.85)
    const push = THREE.MathUtils.clamp(opts.push ?? 0, 0, 1)
    this.poseState = { crouch: rawCrouch, lean: opts.lean, armsOut: THREE.MathUtils.clamp(opts.armsOut,0,1), push, grab: opts.grab ?? undefined }
    // Back foot traces a short push stroke while the front foot stays planted.
    this.shoeR.position.set(0.035 + push * 0.28, 0.09 - Math.sin(push * Math.PI) * 0.16, -0.25 - push * 0.35)
    // Stronger crouch read while charging pop
    this.body.position.y = 0.02 - 0.28 * crouch - grab * 0.1
    this.body.rotation.x = 0.28 * crouch - (opts.grab==='tail'?grab*0.52:0)
    this.body.rotation.z = opts.lean * 0.28
    this.pantsMesh.position.y = 0.87 + 0.12 * crouch
    this.shirtMesh.position.y = 1.2 - 0.12 * crouch
    this.headMesh.position.y = 1.62 - 0.14 * crouch
    this.hatMesh.position.y = 1.78 - 0.14 * crouch

    this.board.position.set(0,0.025+grab*0.28,0)
    this.board.rotation.z = opts.boardSpin
    this.board.rotation.x = opts.boardRoll
    this.feet.rotation.x = opts.boardRoll
    this.feet.position.y = this.board.position.y + (opts.airborne ? 0.16 : 0)

    this.solveLegs()
    this.solveArms(grab,opts.grab ?? 'mute',crouch,push)
  }

  setLobbyPose(time=0): void {
    this.setPose({crouch:0,boardSpin:0,boardRoll:0,lean:0,armsOut:0,airborne:false})
    this.body.position.y=0.02+Math.sin(time*0.0015)*0.006
    this.pantsMesh.position.y=0.9
    this.feet.position.y=-0.145
    this.shoeL.position.set(-0.14,0.09,0);this.shoeR.position.set(0.14,0.09,0)
    this.shoeL.rotation.y=this.shoeR.rotation.y=0
    this.legs.forEach((leg,i)=>leg.hip.set(i===0?-0.12:0.12,0.84,0))
    this.board.position.set(-0.48,0.5,0.05);this.board.rotation.set(-Math.PI/2,0,0.035)
    this.solveLegs();this.solveArms(0,'mute',0,0)
  }

  private solveArms(grab: number, kind: RiderGrab, crouch: number, push: number): void {
    this.board.updateMatrix()
    const active = kind==='mute' ? 0 : 1
    for(let i=0;i<this.arms.length;i++){
      const arm=this.arms[i],shoulder=arm.shoulder
      shoulder.set(arm.side*0.285,1.4-crouch*0.12,0)
      // Default bent elbows and a small counter-swing while pushing.
      this.armRest.set(arm.side*0.39,0.67-crouch*0.12,0.1+push*arm.side*0.16)
      if(grab>0){
        if(i===active){
          if(kind==='tail')this.armTarget.set(0.08,-0.015,-0.45)
          else if(kind==='japan')this.armTarget.set(-0.145,0.015,0.26)
          else this.armTarget.set(-0.145,0.015,0.13)
          this.armTarget.applyMatrix4(this.board.matrix).applyMatrix4(this.inverseBody)
        } else this.armTarget.set(arm.side*0.68,1.13-crouch*0.1,-0.12)
        this.armRest.lerp(this.armTarget,grab)
      }
      this.direction.subVectors(this.armRest,shoulder)
      const distance=this.direction.length()
      // Clamp unreachable targets rather than stretch a limb through the torso.
      if(distance>0.758)this.armRest.copy(shoulder).addScaledVector(this.direction,0.758/distance)
      this.direction.subVectors(this.armRest,shoulder).normalize()
      this.armBend.set(arm.side,0,-0.35)
      this.armBend.addScaledVector(this.direction,-this.armBend.dot(this.direction)).normalize()
      const span=shoulder.distanceTo(this.armRest)
      this.armElbow.copy(shoulder).lerp(this.armRest,0.5).addScaledVector(this.armBend,Math.sqrt(Math.max(0,0.38**2-(span/2)**2)))
      arm.shoulderCap.position.copy(shoulder)
      arm.elbow.position.copy(this.armElbow)
      this.placeLimb(arm.upper,shoulder,this.armElbow)
      this.placeLimb(arm.forearm,this.armElbow,this.armRest)
      arm.hand.position.copy(this.armRest)
      arm.cloth.update(shoulder,this.armElbow,this.armRest)
      this.sleeveEnd.copy(shoulder).lerp(this.armElbow,0.47)
      this.placeLimb(arm.sleeve,shoulder,this.sleeveEnd)
    }
  }

  /** Two equal-length segments bend toward the nose and keep ankles at the shoes. */
  private solveLegs(): void {
    this.body.updateMatrix()
    this.feet.updateMatrix()
    this.inverseBody.copy(this.body.matrix).invert()
    const shoes = [this.shoeL, this.shoeR]
    for (let i = 0; i < this.legs.length; i++) {
      const { thigh, shin, knee, cloth, hip } = this.legs[i]
      this.ankle.copy(shoes[i].position)
      this.ankle.y += 0.07
      this.ankle.applyMatrix4(this.feet.matrix).applyMatrix4(this.inverseBody)
      this.direction.subVectors(this.ankle, hip)
      const distance = this.direction.length()
      this.direction.normalize()
      this.bend.set(0, 0, 1).addScaledVector(this.direction, -this.direction.z).normalize()
      this.knee.copy(hip).lerp(this.ankle, 0.5).addScaledVector(this.bend, Math.sqrt(Math.max(0, 0.4 ** 2 - (distance / 2) ** 2)))
      cloth.update(hip,this.knee,this.ankle)
      knee.position.copy(this.knee)
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
