import { lightPark, followSun } from './park/atmosphere'
import { disposeObject } from './park/dispose'
import { batchPark } from './park/batch'
import * as THREE from 'three'
import { Input } from './Input'
import { buildTheYard, type ParkData } from './park/TheYard'
import { buildForestLine } from './park/ForestLine'
import { buildApex } from './park/Apex'
import { buildBigAir } from './park/BigAir'
import { buildChannel } from './park/Channel'
import { SkaterController } from './physics/SkaterController'
import { Sfx } from './audio/Sfx'
import { RideFx } from './fx/RideFx'
import { TouchControls } from './TouchControls'

type ParkId = 'the-yard' | 'forest-line' | 'apex' | 'big-air' | 'channel'
import { Scoring } from './scoring/Scoring'
import {
  loadKit,
  saveKit,
  loadBestScore,
  saveBestScore,
  saveReplay,
  loadGhostFrames,
  saveGhostFrames,
  clearParkRecord,
  loadSettings,
  saveSettings,
  loadSessionStats,
  noteSessionRun,
  type KitSelection,
  type ScoreBreakdown,
  type ReplayFrame,
} from '../storage/persist'
import { Rider } from './rider/Rider'
import { DECKS, HATS, PANTS, SHOES, SHIRTS } from './cosmetics'
import { clear, el } from '../ui/render'

type Screen =
  | 'lobby'
  | 'howto'
  | 'about'
  | 'controls'
  | 'locker'
  | 'map'
  | 'riding'
  | 'paused'
  | 'results'
  | 'replay'

export class Game {
  private ui: HTMLElement
  private sunLight: THREE.DirectionalLight | null = null
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300)
  private input = new Input()
  private clock = new THREE.Clock()
  private park: ParkData | null = null
  private skater: SkaterController | null = null
  private scoring = new Scoring()
  private kit: KitSelection = loadKit()
  private screen: Screen = 'lobby'
  private mode: 'solo' | 'multi' = 'solo'
  private lastBreakdown: ScoreBreakdown | null = null
  private replayFrames: ReplayFrame[] = []
  private replayIndex = 0
  private replayPlaying = true
  private replayCamera: 'chase' | 'orbit' = 'chase'
  private orbitAngle = 0
  private anim = 0
  private toastTimer = 0
  /** Smoothed chase yaw — decoupled from board spin in air */
  private cameraYaw = 0
  private cameraYawReady = false
  private cameraFov = 55
  private cameraShake = 0
  private parkId: ParkId = 'the-yard'
  private parkLabel = 'The Yard'
  private sfx = new Sfx()
  private fx: RideFx | null = null
  private touch = new TouchControls(this.input)
  private ghostRider: Rider | null = null
  private ghostFrames: ReplayFrame[] = []
  private ghostIndex = 0
  private ghostEnabled = loadSettings().ghostEnabled
  private runStartMs = 0
  private lastGrindToastMs = 0
  private lastLineCountHud = 0

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.ui = uiRoot
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.scene.background = new THREE.Color('#87a0b8')
    this.scene.fog = new THREE.Fog('#87a0b8', 40, 160)

    window.addEventListener('resize', this.onResize)
    this.onResize()
    this.showLobby()
    this.anim = requestAnimationFrame(this.frame)
  }

  dispose(): void {
    cancelAnimationFrame(this.anim)
    window.removeEventListener('resize', this.onResize)
    this.clearWorld()
    this.input.dispose()
    this.renderer.dispose()
  }

  private onResize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private frame = (): void => {
    this.anim = requestAnimationFrame(this.frame)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const now = performance.now()

    if (this.screen === 'riding' && this.skater) {
      if (this.input.consumePause()) {
        this.screen = 'paused'
        this.renderPause()
      } else {
        const restart = this.input.endFrame(now)
        this.skater.update(dt, this.input, now)
        this.fx?.update(dt)
        this.updateGhost(now)
        // Skater finish callback may switch screen mid-frame
        if (this.screen !== 'riding') {
          /* results / other UI already mounted */
        } else if (restart) {
          this.restartRun()
        } else {
          this.updateChaseCamera(dt)
          this.ensureHud()
          this.tickHud(now)
        }
      }
    } else if (this.screen === 'replay' && this.skater) {
      this.updateReplay(dt)
    } else if (this.screen === 'paused') {
      if (this.input.consumePause()) {
        this.screen = 'riding'
        this.ensureHud(true)
        this.tickHud(now)
      }
    }

    if (this.park) {
      if (this.sunLight && this.skater) followSun(this.sunLight, this.skater.position)
      this.renderer.render(this.scene, this.camera)
    } else if (this.screen === 'lobby') {
      // Soft idle clear
      this.renderer.setClearColor('#0e0c0a')
      this.renderer.clear()
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt * 1000
      if (this.toastTimer <= 0) {
        const t = this.ui.querySelector('.toast')
        t?.remove()
      }
    }
  }

  private clearWorld(): void {
    this.fx?.dispose()
    this.fx = null
    this.ghostRider = null
    this.ghostFrames = []
    this.ghostIndex = 0
    disposeObject(this.scene)
    while (this.scene.children.length) this.scene.remove(this.scene.children[0])
    this.park = null
    this.skater = null
    this.sunLight = null
  }

  private setupLights(): void {
    this.sunLight = lightPark(this.scene, this.parkId)
  }

  private parkLabelFor(id: ParkId): string {
    switch (id) {
      case 'forest-line':
        return 'Forest Line'
      case 'apex':
        return 'Apex'
      case 'big-air':
        return 'Big Air'
      case 'channel':
        return 'Channel'
      default:
        return 'The Yard'
    }
  }

  private buildPark(id: ParkId): ParkData {
    switch (id) {
      case 'forest-line':
        return batchPark(buildForestLine())
      case 'apex':
        return batchPark(buildApex())
      case 'big-air':
        return batchPark(buildBigAir())
      case 'channel':
        return batchPark(buildChannel())
      default:
        return batchPark(buildTheYard())
    }
  }

  private startPark(parkId: ParkId = 'the-yard'): void {
    this.clearWorld()
    this.parkId = parkId
    this.parkLabel = this.parkLabelFor(parkId)
    this.setupLights()
    this.park = this.buildPark(parkId)
    this.scene.add(this.park.group)
    this.scoring = new Scoring()
    this.fx = new RideFx(this.scene)
    this.skater = new SkaterController(this.park, this.scoring)
    this.skater.sfx = this.sfx
    this.skater.fx = this.fx
    this.skater.rider.applyKit(this.kit)
    this.scene.add(this.skater.rider.group)
    this.skater.onFinish = () => this.finishRun()
    this.skater.onGrindLock = () => {
      const t = performance.now()
      if (t - this.lastGrindToastMs > 900) {
        this.lastGrindToastMs = t
        this.toast('Locked')
      }
    }
    this.setupGhost()
    this.runStartMs = performance.now()
    this.lastLineCountHud = 0
    this.cameraYawReady = false
    this.input.clear()
    this.input.enabled = true
    this.screen = 'riding'
    this.updateChaseCamera(0.016)
    this.ensureHud(true)
    this.tickHud(performance.now())
    if (this.ghostEnabled && this.ghostFrames.length >= 8) this.toast('PB ghost riding with you')
    else this.toast(this.parkTip(parkId))
  }

  private parkTip(id: ParkId): string {
    switch (id) {
      case 'forest-line':
        return 'Forest Line — commit the long steel'
      case 'apex':
        return 'Apex — stay lined up on the precision ledges'
      case 'big-air':
        return 'Big Air — speed into the mega hub'
      case 'channel':
        return 'Channel — curb to bank to stair handrail'
      default:
        return 'The Yard — push W, load Space, hit the hub'
    }
  }

  private setupGhost(): void {
    this.ghostFrames = loadGhostFrames(this.parkId)
    this.ghostIndex = 0
    if (this.ghostRider) {
      disposeObject(this.ghostRider.group)
      this.scene.remove(this.ghostRider.group)
      this.ghostRider = null
    }
    if (!this.ghostEnabled || this.ghostFrames.length < 8) return
    this.ghostRider = new Rider()
    this.ghostRider.applyKit(this.kit)
    // Ice-cyan silhouette so PB ghost never reads as the live rider
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x5ad6d0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
    const oldMaterials = new Set<THREE.Material>()
    this.ghostRider.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      for (const material of Array.isArray(m.material) ? m.material : [m.material]) oldMaterials.add(material)
      m.material = ghostMat
      m.castShadow = false
      m.receiveShadow = false
    })
    const oldTextures = new Set<THREE.Texture>()
    for(const material of oldMaterials){
      for(const value of Object.values(material))if(value instanceof THREE.Texture)oldTextures.add(value)
      material.dispose()
    }
    oldTextures.forEach(texture=>texture.dispose())
    // Ground ring so the ghost reads even at distance
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: 0x5ad6d0,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.05
    this.ghostRider.group.add(ring)
    this.scene.add(this.ghostRider.group)
  }

  private updateGhost(now: number): void {
    if (!this.ghostEnabled || !this.ghostRider || this.ghostFrames.length === 0) return
    const t0 = this.ghostFrames[0].t
    const elapsed = now - this.runStartMs
    const targetT = t0 + elapsed
    while (
      this.ghostIndex < this.ghostFrames.length - 1 &&
      this.ghostFrames[this.ghostIndex + 1].t <= targetT
    ) {
      this.ghostIndex++
    }
    const a = this.ghostFrames[this.ghostIndex]
    const b = this.ghostFrames[Math.min(this.ghostIndex + 1, this.ghostFrames.length - 1)]
    const span = Math.max(1, b.t - a.t)
    const u = THREE.MathUtils.clamp((targetT - a.t) / span, 0, 1)
    const lerp = (x: number, y: number) => x + (y - x) * u
    const lerpAngle = (x: number, y: number) => {
      let d = y - x
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      return x + d * u
    }
    this.ghostRider.group.position.set(lerp(a.x, b.x), lerp(a.y, b.y), lerp(a.z, b.z))
    this.ghostRider.group.rotation.set(
      lerpAngle(a.pitch, b.pitch),
      lerpAngle(a.yaw, b.yaw),
      lerpAngle(a.roll, b.roll),
    )
    this.ghostRider.setPose({
      crouch: lerp(a.pose?.crouch ?? 0, b.pose?.crouch ?? 0),
      boardSpin: lerpAngle(a.boardSpin, b.boardSpin),
      boardRoll: a.state === 'grind' || b.state === 'grind' ? 0.15 : 0,
      lean: lerp(a.pose?.lean ?? 0, b.pose?.lean ?? 0),
      armsOut: lerp(a.pose?.armsOut ?? 0, b.pose?.armsOut ?? 0),
      push: lerp(a.pose?.push ?? 0, b.pose?.push ?? 0),
      airborne: a.state === 'air' || b.state === 'air',
    })
  }

  private restartRun(): void {
    if (!this.skater) return
    this.skater.reset()
    this.skater.rider.applyKit(this.kit)
    this.setupGhost()
    this.runStartMs = performance.now()
    this.lastLineCountHud = 0
    this.cameraYawReady = false
    this.input.clear()
    this.screen = 'riding'
    this.ensureHud(true)
    this.tickHud(performance.now())
    this.toast('Restarted from the top')
  }

  private lastBeats: { name: string; points: number }[] = []
  private previousBest = 0

  private finishRun(): void {
    if (!this.skater) return
    const s = this.scoring.snapshot()
    this.lastBreakdown = {
      tricks: s.tricks,
      grabs: s.grabs,
      rails: s.rails,
      landings: s.landings,
      total: s.total,
    }
    this.lastBeats = s.recentBeats.map((b) => ({ name: b.name, points: b.points }))
    this.replayFrames = [...this.skater.replayFrames]
    this.previousBest = loadBestScore(this.parkId)
    saveBestScore(this.parkId, s.total)
    saveGhostFrames(this.parkId, this.replayFrames, s.total)
    noteSessionRun(s.total)
    this.input.enabled = false
    this.screen = 'results'
    this.renderResults()
  }

  private updateChaseCamera(dt: number): void {
    if (!this.skater) return
    const p = this.skater.position
    const phase = this.skater.phase
    const spd = this.skater.speed

    // Target yaw: board facing on ground; travel direction in air/grind so spins don't whip the cam
    let targetYaw = this.skater.yaw
    if (phase === 'air' || phase === 'grind') {
      if (spd > 1.2) {
        targetYaw = Math.atan2(this.skater.velocity.x, this.skater.velocity.z)
      } else if (this.cameraYawReady) {
        targetYaw = this.cameraYaw
      }
    }

    if (!this.cameraYawReady) {
      this.cameraYaw = targetYaw
      this.cameraYawReady = true
    } else {
      let dy = targetYaw - this.cameraYaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      // Ground catches up snappy; air eases slowly toward travel path only
      const follow = phase === 'air' ? 0.012 : phase === 'grind' ? 0.04 : 0.00025
      this.cameraYaw += dy * (1 - Math.pow(follow, dt))
    }

    const airLift = phase === 'air' || phase === 'grind' ? 0.55 : 0
    const yaw = this.cameraYaw
    const dist = 7.2 + THREE.MathUtils.clamp(spd / 28, 0, 1.1) + (phase === 'air' ? 0.35 : 0)
    const behind = new THREE.Vector3(-Math.sin(yaw) * dist, 3.25 + airLift + spd * 0.02, -Math.cos(yaw) * dist)
    const desired = p.clone().add(behind)
    this.camera.position.lerp(desired, 1 - Math.pow(0.00035, dt))
    const look = p.clone().add(new THREE.Vector3(Math.sin(yaw) * 5.2, 1.05, Math.cos(yaw) * 5.2))
    this.camera.lookAt(look)

    // Subtle FOV punch with speed / air — keep chase readable
    const targetFov = 55 + THREE.MathUtils.clamp(spd * 0.22, 0, 6) + (phase === 'air' ? 2.5 : 0)
    this.cameraFov = THREE.MathUtils.lerp(this.cameraFov, targetFov, 1 - Math.pow(0.01, dt))
    if (Math.abs(this.camera.fov - this.cameraFov) > 0.05) {
      this.camera.fov = this.cameraFov
      this.camera.updateProjectionMatrix()
    }

    if (phase === 'bail' && this.cameraShake < 0.35) this.cameraShake = 0.55
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8)
      const mag = this.cameraShake * 0.18
      this.camera.position.x += (Math.random() - 0.5) * mag
      this.camera.position.y += (Math.random() - 0.5) * mag * 0.6
    }
  }

  private updateReplay(dt: number): void {
    if (!this.skater || this.replayFrames.length === 0) return
    if (this.replayPlaying) {
      this.replayIndex = Math.min(this.replayIndex + dt * 30, this.replayFrames.length - 1)
    }
    const frame = this.replayFrames[Math.floor(this.replayIndex)]
    this.skater.applyReplayFrame(frame)

    if (this.replayCamera === 'chase') {
      this.updateChaseCamera(dt)
    } else {
      this.orbitAngle += dt * 0.6
      const p = this.skater.position
      this.camera.position.set(
        p.x + Math.cos(this.orbitAngle) * 8,
        p.y + 3.5,
        p.z + Math.sin(this.orbitAngle) * 8,
      )
      this.camera.lookAt(p.x, p.y + 1, p.z)
    }

    const total = Math.max(1, this.replayFrames.length - 1)
    const idx = Math.floor(this.replayIndex)
    const scrub = this.ui.querySelector('.replay-scrub') as HTMLInputElement | null
    if (scrub && document.activeElement !== scrub) scrub.value = String(idx)
    const label = document.getElementById('replay-time')
    if (label) label.textContent = `${idx} / ${total}`

    if (this.replayIndex >= this.replayFrames.length - 1) {
      this.replayPlaying = false
    }
  }

  // ——— UI ———

  private showLobby(): void {
    this.screen = 'lobby'
    this.input.enabled = false
    this.clearWorld()
    clear(this.ui)
    const root = el('div', { className: 'screen lobby' }, [
      el('div', { className: 'lobby-top' }, [
        el('div', { className: 'brand' }, [
          el('div', { className: 'brand-mark', text: 'DECK7' }),
          el('div', { className: 'brand-sub', text: 'Basecamp' }),
        ]),
        el('div', { className: 'nav-links' }, [
          this.navBtn('Ride', () => {}, true),
          this.navBtn('Locker', () => this.showLocker()),
          this.navSoon('Shop'),
          this.navSoon('Pass'),
          this.navSoon('Leaderboard'),
          this.navSoon('Replays'),
        ]),
      ]),
      el('div', { className: 'lobby-season-strip' }, [
        el('span', { className: 'season-label', text: 'Season pass' }),
        el('span', { className: 'season-tier', text: 'Tier · Free' }),
        el('span', {
          className: 'season-promo',
          text: (() => {
            const ses = loadSessionStats()
            return ses.runs > 0
              ? `Session · ${ses.runs} run${ses.runs === 1 ? '' : 's'} · best ${ses.bestThisSession}`
              : 'Open session · Parks · Best'
          })(),
        }),
        el('span', {
          className: 'season-score',
          text: String(
            Math.max(
              loadBestScore('the-yard'),
              loadBestScore('forest-line'),
              loadBestScore('apex'),
              loadBestScore('big-air'),
              loadBestScore('channel'),
            ),
          ),
        }),
      ]),
      el('div', { className: 'lobby-park-bests' }, [
        el('span', { text: `Yard ${loadBestScore('the-yard')}` }),
        el('span', { text: `Forest ${loadBestScore('forest-line')}` }),
        el('span', { text: `Apex ${loadBestScore('apex')}` }),
        el('span', { text: `Big Air ${loadBestScore('big-air')}` }),
        el('span', { text: `Channel ${loadBestScore('channel')}` }),
      ]),
      el('div', { className: 'lobby-basecamp' }, [
        el('div', { className: 'basecamp-panel panel' }, [
          el('div', { className: 'basecamp-head' }, [
            el('span', { className: 'basecamp-kicker', text: 'Lift pass · Browser' }),
            el('h1', { className: 'basecamp-title', text: 'Basecamp' }),
          ]),
          el('div', { className: 'mode-row' }, [
            this.modeCard('solo', 'Solo', 'Drop in · chase your best.', true),
            this.modeCard('multi', 'Multiplayer', 'Rooms when servers land.', false),
          ]),
          (() => {
            const btn = el('button', { className: 'ride-btn', text: 'RIDE  ·  ENTER' }) as HTMLButtonElement
            btn.addEventListener('click', () => this.onRide())
            return btn
          })(),
        ]),
      ]),
      el('div', { className: 'lobby-footer' }, [
        el('div', { className: 'lobby-footer-links' }, [
          this.footerLink('About', () => this.showAbout()),
          this.footerLink('How to play', () => this.showHowto()),
          this.footerLink('Controls', () => this.showControls()),
        ]),
        el('span', { className: 'lobby-footer-note', text: 'Deck7 is original. Not affiliated with Cork7, SSX, or EA.' }),
      ]),
    ])
    this.ui.append(root)
    this.bindLobbyKeys()
  }

  private lobbyKeyHandler: ((e: KeyboardEvent) => void) | null = null

  private bindLobbyKeys(): void {
    if (this.lobbyKeyHandler) {
      window.removeEventListener('keydown', this.lobbyKeyHandler)
    }
    this.lobbyKeyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && this.screen === 'lobby') this.onRide()
    }
    window.addEventListener('keydown', this.lobbyKeyHandler)
  }

  private navBtn(label: string, fn: () => void, active = false): HTMLButtonElement {
    const b = el('button', { text: label }) as HTMLButtonElement
    if (active) b.classList.add('active')
    b.addEventListener('click', fn)
    return b
  }

  private navSoon(label: string): HTMLButtonElement {
    return this.navBtn(label, () => this.toast('Soon'))
  }

  private footerLink(label: string, fn: () => void): HTMLButtonElement {
    const b = el('button', { className: 'footer-link', text: label }) as HTMLButtonElement
    b.addEventListener('click', fn)
    return b
  }

  private modeCard(id: 'solo' | 'multi', label: string, hint: string, picked: boolean): HTMLButtonElement {
    const b = el('button', { className: `mode-card${this.mode === id || (picked && this.mode === id) ? ' picked' : ''}` }, [
      el('span', { className: 'label', text: label }),
      el('span', { className: 'hint', text: hint }),
      id === 'multi' ? el('span', { className: 'tag', text: 'Coming soon' }) : el('span', { className: 'tag', text: 'Picked' }),
    ]) as HTMLButtonElement
    if (this.mode === id) b.classList.add('picked')
    b.addEventListener('click', () => {
      if (id === 'multi') {
        this.toast('Multiplayer rooms are stubbed for now — ride Solo')
        return
      }
      this.mode = id
      this.showLobby()
    })
    return b
  }

  private onRide(): void {
    if (this.mode === 'multi') {
      this.toast('Multiplayer coming soon — starting Solo')
      this.mode = 'solo'
    }
    this.showMap()
  }

  private parkBestLine(parkId: ParkId): HTMLElement {
    const best = loadBestScore(parkId)
    const ghost = loadGhostFrames(parkId).length >= 8
    const text = ghost ? `Best ${best} · Ghost ready` : `Best ${best}`
    return el('div', { className: ghost ? 'park-meta ghost-ready' : 'park-meta', text })
  }

  private showMap(): void {
    this.screen = 'map'
    clear(this.ui)
    const back = el('button', { className: 'btn', text: '← Basecamp' })
    back.addEventListener('click', () => this.showLobby())

    const yard = el('button', { className: 'park-card available' }, [
      el('div', {}, [
        el('h3', { text: 'THE YARD' }),
        el('div', { className: 'park-meta', text: 'Open session · ledges · hub gap · quarter · rails' }),
        this.parkBestLine('the-yard'),
      ]),
      el('span', { className: 'drop-btn', text: 'DROP IN' }),
    ])
    yard.addEventListener('click', () => this.startPark('the-yard'))

    const forest = el('button', { className: 'park-card available' }, [
      el('div', {}, [
        el('h3', { text: 'FOREST LINE' }),
        el('div', { className: 'park-meta', text: 'Woodland rails · long steel · timber ledge' }),
        this.parkBestLine('forest-line'),
      ]),
      el('span', { className: 'drop-btn', text: 'DROP IN' }),
    ])
    forest.addEventListener('click', () => this.startPark('forest-line'))

    const apex = el('button', { className: 'park-card available' }, [
      el('div', {}, [
        el('h3', { text: 'APEX' }),
        el('div', { className: 'park-meta', text: 'Pro grounds · precision ledges · spine' }),
        this.parkBestLine('apex'),
      ]),
      el('span', { className: 'drop-btn', text: 'DROP IN' }),
    ])
    apex.addEventListener('click', () => this.startPark('apex'))

    const bigAir = el('button', { className: 'park-card available' }, [
      el('div', {}, [
        el('h3', { text: 'BIG AIR' }),
        el('div', { className: 'park-meta', text: 'One mega gap · go huge' }),
        this.parkBestLine('big-air'),
      ]),
      el('span', { className: 'drop-btn', text: 'DROP IN' }),
    ])
    bigAir.addEventListener('click', () => this.startPark('big-air'))

    const channel = el('button', { className: 'park-card available' }, [
      el('div', {}, [
        el('h3', { text: 'CHANNEL' }),
        el('div', { className: 'park-meta', text: 'Street plaza · curbs · stairs · handrail' }),
        this.parkBestLine('channel'),
      ]),
      el('span', { className: 'drop-btn', text: 'DROP IN' }),
    ])
    channel.addEventListener('click', () => this.startPark('channel'))

    this.ui.append(
      el('div', { className: 'screen map-screen' }, [
        el('div', { className: 'map-header' }, [
          el('div', {}, [
            el('div', { className: 'score-label', text: 'Park map' }),
            el('h1', { className: 'map-title', text: 'Pick a park' }),
          ]),
          back,
        ]),
        el('div', { className: 'map-grid' }, [yard, forest, apex, bigAir, channel]),
      ]),
    )
  }

  private sheet(title: string, body: Node[], onClose: () => void): void {
    clear(this.ui)
    const close = el('button', { className: 'close-btn', text: '✕' })
    close.addEventListener('click', onClose)
    this.ui.append(
      el('div', { className: 'screen overlay-screen' }, [
        el('div', { className: 'sheet panel' }, [
          el('header', {}, [el('h1', { text: title }), close]),
          ...body,
        ]),
      ]),
    )
  }

  private showHowto(): void {
    this.screen = 'howto'
    this.sheet(
      'How to play',
      [
        el('div', { className: 'howto' }, [
          el('p', { text: 'First push to first flip. Start simple: roll the park, feel a few takeoffs, then add rotation.' }),
          el('ol', {}, [
            el('li', {
              text: 'Pick Solo, kit up in the Locker, press RIDE, choose any park (Yard, Forest, Apex, Big Air, Channel).',
            }),
            el('li', { text: 'Hold W to push, A/D to carve, S to brake.' }),
            el('li', { text: 'Hold Space to load an ollie, release to pop. Hubs and quarters can also launch you.' }),
            el('li', { text: 'In the air: A/D spin, W/S flip. Hold Space while spinning for board flips (kickflip / heelflip).' }),
            el('li', { text: 'Shift mute · Q tail · E Japan. Release before you land.' }),
            el('li', {
              text: 'Approach rails lined up with your board (not sideways). A/D swaps. Space pops off and keeps speed.',
            }),
            el('li', { text: 'Land flat for Clean. Sketchy keeps part of the line. Wild landings Bail and wipe the line.' }),
            el('li', { text: 'Cross the finish, check your score, watch the replay.' }),
            el('li', {
              text: 'Beat a park PB to unlock a cyan ghost — race it next run (HUD shows ahead/behind). Esc toggles or clears it.',
            }),
            el('li', { text: 'Hold R for 2 seconds to restart from the top. Mobile: on-screen pads include grabs.' }),
          ]),
        ]),
      ],
      () => this.showLobby(),
    )
  }

  private showControls(): void {
    this.screen = 'controls'
    this.sheet(
      'Controls',
      [
        el('table', { className: 'controls-table' }, [
          el('thead', {}, [
            el('tr', {}, [el('th', { text: 'Input' }), el('th', { text: 'Action' })]),
          ]),
          el('tbody', {}, [
            this.ctrl('W / S', 'Push · brake · flip in air'),
            this.ctrl('A / D', 'Carve · spin · grind swap'),
            this.ctrl('Space', 'Load / pop · hold in air for board flip'),
            this.ctrl('Shift', 'Mute grab'),
            this.ctrl('Q / E', 'Tail / Japan grab'),
            this.ctrl('R (hold 2s)', 'Restart run'),
            this.ctrl('Esc / P', 'Pause'),
            this.ctrl('Enter', 'Ride from lobby'),
          ]),
        ]),
        el('p', { className: 'muted', text: 'Controller remapping ships after the solo slice. Xbox / DualSense planned.' }),
      ],
      () => this.showLobby(),
    )
  }

  private ctrl(input: string, action: string): HTMLTableRowElement {
    return el('tr', {}, [
      el('td', {}, [el('code', { text: input })]),
      el('td', { text: action }),
    ])
  }

  private showAbout(): void {
    this.screen = 'about'
    this.sheet(
      'About Deck7',
      [
        el('div', { className: 'about' }, [
          el(
            'p',
            {
              text: 'Deck7 is a free browser skateboarding game: parks, named tricks, scoring lines, a locker, and local replays. Solo works with no account.',
            },
          ),
          el(
            'p',
            {
              text: 'The product shape is inspired by freeski browser games like Cork7 (lobby → park → line → score → replay), but every asset, park, trick set, and physics tune here is original. Deck7 is not affiliated with Cork7, Johansen & Co., SSX, EA, or Red Bull.',
            },
          ),
          el('p', { text: 'Multiplayer rooms, ranked 1v1s, season boards, and more parks are on the roadmap.' }),
        ]),
      ],
      () => this.showLobby(),
    )
  }

  private showLocker(): void {
    this.screen = 'locker'
    const sections: { title: string; key: keyof KitSelection; options: { id: string; label: string; color: string }[] }[] = [
      { title: 'Deck', key: 'deck', options: DECKS },
      { title: 'Shirt', key: 'shirt', options: SHIRTS },
      { title: 'Pants', key: 'pants', options: PANTS },
      { title: 'Shoes', key: 'shoes', options: SHOES },
      { title: 'Hat', key: 'hat', options: HATS },
    ]

    const findLabel = (opts: { id: string; label: string }[], id: string) =>
      opts.find((o) => o.id === id)?.label ?? id

    const body: Node[] = [
      el('p', { className: 'muted', text: 'Your kit shows on the rider in-run and in replays. Saved on this device.' }),
      el('div', { className: 'kit-summary' }, [
        el('div', { className: 'kit-summary-title', text: 'Current kit' }),
        el('div', { className: 'kit-summary-row', text: `Deck · ${findLabel(DECKS, this.kit.deck)}` }),
        el('div', { className: 'kit-summary-row', text: `Shirt · ${findLabel(SHIRTS, this.kit.shirt)}` }),
        el('div', { className: 'kit-summary-row', text: `Pants · ${findLabel(PANTS, this.kit.pants)}` }),
        el('div', { className: 'kit-summary-row', text: `Shoes · ${findLabel(SHOES, this.kit.shoes)}` }),
        el('div', { className: 'kit-summary-row', text: `Hat · ${findLabel(HATS, this.kit.hat)}` }),
      ]),
    ]

    for (const section of sections) {
      body.push(el('div', { className: 'section-label', text: section.title }))
      const grid = el('div', { className: 'kit-grid' })
      for (const opt of section.options) {
        const selected = this.kit[section.key] === opt.id
        const btn = el('button', { className: `kit-option${selected ? ' selected' : ''}` }, [
          el('div', { className: 'kit-swatch', style: `background:${opt.color === 'transparent' ? '#333' : opt.color}` }),
          el('div', { text: opt.label }),
        ])
        btn.addEventListener('click', () => {
          this.kit = { ...this.kit, [section.key]: opt.id }
          saveKit(this.kit)
          this.showLocker()
        })
        grid.append(btn)
      }
      body.push(grid)
    }

    this.sheet('Locker', body, () => this.showLobby())
  }

  private ensureHud(force = false): void {
    if (this.screen !== 'riding') return
    if (!force && this.ui.querySelector('.hud')) return
    clear(this.ui)
    this.ui.append(
      el('div', { className: 'hud' }, [
        el('div', { className: 'hud-top' }, [
          el('div', { className: 'hud-run-meta' }, [
            el('div', { className: 'score-label', text: this.parkLabel }),
            el('div', { className: 'hud-run-mode', text: 'Solo · Open session' }),
                el('div', { className: 'hud-phase-chip', id: 'hud-phase', text: 'GROUND' }),
            el('div', { className: 'hud-grind-chip hidden', id: 'hud-grind', text: 'GRIND' }),
            el('div', { className: 'hud-ghost-chip hidden', id: 'hud-ghost-chip', text: 'GHOST' }),
          ]),
          el('div', { className: 'score-block' }, [
            el('div', { className: 'score-label', text: 'Score' }),
            el('div', { className: 'score-value', id: 'hud-score', text: '0' }),
            el('div', { className: 'hud-line-inline hidden', id: 'hud-line-inline', text: 'Line 0' }),
            el('div', { className: 'hud-ghost-delta hidden', id: 'hud-ghost-delta', text: '' }),
          ]),
        ]),
        el('div', { className: 'trick-banner hidden', id: 'hud-banner' }, [
          el('div', { className: 'trick-combo', id: 'hud-combo', text: '' }),
          el('div', { className: 'trick-name', id: 'hud-trick', text: '' }),
          el('div', { className: 'trick-points', id: 'hud-trick-pts', text: '' }),
        ]),
        el('div', { className: 'combo-strip hidden', id: 'hud-combo-strip' }),
        el('div', { className: 'line-meter hidden', id: 'hud-line', text: 'LINE 0' }),
        el('div', { className: 'bail-flash hidden', id: 'hud-bail' }),
        el('div', { className: 'hud-bottom' }, [
          el('div', { className: 'speed-meter' }, [
            document.createTextNode('SPD'),
            el('strong', { id: 'hud-spd', text: '0' }),
          ]),
          el('div', { className: 'pop-meter', id: 'hud-pop-wrap' }, [
            el('span', { className: 'pop-label', text: 'POP' }),
            el('div', { className: 'pop-track' }, [el('div', { className: 'pop-fill', id: 'hud-pop' })]),
          ]),
          el('div', { className: 'hint-chip', text: 'Space pop · WASD air · Shift/Q/E grab · Hold R restart · Esc pause' }),
          el('div', { className: 'restart-meter hidden', id: 'hud-restart' }, [
            el('span', { text: 'RESTART' }),
            el('div', { className: 'restart-track' }, [el('div', { className: 'restart-fill', id: 'hud-restart-fill' })]),
          ]),
        ]),
      ]),
    )
    // Show touch pads on coarse pointers / narrow screens
    const wantTouch = window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
    if (wantTouch) {
      if (!this.touch.isMounted) this.touch.mount(this.ui)
    } else {
      this.touch.unmount()
    }
  }

  private lastBannerKey = ''
  private lastLandPunchKey = ''

  private tickHud(now: number): void {
    if (!this.skater) return
    const s = this.scoring.state
    const set = (id: string, text: string) => {
      const node = document.getElementById(id)
      if (node && node.textContent !== text) node.textContent = text
    }
    const phase = this.skater.phase.toUpperCase()
    set('hud-phase', phase)
    const phaseChip = document.getElementById('hud-phase')
    if (phaseChip) {
      phaseChip.dataset.phase = this.skater.phase
    }
    const grindChip = document.getElementById('hud-grind')
    if (grindChip) {
      const grinding = this.skater.phase === 'grind'
      grindChip.classList.toggle('hidden', !grinding)
      if (grinding) {
        const swaps = s.grindSwaps
        set('hud-grind', swaps > 0 ? `LOCKED · ${swaps} SWAP${swaps > 1 ? 'S' : ''}` : 'LOCKED · A/D SWAP')
      }
    }
    set('hud-score', String(s.total + s.linePoints))
    set('hud-spd', this.skater.speed.toFixed(0))

    if (s.lineCount > this.lastLineCountHud && s.lineCount >= 2) {
      this.toast(`Line x${s.lineCount}`)
      this.sfx.score()
      this.cameraFov = Math.min(66, this.cameraFov + 1.8)
    }
    this.lastLineCountHud = s.lineCount

    const showGhost =
      this.ghostEnabled && this.ghostRider && this.ghostFrames.length >= 8
    const ghostChip = document.getElementById('hud-ghost-chip')
    if (ghostChip) ghostChip.classList.toggle('hidden', !showGhost)
    const ghostDelta = document.getElementById('hud-ghost-delta')
    if (ghostDelta) {
      ghostDelta.classList.toggle('hidden', !showGhost)
      if (showGhost && this.ghostRider) {
        const dz = this.skater.position.z - this.ghostRider.group.position.z
        const ahead = dz >= 0
        const meters = Math.abs(dz).toFixed(0)
        const text = ahead ? `+${meters}m ahead` : `−${meters}m`
        if (ghostDelta.textContent !== text) ghostDelta.textContent = text
        ghostDelta.dataset.lead = ahead ? 'ahead' : 'behind'
      }
    }

    const popFill = document.getElementById('hud-pop')
    if (popFill) {
      const charge = this.skater.phase === 'ground' ? this.skater.popCharge : 0
      popFill.style.width = `${Math.round(charge * 100)}%`
      popFill.parentElement?.parentElement?.classList.toggle('armed', charge > 0.05)
    }
    const restartFill = document.getElementById('hud-restart-fill')
    const restartWrap = document.getElementById('hud-restart')
    if (restartFill && restartWrap) {
      const prog = this.input.restartProgress(now)
      restartWrap.classList.toggle('hidden', prog <= 0)
      restartFill.style.width = `${Math.round(prog * 100)}%`
    }

    const banner = document.getElementById('hud-banner')
    if (banner) {
      const show = Boolean(s.banner && now < s.bannerUntil)
      banner.classList.toggle('hidden', !show)
      if (show) {
        const key = `${s.banner}|${s.bannerPoints}|${s.bannerUntil}`
        if (key !== this.lastBannerKey) {
          this.lastBannerKey = key
          banner.classList.remove('trick-pop')
          void banner.offsetWidth
          banner.classList.add('trick-pop')
          if (key !== this.lastLandPunchKey) {
            this.lastLandPunchKey = key
            if (s.banner.includes('Perfect')) {
              this.cameraFov = Math.min(68, this.cameraFov + 4.5)
              this.toast('Perfect')
              this.sfx.perfect()
            } else if (s.banner.includes('Sketchy')) {
              this.toast('Sketchy — line cut')
            } else if (s.bannerCategory === 'bail' || s.banner === 'Bailed') {
              this.toast('Bail')
            } else if (s.bannerPoints > 0) {
              this.sfx.score()
            }
          }
        }
        const combo =
          s.lineCount > 1 ? `x${s.lineCount} LINE` : s.lineCount === 1 ? 'LINE OPEN' : ''
        set('hud-combo', combo)
        set('hud-trick', s.banner)
        set('hud-trick-pts', s.bannerPoints ? `+${s.bannerPoints}` : '')
        banner.dataset.cat = s.bannerCategory || ''
      } else {
        this.lastBannerKey = ''
        banner.dataset.cat = ''
      }
    }
    const strip = document.getElementById('hud-combo-strip')
    if (strip) {
      const beats = s.recentBeats
      strip.classList.toggle('hidden', beats.length === 0)
      if (beats.length > 0) {
        const text = beats
          .slice(-4)
          .map((b) => b.name)
          .join(' → ')
        if (strip.textContent !== text) strip.textContent = text
      }
    }

    const lineText = s.lineCount > 1 ? `LINE ${s.linePoints} · x${s.lineCount}` : `LINE ${s.linePoints}`
    const line = document.getElementById('hud-line')
    if (line) {
      line.classList.toggle('hidden', s.linePoints <= 0)
      if (s.linePoints > 0) set('hud-line', lineText)
    }
    const lineInline = document.getElementById('hud-line-inline')
    if (lineInline) {
      lineInline.classList.toggle('hidden', s.linePoints <= 0)
      if (s.linePoints > 0) set('hud-line-inline', lineText)
    }
    const bail = document.getElementById('hud-bail')
    if (bail) {
      const bailing = this.skater.phase === 'bail'
      if (bailing && bail.classList.contains('hidden')) {
        bail.classList.remove('hidden')
        bail.classList.remove('bail-flash')
        void bail.offsetWidth
        bail.classList.add('bail-flash')
      }
      if (!bailing) bail.classList.add('hidden')
    }
  }

  private renderPause(): void {
    clear(this.ui)
    const resume = el('button', { className: 'btn primary', text: 'Resume' })
    resume.addEventListener('click', () => {
      this.screen = 'riding'
      this.ensureHud(true)
      this.tickHud(performance.now())
    })
    const restart = el('button', { className: 'btn', text: 'Restart' })
    restart.addEventListener('click', () => this.restartRun())
    const mute = el('button', {
      className: 'btn',
      text: this.sfx.muted ? 'SFX · Off' : 'SFX · On',
    })
    mute.addEventListener('click', () => {
      this.sfx.toggleMute()
      this.renderPause()
    })
    const music = el('button', {
      className: 'btn',
      text: this.sfx.musicOn ? 'Music · On' : 'Music · Off',
    })
    music.addEventListener('click', () => {
      this.sfx.toggleMusic()
      this.renderPause()
    })
    const hasGhost = loadGhostFrames(this.parkId).length >= 8
    const ghostBtn = el('button', {
      className: 'btn',
      text: !hasGhost
        ? 'Ghost · None yet'
        : this.ghostEnabled
          ? 'Ghost · On'
          : 'Ghost · Off',
    })
    ghostBtn.addEventListener('click', () => {
      if (!hasGhost) {
        this.toast('Set a PB to unlock a ghost')
        return
      }
      this.ghostEnabled = !this.ghostEnabled
      saveSettings({ ghostEnabled: this.ghostEnabled })
      this.setupGhost()
      this.renderPause()
    })
    const clearPb = el('button', {
      className: 'btn',
      text: hasGhost ? 'Clear PB / ghost' : 'No PB to clear',
    })
    clearPb.addEventListener('click', () => {
      if (!hasGhost && loadBestScore(this.parkId) <= 0) {
        this.toast('Nothing to clear on this park')
        return
      }
      clearParkRecord(this.parkId)
      this.setupGhost()
      this.toast('Personal best cleared for this park')
      this.renderPause()
    })
    const leave = el('button', { className: 'btn', text: 'Leave to Basecamp' })
    leave.addEventListener('click', () => this.showLobby())
    this.ui.append(
      el('div', { className: 'screen overlay-screen' }, [
        el('div', { className: 'sheet panel' }, [
          el('header', {}, [el('h1', { text: 'Paused' })]),
          el('div', { className: 'action-row' }, [
            resume,
            restart,
            mute,
            music,
            ghostBtn,
            clearPb,
            leave,
          ]),
        ]),
      ]),
    )
  }

  private renderResults(): void {
    const b = this.lastBreakdown!
    const best = loadBestScore(this.parkId)
    const isNewBest = b.total >= best && b.total > 0
    const vsPrev =
      this.previousBest > 0 ? b.total - this.previousBest : b.total > 0 ? b.total : 0
    clear(this.ui)

    const again = el('button', { className: 'btn primary', text: 'Ride again' })
    again.addEventListener('click', () => this.startPark(this.parkId))
    const replay = el('button', { className: 'btn', text: 'Watch replay' })
    replay.addEventListener('click', () => this.startReplay())
    const save = el('button', { className: 'btn', text: 'Save replay' })
    save.addEventListener('click', () => {
      saveReplay({
        id: `run-${Date.now()}`,
        parkId: this.parkId,
        score: b,
        savedAt: Date.now(),
        frames: this.replayFrames,
      })
      this.toast('Replay saved on this device')
    })
    const lobby = el('button', { className: 'btn', text: 'Basecamp' })
    lobby.addEventListener('click', () => this.showLobby())

    this.ui.append(
      el('div', { className: 'screen overlay-screen' }, [
        el('div', { className: 'sheet panel results-sheet' }, [
          el('header', {}, [
            el('div', {}, [
              el('div', { className: 'score-label', text: `${this.parkLabel} · Solo` }),
              el('h1', { text: isNewBest ? 'New personal best' : 'Run complete' }),
            ]),
          ]),
          el('div', { className: 'results-grid' }, [
            el('div', { className: 'results-total' }, [
              el('div', { className: 'score-label', text: isNewBest ? 'Personal best' : 'Total' }),
              el('div', { className: `big-score${isNewBest ? ' is-best' : ''}`, text: String(b.total) }),
              el(
                'p',
                {
                  className: 'muted',
                  text: isNewBest
                    ? `PB ghost unlocked${vsPrev > 0 ? ` (+${vsPrev})` : ''} — race the cyan rider next run.`
                    : this.previousBest > 0
                      ? `Best ${best} · this run ${vsPrev >= 0 ? '+' : ''}${vsPrev}`
                      : 'Land a scored line to set a personal best.',
                },
              ),
            ]),
            el('div', { className: 'stat-rows' }, [
              this.stat('Tricks', b.tricks),
              this.stat('Grabs', b.grabs),
              this.stat('Rails', b.rails),
              this.stat('Landings', b.landings),
            ]),
          ]),
          this.lastBeats.length
            ? el('div', { className: 'results-beats' }, [
                el('div', { className: 'score-label', text: 'Line highlights' }),
                ...this.lastBeats.map((beat) =>
                  el('div', { className: 'stat-row', text: `${beat.name}  +${beat.points}` }),
                ),
              ])
            : el('div', {}),
          el('div', { className: 'action-row' }, [again, replay, save, lobby]),
        ]),
      ]),
    )
  }

  private stat(label: string, value: number): HTMLElement {
    return el('div', { className: 'stat-row' }, [
      el('span', { text: label }),
      el('span', { text: String(value) }),
    ])
  }

  private startReplay(): void {
    if (!this.skater || this.replayFrames.length === 0) {
      this.toast('No replay frames captured')
      return
    }
    this.screen = 'replay'
    this.replayIndex = 0
    this.replayPlaying = true
    this.replayCamera = 'chase'
    this.renderReplayBar()
  }

  private renderReplayBar(): void {
    clear(this.ui)
    const total = Math.max(1, this.replayFrames.length - 1)
    const play = el('button', { className: 'btn', text: this.replayPlaying ? 'Pause' : 'Play' })
    play.addEventListener('click', () => {
      this.replayPlaying = !this.replayPlaying
      this.renderReplayBar()
    })
    const cam = el('button', { className: 'btn', text: `Cam · ${this.replayCamera}` })
    cam.addEventListener('click', () => {
      this.replayCamera = this.replayCamera === 'chase' ? 'orbit' : 'chase'
      this.renderReplayBar()
    })
    const back = el('button', { className: 'btn primary', text: 'Results' })
    back.addEventListener('click', () => {
      this.screen = 'results'
      this.renderResults()
    })
    const scrub = el('input', {
      className: 'replay-scrub',
      type: 'range',
      min: '0',
      max: String(total),
      value: String(Math.floor(this.replayIndex)),
      step: '1',
    }) as HTMLInputElement
    scrub.addEventListener('input', () => {
      this.replayPlaying = false
      this.replayIndex = Number(scrub.value)
      if (this.skater && this.replayFrames[this.replayIndex]) {
        this.skater.applyReplayFrame(this.replayFrames[this.replayIndex])
      }
      const label = document.getElementById('replay-time')
      if (label) label.textContent = `${Math.floor(this.replayIndex)} / ${total}`
    })
    this.ui.append(
      el('div', { className: 'hud' }, [
        el('div', { className: 'hud-top' }, [
          el('div', { className: 'score-label', text: 'Replay' }),
          el('div', {
            className: 'score-label',
            id: 'replay-time',
            text: `${Math.floor(this.replayIndex)} / ${total}`,
          }),
        ]),
        el('div', { className: 'replay-bar' }, [play, scrub, cam, back]),
      ]),
    )
  }

  private toast(message: string): void {
    this.ui.querySelector('.toast')?.remove()
    this.ui.append(el('div', { className: 'toast', text: message }))
    this.toastTimer = 2200
  }
}
