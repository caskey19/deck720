import * as THREE from 'three'

/** One continuous, deforming garment surface, with no exposed segment caps. */
export class ClothLimb extends THREE.Mesh<THREE.BufferGeometry,THREE.Material[]> {
  private curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],false,'centripetal')
  private point=new THREE.Vector3()
  private tangent=new THREE.Vector3()
  private normal=new THREE.Vector3()
  private binormal=new THREE.Vector3()
  private axis=new THREE.Vector3()
  private readonly rings=28
  private readonly sides=24
  private radii: [number,number,number]
  private sleeveEnd: number
  constructor(materials: THREE.Material[],radii: [number,number,number],sleeveEnd=1) {
    const geometry=new THREE.BufferGeometry(),rings=28,sides=24
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((rings+1)*(sides+1)*3),3))
    geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((rings+1)*(sides+1)*3),3))
    const uv=new Float32Array((rings+1)*(sides+1)*2),indices:number[]=[]
    for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
      const n=i*(sides+1)+j;uv[n*2]=j/sides;uv[n*2+1]=i/rings
      if(i<rings&&j<sides){const a=n,b=n+sides+1;indices.push(a,a+1,b,b,a+1,b+1)}
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices)
    // Short sleeve uses clothing above the hem and skin below it.
    const split=Math.floor(rings*sleeveEnd)*sides*6
    geometry.addGroup(0,split,0);geometry.addGroup(split,indices.length-split,1)
    super(geometry,materials)
    this.radii=radii;this.sleeveEnd=sleeveEnd
    this.castShadow=this.receiveShadow=true
    this.frustumCulled=false
  }
  update(start: THREE.Vector3,joint: THREE.Vector3,end: THREE.Vector3): void {
    this.curve.points[0].copy(start);this.curve.points[1].copy(joint);this.curve.points[2].copy(end)
    const p=this.geometry.getAttribute('position') as THREE.BufferAttribute,n=this.geometry.getAttribute('normal') as THREE.BufferAttribute
    for(let i=0;i<=this.rings;i++){
      const t=i/this.rings
      this.curve.getPoint(t,this.point);this.curve.getTangent(t,this.tangent).normalize()
      this.axis.set(Math.abs(this.tangent.x)>0.95?0:1,0,Math.abs(this.tangent.x)>0.95?1:0)
      this.normal.crossVectors(this.tangent,this.axis).normalize();this.binormal.crossVectors(this.tangent,this.normal).normalize()
      const a=t<0.5?0:1,f=t<0.5?t*2:(t-0.5)*2
      const smooth=f*f*(3-2*f)
      let radius=THREE.MathUtils.lerp(this.radii[a],this.radii[a+1],smooth)
      radius*=1+0.025*Math.sin(t*Math.PI*16)*Math.exp(-(((t-0.5)/0.2)**2))
      for(let j=0;j<=this.sides;j++){
        const angle=j/this.sides*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle)
        const x=this.normal.x*c+this.binormal.x*s,y=this.normal.y*c+this.binormal.y*s,z=this.normal.z*c+this.binormal.z*s,index=i*(this.sides+1)+j
        p.setXYZ(index,this.point.x+x*radius,this.point.y+y*radius,this.point.z+z*radius);n.setXYZ(index,x,y,z)
      }
    }
    p.needsUpdate=n.needsUpdate=true
  }
  setSleeve(clothed: boolean): void {
    const split=clothed?this.geometry.index!.count:Math.floor(this.rings*this.sleeveEnd)*this.sides*6
    this.geometry.clearGroups();this.geometry.addGroup(0,split,0);this.geometry.addGroup(split,this.geometry.index!.count-split,1)
  }
}
