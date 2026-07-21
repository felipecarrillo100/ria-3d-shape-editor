// Fresh code - isolated as a pure function (rather than a Shape3DEditController method) so this
// threshold/tier-selection logic gets a real unit test, matching the same reasoning as
// nextActiveVertexIndex.ts/horizontalPlaneGrid.ts elsewhere in this package.
import {UnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasure.js";
import {getUnitOfMeasure} from "@luciad/ria/uom/UnitOfMeasureRegistry.js";

export type UomFamily = "metric" | "imperial" | "nautical";

interface UomTier {
  unit: UnitOfMeasure;
  thresholdMeters: number;
}

// RIA has no registered "yard", so the nautical family pairs Foot (not Meter) with NauticalMile.
function buildUomTiers(smallUnitName: string, largeUnitName: string): UomTier[] {
  const large = getUnitOfMeasure(largeUnitName);
  return [
    {unit: large, thresholdMeters: large.convertToStandard(1)},
    {unit: getUnitOfMeasure(smallUnitName), thresholdMeters: 0},
  ];
}

// Built once at module load, not per call - getUnitOfMeasure/convertToStandard results never change.
const UOM_TIERS: Record<UomFamily, UomTier[]> = {
  metric: buildUomTiers("Meter", "Kilometer"),
  imperial: buildUomTiers("Foot", "Mile"),
  nautical: buildUomTiers("Foot", "NauticalMile"),
};

/**
 * Formats a length given in meters using the given unit family, auto-scaling to the family's
 * large unit once the value reaches it (e.g. metric switches to km at exactly 1000m - the
 * threshold for each family is computed from RIA's own registered conversion factor via
 * UnitOfMeasure.convertToStandard, not hardcoded, so it's exactly right for miles (1609.344m) and
 * nautical miles (1852m) too).
 */
export function formatLength(meters: number, family: UomFamily): string {
  const tiers = UOM_TIERS[family];
  // Absolute value for the threshold check only, so a large negative height change (e.g. -1200m)
  // still scales up to the large unit instead of getting stuck in the small-unit tier -
  // convertToUnit itself is linear/sign-preserving, so the signed value passed into it keeps the
  // sign correct in the final output.
  const tier = tiers.find((t) => Math.abs(meters) >= t.thresholdMeters) ?? tiers[tiers.length - 1];
  const value = getUnitOfMeasure("Meter").convertToUnit(meters, tier.unit);
  return `${value.toFixed(2)}${tier.unit.symbol}`;
}
