// Fresh code (inspiration only, not copied) - a small container for one draggable affordance,
// inspired by the general shape of @luciad/ria-toolbox-controller/handle/ControllerHandle.ts but
// written from scratch and trimmed to exactly what this package needs.
import {Point} from "@luciad/ria/shape/Point.js";

// "midpoint" only ever appears as a `_hoveredHandleKind` value (Shape3DEditController.ts) - a
// midpoint marker is never itself the kind of a live EditHandle. Dragging a selected midpoint's
// handle either inserts a real vertex and continues as an ordinary "free"/"move"/"height" drag on
// that new vertex, or - with Shift held - shifts the whole shape without ever inserting one; the
// midpoint itself never becomes the handle's own kind either way.
export type HandleKind =
    "free" | "move" | "height" | "finish" | "cancel" | "midpoint" | "shiftToggle" | "remove" | "rotate";

/**
 * Tracks the live state of one draggable handle (free/move/height) while it targets a particular
 * vertex. `interactionFunction` is built lazily on the first drag frame and cleared on
 * `endInteraction()`.
 */
export class EditHandle {
  readonly kind: HandleKind;
  vertexIndex: number | null = null;
  focused = false;
  interactionFunction: ((viewPoint: Point) => Point) | null = null;

  /** The vertex's WGS84 position at the moment the drag started, for live guide/label drawing. */
  dragStartWGS84: Point | null = null;
  /** The vertex's most recently computed WGS84 position while dragging. */
  currentWGS84: Point | null = null;

  /** True if Shift was held when this drag started - locked for the whole gesture. */
  shiftWholeShape = false;
  /** Every vertex's own WGS84 position at drag start - only populated when shiftWholeShape. */
  allVerticesStartWGS84: Point[] | null = null;

  /**
   * True if this drag was started by a touch input, not a mouse - locked for the whole gesture.
   * Used to offset the dragged icon's drawn position above the fingertip (so it isn't hidden
   * underneath it) and to gate touch-only feedback like haptics.
   */
  isTouch = false;

  /**
   * Only used by "rotate" - the per-frame signed angle delta (degrees) swept so far, relative to
   * drag start. "rotate" never produces a single evolving position the way free/move/height do
   * (the pivot vertex it targets never moves), so this doesn't fit `interactionFunction`'s
   * `Point`-returning signature - it gets its own, separate function.
   */
  rotationInteractionFunction: ((viewPoint: Point) => number) | null = null;
  /** The latest value `rotationInteractionFunction` produced - read by onDrawLabel for the live angle readout. */
  rotationDeltaDegrees: number | null = null;
  /**
   * Only used by "rotate" - the absolute compass bearing (degrees) captured once at drag start,
   * from the pivot to wherever the cursor first was. Needed as the rotate-arc visual's own
   * `createArcBand` "start" edge, so it stays fixed at the gesture's actual start rather than
   * being re-derived from the handle icon's own always-camera-relative offset position.
   */
  rotationStartAzimuth: number | null = null;

  constructor(kind: HandleKind) {
    this.kind = kind;
  }

  endInteraction(): void {
    this.interactionFunction = null;
    this.dragStartWGS84 = null;
    this.currentWGS84 = null;
    this.shiftWholeShape = false;
    this.allVerticesStartWGS84 = null;
    this.rotationInteractionFunction = null;
    this.rotationDeltaDegrees = null;
    this.rotationStartAzimuth = null;
  }
}
