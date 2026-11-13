import * as THREE from 'three'
import { surface } from './materials'
import { addBenches, addLamps } from './decor'

/** Original industrial courtyard set dressing, entirely outside the ride bounds. */
export function yardScenery(group: THREE.Group): void {
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m)
    return m
  }
  box(0, -0.55, 83, 160, 0.6, 290, surface('concrete', '#9a9482'))
  const windowMat = surface('steel', '#536c77')
  // Repeating warehouse bays, pilasters, glazing and sawtooth roofs.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x = side * 26, z = 6 + i * 31, h = 8 + (i % 3) * 1.5
    box(x, h / 2, z, 16, h, 27, surface('brick', i % 2 ? '#9d745d' : '#b09475'))
    box(x, h + 0.15, z, 17, 0.3, 28, surface('steel', '#454f50'))
    for (const dz of [-10, 0, 10]) {
      box(side * 17.8, h / 2, z + dz, 0.3, h, 0.45, surface('concrete', '#c6baa2'))
      box(side * 17.7, h * 0.65, z + dz + 2.2, 0.12, 2.1, 3.5, windowMat)
      box(side * 17.58, h * 0.65, z + dz + 2.2, 0.15, 0.07, 3.6, surface('steel'))
    }
    if (i % 2 === 0) {
      box(x, h + 1, z, 3, 1.8, 4, surface('steel', '#78817d'))
      box(side * 17.6, 1.5, z - 4, 0.1, 3, 4, surface('steel', '#52615e'))
    }
  }
  // Slender native trees in pavement wells.
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 3.8, 7), surface('wood', '#6a5542'), 24)
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 1), surface('rubber', '#6c8250'), 48)
  const matrix = new THREE.Matrix4()
  let n = 0
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
    const x = side * 15.5, z = -6 + i * 17
    trunks.setMatrixAt(n, matrix.makeTranslation(x, 1.9, z))
    crowns.setMatrixAt(n * 2, matrix.compose(new THREE.Vector3(x, 4.4, z), new THREE.Quaternion(), new THREE.Vector3(0.9, 1.4, 0.9)))
    crowns.setMatrixAt(n * 2 + 1, matrix.makeTranslation(x + 0.7, 4, z + 0.4))
    box(x, 0.02, z, 2.7, 0.15, 2.7, surface('rubber', '#45483d'))
    n++
  }
  trunks.castShadow = crowns.castShadow = true
  group.add(trunks, crowns)
  addBenches(group, [[-15, 20], [15, 53], [-15, 88], [15, 123], [-15, 154]])
  addLamps(group, [[-14.8, 8], [14.8, 38], [-14.8, 70], [14.8, 102], [-14.8, 134], [14.8, 165]])
  // Painted warehouse identity, created locally rather than an imported logo.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#263b3c'; ctx.fillRect(0, 0, 1024, 256)
  ctx.fillStyle = '#eee5d2'; ctx.font = 'bold 124px sans-serif'; ctx.fillText('DECK7 / YARD', 36, 152)
  ctx.font = '28px sans-serif'; ctx.fillStyle = '#dda765'; ctx.fillText('OPEN COURTYARD     /     RIDE YOUR OWN LINE', 40, 211)
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshStandardMaterial({ map, roughness: 0.8, side: THREE.DoubleSide }))
  sign.position.set(-17.4, 5.5, 24); sign.rotation.y = Math.PI / 2; group.add(sign)
  // Original session bunting breaks the long roofline and frames takeoffs.
  const wireMaterial=surface('steel','#434e4d')
  const flagMaterials=['#d9a15b','#648b81','#d7cbb0'].map(color=>new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:0.9}))
  for(const z of [38,102,158]){
    const cablePoints=[]
    for(let i=0;i<=16;i++){
      const x=-17+i*34/16,y=8.5-0.9*Math.sin(i/16*Math.PI)
      cablePoints.push(new THREE.Vector3(x,y,z))
    }
    const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),24,0.018,4,false),wireMaterial)
    group.add(cable)
    for(let i=0;i<14;i++){
      const x=-15+i*2.3,y=8.5-0.9*Math.sin((x+17)/34*Math.PI)
      const geometry=new THREE.BufferGeometry()
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([x-0.35,y,z,x+0.35,y,z,x+0.1,y-0.65,z],3))
      geometry.computeVertexNormals()
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,0.5,0],2))
      const flag=new THREE.Mesh(geometry,flagMaterials[i%3])
      group.add(flag)
    }
  }
  // Distant water tower anchors the end of the line.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5, 16), surface('steel', '#96a09a'))
  tank.position.set(24, 18, 190); tank.castShadow = true; group.add(tank)
  for (const dx of [-2, 2]) for (const dz of [-2, 2]) box(24 + dx, 7.5, 190 + dz, 0.28, 15, 0.28, surface('steel'))
}
