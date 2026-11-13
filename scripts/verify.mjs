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
// Flat ground has no launch zones: assert a human-scale hop, not ramp airtime.
const flat={group:new THREE.Group(),spawn:new THREE.Vector3(0,0.12,0),spawnYaw:0,finishZ:999,groundY:0,rails:[],ramps:[],solids:[],pads:[],bounds:{minX:-100,maxX:100,minZ:-100,maxZ:1000}}
function hop(holdFrames,hz){
 const skater=new SkaterController(flat,new Scoring()),input=new Input(),dt=1/hz
 input.state.pop=true
 for(let i=0;i<holdFrames;i++)skater.update(dt,input,i*1000/hz)
 input.state.pop=false;input.state.popJustReleased=true;skater.update(dt,input,1000)
 input.state.airDown=true;input.state.airLeft=true
 let apex=0,maxPitch=0,maxYaw=0,frames=0
 while(skater.phase==='air'&&frames<hz*3){skater.update(dt,input,1000+frames*1000/hz);apex=Math.max(apex,skater.position.y-0.12);maxPitch=Math.max(maxPitch,Math.abs(skater.pitch));maxYaw=Math.max(maxYaw,Math.abs(skater.yaw));frames++}
 assert(maxPitch<=0.21,'flat ollie must not turn into a body backflip')
 assert(maxYaw<Math.PI*1.08,'flat-ground air should not allow repeated body spins')
 assert(Math.abs(skater.position.z)<1,'stationary pop must not propel the rider forward')
 return {apex,airtime:frames/hz}
}
const tap=hop(1,60),full=hop(40,60)
assert(tap.apex>0.2&&tap.apex<0.35,`tap ollie height ${tap.apex}`)
assert(full.apex>0.5&&full.apex<0.7,`charged ollie height ${full.apex}`)
for(const hz of [30,120])assert(Math.abs(hop(hz,hz).apex-full.apex)<0.05,'jump height should stay similar across frame rates')
const formInput=new Input();formInput.onKeyDown({code:'ArrowRight',repeat:false,target:{closest:()=>({})},preventDefault:()=>assert.fail('camera slider keys must keep browser defaults')});assert(!formInput.state.airRight,'camera sliders must not steer the rider')
const keyboard=new Input();keyboard.apply('KeyW',true);assert(keyboard.state.forward&&!keyboard.state.airUp,'pushing W must not also frontflip')
const {followYaw,DEFAULT_CAMERA}=await import('../.verify/src/game/camera/settings.ts')
assert.equal(DEFAULT_CAMERA.height,1.3);assert.equal(DEFAULT_CAMERA.distance,4.3);assert.equal(DEFAULT_CAMERA.fov,58)
let yaw=0
for(let i=0;i<60;i++)yaw=followYaw(yaw,Math.PI,1/60,false)
assert(yaw<=0.951,'camera yaw must be limited to a calm turn rate')
assert(Math.abs(followYaw(Math.PI-0.01,-Math.PI+0.01,1/60,false)-(Math.PI-0.01))<0.01,'camera wraps without a 360-degree snap')
console.log(`Ground ollies: tap ${tap.apex.toFixed(2)}m, charged ${full.apex.toFixed(2)}m, airtime ${full.airtime.toFixed(2)}s; flat body flips blocked`)
console.log('Camera: 1.3m / 4.3m / 58deg defaults, bounded yaw and seam wrapping passed')
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
for(const grab of ['mute','tail','japan']){
 rider.setPose({crouch:0,boardSpin:0,boardRoll:0,lean:0,armsOut:1,airborne:true,grab})
 rider.group.updateMatrixWorld(true)
 const index=grab==='mute'?0:1
 const hand=rider.group.getObjectByName(`rig hand ${index}`).getWorldPosition(new THREE.Vector3())
 const local=grab==='tail'?new THREE.Vector3(0.08,-0.015,-0.45):grab==='japan'?new THREE.Vector3(-0.145,0.015,0.26):new THREE.Vector3(-0.145,0.015,0.13)
 const target=local.applyMatrix4(rider.board.matrixWorld)
 assert(hand.distanceTo(target)<0.025,`${grab} should reach its board grip, gap=${hand.distanceTo(target)}`)
 for(let i=0;i<2;i++){
  const upper=rider.group.getObjectByName(`rig upper arm ${i}`),forearm=rider.group.getObjectByName(`rig forearm ${i}`)
  const elbowA=new THREE.Vector3(0,0.5,0).applyMatrix4(upper.matrixWorld)
  const elbowB=new THREE.Vector3(0,-0.5,0).applyMatrix4(forearm.matrixWorld)
  assert(elbowA.distanceTo(elbowB)<1e-5,'elbow must stay connected')
  assert(Math.abs(upper.scale.y-0.38)<1e-5&&Math.abs(forearm.scale.y-0.38)<1e-5,'arm segments must retain their length')
 }
}
console.log('Grabs: mute, tail and Japan reach board anchors with connected fixed-length elbows')
const flowPark=(await import('../.verify/src/game/park/TheYard.ts')).buildTheYard()
const flowSkater=new SkaterController(flowPark,new Scoring()),flowInput=new Input()
flowSkater.position.set(-7.5,0.12,64);flowInput.state.forward=true
let flowAir=false,flowGrind=false,landingBend=false
for(let i=0;i<360;i++){
 flowSkater.update(1/60,flowInput,i*1000/60)
 flowAir ||=flowSkater.phase==='air';flowGrind ||=flowSkater.phase==='grind'
 landingBend ||=flowSkater.phase==='ground'&&flowSkater.rider.replayPose.crouch>0.1
}
assert(flowAir,'left flow route should launch')
assert(flowGrind,'left flow route should feed the flatbar')
assert(landingBend,'landing should compress the visual knee pose')
console.log('Yard alternate flow: transfer launch, flatbar catch and visual landing compression passed')
const grabSkater=new SkaterController(flowPark,new Scoring()),grabInput=new Input()
grabSkater.phase='air';grabSkater.position.set(0,20,2);grabSkater.velocity.set(0,0,6);grabInput.state.grabTail=true
grabSkater.update(1/60,grabInput,0)
assert(grabSkater.rider.replayPose.armsOut>0&&grabSkater.rider.replayPose.armsOut<1,'grab starts with an eased reach')
for(let i=1;i<12;i++)grabSkater.update(1/60,grabInput,i*1000/60)
assert(grabSkater.replayFrames.some(f=>f.pose?.grab==='tail'),'live grab identity must reach recorded frames')
const heldWeight=grabSkater.rider.replayPose.armsOut
grabInput.state.grabTail=false;grabSkater.update(1/60,grabInput,200)
assert(grabSkater.rider.replayPose.armsOut<heldWeight&&grabSkater.rider.replayPose.armsOut>0,'release eases the hand back')
grabSkater.reset()
assert.equal(grabSkater.rider.replayPose.armsOut,0,'restart clears visual grab')
console.log('Live grab input: eased reach/release, named recording and clean restart passed')
const {lightPark,followSun}=await import('../.verify/src/game/park/atmosphere.ts')
const lightScene=new THREE.Scene(),sun=lightPark(lightScene,'the-yard')
const sunDirection=sun.position.clone().sub(sun.target.position).normalize()
for(const z of [2,70,170]){
 const focus=new THREE.Vector3(3,0,z);followSun(sun,focus);lightScene.updateMatrixWorld(true);sun.shadow.updateMatrices(sun)
 const projected=focus.clone().project(sun.shadow.camera)
 assert(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&Math.abs(projected.z)<1,'rider should remain inside moving sun shadow volume')
 assert(sun.position.clone().sub(sun.target.position).normalize().distanceTo(sunDirection)<1e-6,'moving sun must retain its direction')
}
console.log('Lighting: local shadow volume follows full Yard length with fixed sun direction')
const replayPark=(await import('../.verify/src/game/park/TheYard.ts')).buildTheYard()
const replaySkater=new SkaterController(replayPark,new Scoring())
replaySkater.applyReplayFrame({t:1,x:0,y:0.12,z:2,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground',pose:{crouch:0.8,lean:0.1,armsOut:1,push:0}})
assert.equal(replaySkater.rider.replayPose.crouch,0.8,'new replay retains crouch')
replaySkater.applyReplayFrame({t:1,x:0,y:0.12,z:2,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground'})
assert.equal(replaySkater.rider.replayPose.crouch,0,'legacy replay stays readable')
replaySkater.applyReplayFrame({t:100,x:0,y:1,z:10,yaw:2,pitch:0,roll:0,boardSpin:0,state:'air',velocity:{x:2,y:-1,z:12}})
assert.equal(replaySkater.velocity.z,12,'new replay camera uses recorded travel velocity')
const legacySkater=new SkaterController(replayPark,new Scoring())
legacySkater.applyReplayFrame({t:100,x:0,y:1,z:10,yaw:2,pitch:0,roll:0,boardSpin:0,state:'air'})
legacySkater.applyReplayFrame({t:200,x:0.2,y:0.9,z:11.2,yaw:2.5,pitch:0,roll:0,boardSpin:0,state:'air'})
assert(Math.abs(legacySkater.velocity.z-12)<1e-6,'legacy replay derives travel from frame positions')
replaySkater.applyReplayFrame({t:300,x:0,y:1,z:12,yaw:0,pitch:0,roll:0,boardSpin:0,state:'air',pose:{crouch:0,lean:0,armsOut:1,push:0,grab:'tail'}})
assert.equal(replaySkater.rider.replayPose.grab,'tail','replay keeps the actual named grab')
console.log('Replay camera: recorded velocity and legacy position-derived travel pass')
console.log('Rig: ankles track shoes, board flips independently, new and legacy replay poses pass')
const storage=new Map([['deck7.best',JSON.stringify({'the-yard':9999,'apex':200})],['deck7.ghost',JSON.stringify({'the-yard':[{t:0}]})]])
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
assert.equal(persist.loadBestScore('the-yard'),0,'old Yard PB isolated')
assert.equal(persist.loadBestScore('apex'),0,'new physics has separate active PBs')
assert.equal(JSON.parse(storage.get('deck7.best')).apex,200,'legacy park record remains stored')
assert.deepEqual(persist.loadGhostFrames('the-yard'),[],'old Yard ghost isolated')
persist.saveBestScore('the-yard',300)
assert.equal(persist.loadBestScore('the-yard'),300)
const frames=[{t:1,x:0,y:0,z:170,yaw:0,pitch:0,roll:0,boardSpin:0,state:'ground'}]
persist.saveGhostFrames('the-yard',frames,300)
assert.deepEqual(persist.loadGhostFrames('the-yard'),frames)
persist.clearParkRecord('the-yard')
assert.equal(persist.loadBestScore('the-yard'),0)
assert.equal(JSON.parse(storage.get('deck7.best'))['the-yard'],9999,'legacy PB must remain stored')
// The visible clothing stays one surface through neutral, knee bend and grab poses.
const {ClothLimb}=await import('../.verify/src/game/rider/ClothLimb.ts')
for(const crouch of [0,0.34,1])for(const grab of ['mute','tail','japan']){
 rider.setPose({crouch,boardSpin:0,boardRoll:0,lean:0.2,armsOut:crouch===1?1:0,airborne:true,grab})
 let garments=0
 rider.group.traverse(o=>{if(!(o instanceof ClothLimb))return;garments++
  const pos=o.geometry.getAttribute('position'),norm=o.geometry.getAttribute('normal')
  for(const value of pos.array)assert(Number.isFinite(value),'garment must remain finite during IK')
  for(let i=0;i<norm.count;i++)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(norm,i).length()-1)<1e-5,'garment normals must remain unit length')
  for(let i=0;i<=28;i++)assert(new THREE.Vector3().fromBufferAttribute(pos,i*25).distanceTo(new THREE.Vector3().fromBufferAttribute(pos,i*25+24))<1e-5,'cloth seam must stay closed')
 });assert.equal(garments,4,'four continuous garments replace the exposed limb segments')
}
rider.setLobbyPose(0);rider.group.updateMatrixWorld(true)
const boardHeld=rider.board.position.clone();assert(boardHeld.x<-.4&&Math.abs(rider.board.rotation.x)>1.5,'lobby board held vertically')
rider.setPose({crouch:0,boardSpin:0,boardRoll:0,lean:0,armsOut:0,airborne:false})
assert.equal(rider.board.position.x,0);assert.equal(rider.board.rotation.x,0,'standing lobby pose must not leak into riding')
const {LobbyStage}=await import('../.verify/src/game/lobby/LobbyStage.ts')
const lobby=new LobbyStage(DEFAULT_KIT)
let rendered=false
lobby.render({domElement:{clientWidth:1600,clientHeight:900},render(){rendered=true}},0)
assert(rendered&&lobby.camera.aspect===1600/900,'lobby reuses the game renderer')
assert(lobby.camera.far>500,'full scenic sky must remain inside lobby far plane')
lobby.dispose()
console.log('Rider: continuous cloth, finite knee/grab poses, closed seams, lobby pose reset and all cosmetics passed')
console.log('Persistence: new Yard course records isolated; legacy and other park records retained')
fs.rmSync(output,{recursive:true,force:true})
