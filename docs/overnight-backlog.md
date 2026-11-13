# Deck7 remaining review

Current repository work does not require a published server. All five parks have authored scenic settings; rider, materials, camera, collision alignment, replay poses and locker preview have received production passes.

Completed checks: build; five center-line finishes; stationary spawn; nine visual pad samples per pad; rider kit/pose/contact; legacy and new replay data; shadow coverage; offline source-geometry review.

Next meaningful checks on a real browser:

1. Visually inspect actual gameplay, shader compilation and material exposure.
2. Measure real frame rate, particularly mobile, shadows and the locker renderer.
3. Manually ride alternate ledge/rail paths and the Channel stairs.
4. Check crouch, push, grabs, board flips, replay scrubbing and ghost consistency.
5. Confirm locker drag/keyboard controls and mobile scrolling.

Further art possibilities: hand-to-board grab IK, richer upper-body animation, irregular non-linear routes, more detailed neighborhood variation and migrated legacy replay courses. Do not substitute additional menu stubs or toast effects for these checks.

Hosting is deferred. The user-added Jekyll workflow is preserved but does not build Vite.
