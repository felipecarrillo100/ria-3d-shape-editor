// Internal, not exported from the package. Mirrors the click-to-place recipe confirmed by direct
// reading of @luciad/ria-toolbox-ria/ruler3d/Ruler3DController.ts's handleClick/handleMove/
// handleDoubleClick: a click always appends a new vertex; the *first* MOVE after the shape has
// exactly `minPointsAtMove` vertices also appends one (creating a live "trailing" vertex to drag);
// every other MOVE just drags whatever the current last vertex is. `minPointsAtMove` is 0 for
// shapes that finish immediately after one vertex (Point - so the very first MOVE, before any
// click, already creates and live-previews it) and 1 otherwise (LineString/Polygon - the first
// vertex requires a real click, matching Ruler3DController's own `startOnMove: false` default).
import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Point} from "@luciad/ria/shape/Point.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {EditableShape, ShapeEditStrategy} from "../strategy/ShapeEditStrategy.js";
import {raycastClosestSurface} from "../handle/raycastClosestSurface.js";

export type CreationClickResult = "placed" | "finished" | "ignored";
export type CreationDoubleClickResult = "finished" | "ignored";

export class CreationSession<S extends EditableShape> {
  private readonly strategy: ShapeEditStrategy<S>;
  private readonly targetReference: CoordinateReference;
  private _shape: S | null = null;

  /**
   * `targetReference` is the reference the created shape must end up in (typically the backing
   * layer/model's own reference, e.g. EPSG:4326) - NOT necessarily `map.reference` (which is
   * EPSG:4978 whenever 3D height editing is in play). Every vertex is reprojected from the raycast
   * result (always in `map.reference`) into `targetReference` immediately, before it ever reaches
   * the strategy - the strategy's own move3DPoint/insertPoint calls copy raw x/y/z values with no
   * reference awareness of their own, so the shape must already be built in the right reference
   * from its very first vertex.
   */
  constructor(strategy: ShapeEditStrategy<S>, targetReference: CoordinateReference) {
    this.strategy = strategy;
    this.targetReference = targetReference;
  }

  get shape(): S | null {
    return this._shape;
  }

  private raycast(map: WebGLMap, viewPoint: Point): Point | null {
    const touched = raycastClosestSurface(map, viewPoint);
    if (!touched) {
      return null;
    }
    return touched.reference!.equals(this.targetReference)
        ? touched
        : createTransformation(touched.reference!, this.targetReference).transform(touched);
  }

  private get minPointsAtMove(): number {
    return this.strategy.finishesImmediatelyAfterVertex ? 0 : 1;
  }

  handleMove(map: WebGLMap, viewPoint: Point): boolean {
    const point = this.raycast(map, viewPoint);
    if (!point) {
      return false;
    }
    const count = this._shape ? this.strategy.vertexCount(this._shape) : 0;
    if (count < this.minPointsAtMove) {
      return false;
    }
    if (count === this.minPointsAtMove) {
      if (!this._shape) {
        this._shape = this.strategy.createEmptyShape(this.targetReference, point);
      } else {
        this.strategy.appendVertex(this._shape, point.copy());
      }
    }
    this.strategy.updateLastVertex(this._shape!, point);
    return true;
  }

  handleClick(map: WebGLMap, viewPoint: Point): CreationClickResult {
    const point = this.raycast(map, viewPoint);
    if (!point) {
      return "ignored";
    }
    if (this.strategy.finishesImmediatelyAfterVertex) {
      if (!this._shape) {
        this._shape = this.strategy.createEmptyShape(this.targetReference, point);
      } else {
        this.strategy.updateLastVertex(this._shape, point);
      }
      return "finished";
    }
    if (!this._shape) {
      this._shape = this.strategy.createEmptyShape(this.targetReference, point);
    } else {
      this.strategy.appendVertex(this._shape, point.copy());
    }
    return "placed";
  }

  handleDoubleClick(): CreationDoubleClickResult {
    if (!this._shape || this.strategy.finishesImmediatelyAfterVertex) {
      // Point finishes on its first click; a double-click can never occur mid-creation for it.
      return "ignored";
    }
    // Discard the extra vertex the first tap of this double-click's SINGLE_CLICK_UP created.
    const removedVertex = this.strategy.getVertex(this._shape, this.strategy.vertexCount(this._shape) - 1);
    this.strategy.removeLastVertex(this._shape);
    if (this.strategy.canFinishCreation(this._shape)) {
      return "finished";
    }
    // Not enough vertices yet (double-clicked too early) - restore the discarded vertex so MOVE
    // still has a live trailing vertex to drag, and stay in the creation phase.
    this.strategy.appendVertex(this._shape, removedVertex);
    return "ignored";
  }
}
