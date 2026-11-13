# Deck7 current handoff

Repository: https://github.com/caskey19/deck720
Branch: main
Source archive: deck7-game-20261113-025247.zip, originally 38c658a8e2a55ba8948060d120a19965b70af5fd. The archive had no Git history.

## Current scope

User authorized continued repository work without a live server and allowed a full Yard redesign. Style is believable materials with original stylized geometry. No third-party game assets, branding, frameworks or physics engines were added. Browser deployment and manual playtesting are deferred.

## Shipped visual work

- Shared seeded 256px asphalt, concrete, wood, steel, brick, paint and rubber maps, with consistent 2m projected UVs on static geometry.
- Filmic output, distinct park moods, gradient sky and soft procedural cloud banks. The local sun shadow volume follows the rider with fixed light direction through long courses.
- Yard rebuilt as a 170m industrial courtyard: detailed warehouse bays, tree wells, window bands, original sign, water tower, bunting, benches, lane markings, smooth quarter transition, continuous kickers, optional side lines and a clear center approach.
- Forest Line has 96 instanced conifers, rock clusters, hills, boardwalks and a timber shelter. Invisible pad tops now have matching geometry.
- Apex has terraced spectator seating, a finish frame and timber pavilion. Big Air has quarry terraces, ridgeline, rock faces and overlook decks. Channel has a canal, promenade, storefronts, awnings, trees and a distant footbridge.
- Block launches replaced by continuous sampled transitions. Playable-area benches, bollards, planters and lamps register collision boxes. Channel stairs have individual rideable treads and an actual landing deck.
- Rounded rider body, separate two-segment legs with solved ankle placement, clothing volume, hair, simple face, distinct hats, shaped deck, trucks, wheels, grip grain, original color-matched D7 underside graphics and shoe soles.
- Shoes remain independent of board flips, lift slightly in air, and trace a pushing stroke at low speed. Knee bends keep ankles attached through crouch and lean. Hoodie sleeves and hood vary with kit.
- Locker now has a 3D turntable, drag/keyboard rotation and deck inspection. Kit changes reuse the preview and preserve scroll. The extra renderer is disposed on leaving the locker. Swatches remain available if an additional WebGL context fails.
- New replay frames retain crouch, grab, lean, push and travel velocity. Ghost poses interpolate those fields. Legacy replays remain readable; their travel direction is derived from neighboring positions. Charge pitch is recorded from the drawn rider orientation.
- Wider/higher chase framing retains the original ground/air travel-yaw policy.
- Static meshes batch by material and shadow policy. Scene geometry, local textures, light shadow maps and instanced mesh resources are disposed on park switches. Cached shared surface resources persist.

## Persistence and compatibility

The redesigned Yard uses a new PB/ghost course key. Old Yard records remain stored but do not race against the new course. Other park record IDs remain unchanged. Old manually saved Yard replay trajectories remain stored and are not migrated; those recordings can mismatch the redesigned scenery.

## Verification

Node 24+. `npm install`, `npm run build`, `npm run verify`.

The build and CPU regression suite pass. Tests cover all five center-line finishes, idle stop, finite geometry/UVs, static batch budgets, nine raycasts on every declared pad, all cosmetic options, knee/ankle alignment, independent feet during board flips, ground contact, new/legacy replay poses and velocity, versioned records and moving shadow coverage at spawn/mid-course/finish.

| Park | Batched meshes | Triangles including instances |
| --- | ---: | ---: |
| The Yard | 42 | 12,472 |
| Forest Line | 25 | 11,444 |
| Apex | 27 | 5,566 |
| Big Air | 25 | 3,824 |
| Channel | 43 | 6,700 |

These are geometry counts, not measured gameplay FPS or total shadow draw calls.

## Offline visual review

Actual source meshes, rider and procedural texture pixels were exported and rendered through EGL/Mesa. The procedural sky code also compiles in this offline renderer, with color-output handling adapted for desktop GLSL. Reviewed the six-view contact sheet: all five parks and a close rider pose. Lighting/PBR are approximate and do not certify Three.js WebGL rendering, input behavior, frame rate or animated game feel.

See `docs/review/README.md` and `scripts/offline/README.md`. Optional review dependencies are not shipped with the game.

## Browser review tomorrow

`npm run dev` uses http://127.0.0.1:3847/. `/qa.html` renders five parks and a rider view with kit cycling and shader diagnostics. No saved game data is touched. It updates at 15Hz and is not a benchmark. Actual game review should check the following:

1. Sky/cloud compilation, material brightness, mesh normals and shadow stability.
2. Grounded, crouched, pushing, airborne, grab and grind silhouettes.
3. Ramp clearance, ledge edges, Channel stairs and grind catches.
4. Locker turntable, outfit changes, deck art and mobile scroll.
5. Full runs, results, replay scrubbing and cyan PB ghosts on each park.
6. Real frame rate on laptop and mobile.

The connected browser's localhost served the original user copy rather than this workspace. An inline preview was blocked by browser URL policy; do not bypass that restriction through another browser surface. Offline geometry rendering uses no browser or network.

## GitHub and hosting

Remote main advanced independently with user-added Jekyll Pages workflow fe6920f0f0565b09a76db075a5f4e9a1b7a87943. That exact workflow is preserved. Reconciled delivery commit 43e23c9c4d220bc2f6bec85a5dc430b660cb257e includes the previously held lighting pass. Subsequent deliveries build on the current head and preserve the workflow.

The Jekyll workflow is not a Vite build workflow. Hosting remains outside this pass by user instruction. No hosting setup, public exposure, paid service or unattended worker was created.

## Remaining limits

The game remains an original low-poly arcade skate game. The world has richer materials and authored settings, but no claim is made that it reaches a finished commercial game's visual quality. Broad course-scale terrain, detailed rider animation blending, richer grab transition blending, more route variety and course-aware legacy replay handling remain possible future work. Manual GPU playtesting is still required. The shared Three.js production chunk still produces Vite's size warning, around 626 KB raw / 161 KB gzip.

## Preserve

Spawn stays stationary until W is pushed. Keep snappy carve/charge and travel-yaw decoupling in air. No auth, multiplayer rewrite, framework swap or copied assets. No physics tuning is needed without a playtest finding.


## Current pass: articulated grabs and optional Yard flow

Rigid arms replaced by fixed-length upper arms and forearms with connected shoulder/elbow/hand anchors. Mute reaches the side of the board, tail grab reaches the tail with a backward torso tuck, and Japan reaches across to the front edge. The other hand balances outward. Sleeve geometry follows the arm; hoodie materials cover the forearm. Visual grab weight eases in and out, and new replay/ghost poses retain the named grab. Old unnamed grab poses use the mute fallback.

Board/feet tuck toward the body during airborne grabs. Landing knees compress briefly and recover. These are rendering poses only; motion, collision, gravity, scores and input bindings are unchanged. CPU tests verify hand-to-board contact within 25mm for all three full poses, fixed arm length, connected elbows, replay grab identity and landing compression.

The Yard now has a left transfer at z=75 feeding a low landing and flatbar at z=95, plus a diagonal rising rail from the right line toward the finish approach. Geometry and grind contract are generated from the same 3D endpoints. Painted arrows show the optional entries. The finish apron and checker line span the full playable width so the side route crosses a visible finish too. A simulated left-line run launches, catches its flatbar and lands; all five center lines remain finishable.

Refreshed offline contact sheet and added docs/review/grabs-strip.png. These remain approximate offline illumination rather than browser gameplay captures. Manual visual/input/performance checks remain pending. Build and full verification suite pass.
