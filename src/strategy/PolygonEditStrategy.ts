import {Point} from "@luciad/ria/shape/Point.js";
import {Polygon} from "@luciad/ria/shape/Polygon.js";
import {createPolygon} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {ProgrammingError} from "@luciad/ria/error/ProgrammingError.js";
import {ShapeEditStrategy} from "./ShapeEditStrategy.js";

// LuciadRIA's Polygon is implicitly closed by its point list (unlike GeoJSON's convention of
// duplicating the first point as the last) - confirmed from Polygon.d.ts, which has no notion of a
// required closing point. So there is no runtime closing-point bookkeeping needed anywhere in this
// strategy; getPreviewClosingSegment below is purely a cosmetic creation-time preview.
export class PolygonEditStrategy implements ShapeEditStrategy<Polygon> {
  readonly shapeType = ShapeType.POLYGON;
  readonly minVertexCount = 3;
  readonly finishesImmediatelyAfterVertex = false;
  readonly isClosedRing = true;

  createEmptyShape(reference: CoordinateReference, firstPoint: Point): Polygon {
    return createPolygon(reference, [firstPoint]);
  }

  appendVertex(shape: Polygon, point: Point): void {
    shape.insertPoint(shape.pointCount, point);
  }

  updateLastVertex(shape: Polygon, point: Point): void {
    shape.move3DPoint(shape.pointCount - 1, point.x, point.y, point.z);
  }

  removeLastVertex(shape: Polygon): void {
    shape.removePoint(shape.pointCount - 1);
  }

  canFinishCreation(shape: Polygon): boolean {
    return shape.pointCount >= this.minVertexCount;
  }

  vertexCount(shape: Polygon): number {
    return shape.pointCount;
  }

  getVertex(shape: Polygon, index: number): Point {
    return shape.getPoint(index);
  }

  moveVertex(shape: Polygon, index: number, point: Point): void {
    shape.move3DPoint(index, point.x, point.y, point.z);
  }

  canRemoveVertex(shape: Polygon, index: number): boolean {
    return shape.pointCount > this.minVertexCount && index >= 0 && index < shape.pointCount;
  }

  removeVertex(shape: Polygon, index: number): void {
    if (!this.canRemoveVertex(shape, index)) {
      throw new ProgrammingError(`PolygonEditStrategy: cannot remove vertex ${index}`);
    }
    shape.removePoint(index);
  }

  insertVertex(shape: Polygon, index: number, point: Point): void {
    shape.insertPoint(index, point);
  }

  translateWholeShape(shape: Polygon, dx: number, dy: number, dz: number): void {
    shape.translate3D(dx, dy, dz);
  }

  getPreviewClosingSegment(shape: Polygon): [Point, Point] | null {
    if (shape.pointCount < 2) {
      return null;
    }
    return [shape.getPoint(shape.pointCount - 1), shape.getPoint(0)];
  }
}
