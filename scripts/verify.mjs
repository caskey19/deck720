import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

// CPU geometry/controller checks, explicitly not a substitute for GPU playtesting.
const output = path.resolve('.verify')
fs.mkdirSync(output, {recursive:true})
function compile(dir) {
  for (const f of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,f.name)
    if(f.isDirectory())compile(file)
    else if(file.endsWith('.ts')) {
      let js=fs.readFileSync(file,'utf8')
      js=js.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,'$1$2.ts$3')
      const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,js)
    }
  }
}
compile('src')
const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){}}
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})}
globalThis.window={addEventListener(){},removeEventListener(){}}
const {batchPark}=await import('../.verify/src/game/park/batch.ts')
const {SkaterController}=await import('../.verify/src/game/physics/SkaterController.ts')
const {Scoring}=await import('../.verify/src/game/scoring/Scoring.ts')
const {Input}=await import('../.verify/src/game/Input.ts')
const THREE=await import('three')
const {Rider}=await import('../.verify/src/game/rider/Rider.ts')
const persist=await import('../.verify/src/storage/persist.ts')
const {DEFAULT_KIT}=persist
const parks=[['TheYard','buildTheYard'],['ForestLine','buildForestLine'],['Apex','buildApex'],['BigAir','buildBigAir'],['Channel','buildChannel']]
for(const [file,builder] of parks){
 const park=batchPark((await import(`../.verify/src/game/park/${file}.ts`))[builder]())
 assert(park.group.children.length < 100,`${file}: static batching budget`)
 park.group.traverse(o=>{if(o.isMesh&&o.geometry.attributes.uv)for(const v of o.geometry.attributes.uv.array)assert(Number.isFinite(v),`${file}: invalid UV`)})
 let meshes=0,triangles=0
 park.group.traverse(o=>{if(o.isMesh){meshes++;const p=o.geometry.attributes.position;for(const v of p.array)assert(Number.isFinite(v),`${file}: nonfinite geometry`);triangles+=(o.geometry.index?o.geometry.index.count:p.count)/3*(o.isInstancedMesh?o.count:1)}})
 park.group.updateMatrixWorld(true)
 const ray=new THREE.Raycaster()
 for(const p of park.pads??[]) {
  assert(p.min.x<p.max.x&&p.min.z<p.max.z,`${file}: pad bounds`)
  for(const u of [0.05,0.5,0.95])for(const v of [0.05,0.5,0.95]) {
   const x=p.min.x+(p.max.x-p.min.x)*u,z=p.min.z+(p.max.z-p.min.z)*v
   ray.set(new THREE.Vector3(x,25,z),new THREE.Vector3(0,-1,0))
   const hits=ray.intersectObject(park.group,true)
   assert(hits.some(h=>Math.abs(h.point.y-p.max.y)<0.012),`${file}: missing visible pad top y=${p.max.y} at x=${x.toFixed(2)},z=${z.toFixed(2)}`)
  }
 }
 for(const r of park.rails) assert(r.start.distanceTo(r.end)>0,`${file}: rail length`)
 const skater=new SkaterController(park,new Scoring()),input=new Input()
 const start=skater.position.clone()
 for(let i=0;i<180;i++)skater.update(1/60,input,i*1000/60)
 assert(Math.abs(skater.position.x-start.x)<1e-6&&Math.abs(skater.position.z-start.z)<1e-6,`${file}: idle movement`)
 input.state.forward=true
 let air=false
 for(let i=0;i<2400&&!skater.finished;i++){skater.update(1/60,input,i*1000/60);air ||= skater.phase==='air';assert(Number.isFinite(skater.position.length()),`${file}: unstable position`)}
 assert(skater.position.z>start.z+10,`${file}: blocked spawn`)
 assert(skater.finished,`${file}: center line must reach finish`)
 if(file==='TheYard')assert(air,'Yard: hub should launch')
 console.log(`${file}: ${meshes} meshes, ${Math.round(triangles)} triangles, idle stable, push reaches z=${skater.position.z.toFixed(1)}, finished=${skater.finished}`)
}
const rider=new Rider()
assert(DEFAULT_KIT,'default kit export')
rider.applyKit(DEFAULT_KIT)
for(const crouch of [0,0.5,1])rider.setPose({crouch,boardSpin:1,boardRoll:0.3,lean:0.2,armsOut:1})
const {DECKS,SHIRTS,PANTS,SHOES,HATS}=await import('../.verify/src/game/cosmetics.ts')
for(const [key,options] of Object.entries({deck:DECKS,shirt:SHIRTS,pants:PANTS,shoes:SHOES,hat:HATS})) {
 for(const option of options)rider.applyKit({...DEFAULT_KIT,[key]:option.id})
}
rider.group.updateMatrixWorld(true)
rider.group.traverse(o=>{for(const value of o.matrixWorld.elements)assert(Number.isFinite(value),'nonfinite rider transform')})
rider.setPose({crouch:0,boardSpin:0,boardRoll:0,lean:0,armsOut:0})
rider.group.position.y=0.12
rider.group.updateMatrixWorld(true)
const boardBounds=new THREE.Box3().setFromObject(rider.board)
assert(Math.abs(boardBounds.min.y)<0.003,`wheel contact should be within 3mm of ground, got ${boardBounds.min.y}`)
for(const crouch of [0,0.5,1])for(const push of [0,0.5,1]) {
 rider.setPose({crouch,push,boardSpin:0,boardRoll:0,lean:0.3,armsOut:0})
 rider.group.updateMatrixWorld(true)
 for(let i=0;i<2;i++){
  const shin=rider.group.getObjectByName(`rig shin ${i}`)
  const endpoint=new THREE.Vector3(0,0.5,0).applyMatrix4(shin.matrixWorld)
  const foot=rider.feet.children[i]
  const target=foot.position.clone();target.y+=0.07;target.applyMatrix4(rider.feet.matrixWorld)
  assert(endpoint.distanceTo(target)<1e-5,'ankle rig must remain connected to shoe')
 }
}
rider.setPose({crouch:0,boardSpin:0,boardRoll:0,lean:0,armsOut:0,airborne:true})
rider.group.updateMatrixWorld(true)
const footBefore=rider.feet.children[0].getWorldPosition(new THREE.Vector3())
rider.setPose({crouch:0,boardSpin:Math.PI,boardRoll:0,lean:0,armsOut:0,airborne:true})
rider.group.updateMatrixWorld(true)
assert(footBefore.distanceTo(rider.feet.children[0].getWorldPosition(new THREE.Vector3()))<1e-6,'kickflip should not spin feet with deck')
const replayPark=(await import('../.verify/src/game/park/TheYard.ts')).buildTheYard()
const replaySkater=new SkaterController(replayPark,new Scoring())
replaySkater.applyReplayFrame({t:1,x:0,y:0.12,z:2,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground',pose:{crouch:0.8,lean:0.1,armsOut:1,push:0}})
assert.equal(replaySkater.rider.replayPose.crouch,0.8,'new replay retains crouch')
replaySkater.applyReplayFrame({t:1,x:0,y:0.12,z:2,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground'})
assert.equal(replaySkater.rider.replayPose.crouch,0,'legacy replay stays readable')
console.log('Rig: ankles track shoes, board flips independently, new and legacy replay poses pass')
const storage=new Map([['deck7.best',JSON.stringify({'the-yard':9999,'apex':200})],['deck7.ghost',JSON.stringify({'the-yard':[{t:0}]})]])
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
assert.equal(persist.loadBestScore('the-yard'),0,'old Yard PB isolated')
assert.equal(persist.loadBestScore('apex'),200,'other park PB preserved')
assert.deepEqual(persist.loadGhostFrames('the-yard'),[],'old Yard ghost isolated')
persist.saveBestScore('the-yard',300)
assert.equal(persist.loadBestScore('the-yard'),300)
const frames=[{t:1,x:0,y:0,z:170,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground'}]
persist.saveGhostFrames('the-yard',frames,300)
assert.deepEqual(persist.loadGhostFrames('the-yard'),frames)
persist.clearParkRecord('the-yard')
assert.equal(persist.loadBestScore('the-yard'),0)
assert.equal(JSON.parse(storage.get('deck7.best'))['the-yard'],9999,'legacy PB must remain stored')
console.log('Rider: every cosmetic option and finite crouch/grab poses passed')
console.log('Persistence: new Yard course records isolated; legacy and other park records retained')
fs.rmSync(output,{recursive:true,force:true})
