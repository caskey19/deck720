export type GrabKind = 'mute' | 'tail' | 'japan' | null

export type ScoredBeat = {
  name: string
  points: number
  category: 'trick' | 'grab' | 'rail' | 'landing'
}

export type ScoreState = {
  tricks: number
  grabs: number
  rails: number
  landings: number
  linePoints: number
  lineCount: number
  total: number
  lastBeat: ScoredBeat | null
  /** Recent scored beats for the HUD combo history strip (newest last). */
  recentBeats: ScoredBeat[]
  banner: string
  bannerPoints: number
  bannerUntil: number
  bannerCategory: ScoredBeat['category'] | 'bail' | ''
  /** Live grind swap count while locked (0 off-rail). */
  grindSwaps: number
}

type AirAccum = {
  spinDeg: number
  flipDeg: number
  boardSpinDeg: number
  grabMute: number
  grabTail: number
  grabJapan: number
  airTime: number
  heightPeak: number
}

const SPIN_TABLE = [
  { deg: 180, pts: 400 },
  { deg: 360, pts: 1500 },
  { deg: 540, pts: 3200 },
  { deg: 720, pts: 6000 },
  { deg: 900, pts: 9500 },
  { deg: 1080, pts: 13500 },
]

function rotationPoints(totalTurnsDeg: number): { pts: number; label: string } {
  const abs = Math.abs(totalTurnsDeg)
  if (abs < 140) return { pts: 0, label: '' }
  let best = SPIN_TABLE[0]
  for (const row of SPIN_TABLE) {
    if (abs + 40 >= row.deg) best = row
  }
  // Interpolate a bit past the nearest completed rotation
  const label = `${best.deg}`
  return { pts: best.pts, label }
}

function decayFactor(seen: number): number {
  if (seen <= 0) return 1
  if (seen === 1) return 0.75
  if (seen === 2) return 0.55
  return 0.4
}

export class Scoring {
  state: ScoreState = this.empty()
  private repeats = new Map<string, number>()
  private air: AirAccum | null = null
  private grindSeconds = 0
  private grindSwapCount = 0

  empty(): ScoreState {
    return {
      tricks: 0,
      grabs: 0,
      rails: 0,
      landings: 0,
      linePoints: 0,
      lineCount: 0,
      total: 0,
      lastBeat: null,
      recentBeats: [],
      banner: '',
      bannerPoints: 0,
      bannerUntil: 0,
      bannerCategory: '',
      grindSwaps: 0,
    }
  }

  reset(): void {
    this.state = this.empty()
    this.repeats.clear()
    this.air = null
    this.grindSeconds = 0
    this.grindSwapCount = 0
  }

  beginAir(): void {
    this.air = {
      spinDeg: 0,
      flipDeg: 0,
      boardSpinDeg: 0,
      grabMute: 0,
      grabTail: 0,
      grabJapan: 0,
      airTime: 0,
      heightPeak: 0,
    }
  }

  cancelAir(): void {
    this.air = null
  }

  tickAir(dt: number, spinRate: number, flipRate: number, boardSpinRate: number, grab: GrabKind, height: number): void {
    if (!this.air) return
    this.air.spinDeg += spinRate * dt
    this.air.flipDeg += flipRate * dt
    this.air.boardSpinDeg += boardSpinRate * dt
    this.air.airTime += dt
    this.air.heightPeak = Math.max(this.air.heightPeak, height)
    if (grab === 'mute') this.air.grabMute += dt
    if (grab === 'tail') this.air.grabTail += dt
    if (grab === 'japan') this.air.grabJapan += dt
  }

  beginGrind(): void {
    this.grindSeconds = 0
    this.grindSwapCount = 0
    this.state.grindSwaps = 0
  }

  tickGrind(dt: number): void {
    this.grindSeconds += dt
  }

  noteGrindSwap(): void {
    this.grindSwapCount += 1
    this.state.grindSwaps = this.grindSwapCount
  }

  endGrind(now: number): void {
    const railPts = Math.floor(this.grindSeconds * 750) + this.grindSwapCount * 450
    if (railPts <= 0) return
    const name =
      this.grindSwapCount > 0
        ? `Grind + ${this.grindSwapCount} swap${this.grindSwapCount > 1 ? 's' : ''}`
        : this.grindSeconds > 0.8
          ? 'Long grind'
          : 'Grind'
    this.addToLine(name, railPts, 'rail', now)
    this.grindSeconds = 0
    this.grindSwapCount = 0
    this.state.grindSwaps = 0
  }

  landAir(clean: boolean, sketchy: boolean, crashed: boolean, now: number, perfect = false): void {
    if (!this.air) return
    if (crashed) {
      this.bustLine(now)
      this.air = null
      return
    }

    const named = this.nameTrick(this.air)
    const rot = rotationPoints(Math.max(Math.abs(this.air.spinDeg), Math.abs(this.air.boardSpinDeg)) + Math.abs(this.air.flipDeg) * 0.85)
    let pts = rot.pts

    // Board flip family adds base when spin was mostly flip trick
    if (Math.abs(this.air.boardSpinDeg) >= 140 && rot.pts === 0) {
      pts = 600
    } else if (Math.abs(this.air.boardSpinDeg) >= 140) {
      pts = Math.floor(pts * 1.15)
    }

    // Ollie-only small air — credit quick hops so feedback stays readable
    if (pts === 0 && this.air.airTime > 0.26) {
      pts = 165
      named.name = named.name || 'Ollie'
    }

    const grabHold = Math.max(this.air.grabMute, this.air.grabTail, this.air.grabJapan)
    let grabMult = 1
    let grabCats = 0
    if (this.air.grabMute >= 0.25) grabCats++
    if (this.air.grabTail >= 0.25) grabCats++
    if (this.air.grabJapan >= 0.25) grabCats++
    if (grabHold >= 1) grabMult = grabCats >= 2 ? 1.3 : 1.25
    else if (grabHold >= 0.25) grabMult = 1.15

    const grabBonus = Math.floor(pts * (grabMult - 1))
    pts = Math.floor(pts * grabMult)

    // Air time / height
    pts += Math.floor(this.air.airTime * 135 + this.air.heightPeak * 36)
    if (perfect) pts = Math.floor(pts * 1.12)

    const key = named.name
    const seen = this.repeats.get(key) ?? 0
    pts = Math.floor(pts * decayFactor(seen))
    this.repeats.set(key, seen + 1)

    if (pts > 0) {
      this.addToLine(named.name, pts, 'trick', now)
      if (grabBonus > 0) {
        this.state.grabs += grabBonus
        this.state.linePoints += grabBonus
        this.state.total += grabBonus
      }
    }

    if (perfect) {
      const land = 780 + Math.floor(this.state.linePoints * 0.22)
      this.bankLine(land, now, 'Perfect')
    } else if (clean) {
      const land = 520 + Math.floor(this.state.linePoints * 0.18)
      this.bankLine(land, now, 'Clean')
    } else if (sketchy) {
      // Keep ~55% of line, small landing credit — readable "survived it" feedback
      this.state.linePoints = Math.floor(this.state.linePoints * 0.55)
      this.bankLine(180, now, 'Sketchy')
    } else {
      this.bankLine(0, now)
    }

    this.air = null
  }

  private nameTrick(air: AirAccum): { name: string } {
    const spin = Math.abs(air.spinDeg)
    const flip = Math.abs(air.flipDeg)
    const board = Math.abs(air.boardSpinDeg)
    const grabs: string[] = []
    if (air.grabMute >= 0.25) grabs.push('Mute')
    if (air.grabTail >= 0.25) grabs.push('Tail')
    if (air.grabJapan >= 0.25) grabs.push('Japan')

    let base = 'Ollie'
    if (board >= 300 && spin < 100) base = '360 Flip'
    else if (board >= 140 && air.boardSpinDeg > 0) base = 'Heelflip'
    else if (board >= 140) base = 'Kickflip'
    else if (spin >= 500 && flip >= 200) base = 'Flipping 540'
    else if (spin >= 300 && flip >= 200) base = 'Flipping 360'
    else if (spin >= 140 && flip >= 200) base = 'Front/Back Flip'
    else if (spin >= 500) base = `${Math.round(spin / 180) * 180} Shove`
    else if (spin >= 140) base = `${spin >= 300 ? '360' : '180'} Shove-it`
    else if (flip >= 200) base = air.flipDeg > 0 ? 'Front Flip' : 'Back Flip'

    const grabSuffix = grabs.length ? ` ${grabs.join('+')}` : ''
    return { name: `${base}${grabSuffix}` }
  }

  private addToLine(name: string, points: number, category: ScoredBeat['category'], now: number): void {
    this.state.lineCount += 1
    const finalPts =
      this.state.lineCount <= 1 ? points : Math.floor(points * (1 + (this.state.lineCount - 1) * 0.25))

    this.state.linePoints += finalPts
    if (category === 'trick') this.state.tricks += finalPts
    if (category === 'rail') this.state.rails += finalPts
    if (category === 'grab') this.state.grabs += finalPts

    const beat: ScoredBeat = { name, points: finalPts, category }
    this.state.lastBeat = beat
    this.state.recentBeats.push(beat)
    if (this.state.recentBeats.length > 6) this.state.recentBeats.shift()
    this.state.banner = name
    this.state.bannerPoints = finalPts
    this.state.bannerUntil = now + 1800
    this.state.bannerCategory = category
  }

  private bankLine(landingPts: number, now: number, tag = 'Clean'): void {
    if (landingPts > 0) {
      this.state.landings += landingPts
      this.state.linePoints += landingPts
      this.state.banner = this.state.banner ? `${this.state.banner} · ${tag}` : `${tag} landing`
      this.state.bannerUntil = now + 1400
      this.state.bannerCategory = 'landing'
    }
    this.state.total += this.state.linePoints
    this.state.linePoints = 0
    this.state.lineCount = 0
  }

  /** Bank remaining line points (e.g. crossing finish). */
  forceBank(now: number): void {
    if (this.air) {
      this.landAir(true, false, false, now)
    }
    if (this.grindSeconds > 0) {
      this.endGrind(now)
    }
    if (this.state.linePoints > 0) {
      this.bankLine(0, now)
    }
  }

  private bustLine(now: number): void {
    this.state.linePoints = 0
    this.state.lineCount = 0
    this.state.banner = 'Bailed'
    this.state.bannerPoints = 0
    this.state.bannerUntil = now + 1200
    this.state.bannerCategory = 'bail'
  }

  snapshot() {
    return { ...this.state }
  }
}
