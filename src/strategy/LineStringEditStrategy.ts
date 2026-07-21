import {Point} from "@luciad/ria/shape/Point.js";
import {Polyline} from "@luciad/ria/shape/Polyline.js";
import {createPolyline} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {ProgrammingError} from "@luciad/ria/error/ProgrammingError.js";
import {ShapeEditStrategy} from "./ShapeEditStrategy.js";

export class LineStringEditStrategy implements ShapeEditStrategy<Polyline> {
  readonly shapeType = ShapeType.POLYLINE;
  readonly minVertexCount = 2;
  readonly finishesImmediatelyAfterVertex = false;
  readonly isClosedRing = false;

  createEmptyShape(reference: CoordinateReference, firstPoint: Point): Polyline {
    return createPolyline(reference, [firstPoint]);
  }

  appendVertex(shape: Polyline, point: Point): void {
    shape.insertPoint(shape.pointCount, point);
  }

  updateLastVertex(shape: Polyline, point: Point): void {
    shape.move3DPoint(shape.pointCount - 1, point.x, point.y, point.z);
  }

  removeLastVertex(shape: Polyline): void {
    shape.removePoint(shape.pointCount - 1);
  }

  canFinishCreation(shape: Polyline): boolean {
    return shape.pointCount >= this.minVertexCount;
  }

  vertexCount(shape: Polyline): number {
    return shape.pointCount;
  }

  getVertex(shape: Polyline, index: number): Point {
    return shape.getPoint(index);
  }

  moveVertex(shape: Polyline, index: number, point: Point): void {
    shape.move3DPoint(index, point.x, point.y, point.z);
  }

  canRemoveVertex(shape: Polyline, index: number): boolean {
    return shape.pointCount > this.minVertexCount && index >= 0 && index < shape.pointCount;
  }

  removeVertex(shape: Polyline, index: number): void {
    if (!this.canRemoveVertex(shape, index)) {
      throw new ProgrammingError(`LineStringEditStrategy: cannot remove vertex ${index}`);
    }
    shape.removePoint(index);
  }

  insertVertex(shape: Polyline, index: number, point: Point): void {
    shape.insertPoint(index, point);
  }

  translateWholeShape(shape: Polyline, dx: number, dy: number, dz: number): void {
    shape.translate3D(dx, dy, dz);
  }

  getPreviewClosingSegment(): null {
    return null;
  }
}
