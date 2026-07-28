import {Controller} from "@luciad/ria/view/controller/Controller.js";
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {CursorHandle} from "@luciad/ria/view/CursorManager.js";
import {GestureEvent} from "@luciad/ria/view/input/GestureEvent.js";
import {GestureEventType} from "@luciad/ria/view/input/GestureEventType.js";
import {KeyEvent} from "@luciad/ria/view/input/KeyEvent.js";
import {EVENT_HANDLED, EVENT_IGNORED, HandleEventResult} from "@luciad/ria/view/controller/HandleEventResult.js";
import {GeoCanvas} from "@luciad/ria/view/style/GeoCanvas.js";
import {LabelCanvas} from "@luciad/ria/view/style/LabelCanvas.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {createArcBand, createExtrudedShape, createPoint, createPolyline, createShapeList} from "@luciad/ria/shape/ShapeFactory.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {createEllipsoidalGeodesy} from "@luciad/ria/geodesy/GeodesyFactory.js";
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
  azimuthToGroundProjectedPoint,
  freeMovePointInteraction,
  horizontalMovePointInteraction,
  horizontalRotateAzimuthInteraction,
  verticalMovePointInteraction,
} from "../handle/HandleInteractions.js";
import {findClosestVertexIndex} from "../handle/VertexHitTest.js";
import {computePointHandlePositions, PointHandlePositions} from "../handle/PointHandleLayout.js";
import {computeSegmentMidpointPosition} from "../handle/MidpointHandleLayout.js";
import {horizontalPlaneGridLines} from "../handle/horizontalPlaneGrid.js";
import {HtmlToolbar, HtmlToolbarLabels} from "../handle/HtmlToolbar.js";
import {add, distance, normalize, sub, toPoint} from "../math/Vector3Util.js";
import {formatLength, UomFamily} from "../uom/formatLength.js";
import {
  CANCEL_HANDLE_DEFAULT_ICON_STYLE,
  CANCEL_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  CANCEL_HANDLE_FOCUSED_ICON_STYLE,
  CANCEL_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  DROP_LINE_OCCLUDED_STYLE,
  DROP_LINE_STYLE,
  FINISH_HANDLE_DEFAULT_ICON_STYLE,
  FINISH_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  FINISH_HANDLE_FOCUSED_ICON_STYLE,
  FINISH_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  GUIDE_END_ICON_STYLE,
  GUIDE_END_OCCLUDED_ICON_STYLE,
  GUIDE_LINE_OCCLUDED_STYLE,
  GUIDE_LINE_STYLE,
  GUIDE_START_ICON_STYLE,
  GUIDE_START_OCCLUDED_ICON_STYLE,
  HEIGHT_HANDLE_DEFAULT_ICON_STYLE,
  HEIGHT_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  HEIGHT_HANDLE_FOCUSED_ICON_STYLE,
  HEIGHT_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  HEIGHT_HANDLE_SHIFT_ICON_STYLE,
  HEIGHT_HANDLE_SHIFT_OCCLUDED_ICON_STYLE,
  MIDPOINT_HOVERED_ICON_STYLE,
  MIDPOINT_HOVERED_OCCLUDED_ICON_STYLE,
  MIDPOINT_ICON_STYLE,
  MIDPOINT_OCCLUDED_ICON_STYLE,
  MOVE_HANDLE_DEFAULT_ICON_STYLE,
  MOVE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  MOVE_HANDLE_FOCUSED_ICON_STYLE,
  MOVE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  MOVE_HANDLE_SHIFT_ICON_STYLE,
  MOVE_HANDLE_SHIFT_OCCLUDED_ICON_STYLE,
  MOVE_PLANE_OCCLUDED_STYLE,
  MOVE_PLANE_STYLE,
  PREVIEW_CLOSING_SEGMENT_OCCLUDED_STYLE,
  PREVIEW_CLOSING_SEGMENT_STYLE,
  PREVIEW_SHAPE_OCCLUDED_STYLE,
  PREVIEW_SHAPE_STYLE,
  REMOVE_HANDLE_DEFAULT_ICON_STYLE,
  REMOVE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  REMOVE_HANDLE_FOCUSED_ICON_STYLE,
  REMOVE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  ROTATE_ARC_BAND_OCCLUDED_STYLE,
  ROTATE_ARC_BAND_STYLE,
  ROTATE_HANDLE_DEFAULT_ICON_STYLE,
  ROTATE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE,
  ROTATE_HANDLE_FOCUSED_ICON_STYLE,
  ROTATE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE,
  SHIFT_TOGGLE_OFF_ICON_STYLE,
  SHIFT_TOGGLE_OFF_OCCLUDED_ICON_STYLE,
  SHIFT_TOGGLE_ON_ICON_STYLE,
  SHIFT_TOGGLE_ON_OCCLUDED_ICON_STYLE,
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
const WGS84_GEODESY = createEllipsoidalGeodesy(WGS_84);

const DEFAULT_VERTEX_HIT_PIXEL_TOLERANCE = 12;
// ~48px tap diameter - roughly Apple/Material's ~44-48px touch target guidance, vs. the ~24px
// diameter the plain default above gives a mouse pointer. Applied as a floor, not a fixed
// replacement (see effectiveHitTolerance) - an explicitly configured larger tolerance is never
// shrunk back down for touch.
const DEFAULT_TOUCH_VERTEX_HIT_PIXEL_TOLERANCE = 24;
// How far above the actual touch point the actively-dragged icon is drawn, so a finger never
// hides the very thing it's dragging - the same "handle floats above your fingertip" idiom
// iOS/Android text-selection handles use. Not needed for a mouse, which has its own visible cursor
// off to the side of whatever it's pointing at.
const TOUCH_DRAG_OFFSET_PIXELS = 40;
// Short and identical for grab/drop - just enough to register as a deliberate cue, not a buzz.
const HAPTIC_PULSE_MS = 10;
const DEFAULT_UOM: UomFamily = "metric";
const DEFAULT_SHOW_PLANE = false;
const DEFAULT_SHOW_DROP_LINE = false;
const DEFAULT_HTML_TOOLBAR = false;
// Larger than PointHandleLayout.ts's own DEFAULT_HANDLE_OFFSET_FACTOR (0.04) - this plane is a
// visible ground reference, not a small icon offset, so it needs to read clearly at a glance.
const MOVE_PLANE_SIZE_FACTOR = 0.15;
// 5 grid divisions on each side of the center, per feedback - same overall footprint as before.
const MOVE_PLANE_GRID_DIVISIONS = 5;
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
   * While dragging the height or move handle, draw a vertical line from the vertex's current
   * position all the way down to Earth's center, styled as a VISIBLE_ONLY/OCCLUDED_ONLY pair so
   * the portion that passes into/behind terrain or a mesh shows distinctly - a cheap,
   * always-correct way to notice "this has reached the ground/a building" without any raycasting,
   * regardless of how high above the surface the vertex is or how zoomed in/out the camera is.
   * Default false.
   */
  showDropLine?: boolean;
  /**
   * When set (`true`, or an options object), renders Finish/Cancel as HTML icon buttons (X/
   * checkmark, matching the GeoCanvas-drawn icons - not text, so nothing here needs translation)
   * - and, while editing, a live/editable height input (a bare "m" unit suffix, also
   * translation-free) for the active vertex - instead of the GeoCanvas-drawn checkmark/X icons.
   * Small, 3D-anchored icons are harder to hit reliably with a finger than a fixed on-screen
   * button, and can end up tiny or off-screen at a distance/bad angle - this is meant as a
   * touch-friendly *alternative*, not an addition: whichever is active, the other is not drawn/
   * hit-tested at all (see drawFullHandleSet/fullHandleCandidates), so there's never a duplicate or
   * an invisible-but-still-clickable icon.
   *
   * `labels` only ever supplies `aria-label`/`title` attributes (for screen readers, which can't
   * read an icon) - never visible button text - so a consuming app only needs to translate these
   * three short phrases, not full UI copy:
   * ```
   * { labels: { cancel: "Annuler", finish: "Terminer", height: "Hauteur" } }
   * ```
   * Every element also gets a stable, documented CSS class name (`.ria-3d-shape-editor-toolbar`,
   * `.ria-3d-shape-editor-btn-finish`, `.ria-3d-shape-editor-btn-cancel`,
   * `.ria-3d-shape-editor-height-input`, `.ria-3d-shape-editor-height-unit`) with only minimal
   * inline default styling, so a consuming app can restyle it freely via CSS specificity - the same
   * convention already used for the live drag-distance label.
   *
   * Whether the toolbar exists at all is constructor-only - not settable via `updateController`,
   * since toggling it live would mean tearing down/recreating DOM mid-session for comparatively
   * little benefit. `labels`, however, CAN be updated live via `updateController` (e.g. a live
   * language switcher) - those are just attribute text on already-existing elements, not new DOM.
   * Default false.
   */
  htmlToolbar?: boolean | {labels?: HtmlToolbarLabels};
}

/**
 * A single controller that both creates and edits a Point, LineString (Polyline) or Polygon, with
 * independent per-vertex height (Z) control via dedicated drag handles - the capability missing
 * from LuciadRIA's stock BasicCreateController/EditController. Fully independent of any backend:
 * it only mutates the shape object it is given (or creates), and emits events describing what
 * happened - persistence is entirely the caller's responsibility.
 *
 * Each vertex offers up to several simultaneous, individually-grabbable handles: dragging the
 * vertex icon itself ("free") moves it in X/Y/Z, adopting whatever surface is under the cursor; a
 * small offset "move" handle (to the side) constrains the drag to X/Y only (height frozen); a
 * small offset "height" handle (above) constrains the drag to Z only (X/Y frozen); a click-only
 * "remove" handle (top-left, same horizontal offset as "move" mirrored to the other side, same
 * vertical offset as "height") removes the vertex outright (also reachable via double-click/
 * double-tap anywhere near a vertex - see removeVertexNear); a click-only "shiftToggle" handle
 * (the exact mirror of "move," on the opposite side) toggles whole-shape mode, which applies to
 * "free"/"move"/"height" alike - every other vertex is rigidly carried along by whichever one is
 * dragged; a drag-only "rotate" handle (top-right, the mirror of "remove") swings every other
 * vertex horizontally around the active vertex, which stays fixed as the pivot - only offered
 * while whole-shape mode is armed, since rotating a single vertex around itself is meaningless;
 * and a click-only pair below the vertex - a checkmark ("finish", confirm and end editing, down-right)
 * and an X ("cancel", discard and end editing, down-left), grouped together and deliberately
 * separated from the shape-adjusting handles above/beside the vertex. The move/height/finish/
 * cancel/shiftToggle/remove/rotate handles only appear on a 3D (EPSG:4978) map - see
 * HandleInteractions.ts's verticalMovePointInteraction guard.
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
  /** Constructor-only - see the option's own doc comment for why. */
  private readonly _htmlToolbar: boolean;
  /**
   * Only meaningful when `_htmlToolbar`. Not readonly - unlike `_htmlToolbar` itself (which stays
   * constructor-only, see its own doc comment), labels are plain attribute text on already-existing
   * elements, not new DOM, so `updateController` can safely update these live, mid-session.
   */
  private _htmlToolbarLabels: HtmlToolbarLabels | undefined;
  /** Created in onActivate/destroyed in onDeactivate, only when `_htmlToolbar`. */
  private _toolbar: HtmlToolbar | null = null;

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
   * Whether the current drag gesture's "does this grab a handle (or the shape body)" decision has
   * already been made, on its first DRAG frame - reset on DRAG_END/MOVE (both signal no drag is in
   * progress). See handleEditDrag's own comment for why this must only ever be decided once per
   * gesture, not re-evaluated against the live cursor position on every frame.
   */
  private _dragGestureChecked = false;
  /**
   * Whether whole-shape move/height mode is toggled on - set only by clicking/tapping the
   * dedicated shiftToggle handle (see handleEditClick). Sticky and global: it persists across
   * drags and across switching which vertex/midpoint is active, until explicitly toggled off
   * again - not reset anywhere else. Works identically for mouse and touch; there is no keyboard
   * modifier equivalent (Shift+drag was removed in favor of this single, discoverable mechanism).
   */
  private _shiftWholeShapeToggled = false;
  /** Set right before `map.controller = null` by endEditing(); read once by onDeactivate. */
  private _pendingConfirmed = false;
  /**
   * Subscribed in onActivate, removed in onDeactivate - without this, onDraw's output is cached by
   * the map and handle icon positions only recompute once a gesture routed through this controller
   * ends, so panning/orbiting the camera (handled entirely by the map's own navigation, not this
   * controller) would leave the handles visually frozen mid-drag and only "snap" into place once
   * the drag stops. MapChange fires once per rendered frame, so invalidating on every firing keeps
   * onDraw (and therefore the handle positions, already computed fresh from the live camera every
   * call) in sync throughout the whole gesture, not just at its end.
   */
  private _mapChangeHandle: Handle | null = null;
  /**
   * Set in onActivate only when starting in Phase.CREATING - a crosshair signals the controller is
   * active even before anything is drawn (LineString/Polygon draw nothing at all until the first
   * point is placed, unlike Point, whose rubber-band vertex icon gives immediate feedback). Removed
   * (and reset to null) the moment editing begins (finishCreation) or the controller deactivates
   * while still creating (onDeactivate, e.g. via Escape) - editing itself always keeps the default
   * pointer, since every interactive element there is already individually drawn, and a crosshair's
   * conventional "click to place" meaning doesn't match editing's actual click-to-select behavior.
   */
  private _creationCursorHandle: CursorHandle | null = null;
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
    this._htmlToolbar = !!(options?.htmlToolbar ?? DEFAULT_HTML_TOOLBAR);
    this._htmlToolbarLabels = typeof options?.htmlToolbar === "object" ? options.htmlToolbar.labels : undefined;
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
   *
   * `htmlToolbar` is special-cased: only its `labels` (if given as an options object) are applied
   * live - e.g. a language switcher calling this on locale change - matching the option's own doc
   * comment. Whether the toolbar exists at all was decided once, at construction; passing a plain
   * boolean here is a no-op, since there's no DOM lifecycle change to make.
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
    if (typeof options.htmlToolbar === "object") {
      this._htmlToolbarLabels = options.htmlToolbar.labels;
      this._toolbar?.setLabels(this._htmlToolbarLabels);
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

  /**
   * Ends the current editing session with `confirmed: true` - the programmatic equivalent of
   * clicking the finish/checkmark handle. No-op unless currently editing (mirrors `cancel()`'s own
   * phase gating). Before this existed, `confirmed: true` was only reachable by clicking the
   * built-in checkmark icon - this is what lets app-level UI (e.g. the `htmlToolbar` option's Done
   * button, or a caller's own custom UI) end editing the exact same way, without needing
   * `endEditing` itself to be public.
   */
  confirm(): void {
    if (this._phase !== Phase.EDITING || !this._shape) {
      return;
    }
    this.endEditing(true);
  }

  override onActivate(map: WebGLMap): void {
    super.onActivate(map);
    this._mapChangeHandle = map.on("MapChange", () => this.invalidate());
    if (this._phase === Phase.CREATING) {
      this._creationCursorHandle = map.cursorManager.addCursor("crosshair");
    }
    if (this._htmlToolbar) {
      this._toolbar = new HtmlToolbar(map.domNode, {
        onCancel: () => this.cancelSession(),
        onFinish: () => this._phase === Phase.CREATING ? this.finish() : this.confirm(),
        onHeightCommit: (meters) => this.applyHeightInput(meters),
      }, this._htmlToolbarLabels);
    }
  }

  override onDeactivate(map: WebGLMap): Promise<void> | void {
    if (this._phase === Phase.EDITING && this._shape) {
      this._eventedSupport.emit(SHAPE_EDITING_FINISHED_EVENT,
          {shape: this._shape, confirmed: this._pendingConfirmed} as ShapeEditingFinishedEvent);
    }
    this._mapChangeHandle?.remove();
    this._mapChangeHandle = null;
    this._creationCursorHandle?.remove();
    this._creationCursorHandle = null;
    this._toolbar?.destroy();
    this._toolbar = null;
    this._activeHandle = null;
    this._hoveredVertexIndex = null;
    this._hoveredHandleKind = null;
    this._pendingConfirmed = false;
    return super.onDeactivate(map);
  }

  /**
   * Applies a typed height (in meters, WGS84 ellipsoidal height) to the currently active vertex -
   * the `htmlToolbar` height input's commit handler. If a midpoint is merely selected but not yet
   * promoted, promotes it into a real vertex first, at its current (pre-edit) position - the same
   * `insertVertex` call already used when dragging one of its handles does the same promotion (see
   * handleEditDrag) - so this is exactly as O(1)/scalable as that already-existing path,
   * regardless of how many vertices the shape has.
   */
  private applyHeightInput(meters: number): void {
    const shape = this._shape;
    const map = this.map as WebGLMap | null;
    if (!shape || !map) {
      return;
    }
    if (this._activeSegmentIndex !== null) {
      const segmentIndex = this._activeSegmentIndex;
      const count = this._strategy.vertexCount(shape);
      const a = this._strategy.getVertex(shape, segmentIndex);
      const b = this._strategy.getVertex(shape, (segmentIndex + 1) % count);
      const midpointInMapRef = computeSegmentMidpointPosition(map, a, b);
      const anchorPointInShapeRef =
          createTransformation(midpointInMapRef.reference!, shape.reference!).transform(midpointInMapRef);
      this._activeVertexIndex = segmentIndex + 1;
      this._strategy.insertVertex(shape, this._activeVertexIndex, anchorPointInShapeRef);
      this._activeSegmentIndex = null;
      this.emitShapeChanged();
    }
    const vertex = this._strategy.getVertex(shape, this._activeVertexIndex);
    const vertexWGS84 = createTransformation(vertex.reference!, WGS_84).transform(vertex);
    this.setVertexPosition(this._activeVertexIndex, createPoint(WGS_84, [vertexWGS84.x, vertexWGS84.y, meters]));
  }

  /** Shared by Escape and the `htmlToolbar` Cancel button - see onKeyEvent's own doc comment. */
  private cancelSession(): void {
    if (this._phase === Phase.EDITING) {
      this.endEditing(false);
    } else if (this.map) {
      this.map.controller = null;
    }
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
    this.cancelSession();
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
        this.finishCreation(map, event.viewPoint, event.inputType);
      }
      return EVENT_HANDLED;
    } else if (event.type === GestureEventType.DOUBLE_CLICK) {
      if (!session.shape) {
        return EVENT_IGNORED;
      }
      const result = session.handleDoubleClick();
      this.invalidate();
      if (result === "finished") {
        this.finishCreation(map, event.viewPoint, event.inputType);
      }
      return EVENT_HANDLED;
    }
    return EVENT_IGNORED;
  }

  /**
   * `map`/`viewPoint`/`inputType` are only available when this is triggered by an actual gesture (a
   * click or double-click finishing creation) - `finish()` can also be called programmatically with
   * no cursor context, in which case the hover-priming step below is simply skipped (the next real
   * MOVE event will populate it, exactly as before this fix).
   */
  private finishCreation(map?: WebGLMap, viewPoint?: Point, inputType?: string): void {
    const shape = this._creationSession!.shape!;
    this._shape = shape;
    this._phase = Phase.EDITING;
    this._creationSession = null;
    this._creationCursorHandle?.remove();
    this._creationCursorHandle = null;
    if (map && viewPoint) {
      // Compute hover state at the click's own position right away, rather than waiting for a
      // subsequent MOVE event - otherwise a drag starting from the exact spot the shape was just
      // created at (with no mouse movement in between) would find nothing hovered and silently do
      // nothing, which looks indistinguishable from the controller having already deactivated.
      this.updateHoverState(map, viewPoint, inputType ?? "mouse");
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
   * The full handle candidate set offered by whichever target (a real vertex or a virtual
   * midpoint) is currently active - free/move/height/shiftToggle always, plus finish/cancel only
   * when `htmlToolbar` is off (see below), plus remove only when `canRemove` (a virtual, not yet
   * promoted midpoint has nothing to remove; a shape at its minimum vertex count can't lose one
   * either - see ShapeEditStrategy.canRemoveVertex), plus rotate only when `armed` (whole-shape
   * mode) - rotating a single vertex around itself is meaningless, and rotate is scoped to real
   * vertices only (a midpoint isn't a committed pivot), so callers always pass `false` for it at
   * the midpoint call site. It's one or the other for finish/cancel, never both: with
   * `htmlToolbar` on, the canvas finish/cancel icons aren't drawn either (see drawFullHandleSet),
   * so there'd be nothing visible to hit-test against - excluding them here keeps hover/click/drag
   * from ever recognizing an invisible hit zone in that area.
   */
  private static fullHandleCandidates(
      positions: PointHandlePositions, htmlToolbar: boolean, canRemove: boolean,
      armed: boolean): Array<[HandleKind, Point | null]> {
    const candidates: Array<[HandleKind, Point | null]> =
        [["free", positions.free], ["move", positions.move], ["height", positions.height],
         ["shiftToggle", positions.shiftToggle], ["remove", canRemove ? positions.remove : null],
         ["rotate", armed ? positions.rotate : null]];
    if (!htmlToolbar) {
      candidates.push(["finish", positions.finish], ["cancel", positions.cancel]);
    }
    return candidates;
  }

  /**
   * Recomputes which handle (if any) is under `viewPoint`, updating `_hoveredVertexIndex`/
   * `_hoveredHandleKind`. Returns whether the hovered handle changed (so callers can decide
   * whether a redraw is actually needed).
   */
  private updateHoverState(map: WebGLMap, viewPoint: Point, inputType: string): boolean {
    const shape = this._shape!;
    const count = this._strategy.vertexCount(shape);

    let bestVertexIndex = -1;
    let bestSegmentIndex = -1;
    let bestKind: HandleKind | null = null;
    let bestDistance = this.effectiveHitTolerance(inputType);

    for (let i = 0; i < count; i++) {
      const positions = computePointHandlePositions(map, this._strategy.getVertex(shape, i));
      // Only the active vertex offers the full handle set - every other vertex only offers its
      // plain marker as a hit target (nothing else is drawn for it, see drawEditHandles). If a
      // midpoint is the active target instead, no vertex is active - every vertex is downgraded
      // to just its plain marker.
      const candidates: Array<[HandleKind, Point | null]> =
          this._activeSegmentIndex === null && i === this._activeVertexIndex
              ? Shape3DEditController.fullHandleCandidates(
                  positions, this._htmlToolbar, this._strategy.canRemoveVertex(shape, i), this._shiftWholeShapeToggled)
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
          ? Shape3DEditController.fullHandleCandidates(computePointHandlePositions(map, midpointPosition), this._htmlToolbar, false, false)
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

  /**
   * Effective hit-test radius for a given event's input modality - touch gets a floor roughly
   * matching Apple/Material's ~44-48px touch target guidance (vs. mouse-pointer precision), never
   * shrinking an explicitly configured larger tolerance back down.
   */
  private effectiveHitTolerance(inputType: string): number {
    return inputType === "touch"
        ? Math.max(this._vertexHitPixelTolerance, DEFAULT_TOUCH_VERTEX_HIT_PIXEL_TOLERANCE)
        : this._vertexHitPixelTolerance;
  }

  private handleEditMove(map: WebGLMap, event: GestureEvent): HandleEventResult {
    // A MOVE event only ever fires between gestures (no button/finger down) - reaching this at
    // all means whatever drag gesture _dragGestureChecked was tracking has definitely ended, even
    // in the (unexpected) case that a DRAG_END was somehow missed.
    this._dragGestureChecked = false;
    if (this._activeHandle) {
      return EVENT_IGNORED;
    }
    const hoverChanged = this.updateHoverState(map, event.viewPoint, event.inputType);
    if (hoverChanged) {
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
    // Touch has no hover-before-contact - a MOVE may never have run at this exact position, so
    // recompute fresh here too instead of only trusting whatever a prior MOVE left behind.
    this.updateHoverState(map, event.viewPoint, event.inputType);
    if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel") {
      this.endEditing(this._hoveredHandleKind === "finish");
      return EVENT_HANDLED;
    }
    if (this._hoveredHandleKind === "shiftToggle") {
      this._shiftWholeShapeToggled = !this._shiftWholeShapeToggled;
      this.invalidate();
      return EVENT_HANDLED;
    }
    if (this._hoveredHandleKind === "remove") {
      return this.removeVertexAtIndex(this._activeVertexIndex);
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
      if (this._dragGestureChecked) {
        // Already decided, on this same gesture's first DRAG frame, that nothing here is
        // grabbable - a pan/orbit drag that started on empty space must never retroactively
        // "become" a handle grab just because the live cursor happens to sweep across one
        // mid-drag; only the drag's own actual start position counts. Without this, a plain map
        // pan whose path crosses a move/height handle would unexpectedly start dragging it.
        return EVENT_IGNORED;
      }
      this._dragGestureChecked = true;

      // Touch has no hover-before-contact - a MOVE may never have run at this drag's start
      // position, so recompute fresh here too instead of only trusting a prior MOVE.
      this.updateHoverState(map, event.viewPoint, event.inputType);
      if (this._hoveredHandleKind === null) {
        return EVENT_IGNORED;
      }
      if (this._hoveredHandleKind === "finish" || this._hoveredHandleKind === "cancel" ||
          this._hoveredHandleKind === "shiftToggle" || this._hoveredHandleKind === "remove") {
        // All four are click targets, not drag targets - absorb the gesture (so it doesn't pan
        // the camera through what's meant to be a fixed button) without acting on it.
        return EVENT_HANDLED;
      }
      if (this._hoveredHandleKind === "midpoint") {
        // A drag never selects a midpoint by itself - only a click does (handleEditClick). Once
        // selected/active, its own move/height/free handles become draggable below.
        return EVENT_HANDLED;
      }

      const kind = this._hoveredHandleKind;
      // "free" participates in whole-shape mode too: the dragged vertex keeps conforming to
      // whatever surface is under the cursor (freeMovePointInteraction, unchanged), and every
      // other vertex is rigidly carried along by that same 3D delta - not independently re-draped
      // onto its own local terrain. The delta-application block below already computes a full 3D
      // ECEF delta (not just horizontal) for anything that isn't "height", so no extra math is
      // needed here to support this. Same consequence as move/height when armed: dragging a
      // not-yet-promoted midpoint shifts the whole shape without ever promoting it into a real
      // vertex, since the vertex set itself isn't changing.
      const shiftWholeShape = this._shiftWholeShapeToggled;

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
          // Whole-shape mode shifts the whole shape without ever promoting this midpoint into a
          // real vertex - nothing about a uniform shift needs a new vertex here.
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
      handle.isTouch = event.inputType === "touch";
      this._activeHandle = handle;
      if (handle.isTouch) {
        this.vibrate(HAPTIC_PULSE_MS);
      }

      handle.dragStartWGS84 =
          createTransformation(anchorPointInShapeRef.reference!, WGS_84).transform(anchorPointInShapeRef).copy();

      if (kind === "rotate") {
        // Rotate never produces a single evolving position (the pivot itself never moves), so it
        // doesn't fit interactionFunction's Point-returning signature - it gets its own function.
        handle.rotationInteractionFunction = horizontalRotateAzimuthInteraction(map, event.viewPoint, anchorPointInShapeRef);
        // Captured once, independently of the interaction function above, so the rotate-arc
        // visual's own "start" edge (drawn in drawEditHandles) has a fixed reference to draw from.
        handle.rotationStartAzimuth = azimuthToGroundProjectedPoint(map, event.viewPoint, handle.dragStartWGS84);
      } else {
        handle.interactionFunction =
            kind === "height" ? verticalMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef) :
            kind === "move" ? horizontalMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef) :
            freeMovePointInteraction(map, event.viewPoint, anchorPointInShapeRef);
      }

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

    if (handle.kind === "rotate") {
      const rawDeltaAzimuth = handle.rotationInteractionFunction!(event.viewPoint);
      // horizontalRotateAzimuthInteraction always returns a value in (-180, 180], so a genuine
      // continuous sweep across that boundary would otherwise visually jump from one side to the
      // other every frame - most noticeably in the arc-band and label below, though the rotation
      // itself is unaffected either way (azimuth is inherently mod 360). Detect the tell-tale sign
      // of a wrap (the sign flipped and the apparent frame-to-frame jump is implausibly large) and
      // add/subtract a full turn to keep the value continuous - the same heuristic the toolbox's
      // own RotateHandleSupport.update() uses (inspired by, not copied from).
      const previousDeltaAzimuth = handle.rotationDeltaDegrees;
      const deltaAzimuth = previousDeltaAzimuth !== null &&
          rawDeltaAzimuth * previousDeltaAzimuth < 0 && Math.abs(rawDeltaAzimuth - previousDeltaAzimuth) > 180
          ? rawDeltaAzimuth + (rawDeltaAzimuth < 0 ? 360 : -360)
          : rawDeltaAzimuth;
      handle.rotationDeltaDegrees = deltaAzimuth;
      // Always rotate the pristine drag-start positions by the total delta-from-start, not the
      // shape's already-mutated live positions by this frame's delta - otherwise every frame would
      // compound on top of the previous frame's rotation instead of recomputing a fresh, correct
      // absolute result each time (the same reason move/height's own whole-shape branches below
      // always read from allVerticesStartWGS84, never from the live shape, while a drag is active).
      this.rotateOtherVerticesAround(handle.dragStartWGS84!, deltaAzimuth, handle.vertexIndex, handle.allVerticesStartWGS84!);
      this.emitShapeChanged();
      this.invalidate();
      return EVENT_HANDLED;
    }

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

  /**
   * Rotates every vertex except `pivotVertexIndex` around `pivotWGS84` by `deltaAzimuthDegrees`,
   * horizontally (around the pivot's local "up" axis) - each vertex's own height is left exactly
   * unchanged (a pure yaw rotation). `startPositionsWGS84` must be each vertex's own position at
   * drag start (`EditHandle.allVerticesStartWGS84`), not the shape's live/already-mutated
   * positions - the total delta-from-start is re-applied to the pristine start every frame, so
   * frames never compound on top of each other's rotation. Uses plain ellipsoidal geodesy (bearing
   * + distance + interpolate-by-azimuth) rather than a 3D Cartesian vector rotation - see the
   * class doc/plan for why that's sufficient here. Extracted as its own method so it can be
   * unit-tested directly without simulating a full drag gesture (same reasoning as
   * removeVertexAtIndex).
   */
  private rotateOtherVerticesAround(
      pivotWGS84: Point, deltaAzimuthDegrees: number, pivotVertexIndex: number | null,
      startPositionsWGS84: Point[]): void {
    const shape = this._shape!;
    startPositionsWGS84.forEach((vertexWGS84, i) => {
      if (i === pivotVertexIndex) {
        return;
      }
      const dist = WGS84_GEODESY.distance(pivotWGS84, vertexWGS84);
      const azimuth = WGS84_GEODESY.forwardAzimuth(pivotWGS84, vertexWGS84);
      const rotated = WGS84_GEODESY.interpolate(pivotWGS84, dist, azimuth + deltaAzimuthDegrees);
      const newPoint = createPoint(WGS_84, [rotated.x, rotated.y, vertexWGS84.z]);
      this._strategy.moveVertex(shape, i, createTransformation(WGS_84, shape.reference!).transform(newPoint));
    });
  }

  private handleEditDragEnd(): HandleEventResult {
    this._dragGestureChecked = false;
    if (!this._activeHandle) {
      return EVENT_IGNORED;
    }
    if (this._activeHandle.isTouch) {
      this.vibrate(HAPTIC_PULSE_MS);
    }
    this._activeHandle.endInteraction();
    this._activeHandle = null;
    this.invalidate();
    return EVENT_HANDLED;
  }

  private handleEditDoubleClick(map: WebGLMap, event: GestureEvent): HandleEventResult {
    return this.removeVertexNear(map, event);
  }

  private removeVertexNear(map: WebGLMap, event: GestureEvent): HandleEventResult {
    const shape = this._shape!;
    const index = findClosestVertexIndex(map, event.viewPoint, shape, this._strategy, this.effectiveHitTolerance(event.inputType));
    return this.removeVertexAtIndex(index);
  }

  /**
   * Removes the vertex at `index` (a no-op if it's out of range or the shape is already at its
   * minimum vertex count) - shared by double-click/double-tap removal (`removeVertexNear`, which
   * hit-tests to find `index`) and the `remove` handle's click (which already knows `index` is
   * `_activeVertexIndex`, and that it's removable, since the handle candidate is gated on
   * `canRemoveVertex` in the first place - see `fullHandleCandidates`).
   */
  private removeVertexAtIndex(index: number): HandleEventResult {
    const shape = this._shape!;
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

  /** Safe no-op when the Vibration API is unavailable (e.g. desktop, or iOS Safari, which never implemented it). */
  private vibrate(ms: number): void {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
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
    // No canvas finish/cancel affordance exists during CREATING either (see class doc/comments
    // elsewhere) - the htmlToolbar option mirrors that, only appearing once editing begins.
    this._toolbar?.setVisible(false);
    if (!shape) {
      return;
    }
    if (shape.type === ShapeType.POINT) {
      geoCanvas.drawIcon(shape, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(shape, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
      return;
    }
    geoCanvas.drawShape(shape, PREVIEW_SHAPE_STYLE);
    geoCanvas.drawShape(shape, PREVIEW_SHAPE_OCCLUDED_STYLE);
    const count = this._strategy.vertexCount(shape);
    for (let i = 0; i < count; i++) {
      const vertex = this._strategy.getVertex(shape, i);
      geoCanvas.drawIcon(vertex, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(vertex, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
    }
    const closingSegment = this._strategy.getPreviewClosingSegment(shape);
    if (closingSegment) {
      const closingSegmentShape = createPolyline(shape.reference!, closingSegment);
      geoCanvas.drawShape(closingSegmentShape, PREVIEW_CLOSING_SEGMENT_STYLE);
      geoCanvas.drawShape(closingSegmentShape, PREVIEW_CLOSING_SEGMENT_OCCLUDED_STYLE);
    }
  }

  /**
   * While actively touch-dragging one of `positions`' own icons, returns a copy with that one
   * icon's position offset a fixed number of pixels up the screen from its real position - so the
   * icon being dragged is never hidden underneath the fingertip dragging it, the same "handle
   * floats above your fingertip" idiom iOS/Android text-selection handles use. A mouse drag (which
   * has its own visible cursor off to the side) is returned unchanged.
   */
  private withTouchDragOffset(map: WebGLMap, positions: PointHandlePositions, activeKind: HandleKind | null): PointHandlePositions {
    if (!this._activeHandle?.isTouch || activeKind !== this._activeHandle.kind) {
      return positions;
    }
    const key = activeKind as "free" | "move" | "height" | "rotate";
    const original = positions[key];
    if (!original) {
      return positions;
    }
    return {...positions, [key]: this.offsetPointUpOnScreen(map, original, TOUCH_DRAG_OFFSET_PIXELS)};
  }

  private offsetPointUpOnScreen(map: WebGLMap, point: Point, pixels: number): Point {
    try {
      const view = map.mapToViewTransformation.transform(point);
      const offsetView = createPoint(null, [view.x, view.y - pixels]);
      return map.viewToMapTransformation.transform(offsetView);
    } catch (e) {
      return point;
    }
  }

  /**
   * Draws the free/move/height/finish/cancel handle set at `positions` - shared by the active
   * vertex and the active midpoint, the only two things that ever get the full set. `shiftHeld`
   * only affects the move/height icons' size, independent of `activeKind`'s color - see the new
   * `*_SHIFT_ICON_STYLE` constants.
   */
  private drawFullHandleSet(
      geoCanvas: GeoCanvas, positions: PointHandlePositions, activeKind: HandleKind | null, canRemove: boolean): void {
    if (activeKind === "free") {
      geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_ICON_STYLE);
      geoCanvas.drawIcon(positions.free, VERTEX_FOCUSED_OCCLUDED_ICON_STYLE);
    } else {
      geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_ICON_STYLE);
      geoCanvas.drawIcon(positions.free, VERTEX_DEFAULT_OCCLUDED_ICON_STYLE);
    }
    if (positions.move) {
      const [style, occludedStyle] = this._shiftWholeShapeToggled ? [MOVE_HANDLE_SHIFT_ICON_STYLE, MOVE_HANDLE_SHIFT_OCCLUDED_ICON_STYLE] :
          activeKind === "move" ? [MOVE_HANDLE_FOCUSED_ICON_STYLE, MOVE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [MOVE_HANDLE_DEFAULT_ICON_STYLE, MOVE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.move, style);
      geoCanvas.drawIcon(positions.move, occludedStyle);
    }
    if (positions.height) {
      const [style, occludedStyle] = this._shiftWholeShapeToggled ? [HEIGHT_HANDLE_SHIFT_ICON_STYLE, HEIGHT_HANDLE_SHIFT_OCCLUDED_ICON_STYLE] :
          activeKind === "height" ? [HEIGHT_HANDLE_FOCUSED_ICON_STYLE, HEIGHT_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [HEIGHT_HANDLE_DEFAULT_ICON_STYLE, HEIGHT_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.height, style);
      geoCanvas.drawIcon(positions.height, occludedStyle);
    }
    if (positions.shiftToggle) {
      const [style, occludedStyle] = this._shiftWholeShapeToggled ?
          [SHIFT_TOGGLE_ON_ICON_STYLE, SHIFT_TOGGLE_ON_OCCLUDED_ICON_STYLE] :
          [SHIFT_TOGGLE_OFF_ICON_STYLE, SHIFT_TOGGLE_OFF_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.shiftToggle, style);
      geoCanvas.drawIcon(positions.shiftToggle, occludedStyle);
    }
    if (positions.remove && canRemove) {
      const [style, occludedStyle] = activeKind === "remove" ?
          [REMOVE_HANDLE_FOCUSED_ICON_STYLE, REMOVE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [REMOVE_HANDLE_DEFAULT_ICON_STYLE, REMOVE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.remove, style);
      geoCanvas.drawIcon(positions.remove, occludedStyle);
    }
    // Only while armed - rotating a single vertex around itself is meaningless, so unlike
    // move/height (which read this._shiftWholeShapeToggled only to pick a *bigger* icon), rotate
    // reads it to decide whether to draw anything at all.
    if (positions.rotate && this._shiftWholeShapeToggled) {
      const [style, occludedStyle] = activeKind === "rotate" ?
          [ROTATE_HANDLE_FOCUSED_ICON_STYLE, ROTATE_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [ROTATE_HANDLE_DEFAULT_ICON_STYLE, ROTATE_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.rotate, style);
      geoCanvas.drawIcon(positions.rotate, occludedStyle);
    }
    // One or the other, never both - the htmlToolbar option is a full replacement for these two
    // icons, not an addition alongside them (matching fullHandleCandidates' matching exclusion,
    // which keeps a now-invisible icon from also staying hoverable/clickable).
    if (positions.finish && !this._htmlToolbar) {
      const [style, occludedStyle] = activeKind === "finish" ?
          [FINISH_HANDLE_FOCUSED_ICON_STYLE, FINISH_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [FINISH_HANDLE_DEFAULT_ICON_STYLE, FINISH_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.finish, style);
      geoCanvas.drawIcon(positions.finish, occludedStyle);
    }
    if (positions.cancel && !this._htmlToolbar) {
      const [style, occludedStyle] = activeKind === "cancel" ?
          [CANCEL_HANDLE_FOCUSED_ICON_STYLE, CANCEL_HANDLE_FOCUSED_OCCLUDED_ICON_STYLE] :
          [CANCEL_HANDLE_DEFAULT_ICON_STYLE, CANCEL_HANDLE_DEFAULT_OCCLUDED_ICON_STYLE];
      geoCanvas.drawIcon(positions.cancel, style);
      geoCanvas.drawIcon(positions.cancel, occludedStyle);
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
      geoCanvas.drawShape(shape, PREVIEW_SHAPE_OCCLUDED_STYLE);
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
      this.drawFullHandleSet(
          geoCanvas, this.withTouchDragOffset(map, positions, activeKind), activeKind, this._strategy.canRemoveVertex(shape, i));
    }

    // Virtual per-segment midpoint markers - recomputed live from the current vertex list every
    // frame, so once one is promoted (see handleEditDrag), the two new segments either side of it
    // get their own fresh midpoints automatically, with no extra bookkeeping needed here. The
    // active midpoint (if any) gets the same full handle set an active vertex would, around its
    // calculated (not-yet-committed) position; every other segment just gets its small marker,
    // brightened while hovered as a "you can select this" cue.
    // Captured when the loop below passes over the active midpoint (if any), so the toolbar sync
    // further down doesn't need to recompute it a second time.
    let activeMidpointInMapRef: Point | null = null;
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
      activeMidpointInMapRef = midpoint;

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
      this.drawFullHandleSet(geoCanvas, this.withTouchDragOffset(map, positions, activeKind), activeKind, false);
    }

    const handle = this._activeHandle;
    if (handle?.dragStartWGS84 && handle.currentWGS84) {
      const line = createPolyline(WGS_84, [handle.dragStartWGS84, handle.currentWGS84]);
      geoCanvas.drawShape(line, GUIDE_LINE_STYLE);
      geoCanvas.drawShape(line, GUIDE_LINE_OCCLUDED_STYLE);
      geoCanvas.drawIcon(handle.dragStartWGS84, GUIDE_START_ICON_STYLE);
      geoCanvas.drawIcon(handle.dragStartWGS84, GUIDE_START_OCCLUDED_ICON_STYLE);
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

    // Anchored to the drag's start position for "height" (X/Y is frozen there, so the start
    // position is already the right spot) but to the live dragged position for "move" (X/Y is
    // exactly what's changing, so anchoring to the start would leave the line stuck where the drag
    // began) - the same live anchor the reference-plane grid above already uses. "rotate" anchors
    // to its own dragStartWGS84 too - unlike height/move, that's the pivot's fixed position for the
    // whole gesture (the pivot never moves), and this line is quite literally the rotation axis
    // there, not just a depth cue. Either way, the line runs all the way to the EPSG:4978 origin -
    // Earth's center - since that's where the anchor's own true-vertical axis (its own ECEF vector)
    // leads; no raycasting needed, and no computed ground intersection either: RIA's own depth test
    // is what actually reveals "this has reached the ground/a building," via the OCCLUDED_ONLY
    // portion of the line. Going the full distance (rather than some camera- or scene-relative
    // fraction of it) guarantees the line always crosses whatever terrain/mesh is beneath the
    // vertex, no matter how high above the surface it's dragged or how zoomed in/out the camera is.
    // "free" stays excluded - it's already continuously re-snapped to a surface, so a ground-line
    // adds nothing there.
    const dropLineAnchorWGS84 = handle?.kind === "height" ? handle.dragStartWGS84 :
        handle?.kind === "move" ? handle.currentWGS84 :
        handle?.kind === "rotate" ? handle.dragStartWGS84 : null;
    if (this._showDropLine && dropLineAnchorWGS84) {
      const topEpsg4978 = WGS84_TO_EPSG4978.transform(dropLineAnchorWGS84);
      const earthCenterEpsg4978 = {x: 0, y: 0, z: 0};
      const dropLine = createPolyline(EPSG_4978,
          [toPoint(EPSG_4978, topEpsg4978), toPoint(EPSG_4978, earthCenterEpsg4978)]);
      geoCanvas.drawShape(dropLine, DROP_LINE_STYLE);
      geoCanvas.drawShape(dropLine, DROP_LINE_OCCLUDED_STYLE);
    }

    // The filled wedge showing the angle swept so far - unconditional (not gated behind
    // _showPlane/_showDropLine), since without it a rotate drag would show almost nothing but the
    // numeric label, unlike move/height which at least get the guide line by default. Radius
    // matches the rotate handle's own current on-screen offset distance (recomputed fresh here,
    // same as every other camera-relative handle offset in this file), so the wedge's outer edge
    // tracks the icon's position as the camera zooms mid-drag. No reference circle, tick marks, or
    // start/end markers - deliberately minimal, and no unwrapping for sweeps past +-180 deg either -
    // a known, accepted cosmetic limitation (the underlying rotation math is already correct
    // regardless; only this visual could flip to the short side).
    if (handle?.kind === "rotate" && handle.dragStartWGS84 && handle.rotationStartAzimuth !== null &&
        handle.rotationDeltaDegrees !== null) {
      const pivotWGS84 = handle.dragStartWGS84;
      const activeVertexPositions = computePointHandlePositions(map, this._strategy.getVertex(shape, this._activeVertexIndex));
      if (activeVertexPositions.rotate) {
        const rotateIconWGS84 =
            createTransformation(activeVertexPositions.rotate.reference!, WGS_84).transform(activeVertexPositions.rotate);
        const radius = WGS84_GEODESY.distance(pivotWGS84, rotateIconWGS84);
        const band2D = createArcBand(WGS_84, pivotWGS84, 0, radius, handle.rotationStartAzimuth, handle.rotationDeltaDegrees);
        // Flat 2D shapes need an explicit height to sit correctly in 3D - same reasoning the
        // toolbox's own RotateHandleSupport.toExtrudedShape uses.
        const band = createExtrudedShape(WGS_84, band2D, pivotWGS84.z, pivotWGS84.z);
        geoCanvas.drawShape(band, ROTATE_ARC_BAND_STYLE);
        geoCanvas.drawShape(band, ROTATE_ARC_BAND_OCCLUDED_STYLE);
      }
    }

    if (this._toolbar) {
      this._toolbar.setVisible(true);
      this._toolbar.setFinishEnabled(true);
      // Reflects the active midpoint's own (not-yet-committed) height too, not just a real
      // vertex's - typing a value there promotes it into a real vertex at that height, the same
      // way dragging one of its handles already does (see applyHeightInput).
      const activeTargetWGS84 = this._activeSegmentIndex === null
          ? createTransformation(shape.reference!, WGS_84).transform(this._strategy.getVertex(shape, this._activeVertexIndex))
          : activeMidpointInMapRef
              ? createTransformation(activeMidpointInMapRef.reference!, WGS_84).transform(activeMidpointInMapRef)
              : null;
      this._toolbar.setHeightValue(activeTargetWGS84?.z ?? null);
    }
  }

  override onDrawLabel(labelCanvas: LabelCanvas): void {
    const handle = this._activeHandle;
    if (handle?.kind === "rotate") {
      // Rotate never sets currentWGS84 (the pivot doesn't move) - anchor the label at the pivot
      // itself (dragStartWGS84) instead, showing the accumulated angle rather than a distance.
      if (handle.rotationDeltaDegrees === null || !handle.dragStartWGS84) {
        return;
      }
      const text = `${handle.rotationDeltaDegrees >= 0 ? "+" : ""}${handle.rotationDeltaDegrees.toFixed(1)}°`;
      labelCanvas.drawLabel(`<div class="ria-3d-shape-editor-label" style="${LABEL_STYLE}">${text}</div>`, handle.dragStartWGS84, {});
      return;
    }
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
