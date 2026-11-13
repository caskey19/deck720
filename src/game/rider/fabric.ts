import * as THREE from 'three'
/** Original subtle woven cloth, generated once per rider for clean lifetime ownership. */
export function fabric(denim = false): THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128
  const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(128,128)
  let seed=denim?841:482
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    seed=(seed*1664525+1013904223)>>>0
    const weave=((x+(denim?y:0))%4<2?3:-3)+(y%3===0?1:0)
    const v=220+weave+(seed/4294967296-0.5)*8,i=(y*128+x)*4
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255
  }
  ctx.putImageData(pixels,0,0)
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(5,5);map.colorSpace=THREE.SRGBColorSpace
  return map
}
