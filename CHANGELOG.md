# Changelog

All notable changes to `ria-3d-shape-editor`.

Entries from `0.1.5` onward are written as the work lands. Earlier entries were reconstructed from
git history after the fact, grouped by the version recorded in `package.json` at each commit - the
mapping to what was actually published on npm at the time may not be exact.

## 0.2.0

### Added

- **2D map support.** The controller now detects whether its map is geocentric (`EPSG:4978`) or
  projected when it is activated, and adapts. Previously every handle except the vertex icon itself
  collapsed to nothing on a 2D map, which left no way to *confirm* an edit at all unless the
  `htmlToolbar` option was on - Escape and Cancel both revert. 3D behaviour is unchanged.
  - Handles are laid out with screen-pixel offsets in 2D, in the same slots the 3D set uses, so they
    keep a constant on-screen size at any zoom.
  - `height` is never offered in 2D (a projected reference has no per-location "up"). `move` is
    offered only while whole-shape mode is armed, where it is the "translate every vertex" grip - in
    2D the vertex icon already moves in the horizontal plane on its own.
  - Rotate draws a flat arc band in 2D; the drop line and reference-plane grid are 3D-only.

### Fixed

- **Dragging a vertex on a 2D map no longer destroys its height.** The vertex drag went through a
  `LocationMode.CLOSEST_SURFACE` raycast, which per LuciadRIA's own docs "has an effect on 3D maps
  only" and reports no height on a 2D map - so every 2D drag would have flattened the vertex, and the
  vertex icon was the only drag handle a 2D session offered. It now moves in X/Y with Z re-imposed
  from the vertex's original value.
- Whole-shape translate in 2D preserves each vertex's own height exactly. The 3D path applies a rigid
  `EPSG:4978` delta, which drifts ellipsoidal height by roughly (shape extent x drag distance / earth
  radius) across a curved earth; 2D now applies the shift geodetically instead.
- Vertices created on a 2D map are explicitly given height `0`, in the map's own reference before any
  reprojection, rather than inheriting whatever the raycast reported.

### Changed

- Internal: which handles are on offer is now decided in one place
  (`effectiveHandlePositions`) that both hit-testing and drawing consume, replacing two matching sets
  of conditions that had to be kept in step by hand. No behavioural change in 3D.

## 0.1.5

### Fixed

- `cancel()` now restores the original vertex **count**, not just vertex positions. Promoting a
  midpoint into a real vertex and then cancelling used to leave the extra vertex behind, duplicating
  the last original one. It was invisible (a zero-length segment), but the shape is mutated in place
  and survives into the next session's snapshot, so it accumulated one vertex per cancelled session
  and could reach a backend on a later confirm.
- `cancel()` no longer aliases its own snapshot. Re-inserting a removed vertex passed the snapshot's
  live point into `insertPoint`, which stores it by reference, so editing that vertex afterwards
  rewrote the snapshot and a second `cancel()` could no longer restore it.
- `uom` now applies to every number the editor displays. The `htmlToolbar` height input previously
  hardcoded metres - its suffix, its displayed value and the value read back - so
  `{uom: "imperial", htmlToolbar: true}` showed `+82.02ft` on the drag label and `25.00 m` in the
  input beside it.
- The `htmlToolbar` height input no longer commits a height of **zero** when the field is cleared or
  holds anything the browser cannot parse as a number.
- The `htmlToolbar` container now actually lays out as a flex row. Showing it assigned
  `display = ""`, which removed the inline `display:flex` rather than restoring it, silently
  disabling the toolbar's own `gap` and `align-items`.
- The whole-shape (⇧) toggle is no longer offered on a `Point`. With a single vertex, whole-shape
  drags reduce to the ordinary single-vertex drag they already were, and the rotate handle it
  revealed could not move anything at all while still emitting `ShapeChanged` on every drag frame.

### Changed

- **Imperial and nautical now switch from feet to miles/NM at 305 m (~1000 ft)** instead of at the
  true length of a mile (1609.344 m) or nautical mile (1852 m), so feet never reach five digits. A
  1600 m distance now reads `0.99mi` where it previously read `5249.34ft`.
- Height deltas and horizontal distances share one auto-scaling rule, so a tall drag reads `+2.00km`
  rather than `+2000.00m`.
- The `htmlToolbar` height unit moved from loose text into its own read-only field, styled to match
  the value field beside it. It is out of the tab order and `aria-hidden`; the unit symbol is
  appended to the value field's accessible name instead (e.g. `"Height (m)"`).

### Documented

- The `nautical` `uom` family, which worked and was publicly reachable but appeared nowhere in the
  README.
- `layer.setEditedObject(feature)` - required when editing an existing, already-rendered feature,
  and previously discoverable only by reading the source or the demo.
- ESM-only distribution, and the LuciadRIA peer-dependency/licence requirement.

### Added

- `LICENSE` (ISC, plus the third-party notice for the Luciad-derived utilities) and this changelog.
- A units dropdown in the demo, so the `uom` families can be switched live mid-session.

## 0.1.4

### Fixed

- Widened the `@luciad/ria` peer dependency to `>=2025.0`, so the package is no longer pinned to the
  2026.0 line.

## 0.1.3

### Fixed

- Widened the `@luciad/ria` peer dependency to any 2026.0 or higher version.

## 0.1.2

### Fixed

- Improved typing.

## 0.1.1

### Fixed

- Minor cleaning.

## 0.1.0

Initial release: a single `Shape3DEditController` that creates and edits `Point`/`Polyline`/`Polygon`
with independent per-vertex height (Z) control. Everything below landed under this version.

### Added

- Midpoint markers that promote into real vertices.
- Whole-shape mode: move every vertex together, preserving the shape, and snap a vertex to a surface.
- Rotate the whole shape horizontally around one vertex, which stays fixed as the pivot.
- Touch support throughout - larger hit tolerance, fresh hit-testing at the touch position, the
  dragged icon offset above the fingertip, haptics, and double-tap vertex removal.
- A vertical helper line running to Earth's centre, drawn during vertical *and* horizontal drags.
- Occlusion-aware styling: shape lines/fills and the displacement line recolour when hidden behind
  terrain or a mesh.
- Handle icons recompute while dragging *and* while panning/orbiting the camera.
- A dedicated crosshair cursor for the creation phase.
- A demo app that aliases straight to the library source, so no build step is needed to try changes.
