# PROGRESS – Silva & Bueno signature reveal   (updated 2026-10-27)

Phase: DONE
Current version: v1 → deliverables/silva-bueno-9x16.mp4, deliverables/silva-bueno-1x1.mp4

Done:
- Element extraction from the raster reference (34 layers, original pixels, sub-pixel outlines)
- Animation guides derived from the artwork (roof vertices, axis, ring circle, roof gap)
- 5 scenes + Instagram end card in Remotion (src/timeline.ts holds every timing)
- Procedural sound design, linear master −15 LUFS / −2.2 dBTP
- Framing check across all frames (scripts/check_framing.ts), QA scripts (scripts/qa_video.py, scripts/qa_handle.py)
- Fixed after measuring the render: handle rise now visible (12 px at 14 % opacity), one-frame raster shimmer at
  mask/light switches removed (constant paint bounds), light passes enter/leave off the metal

Next step: none required. Optional: real vector master of the logo for 4K / large-format versions.

Key decisions:
- No font substitution: glyphs are the reference's own pixels (fidelity rule of the brief)
- Logo gold kept as in the artwork (≈ #DEA94D mean), not recoloured to #D4AF37
- Name opens from the ampersand outwards (axis motif); camera reframes before the name appears
- Final 1.13 s fully static (camera stops at frame 832)

Key files: src/SilvaBueno.tsx, src/layers/*, src/camera.ts, src/timeline.ts, scripts/*.py
