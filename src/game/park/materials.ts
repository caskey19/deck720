import * as THREE from 'three'

type Surface = 'asphalt' | 'concrete' | 'wood' | 'steel' | 'paint' | 'rubber' | 'brick'
const textures = new Map<Surface, THREE.CanvasTexture>()
const materials = new Map<string, THREE.MeshStandardMaterial>()

/** Small seeded, original tile maps. No downloads and repeatable across sessions. */
function texture(kind: Surface): THREE.CanvasTexture {
  const cached = textures.get(kind)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  let seed = 721
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const data = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4
    let v = 200 + (random() - 0.5) * (kind === 'asphalt' ? 100 : 32)
    if (kind === 'wood') v -= Math.sin(x * 0.42 + Math.sin(y * 0.025) * 2) * 24
    if (kind === 'concrete' && (x < 2 || y < 2)) v -= 38
    if (kind === 'brick' && (y % 32 < 3 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 3)) v -= 75
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(1, 1)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  textures.set(kind, map)
  return map
}

export function surface(kind: Surface, color?: string): THREE.MeshStandardMaterial {
  const defaults = { asphalt: '#53575a', concrete: '#b8b5aa', steel: '#8d9ba0', wood: '#a47c51', paint: '#d68c50', rubber: '#24282b', brick: '#956b53' }
  const key = `${kind}:${color ?? defaults[kind]}`
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
    color: color ?? defaults[kind], map: texture(kind),
    bumpMap: kind === 'steel' || kind === 'paint' ? null : texture(kind),
    bumpScale: kind === 'asphalt' ? 0.045 : 0.018,
    roughness: kind === 'steel' ? 0.38 : kind === 'paint' ? 0.65 : 0.92,
    metalness: kind === 'steel' ? 0.72 : 0,
  }))
  materials.get(key)!.userData.sharedSurface = true
  return materials.get(key)!
}

export function skyDome(top = '#537f9c', horizon = '#e4c6a0'): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(360, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: 'varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float cloudNoise(vec2 p) {
        vec2 cell=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.)),f.x),f.y);
      }
      void main(){
        vec3 direction=normalize(vPos);
        float h=pow(clamp(direction.y,0.,1.),0.65);
        vec3 color=mix(horizon,top,h);
        vec2 p=vec2(atan(direction.z,direction.x)*3.5,direction.y*14.0);
        float cloud=cloudNoise(p)*0.57+cloudNoise(p*2.1)*0.28+cloudNoise(p*4.3)*0.15;
        cloud=smoothstep(0.61,0.8,cloud)*smoothstep(0.02,0.18,direction.y);
        color=mix(color,vec3(0.94,0.93,0.88),cloud*0.48);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }))
}
