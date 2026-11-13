# Offline source geometry review

![Offline park geometry contact sheet](offline-contact-sheet.jpg)

These views use the actual park meshes, rider geometry and original procedural texture pixels. They use approximate offline illumination and shadow rendering. They are not browser gameplay captures and do not establish actual frame rate, WebGL shader correctness or animated game feel.

The contact sheet covers Apex, Big Air, Channel, Forest Line and The Yard at the same chase-like view, plus a close rider pose. Reproduction instructions are in `scripts/offline/README.md`.


## Articulated grab poses

![Japan, mute and tail pose review](grabs-strip.png)

These use the current Rider solver and original outfit geometry. Full poses are also checked for board contact and connected, fixed-length elbow segments. Lighting remains an offline approximation.
