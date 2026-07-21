// Fresh code - the per-shape-type delegation interface. Everything genuinely common across
// Point/LineString/Polygon (vertex hit-testing, the move/height handle interactions, the
// controller's onDraw/onDrawLabel guide-line code) lives outside this interface entirely and never
// branches on shape type; only what's genuinely shape-specific is captured here.
import {Point} from "@luciad/ria/shape/Point.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";

export type EditableShape = Point | Polyline | Polygon;

export interface ShapeEditStrategy<S extends EditableShape = EditableShape> {
  readonly shapeType: ShapeType;
  readonly minVertexCount: number;
  /** True for Point: creation finishes immediately after the first (and only) vertex is placed. */
  readonly finishesImmediatelyAfterVertex: boolean;
  /** True for Polygon: segment `vertexCount - 1` wraps back to vertex `0`. */
  readonly isClosedRing: boolean;

  /** Creates a new shape containing exactly one vertex, at `firstPoint`. */
  createEmptyShape(reference: CoordinateReference, firstPoint: Point): S;
  /** Appends a new (not-yet-committed) vertex. Never called for Point. */
  appendVertex(shape: S, point: Point): void;
  /** Moves the trailing (not-yet-committed) vertex - used for the rubber-band creation preview. */
  updateLastVertex(shape: S, point: Point): void;
  /** Removes the trailing vertex. Never called for Point. */
  removeLastVertex(shape: S): void;
  /** Whether the shape currently has enough vertices to finish creation. */
  canFinishCreation(shape: S): boolean;

  vertexCount(shape: S): number;
  getVertex(shape: S, index: number): Point;
  moveVertex(shape: S, index: number, point: Point): void;
  /** Whether the vertex at `index` may be removed without dropping below `minVertexCount`. */
  canRemoveVertex(shape: S, index: number): boolean;
  removeVertex(shape: S, index: number): void;
  /**
   * Inserts a new, already-committed vertex at `index` (unlike `appendVertex`, which is
   * specifically for the creation-time rubber-band vertex and always appends at the end). Used by
   * `cancel()` to restore a vertex removed mid-edit-session. Never called for Point.
   */
  insertVertex(shape: S, index: number, point: Point): void;

  translateWholeShape(shape: S, dx: number, dy: number, dz: number): void;
  /**
   * For Polygon during creation only: the cosmetic last-vertex-to-first-vertex dashed preview
   * segment. `null` for Point/LineString, and for Polygon before it has at least 2 vertices.
   */
  getPreviewClosingSegment(shape: S): [Point, Point] | null;
}
