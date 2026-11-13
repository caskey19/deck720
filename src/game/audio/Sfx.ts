/** Tiny muteable Web Audio stubs — no asset files, no heavy libs. */
export class Sfx {
  muted = false
  musicOn = false
  private ctx: AudioContext | null = null
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = []
  private musicMaster: GainNode | null = null

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.05): void {
    if (this.muted) return
    const ctx = this.ensure()
    if (!ctx) return
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur)
  }

  pop(): void {
    this.blip(180, 0.09, 'triangle', 0.06)
    this.blip(320, 0.06, 'sine', 0.03)
  }

  land(clean: boolean): void {
    this.blip(clean ? 140 : 90, 0.12, 'square', clean ? 0.045 : 0.03)
  }

  grind(): void {
    this.blip(70, 0.05, 'sawtooth', 0.02)
  }

  /** Short scrape tick while locked on steel — caller rate-limits. */
  grindScrap(): void {
    this.blip(62, 0.04, 'sawtooth', 0.016)
    this.blip(110, 0.03, 'square', 0.008)
  }

  bail(): void {
    this.blip(55, 0.2, 'sawtooth', 0.05)
  }

  /** Soft whoosh when rolling fast — rate-limited by caller. */
  whoosh(): void {
    this.blip(95, 0.18, 'sine', 0.018)
    this.blip(48, 0.22, 'triangle', 0.012)
  }

  finish(): void {
    this.blip(260, 0.12, 'triangle', 0.05)
    this.blip(390, 0.16, 'sine', 0.04)
    this.blip(520, 0.2, 'triangle', 0.03)
  }

  score(): void {
    this.blip(440, 0.07, 'triangle', 0.03)
    this.blip(660, 0.09, 'sine', 0.025)
  }

  perfect(): void {
    this.blip(520, 0.08, 'sine', 0.035)
    this.blip(780, 0.12, 'triangle', 0.03)
  }

  /** Soft looping drone bed — procedural, no samples. */
  startMusic(): void {
    const ctx = this.ensure()
    if (!ctx || this.musicNodes.length) return
    this.musicMaster = ctx.createGain()
    this.musicMaster.gain.value = this.muted || !this.musicOn ? 0 : 0.035
    this.musicMaster.connect(ctx.destination)
    const tones = [
      { f: 110, type: 'sine' as OscillatorType },
      { f: 164.5, type: 'triangle' as OscillatorType },
      { f: 220, type: 'sine' as OscillatorType },
    ]
    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = tone.type
      osc.frequency.value = tone.f
      g.gain.value = 0.35
      osc.connect(g)
      g.connect(this.musicMaster)
      osc.start()
      this.musicNodes.push({ osc, gain: g })
    }
  }

  stopMusic(): void {
    for (const n of this.musicNodes) {
      try {
        n.osc.stop()
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = []
    this.musicMaster = null
  }

  private syncMusicGain(): void {
    if (!this.musicMaster) return
    this.musicMaster.gain.value = this.muted || !this.musicOn ? 0 : 0.035
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    this.syncMusicGain()
    return this.muted
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn
    if (this.musicOn) this.startMusic()
    else this.stopMusic()
    this.syncMusicGain()
    return this.musicOn
  }
}
