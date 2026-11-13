# Deck7 handoff

## Current delivery

Repository: https://github.com/caskey19/deck720
Delivery branch: main
First shipped commit: 67da1bfafc176e2903cf7dd4933c04460e2da059
Source archive: deck7-game-20261113-025247.zip, source commit 38c658a8e2a55ba8948060d120a19965b70af5fd. Archive had no Git history.

## Visual pass 1

Shared seeded 256px procedural asphalt, concrete, steel, timber, paint and brick surfaces. Gradient sky across all parks. Filmic tone mapping, warmer sunlight, hemisphere fill and expanded shadow coverage.

Rider now has rounded clothing, separate capsule legs, hood, sleeves, rounded head and cap brim, shaped deck, grip, trucks, wheels and shoe soles. Kit IDs and pose API preserved. Ghost traversal still applies to every mesh.

The Yard rebuilt as a 170m industrial courtyard. Warehouse bays, window bands, pilasters, trees, water tower, original painted sign, benches, paving and lane markings. Continuous quarter transition, clear hub approach, optional late kicker, three rail areas and exact flat pad bounds. Other parks receive shared materials and gradient skies.

Camera slightly wider and higher; travel yaw logic unchanged. Physics and scoring unchanged in this pass.

## Verification

npm run build passes. npm run verify exercises all park geometry, finite transforms, stationary spawn, push motion, Yard center-line ramp launch and finish, rider kit and pose.

CPU simulation now reaches the finish on every park. Confirmed rear approach blockers in Apex, Big Air and Channel were removed, with launch detection starting at their approach faces. The controller itself is unchanged.

GPU rendering and manual playtest of this edited copy remain unverified. The connected browser localhost is the user's original copy, not the isolated edited workspace. Do not call baseline screenshots proof of this pass. Check sky shader compilation, chase framing, kit visibility, real frame rate, grinds, replays and ghost in a GPU browser.

## Visual pass 2

Static scenery is merged by shared material and shadow policy. Yard mesh count drops from 457 to 37 with the same 11,286 triangles. Other parks range from 14 to 24 meshes. These are geometry counts, not measured FPS or total shadow draw calls.

Surface UVs are projected at a consistent 2m world scale. Beanie, cap and bucket now have different silhouettes. Board offset corrected so wheel bottoms match controller ground contact. Floating shadow blob removed in favor of real shadows. Ghost materials and scene resources are disposed once, while cached park materials persist.

Yard best scores and ghosts now use a course version key. Old Yard records remain stored, but are not used for the new course. Old manually saved replay archives remain stored and are not migrated; replaying those against the redesigned world may mismatch scenery.

Run npm run verify on Node 24+. It checks all center-line finishes, idle stop, finite geometry and UVs, static batch budget, every cosmetic option, finite poses, ground contact and record versioning.

## Browser review

Run npm run dev and open http://127.0.0.1:3847/qa.html. This isolated review page renders all five parks and a rider kit/contact view. Change kit cycles cosmetics. It reports shader failures and renderer call counts without touching saved game data. It is also included in production builds. Six review renderers update at 15Hz; this is not a gameplay FPS benchmark.

## Remaining gaps

Manual GPU validation is the next gate, not more speculative art edits. Check the actual revised chase frame, material brightness, sky shader, ramp clearance, quarter silhouette, grind contact, locker colors, ghost transparency, replay and mobile input. Browser policy rejected an inline isolated preview; do not try alternate surfaces to bypass that restriction. The available browser's localhost serves the user's original source, so it cannot validate this workspace until the new repo is run there.

Forest Line, Apex, Big Air and Channel still have their original sparse layouts. Their materials and sky improved, but their density does not yet match Yard. A genuine animated push cycle, bent knee rig, detailed deck graphics and course-aware legacy replay handling are future work. The build still reports a large shared Three.js chunk (about 613 KB raw, 156 KB gzip); no external texture packs were added.

## Commands

Node 24 or newer. npm install; npm run dev. Open http://127.0.0.1:3847/. npm run build; npm run verify.

## Controls

W push, S brake, A/D carve, Space charged ollie, Shift/Q/E grabs. Esc pause, hold R restart. Spawn stays stopped until pushed. Preserve travel yaw in air. No third-party assets.
