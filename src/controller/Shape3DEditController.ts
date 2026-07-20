import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {EventedSupport} from "@luciad/ria/util/EventedSupport.js";
import {Handle} from "@luciad/ria/util/Evented.js";
import {ProgrammingError} from "@luciad/ria/error/ProgrammingError.js";

import {EditableShape, ShapeEditStrategy} from "../strategy/ShapeEditStrategy.js";
import {createShapeEditStrategy, SupportedShapeType} from "../strategy/createShapeEditStrategy.js";
import {CreationSession} from "./CreationSession.js";
import {Phase} from "./Phase.js";
import {nextActiveVertexIndex} from "./nextActiveVertexIndex.js";
import {EditHandle, HandleKind} from "../handle/EditHandle.js";
import {
  freeMovePointInteraction,
  horizontalMovePointInteraction,
  verticalMovePointInteraction,
} from "../handle/HandleInteractions.js";
import {findClosestVertexIndex} from "../handle/VertexHitTest.js";
import {computePointHandlePositions} from "../handle/PointHandleLayout.js";
import {distance} from "../math/Vector3Util.js";
import {
  CANCEL_HANDLE_DEFAULT_ICON_STYLE,
  CANCEL_HANDLE_FOCUSED_ICON_STYLE,
  FINISH_HANDLE_DEFAULT_ICON_STYLE,
  FINISH_HANDLE_FOCUSED_ICON_STYLE,
  GUIDE_END_ICON_STYLE,
  GUIDE_END_OCCLUDED_ICON_STYLE,
  GUIDE_LINE_STYLE,
  GUIDE_START_ICON_STYLE,
  HEIGHT_HANDLE_DEFAULT_ICON_STYLE,
  HEIGHT_HANDLE_FOCUSED_ICON_STYLE,
  MOVE_HANDLE_DEFAULT_ICON_STYLE,
  MOVE_HANDLE_FOCUSED_ICON_STYLE,
  PREVIEW_CLOSING_SEGMENT_STYLE,
  PREVIEW_SHAPE_STYLE,
  VERTEX_DEFAULT_ICON_STYLE,
  VERTEX_DEFAULT_OCCLUDED_ICON_STYLE,
  VERTEX_FOCUSED_ICON_STYLE,
  VERTEX_FOCUSED_OCCLUDED_ICON_STYLE,
  VERTEX_INACTIVE_ICON_STYLE,
  VERTEX_INACTIVE_OCCLUDED_ICON_STYLE,
} from "../handle/HandleStyles.js";
import {
  SHAPE_CHANGED_EVENT,
  SHAPE_CREATED_EVENT,
  SHAPE_EDITING_FINISHED_EVENT,
  ShapeChangedEvent,
  ShapeCreatedEvent,
  ShapeEditingFinishedEvent,
} from "../events.js";

const WGS_84 = getReference("CRS:84");
const WGS84_TO_EPSG4978 = createTransformation(WGS_84, getReference("EPSG:4978"));

const DEFAULT_VERTEX_HIT_PIXEL_TOLERANCE = 12;

export interface Shape3DEditControllerOptions {
  /** Pixel radius within which a click/hover counts as targeting a handle. Default 12. */
  vertexHitPixelTolerance?: number;
}

/**
 * A single controller that both creates and edits a Point, LineString (Polyline) or Polygon, with
 * independent per-vertex height (Z) control via dedicated drag handles - the capability missing
 * from LuciadRIA's stock BasicCreateController/EditController. Fully independent of any backend:
 * it only mutates the shape object it is given (or creates), and emits events describing what
 * happened - persistence is entirely the caller's responsibility.
 *
 * Each vertex offers up to five simultaneous, individually-grabbable handles: dragging the vertex
 * icon itself ("free") moves it in X/Y/Z, adopting whatever surface is under the cursor; a small
 * offset "move" handle (to the side) constrains the drag to X/Y only (height frozen); a small
 * offset "height" handle (above) constrains the drag to Z only (X/Y frozen); and a click-only pair
 * below the vertex - a checkmark ("finish", confirm and end editing, down-right) and an X
 * ("cancel", discard and end editing, down-left), grouped together and deliberately separated from
 * the shape-adjusting handles above/beside the vertex. The move/height/finish/cancel handles only
 * appear on a 3D (EPSG:4978) map - see HandleInteractions.ts's verticalMovePointInteraction guard.
 *
 * Nothing is persisted by this controller itself - it only mutates the shape it creates/is given.
 * Callers should persist (if at all) only in response to `ShapeEditingFinished` with
 * `confirmed: true` - not `ShapeCreated`, and not any other kind of session end. This is
 * deliberate: the shape lives only inside this controller until the user explicitly confirms via
 * the finish handle, so clicking Cancel (or pressing Escape, or the app deactivating the
 * controller for any other reason) never results in anything being saved.
 *
 * A newly created shape is always built in `layer.model.reference` - the layer's own backing
 * reference (e.g. whatever a WFS-T store negotiated with its service at connect time) - never in
 * `map.reference`. Height editing needs a geocentric (EPSG:4978) map to make sense of "up," so the
 * live drag math still happens in EPSG:4978/WGS84 internally, but every vertex is reprojected back
 * into `layer.model.reference` before it is ever written onto the shape. This matters because
 * nothing downstream (this package's own strategies, or a WFS-T store's encode path) reprojects on
 * your behalf - a shape handed back in the wrong reference is simply rejected by a real backend
 * (e.g. GeoServer refuses a geocentric geometry against a geographic-native layer). Passing `layer`
 * is how this controller finds the one reference its output must always be in.
 *
 * Ending a session (finish handle, cancel handle, or Escape) hands `map.controller` back to `null`
 * itself, mirroring how BasicCreateController already self-deactivates on completion -
 * EditController does not do this on its own (its own docs say the app must set
 * `map.controller = null`), so this makes the combined controller more self-sufficient than that.
 */
export class Shape3DEditController extends Controller {
  private readonly _strategy: ShapeEditStrategy;
  private readonly _targetReference: CoordinateReference;
  private readonly _eventedSupport: EventedSupport;
  private readonly _vertexHitPixelTolerance: number;

  private _phase: Phase;
  private _shape: EditableShape | null;
  private _originalShapeSnapshot: EditableShape | null;
  private _creationSession: CreationSession<EditableShape> | null;

  private _hoveredVertexIndex: number | null = null;
  private _hoveredHandleKind: HandleKind | null = null;
  private _activeHandle: EditHandle | null = null;
  /** Set right before `map.controller = null` by endEditing(); read once by onDeactivate. */
  private _pendingConfirmed = false;
  /**
   * The one vertex (of a possibly-many-vertex LineString/Polygon) that currently gets the full
   * handle set (free/move/height/finish/cancel) - every other vertex draws only a plain,
   * clickable marker, so editing a shape with many vertices doesn't become an unmanageable field
   * of overlapping handles. Always a valid index once _phase === EDITING (trivially always 0 for
   * Point, which only ever has one vertex). Meaningless while CREATING.
   */
  private _activeVertexIndex = 0;

  /**
   * `layer` is required so the controller can find the one reference (`layer.model.reference`) any
   * shape it creates must end up in - see the class doc. It is only ever read once, at construction
   * time; this controller does not otherwise interact with the layer (it does not add/remove
   * features, style anything on it, etc.).
   */
  constructor(shapeType: SupportedShapeType, layer: FeatureLayer, existingShape?: EditableShape,
              options?: Shape3DEditControllerOptions) {
    super();
    this._strategy = createShapeEditStrategy(shapeType);
    this._targetReference = layer.model.reference;
    this._vertexHitPixelTolerance = options?.vertexHitPixelTolerance ?? DEFAULT_VERTEX_HIT_PIXEL_TOLERANCE;
    this._eventedSupport = new EventedSupport(
        [SHAPE_CREATED_EVENT, SHAPE_CHANGED_EVENT, SHAPE_EDITING_FINISHED_EVENT], true);

    if (existingShape) {
      if (existingShape.type !== shapeType) {
        throw new ProgrammingError(
            `Shape3DEditController: existingShape.type (${existingShape.type}) does not match shapeType (${shapeType})`);
      }
      this._phase = Phase.EDITING;
      this._shape = existingShape;
      this._originalShapeSnapshot = existingShape.copy() as EditableShape;
      this._creationSession = null;
    } else {
      this._phase = Phase.CREATING;
      this._shape = null;
      this._originalShapeSnapshot = null;
      this._creationSession = new CreationSession(this._strategy, this._targetReference);
    }
  }

  get shape(): EditableShape | null {
    return this._shape ?? this._creationSession?.shape ?? null;
  }

  get phase(): "creating" | "editing" {
    return this._phase === Phase.CREATING ? "creating" : "editing";
  }

  /**
   * Directly sets the position of the vertex at `index`. Intended as the 2D/non-3D fallback for
   * height editing (a numeric input field), and as a general programmatic escape hatch - dragging
   * is not the only way to move a vertex.
   */
  setVertexPosition(index: number, point: Point): void {
    const shape = this.shape;
    if (!shape) {
      throw new ProgrammingError("Shape3DEditController: no shape to edit yet");
    }
    const pointInShapeRef = point.reference && !point.reference.equals(shape.reference)
        ? createTransformation(point.reference, shape.reference!).transform(point)
        : point;
    this._strategy.moveVertex(shape, index, pointInShapeRef);
    this.invalidate();
    if (this._phase === Phase.EDITING) {
      this.emitShapeChanged();
    }
  }

  /** Forces creation to finish now, if enough vertices have been placed. No-op while editing. */
  finish(): void {
    if (this._phase !== Phase.CREATING || !this._creationSession?.shape) {
      return;
    }
    if (this._strategy.canFinishCreation(this._creationSession.shape)) {
      this.finishCreation();
    }
  }

  /**
   * Reverts the shape entirely to its value when this controller was constructed (only meaningful
   * when constructed with an existing shape) - both vertex positions and vertex count/order. A
   * vertex removed mid-session (double-click, the only vertex-count-changing gesture reachable
   * during editing - there is no vertex-add gesture outside CreationSession) is re-inserted at its
   * original index. This is a blunt, position-by-index overwrite for the overlapping range plus an
   * append of whatever original tail vertices don't have a current slot - correct regardless of
   * where a vertex was removed, since it never tries to track "which original vertex is this," it
   * just reconstructs the exact original sequence numerically.
   */
  cancel(): void {
    if (this._phase !== Phase.EDITING || !this._shape || !this._originalShapeSnapshot) {
      return;
    }
    const shape = this._shape;
    const original = this._originalShapeSnapshot;
    const currentCount = this._strategy.vertexCount(shape);
    const originalCount = this._strategy.vertexCount(original);
    const sharedCount = Math.min(currentCount, originalCount);
    for (let i = 0; i < sharedCount; i++) {
      this._strategy.moveVertex(shape, i, this._strategy.getVertex(original, i));
    }
    for (let i = sharedCount; i < originalCount; i++) {
      this._strategy.insertVertex(shape, i, this._strategy.getVertex(original, i));
    }
    // Defensive - the double-click-removal handler already keeps this correct throughout a
    // session, so this is not expected to ever actually change anything.
    this._activeVertexIndex = Math.min(this._activeVertexIndex, originalCount - 1);
    this.invalidate();
    this.emitShapeChanged();
  }

  override onActivate(map: WebGLMap): void {
    super.onActivate(map);
  }

  override onDeactivate(map: WebGLMap): Promise<void> | void {
    if (this._phase === Phase.EDITING && this._shape) {
      this._eventedSupport.emit(SHAPE_EDITING_FINISHED_EVENT,
          {shape: this._shape, confirmed: this._pendingConfirmed} as ShapeEditingFinishedEvent);
    }
    this._activeHandle = null;
    this._hoveredVertexIndex = null;
    this._hoveredHandleKind = null;
    this._pendingConfirmed = false;
    return super.onDeactivate(map);
  }

  override onGestureEvent(event: GestureEvent): HandleEventResult {
    const map = this.map as WebGLMap | null;
    if (!map) {
      return EVENT_IGNORED;
    }
    return this._phase === Phase.CREATING
        ? this.handleCreationGesture(map, event)
        : this.handleEditingGesture(map, event);
  }

  /**
   * Escape discards an in-progress creation, or cancels editing (same as the cancel/X handle) -
   * see the class doc for why this controller ends its own session rather than requiring the app
   * to do it, unlike stock EditController.
   */
  override onKeyEvent(keyEvent: KeyEvent): HandleEventResult {
    if (keyEvent.domEvent?.key !== "Escape" || !this.map) {
      return super.onKeyEvent(keyEvent);
    }
    if (this._phase === Phase.EDITING) {
      this.endEditing(false);
    } else {
      this.map.controller = null;
    }
    return EVENT_HANDLED;
  }

  /**
   * Ends the current editing session. `confirmed` is `true` only for the finish/checkmark handle
   * - that's the only path a caller should treat as "persist this" (see SHAPE_EDITING_FINISHED_EVENT
   * doc). For any other outcome, in-place mutations on a pre-existing shape are reverted first via
   * `cancel()` (a no-op for a freshly created shape, which was never shared anywhere outside this
   * controller - there's nothing to revert). Setting `map.controller = null` triggers
   * `onDeactivate`, which is where SHAPE_EDITING_FINISHED_EVENT actually gets emitted - not
   * duplicated here.
   */
  private endEditing(confirmed: boolean): void {
    if (!confirmed) {
      this.cancel();
    }
    this._pendingConfirmed = confirmed;
    if (this.map) {
      this.map.controller = null;
    }
  }

  // --- Creation ---

  private handleCreationGesture(map: WebGLMap, event: GestureEvent): HandleEventResult {
    const session = this._creationSession!;
    if (event.type === GestureEventType.MOVE) {
      if (session.handleMove(map, event.viewPoint)) {
        this.invalidate();
      }
      return EVENT_HANDLED;
    } else if (event.type === GestureEventType.SINGLE_CLICK_UP) {
      if ((event.domEvent as MouseEvent).button !== undefined && (event.domEvent as MouseEvent).button !== 0) {
        return EVENT_IGNORED;
      }
      const result = session.handleClick(map, event.viewPoint);
      if (result === "ignored") {
        return EVENT_IGNORED;
      }
      this.invalidate();
      if (result === "finished") {
        this.finishCreation(map, event.viewPoint);
      }
      return EVENT_HANDLED;
    } else if (event.type === GestureEventType.DOUBLE_CLICK) {
      if (!session.shape) {
        return EVENT_IGNORED;
      }
      const result = session.handleDoubleClick();
      this.invalidate();
      if (result === "finished") {
        this.finishCreation(map, event.viewPoint);
      }
      return EVENT_HANDLED;
    }
    return EVENT_IGNORED;
  }

  /**
   * `map`/`viewPoint` are only available when this is triggered by an actual gesture (a click or
   * double-click finishing creation) - `finish()` can also be called programmatically with no
   * cursor context, in which case the hover-priming step below is simply skipped (the next real
   * MOVE event will populate it, exactly as before this fix).
   */
  private finishCreation(map?: WebGLMap, viewPoint?: Point): void {
    const shape = this._creationSession!.shape!;
    this._shape = shape;
    this._phase = Phase.EDITING;
    this._creationSession = null;
    if (map && viewPoint) {
      // Compute hover state at the click's own position right away, rather than waiting for a
      // subsequent MOVE event - otherwise a drag starting from the exact spot the shape was just
      // created at (with no mouse movement in between) would find nothing hovered and silently do
      // nothing, which looks indistinguishable from the controller having already deactivated.
      this.updateHoverState(map, viewPoint);
    }
    this._eventedSupport.emit(SHAPE_CREATED_EVENT, {shape} as ShapeCreatedEvent);
    this.invalidate();
  }

  // --- Editing ---

  private handleEditingGesture(map: WebGLMap, event: GestureEvent): HandleEventResult {
    if (event.type === GestureEventType.MOVE) {
      return this.handleEditMove(map, event);
    } else if (event.type === GestureEventType.DRAG) {
      return this.handleEditDrag(map, event);
    } else if (event.type === GestureEventType.DRAG_END) {
      return this.handleEditDragEnd();
    } else if (event.type === GestureEventType.SINGLE_CLICK_UP) {
      return this.handleEditClick(map, event);
    } else if (event.type === GestureEventType.DOUBLE_CLICK) {
      return this.handleEditDoubleClick(map, event);
    }
    return EVENT_IGNORED;
  }

  /**
   * Recomputes which handle (if any) is under `viewPoint`, updating `_hoveredVertexIndex`/
   * `_hoveredHandleKind`. Returns whether the hovered handle changed (so callers can decide
   * whether a redraw is actually needed).
   */
  private updateHoverState(map: WebGLMap, viewPoint: Point): boolean {
    const shape = this._shape!;
    const count = this._strategy.vertexCount(shape);

    let bestVertexIndex = -1;
    let bestKind: HandleKind | null = null;
    let bestDistance = this._vertexHitPixelTolerance;

    for (let i = 0; i < count; i++) {
      const positions = computePointHandlePositions(map, this._strategy.getVertex(shape, i));
      // Only the active vertex offers the full handle set - every other vertex only offers its
      // plain marker as a hit target (nothing else is drawn for it, see drawEditHandles).
      const candidates: Array<[HandleKind, Point | null]> = i === this._activeVertexIndex
          ? [["free", positions.free], ["move", positions.move], ["height", positions.height],
             ["finish", positions.finish], ["cancel", positions.cancel]]
          : [["free", positions.free]];
      for (const [kind, position] of candidates) {
        if (!position) {
          continue;
        }
        const pixelDistance = this.pixelDistanceToViewPoint(map, position, viewPoint);
        if (pixelDistance !== null && pixelDistance <= bestDistance) {
          bestDistance = pixelDistance;
          bestVertexIndex = i;
          bestKind = kind;
        }
      }
    }

    const found = bestVertexIndex >= 0;
    const changed = bestVertexIndex !== this._hoveredVertexIndex || bestKind !== this._hoveredHandleKind;
    if (changed) {
      this._hoveredVertexIndex = found ? bestVertexIndex : null;
      this._hoveredHandleKind = bestKind;
    }
    return changed;
  }

  private handleEditMove(map: WebGLMap, event: GestureEvent): HandleEventResult {
    if (this._activeHandle) {
      return EVENT_IGNORED;
    }
    if (this.updateHoverState(map, event.viewPoint)) {
      this.invalidate();
    }
    return this._hoveredVertexIndex !== null ? EVENT_HANDLED : EVENT_IGNORED;
  }

  /**
   * Clicking the finish (checkmark) or cancel (X) handle ends editing - see endEditing(). Clicking
   * a different (non-active) vertex's plain marker switches which vertex is active, moving the
   * full handle set there - this is the only way to activate a vertex; dragging one directly does
   * nothing (see handleEditDrag) since a click and a drag are mutually exclusive outcomes of a
   * single mouse gesture, not two separate steps. Any other click (on another handle, or on empty
   * space) is a no-op here. An earlier version tried to treat any click on empty space as "end
   * editing," but that turned out to be unreliable in practice - a real click almost always has a
   * pixel or two of movement between mouse-down and mouse-up, which can register as the start of a
   * camera drag before it's ever seen as "nothing hovered." Dedicated, always-visible handles are
   * unambiguous instead.
   */
  private handleEditClick(map: WebGLMap, event: GestureEvent): HandleEventResult {
    if ((event.domEvent as MouseEvent).button !== undefined && (event.domEvent as MouseEvent).button !== 0) {
      return EVENT_IGNORED;
    }
    if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel") {
      this.endEditing(this._hoveredHandleKind === "finish");
      return EVENT_HANDLED;
    }
    if (this._hoveredVertexIndex !== null && this._hoveredVertexIndex !== this._activeVertexIndex) {
      this._activeVertexIndex = this._hoveredVertexIndex;
      this.invalidate();
      return EVENT_HANDLED;
    }
    return this._hoveredVertexIndex !== null ? EVENT_HANDLED : EVENT_IGNORED;
  }

  private pixelDistanceToViewPoint(map: WebGLMap, point: Point, viewPoint: Point): number | null {
    try {
      const view = map.mapToViewTransformation.transform(point);
      return Math.hypot(view.x - viewPoint.x, view.y - viewPoint.y);
    } catch (e) {
      return null;
    }
  }

  private handleEditDrag(map: WebGLMap, event: GestureEvent): HandleEventResult {
    const shape = this._shape!;

    if (!this._activeHandle) {
      if (this._hoveredVertexIndex === null || !this._hoveredHandleKind) {
        return EVENT_IGNORED;
      }
      if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel") {
        // Both are click targets, not drag targets - absorb the gesture (so it doesn't pan the
        // camera through what's meant to be a fixed button) without acting on it.
        return EVENT_HANDLED;
      }
      if (this._hoveredVertexIndex !== this._activeVertexIndex) {
        // Only the active vertex's handles are draggable - a non-active vertex's plain marker
        // only responds to a click (which switches active, see handleEditClick), never a drag.
        // Absorb rather than ignore, same reasoning as the finish/cancel case just above.
        return EVENT_HANDLED;
      }
      const kind = this._hoveredHandleKind;
      const handle = new EditHandle(kind);
      handle.vertexIndex = this._hoveredVertexIndex;
      handle.focused = true;
      this._activeHandle = handle;

      const vertexPoint = this._strategy.getVertex(shape, handle.vertexIndex);
      handle.interactionFunction =
          kind === "height" ? verticalMovePointInteraction(map, event.viewPoint, vertexPoint) :
          kind === "move" ? horizontalMovePointInteraction(map, event.viewPoint, vertexPoint) :
          freeMovePointInteraction(map, event.viewPoint, vertexPoint);
      handle.dragStartWGS84 = createTransformation(vertexPoint.reference!, WGS_84).transform(vertexPoint).copy();
    }

    const handle = this._activeHandle;
    const resultWGS84 = handle.interactionFunction!(event.viewPoint);
    handle.currentWGS84 = resultWGS84.copy();
    const resultInShapeRef = createTransformation(WGS_84, shape.reference!).transform(resultWGS84);
    this._strategy.moveVertex(shape, handle.vertexIndex!, resultInShapeRef);
    this.emitShapeChanged();
    this.invalidate();
    return EVENT_HANDLED;
  }

  private handleEditDragEnd(): HandleEventResult {
    if (!this._activeHandle) {
      return EVENT_IGNORED;
    }
    this._activeHandle.endInteraction();
    this._activeHandle = null;
    this.invalidate();
    return EVENT_HANDLED;
  }

  private handleEditDoubleClick(map: WebGLMap, event: GestureEvent): HandleEventResult {
    const shape = this._shape!;
    const index = findClosestVertexIndex(map, event.viewPoint, shape, this._strategy, this._vertexHitPixelTolerance);
    if (index < 0 || !this._strategy.canRemoveVertex(shape, index)) {
      return EVENT_IGNORED;
    }
    this._strategy.removeVertex(shape, index);
    if (this._hoveredVertexIndex === index) {
      this._hoveredVertexIndex = null;
      this._hoveredHandleKind = null;
    }
    // Keep exactly one active vertex, always - either the same logical one (reindexed), or,
    // if the active vertex was the one just removed, whatever now occupies its old slot.
    this._activeVertexIndex =
        nextActiveVertexIndex(this._activeVertexIndex, index, this._strategy.vertexCount(shape));
    this.emitShapeChanged();
    this.invalidate();
    return EVENT_HANDLED;
  }

  private emitShapeChanged(): void {
    if (this._shape) {
      this._eventedSupport.emit(SHAPE_CHANGED_EVENT, {shape: this._shape} as ShapeChangedEvent);
    }
  }

  // --- Drawing ---
  // While CREATING, the controller draws the whole in-progress shape (nothing else is rendering it
  // yet). While EDITING, it ALSO draws the shape body (in the same translucent preview style used
  // during creation) underneath the handles - this is NOT automatic from the caller's own
  // FeatureLayer painter. Confirmed by tracing RIA's actual rendering pipeline:
  // FeatureLayer.fetchProvidedShape only reads feature.shape live when the layer's own
  // _editedObject === feature (set via FeatureLayer.setEditedObject) - otherwise it reads a
  // cached, snapshotted shape from the working-set node, refreshed only on an explicit
  // model-change event. A plain in-place shape mutation plus this controller's own invalidate()
  // does NOT make a caller's layer repaint the live position. Callers editing an existing,
  // already-rendered feature MUST call layer.setEditedObject(feature) themselves (see
  // demo-3d's Shape3DEditHelper.ts) to get correct live tracking from their own layer's painter;
  // this controller's own body-overlay draw below is a deliberate, always-correct fallback/cue
  // that works regardless of whether a given caller remembers to do that.

  override onDraw(geoCanvas: GeoCanvas): void {
    if (this._phase === Phase.CREATING) {
      this.drawCreationPreview(geoCanvas);
    } else {
      this.drawEditHandles(geoCanvas);
    }
  }

  private drawCreationPreview(geoCanvas: GeoCanvas): void {
    const shape = this._creationSession?.shape;
    if (!shape) {
      return;
    }
    if (shape.type === ShapeType.POINT) {
      geoCanvas.drawIcon(shape, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(shape, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
      return;
    }
    geoCanvas.drawShape(shape, PREVIEW_SHAPE_STYLE);
    const count = this._strategy.vertexCount(shape);
    for (let i = 0; i < count; i++) {
      const vertex = this._strategy.getVertex(shape, i);
      geoCanvas.drawIcon(vertex, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(vertex, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
    }
    const closingSegment = this._strategy.getPreviewClosingSegment(shape);
    if (closingSegment) {
      geoCanvas.drawShape(createPolyline(shape.reference!, closingSegment), PREVIEW_CLOSING_SEGMENT_STYLE);
    }
  }

  private drawEditHandles(geoCanvas: GeoCanvas): void {
    const map = this.map as WebGLMap | null;
    const shape = this._shape;
    if (!shape || !map) {
      return;
    }
    if (shape.type !== ShapeType.POINT) {
      geoCanvas.drawShape(shape, PREVIEW_SHAPE_STYLE);
    }
    const count = this._strategy.vertexCount(shape);
    for (let i = 0; i < count; i++) {
      const positions = computePointHandlePositions(map, this._strategy.getVertex(shape, i));

      if (i !== this._activeVertexIndex) {
        // Non-active vertex - just a plain, clickable marker (click it to make it active); no
        // move/height/finish/cancel clutter for shapes with many vertices.
        geoCanvas.drawIcon(positions.free, VERTEX_INACTIVE_ICON_STYLE);
        geoCanvas.drawIcon(positions.free, VERTEX_INACTIVE_OCCLUDED_ICON_STYLE);
        continue;
      }

      const activeKind: HandleKind | null =
          i === this._activeHandle?.vertexIndex ? this._activeHandle!.kind :
          i === this._hoveredVertexIndex ? this._hoveredHandleKind :
          null;

      if (activeKind === "free") {
        geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_ICON_STYLE);
        geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_OCCLUDED_ICON_STYLE);
      } else {
        geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_ICON_STYLE);
        geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
      }
      if (positions.move) {
        geoCanvas.drawIcon(positions.move, activeKind === "move" ? MOVE_HANDLE_FOCUSED_ICON_STYLE : MOVE_HANDLE_DEFAULT_ICON_STYLE);
      }
      if (positions.height) {
        geoCanvas.drawIcon(positions.height, activeKind === "height" ? HEIGHT_HANDLE_FOCUSED_ICON_STYLE : HEIGHT_HANDLE_DEFAULT_ICON_STYLE);
      }
      if (positions.finish) {
        geoCanvas.drawIcon(positions.finish, activeKind === "finish" ? FINISH_HANDLE_FOCUSED_ICON_STYLE : FINISH_HANDLE_DEFAULT_ICON_STYLE);
      }
      if (positions.cancel) {
        geoCanvas.drawIcon(positions.cancel, activeKind === "cancel" ? CANCEL_HANDLE_FOCUSED_ICON_STYLE : CANCEL_HANDLE_DEFAULT_ICON_STYLE);
      }
    }

    const handle = this._activeHandle;
    if (handle?.dragStartWGS84 && handle.currentWGS84) {
      const line = createPolyline(WGS_84, [handle.dragStartWGS84, handle.currentWGS84]);
      geoCanvas.drawShape(line, GUIDE_LINE_STYLE);
      geoCanvas.drawIcon(handle.dragStartWGS84, GUIDE_START_ICON_STYLE);
      geoCanvas.drawIcon(handle.currentWGS84, GUIDE_END_ICON_STYLE);
      geoCanvas.drawIcon(handle.currentWGS84, GUIDE_END_OCCLUDED_ICON_STYLE);
    }
  }

  override onDrawLabel(labelCanvas: LabelCanvas): void {
    const handle = this._activeHandle;
    if (!handle?.dragStartWGS84 || !handle.currentWGS84) {
      return;
    }
    let text: string;
    if (handle.kind === "height") {
      const diff = handle.currentWGS84.z - handle.dragStartWGS84.z;
      text = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}m`;
    } else {
      const startEpsg4978 = WGS84_TO_EPSG4978.transform(handle.dragStartWGS84);
      const currentEpsg4978 = WGS84_TO_EPSG4978.transform(handle.currentWGS84);
      text = `${distance(startEpsg4978, currentEpsg4978).toFixed(2)}m`;
    }
    labelCanvas.drawLabel(`<div class="ria-3d-shape-editor-label">${text}</div>`, handle.currentWGS84, {});
  }

  // --- Events ---

  override on(event: typeof SHAPE_CREATED_EVENT, callback: (evt: ShapeCreatedEvent) => void, context?: any): Handle;
  override on(event: typeof SHAPE_CHANGED_EVENT, callback: (evt: ShapeChangedEvent) => void, context?: any): Handle;
  override on(event: typeof SHAPE_EDITING_FINISHED_EVENT, callback: (evt: ShapeEditingFinishedEvent) => void, context?: any): Handle;
  override on(event: "Activated" | "Deactivated" | "Invalidated", callback: (...args: any[]) => void, context?: any): Handle;
  override on(event: string, callback: (...args: any[]) => void, context?: any): Handle {
    if (event === SHAPE_CREATED_EVENT || event === SHAPE_CHANGED_EVENT || event === SHAPE_EDITING_FINISHED_EVENT) {
      return this._eventedSupport.on(event, callback, context);
    }
    return super.on(event as any, callback, context);
  }
}
