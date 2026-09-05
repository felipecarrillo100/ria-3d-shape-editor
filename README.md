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

### Requirements

- **`@luciad/ria` 2025.0 or higher**, as a peer dependency - install and license it yourself. This
  package bundles no part of LuciadRIA and depends on no `@luciad/ria-toolbox-*` package at runtime.
- **ESM only.** The package is `"type": "module"` and ships a single ESM build, so `require()` fails
  with `ERR_REQUIRE_ESM`. Use `import`, via a bundler (Vite, webpack, Rollup) or native ESM.
- **A geocentric (`EPSG:4978`) map** for height editing. 2D (projected) maps are fully supported for
  everything else - the controller detects the map's mode on activation and adapts. See
  [2D maps](#2d-maps).

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

## Wiring it up

The controller never persists anything - it mutates the shape it created or was given and tells you
what happened. Two rules cover almost all of it:

1. **Persist only on `ShapeEditingFinished` with `confirmed: true`.** That is the only signal meaning
   "the user pressed Finish". `ShapeCreated` fires when the *creation* phase ends and editing begins,
   which is not yet a commitment; Cancel, Escape and any other deactivation give `confirmed: false`.
2. **You don't need to deactivate the controller.** Finish, Cancel and Escape all set
   `map.controller = null` themselves.

### Creating a new geometry

What happens, in order:

1. You construct the controller with a shape type and the target `layer`, then assign
   `map.controller`. `controller.phase` is `"creating"` and the cursor becomes a crosshair.
2. Each click places a vertex; moving the pointer in between rubber-bands the next one. A `Point`
   finishes on its first click.
3. Double-click finishes creation. `ShapeCreated` fires **once**, `phase` flips to `"editing"`, and
   the crosshair reverts. **Nothing is saved yet** - this is not the signal to persist.
4. The user now adjusts the shape with the handles. `ShapeChanged` fires on every vertex
   move/insert/removal.
5. Finish (✓) ends the session with `ShapeEditingFinished` / `confirmed: true` - **persist here**.
   Cancel (✕) or Escape ends it with `confirmed: false`, and there is nothing to undo: the shape only
   ever existed inside the controller, so simply discard it.
6. Either way the controller sets `map.controller = null` itself.

```typescript
import {Shape3DEditController} from "ria-3d-shape-editor";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {Feature} from "@luciad/ria/model/feature/Feature.js";

const controller = new Shape3DEditController(ShapeType.POLYGON, layer);

controller.on("ShapeEditingFinished", ({shape, confirmed}) => {
  if (!confirmed) {
    return; // Cancel/Escape - nothing was ever added, so there is nothing to undo
  }
  // `shape` is already in layer.model.reference, so it goes straight into the store. `store` is
  // your own Store backing `layer` - a MemoryStore, a WFS-T store, anything. (`Store.add`/`put` are
  // optional members of the Store interface, since a read-only store may omit them, so call them on
  // your concrete store rather than through `layer.model.store`.)
  Promise.resolve(store.add(new Feature(shape, {})))
      .catch((error) => console.error("add failed:", error));
});

map.controller = controller;
```

Click to place each vertex, moving the pointer in between to preview the next one; double-click to
finish (a single click finishes a `Point`). See [Creating a shape](#creating-a-shape).

### Editing an existing geometry

The important difference: the controller mutates **your** shape object, in place, from the first
drag - so a cancel has real work to undo, and your layer needs telling that the feature is live.

1. Call `layer.setEditedObject(feature)` **first** (see the note below), or the feature will appear
   frozen while you drag it.
2. Construct with `{existingShape}`. `phase` is `"editing"` immediately - no creation step, no
   crosshair, no `ShapeCreated` event. The controller takes a private snapshot of the shape here.
3. The handles edit your shape in place; `ShapeChanged` fires on every change. If you render the
   feature yourself, it is already up to date - that is what step 1 bought you.
4. Finish (✓) → `ShapeEditingFinished` / `confirmed: true` → **persist** (`store.put`).
   Cancel (✕) or Escape → the controller first **reverts your shape to its snapshot** - vertex
   positions *and* vertex count, including any midpoint you promoted - and only then fires the event
   with `confirmed: false`. So by the time you see it, your object is already back to how it was;
   don't persist, and don't try to undo anything yourself.
5. Call `setEditedObject(null)` when the session ends, either way.

```typescript
import type {EditableShape, SupportedShapeType} from "ria-3d-shape-editor";

const shape = feature.shape as EditableShape;

// REQUIRED - see the note below. Not in RIA's public typings, hence the cast.
(layer as unknown as {setEditedObject(f: Feature | null): void}).setEditedObject(feature);

const controller = new Shape3DEditController(shape.type as SupportedShapeType, layer, {existingShape: shape});

controller.on("ShapeEditingFinished", ({shape: edited, confirmed}) => {
  if (!confirmed) {
    // Vertex positions and count have already been reverted for you - see controller.cancel()
    (layer as unknown as {setEditedObject(f: Feature | null): void}).setEditedObject(null);
    return;
  }
  const updated = new Feature(edited, feature.properties, feature.id);
  Promise.resolve(store.put(updated))
      .catch((error) => console.error("put failed:", error))
      .then(() => (layer as unknown as {setEditedObject(f: Feature | null): void}).setEditedObject(null));
});

map.controller = controller;
```

> **You must call `layer.setEditedObject(feature)` before editing an existing, already-rendered
> feature.** `FeatureLayer` only reads `feature.shape` live while that feature is its *edited
> object*; otherwise it paints a cached snapshot refreshed only on a model-change event. Mutating the
> shape in place - which is exactly what this controller does - therefore does **not** make your
> layer repaint, and the feature appears frozen while you drag it. Call `setEditedObject(null)` when
> the session ends.
>
> The method exists at runtime but is absent from `FeatureLayer.d.ts`, so it needs the cast above.
> This controller also draws the shape body itself while editing, as a deliberate always-correct
> fallback - so a missing `setEditedObject` looks like a *doubled* or oddly-lagging shape rather than
> nothing at all.

### Which reference shapes come back in

Always `layer.model.reference`, read once at construction - never `map.reference`. Height editing
needs a geocentric map, so the drag maths happens in `EPSG:4978`/WGS84 internally, but every vertex
is reprojected back before it is written to the shape. That matters because nothing downstream
reprojects for you: a real backend rejects geometry in the wrong reference (GeoServer refuses a
geocentric geometry for a geographic-native layer). Passing `layer` is how the controller learns the
one reference its output must be in.

### 2D maps

The controller detects whether its map is geocentric (`EPSG:4978`) or projected when it is activated,
and adapts. On a 2D map you get the same handles, laid out with screen-pixel offsets instead of world
directions, with two differences:

- **No height handle.** A projected reference has no per-location "up" to drag along. Set height
  numerically instead - see below.
- **The move handle appears only while whole-shape mode is armed.** In 2D the vertex icon itself
  already moves in the horizontal plane with the height frozen, so an unarmed move handle would just
  duplicate it. There it is purely the "translate every vertex" grip.

Height is treated as a value you set deliberately and that no drag may disturb:

| Action | Effect on Z in 2D |
| --- | --- |
| Creating a vertex | `0` - a 2D map carries no height information to read |
| Dragging a vertex | Unchanged; X/Y only |
| Whole-shape translate | Every vertex keeps its own Z (a geodetic shift, not a Cartesian one) |
| Whole-shape rotate | Every vertex keeps its own Z |
| Promoting a midpoint | The average of its two neighbours' heights, then fixed like any vertex |

Rotate draws a flat arc band in 2D; the drop line and the reference-plane grid are 3D-only.

#### Setting height on a 2D map

The height handle is 3D-only. On a 2D map, drive height from your own UI instead:

```typescript
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";

const WGS_84 = getReference("CRS:84");
const shape = controller.shape as Polyline; // or Polygon; a Point has no getPoint - use its own x/y

// Go via a geographic reference rather than writing `heightInMeters` straight into the shape's own
// z: in a geocentric model reference, z is an ECEF coordinate, not a height above the ellipsoid.
// setVertexPosition then reprojects back into the shape's reference for you.
const vertex = createTransformation(shape.reference!, WGS_84).transform(shape.getPoint(index));
controller.setVertexPosition(index, createPoint(WGS_84, [vertex.x, vertex.y, heightInMeters]));
```

This is exactly what the `htmlToolbar` height input does internally, so the two agree.

## Handles

Each vertex offers several simultaneous, individually-grabbable handles. Only the *active* vertex
(or, if selected instead, an active midpoint) shows the full set below - every other vertex draws
just a plain, clickable marker, so a shape with many vertices doesn't turn into a field of
overlapping icons.

| Handle | Gesture | Effect |
| --- | --- | --- |
| Vertex itself ("free") | drag | Moves in X/Y/Z, continuously adopting whatever terrain/mesh surface is under the cursor. In 2D: X/Y only, height frozen |
| Move | drag | Moves in X/Y only - height frozen. In 2D: shown only while whole-shape mode is armed |
| Height | drag | Moves in Z only - X/Y frozen. 3D only |
| Rotate | drag | Swings the whole shape horizontally around this vertex, which stays fixed as the pivot - only shown while whole-shape mode is armed |
| Remove | click/tap | Removes this vertex outright (also reachable via double-click/double-tap anywhere near a vertex) |
| Whole-shape toggle | click/tap | Arms/disarms whole-shape mode (see below) - only on a shape with more than one vertex, so never on a `Point` |
| Finish | click/tap | Confirms the shape and ends editing |
| Cancel | click/tap | Discards changes made this session and ends editing |
| Midpoint marker | click to select, then drag one of its own handles | Promotes that segment's midpoint into a real vertex |

Height is 3D-only, and Move is 3D-only unless whole-shape mode is armed - see [2D maps](#2d-maps)
for the full 2D handle set and the rules that keep Z untouched there. Use
`controller.setVertexPosition(index, point)` to set a height programmatically on a 2D map.

The toggle and Rotate have a second condition: the shape must have more than one vertex. A `Point`
therefore never shows either - there is no "every other vertex" for whole-shape mode to carry along,
and rotating the only vertex around itself is a no-op.

### Whole-shape mode

Clicking/tapping the toggle handle arms **whole-shape mode**: every subsequent drag on Move,
Height, Rotate, or the vertex itself now acts on the *entire* shape - every other vertex is either
rigidly carried along by the same move/height delta, or swung around the active vertex by Rotate -
instead of only the one active vertex. It's sticky (stays armed across drags and across switching
which vertex is active) and global (one on/off state for the whole session), and works identically
for mouse and touch - there is no keyboard-modifier equivalent.

The toggle is only offered on a shape with more than one vertex, so whole-shape mode simply doesn't
exist for a `Point`: with a single vertex, every whole-shape drag would reduce to the ordinary
single-vertex one it already is.

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
`.ria-3d-shape-editor-height-unit` - the unit is a read-only field styled to match the value field
beside it) for restyling, and an optional `labels` object supplies
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
| `uom` | `"metric" \| "imperial" \| "nautical"` | `"metric"` | Unit family for every number the editor displays - the live drag label and the `htmlToolbar` height input (see [Units](#units)) |
| `showPlane` | `boolean` | `true` | Draw a translucent ground-reference grid while dragging Move |
| `showDropLine` | `boolean` | `true` | Draw a line from the drag anchor straight down to Earth's center while dragging Height/Move/Rotate |
| `htmlToolbar` | `boolean \| {labels?}` | `false` | Touch-friendly HTML Finish/Cancel/height-input alternative (see above) |

### Units

`uom` picks a family, not a single unit. Within a family, the live drag label auto-scales by
magnitude, so a kilometre-scale shape doesn't produce an unreadably long number:

| Family | Below the threshold | At/above it | Threshold |
| --- | --- | --- | --- |
| `metric` | metres - `12.34m` | kilometres - `2.00km` | 1000 m |
| `imperial` | feet - `997.38ft` | miles - `1.24mi` | 305 m (~1000 ft) |
| `nautical` | feet - `997.38ft` | nautical miles - `1.08NM` | 305 m (~1000 ft) |

Height deltas and horizontal distances deliberately share that one rule, so a tall drag reads
`+2.00km` rather than `+2000.00m`. The threshold compares absolute value, so a negative height delta
scales the same way (`-2.00km`). The swept-angle label shown while rotating is always degrees, and
is unaffected by `uom`.

The one exception is `htmlToolbar`'s height **input**, which always uses the family's *base* unit -
metres for `metric`, feet for both others - with a matching symbol beside it. An editable field
can't re-unit itself as the value crosses a threshold without a number you already typed silently
changing meaning, so it stays put; a value you type is always in the unit shown next to it.

Nothing about the geometry changes with `uom`: the shape itself is always in `layer.model.reference`,
and `setVertexPosition` always takes a `Point` in a real reference. This option is display-only.

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

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

ISC - see [LICENSE](LICENSE). A few small math/interaction utilities are adapted from Luciad's own
toolbox and remain under the permissive license preserved in each of those files; see below.
`@luciad/ria` is a separate commercial product and is not covered by this license.

## Attribution

A handful of small math/interaction utilities in this package (`src/math/`, parts of
`src/handle/HandleInteractions.ts`) are adapted from Luciad's own `@luciad/ria-toolbox-*` packages,
under the permissive license embedded in those source files (see the header preserved at the top of
each adapted file). This package does not depend on any `@luciad/ria-toolbox-*` package at runtime.
