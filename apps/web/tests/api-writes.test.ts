/**
 * Tests for write API endpoint safety — validates input handling,
 * table whitelisting, and key column selection.
 *
 * These test the validation logic extracted from the API routes,
 * not the Supabase calls themselves (those need integration tests).
 *
 * Priority: MEDIUM-HIGH — write endpoints that skip validation
 * could corrupt data or target wrong tables.
 */
import { describe, it, expect } from "vitest";

// ── Extracted validation logic (mirrors route.ts) ────────────────────────────

const ALLOWED_TABLES = ["player_status", "player_profiles", "player_market", "people", "player_personality"];

function validatePlayerUpdate(body: Record<string, unknown>): { ok: true; table: string; keyCol: string } | { ok: false; error: string } {
  const { person_id, table, updates } = body;

  if (!person_id || !table || !updates || typeof updates !== "object" || Object.keys(updates as object).length === 0) {
    return { ok: false, error: "Missing person_id, table, or updates" };
  }

  if (!ALLOWED_TABLES.includes(table as string)) {
    return { ok: false, error: `Table ${table} not allowed` };
  }

  const keyCol = table === "people" ? "id" : "person_id";
  return { ok: true, table: table as string, keyCol };
}

function validateGradeUpsert(body: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  const { player_id, attribute } = body;
  if (!player_id || !attribute) {
    return { ok: false, error: "Missing player_id or attribute" };
  }
  return { ok: true };
}

// ── Player Update Validation ─────────────────────────────────────────────────

describe("player-update validation", () => {
  it("accepts valid update to player_profiles", () => {
    const result = validatePlayerUpdate({
      person_id: 123,
      table: "player_profiles",
      updates: { best_role: "Regista" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.table).toBe("player_profiles");
      expect(result.keyCol).toBe("person_id");
    }
  });

  it("accepts valid update to people table with id key", () => {
    const result = validatePlayerUpdate({
      person_id: 123,
      table: "people",
      updates: { name: "Updated Name" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.keyCol).toBe("id");
    }
  });

  it("accepts all 5 allowed tables", () => {
    for (const table of ALLOWED_TABLES) {
      const result = validatePlayerUpdate({
        person_id: 1,
        table,
        updates: { foo: "bar" },
      });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects disallowed table names", () => {
    const dangerous = [
      "users", "auth.users", "attribute_grades", "network_edits",
      "sb_events", "news_stories", "player_id_links",
      "people; DROP TABLE people;--",
    ];
    for (const table of dangerous) {
      const result = validatePlayerUpdate({
        person_id: 1,
        table,
        updates: { foo: "bar" },
      });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects missing person_id", () => {
    const result = validatePlayerUpdate({
      table: "player_profiles",
      updates: { best_role: "Regista" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing table", () => {
    const result = validatePlayerUpdate({
      person_id: 123,
      updates: { best_role: "Regista" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing updates", () => {
    const result = validatePlayerUpdate({
      person_id: 123,
      table: "player_profiles",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty updates object", () => {
    const result = validatePlayerUpdate({
      person_id: 123,
      table: "player_profiles",
      updates: {},
    });
    expect(result.ok).toBe(false);
  });

  it("rejects person_id = 0 (falsy)", () => {
    const result = validatePlayerUpdate({
      person_id: 0,
      table: "player_profiles",
      updates: { best_role: "Regista" },
    });
    expect(result.ok).toBe(false);
  });

  it("uses person_id key for feature tables", () => {
    for (const table of ["player_profiles", "player_status", "player_market", "player_personality"]) {
      const result = validatePlayerUpdate({
        person_id: 1,
        table,
        updates: { foo: "bar" },
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.keyCol).toBe("person_id");
    }
  });

  it("uses id key for people table", () => {
    const result = validatePlayerUpdate({
      person_id: 1,
      table: "people",
      updates: { name: "Test" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.keyCol).toBe("id");
  });
});

// ── Grade Upsert Validation ──────────────────────────────────────────────────

describe("grade upsert validation", () => {
  it("accepts valid grade upsert", () => {
    const result = validateGradeUpsert({
      player_id: 123,
      attribute: "tackling",
      scout_grade: 15,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing player_id", () => {
    const result = validateGradeUpsert({
      attribute: "tackling",
      scout_grade: 15,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing attribute", () => {
    const result = validateGradeUpsert({
      player_id: 123,
      scout_grade: 15,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts null scout_grade (clearing a grade)", () => {
    const result = validateGradeUpsert({
      player_id: 123,
      attribute: "tackling",
      scout_grade: null,
    });
    expect(result.ok).toBe(true);
  });
});

// ── Contract tag → years mapping ─────────────────────────────────────────────

describe("contract tag mapping", () => {
  const CONTRACT_MAP: Record<string, number> = {
    "Long-Term": 4.0,
    "Extension Talks": 3.0,
    "One Year Left": 1.0,
    "Six Months": 0.5,
    "Expired": 0.0,
  };

  it("all known tags map to expected years", () => {
    for (const [tag, years] of Object.entries(CONTRACT_MAP)) {
      expect(years).toBeGreaterThanOrEqual(0);
      expect(years).toBeLessThanOrEqual(5);
    }
  });

  it("expired gives 0 years", () => {
    expect(CONTRACT_MAP["Expired"]).toBe(0);
  });

  it("long-term gives 4 years", () => {
    expect(CONTRACT_MAP["Long-Term"]).toBe(4);
  });
});

// ── Audit log structure ──────────────────────────────────────────────────────

describe("audit log structure", () => {
  function buildAuditEdits(
    person_id: number,
    table: string,
    updates: Record<string, unknown>,
    oldRow: Record<string, unknown> | null,
  ) {
    return Object.entries(updates).map(([field, newValue]) => ({
      person_id,
      field,
      old_value: oldRow ? String(oldRow[field] ?? "") : null,
      new_value: newValue != null ? String(newValue) : null,
      table_name: table,
    }));
  }

  it("creates one edit per updated field", () => {
    const edits = buildAuditEdits(123, "player_profiles", {
      best_role: "Regista",
      best_role_score: 85,
    }, { best_role: "Mezzala", best_role_score: 72 });

    expect(edits).toHaveLength(2);
    expect(edits[0].field).toBe("best_role");
    expect(edits[0].old_value).toBe("Mezzala");
    expect(edits[0].new_value).toBe("Regista");
    expect(edits[1].field).toBe("best_role_score");
    expect(edits[1].old_value).toBe("72");
    expect(edits[1].new_value).toBe("85");
  });

  it("handles null old row (new record)", () => {
    const edits = buildAuditEdits(123, "player_profiles", {
      best_role: "Regista",
    }, null);

    expect(edits[0].old_value).toBeNull();
    expect(edits[0].new_value).toBe("Regista");
  });

  it("handles null new value (clearing a field)", () => {
    const edits = buildAuditEdits(123, "player_profiles", {
      best_role: null,
    }, { best_role: "Regista" });

    expect(edits[0].old_value).toBe("Regista");
    expect(edits[0].new_value).toBeNull();
  });

  it("stringifies missing old values as empty string", () => {
    const edits = buildAuditEdits(123, "player_profiles", {
      best_role: "New",
    }, { other_field: "exists" });

    // best_role not in oldRow → undefined → ""
    expect(edits[0].old_value).toBe("");
  });

  it("includes table_name for cross-table audit trail", () => {
    const edits = buildAuditEdits(123, "player_status", {
      pursuit_status: "Priority",
    }, null);

    expect(edits[0].table_name).toBe("player_status");
  });
});
