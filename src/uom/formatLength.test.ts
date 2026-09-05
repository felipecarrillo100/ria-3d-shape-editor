import {describe, expect, it} from "vitest";
import {baseUnitSymbol, baseUnitToMeters, formatLength, metersToBaseUnit, type UomFamily} from "./formatLength.js";

const FAMILIES: UomFamily[] = ["metric", "imperial", "nautical"];

describe("formatLength", () => {
  describe("metric", () => {
    it("stays in meters just under the 1000m threshold", () => {
      expect(formatLength(999, "metric")).toBe("999.00m");
    });

    it("switches to kilometers at exactly 1000m", () => {
      expect(formatLength(1000, "metric")).toBe("1.00km");
    });

    it("preserves sign and still auto-scales for a large negative value", () => {
      expect(formatLength(-1200, "metric")).toBe("-1.20km");
    });
  });

  // Both non-metric families switch at ~1000ft (305m), not at the true length of a mile/nautical
  // mile, so feet never reach five digits - see UomSpec.largeThresholdMeters' own comment.
  describe("imperial", () => {
    it("stays in feet just under the 305m threshold", () => {
      // 304m / 0.3048 (m per ft) = 997.38ft
      expect(formatLength(304, "imperial")).toBe("997.38ft");
    });

    it("switches to miles at exactly 305m (~1000ft)", () => {
      expect(formatLength(305, "imperial")).toBe("0.19mi");
    });

    it("reads exactly 1.00mi at one mile", () => {
      expect(formatLength(1609.344, "imperial")).toBe("1.00mi");
    });
  });

  describe("nautical", () => {
    it("stays in feet just under the 305m threshold", () => {
      expect(formatLength(304, "nautical")).toBe("997.38ft");
    });

    it("switches to nautical miles at exactly 305m (~1000ft)", () => {
      expect(formatLength(305, "nautical")).toBe("0.16NM");
    });

    it("reads exactly 1.00NM at one nautical mile", () => {
      expect(formatLength(1852, "nautical")).toBe("1.00NM");
    });
  });

  // Height deltas go through this same function: the editor formats height and distance by one
  // shared rule, since a shape being edited may be kilometers across.
  it("scales a negative height delta by magnitude in every family", () => {
    expect(formatLength(-2000, "metric")).toBe("-2.00km");
    expect(formatLength(-2000, "imperial")).toBe("-1.24mi");
    expect(formatLength(-2000, "nautical")).toBe("-1.08NM");
  });
});

// The htmlToolbar height input's unit: always the family's base unit, never the scaled one.
describe("base unit helpers", () => {
  it("reports each family's base unit symbol", () => {
    expect(baseUnitSymbol("metric")).toBe("m");
    expect(baseUnitSymbol("imperial")).toBe("ft");
    expect(baseUnitSymbol("nautical")).toBe("ft");
  });

  it("converts meters into the base unit for display", () => {
    expect(metersToBaseUnit(100, "metric")).toBeCloseTo(100);
    expect(metersToBaseUnit(100, "imperial")).toBeCloseTo(328.084, 3);
    expect(metersToBaseUnit(100, "nautical")).toBeCloseTo(328.084, 3);
  });

  it("round-trips a value through the base unit without drift", () => {
    for (const family of FAMILIES) {
      expect(baseUnitToMeters(metersToBaseUnit(1234.56, family), family)).toBeCloseTo(1234.56, 6);
    }
  });
});
