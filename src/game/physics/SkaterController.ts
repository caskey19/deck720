import * as THREE from 'three'
import type { Input } from '../Input'
import type { ParkData, RailSeg } from '../park/TheYard'
import { Rider } from '../rider/Rider'
import { Scoring, type GrabKind } from '../scoring/Scoring'
import type { ReplayFrame } from '../../storage/persist'
import type { Sfx } from '../audio/Sfx'
import type { RideFx } from '../fx/RideFx'

export type RidePhase = 'ground' | 'air' | 'grind' | 'bail' | 'finished'

export class SkaterController {
  rider: Rider
  position = new THREE.Vector3()
  velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0
  roll = 0
  boardSpin = 0
  phase: RidePhase = 'ground'
  popCharge = 0
  private grindRail: RailSeg | null = null
  private grindT = 0
  private grindSide = 1
  /** Locked grind speed along the rail (m/s) */
  private grindSpeed = 0
  private bailTimer = 0
  private launchedRamp = false
  private landingCrouch = 0
  private grabBlend = 0
  private visualGrab: GrabKind = null
  private previousReplayFrame: ReplayFrame | null = null
  private frames: ReplayFrame[] = []
  private recordAcc = 0
  private grindFxAcc = 0
  private dustFxAcc = 0
  private brakeFxAcc = 0
  private whooshAcc = 0
  finished = false
  onFinish: (() => void) | null = null
  onGrindLock: (() => void) | null = null
  park: ParkData
  scoring: Scoring
  sfx: Sfx | null = null
  fx: RideFx | null = null

  private tmp = new THREE.Vector3()

  constructor(park: ParkData, scoring: Scoring) {
    this.park = park
    this.scoring = scoring
    this.rider = new Rider()
    this.reset()
  }

  reset(): void {
    this.position.copy(this.park.spawn)
    // Dead stop at spawn — push W to roll (no idle auto-roll)
    this.velocity.set(0, 0, 0)
    this.yaw = this.park.spawnYaw
    this.pitch = 0
    this.roll = 0
    this.boardSpin = 0
    this.phase = 'ground'
    this.popCharge = 0
    this.grindRail = null
    this.grindT = 0
    this.grindSpeed = 0
    this.bailTimer = 0
    this.launchedRamp = false
    this.finished = false
    this.landingCrouch = 0
    this.grabBlend = 0
    this.visualGrab = null
    this.previousReplayFrame = null
    this.frames = []
    this.recordAcc = 0
    this.scoring.reset()
    this.syncRider()
  }

  get replayFrames(): ReplayFrame[] {
    return this.frames
  }

  update(dt: number, input: Input, now: number): void {
    input.beginFrame()
    const phaseBefore = this.phase

    if (this.phase === 'bail') {
      this.bailTimer -= dt
      this.velocity.y -= 18 * dt
      this.position.addScaledVector(this.velocity, dt)
      if (this.position.y < this.park.groundY) {
        this.position.y = this.park.groundY
        this.velocity.set(0, 0, 0)
      }
      this.roll += dt * 4
      this.syncRider()
      this.record(dt, now)
      if (this.bailTimer <= 0) {
        // stay down until restart — soft recover after short pause
        this.phase = 'ground'
        this.roll = 0
        this.pitch = 0
        this.boardSpin = 0
        this.position.y = this.park.groundY + 0.12
      }
      return
    }

    if (this.phase === 'finished') {
      this.syncRider()
      this.record(dt, now)
      return
    }

    if (this.phase === 'grind') {
      this.updateGrind(dt, input, now)
    } else if (this.phase === 'air') {
      this.updateAir(dt, input, now)
    } else {
      this.updateGround(dt, input, now)
    }

    this.clampBounds()
    this.checkFinish()
    if(phaseBefore==='air' && this.phase==='ground')this.landingCrouch=0.34
    this.landingCrouch=THREE.MathUtils.damp(this.landingCrouch,0,16,dt)
    const grab=this.phase==='air'?this.currentGrab(input):null
    if(grab)this.visualGrab=grab
    this.grabBlend=THREE.MathUtils.damp(this.grabBlend,grab?1:0,20,dt)
    if(this.grabBlend<0.001){this.grabBlend=0;this.visualGrab=null}
    this.syncRider(input, now)
    this.record(dt, now)
  }

  private updateGround(dt: number, input: Input, now: number): void {
    // A = turn left, D = turn right (screen-space from chase cam)
    const steerInput = Number(input.state.left) - Number(input.state.right)
    const steer = steerInput * 3.35
    // Push only while holding W — no idle auto-roll
    const push = input.state.forward ? 36 : 0
    const brake = input.state.back ? 26 : 1.4

    const speedNow = Math.hypot(this.velocity.x, this.velocity.z)
    // Cork7-snappy carve: stays responsive at low speed, tightens a bit when fast
    this.yaw += steer * dt * THREE.MathUtils.clamp(1.22 + speedNow / 13, 1.1, 2.45)
    // Visual carve lean — a touch deeper so turns read on camera
    this.roll = THREE.MathUtils.lerp(this.roll, steerInput * 0.26, 1 - Math.pow(0.0008, dt))

    const forward = this.tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.velocity.x += forward.x * push * dt
    this.velocity.z += forward.z * push * dt

    // Align velocity toward facing while grounded and moving (snappier grip)
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    if (speed > 0.2) {
      const targetVX = forward.x * speed
      const targetVZ = forward.z * speed
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVX, 1 - Math.pow(0.00015, dt))
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVZ, 1 - Math.pow(0.00015, dt))
    }

    // Drag / brake — coast decays to a full stop
    const drag = brake * dt
    this.velocity.x *= Math.max(0, 1 - drag * 0.045)
    this.velocity.z *= Math.max(0, 1 - drag * 0.045)
    if (input.state.back) {
      this.velocity.x *= Math.max(0, 1 - 3.6 * dt)
      this.velocity.z *= Math.max(0, 1 - 3.6 * dt)
    }

    // Cap speed
    let xz = Math.hypot(this.velocity.x, this.velocity.z)
    const maxSpeed = input.state.forward ? 24 : 15
    if (xz > maxSpeed) {
      this.velocity.x = (this.velocity.x / xz) * maxSpeed
      this.velocity.z = (this.velocity.z / xz) * maxSpeed
      xz = maxSpeed
    }
    // Snap to true idle when nearly stopped and not pushing
    if (xz < 0.35 && !input.state.forward) {
      this.velocity.x = 0
      this.velocity.z = 0
      xz = 0
    }

    this.velocity.y = 0
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    const surface = this.surfaceYAt(this.position.x, this.position.z)
    const desiredY = surface + 0.12
    // Walked off a pad/ledge — drop into air instead of teleporting down
    if (this.position.y - desiredY > 0.55) {
      this.phase = 'air'
      this.scoring.beginAir()
      this.velocity.y = 0
      this.resolveSolids()
      return
    }
    this.position.y = desiredY
    this.resolveSolids()

    // Dust trail at speed / denser skid when braking
    const behind = this.tmp.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    if (input.state.back && xz > 4.5) {
      this.brakeFxAcc += dt
      if (this.brakeFxAcc > 0.07) {
        this.brakeFxAcc = 0
        this.fx?.brake(this.position, behind)
      }
      this.dustFxAcc = 0
    } else if (xz > 8) {
      this.brakeFxAcc = 0
      this.dustFxAcc += dt
      if (this.dustFxAcc > 0.09) {
        this.dustFxAcc = 0
        this.fx?.dust(this.position, behind)
      }
    } else {
      this.dustFxAcc = 0
      this.brakeFxAcc = 0
    }
    // Soft whoosh when hauling
    if (xz > 14) {
      this.whooshAcc += dt
      if (this.whooshAcc > 0.55) {
        this.whooshAcc = 0
        this.sfx?.whoosh()
      }
    } else {
      this.whooshAcc = 0
    }

    // Pop charge — tap = small ollie, hold = corkier pop (ease-in curve)
    if (input.state.pop) {
      if (this.popCharge <= 0) this.popCharge = 0.22
      this.popCharge = Math.min(1, this.popCharge + dt * 2.9)
    }

    if (input.consumePopRelease()) {
      // Tap ≈ small ollie; hold eases into a corkier pop (smoothstep)
      const charge = THREE.MathUtils.clamp(this.popCharge, 0.18, 1)
      const eased = charge * charge * (3 - 2 * charge)
      const boost = 4.6 + eased * 9.4
      this.velocity.y = boost
      this.velocity.x += forward.x * (1.4 + eased * 3.6)
      this.velocity.z += forward.z * (1.4 + eased * 3.6)
      this.phase = 'air'
      this.scoring.beginAir()
      this.popCharge = 0
      this.launchedRamp = false
      this.sfx?.pop()
      this.fx?.pop(this.position)
    }

    // Auto ramp launch — lower speed gate; Space charge adds pop on the lip
    if (!this.launchedRamp) {
      for (const ramp of this.park.ramps) {
        if (this.inBox(this.position, ramp.min, ramp.max) && xz > 3.2) {
          const lipPop = 1 + this.popCharge * 0.45
          this.velocity.y = ramp.launchUp * 1.12 * lipPop
          this.velocity.addScaledVector(ramp.launchDir, ramp.launchSpeed * 1.12)
          this.phase = 'air'
          this.scoring.beginAir()
          this.launchedRamp = true
          this.popCharge = 0
          this.sfx?.pop()
          this.fx?.pop(this.position)
          break
        }
      }
    } else if (!this.park.ramps.some((r) => this.inBox(this.position, r.min, r.max))) {
      this.launchedRamp = false
    }

    // Snap to rail when near, moving, and roughly parallel (align gate)
    if (xz > 1.5) {
      const rail = this.findAlignedRail(1.35, 0.62)
      if (rail) this.startGrind(rail, now)
    }

    this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 1 - Math.pow(0.001, dt))
    this.roll = THREE.MathUtils.lerp(this.roll, 0, 1 - Math.pow(0.001, dt))
    this.boardSpin = THREE.MathUtils.lerp(this.boardSpin, 0, 1 - Math.pow(0.0001, dt))
  }

  private updateAir(dt: number, input: Input, now: number): void {
    // Arcade hangtime — readable spins without ballooning big airs
    const gravity = 16.1
    this.velocity.y -= gravity * dt
    this.position.addScaledVector(this.velocity, dt)
    this.resolveSolids()

    // Air control — snappy spins so 180/360 lines read sooner
    const spinRate = (Number(input.state.airLeft) - Number(input.state.airRight)) * 475
    const flipRate = (Number(input.state.airDown) - Number(input.state.airUp)) * 395
    let boardSpinRate = 0
    if (input.state.pop) boardSpinRate = (Number(input.state.airLeft) - Number(input.state.airRight)) * 590
    else boardSpinRate = (Number(input.state.airLeft) - Number(input.state.airRight)) * 70

    this.yaw += THREE.MathUtils.degToRad(spinRate) * dt
    this.pitch += THREE.MathUtils.degToRad(flipRate) * dt
    this.boardSpin += THREE.MathUtils.degToRad(boardSpinRate) * dt
    this.roll = THREE.MathUtils.lerp(this.roll, -spinRate * 0.0016, 0.22)
    // Tiny air steer on velocity so lines stay controllable
    const airSteer = (Number(input.state.airLeft) - Number(input.state.airRight)) * 2.45 * dt
    this.velocity.x += Math.cos(this.yaw) * airSteer
    this.velocity.z -= Math.sin(this.yaw) * airSteer

    // Ignore stale pop release while airborne
    if (input.state.popJustReleased) input.consumePopRelease()

    const grab = this.currentGrab(input)
    const height = Math.max(0, this.position.y - this.park.groundY)
    this.scoring.tickAir(dt, spinRate, flipRate, boardSpinRate, grab, height)

    // Rail catch in air — wider distance, looser align while dropping onto steel
    if (this.velocity.y < 4.5) {
      const rail = this.findAlignedRail(1.45, 0.48)
      if (rail) {
        this.startGrind(rail, now)
        return
      }
    }

    // Landing on ground or elevated pads
    const surface = this.surfaceYAt(this.position.x, this.position.z)
    if (this.position.y <= surface + 0.12 && this.velocity.y <= 0) {
      this.position.y = surface + 0.12
      this.resolveLanding(now)
    }
  }

  /** Highest landable surface under XZ (ground or park pads). */
  private surfaceYAt(x: number, z: number): number {
    let y = this.park.groundY
    const pads = this.park.pads
    if (!pads) return y
    for (const pad of pads) {
      if (x >= pad.min.x && x <= pad.max.x && z >= pad.min.z && z <= pad.max.z) {
        y = Math.max(y, pad.max.y)
      }
    }
    return y
  }

  private updateGrind(dt: number, input: Input, now: number): void {
    if (!this.grindRail) {
      this.phase = 'air'
      return
    }
    const rail = this.grindRail
    const len = Math.max(0.01, rail.start.distanceTo(rail.end))
    const dir = this.tmp.copy(rail.end).sub(rail.start).normalize()

    // Locked grind speed — slight accel so lines feel committed, not runaway
    this.grindSpeed = THREE.MathUtils.clamp(this.grindSpeed + dt * 1.8, 6.5, 16)
    const along = this.grindSpeed
    const prevT = this.grindT
    this.grindT += (along * dt) / len
    this.scoring.tickGrind(dt)

    // Balance / swap (A left / D right)
    if (input.state.left || input.state.right) {
      const next = input.state.left ? -1 : 1
      if (next !== this.grindSide) {
        this.grindSide = next
        this.scoring.noteGrindSwap()
      }
    }

    const tClamped = THREE.MathUtils.clamp(this.grindT, 0, 1)
    // Follow full 3D rail (supports stair / downhill handrails)
    this.position.lerpVectors(rail.start, rail.end, tClamped)
    this.position.y += 0.14
    this.yaw = Math.atan2(dir.x, dir.z)
    this.pitch = THREE.MathUtils.lerp(this.pitch, -Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * 0.85, 0.25)
    this.velocity.copy(dir).multiplyScalar(along)
    this.boardSpin = THREE.MathUtils.lerp(this.boardSpin, this.grindSide * 0.55, 0.15)
    this.roll = this.grindSide * 0.2

    this.grindFxAcc += dt
    if (this.grindFxAcc > 0.16) {
      this.grindFxAcc = 0
      this.fx?.grind(this.position)
      this.sfx?.grindScrap()
    }

    const popped = input.consumePopRelease()
    const hitEnd = this.grindT >= 1 || this.grindT <= 0
    if (popped || hitEnd) {
      this.exitGrind(dir.clone(), along, popped, hitEnd && !popped, now, prevT)
    }
  }

  private exitGrind(
    dir: THREE.Vector3,
    along: number,
    popped: boolean,
    naturalEnd: boolean,
    now: number,
    prevT: number,
  ): void {
    this.scoring.endGrind(now)
    this.grindRail = null
    this.phase = 'air'
    this.scoring.beginAir()

    // Keep grind travel vector (incl. slope); pop adds world-up hop
    const keep = popped ? along * 1.05 : naturalEnd ? along * 0.92 : along
    this.velocity.copy(dir).multiplyScalar(keep)
    this.velocity.y += popped ? 6.2 : naturalEnd ? 1.6 : 2.4
    if (popped) {
      this.velocity.addScaledVector(dir, 1.2)
    }
    // Nudge slightly past rail tip so we don't instantly remagnetize
    if (naturalEnd) {
      const tipSign = prevT > 0.5 ? 1 : -1
      this.position.addScaledVector(dir, tipSign * 0.45)
      this.grindT = 0
    }
    this.grindSpeed = 0
    this.boardSpin = 0
    this.roll = 0
    this.pitch = 0
  }

  private resolveLanding(now: number): void {
    // Snap board rotations into nearest upright half-turn for forgiveness
    const normBoard = Math.abs(((this.boardSpin % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    const boardErr = Math.min(normBoard, Math.PI * 2 - normBoard, Math.abs(normBoard - Math.PI))
    const normPitch = Math.abs(((this.pitch % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    const pitchErr = Math.min(normPitch, Math.PI * 2 - normPitch)
    const normRoll = Math.abs(((this.roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    const rollErr = Math.min(normRoll, Math.PI * 2 - normRoll)

    // Clean = near flat; sketchy = recoverable lean; bail = wild upside-down
    const perfect = boardErr < 0.35 && pitchErr < 0.4 && rollErr < 0.35
    const upright = boardErr < 0.95 && pitchErr < 0.95 && rollErr < 0.85
    const sketchy = !upright && boardErr < 1.55 && pitchErr < 1.45 && rollErr < 1.35

    if (!upright && !sketchy) {
      this.scoring.landAir(false, false, true, now)
      this.triggerBail()
      return
    }

    this.scoring.landAir(upright || perfect, sketchy && !perfect, false, now, perfect)
    this.phase = 'ground'
    this.velocity.y = 0
    this.boardSpin = 0
    this.pitch = 0
    this.roll = 0
    this.sfx?.land(upright)
    this.fx?.land(this.position, upright)
    // Stick velocity to board facing; perfect keeps more speed
    const forward = this.tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    let spd = Math.hypot(this.velocity.x, this.velocity.z)
    if (spd > 0.4) {
      const travelYaw = Math.atan2(this.velocity.x, this.velocity.z)
      let dy = travelYaw - this.yaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      // Soft realign so sketchy landings don't skate sideways
      this.yaw += dy * (perfect ? 0.55 : upright ? 0.72 : 0.9)
      forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    }
    spd *= perfect ? 0.99 : upright ? 0.95 : 0.76
    this.velocity.x = forward.x * spd
    this.velocity.z = forward.z * spd
  }

  private triggerBail(): void {
    this.phase = 'bail'
    this.bailTimer = 1.15
    this.velocity.x *= 0.28
    this.velocity.z *= 0.28
    this.velocity.y = 1.8
    this.sfx?.bail()
    this.fx?.bail(this.position)
  }

  private startGrind(rail: RailSeg, now: number): void {
    this.grindRail = rail
    this.phase = 'grind'
    const closest = this.closestT(rail)
    // Reject tip-only snags — drop onto the usable middle of the rail
    this.grindT = THREE.MathUtils.clamp(closest, 0.04, 0.96)
    this.grindSide = 1
    const entry = Math.hypot(this.velocity.x, this.velocity.z)
    this.grindSpeed = THREE.MathUtils.clamp(Math.max(entry * 1.05, 7.0), 7.0, 14.5)
    this.grindFxAcc = 0
    this.scoring.beginGrind()
    this.scoring.cancelAir()
    this.sfx?.grind()
    this.fx?.grind(this.position)
    this.onGrindLock?.()
    void now
  }

  /**
   * Find nearest rail within maxDist whose direction aligns with board/travel
   * (dot abs >= minAlign). Skips tip zones so we don't teleport onto rail ends.
   */
  private findAlignedRail(maxDist: number, minAlign: number): RailSeg | null {
    let best: RailSeg | null = null
    let bestD = maxDist
    const moveLen = Math.hypot(this.velocity.x, this.velocity.z)
    const moveX = moveLen > 0.4 ? this.velocity.x / moveLen : Math.sin(this.yaw)
    const moveZ = moveLen > 0.4 ? this.velocity.z / moveLen : Math.cos(this.yaw)

    for (const rail of this.park.rails) {
      const t = this.closestT(rail)
      if (t < 0.03 || t > 0.97) continue
      const d = this.distToRail(rail)
      if (d >= bestD) continue
      const rx = rail.end.x - rail.start.x
      const rz = rail.end.z - rail.start.z
      const rLen = Math.hypot(rx, rz) || 1
      const align = Math.abs((rx / rLen) * moveX + (rz / rLen) * moveZ)
      if (align < minAlign) continue
      bestD = d
      best = rail
    }
    return best
  }

  private distToRail(rail: RailSeg): number {
    const ab = this.tmp.copy(rail.end).sub(rail.start)
    const ap = new THREE.Vector3().copy(this.position).sub(rail.start)
    const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1)
    const closest = rail.start.clone().addScaledVector(ab, t)
    return closest.distanceTo(this.position)
  }

  private closestT(rail: RailSeg): number {
    const ab = rail.end.clone().sub(rail.start)
    const ap = this.position.clone().sub(rail.start)
    return THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1)
  }

  private currentGrab(input: Input): GrabKind {
    if (input.state.grabMute) return 'mute'
    if (input.state.grabTail) return 'tail'
    if (input.state.grabJapan) return 'japan'
    return null
  }

  private inBox(p: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3): boolean {
    return p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y && p.z >= min.z && p.z <= max.z
  }

  /** Horizontal AABB push-out against park solids (skip while grinding). */
  private resolveSolids(): void {
    if (this.phase === 'grind' || this.phase === 'finished') return
    const solids = this.park.solids
    if (!solids || solids.length === 0) return

    const radius = 0.38
    const bodyBottom = this.position.y
    const bodyTop = this.position.y + 1.15

    for (const s of solids) {
      if (bodyTop < s.min.y || bodyBottom > s.max.y) continue

      const minX = s.min.x - radius
      const maxX = s.max.x + radius
      const minZ = s.min.z - radius
      const maxZ = s.max.z + radius
      const px = this.position.x
      const pz = this.position.z
      if (px < minX || px > maxX || pz < minZ || pz > maxZ) continue

      const penLeft = px - minX
      const penRight = maxX - px
      const penNear = pz - minZ
      const penFar = maxZ - pz
      const minPen = Math.min(penLeft, penRight, penNear, penFar)

      if (minPen === penLeft) {
        this.position.x = minX
        if (this.velocity.x > 0) this.velocity.x = 0
      } else if (minPen === penRight) {
        this.position.x = maxX
        if (this.velocity.x < 0) this.velocity.x = 0
      } else if (minPen === penNear) {
        this.position.z = minZ
        if (this.velocity.z > 0) this.velocity.z = 0
      } else {
        this.position.z = maxZ
        if (this.velocity.z < 0) this.velocity.z = 0
      }
    }
  }

  private clampBounds(): void {
    const b = this.park.bounds
    this.position.x = THREE.MathUtils.clamp(this.position.x, b.minX, b.maxX)
    this.position.z = THREE.MathUtils.clamp(this.position.z, b.minZ, b.maxZ)
  }

  private checkFinish(): void {
    if (
      !this.finished &&
      this.position.z >= this.park.finishZ &&
      (this.phase === 'ground' || this.phase === 'air')
    ) {
      this.finished = true
      this.phase = 'finished'
      this.velocity.set(0, 0, 0)
      try {
        this.scoring.forceBank(performance.now())
      } catch {
        /* scoring bank is best-effort */
      }
      this.sfx?.finish()
      this.fx?.finish(this.position)
      this.onFinish?.()
    }
  }

  private syncRider(input?: Input, now = 0): void {
    this.rider.group.position.copy(this.position)
    // Load crouch tips the nose slightly so pop charge reads on camera
    const chargePitch =
      this.phase === 'ground' && this.popCharge > 0.05 ? -this.popCharge * 0.18 : this.pitch
    const drawPitch = this.phase === 'ground' ? chargePitch : this.pitch
    this.rider.group.rotation.set(drawPitch, this.yaw, this.roll)
    const crouch = this.phase === 'ground' ? Math.max(this.popCharge,this.landingCrouch) : 0
    const grabOut = this.grabBlend
    this.rider.setPose({
      crouch,
      boardSpin: this.boardSpin,
      boardRoll: this.phase === 'grind' ? 0.15 : 0,
      lean: this.phase === 'ground' && input ? Number(input.state.left) - Number(input.state.right) : 0,
      armsOut: grabOut,
      grab: this.visualGrab,
      airborne: this.phase === 'air',
      push: this.phase === 'ground' && input?.state.forward && this.speed < 18 && crouch < 0.05
        ? Math.max(0, Math.sin(now * 0.009)) : 0,
    })
  }

  private record(dt: number, now: number): void {
    this.recordAcc += dt
    if (this.recordAcc < 1 / 30) return
    this.recordAcc = 0
    this.frames.push({
      t: now,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.yaw,
      pitch: this.rider.group.rotation.x,
      roll: this.roll,
      boardSpin: this.boardSpin,
      pose: this.rider.replayPose,
      velocity: {x:this.velocity.x,y:this.velocity.y,z:this.velocity.z},
      state: this.phase,
    })
  }

  applyReplayFrame(frame: ReplayFrame): void {
    if(frame.velocity) this.velocity.set(frame.velocity.x,frame.velocity.y,frame.velocity.z)
    else if(this.previousReplayFrame && frame.t!==this.previousReplayFrame.t){
      const seconds=(frame.t-this.previousReplayFrame.t)/1000
      this.velocity.set((frame.x-this.previousReplayFrame.x)/seconds,(frame.y-this.previousReplayFrame.y)/seconds,(frame.z-this.previousReplayFrame.z)/seconds)
    } else if(!this.previousReplayFrame) this.velocity.set(0,0,0)
    this.previousReplayFrame = frame
    this.popCharge = 0
    this.position.set(frame.x, frame.y, frame.z)
    this.yaw = frame.yaw
    this.pitch = frame.pitch
    this.roll = frame.roll
    this.boardSpin = frame.boardSpin
    this.phase = frame.state as RidePhase
    this.syncRider()
    if (frame.pose) this.rider.setPose({ ...frame.pose, boardSpin: frame.boardSpin, boardRoll: this.phase === 'grind' ? 0.15 : 0, airborne: this.phase === 'air' })
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }
}
