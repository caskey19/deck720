import './style.css'
import { Game } from './game/Game'
import { clear, el } from './ui/render'

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')
const ui = document.querySelector<HTMLElement>('#ui-root')

if (!canvas || !ui) {
  throw new Error('Deck7 failed to mount: missing canvas or UI root')
}

function webglOk(): boolean {
  try {
    // Probe on a throwaway canvas — never touch #game-canvas before Three.js.
    const probe = document.createElement('canvas')
    const gl =
      probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      probe.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    return Boolean(gl)
  } catch {
    return false
  }
}

function showWebglBlocker(root: HTMLElement): void {
  clear(root)
  root.append(
    el('div', { className: 'screen overlay-screen' }, [
      el('div', { className: 'sheet panel' }, [
        el('header', {}, [el('h1', { text: 'WebGL required' })]),
        el('p', {
          className: 'muted',
          text: 'Deck7 needs a GPU-backed WebGL context to draw the parks. This browser or remote session could not create one.',
        }),
        el('p', {
          className: 'muted',
          text: 'Open the game on a machine with hardware acceleration (or update Cursor / use cursor.com/agents with GPU). Lobby UI still works once WebGL is available.',
        }),
      ]),
    ]),
  )
}

if (!webglOk()) {
  showWebglBlocker(ui)
} else {
  try {
    new Game(canvas, ui)
  } catch (err) {
    console.error(err)
    showWebglBlocker(ui)
  }
}
