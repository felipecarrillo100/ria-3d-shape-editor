import {EditableShape} from "./strategy/ShapeEditStrategy.js";

export const SHAPE_CREATED_EVENT = "ShapeCreated";
export const SHAPE_CHANGED_EVENT = "ShapeChanged";
export const SHAPE_EDITING_FINISHED_EVENT = "ShapeEditingFinished";

export type Shape3DEditEventType =
    | typeof SHAPE_CREATED_EVENT
    | typeof SHAPE_CHANGED_EVENT
    | typeof SHAPE_EDITING_FINISHED_EVENT;

/** Emitted once, when creation finishes and the controller transitions into edit mode. */
export interface ShapeCreatedEvent {
  shape: EditableShape;
}

/** Emitted on every vertex move/removal while editing. */
export interface ShapeChangedEvent {
  shape: EditableShape;
}

/**
 * Emitted when editing ends, however it ends (the OK handle, the Cancel handle, Escape, or the
 * app externally deactivating the controller).
 *
 * `confirmed` is `true` only when the user explicitly clicked the OK/finish handle - that's the
 * only signal a caller should treat as "persist this." Everything else (Cancel, Escape, or any
 * other deactivation) is `confirmed: false`, and for a shape that already existed before this
 * editing session, in-place vertex mutations have already been reverted to their original values
 * by the time this fires (see Shape3DEditController.cancel()) - for a freshly created shape there
 * is nothing to revert, since it was never shared anywhere outside this controller.
 */
export interface ShapeEditingFinishedEvent {
  shape: EditableShape;
  confirmed: boolean;
}
