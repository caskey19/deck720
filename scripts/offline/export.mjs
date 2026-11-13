import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as THREE from 'three'

// Optional offline art review. Canvas dependency is external to the shipped game.
const canvasModule=process.env.DECK7_CANVAS_MODULE ?? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas/index.js`
const {createCanvas}=await import(pathToFileURL(canvasModule).href)
globalThis.document={createElement:()=>createCanvas(256,256)}
const output=path.resolve('.offline')
fs.mkdirSync(output,{recursive:true})
function copy(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())copy(file);else if(file.endsWith('.ts')){const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,fs.readFileSync(file,'utf8').replace(/(from\s+['"])(\.[^'"]+)(['"])/g,'$1$2.ts$3'))}}}
copy('src')
const root=pathToFileURL(output+'/').href
const {batchPark}=await import(root+'src/game/park/batch.ts')
const {lightPark,followSun,parkLook}=await import(root+'src/game/park/atmosphere.ts')
const {Rider}=await import(root+'src/game/rider/Rider.ts')
const {DEFAULT_KIT}=await import(root+'src/storage/persist.ts')
const builders=[['TheYard','buildTheYard','the-yard'],['ForestLine','buildForestLine','forest-line'],['Apex','buildApex','apex'],['BigAir','buildBigAir','big-air'],['Channel','buildChannel','channel'],['Rider',null,'the-yard'],['RiderMute',null,'the-yard'],['RiderTail',null,'the-yard'],['RiderJapan',null,'the-yard']]
const outDir=process.argv[2]??'/tmp/deck7-scenes';fs.mkdirSync(outDir,{recursive:true})
for(const [name,builder,id] of builders){
 const park=builder?batchPark((await import(root+`src/game/park/${name}.ts`))[builder]()):null
 const scene=new THREE.Scene();if(park)scene.add(park.group)
 else {const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:'#8e9a8a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor)}
 const rider=new Rider();rider.applyKit({...DEFAULT_KIT,shirt:'rust',hat:'beanie'});rider.group.position.set(0,0.12,builder?20:0);rider.setPose({crouch:builder?0.12:0.7,lean:0,armsOut:name==='Rider'?0:builder?0:1,boardSpin:0,boardRoll:0,airborne:!builder&&name!=='Rider',grab:name==='RiderTail'?'tail':name==='RiderJapan'?'japan':'mute'});scene.add(rider.group)
 const sun=lightPark(scene,id);followSun(sun,rider.group.position);scene.updateMatrixWorld(true);sun.shadow.updateMatrices(sun)
 const camera=new THREE.PerspectiveCamera(55,16/9,0.1,500)
 if(builder){camera.position.set(0,3.37,12.8);camera.lookAt(0,1.17,25.2)}else{camera.position.set(2.5,1.9,3.5);camera.lookAt(0,0.97,0)}
 camera.updateMatrixWorld(true)
 let sky=null
 const textures=[],materials=[],meshes=[],materialIndex=new Map(),textureIndex=new Map()
 const materialId=m=>{
  if(materialIndex.has(m))return materialIndex.get(m)
  let map=-1
  if(m.map?.image?.toDataURL){if(!textureIndex.has(m.map)){textureIndex.set(m.map,textures.length);textures.push(m.map.image.toDataURL('image/png').split(',')[1])}map=textureIndex.get(m.map)}
  const index=materials.length;materials.push({color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,map,doubleSide:m.side===THREE.DoubleSide});materialIndex.set(m,index);return index
 }
 scene.traverseVisible(object=>{
  if(object.isMesh&&object.material.isShaderMaterial){
   const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry
   sky={vertex:object.material.vertexShader,fragment:object.material.fragmentShader,positions:Array.from(geometry.getAttribute('position').array),projection:camera.projectionMatrix.toArray(),modelView:new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,object.matrixWorld).toArray(),top:object.material.uniforms.top.value.toArray(),horizon:object.material.uniforms.horizon.value.toArray()}
   return
  }
  if(!object.isMesh||!object.material.isMeshStandardMaterial)return
  const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv')
  const instances=object.isInstancedMesh?object.count:1,vertices=[]
  for(let instance=0;instance<instances;instance++){
   const matrix=object.matrixWorld.clone()
   if(object.isInstancedMesh){const local=new THREE.Matrix4();object.getMatrixAt(instance,local);matrix.multiply(local)}
   const normals=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3(),normal=new THREE.Vector3()
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normals).normalize()
    vertices.push(v.x,v.y,v.z,normal.x,normal.y,normal.z,uv?.getX(i)??0,uv?.getY(i)??0)
   }
  }
  meshes.push({material:materialId(object.material),cast:object.castShadow,vertices})
 })
 const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
 const lightVP=new THREE.Matrix4().multiplyMatrices(sun.shadow.camera.projectionMatrix,sun.shadow.camera.matrixWorldInverse)
 const look=parkLook(id)
 const data={name,look,sky,camera:camera.position.toArray(),vp:vp.toArray(),lightVP:lightVP.toArray(),shadowMatrix:sun.shadow.matrix.toArray(),sun:sun.position.clone().sub(sun.target.position).normalize().toArray(),textures,materials,meshes}
 fs.writeFileSync(path.join(outDir,name+'.json'),JSON.stringify(data));console.log(`${name}: exported actual game geometry and canvas maps`)
}
fs.rmSync(output,{recursive:true,force:true})
