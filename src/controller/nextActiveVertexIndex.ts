// Fresh code - isolated as a pure function specifically so this off-by-one-prone index arithmetic
// gets a real unit test, unlike the gesture-handler methods that call it (which would need
// WebGLMap/GestureEvent mocking this package doesn't otherwise build).
/**
 * Given the currently active vertex index and the index just removed from a shape with
 * `newVertexCount` vertices remaining, returns the index that should become active so there is
 * always exactly one - keeping the same logical vertex active if it wasn't the one removed, or
 * falling to whatever now occupies its old slot (the vertex that used to be "next," shifted down
 * to fill the gap) if it was, clamped to the new last index if it was removed from the end.
 */
export function nextActiveVertexIndex(activeIndex: number, removedIndex: number, newVertexCount: number): number {
  if (removedIndex < activeIndex) {
    return activeIndex - 1;
  }
  if (removedIndex === activeIndex) {
    return Math.min(activeIndex, newVertexCount - 1);
  }
  return activeIndex;
}
