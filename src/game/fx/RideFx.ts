import * as THREE from 'three'

type Burst = {
  points: THREE.Points
  life: number
  maxLife: number
  velocities: Float32Array
}

/** Lightweight burst FX for pop / land / grind — no textures. */
export class RideFx {
  private group = new THREE.Group()
  private bursts: Burst[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.group)
  }

  dispose(): void {
    for (const b of this.bursts) this.disposeBurst(b)
    this.bursts = []
    this.scene.remove(this.group)
  }

  private disposeBurst(b: Burst): void {
    this.group.remove(b.points)
    b.points.geometry.dispose()
    ;(b.points.material as THREE.PointsMaterial).dispose()
  }

  private spawn(
    origin: THREE.Vector3,
    count: number,
    color: number,
    speed: number,
    life: number,
    upward = 0.4,
  ): void {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x
      positions[i * 3 + 1] = origin.y
      positions[i * 3 + 2] = origin.z
      const ang = Math.random() * Math.PI * 2
      const sp = speed * (0.4 + Math.random() * 0.8)
      velocities[i * 3] = Math.cos(ang) * sp
      velocities[i * 3 + 1] = upward * sp + Math.random() * sp * 0.5
      velocities[i * 3 + 2] = Math.sin(ang) * sp
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geo, mat)
    this.group.add(points)
    this.bursts.push({ points, life, maxLife: life, velocities })
  }

  pop(at: THREE.Vector3): void {
    this.spawn(at, 10, 0xe8a838, 3.2, 0.35, 0.9)
  }

  land(at: THREE.Vector3, clean: boolean): void {
    this.spawn(at, clean ? 14 : 8, clean ? 0xd8d0c4 : 0x8a8074, clean ? 2.8 : 1.8, 0.4, 0.35)
  }

  grind(at: THREE.Vector3): void {
    // Bright short sparks — readable streak without spam
    this.spawn(at, 5, 0xffe08a, 2.35, 0.16, 0.05)
    this.spawn(at, 2, 0xffffff, 1.4, 0.12, 0.02)
  }

  /** Soft asphalt dust while rolling fast on ground. */
  dust(at: THREE.Vector3, behind: THREE.Vector3): void {
    const origin = at.clone().addScaledVector(behind, 0.35)
    origin.y = Math.max(0.05, origin.y - 0.05)
    this.spawn(origin, 3, 0x9a9186, 1.1, 0.28, 0.12)
  }

  /** Harder skid puff when braking at speed. */
  brake(at: THREE.Vector3, behind: THREE.Vector3): void {
    const origin = at.clone().addScaledVector(behind, 0.2)
    origin.y = Math.max(0.04, origin.y - 0.04)
    this.spawn(origin, 5, 0xb0a89c, 1.6, 0.32, 0.18)
    this.spawn(origin, 2, 0x6a655e, 0.9, 0.4, 0.05)
  }

  bail(at: THREE.Vector3): void {
    this.spawn(at, 16, 0xff5c5c, 3.5, 0.45, 0.6)
  }

  /** Finish-line confetti burst. */
  finish(at: THREE.Vector3): void {
    this.spawn(at, 18, 0xe8a838, 4.2, 0.7, 1.1)
    this.spawn(at, 12, 0x5ad6d0, 3.4, 0.55, 0.9)
    this.spawn(at, 10, 0xffffff, 2.8, 0.45, 0.7)
  }

  update(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]
      b.life -= dt
      const pos = b.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      const n = arr.length / 3
      for (let p = 0; p < n; p++) {
        arr[p * 3] += b.velocities[p * 3] * dt
        arr[p * 3 + 1] += b.velocities[p * 3 + 1] * dt
        arr[p * 3 + 2] += b.velocities[p * 3 + 2] * dt
        b.velocities[p * 3 + 1] -= 9 * dt
      }
      pos.needsUpdate = true
      const mat = b.points.material as THREE.PointsMaterial
      mat.opacity = Math.max(0, b.life / b.maxLife)
      if (b.life <= 0) {
        this.disposeBurst(b)
        this.bursts.splice(i, 1)
      }
    }
  }
}
