import * as THREE from 'three'

export const PARK_LOOKS: Record<string, { sky: string; horizon: string; fog: string; near: number; far: number; sun: string; power: number; fill: string; ground: string }> = {
  'the-yard': {sky:'#537f9c',horizon:'#e4c6a0',fog:'#d6c7b3',near:65,far:230,sun:'#ffe0b0',power:3,fill:'#c6def2',ground:'#71624d'},
  'forest-line': {sky:'#597d72',horizon:'#c4c7a8',fog:'#b0bcaa',near:45,far:170,sun:'#e5ebcb',power:2.4,fill:'#c2d9d4',ground:'#58614d'},
  apex: {sky:'#6a8fae',horizon:'#d2dce0',fog:'#c2d1d4',near:65,far:200,sun:'#fff0d1',power:2.8,fill:'#d1e5f1',ground:'#78817a'},
  'big-air': {sky:'#688da7',horizon:'#e9d0ae',fog:'#d7bfa0',near:80,far:250,sun:'#ffd19a',power:3.2,fill:'#d7e1eb',ground:'#88735b'},
  channel: {sky:'#788ab3',horizon:'#e1bca8',fog:'#cfb8b3',near:60,far:210,sun:'#ffd6b8',power:2.7,fill:'#ced8ee',ground:'#77655f'},
}
export function parkLook(id: string) { return PARK_LOOKS[id] ?? PARK_LOOKS['the-yard'] }

export function lightPark(scene: THREE.Scene, id: string): THREE.DirectionalLight {
  const look=parkLook(id)
  scene.background=new THREE.Color(look.horizon)
  scene.fog=new THREE.Fog(look.fog,look.near,look.far)
  scene.add(new THREE.HemisphereLight(look.fill,look.ground,1.65))
  const sun=new THREE.DirectionalLight(look.sun,look.power)
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048)
  sun.shadow.camera.near=1;sun.shadow.camera.far=180
  sun.shadow.camera.left=-38;sun.shadow.camera.right=38
  sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38
  sun.shadow.bias=-0.0003;sun.shadow.normalBias=0.035;sun.shadow.radius=3
  followSun(sun,new THREE.Vector3(0,0,15))
  scene.add(sun,sun.target,new THREE.AmbientLight('#ffffff',0.2))
  return sun
}

/** Fixed sun direction, moving local shadow volume: consistent contact over long parks. */
export function followSun(sun: THREE.DirectionalLight, position: THREE.Vector3): void {
  sun.target.position.set(position.x,0,position.z)
  sun.position.copy(sun.target.position).add(SUN_OFFSET)
}
const SUN_OFFSET=new THREE.Vector3(-28,48,-20)
