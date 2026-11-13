export type InputState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  pop: boolean
  popJustReleased: boolean
  grabMute: boolean
  grabTail: boolean
  grabJapan: boolean
  airLeft: boolean
  airRight: boolean
  airUp: boolean
  airDown: boolean
  restartHeld: boolean
  pause: boolean
}

const empty = (): InputState => ({
  forward: false,
  back: false,
  left: false,
  right: false,
  pop: false,
  popJustReleased: false,
  grabMute: false,
  grabTail: false,
  grabJapan: false,
  airLeft: false,
  airRight: false,
  airUp: false,
  airDown: false,
  restartHeld: false,
  pause: false,
})

export class Input {
  state: InputState = empty()
  private prevPop = false
  private restartSince = 0
  enabled = true

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
  }

  beginFrame(): void {
    // popJustReleased is cleared by the skater after it is consumed
  }

  consumePopRelease(): boolean {
    if (!this.state.popJustReleased) return false
    this.state.popJustReleased = false
    return true
  }

  endFrame(now: number): boolean {
    // returns true if restart held 2s
    if (this.state.restartHeld) {
      if (!this.restartSince) this.restartSince = now
      return now - this.restartSince >= 2000
    }
    this.restartSince = 0
    return false
  }

  /** 0–1 while holding R for restart. */
  restartProgress(now: number): number {
    if (!this.state.restartHeld || !this.restartSince) return 0
    return Math.min(1, (now - this.restartSince) / 2000)
  }

  /** Touch / on-screen control bridge. */
  setHeld(key: keyof InputState, down: boolean): void {
    if (key === 'popJustReleased' || key === 'pause') return
    ;(this.state as InputState)[key] = down
    if (key === 'pop') this.prevPop = down
    // Mirror keyboard apply() so air tricks work from touch pads
    if (key === 'left') this.state.airLeft = down
    if (key === 'right') this.state.airRight = down
  }

  pulsePopRelease(): void {
    this.state.popJustReleased = true
    this.state.pop = false
    this.prevPop = false
  }

  pulsePause(): void {
    this.state.pause = true
  }

  clear = (): void => {
    this.state = empty()
    this.prevPop = false
    this.restartSince = 0
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return
    const target=e.target as HTMLElement | null
    if(target?.closest?.('input, textarea, select, button, [contenteditable=true]'))return
    if (e.repeat) return
    this.apply(e.code, true)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.enabled) return
    // Latch release even if focus quirks cleared prevPop mid-press
    if (e.code === 'Space' && (this.prevPop || this.state.pop)) {
      this.state.popJustReleased = true
    }
    this.apply(e.code, false)
  }

  private apply(code: string, down: boolean): void {
    const s = this.state
    switch (code) {
      case 'KeyW':
        s.forward = down
        break
      case 'KeyS':
        s.back = down
        break
      case 'KeyA':
        s.left = down
        s.airLeft = down
        break
      case 'KeyD':
        s.right = down
        s.airRight = down
        break
      case 'ArrowLeft':
        s.airLeft = down
        break
      case 'ArrowRight':
        s.airRight = down
        break
      case 'ArrowUp':
        s.airUp = down
        break
      case 'ArrowDown':
        s.airDown = down
        break
      case 'Space':
        s.pop = down
        this.prevPop = down
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        s.grabMute = down
        break
      case 'KeyQ':
        s.grabTail = down
        break
      case 'KeyE':
        s.grabJapan = down
        break
      case 'KeyR':
        s.restartHeld = down
        break
      case 'Escape':
      case 'KeyP':
        if (down) s.pause = true
        break
      default:
        break
    }
  }

  consumePause(): boolean {
    if (!this.state.pause) return false
    this.state.pause = false
    return true
  }
}
