# Optional offline geometry review

This tool exports the actual park/rider geometry and procedural canvas textures, then renders an approximation with ModernGL/EGL. It does not launch a browser, publish a server, or reproduce Three.js PBR exactly. Its images are for inspecting layout, silhouette, material coverage and gross framing. Browser shader behavior, input, performance and camera motion still require gameplay testing.

Requirements: Node 24+, a Node `@napi-rs/canvas` module, Python with `moderngl`, `numpy` and `Pillow`, and an EGL-capable renderer (Mesa llvmpipe works). These are optional review dependencies, not dependencies of the game.

Set `DECK7_CANVAS_MODULE` to the absolute `@napi-rs/canvas/index.js` path when it is not supplied by the runtime. From the project root:

```sh
node scripts/offline/export.mjs /tmp/deck7-scenes
python scripts/offline/render.py /tmp/deck7-scenes /tmp/deck7-review
```

The exporter uses temporary `.offline` files and removes them after success. Render output stays in the chosen scratch directory. The renderer labels each image as an approximate offline view. A checked-in contact sheet lives under `docs/review/`.
