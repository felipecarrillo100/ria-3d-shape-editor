# ria-3d-shape-editor

A single LuciadRIA controller that creates and edits `Point`/`Polyline`/`Polygon` shapes with
independent control over each vertex's height (Z) - the affordance missing from LuciadRIA's stock
`BasicCreateController`/`EditController`, which were built when RIA was 2D-only.

Fully independent of any backend: it only mutates the shape it is given (or creates) and emits
events describing what happened. Persistence (WFS-T or anything else) is entirely up to the caller.

## Installation

```bash
npm install ria-3d-shape-editor
```

Peer dependency: `@luciad/ria >=2024.1`.

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
  // fired on every vertex move/removal while editing
});
```

```typescript
// Edit an existing shape directly - skips creation, starts in edit mode immediately
const controller = new Shape3DEditController(ShapeType.POLYGON, layer, {existingShape: existingPolygon});
map.controller = controller;
```

## Interaction

- **Creating** a LineString/Polygon: click to place each vertex, move the mouse to live-preview the
  next one, double-click to finish. Point finishes immediately after one click.
- **Editing**: drag a vertex to move it horizontally. Hold **Shift** while starting the drag (on a
  3D, `EPSG:4978` map) to drag its height instead. Double-click a vertex to remove it (LineString
  needs at least 2 vertices left, Polygon at least 3).
- Height dragging requires a 3D perspective (`EPSG:4978`) map view - this mirrors LuciadRIA's own
  toolbox behavior, where vertical-move interactions are disabled on 2D maps. For 2D/non-3D maps,
  set a vertex's height programmatically via `controller.setVertexPosition(index, point)`.

## Events

- `ShapeCreated` - emitted once, when creation finishes and the controller transitions into edit mode.
- `ShapeChanged` - emitted on every vertex move/removal while editing.
- `ShapeEditingFinished` - emitted when the controller is deactivated while editing.

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
