# Deck7 overnight backlog

Night 2 physics complete (6/6). Next session: playtest-driven P1s only.

- P1 | eng | Re-check grounded push/steer after playtest; nudge if still sluggish | `src/game/physics/SkaterController.ts`
- P1 | eng | Space ollie: re-check tap/hold curve after playtest | `src/game/physics/SkaterController.ts` `src/game/Input.ts`
- P1 | eng | Air spin/landing: re-check after playtest | `src/game/physics/SkaterController.ts`
- P1 | eng | Rail magnet: re-check after playtest | `src/game/physics/SkaterController.ts`
- P1 | eng | Ramp launch: re-check hub/quarter after playtest | `src/game/park/TheYard.ts`

Night 2 shipped:
- Hotfix: A/D invert, Space ollie consume, push/min roll
- Snappier carve/push
- Ollie tap/hold curve
- Faster air spins + forgiveness
- Rail magnet + grind pop-off
- Hub/quarter launch reliability
- Landing speed bleed with min roll
