import * as THREE from 'three'
import { surface } from './materials'

function block(group: THREE.Group,x: number,y: number,z: number,w: number,h: number,d: number,material: THREE.Material): THREE.Mesh {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh
}

function sign(group: THREE.Group,text: string,x: number,y: number,z: number,rotation = 0): void {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#223b3c';ctx.fillRect(0,0,1024,256)
  ctx.fillStyle='#e9ddc0';ctx.font='bold 130px sans-serif';ctx.fillText(text,35,170)
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide,roughness:0.9}))
  panel.position.set(x,y,z);panel.rotation.y=rotation;group.add(panel)
}

export function apexScenery(group: THREE.Group): void {
  block(group,0,-0.6,48,100,0.6,180,surface('concrete','#adb8af'))
  for(const side of [-1,1]){
    // Terraced seating and colored seat bands face the course.
    for(let tier=0;tier<5;tier++){
      const x=side*(14+tier*1.15),h=0.55+tier*0.55
      block(group,x,h/2,49,1.1,h,70,surface('concrete','#b6beb7'))
      for(let z=17;z<84;z+=3)block(group,x,h+0.08,z,0.65,0.13,1.8,surface('paint',tier%2?'#d1ab63':'#628985'))
    }
    for(const z of [8,45,88]){
      block(group,side*20,5,z,0.22,10,0.22,surface('steel'))
      block(group,side*20,10,z,2.5,0.18,0.5,surface('paint','#ded8ba'))
    }
    block(group,side*25,3.4,56,8,6.8,84,surface('rubber','#697d74'))
  }
  for(const x of [-8,8]){
    block(group,x,2.8,106,0.25,5.6,0.25,surface('steel'))
    block(group,x,2.8,108,1.4,5.6,0.12,surface('paint','#6b9e9a'))
  }
  block(group,0,5.6,106,16.3,0.3,0.3,surface('steel'))
  sign(group,'APEX / DECK7',0,4.4,107)
  // Vertical ribs across distant pavilion keep the silhouette architectural.
  for(let x=-22;x<=22;x+=2)block(group,x,3.5,122,0.25,7,0.4,surface('wood','#a99a7d'))
  block(group,0,7.1,123,48,0.2,9,surface('steel','#6a7e7c'))
}

export function bigAirScenery(group: THREE.Group): void {
  block(group,0,-0.65,48,220,0.8,240,surface('concrete','#b4a28a'))
  // Quarry terraces stay outside the skate bounds; landing lane remains honest.
  for(const side of [-1,1])for(let tier=0;tier<4;tier++){
    block(group,side*(24+tier*13),2+tier*3,55,18,4+tier*6,180,surface('concrete',tier%2?'#ab9276':'#b6a186'))
  }
  const rockGeometry=new THREE.IcosahedronGeometry(1,1)
  for(const side of [-1,1])for(let i=0;i<7;i++){
    const rock=new THREE.Mesh(rockGeometry,surface('concrete','#8e826c'))
    rock.position.set(side*(26+(i%3)*15),5,8+i*20);rock.scale.set(6+i%3,10+i%4*3,8);rock.castShadow=true;group.add(rock)
  }
  // Overlook gantry, steel bracing and deck emphasize the mega ramp's scale.
  for(const side of [-1,1]){
    block(group,side*17,5,46,0.4,10,0.4,surface('steel','#636e67'))
    block(group,side*17,5,58,0.4,10,0.4,surface('steel','#636e67'))
    block(group,side*17,10,52,3,0.25,16,surface('steel','#636e67'))
    for(let z=46;z<=58;z+=2)block(group,side*18.2,10.7,z,0.08,1.3,0.08,surface('steel'))
    block(group,side*18.2,11.3,52,0.07,0.07,12,surface('steel'))
    block(group,side*17,0.06,20,3,0.12,30,surface('wood','#ad946c'))
  }
  sign(group,'BIG AIR',-17,6,35,Math.PI/2)
  // Distant ridgeline, original low-poly silhouettes.
  for(let i=0;i<9;i++){
    const hill=new THREE.Mesh(new THREE.ConeGeometry(22,25+i%3*9,5),surface('concrete','#8d9488'))
    hill.position.set(-110+i*28,6,180+i%2*12);group.add(hill)
  }
}

export function channelScenery(group: THREE.Group): void {
  block(group,0,-0.55,45,130,0.6,180,surface('concrete','#a5a59a'))
  // Canal-side promenade and opposing street fronts, entirely beyond ride bounds.
  const water=new THREE.Mesh(new THREE.PlaneGeometry(8,160),new THREE.MeshStandardMaterial({color:'#527e82',roughness:0.26,metalness:0.25}))
  water.rotation.x=-Math.PI/2;water.position.set(-24,-0.16,48);group.add(water)
  for(const x of [-19.5,-28.5])block(group,x,0.05,48,0.5,0.5,160,surface('concrete','#b1b2a5'))
  for(let z=-10;z<125;z+=5){
    block(group,-18.5,0.6,z,0.08,1.2,0.08,surface('steel','#526d6b'))
    block(group,-18.5,1.1,z+2.5,0.06,0.06,5,surface('steel','#526d6b'))
  }
  const glass=surface('steel','#526f7c')
  for(let i=0;i<8;i++){
    const z=-5+i*17,h=8+i%3*2
    block(group,24,h/2,z,12,h,15,surface('brick',i%2?'#a38270':'#b6a691'))
    block(group,17.8,0.3,z,0.4,0.6,15,surface('concrete','#d1c3a7'))
    block(group,17.6,3.2,z,1.4,0.12,12,surface('paint',i%2?'#b0875a':'#668b82'))
    for(const dz of [-5,0,5])for(let y=2;y<h-1;y+=2.5){
      block(group,17.9,y,z+dz,0.12,1.6,2,glass)
      block(group,17.8,y-0.8,z+dz,0.15,0.08,2.2,surface('concrete','#c7bba5'))
    }
  }
  for(let i=0;i<12;i++){
    const z=i*11,x=-16
    block(group,x,0.2,z,1.8,0.4,1.8,surface('concrete','#a99e8a'))
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.16,3,7),surface('wood','#695a44'))
    trunk.position.set(x,1.7,z);group.add(trunk)
    const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),surface('rubber','#74886a'))
    canopy.position.set(x,3.7,z);canopy.scale.set(1.1,1.5,1.1);canopy.castShadow=true;group.add(canopy)
  }
  sign(group,'CHANNEL',17.5,5.5,44,-Math.PI/2)
  // A footbridge sits beyond the playable course, framing the finish view.
  block(group,-24,2.5,126,13,0.35,4,surface('steel','#7b8980'))
  for(const z of [124.2,127.8])block(group,-24,3.2,z,13,0.08,0.08,surface('steel'))
}
