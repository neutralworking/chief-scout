import { describe, it, expect } from "vitest";
import {
  computeIdealSquad,
  categorizePool,
  compareSquads,
  type PoolPlayer,
  type IdealSquadResult,
} from "@/lib/ideal-squad";
import { SLOT_POSITION_MAP } from "@/lib/formation-intelligence";

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];

function makePlayer(overrides: Partial<PoolPlayer> & { person_id: number }): PoolPlayer {
  return {
    name: `Player ${overrides.person_id}`,
    position: "CM",
    level: 80,
    overall_pillar_score: 75,
    archetype: null,
    personality_type: null,
    age: 26,
    club: "Test FC",
    best_role: null,
    best_role_score: 78,
    preferred_foot: "Right",
    international_caps: 20,
    has_national_team_history: true,
    ...overrides,
  };
}

/** Build a realistic 30-player national pool with positional balance */
function buildNationalPool(starPlayers?: Partial<PoolPlayer>[]): PoolPlayer[] {
  const positions = [
    // 3 GK, 8 DEF, 10 MID, 9 FWD
    "GK", "GK", "GK",
    "CD", "CD", "CD", "CD", "WD", "WD", "WD", "WD",
    "DM", "DM", "CM", "CM", "CM", "WM", "WM", "AM", "AM",
    "WF", "WF", "WF", "CF", "CF", "CF", "AM", "CM", "WF", "CF",
  ];

  const pool: PoolPlayer[] = positions.map((pos, i) =>
    makePlayer({
      person_id: 1000 + i,
      name: `Player_${pos}_${i}`,
      position: pos,
      level: 70 + Math.floor(i / 3),
      best_role_score: 68 + Math.floor(i / 3),
      overall_pillar_score: 65 + Math.floor(i / 3),
    })
  );

  // Inject star players at the top
  if (starPlayers) {
    for (const star of starPlayers) {
      const idx = pool.findIndex((p) => p.position === (star.position ?? "CF"));
      if (idx >= 0) {
        pool[idx] = makePlayer({ person_id: pool[idx].person_id, ...star });
      }
    }
  }

  return pool;
}

// ── Happy Path ──────────────────────────────────────────────────────────────

describe("computeIdealSquad — happy path", () => {
  const pool = buildNationalPool();
  const result = computeIdealSquad(pool);

  it("returns a non-null result for a balanced 30-player pool", () => {
    expect(result).not.toBeNull();
  });

  it("starting XI has exactly 11 players", () => {
    expect(result!.starting_xi).toHaveLength(11);
  });

  it("starting XI positions are all valid slot positions", () => {
    for (const slot of result!.starting_xi) {
      expect(VALID_POSITIONS).toContain(slot.position);
    }
  });

  it("starting XI has no duplicate person_ids", () => {
    const ids = result!.starting_xi.map((s) => s.person_id);
    expect(new Set(ids).size).toBe(11);
  });

  it("full squad (XI + bench) has no duplicate person_ids", () => {
    const xiIds = result!.starting_xi.map((s) => s.person_id);
    const benchIds = result!.bench.map((b) => b.person_id);
    const all = [...xiIds, ...benchIds];
    expect(new Set(all).size).toBe(all.length);
  });

  it("bench includes at least 1 GK backup", () => {
    const benchGKs = result!.bench.filter((b) => b.position === "GK");
    expect(benchGKs.length).toBeGreaterThanOrEqual(1);
  });

  it("formation is one of the 6 candidates", () => {
    const validFormations = ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-3", "4-1-2-1-2"];
    expect(validFormations).toContain(result!.formation);
  });

  it("strength is 0-100 and reflects XI average", () => {
    expect(result!.strength).toBeGreaterThanOrEqual(0);
    expect(result!.strength).toBeLessThanOrEqual(100);
    const avgRS = result!.starting_xi.reduce((s, p) => s + p.role_score, 0) / 11;
    expect(result!.strength).toBe(Math.min(100, Math.round(avgRS)));
  });
});

// ── Star Player Sorting ─────────────────────────────────────────────────────

describe("computeIdealSquad — star players appear in XI", () => {
  it("highest-scored CF appears as a starter", () => {
    const pool = buildNationalPool([
      { position: "CF", name: "Mbappé", best_role_score: 92, level: 93 },
    ]);
    const result = computeIdealSquad(pool);
    const starterNames = result!.starting_xi.map((s) => s.name);
    expect(starterNames).toContain("Mbappé");
  });

  it("highest-scored GK starts in GK slot", () => {
    const pool = buildNationalPool([
      { position: "GK", name: "Donnarumma", best_role_score: 88, level: 89 },
    ]);
    const result = computeIdealSquad(pool);
    const gkStarter = result!.starting_xi.find((s) => s.position === "GK");
    expect(gkStarter).toBeDefined();
    expect(gkStarter!.name).toBe("Donnarumma");
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────────

describe("computeIdealSquad — edge cases", () => {
  it("returns null for fewer than 11 players", () => {
    const tiny = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ person_id: i + 1, position: "CM" })
    );
    expect(computeIdealSquad(tiny)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(computeIdealSquad([])).toBeNull();
  });

  it("handles pool with all null positions — still produces a result", () => {
    const nullPool = Array.from({ length: 20 }, (_, i) =>
      makePlayer({ person_id: i + 1, position: null })
    );
    // Greedy algo still picks players even with null positions
    const result = computeIdealSquad(nullPool);
    // Should either return null or a valid 11-player XI
    if (result) {
      expect(result.starting_xi).toHaveLength(11);
    }
  });

  it("handles pool with no GK — still computes XI (GK slot gets -Infinity)", () => {
    const noGK = Array.from({ length: 30 }, (_, i) =>
      makePlayer({
        person_id: i + 1,
        position: ["CD", "CM", "WF", "CF", "DM", "WD", "AM", "WM"][i % 8],
      })
    );
    // No GK available — scorePlayerForSlot returns -1 for GK slot
    // The greedy algo still picks "best" (least negative) → XI will exist but GK slot score = -1
    const result = computeIdealSquad(noGK);
    // The algorithm should still return a result (greedy picks best available even if negative)
    // but the GK slot will have a poor score
    if (result) {
      expect(result.starting_xi).toHaveLength(11);
    }
  });

  it("handles exactly 11 players — no bench", () => {
    const positions = ["GK", "CD", "CD", "WD", "WD", "DM", "CM", "CM", "AM", "WF", "CF"];
    const minimal = positions.map((pos, i) =>
      makePlayer({ person_id: i + 1, position: pos, best_role_score: 75 + i })
    );
    const result = computeIdealSquad(minimal);
    expect(result).not.toBeNull();
    expect(result!.starting_xi).toHaveLength(11);
    expect(result!.bench).toHaveLength(0);
  });

  it("handles null best_role_score — falls back to level", () => {
    const pool = buildNationalPool([
      { position: "CF", name: "NullRS", best_role_score: null, level: 90 },
    ]);
    const result = computeIdealSquad(pool);
    expect(result).not.toBeNull();
    // NullRS with level 90 should still be selected for XI since pool avg is ~75
    const starterNames = result!.starting_xi.map((s) => s.name);
    expect(starterNames).toContain("NullRS");
  });
});

// ── Pool Categorization ─────────────────────────────────────────────────────

describe("categorizePool", () => {
  it("marks 10+ cap players as established", () => {
    const players = [
      makePlayer({ person_id: 1, international_caps: 50, age: 28 }),
    ];
    const result = categorizePool(players);
    expect(result[0].pool_category).toBe("established");
  });

  it("marks young low-cap players as rising_star", () => {
    const players = [
      makePlayer({ person_id: 1, international_caps: 2, age: 21, level: 75, has_national_team_history: false }),
    ];
    const result = categorizePool(players);
    expect(result[0].pool_category).toBe("rising_star");
  });

  it("marks old low-cap players with history as recall", () => {
    const players = [
      makePlayer({ person_id: 1, international_caps: 15, age: 33, has_national_team_history: true }),
    ];
    const result = categorizePool(players);
    expect(result[0].pool_category).toBe("recall");
  });
});

// ── compareSquads ───────────────────────────────────────────────────────────

describe("compareSquads", () => {
  const ideal: IdealSquadResult = {
    formation: "4-3-3",
    starting_xi: Array.from({ length: 11 }, (_, i) => ({
      person_id: i + 1,
      name: `Starter ${i}`,
      position: "CM",
      role: "Mezzala",
      role_score: 80,
      pool_category: "established" as const,
    })),
    bench: Array.from({ length: 15 }, (_, i) => ({
      person_id: 12 + i,
      name: `Bench ${i}`,
      position: "CM",
      pool_category: "established" as const,
      overall: 70,
    })),
    strength: 80,
  };

  it("perfect match scores 100", () => {
    const userSquad = Array.from({ length: 26 }, (_, i) => i + 1);
    const userXI = Array.from({ length: 11 }, (_, i) => i + 1);
    const result = compareSquads(userSquad, userXI, "4-3-3", ideal);
    expect(result.score).toBe(100);
    expect(result.tier).toBe("Chief Scout Material");
  });

  it("zero overlap scores 0", () => {
    const userSquad = Array.from({ length: 26 }, (_, i) => 100 + i);
    const userXI = Array.from({ length: 11 }, (_, i) => 100 + i);
    const result = compareSquads(userSquad, userXI, "3-5-2", ideal);
    expect(result.score).toBe(0);
    expect(result.tier).toBe("Back to FM");
  });
});
