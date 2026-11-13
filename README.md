# Deck7

Free browser skateboarding game — drop into a park, string flips and grinds into a scored line, kit your rider in the Locker, and watch local replays.

Inspired by the product shape of freeski browser games like Cork7 (lobby → park → line → score → replay), but **100% original**: art, parks, tricks, and physics. Not affiliated with Cork7, Johansen & Co., SSX, EA, or Red Bull.

## Run locally

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3847/** (Vite binds port `3847`).

## How to play

1. **Solo** is selected in Basecamp — press **RIDE** / Enter.
2. Pick a park: **The Yard**, **Forest Line**, **Apex**, **Big Air**, or **Channel**.
3. **W** push · **S** brake · **A/D** carve · **Space** ollie (hold to load, release to pop). Stay still until you push — no auto-roll.
4. In the air: **A/D** spin · **W/S** flip · hold **Space** while spinning for board flips · **Shift** mute · **Q** tail · **E** Japan.
5. Approach rails lined up to grind; **A/D** swaps; **Space** pops off.
6. Cross the finish for the score breakdown. Hold **R** for 2s to restart. **Esc** pauses (SFX, music, ghost toggle, clear PB).
7. Beat a park’s personal best to unlock a **cyan PB ghost** — race it next run (ahead/behind HUD). Mobile: on-screen pads including grabs.

## What’s in this slice

- Basecamp lobby (Solo live · Multiplayer / Season / Leaderboard stubbed)
- Five parks: Yard, Forest Line, Apex, Big Air, Channel
- Arcade skate physics, named tricks, combo HUD, local replays with scrubber
- PB ghost race (localStorage), touch controls, RideFx juice
- Locker cosmetics (deck, shirt, pants, shoes, hat) saved in `localStorage`
- Live Codex handoff at `docs/codex-handoff.md`

## Stack

Vite · TypeScript · Three.js

## Build

```bash
npm run build
npm run preview
```

## Visual production pass

The Yard is now a 170m industrial courtyard with warehouses, tree wells, detailed street ledges, rails, a smooth quarter transition and an optional late kicker. Shared original procedural materials and gradient skies are used across all five parks. The rider has rounded clothing, separate legs, a shaped deck and kit variations.

Use Node 24 or newer. Run `npm run verify` for CPU geometry, controller, cosmetic and persistence regression checks. Open `/qa.html` while the development server is running for a six-view browser review with kit cycling and shader diagnostics. This review page does not alter saved records.

The redesigned Yard uses a new PB/ghost course version; old records remain stored. Manual GPU playtesting of this pass is still required. See `docs/codex-handoff.md` for validation limits and remaining art work.
