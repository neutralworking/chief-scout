/**
 * Tests for shared types and utility functions.
 *
 * Priority: HIGH — computeAge and constants used across all components.
 */
import { describe, it, expect } from "vitest";
import {
  computeAge,
  POSITIONS,
  PURSUIT_STATUSES,
  PURSUIT_COLORS,
  POSITION_COLORS,
} from "@/lib/types";

describe("computeAge", () => {
  it("returns null for null dob", () => {
    expect(computeAge(null)).toBeNull();
  });

  it("computes correct age", () => {
    const now = new Date();
    const tenYearsAgo = new Date(
      now.getFullYear() - 10,
      now.getMonth(),
      now.getDate()
    );
    expect(computeAge(tenYearsAgo.toISOString().split("T")[0])).toBe(10);
  });

  it("accounts for birthday not yet passed", () => {
    const now = new Date();
    // Birthday is tomorrow (next month to be safe)
    const futureMonth = now.getMonth() + 1;
    const dob = new Date(now.getFullYear() - 25, futureMonth, 15);
    if (futureMonth <= 11) {
      const age = computeAge(dob.toISOString().split("T")[0]);
      expect(age).toBe(24); // hasn't turned 25 yet
    }
  });

  it("returns 0 for baby born this year", () => {
    const now = new Date();
    const dob = new Date(now.getFullYear(), 0, 1);
    const age = computeAge(dob.toISOString().split("T")[0]);
    expect(age).toBe(0);
  });
});

describe("Position constants", () => {
  it("has 9 positions", () => {
    expect(POSITIONS).toHaveLength(9);
  });

  it("includes all expected positions", () => {
    const expected = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];
    expect(POSITIONS).toEqual(expected);
  });

  it("every position has a color", () => {
    for (const pos of POSITIONS) {
      expect(POSITION_COLORS[pos]).toBeDefined();
    }
  });
});

describe("Pursuit status constants", () => {
  it("has 6 statuses", () => {
    expect(PURSUIT_STATUSES).toHaveLength(6);
  });

  it("every status has a color", () => {
    for (const status of PURSUIT_STATUSES) {
      expect(PURSUIT_COLORS[status]).toBeDefined();
    }
  });

  it("statuses in priority order", () => {
    expect(PURSUIT_STATUSES[0]).toBe("Priority");
    expect(PURSUIT_STATUSES[PURSUIT_STATUSES.length - 1]).toBe("Pass");
  });
});
