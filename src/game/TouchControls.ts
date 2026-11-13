import type { Input } from './Input'
import { el } from '../ui/render'

/** Minimal on-screen controls for phones/tablets. */
export class TouchControls {
  private root: HTMLElement | null = null
  private visible = false
  private input: Input

  constructor(input: Input) {
    this.input = input
  }

  mount(ui: HTMLElement): void {
    this.unmount()
    const root = el('div', { className: 'touch-controls' })
    const mk = (label: string, cls: string, onDown: () => void, onUp: () => void) => {
      const b = el('button', { className: `touch-btn ${cls}`, text: label, type: 'button' })
      const start = (e: Event) => {
        e.preventDefault()
        onDown()
      }
      const end = (e: Event) => {
        e.preventDefault()
        onUp()
      }
      b.addEventListener('pointerdown', start)
      b.addEventListener('pointerup', end)
      b.addEventListener('pointercancel', end)
      b.addEventListener('pointerleave', end)
      return b
    }

    const leftPad = el('div', { className: 'touch-cluster left' }, [
      mk('A', 'steer', () => this.input.setHeld('left', true), () => this.input.setHeld('left', false)),
      mk('D', 'steer', () => this.input.setHeld('right', true), () => this.input.setHeld('right', false)),
    ])
    const rightPad = el('div', { className: 'touch-cluster right' }, [
      mk('W', 'push', () => this.input.setHeld('forward', true), () => this.input.setHeld('forward', false)),
      mk('POP', 'pop', () => this.input.setHeld('pop', true), () => this.input.pulsePopRelease()),
      mk('S', 'brake', () => this.input.setHeld('back', true), () => this.input.setHeld('back', false)),
    ])
    const grabs = el('div', { className: 'touch-cluster grabs' }, [
      mk('M', 'grab', () => this.input.setHeld('grabMute', true), () => this.input.setHeld('grabMute', false)),
      mk('T', 'grab', () => this.input.setHeld('grabTail', true), () => this.input.setHeld('grabTail', false)),
      mk('J', 'grab', () => this.input.setHeld('grabJapan', true), () => this.input.setHeld('grabJapan', false)),
    ])
    const top = el('div', { className: 'touch-cluster top' }, [
      mk('II', 'pause', () => this.input.pulsePause(), () => {}),
      mk('R', 'restart', () => this.input.setHeld('restartHeld', true), () =>
        this.input.setHeld('restartHeld', false),
      ),
    ])
    root.append(leftPad, rightPad, grabs, top)
    ui.append(root)
    this.root = root
    this.visible = true
  }

  unmount(): void {
    this.root?.remove()
    this.root = null
    this.visible = false
  }

  get isMounted(): boolean {
    return this.visible
  }
}
