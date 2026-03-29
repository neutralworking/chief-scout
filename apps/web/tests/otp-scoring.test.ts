import { describe, it, expect } from "vitest";
import { scorePlayerForSlot, SLOT_POSITION_MAP } from "@/lib/formation-intelligence";

describe("scorePlayerForSlot", () => {
  // ── Position guard ──────────────────────────────────────────────
  it("rejects GK in CF slot", () => {
    const player = { level: 90, position: "GK", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "CF")).toBe(-1);
  });

  it("rejects CF in GK slot", () => {
    const player = { level: 90, position: "CF", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "GK")).toBe(-1);
  });

  it("rejects CD in WF slot", () => {
    const player = { level: 85, position: "CD", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "WF")).toBe(-1);
  });

  it("allows CM in DM slot (compatible)", () => {
    const player = { level: 85, position: "CM", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "DM")).toBeGreaterThan(0);
  });

  it("allows WF in CF slot (compatible)", () => {
    const player = { level: 88, position: "WF", best_role_score: 85 };
    expect(scorePlayerForSlot(player, "CF")).toBeGreaterThan(0);
  });

  // ── Exact position match uses full score ────────────────────────
  it("returns full best_role_score for exact position match", () => {
    const player = { level: 90, position: "CF", best_role_score: 88 };
    expect(scorePlayerForSlot(player, "CF")).toBe(88);
  });

  it("returns full best_role_score for GK in GK slot", () => {
    const player = { level: 85, position: "GK", best_role_score: 80 };
    expect(scorePlayerForSlot(player, "GK")).toBe(80);
  });

  // ── Compatible position gets 0.90 discount ─────────────────────
  it("discounts compatible-but-not-exact position by 0.90", () => {
    const player = { level: 85, position: "CM", best_role_score: 82 };
    expect(scorePlayerForSlot(player, "DM")).toBeCloseTo(82 * 0.90, 1);
  });

  it("discounts WF in CF slot by 0.90", () => {
    const player = { level: 88, position: "WF", best_role_score: 85 };
    expect(scorePlayerForSlot(player, "CF")).toBeCloseTo(85 * 0.90, 1);
  });

  // ── NULL best_role_score falls back to level ────────────────────
  it("falls back to level when best_role_score is null", () => {
    const player = { level: 87, position: "CF", best_role_score: null };
    expect(scorePlayerForSlot(player, "CF")).toBe(87);
  });

  it("falls back to 0 when both are null", () => {
    const player = { level: null, position: "CF", best_role_score: null };
    expect(scorePlayerForSlot(player, "CF")).toBe(0);
  });

  // ── Star players beat low-level players ─────────────────────────
  it("Mbappe (RS 90, CF) beats Carlton Morris (RS 72, CF) in CF slot", () => {
    const mbappe = { level: 92, position: "CF", best_role_score: 90 };
    const morris = { level: 73, position: "CF", best_role_score: 72 };
    expect(scorePlayerForSlot(mbappe, "CF")).toBeGreaterThan(
      scorePlayerForSlot(morris, "CF")
    );
  });

  it("level-87 player with no data beats level-73 with data", () => {
    const star = { level: 87, position: "CM", best_role_score: null };
    const scrub = { level: 73, position: "CM", best_role_score: 72 };
    expect(scorePlayerForSlot(star, "CM")).toBeGreaterThan(
      scorePlayerForSlot(scrub, "CM")
    );
  });

  // ── NULL position is rejected ───────────────────────────────────
  it("rejects null position", () => {
    const player = { level: 85, position: null, best_role_score: 80 };
    expect(scorePlayerForSlot(player, "CF")).toBe(-1);
  });

  // ── Unknown slot position is rejected ───────────────────────────
  it("rejects unknown slot position", () => {
    const player = { level: 85, position: "CF", best_role_score: 80 };
    expect(scorePlayerForSlot(player, "ST")).toBe(-1);
  });
});

describe("SLOT_POSITION_MAP", () => {
  it("GK only allows GK", () => {
    expect(SLOT_POSITION_MAP["GK"]).toEqual(["GK"]);
  });

  it("CF allows CF and WF", () => {
    expect(SLOT_POSITION_MAP["CF"]).toEqual(["CF", "WF"]);
  });

  it("every position group has at least one entry", () => {
    for (const pos of ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]) {
      expect(SLOT_POSITION_MAP[pos]?.length).toBeGreaterThan(0);
    }
  });
});
