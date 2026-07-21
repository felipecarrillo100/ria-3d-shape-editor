import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {ModifierType} from "@luciad/ria/view/input/ModifierType.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
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
import {computePointHandlePositions, PointHandlePositions} from "../handle/PointHandleLayout.js";
import {computeSegmentMidpointPosition} from "../handle/MidpointHandleLayout.js";
import {horizontalPlaneGridLines} from "../handle/horizontalPlaneGrid.js";
import {add, distance, normalize, scale, sub, toPoint} from "../math/Vector3Util.js";
import {formatLength, UomFamily} from "../uom/formatLength.js";
import {
  CANCEL_HANDLE_DEFAULT_ICON_STYLE,
  CANCEL_HANDLE_FOCUSED_ICON_STYLE,
  FINISH_HANDLE_DEFAULT_ICON_STYLE,
  FINISH_HANDLE_FOCUSED_ICON_STYLE,
  GUIDE_END_ICON_STYLE,
  GUIDE_END_OCCLUDED_ICON_STYLE,
  GUIDE_LINE_STYLE,
  GUIDE_START_ICON_STYLE,
  HEIGHT_DROP_LINE_OCCLUDED_STYLE,
  HEIGHT_DROP_LINE_STYLE,
  HEIGHT_HANDLE_DEFAULT_ICON_STYLE,
  HEIGHT_HANDLE_FOCUSED_ICON_STYLE,
  HEIGHT_HANDLE_SHIFT_ICON_STYLE,
  MIDPOINT_HOVERED_ICON_STYLE,
  MIDPOINT_HOVERED_OCCLUDED_ICON_STYLE,
  MIDPOINT_ICON_STYLE,
  MIDPOINT_OCCLUDED_ICON_STYLE,
  MOVE_HANDLE_DEFAULT_ICON_STYLE,
  MOVE_HANDLE_FOCUSED_ICON_STYLE,
  MOVE_HANDLE_SHIFT_ICON_STYLE,
  MOVE_PLANE_OCCLUDED_STYLE,
  MOVE_PLANE_STYLE,
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
const EPSG_4978 = getReference("EPSG:4978");
const WGS84_TO_EPSG4978 = createTransformation(WGS_84, EPSG_4978);
const EPSG4978_TO_WGS84 = createTransformation(EPSG_4978, WGS_84);

const DEFAULT_VERTEX_HIT_PIXEL_TOLERANCE = 12;
const DEFAULT_UOM: UomFamily = "metric";
const DEFAULT_SHOW_PLANE = false;
const DEFAULT_SHOW_DROP_LINE = false;
// Larger than PointHandleLayout.ts's own DEFAULT_HANDLE_OFFSET_FACTOR (0.04) - this plane is a
// visible ground reference, not a small icon offset, so it needs to read clearly at a glance.
const MOVE_PLANE_SIZE_FACTOR = 0.15;
// 5 grid divisions on each side of the center, per feedback - same overall footprint as before.
const MOVE_PLANE_GRID_DIVISIONS = 5;
// Same scale as the plane above, for the same reason - stays visually proportional regardless of zoom.
const HEIGHT_DROP_LINE_LENGTH_FACTOR = 0.15;
// No CSS anywhere in this package styles ".ria-3d-shape-editor-label" - inlined here so the label
// is legible over any background (sky, imagery, mesh) without requiring a consuming app to supply
// its own stylesheet. The class name is kept too, so a consuming app can still override via CSS
// specificity if it wants a different look.
const LABEL_STYLE = "color:#fff;font-weight:600;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;";

export interface Shape3DEditControllerOptions {
  /**
   * If given, the controller starts directly in edit mode on this existing shape instead of
   * creating a new one. Its type must match `shapeType`.
   */
  existingShape?: EditableShape;
  /** Pixel radius within which a click/hover counts as targeting a handle. Default 12. */
  vertexHitPixelTolerance?: number;
  /** Unit family for the live drag-distance label, auto-scaling within it. Default "metric". */
  uom?: UomFamily;
  /**
   * While dragging the horizontal (move) handle, draw a translucent reference plane at the
   * frozen height, so it's visually obvious the drag is constrained to a flat surface. Default
   * false.
   */
  showPlane?: boolean;
  /**
   * While dragging the height or free handle (both can change Z), draw a vertical line from the
   * current position downward, styled as a VISIBLE_ONLY/OCCLUDED_ONLY pair so the portion that
   * passes into/behind terrain or a mesh shows distinctly - a cheap, always-correct way to notice
   * "this has reached the ground/a building" without any raycasting. Default false.
   */
  showDropLine?: boolean;
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
  // Not readonly - updateController() can change these on an already-constructed instance.
  private _vertexHitPixelTolerance: number;
  private _uom: UomFamily;
  private _showPlane: boolean;
  private _showDropLine: boolean;

  private _phase: Phase;
  private _shape: EditableShape | null;
  private _originalShapeSnapshot: EditableShape | null;
  private _creationSession: CreationSession<EditableShape> | null;

  private _hoveredVertexIndex: number | null = null;
  /** Meaningful only when `_hoveredHandleKind === "midpoint"` - which segment is hovered. */
  private _hoveredSegmentIndex: number | null = null;
  private _hoveredHandleKind: HandleKind | null = null;
  private _activeHandle: EditHandle | null = null;
  /**
   * Whether Shift is currently held, tracked continuously on hover (not just at drag-start) so the
   * move/height handle icons can grow as soon as Shift is pressed - a discoverability cue for
   * "dragging this now shifts the whole shape," before the user ever starts dragging.
   */
  private _shiftHeld = false;
  /** Set right before `map.controller = null` by endEditing(); read once by onDeactivate. */
  private _pendingConfirmed = false;
  /**
   * The one vertex (of a possibly-many-vertex LineString/Polygon) that currently gets the full
   * handle set (free/move/height/finish/cancel) - every other vertex draws only a plain,
   * clickable marker, so editing a shape with many vertices doesn't become an unmanageable field
   * of overlapping handles. Always a valid index once _phase === EDITING (trivially always 0 for
   * Point, which only ever has one vertex). Meaningless while CREATING.
   *
   * Only meaningful when `_activeSegmentIndex === null` - the active target is either a real
   * vertex (this field) or a virtual midpoint (`_activeSegmentIndex`), never both.
   */
  private _activeVertexIndex = 0;
  /**
   * When non-null, a virtual per-segment midpoint (not `_activeVertexIndex`) is the active
   * target - selected by clicking it, showing the same full handle set a real active vertex
   * would. Dragging one of those handles promotes it into a real vertex right then (see
   * handleEditDrag) and clears this back to null; merely selecting it without dragging leaves the
   * shape untouched.
   */
  private _activeSegmentIndex: number | null = null;

  /**
   * `layer` is required so the controller can find the one reference (`layer.model.reference`) any
   * shape it creates must end up in - see the class doc. It is only ever read once, at construction
   * time; this controller does not otherwise interact with the layer (it does not add/remove
   * features, style anything on it, etc.).
   */
  constructor(shapeType: SupportedShapeType, layer: FeatureLayer, options?: Shape3DEditControllerOptions) {
    super();
    this._strategy = createShapeEditStrategy(shapeType);
    this._targetReference = layer.model.reference;
    this._vertexHitPixelTolerance = options?.vertexHitPixelTolerance ?? DEFAULT_VERTEX_HIT_PIXEL_TOLERANCE;
    this._uom = options?.uom ?? DEFAULT_UOM;
    this._showPlane = options?.showPlane ?? DEFAULT_SHOW_PLANE;
    this._showDropLine = options?.showDropLine ?? DEFAULT_SHOW_DROP_LINE;
    this._eventedSupport = new EventedSupport(
        [SHAPE_CREATED_EVENT, SHAPE_CHANGED_EVENT, SHAPE_EDITING_FINISHED_EVENT], true);

    const existingShape = options?.existingShape;
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

  /**
   * Updates any subset of this controller's options on an already-constructed instance, without
   * needing to tear it down and recreate it (which would lose any in-progress shape/session
   * state). The motivating case is `uom`: a UI toggle switching units live, possibly mid-drag.
   * None of these options interact with in-progress drag/shape state, so there's no
   * session-corruption risk to guard against.
   */
  updateController(options: Partial<Shape3DEditControllerOptions>): void {
    if (options.vertexHitPixelTolerance !== undefined) {
      this._vertexHitPixelTolerance = options.vertexHitPixelTolerance;
    }
    if (options.uom !== undefined) {
      this._uom = options.uom;
    }
    if (options.showPlane !== undefined) {
      this._showPlane = options.showPlane;
    }
    if (options.showDropLine !== undefined) {
      this._showDropLine = options.showDropLine;
    }
    this.invalidate();
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
    // A selected-but-not-yet-promoted midpoint's segment identity isn't tracked across a revert -
    // simplest to just deselect back to the (now valid again) active vertex.
    this._activeSegmentIndex = null;
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

  /** The full free/move/height/finish/cancel candidate set offered by whichever target (a real vertex or a virtual midpoint) is currently active. */
  private static fullHandleCandidates(positions: PointHandlePositions): Array<[HandleKind, Point | null]> {
    return [["free", positions.free], ["move", positions.move], ["height", positions.height],
            ["finish", positions.finish], ["cancel", positions.cancel]];
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
    let bestSegmentIndex = -1;
    let bestKind: HandleKind | null = null;
    let bestDistance = this._vertexHitPixelTolerance;

    for (let i = 0; i < count; i++) {
      const positions = computePointHandlePositions(map, this._strategy.getVertex(shape, i));
      // Only the active vertex offers the full handle set - every other vertex only offers its
      // plain marker as a hit target (nothing else is drawn for it, see drawEditHandles). If a
      // midpoint is the active target instead, no vertex is active - every vertex is downgraded
      // to just its plain marker.
      const candidates: Array<[HandleKind, Point | null]> =
          this._activeSegmentIndex === null && i === this._activeVertexIndex
              ? Shape3DEditController.fullHandleCandidates(positions)
              : [["free", positions.free]];
      for (const [kind, position] of candidates) {
        if (!position) {
          continue;
        }
        const pixelDistance = this.pixelDistanceToViewPoint(map, position, viewPoint);
        if (pixelDistance !== null && pixelDistance <= bestDistance) {
          bestDistance = pixelDistance;
          bestVertexIndex = i;
          bestSegmentIndex = -1;
          bestKind = kind;
        }
      }
    }

    // Virtual per-segment midpoint markers - LineString/Polygon only (Point has 0 segments, so
    // this loop is a no-op there). Folded into the same best-distance competition as the vertex
    // candidates above, so a midpoint only wins when it's genuinely the closest thing on screen.
    // The active midpoint (if any) offers the same full handle set an active vertex would, around
    // its calculated position - every other segment just offers its small "select me" marker.
    const segmentCount = this._strategy.isClosedRing ? count : count - 1;
    for (let i = 0; i < segmentCount; i++) {
      const a = this._strategy.getVertex(shape, i);
      const b = this._strategy.getVertex(shape, (i + 1) % count);
      const midpointPosition = computeSegmentMidpointPosition(map, a, b);
      const candidates: Array<[HandleKind, Point | null]> = this._activeSegmentIndex === i
          ? Shape3DEditController.fullHandleCandidates(computePointHandlePositions(map, midpointPosition))
          : [["midpoint", midpointPosition]];
      for (const [kind, position] of candidates) {
        if (!position) {
          continue;
        }
        const pixelDistance = this.pixelDistanceToViewPoint(map, position, viewPoint);
        if (pixelDistance !== null && pixelDistance <= bestDistance) {
          bestDistance = pixelDistance;
          bestVertexIndex = -1;
          bestSegmentIndex = i;
          bestKind = kind;
        }
      }
    }

    const found = bestKind !== null;
    const changed = bestVertexIndex !== this._hoveredVertexIndex ||
        bestSegmentIndex !== this._hoveredSegmentIndex || bestKind !== this._hoveredHandleKind;
    if (changed) {
      this._hoveredVertexIndex = bestVertexIndex >= 0 ? bestVertexIndex : null;
      this._hoveredSegmentIndex = bestSegmentIndex >= 0 ? bestSegmentIndex : null;
      this._hoveredHandleKind = found ? bestKind : null;
    }
    return changed;
  }

  private handleEditMove(map: WebGLMap, event: GestureEvent): HandleEventResult {
    if (this._activeHandle) {
      return EVENT_IGNORED;
    }
    const hoverChanged = this.updateHoverState(map, event.viewPoint);
    const shiftHeld = event.modifier === ModifierType.SHIFT;
    if (shiftHeld !== this._shiftHeld) {
      this._shiftHeld = shiftHeld;
      this.invalidate();
    } else if (hoverChanged) {
      this.invalidate();
    }
    return this._hoveredHandleKind !== null ? EVENT_HANDLED : EVENT_IGNORED;
  }

  /**
   * Clicking the finish (checkmark) or cancel (X) handle ends editing - see endEditing(). Clicking
   * a different (non-active) vertex's plain marker switches which vertex is active, moving the
   * full handle set there; clicking a virtual midpoint's plain marker does the same, making it the
   * active target instead of any vertex - either way, this is the only way to activate a target,
   * dragging one directly does nothing (see handleEditDrag) since a click and a drag are mutually
   * exclusive outcomes of a single mouse gesture, not two separate steps. Selecting a midpoint
   * does NOT touch the shape by itself - only a drag on one of its now-visible handles promotes it
   * into a real vertex (see handleEditDrag); selecting it and never dragging leaves it virtual.
   * Any other click (on another handle, or on empty space) is a no-op here. An earlier version
   * tried to treat any click on empty space as "end editing," but that turned out to be unreliable
   * in practice - a real click almost always has a pixel or two of movement between mouse-down and
   * mouse-up, which can register as the start of a camera drag before it's ever seen as "nothing
   * hovered." Dedicated, always-visible handles are unambiguous instead.
   */
  private handleEditClick(map: WebGLMap, event: GestureEvent): HandleEventResult {
    if ((event.domEvent as MouseEvent).button !== undefined && (event.domEvent as MouseEvent).button !== 0) {
      return EVENT_IGNORED;
    }
    if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel") {
      this.endEditing(this._hoveredHandleKind === "finish");
      return EVENT_HANDLED;
    }
    if (this._hoveredHandleKind === "midpoint" && this._hoveredSegmentIndex !== null) {
      this._activeSegmentIndex = this._hoveredSegmentIndex;
      this.invalidate();
      return EVENT_HANDLED;
    }
    if (this._hoveredVertexIndex !== null &&
        (this._activeSegmentIndex !== null || this._hoveredVertexIndex !== this._activeVertexIndex)) {
      this._activeVertexIndex = this._hoveredVertexIndex;
      this._activeSegmentIndex = null;
      this.invalidate();
      return EVENT_HANDLED;
    }
    return this._hoveredHandleKind !== null ? EVENT_HANDLED : EVENT_IGNORED;
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
      if (this._hoveredHandleKind === null) {
        return EVENT_IGNORED;
      }
      if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel") {
        // Both are click targets, not drag targets - absorb the gesture (so it doesn't pan the
        // camera through what's meant to be a fixed button) without acting on it.
        return EVENT_HANDLED;
      }
      if (this._hoveredHandleKind === "midpoint") {
        // A drag never selects a midpoint by itself - only a click does (handleEditClick). Once
        // selected/active, its own move/height/free handles become draggable below.
        return EVENT_HANDLED;
      }

      const kind = this._hoveredHandleKind;
      // Shift never applies to "free" - that gesture was never part of this feature's scope, so a
      // Shift+free drag behaves exactly as if Shift weren't held at all (including still
      // promoting an active midpoint, same as any other non-Shift drag on one).
      const shiftWholeShape = event.modifier === ModifierType.SHIFT && kind !== "free";

      let vertexIndex: number | null;
      let anchorPointInShapeRef: Point;
      if (this._activeSegmentIndex !== null) {
        if (this._hoveredSegmentIndex !== this._activeSegmentIndex) {
          // Only the active midpoint's own handles are draggable - same rule as a non-active
          // vertex just below.
          return EVENT_HANDLED;
        }
        const count = this._strategy.vertexCount(shape);
        const segmentIndex = this._activeSegmentIndex;
        const a = this._strategy.getVertex(shape, segmentIndex);
        const b = this._strategy.getVertex(shape, (segmentIndex + 1) % count);
        const midpointInMapRef = computeSegmentMidpointPosition(map, a, b);
        anchorPointInShapeRef = createTransformation(map.reference, shape.reference!).transform(midpointInMapRef);

        if (shiftWholeShape) {
          // Shift shifts the whole shape without ever promoting this midpoint into a real
          // vertex - nothing about a uniform shift needs a new vertex here.
          vertexIndex = null;
        } else {
          // Dragging one of the active midpoint's handles is what promotes it into a real,
          // committed vertex, right here - before the drag continues exactly like an ordinary
          // "free"/"move"/"height" drag on that new vertex, via the unmodified code below.
          vertexIndex = segmentIndex + 1;
          this._strategy.insertVertex(shape, vertexIndex, anchorPointInShapeRef);
          this._activeVertexIndex = vertexIndex;
          this._activeSegmentIndex = null;
          this.emitShapeChanged();
        }
      } else {
        if (this._hoveredVertexIndex !== this._activeVertexIndex) {
          // Only the active vertex's handles are draggable - a non-active vertex's plain marker
          // only responds to a click (which switches active, see handleEditClick), never a drag.
          // Absorb rather than ignore, same reasoning as the finish/cancel case just above.
          return EVENT_HANDLED;
        }
        vertexIndex = this._hoveredVertexIndex!;
        anchorPointInShapeRef = this._strategy.getVertex(shape, vertexIndex);
      }

      const handle = new EditHandle(kind);
      handle.vertexIndex = vertexIndex;
      handle.focused = true;
      this._activeHandle = handle;

      handle.interactionFunction =
          kind === "height" ? verticalMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef) :
          kind === "move" ? horizontalMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef) :
          freeMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef);
      handle.dragStartWGS84 =
          createTransformation(anchorPointInShapeRef.reference!, WGS_84).transform(anchorPointInShapeRef).copy();

      if (shiftWholeShape) {
        handle.shiftWholeShape = true;
        const count = this._strategy.vertexCount(shape);
        handle.allVerticesStartWGS84 = [];
        for (let i = 0; i < count; i++) {
          const vertex = this._strategy.getVertex(shape, i);
          handle.allVerticesStartWGS84.push(createTransformation(vertex.reference!, WGS_84).transform(vertex).copy());
        }
      }
    }

    const handle = this._activeHandle;
    const resultWGS84 = handle.interactionFunction!(event.viewPoint);
    handle.currentWGS84 = resultWGS84.copy();

    if (handle.shiftWholeShape && handle.allVerticesStartWGS84) {
      if (handle.kind === "height") {
        const heightDelta = resultWGS84.z - handle.dragStartWGS84!.z;
        handle.allVerticesStartWGS84.forEach((start, i) => {
          const updated = start.copy();
          updated.z += heightDelta;
          this._strategy.moveVertex(shape, i, createTransformation(WGS_84, shape.reference!).transform(updated));
        });
      } else {
        // "move" - the delta must be a Cartesian vector (EPSG:4978), not a raw WGS84 lon/lat
        // difference: degrees-per-meter-of-longitude varies by latitude, so adding a raw lon/lat
        // delta uniformly would NOT be a uniform real-world shift (the same reason
        // ShapeEditStrategy.translateWholeShape isn't used here either).
        const startEpsg4978 = WGS84_TO_EPSG4978.transform(handle.dragStartWGS84!);
        const deltaEpsg4978 = sub(WGS84_TO_EPSG4978.transform(resultWGS84), startEpsg4978);
        handle.allVerticesStartWGS84.forEach((start, i) => {
          const updatedEpsg4978 = add(WGS84_TO_EPSG4978.transform(start), deltaEpsg4978);
          const updatedWGS84 = EPSG4978_TO_WGS84.transform(toPoint(EPSG_4978, updatedEpsg4978));
          this._strategy.moveVertex(shape, i, createTransformation(WGS_84, shape.reference!).transform(updatedWGS84));
        });
      }
    } else {
      const resultInShapeRef = createTransformation(WGS_84, shape.reference!).transform(resultWGS84);
      this._strategy.moveVertex(shape, handle.vertexIndex!, resultInShapeRef);
    }
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
    } else if (this._hoveredHandleKind === "midpoint") {
      // Segment indexing shifts globally on a removal - a stale hovered segment isn't worth
      // reconciling, it'll be recomputed on the next mouse move regardless.
      this._hoveredSegmentIndex = null;
      this._hoveredHandleKind = null;
    }
    // Keep exactly one active vertex, always - either the same logical one (reindexed), or,
    // if the active vertex was the one just removed, whatever now occupies its old slot. A
    // selected-but-not-yet-promoted midpoint doesn't survive a removal either, same reasoning as
    // the stale hover above - just fall back to the active vertex.
    this._activeVertexIndex =
        nextActiveVertexIndex(this._activeVertexIndex, index, this._strategy.vertexCount(shape));
    this._activeSegmentIndex = null;
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

  /**
   * Draws the free/move/height/finish/cancel handle set at `positions` - shared by the active
   * vertex and the active midpoint, the only two things that ever get the full set. `shiftHeld`
   * only affects the move/height icons' size, independent of `activeKind`'s color - see the new
   * `*_SHIFT_ICON_STYLE` constants.
   */
  private drawFullHandleSet(geoCanvas: GeoCanvas, positions: PointHandlePositions, activeKind: HandleKind | null, shiftHeld: boolean): void {
    if (activeKind === "free") {
      geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_ICON_STYLE);
      geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_OCCLUDED_ICON_STYLE);
    } else {
      geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
    }
    if (positions.move) {
      geoCanvas.drawIcon(positions.move, shiftHeld ? MOVE_HANDLE_SHIFT_ICON_STYLE :
          activeKind === "move" ? MOVE_HANDLE_FOCUSED_ICON_STYLE : MOVE_HANDLE_DEFAULT_ICON_STYLE);
    }
    if (positions.height) {
      geoCanvas.drawIcon(positions.height, shiftHeld ? HEIGHT_HANDLE_SHIFT_ICON_STYLE :
          activeKind === "height" ? HEIGHT_HANDLE_FOCUSED_ICON_STYLE : HEIGHT_HANDLE_DEFAULT_ICON_STYLE);
    }
    if (positions.finish) {
      geoCanvas.drawIcon(positions.finish, activeKind === "finish" ? FINISH_HANDLE_FOCUSED_ICON_STYLE : FINISH_HANDLE_DEFAULT_ICON_STYLE);
    }
    if (positions.cancel) {
      geoCanvas.drawIcon(positions.cancel, activeKind === "cancel" ? CANCEL_HANDLE_FOCUSED_ICON_STYLE : CANCEL_HANDLE_DEFAULT_ICON_STYLE);
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

      if (this._activeSegmentIndex !== null || i !== this._activeVertexIndex) {
        // No vertex is active while a midpoint is the active target instead - every vertex draws
        // just a plain, clickable marker (click it to make it active); same for a non-active
        // vertex when nothing else is selected. No move/height/finish/cancel clutter for shapes
        // with many vertices.
        geoCanvas.drawIcon(positions.free, VERTEX_INACTIVE_ICON_STYLE);
        geoCanvas.drawIcon(positions.free, VERTEX_INACTIVE_OCCLUDED_ICON_STYLE);
        continue;
      }

      const activeKind: HandleKind | null =
          i === this._activeHandle?.vertexIndex ? this._activeHandle!.kind :
          i === this._hoveredVertexIndex ? this._hoveredHandleKind :
          null;
      this.drawFullHandleSet(geoCanvas, positions, activeKind, this._shiftHeld);
    }

    // Virtual per-segment midpoint markers - recomputed live from the current vertex list every
    // frame, so once one is promoted (see handleEditDrag), the two new segments either side of it
    // get their own fresh midpoints automatically, with no extra bookkeeping needed here. The
    // active midpoint (if any) gets the same full handle set an active vertex would, around its
    // calculated (not-yet-committed) position; every other segment just gets its small marker,
    // brightened while hovered as a "you can select this" cue.
    const segmentCount = this._strategy.isClosedRing ? count : count - 1;
    for (let i = 0; i < segmentCount; i++) {
      const a = this._strategy.getVertex(shape, i);
      const b = this._strategy.getVertex(shape, (i + 1) % count);
      const midpoint = computeSegmentMidpointPosition(map, a, b);

      if (this._activeSegmentIndex !== i) {
        const hovered = this._hoveredHandleKind === "midpoint" && this._hoveredSegmentIndex === i;
        geoCanvas.drawIcon(midpoint, hovered ? MIDPOINT_HOVERED_ICON_STYLE : MIDPOINT_ICON_STYLE);
        geoCanvas.drawIcon(midpoint, hovered ? MIDPOINT_HOVERED_OCCLUDED_ICON_STYLE : MIDPOINT_OCCLUDED_ICON_STYLE);
        continue;
      }

      const positions = computePointHandlePositions(map, midpoint);
      // An in-progress Shift+midpoint drag keeps _activeSegmentIndex set for the whole gesture
      // (never promoted/cleared, unlike the normal path) - recognize that case too, so the
      // dragged handle keeps its focused color for the whole drag, not just while the mouse
      // happens to sit exactly on the hover pixel.
      const activeKind: HandleKind | null =
          this._activeHandle && this._activeHandle.vertexIndex === null && this._activeSegmentIndex === i
              ? this._activeHandle.kind :
          this._hoveredSegmentIndex === i ? this._hoveredHandleKind :
          null;
      this.drawFullHandleSet(geoCanvas, positions, activeKind, this._shiftHeld);
    }

    const handle = this._activeHandle;
    if (handle?.dragStartWGS84 && handle.currentWGS84) {
      const line = createPolyline(WGS_84, [handle.dragStartWGS84, handle.currentWGS84]);
      geoCanvas.drawShape(line, GUIDE_LINE_STYLE);
      geoCanvas.drawIcon(handle.dragStartWGS84, GUIDE_START_ICON_STYLE);
      geoCanvas.drawIcon(handle.currentWGS84, GUIDE_END_ICON_STYLE);
      geoCanvas.drawIcon(handle.currentWGS84, GUIDE_END_OCCLUDED_ICON_STYLE);
    }

    // Centered on the live dragged position (not the drag's start), so the grid visually tracks
    // the point as it slides. Only for the horizontal (move) handle - that's the one interaction
    // this is meant to visually ground ("you're sliding along this flat surface").
    if (this._showPlane && handle?.kind === "move" && handle.currentWGS84) {
      const centerEpsg4978 = WGS84_TO_EPSG4978.transform(handle.currentWGS84);
      const up = normalize(centerEpsg4978);
      const size = distance(map.camera.eye, centerEpsg4978) * MOVE_PLANE_SIZE_FACTOR;
      const gridLines = horizontalPlaneGridLines(centerEpsg4978, up, size, MOVE_PLANE_GRID_DIVISIONS)
          .map(([a, b]) => createPolyline(EPSG_4978, [toPoint(EPSG_4978, a), toPoint(EPSG_4978, b)]));
      const grid = createShapeList(EPSG_4978, gridLines);
      geoCanvas.drawShape(grid, MOVE_PLANE_STYLE);
      geoCanvas.drawShape(grid, MOVE_PLANE_OCCLUDED_STYLE);
    }

    // Anchored to the drag's start position, not the live dragged position - it stays planted
    // where the vertex originally was, for the whole drag, unlike the yellow guide line (which
    // tracks the live position). Along the drag's own already-correct true-vertical axis - no
    // raycasting needed, and no computed ground intersection either: RIA's own depth test is what
    // actually reveals "this has reached the ground/a building," via the OCCLUDED_ONLY portion of
    // the line. Restricted to "height" only - "move" is about horizontal position with its own
    // plane-based occlusion cue, and "free" is already continuously re-snapped to a surface, so a
    // ground-line adds nothing.
    if (this._showDropLine && handle?.dragStartWGS84 && handle.kind === "height") {
      const topEpsg4978 = WGS84_TO_EPSG4978.transform(handle.dragStartWGS84);
      const up = normalize(topEpsg4978);
      // Length is fixed for the whole drag too - based on the same fixed top point, so it never
      // changes frame to frame.
      const dropLength = distance(map.camera.eye, topEpsg4978) * HEIGHT_DROP_LINE_LENGTH_FACTOR;
      const bottomEpsg4978 = add(topEpsg4978, scale(up, -dropLength));
      const dropLine = createPolyline(EPSG_4978, [toPoint(EPSG_4978, topEpsg4978), toPoint(EPSG_4978, bottomEpsg4978)]);
      geoCanvas.drawShape(dropLine, HEIGHT_DROP_LINE_STYLE);
      geoCanvas.drawShape(dropLine, HEIGHT_DROP_LINE_OCCLUDED_STYLE);
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
      text = `${diff >= 0 ? "+" : ""}${formatLength(diff, this._uom)}`;
    } else {
      const startEpsg4978 = WGS84_TO_EPSG4978.transform(handle.dragStartWGS84);
      const currentEpsg4978 = WGS84_TO_EPSG4978.transform(handle.currentWGS84);
      text = formatLength(distance(startEpsg4978, currentEpsg4978), this._uom);
    }
    labelCanvas.drawLabel(`<div class="ria-3d-shape-editor-label" style="${LABEL_STYLE}">${text}</div>`, handle.currentWGS84, {});
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
