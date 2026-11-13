# Deck7 handoff

## Current delivery

Repository: https://github.com/caskey19/deck720
Delivery branch: main
Source archive: deck7-game-20261113-025247.zip, source commit 38c658a8e2a55ba8948060d120a19965b70af5fd. Archive had no Git history.

## Visual pass 1

Shared seeded 256px procedural asphalt, concrete, steel, timber, paint and brick surfaces. Gradient sky across all parks. Filmic tone mapping, warmer sunlight, hemisphere fill and expanded shadow coverage.

Rider now has rounded clothing, separate capsule legs, hood, sleeves, rounded head and cap brim, shaped deck, grip, trucks, wheels and shoe soles. Kit IDs and pose API preserved. Ghost traversal still applies to every mesh.

The Yard rebuilt as a 170m industrial courtyard. Warehouse bays, window bands, pilasters, trees, water tower, original painted sign, benches, paving and lane markings. Continuous quarter transition, clear hub approach, optional late kicker, three rail areas and exact flat pad bounds. Other parks receive shared materials and gradient skies.

Camera slightly wider and higher; travel yaw logic unchanged. Physics and scoring unchanged in this pass.

## Verification

npm run build passes. npm run verify exercises all park geometry, finite transforms, stationary spawn, push motion, Yard center-line ramp launch and finish, rider kit and pose.

CPU simulation reaches finish on Yard and Forest Line. Existing rear approach blockers stop straight-line motion in Apex, Big Air and Channel; investigate next. This does not establish those parks are impossible with steering or ollies.

GPU rendering and manual playtest of this edited copy remain unverified. The connected browser localhost is the user's original copy, not the isolated edited workspace. Do not call baseline screenshots proof of this pass. Check sky shader compilation, chase framing, kit visibility, real frame rate, grinds, replays and ghost in a GPU browser.

## Next pass

Batch static scenery to lower draw calls. Fix confirmed rear approach blockers in remaining parks. Add regression checks for all five center-line finishes. Audit disposal and ghost shared materials. Improve different hat silhouettes and board graphic visibility.

## Commands

Node 24 or newer. npm install; npm run dev. Open http://127.0.0.1:3847/. npm run build; npm run verify.

## Controls

W push, S brake, A/D carve, Space charged ollie, Shift/Q/E grabs. Esc pause, hold R restart. Spawn stays stopped until pushed. Preserve travel yaw in air. No third-party assets.
