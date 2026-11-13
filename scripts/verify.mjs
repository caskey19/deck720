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
const {SkaterController}=await import('../.verify/src/game/physics/SkaterController.ts')
const {Scoring}=await import('../.verify/src/game/scoring/Scoring.ts')
const {Input}=await import('../.verify/src/game/Input.ts')
const {Rider}=await import('../.verify/src/game/rider/Rider.ts')
const {DEFAULT_KIT}=await import('../.verify/src/storage/persist.ts')
const parks=[['TheYard','buildTheYard'],['ForestLine','buildForestLine'],['Apex','buildApex'],['BigAir','buildBigAir'],['Channel','buildChannel']]
for(const [file,builder] of parks){
 const park=(await import(`../.verify/src/game/park/${file}.ts`))[builder]()
 let meshes=0,triangles=0
 park.group.traverse(o=>{if(o.isMesh){meshes++;const p=o.geometry.attributes.position;for(const v of p.array)assert(Number.isFinite(v),`${file}: nonfinite geometry`);triangles+=(o.geometry.index?o.geometry.index.count:p.count)/3*(o.isInstancedMesh?o.count:1)}})
 for(const p of park.pads??[]) assert(p.min.x<p.max.x&&p.min.z<p.max.z,`${file}: pad bounds`)
 for(const r of park.rails) assert(r.start.distanceTo(r.end)>0,`${file}: rail length`)
 const skater=new SkaterController(park,new Scoring()),input=new Input()
 const start=skater.position.clone()
 for(let i=0;i<180;i++)skater.update(1/60,input,i/60)
 assert(Math.abs(skater.position.x-start.x)<1e-6&&Math.abs(skater.position.z-start.z)<1e-6,`${file}: idle movement`)
 input.state.forward=true
 let air=false
 for(let i=0;i<2400&&!skater.finished;i++){skater.update(1/60,input,i/60);air ||= skater.phase==='air';assert(Number.isFinite(skater.position.length()),`${file}: unstable position`)}
 assert(skater.position.z>start.z+10,`${file}: blocked spawn`)
 if(file==='TheYard'){assert(skater.finished,'Yard: center line must reach finish');assert(air,'Yard: hub should launch')}
 console.log(`${file}: ${meshes} meshes, ${Math.round(triangles)} triangles, idle stable, push reaches z=${skater.position.z.toFixed(1)}, finished=${skater.finished}`)
}
const rider=new Rider()
assert(DEFAULT_KIT,'default kit export')
rider.applyKit(DEFAULT_KIT)
for(const crouch of [0,0.5,1])rider.setPose({crouch,boardSpin:1,boardRoll:0.3,lean:0.2,armsOut:1})
console.log('Rider: cosmetics and pose smoke checks passed')
fs.rmSync(output,{recursive:true,force:true})
