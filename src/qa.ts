import { lightPark, followSun } from './game/park/atmosphere'
import * as THREE from 'three'
import { batchPark } from './game/park/batch'
import { buildTheYard } from './game/park/TheYard'
import { buildForestLine } from './game/park/ForestLine'
import { buildApex } from './game/park/Apex'
import { buildBigAir } from './game/park/BigAir'
import { buildChannel } from './game/park/Channel'
import { Rider } from './game/rider/Rider'
import { DECKS, HATS, PANTS, SHIRTS, SHOES } from './game/cosmetics'
import { DEFAULT_KIT } from './storage/persist'

// Isolated review tool. Never reads or writes PB, settings, ghosts or replay storage.
const style = document.createElement('style')
style.textContent = `*{box-sizing:border-box}body{margin:0;background:#162024;color:#eee5d2;font:14px system-ui}header{display:flex;align-items:center;gap:24px;padding:18px 24px}a{color:#e6ae66;font-weight:900;letter-spacing:3px;text-decoration:none}header span{flex:1}button{background:#e6ae66;border:0;padding:10px 15px;border-radius:5px;font-weight:700}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:0 24px 20px}article{background:#233034;border:1px solid #405052;border-radius:8px;overflow:hidden}h2{font-size:13px;letter-spacing:2px;padding:12px 16px;margin:0}canvas{display:block;width:100%;aspect-ratio:16/10}footer{padding:15px 24px;color:#b8c8c4;position:sticky;bottom:0;background:#162024}@media(max-width:700px){main{grid-template-columns:1fr}header span{display:none}}`
document.head.append(style)
const views: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; rider: Rider }[] = []
const builders = [buildTheYard, buildForestLine, buildApex, buildBigAir, buildChannel]
const names = ['THE YARD / COURTYARD', 'FOREST LINE / TIMBER', 'APEX / CONCRETE', 'BIG AIR / GAP', 'CHANNEL / STREET', 'RIDER / KIT & CONTACT']
const status = document.querySelector<HTMLElement>('#status')!
let shaderErrors = 0
try {
  for (let i = 0; i < 6; i++) {
    const article = document.createElement('article'), title = document.createElement('h2'), canvas = document.createElement('canvas')
    title.textContent = names[i]; article.append(title, canvas); document.querySelector('#views')!.append(article)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.debug.onShaderError = () => { shaderErrors++; status.textContent = 'Shader error: inspect browser developer console before shipping.' }
    const scene = new THREE.Scene()
    const ids=['the-yard','forest-line','apex','big-air','channel','the-yard']
    const sun=lightPark(scene,ids[i])
    sun.shadow.mapSize.set(1024,1024)
    const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 500)
    const rider = new Rider(); rider.applyKit(DEFAULT_KIT)
    if (i < 5) {
      const park = batchPark(builders[i]()); scene.add(park.group)
      const z = i === 0 ? 20 : 10
      followSun(sun,new THREE.Vector3(0,0,z))
      rider.group.position.set(0, 0.12, z)
      camera.position.set(-3.8, 4.2, z - 8); camera.lookAt(0, 1.3, z + 12)
    } else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#999d91', roughness: 1 }))
      ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground)
      rider.group.position.y = 0.12; camera.position.set(2.6, 1.8, 3); camera.lookAt(0, 0.95, 0)
      followSun(sun,new THREE.Vector3(0,0,0))
    }
    scene.add(rider.group)
    views.push({ renderer, scene, camera, rider })
  }
  const resize = () => { for(const {renderer,camera} of views) {const width=renderer.domElement.clientWidth;renderer.setSize(width,width/1.6,false);camera.aspect=1.6;camera.updateProjectionMatrix()} }
  window.addEventListener('resize', resize); resize()
  let kit = 0
  document.querySelector('#kit')!.addEventListener('click', () => {
    kit++
    for(const {rider} of views)rider.applyKit({deck:DECKS[kit%DECKS.length].id,shirt:SHIRTS[kit%SHIRTS.length].id,pants:PANTS[kit%PANTS.length].id,shoes:SHOES[kit%SHOES.length].id,hat:HATS[kit%HATS.length].id})
  })
  let last = 0
  const frame = (time: number) => {
    // Review need only draw 15Hz; do not run six full-speed gameplay render loops.
    if(time-last>66){
      last=time
      for(let i=0;i<views.length;i++){
        const {renderer,scene,camera,rider}=views[i]
        rider.setPose({crouch:i===5?(Math.sin(time*0.001)+1)*0.35:0.12,boardSpin:i===5?Math.max(0,Math.sin(time*0.0007))*Math.PI*2:0,boardRoll:0,lean:0,armsOut:0,airborne:i===5})
        renderer.render(scene,camera)
      }
      if(!shaderErrors)status.textContent = `Rendered ${views.length} views · ${views.map(v=>v.renderer.info.render.calls).join(' / ')} draw calls including shadows · review rendering, contact, kit & sky. This page does not measure gameplay FPS.`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
} catch(error) { status.textContent = `Renderer unavailable: ${error instanceof Error ? error.message : String(error)}. Run this page in a WebGL-capable browser.` }
