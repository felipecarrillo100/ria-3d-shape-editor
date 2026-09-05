// Fresh code - isolated as a pure module (rather than Shape3DEditController methods) so this
// threshold/unit-selection logic gets a real unit test, matching the same reasoning as
// nextActiveVertexIndex.ts/horizontalPlaneGrid.ts elsewhere in this package.
import {UnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasure.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";

export type UomFamily = "metric" | "imperial" | "nautical";

interface UomSpec {
  /**
   * The unit any value below `largeThresholdMeters` is shown in - and the one the htmlToolbar's
   * height input ALWAYS uses regardless of magnitude, since an editable text field can't re-unit
   * itself under the user's cursor without a typed number silently changing meaning.
   */
  base: UnitOfMeasure;
  /** The unit a value at or above `largeThresholdMeters` scales up to. */
  large: UnitOfMeasure;
  /**
   * Compared against `Math.abs(meters)`, so a negative height delta scales by magnitude.
   *
   * 1000m for metric is simply 1km. The 305m both non-metric families use is ~1000ft, matching the
   * fallback chain in ~/git/MapEvolution's own LENGTH_UNITS table (`mi: {minimum: 305}`,
   * `nmi: {minimum: 305}`) - deliberately NOT the true length of a mile/nautical mile (1609.344m/
   * 1852m), which would let feet run to five digits before switching.
   */
  largeThresholdMeters: number;
}

// Built once at module load, not per call - getUnitOfMeasure results never change. RIA registers no
// "yard", so both non-metric families share Foot as their base unit.
const UOM_SPECS: Record<UomFamily, UomSpec> = {
  metric: {
    base: getUnitOfMeasure("Meter"),
    large: getUnitOfMeasure("Kilometer"),
    largeThresholdMeters: 1000,
  },
  imperial: {
    base: getUnitOfMeasure("Foot"),
    large: getUnitOfMeasure("Mile"),
    largeThresholdMeters: 305,
  },
  nautical: {
    base: getUnitOfMeasure("Foot"),
    large: getUnitOfMeasure("NauticalMile"),
    largeThresholdMeters: 305,
  },
};

/**
 * Formats a length given in meters, auto-scaling to the family's large unit once the magnitude
 * reaches its threshold. Used for BOTH the horizontal-distance and the height-delta drag labels -
 * they deliberately share one rule, since a shape being edited may be kilometers across, where a
 * raw meter count reads as an unusably long number.
 *
 * Fixed 2 decimals, and no space before the symbol: this is a live readout redrawn on every drag
 * frame, so a value whose string length varied would shift the digits around under the cursor as
 * it updated.
 */
export function formatLength(meters: number, family: UomFamily): string {
  const spec = UOM_SPECS[family];
  const unit = Math.abs(meters) >= spec.largeThresholdMeters ? spec.large : spec.base;
  return `${unit.convertFromStandard(meters).toFixed(2)}${unit.symbol}`;
}

/** The symbol of `family`'s base unit - the htmlToolbar height input's unit suffix. */
export function baseUnitSymbol(family: UomFamily): string {
  return UOM_SPECS[family].base.symbol;
}

/** Converts `meters` into `family`'s base unit, for display in the height input. */
export function metersToBaseUnit(meters: number, family: UomFamily): number {
  return UOM_SPECS[family].base.convertFromStandard(meters);
}

/** Converts a value typed into the height input (in `family`'s base unit) back to meters. */
export function baseUnitToMeters(value: number, family: UomFamily): number {
  return UOM_SPECS[family].base.convertToStandard(value);
}
