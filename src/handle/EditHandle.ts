// Fresh code (inspiration only, not copied) - a small container for one draggable affordance,
// inspired by the general shape of @luciad/ria-toolbox-controller/handle/ControllerHandle.ts but
// written from scratch and trimmed to exactly what this package needs.
import {Point} from "@luciad/ria/shape/Point.js";

export type HandleKind = "free" | "move" | "height" | "finish" | "cancel";

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

  constructor(kind: HandleKind) {
    this.kind = kind;
  }

  endInteraction(): void {
    this.interactionFunction = null;
    this.dragStartWGS84 = null;
    this.currentWGS84 = null;
  }
}
