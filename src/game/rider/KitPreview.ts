import * as THREE from 'three'
import { Rider } from './Rider'
import { disposeObject } from '../park/dispose'
import { lightPark, followSun } from '../park/atmosphere'
import type { KitSelection } from '../../storage/persist'

/** Small isolated turntable; shares original rider code, never starts a game run. */
export class KitPreview {
  readonly element = document.createElement('div')
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 30)
  private rider = new Rider()
  private events = new AbortController()
  private angle = -0.35
  private dragging = false
  private lastX = 0
  private showingDeck = false
  private elapsed = 0
  private lastDraw = -1
  private width = 0

  constructor(kit: KitSelection) {
    this.element.className = 'kit-preview'
    const canvas = document.createElement('canvas')
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', '3D kit preview. Drag or use left and right arrow keys to rotate.')
    canvas.style.touchAction = 'pan-y'
    this.renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const sun = lightPark(this.scene,'the-yard')
    sun.shadow.mapSize.set(512,512)
    sun.shadow.camera.left = sun.shadow.camera.bottom = -3
    sun.shadow.camera.right = sun.shadow.camera.top = 3
    followSun(sun,new THREE.Vector3())
    this.scene.background = new THREE.Color('#718581')
    this.scene.fog = null
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:'#8e9a8a',roughness:1}))
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor)
    this.rider.group.position.y=0.12
    this.rider.applyKit(kit)
    this.scene.add(this.rider.group)
    this.camera.position.set(2.5,1.9,3.5);this.camera.lookAt(0,0.97,0)
    const controls=document.createElement('div');controls.className='kit-preview-controls'
    const hint=document.createElement('span');hint.textContent='Drag to rotate'
    const inspect=document.createElement('button');inspect.className='btn';inspect.textContent='Show deck'
    inspect.type='button';inspect.setAttribute('aria-pressed','false')
    const options={signal:this.events.signal}
    inspect.addEventListener('click',()=>{this.showingDeck=!this.showingDeck;inspect.textContent=this.showingDeck?'Riding stance':'Show deck';inspect.setAttribute('aria-pressed',String(this.showingDeck))},options)
    controls.append(hint,inspect);this.element.append(canvas,controls)
    canvas.addEventListener('pointerdown',event=>{this.dragging=true;this.lastX=event.clientX;canvas.setPointerCapture(event.pointerId)},options)
    canvas.addEventListener('pointermove',event=>{if(this.dragging){this.angle+=(event.clientX-this.lastX)*0.012;this.lastX=event.clientX}},options)
    const end=()=>{this.dragging=false}
    canvas.addEventListener('pointerup',end,options);canvas.addEventListener('pointercancel',end,options)
    canvas.addEventListener('keydown',event=>{if(event.code==='ArrowLeft'||event.code==='ArrowRight'){event.preventDefault();this.angle+=event.code==='ArrowLeft'?-0.2:0.2}},options)
  }

  applyKit(kit: KitSelection): void { this.rider.applyKit(kit) }

  render(dt: number): void {
    this.elapsed+=dt
    if(this.elapsed-this.lastDraw<1/30)return
    this.lastDraw=this.elapsed
    const width=Math.max(1,this.element.clientWidth)
    if(width!==this.width){this.width=width;this.renderer.setSize(width,250,false);this.camera.aspect=width/250;this.camera.updateProjectionMatrix()}
    this.rider.group.rotation.y=this.angle
    this.rider.setPose({crouch:0.06,boardSpin:this.showingDeck?Math.PI:0,boardRoll:0,lean:0,armsOut:0,airborne:this.showingDeck})
    this.renderer.render(this.scene,this.camera)
  }

  dispose(): void {
    this.events.abort();disposeObject(this.scene);this.renderer.dispose();this.element.remove()
  }
}
