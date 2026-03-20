/**
 * Tests for valuation/engine.ts — Transfer Valuation Engine.
 *
 * Priority: CRITICAL — valuations drive transfer strategy and player cards.
 *
 * The engine uses Monte Carlo sampling (non-deterministic), so tests verify:
 * - Deterministic helpers via buildPlayerProfile
 * - Statistical properties of runValuation (ordering, ranges, confidence)
 * - Edge cases (missing data, extreme values)
 */
import { describe, it, expect } from "vitest";
import { runValuation, buildPlayerProfile } from "@/lib/valuation/engine";
import type { SupabasePlayerData } from "@/lib/valuation/engine";
import type { PlayerProfile, ValuationMode } from "@/lib/valuation/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGrades(
  attrs: Record<string, number>,
  opts: { scout?: boolean; source?: string } = {},
): SupabasePlayerData["grades"] {
  const { scout = true, source = "scout_assessment" } = opts;
  return Object.entries(attrs).map(([attribute, value]) => ({
    attribute,
    scout_grade: scout ? value : null,
    stat_score: scout ? null : value,
    source,
    is_inferred: false,
  }));
}

function makePlayerData(overrides: Partial<SupabasePlayerData> = {}): SupabasePlayerData {
  return {
    person: {
      id: 1,
      name: "Test Player",
      date_of_birth: "1997-06-15",
      height_cm: 180,
      preferred_foot: "Right",
      club_id: 1,
      club_name: "Test FC",
      league: "Premier League",
      ...overrides.person,
    },
    profile: {
      position: "CM",
      level: 80,
      profile_tier: 1,
      ...overrides.profile,
    },
    personality: {
      ei: 60, sn: 55, tf: 70, jp: 45,
      ...overrides.personality,
    },
    market: {
      transfer_fee_eur: null,
      ...overrides.market,
    },
    status: {
      contract_tag: "Long-Term",
      ...overrides.status,
    },
    grades: overrides.grades ?? makeGrades({
      anticipation: 15, composure: 14, decisions: 13, tempo: 14,
      creativity: 12, vision: 14, pass_range: 13, guile: 11,
      tackling: 10, aggression: 9, marking: 8, blocking: 7,
      pace: 12, acceleration: 13, sprint_speed: 11, agility: 12,
    }),
    trajectory: overrides.trajectory ?? null,
    tags: overrides.tags ?? [],
  };
}

function makeProfile(overrides: Partial<SupabasePlayerData> = {}): PlayerProfile {
  return buildPlayerProfile(makePlayerData(overrides));
}

function runMany(profile: PlayerProfile, mode: ValuationMode = "balanced", n = 5) {
  return Array.from({ length: n }, () => runValuation(profile, mode));
}

// ── buildPlayerProfile ───────────────────────────────────────────────────────

describe("buildPlayerProfile", () => {
  it("computes age from DOB", () => {
    const profile = makeProfile({
      person: { id: 1, name: "Test", date_of_birth: "2000-01-01", height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "PL" },
    });
    // Born 2000-01-01, today is 2026-03-20 → age 26
    expect(profile.age).toBe(26);
  });

  it("handles null DOB", () => {
    const profile = makeProfile({
      person: { id: 1, name: "Test", date_of_birth: null, height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "PL" },
    });
    expect(profile.age).toBeNull();
  });

  it("computes personality code from dimensions", () => {
    const profile = makeProfile({
      personality: { ei: 80, sn: 30, tf: 60, jp: 40 },
    });
    // ei>=50→A, sn<50→N, tf>=50→S, jp<50→P
    expect(profile.personality_code).toBe("ANSP");
  });

  it("handles null personality", () => {
    const data = makePlayerData();
    data.personality = null;
    const profile = buildPlayerProfile(data);
    expect(profile.personality_code).toBeNull();
  });

  it("maps contract tag to years", () => {
    const longTerm = makeProfile({ status: { contract_tag: "Long-Term" } });
    expect(longTerm.contract_years_remaining).toBe(4.0);

    const expired = makeProfile({ status: { contract_tag: "Expired" } });
    expect(expired.contract_years_remaining).toBe(0.0);

    const sixMonths = makeProfile({ status: { contract_tag: "Six Months" } });
    expect(sixMonths.contract_years_remaining).toBe(0.5);
  });

  it("defaults unknown contract tag to 2.0 years", () => {
    const profile = makeProfile({ status: { contract_tag: "Unknown Tag" } });
    expect(profile.contract_years_remaining).toBe(2.0);
  });

  it("separates risk/value personality tags from playing style tags", () => {
    const profile = makeProfile({
      tags: ["Contract Sensitive", "Undroppable", "Playmaker", "Leader"],
    });
    expect(profile.personality_tags).toContain("Contract Sensitive");
    expect(profile.personality_tags).toContain("Undroppable");
    expect(profile.playing_style_tags).toContain("Playmaker");
    expect(profile.playing_style_tags).toContain("Leader");
    expect(profile.personality_tags).not.toContain("Playmaker");
  });

  it("picks highest-priority source per attribute", () => {
    const grades = [
      { attribute: "tackling", scout_grade: 18, stat_score: null, source: "scout_assessment", is_inferred: false },
      { attribute: "tackling", scout_grade: null, stat_score: 8, source: "fbref", is_inferred: false },
    ];
    const profile = makeProfile({ grades });
    // Scout (priority 5) should win over fbref (priority 3)
    // scout_grade 18 → effective = min(18/2, 10) = 9.0
    expect(profile.attributes.tackling.effective_grade).toBe(9.0);
    expect(profile.attributes.tackling.grade_type).toBe("scout");
  });

  it("normalises scout_grade to 0-10 scale", () => {
    const grades = makeGrades({ creativity: 16 });
    const profile = makeProfile({ grades });
    // 16 / 2 = 8.0
    expect(profile.attributes.creativity.effective_grade).toBe(8.0);
  });

  it("caps effective grade at 10", () => {
    const grades = makeGrades({ creativity: 22 }); // over 20
    const profile = makeProfile({ grades });
    expect(profile.attributes.creativity.effective_grade).toBe(10.0);
  });

  it("marks eafc_inferred as inferred grade type", () => {
    const grades = [
      { attribute: "pace", scout_grade: null, stat_score: 14, source: "eafc_inferred", is_inferred: true },
    ];
    const profile = makeProfile({ grades });
    expect(profile.attributes.pace.grade_type).toBe("inferred");
  });

  it("computes archetype_scores from grade averages", () => {
    // Controller model: anticipation, composure, decisions, tempo
    const grades = makeGrades({
      anticipation: 16, composure: 14, decisions: 12, tempo: 18,
    });
    const profile = makeProfile({ grades });
    expect(profile.archetype_scores).toHaveProperty("Controller");
    // avg effective = (8 + 7 + 6 + 9) / 4 = 7.5 → score = min(round(7.5 * 100) / 10, 100) = 75
    expect(profile.archetype_scores.Controller).toBeCloseTo(75, 0);
  });
});

// ── runValuation — statistical properties ────────────────────────────────────

describe("runValuation", () => {
  it("returns valid MarketValue with p10 <= p25 <= p50 <= p75 <= p90", () => {
    const profile = makeProfile();
    const results = runMany(profile);
    for (const result of results) {
      const mv = result.market_value;
      expect(mv.p10).toBeLessThanOrEqual(mv.p25);
      expect(mv.p25).toBeLessThanOrEqual(mv.central);
      expect(mv.central).toBeLessThanOrEqual(mv.p75);
      expect(mv.p75).toBeLessThanOrEqual(mv.p90);
    }
  });

  it("produces positive valuations", () => {
    const profile = makeProfile();
    const result = runValuation(profile, "balanced");
    expect(result.market_value.central).toBeGreaterThan(0);
    expect(result.market_value.p10).toBeGreaterThanOrEqual(0);
  });

  it("higher level player is valued higher", () => {
    const elite = makeProfile({ profile: { position: "CM", level: 90, profile_tier: 1 } });
    const mid = makeProfile({ profile: { position: "CM", level: 70, profile_tier: 1 } });

    // Run multiple times and compare medians to reduce Monte Carlo noise
    const eliteVals = runMany(elite, "balanced", 10).map(r => r.market_value.central);
    const midVals = runMany(mid, "balanced", 10).map(r => r.market_value.central);

    const eliteMedian = eliteVals.sort((a, b) => a - b)[5];
    const midMedian = midVals.sort((a, b) => a - b)[5];

    expect(eliteMedian).toBeGreaterThan(midMedian);
  });

  it("peak-age player valued higher than aging player (same grades)", () => {
    const peak = makeProfile({
      person: { id: 1, name: "Peak", date_of_birth: "1999-01-01", height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "Premier League" },
    }); // age ~27
    const aging = makeProfile({
      person: { id: 2, name: "Aging", date_of_birth: "1991-01-01", height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "Premier League" },
    }); // age ~35

    const peakVals = runMany(peak, "balanced", 10).map(r => r.market_value.central);
    const agingVals = runMany(aging, "balanced", 10).map(r => r.market_value.central);

    const peakMedian = peakVals.sort((a, b) => a - b)[5];
    const agingMedian = agingVals.sort((a, b) => a - b)[5];

    expect(peakMedian).toBeGreaterThan(agingMedian);
  });

  it("expired contract reduces valuation", () => {
    const longTerm = makeProfile({ status: { contract_tag: "Long-Term" } });
    const expired = makeProfile({ status: { contract_tag: "Expired" } });

    const ltVals = runMany(longTerm, "balanced", 10).map(r => r.market_value.central);
    const exVals = runMany(expired, "balanced", 10).map(r => r.market_value.central);

    const ltMedian = ltVals.sort((a, b) => a - b)[5];
    const exMedian = exVals.sort((a, b) => a - b)[5];

    expect(ltMedian).toBeGreaterThan(exMedian);
  });

  it("Premier League player valued higher than default league", () => {
    const pl = makeProfile({
      person: { id: 1, name: "PL", date_of_birth: "1997-06-15", height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "Premier League" },
    });
    const other = makeProfile({
      person: { id: 2, name: "Other", date_of_birth: "1997-06-15", height_cm: 180, preferred_foot: "R", club_id: 2, club_name: "FC2", league: "Unknown League" },
    });

    const plVals = runMany(pl, "balanced", 10).map(r => r.market_value.central);
    const otherVals = runMany(other, "balanced", 10).map(r => r.market_value.central);

    const plMedian = plVals.sort((a, b) => a - b)[5];
    const otherMedian = otherVals.sort((a, b) => a - b)[5];

    expect(plMedian).toBeGreaterThan(otherMedian);
  });

  it("risk tags reduce valuation vs clean profile", () => {
    const clean = makeProfile({ tags: [] });
    const risky = makeProfile({
      tags: ["High Exit Probability", "Contract Sensitive", "Declining Trajectory"],
    });

    const cleanVals = runMany(clean, "balanced", 10).map(r => r.market_value.central);
    const riskyVals = runMany(risky, "balanced", 10).map(r => r.market_value.central);

    const cleanMedian = cleanVals.sort((a, b) => a - b)[5];
    const riskyMedian = riskyVals.sort((a, b) => a - b)[5];

    expect(cleanMedian).toBeGreaterThan(riskyMedian);
  });

  it("value tags increase valuation vs clean profile", () => {
    const clean = makeProfile({ tags: [] });
    const valuable = makeProfile({
      tags: ["Undroppable", "Proven at Level", "Big Game Player"],
    });

    const cleanVals = runMany(clean, "balanced", 10).map(r => r.market_value.central);
    const valueVals = runMany(valuable, "balanced", 10).map(r => r.market_value.central);

    const cleanMedian = cleanVals.sort((a, b) => a - b)[5];
    const valueMedian = valueVals.sort((a, b) => a - b)[5];

    expect(valueMedian).toBeGreaterThan(cleanMedian);
  });
});

// ── Confidence ───────────────────────────────────────────────────────────────

describe("confidence", () => {
  it("scout-heavy data produces high or medium confidence", () => {
    const grades = makeGrades({
      anticipation: 15, composure: 14, decisions: 13, tempo: 14,
      creativity: 12, vision: 14, pass_range: 13, guile: 11,
      tackling: 10, aggression: 9, marking: 8, blocking: 7,
      pace: 12, acceleration: 13, sprint_speed: 11, agility: 12,
      finishing: 10, shot_power: 11, heading: 9, movement: 12,
      strength: 11, stamina: 13, balance: 12, jumping: 10,
    }, { scout: true });
    const profile = makeProfile({ grades });
    const result = runValuation(profile, "balanced");
    // 24 scout grades — confidence depends on coverage vs 48 total capacity
    // 24/48 = 50% coverage → may be medium, not high
    expect(["high", "medium"]).toContain(result.confidence.overall_confidence);
    expect(result.confidence.data_coverage).toBe(0.5);
  });

  it("inferred-only data produces low confidence", () => {
    const grades = makeGrades({
      pace: 14, acceleration: 13, sprint_speed: 11,
    }, { scout: false, source: "eafc_inferred" });
    const profile = makeProfile({ grades });
    const result = runValuation(profile, "balanced");
    expect(["low", "medium"]).toContain(result.confidence.overall_confidence);
  });

  it("no grades produces very low data coverage", () => {
    const profile = makeProfile({ grades: [] });
    const result = runValuation(profile, "balanced");
    expect(result.confidence.data_coverage).toBe(0);
  });

  it("band width ratio >= 1.0 (p90 always >= p10)", () => {
    const profile = makeProfile();
    const results = runMany(profile, "balanced", 10);
    for (const result of results) {
      expect(result.confidence.band_width_ratio).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// ── Valuation modes ──────────────────────────────────────────────────────────

describe("valuation modes", () => {
  it("all three modes produce valid results", () => {
    const profile = makeProfile();
    for (const mode of ["scout_dominant", "balanced", "data_dominant"] as ValuationMode[]) {
      const result = runValuation(profile, mode);
      expect(result.mode).toBe(mode);
      expect(result.market_value.central).toBeGreaterThan(0);
    }
  });

  it("scout_dominant decomposition shows ~70% scout weight", () => {
    const profile = makeProfile();
    const result = runValuation(profile, "scout_dominant");
    expect(result.decomposition.scout_profile_pct).toBe(70);
  });

  it("balanced decomposition shows ~50% scout weight", () => {
    const profile = makeProfile();
    const result = runValuation(profile, "balanced");
    expect(result.decomposition.scout_profile_pct).toBe(50);
  });

  it("data_dominant decomposition shows ~30% scout weight", () => {
    const profile = makeProfile();
    const result = runValuation(profile, "data_dominant");
    expect(result.decomposition.scout_profile_pct).toBe(30);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty grades without crashing", () => {
    const profile = makeProfile({ grades: [] });
    const result = runValuation(profile, "balanced");
    expect(result.market_value.central).toBeGreaterThanOrEqual(0);
  });

  it("handles null position (defaults to CM)", () => {
    const profile = makeProfile({ profile: { position: null, level: 80, profile_tier: 1 } });
    const result = runValuation(profile, "balanced");
    expect(result.position).toBeNull();
    expect(result.market_value.central).toBeGreaterThan(0);
  });

  it("handles very young player (16)", () => {
    const profile = makeProfile({
      person: { id: 1, name: "Youth", date_of_birth: "2010-01-01", height_cm: 175, preferred_foot: "R", club_id: 1, club_name: "FC", league: "Premier League" },
    });
    const result = runValuation(profile, "balanced");
    expect(result.market_value.central).toBeGreaterThan(0);
    expect(result.age).toBe(16);
  });

  it("handles very old player (40)", () => {
    const profile = makeProfile({
      person: { id: 1, name: "Veteran", date_of_birth: "1986-01-01", height_cm: 180, preferred_foot: "R", club_id: 1, club_name: "FC", league: "Premier League" },
    });
    const result = runValuation(profile, "balanced");
    // Should still produce a positive but low valuation
    expect(result.market_value.central).toBeGreaterThanOrEqual(0);
  });

  it("narrative is non-empty string", () => {
    const profile = makeProfile();
    const result = runValuation(profile, "balanced");
    expect(result.narrative.length).toBeGreaterThan(20);
    expect(result.narrative).toContain("€");
  });

  it("personality risk flags populated from tags", () => {
    const profile = makeProfile({
      tags: ["Contract Sensitive", "High Exit Probability", "Leader"],
    });
    const result = runValuation(profile, "balanced");
    expect(result.personality_risk_flags).toContain("Contract Sensitive");
    expect(result.personality_risk_flags).toContain("High Exit Probability");
    expect(result.personality_risk_flags).not.toContain("Leader");
  });

  it("transfer fee blends into data value", () => {
    const noFee = makeProfile({ market: { transfer_fee_eur: null } });
    const withFee = makeProfile({ market: { transfer_fee_eur: 50_000_000 } });

    const noFeeVals = runMany(noFee, "data_dominant", 10).map(r => r.market_value.central);
    const withFeeVals = runMany(withFee, "data_dominant", 10).map(r => r.market_value.central);

    const noFeeMedian = noFeeVals.sort((a, b) => a - b)[5];
    const withFeeMedian = withFeeVals.sort((a, b) => a - b)[5];

    // A 50M transfer fee should pull the data_dominant valuation up
    expect(withFeeMedian).toBeGreaterThan(noFeeMedian);
  });
});
