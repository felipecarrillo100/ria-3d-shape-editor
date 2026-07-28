# ria-3d-shape-editor

A single LuciadRIA controller that creates and edits `Point`/`Polyline`/`Polygon` shapes with
independent control over each vertex's height (Z) - the affordance missing from LuciadRIA's stock
`BasicCreateController`/`EditController`, which were built when RIA was 2D-only.

Fully independent of any backend: it only mutates the shape it is given (or creates) and emits
events describing what happened. Persistence (WFS-T or anything else) is entirely up to the caller.
Works identically with mouse and touch input, with no separate code path for either.

## Installation

```bash
npm install ria-3d-shape-editor
```

Compatible with `@luciad/ria` 2025.0 or higher.

## Usage

```typescript
import {Shape3DEditController} from "ria-3d-shape-editor";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";

// Create a new Point. `layer` is required: the controller reads `layer.model.reference` once, at
// construction, and every shape it creates/emits is always in that reference - never in
// map.reference - so it can be added straight to `layer.model` (or a WFS-T store backing it)
// without any reprojection on your part.
const controller = new Shape3DEditController(ShapeType.POINT, layer);
map.controller = controller;

controller.on("ShapeCreated", ({shape}) => {
  // shape is a Point, already in layer.model.reference; save it however you like
});

controller.on("ShapeChanged", ({shape}) => {
  // fired on every vertex move/insert/removal while editing
});

controller.on("ShapeEditingFinished", ({shape, confirmed}) => {
  // fired once, when the controller is deactivated while editing - persist only if confirmed
});
```

```typescript
// Edit an existing shape directly - skips creation, starts in edit mode immediately
const controller = new Shape3DEditController(ShapeType.POLYGON, layer, {existingShape: existingPolygon});
map.controller = controller;
```

## Handles

Each vertex offers several simultaneous, individually-grabbable handles. Only the *active* vertex
(or, if selected instead, an active midpoint) shows the full set below - every other vertex draws
just a plain, clickable marker, so a shape with many vertices doesn't turn into a field of
overlapping icons.

| Handle | Gesture | Effect |
| --- | --- | --- |
| Vertex itself ("free") | drag | Moves in X/Y/Z, continuously adopting whatever terrain/mesh surface is under the cursor |
| Move | drag | Moves in X/Y only - height frozen |
| Height | drag | Moves in Z only - X/Y frozen |
| Rotate | drag | Swings the whole shape horizontally around this vertex, which stays fixed as the pivot - only shown while whole-shape mode is armed |
| Remove | click/tap | Removes this vertex outright (also reachable via double-click/double-tap anywhere near a vertex) |
| Whole-shape toggle | click/tap | Arms/disarms whole-shape mode (see below) |
| Finish | click/tap | Confirms the shape and ends editing |
| Cancel | click/tap | Discards changes made this session and ends editing |
| Midpoint marker | click to select, then drag one of its own handles | Promotes that segment's midpoint into a real vertex |

Move/Height/Rotate/Remove/the toggle/Finish/Cancel only appear on a 3D (`EPSG:4978`, geocentric)
map view - on a 2D map there's no well-defined "up" to make height or rotation meaningful. Use
`controller.setVertexPosition(index, point)` to set a height programmatically in that case.

### Whole-shape mode

Clicking/tapping the toggle handle arms **whole-shape mode**: every subsequent drag on Move,
Height, Rotate, or the vertex itself now acts on the *entire* shape - every other vertex is either
rigidly carried along by the same move/height delta, or swung around the active vertex by Rotate -
instead of only the one active vertex. It's sticky (stays armed across drags and across switching
which vertex is active) and global (one on/off state for the whole session), and works identically
for mouse and touch - there is no keyboard-modifier equivalent.

### Live feedback while dragging

A guide line plus a live numeric label (distance, height delta, or swept angle, auto-formatted in
the configured unit family) tracks every drag. Two more visual aids are opt-in via constructor
options (below): a translucent ground-reference grid while dragging Move, and a line straight down
to Earth's center - the exact rotation axis when dragging Rotate, a depth/occlusion cue otherwise.
Everything drawn by this controller is occlusion-aware: geometry that's genuinely part of the shape
recolors when hidden behind terrain/a mesh, while handle icons (which aren't real points on the
shape) simply stay visible on top regardless.

## Creating a shape

Click to place each vertex of a LineString/Polygon, moving the mouse in between to live-preview
the next one; double-click (or, for `Point`, a single click) to finish. The cursor is a crosshair
for the whole creation phase - a `Point`'s rubber-band vertex icon gives its own visual feedback
immediately, but a LineString/Polygon draws nothing at all until the first point is placed, so the
crosshair is what signals the controller is active in the meantime. It reverts to the default
pointer the moment editing begins.

## Touch support

Every gesture above works the same way with a finger as with a mouse:

- Touch gets a larger effective hit tolerance (~44-48px, matching Apple/Material touch-target
  guidance) than the ~24px a mouse pointer gets, and hit-testing is always recomputed fresh at the
  actual touch/drag position rather than relying on a stale hover state (touch has no
  hover-before-contact the way a mouse does).
- The actively-dragged icon is drawn offset above the fingertip, so it's never hidden underneath
  the very finger dragging it.
- A short haptic pulse fires on grabbing and releasing a handle (silently skipped on platforms
  without the Vibration API, e.g. iOS Safari).
- Double-tap removes a vertex, same as double-click.

### `htmlToolbar` option

Small, 3D-anchored Finish/Cancel icons and a virtual keyboard for a height value can be genuinely
hard to hit/use reliably with a finger. Setting `htmlToolbar: true` replaces the canvas-drawn
Finish/Cancel icons with fixed HTML buttons (X/checkmark, not text, so nothing needs translation) overlaid on the map, plus a
live, editable height input for the active vertex/midpoint - never both at once for
Finish/Cancel, whichever is active is the only one drawn and hit-testable. Every element gets a
stable CSS class name (`.ria-3d-shape-editor-toolbar`, `.ria-3d-shape-editor-btn-finish`,
`.ria-3d-shape-editor-btn-cancel`, `.ria-3d-shape-editor-height-input`,
`.ria-3d-shape-editor-height-unit`) for restyling, and an optional `labels` object supplies
`aria-label`/`title` text for screen readers without touching the icon-only visible UI:

```typescript
new Shape3DEditController(ShapeType.POLYGON, layer, {
  htmlToolbar: {labels: {cancel: "Annuler", finish: "Terminer", height: "Hauteur"}},
});
```

`labels` can be updated live via `updateController()` (e.g. a language switcher); whether the
toolbar exists at all is constructor-only.

## Options

All constructor options are optional and can be read back/changed live via
`controller.updateController({...})`, except `existingShape` (constructor-only, by definition) and
`htmlToolbar` (constructor-only - see above; its `labels` sub-option is the one part of it that's
still live-updatable).

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `existingShape` | `EditableShape` | - | Start directly in edit mode on this shape instead of creating a new one |
| `vertexHitPixelTolerance` | `number` | `12` | Pixel radius for a mouse click/hover to count as targeting a handle (touch always gets a larger effective floor, see above) |
| `uom` | `"metric" \| "imperial"` | `"metric"` | Unit family for the live drag label |
| `showPlane` | `boolean` | `true` | Draw a translucent ground-reference grid while dragging Move |
| `showDropLine` | `boolean` | `true` | Draw a line from the drag anchor straight down to Earth's center while dragging Height/Move/Rotate |
| `htmlToolbar` | `boolean \| {labels?}` | `false` | Touch-friendly HTML Finish/Cancel/height-input alternative (see above) |

## Public API

- `controller.shape` - the shape currently being created/edited, or `null` before the first vertex.
- `controller.phase` - `"creating"` or `"editing"`.
- `controller.setVertexPosition(index, point)` - move a vertex programmatically (e.g. from a
  numeric input, or as the 2D/non-3D fallback for height editing).
- `controller.finish()` - forces creation to finish now, if enough vertices have been placed. No-op while editing.
- `controller.confirm()` - the programmatic equivalent of clicking the Finish handle while editing.
- `controller.cancel()` - reverts the shape to its value when the controller was constructed (only
  meaningful when constructed with `existingShape`).
- `controller.updateController(options)` - apply any subset of the options above to an
  already-active controller, without losing in-progress session state.

Ending a session (Finish, Cancel, or Escape) hands `map.controller` back to `null` itself,
mirroring `BasicCreateController`'s own self-deactivating behavior - unlike stock
`EditController`, which requires the app to do this itself.

## Events

- `ShapeCreated` - emitted once, when creation finishes and the controller transitions into edit mode.
- `ShapeChanged` - emitted on every vertex move/insert/removal while editing.
- `ShapeEditingFinished` - emitted when the controller is deactivated while editing, with
  `confirmed: true` only when that happened via the Finish handle/`confirm()` - persist only in
  that case, never on `ShapeCreated` or any other kind of session end.

## Notes on drape targets

If the layer that ultimately renders the edited feature styles it with `DrapeTarget.MESH`/`ALL`,
a height edit made through this controller is real in the underlying data, but may not be visible
once control returns to that layer's own painter (the shape gets flattened onto the terrain/mesh
surface for rendering). This package's own handle visuals never drape, but it has no opinion on how
a consuming app styles the final persisted feature.

## Attribution

A handful of small math/interaction utilities in this package (`src/math/`, parts of
`src/handle/HandleInteractions.ts`) are adapted from Luciad's own `@luciad/ria-toolbox-*` packages,
under the permissive license embedded in those source files (see the header preserved at the top of
each adapted file). This package does not depend on any `@luciad/ria-toolbox-*` package at runtime.
