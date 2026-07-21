import {describe, expect, it} from "vitest";
import {formatLength} from "./formatLength.js";

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

  describe("imperial", () => {
    it("stays in feet just under the 1-mile threshold", () => {
      // 1600m / 0.3048 (m per ft) = 5249.34ft
      expect(formatLength(1600, "imperial")).toBe("5249.34ft");
    });

    it("switches to miles at exactly 1609.344m (1 mile)", () => {
      expect(formatLength(1609.344, "imperial")).toBe("1.00mi");
    });
  });

  describe("nautical", () => {
    it("stays in feet just under the 1-nautical-mile threshold", () => {
      // 1851m / 0.3048 (m per ft) = 6072.83ft
      expect(formatLength(1851, "nautical")).toBe("6072.83ft");
    });

    it("switches to nautical miles at exactly 1852m (1 NM)", () => {
      expect(formatLength(1852, "nautical")).toBe("1.00NM");
    });
  });
});
