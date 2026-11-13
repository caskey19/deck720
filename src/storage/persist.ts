export type KitSelection = {
  deck: string
  shirt: string
  pants: string
  shoes: string
  hat: string
}

export type ScoreBreakdown = {
  tricks: number
  grabs: number
  rails: number
  landings: number
  total: number
}

export type SavedReplayMeta = {
  id: string
  parkId: string
  score: ScoreBreakdown
  savedAt: number
  frames: ReplayFrame[]
}

export type ReplayFrame = {
  t: number
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  roll: number
  boardSpin: number
  velocity?: { x: number; y: number; z: number }
  pose?: { crouch: number; lean: number; armsOut: number; push: number; grab?: 'mute' | 'tail' | 'japan' }
  state: string
}

const KIT_KEY = 'deck7.kit'
const BEST_KEY = 'deck7.best'
const REPLAY_KEY = 'deck7.replays'
const GHOST_KEY = 'deck7.ghost'
const SETTINGS_KEY = 'deck7.settings'
const SESSION_KEY = 'deck7.session'

// Keep old records intact, but never race a ghost from the retired 104m Yard.
function courseKey(parkId: string): string {
  if(parkId.endsWith('.grounded-v1'))return parkId
  const course=parkId==='the-yard'?'the-yard.courtyard-v2':parkId
  return `${course}.grounded-v1`
}

export type DeckSettings = {
  ghostEnabled: boolean
}

export type SessionStats = {
  runs: number
  bestThisSession: number
}

const DEFAULT_SETTINGS: DeckSettings = {
  ghostEnabled: true,
}

export function loadSettings(): DeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(partial: Partial<DeckSettings>): void {
  const next = { ...loadSettings(), ...partial }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
}

export const DEFAULT_KIT: KitSelection = {
  deck: 'ember',
  shirt: 'navy',
  pants: 'wash',
  shoes: 'black',
  hat: 'helmet',
}

export function loadKit(): KitSelection {
  try {
    const raw = localStorage.getItem(KIT_KEY)
    if (!raw) return { ...DEFAULT_KIT }
    return { ...DEFAULT_KIT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_KIT }
  }
}

export function saveKit(kit: KitSelection): void {
  localStorage.setItem(KIT_KEY, JSON.stringify(kit))
}

export function loadBestScore(parkId: string): number {
  parkId = courseKey(parkId)
  try {
    const raw = localStorage.getItem(BEST_KEY)
    if (!raw) return 0
    const map = JSON.parse(raw) as Record<string, number>
    return map[parkId] ?? 0
  } catch {
    return 0
  }
}

export function saveBestScore(parkId: string, score: number): void {
  parkId = courseKey(parkId)
  try {
    const raw = localStorage.getItem(BEST_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    if ((map[parkId] ?? 0) < score) {
      map[parkId] = score
      localStorage.setItem(BEST_KEY, JSON.stringify(map))
    }
  } catch {
    /* ignore */
  }
}

export function loadReplays(): SavedReplayMeta[] {
  try {
    const raw = localStorage.getItem(REPLAY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedReplayMeta[]
  } catch {
    return []
  }
}

export function saveReplay(replay: SavedReplayMeta): void {
  const list = loadReplays().filter((r) => r.id !== replay.id)
  list.unshift(replay)
  // Keep latest 5 + favorites capped at 8 total frames can be large
  const trimmed = list.slice(0, 5)
  try {
    localStorage.setItem(REPLAY_KEY, JSON.stringify(trimmed))
  } catch {
    // If too large, drop oldest frames
    localStorage.setItem(REPLAY_KEY, JSON.stringify(trimmed.slice(0, 2)))
  }
}

/** Sparse ghost frames for PB race (keep short to fit localStorage). */
export function loadGhostFrames(parkId: string): ReplayFrame[] {
  parkId = courseKey(parkId)
  try {
    const raw = localStorage.getItem(GHOST_KEY)
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, ReplayFrame[]>
    return map[parkId] ?? []
  } catch {
    return []
  }
}

export function saveGhostFrames(parkId: string, frames: ReplayFrame[], score: number): void {
  parkId = courseKey(parkId)
  try {
    const best = loadBestScore(parkId)
    // Only store when this score is the current best (caller saves score first)
    if (score < best) return
    const sparse =
      frames.length <= 180
        ? frames
        : frames.filter((_, i) => i % Math.ceil(frames.length / 180) === 0).slice(0, 180)
    const raw = localStorage.getItem(GHOST_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, ReplayFrame[]>) : {}
    map[parkId] = sparse
    localStorage.setItem(GHOST_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

export function loadSessionStats(): SessionStats {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { runs: 0, bestThisSession: 0 }
    return { runs: 0, bestThisSession: 0, ...JSON.parse(raw) }
  } catch {
    return { runs: 0, bestThisSession: 0 }
  }
}

export function noteSessionRun(score: number): SessionStats {
  const cur = loadSessionStats()
  const next: SessionStats = {
    runs: cur.runs + 1,
    bestThisSession: Math.max(cur.bestThisSession, score),
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearParkRecord(parkId: string): void {
  parkId = courseKey(parkId)
  try {
    const bestRaw = localStorage.getItem(BEST_KEY)
    if (bestRaw) {
      const map = JSON.parse(bestRaw) as Record<string, number>
      delete map[parkId]
      localStorage.setItem(BEST_KEY, JSON.stringify(map))
    }
  } catch {
    /* ignore */
  }
  try {
    const ghostRaw = localStorage.getItem(GHOST_KEY)
    if (ghostRaw) {
      const map = JSON.parse(ghostRaw) as Record<string, ReplayFrame[]>
      delete map[parkId]
      localStorage.setItem(GHOST_KEY, JSON.stringify(map))
    }
  } catch {
    /* ignore */
  }
}
