import {Point} from "@luciad/ria/shape/Point.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import {ShapeType} from "@luciad/ria/shape/ShapeType.js";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference.js";
import {ProgrammingError} from "@luciad/ria/error/ProgrammingError.js";
import {ShapeEditStrategy} from "./ShapeEditStrategy.js";

export class PointEditStrategy implements ShapeEditStrategy<Point> {
  readonly shapeType = ShapeType.POINT;
  readonly minVertexCount = 1;
  readonly finishesImmediatelyAfterVertex = true;
  readonly isClosedRing = false;

  createEmptyShape(reference: CoordinateReference, firstPoint: Point): Point {
    return createPoint(reference, [firstPoint.x, firstPoint.y, firstPoint.z]);
  }

  appendVertex(): void {
    throw new ProgrammingError("PointEditStrategy: a Point never gets a second vertex");
  }

  updateLastVertex(shape: Point, point: Point): void {
    shape.move3DToCoordinates(point.x, point.y, point.z);
  }

  removeLastVertex(): void {
    throw new ProgrammingError("PointEditStrategy: a Point has no trailing vertex to remove");
  }

  canFinishCreation(): boolean {
    return true;
  }

  vertexCount(): number {
    return 1;
  }

  getVertex(shape: Point): Point {
    return shape.copy();
  }

  moveVertex(shape: Point, index: number, point: Point): void {
    if (index !== 0) {
      throw new ProgrammingError(`PointEditStrategy: invalid vertex index ${index}`);
    }
    shape.move3DToCoordinates(point.x, point.y, point.z);
  }

  canRemoveVertex(): boolean {
    return false;
  }

  removeVertex(): void {
    throw new ProgrammingError("PointEditStrategy: a Point's only vertex cannot be removed");
  }

  insertVertex(): void {
    throw new ProgrammingError("PointEditStrategy: a Point never gets a second vertex");
  }

  translateWholeShape(shape: Point, dx: number, dy: number, dz: number): void {
    shape.translate3D(dx, dy, dz);
  }

  getPreviewClosingSegment(): null {
    return null;
  }
}
