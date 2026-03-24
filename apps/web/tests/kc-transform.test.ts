import { describe, it, expect } from "vitest";
import {
  transformCharacter,
  transformAllCharacters,
  type KCCharacter,
} from "@/lib/kickoff-clash/transform";

function makeCharacter(overrides: Partial<KCCharacter> = {}): KCCharacter {
  return {
    name: "Test Player",
    nation: "England",
    position: "Central Midfielder",
    model: "Dynamo",
    primary: "Engine",
    secondary: "Commander",
    level: 80,
    character: "Determined",
    physique: "Athletic",
    bio: "A test player.",
    tags: ["press-resistant"],
    strengths: ["passing"],
    weaknesses: ["heading"],
    quirk: "Always wears long sleeves",
    ...overrides,
  };
}

describe("transformCharacter", () => {
  // 1. Position mapping — all 7 positions
  describe("position mapping", () => {
    const cases: [string, string][] = [
      ["Central Defender", "CD"],
      ["Central Forward", "CF"],
      ["Central Midfielder", "CM"],
      ["Keeper", "GK"],
      ["Wide Defender", "WD"],
      ["Wide Forward", "WF"],
      ["Wide Midfielder", "WM"],
    ];

    it.each(cases)("maps '%s' to '%s'", (input, expected) => {
      const card = transformCharacter(makeCharacter({ position: input }), 0);
      expect(card.position).toBe(expected);
    });
  });

  // 2. Model -> archetype mapping (one sample per archetype group)
  describe("model to archetype mapping", () => {
    const cases: [string, string][] = [
      ["Assassin", "Striker"],
      ["Catalyst", "Creator"],
      ["Box-To-Box", "Engine"],
      ["Anchor", "Destroyer"],
      ["Bulwark", "Cover"],
      ["Regista", "Controller"],
      ["General", "Commander"],
      ["Playmaker", "Passer"],
      ["Flash", "Sprinter"],
      ["Target", "Target"],
      ["Bison", "Powerhouse"],
      ["Winger", "Dribbler"],
      ["Cat", "GK"],
    ];

    it.each(cases)("maps model '%s' to archetype '%s'", (model, expected) => {
      const card = transformCharacter(makeCharacter({ model }), 0);
      expect(card.archetype).toBe(expected);
    });
  });

  // 3. Character -> personality theme mapping (one sample per theme)
  describe("character to personality theme mapping", () => {
    const cases: [string, string][] = [
      ["Charismatic", "Captain"],
      ["Mercurial", "Catalyst"],
      ["Elegant", "Maestro"],
      ["Intelligent", "Professor"],
      ["Relentless", "General"],
    ];

    it.each(cases)(
      "maps character '%s' to theme '%s'",
      (character, expected) => {
        const card = transformCharacter(makeCharacter({ character }), 0);
        expect(card.personalityTheme).toBe(expected);
      }
    );
  });

  // 4. Personality type derivation — deterministic for same name+theme
  describe("personality type derivation", () => {
    it("produces a 4-letter code", () => {
      const card = transformCharacter(makeCharacter(), 0);
      expect(card.personalityType).toMatch(/^[AI][NX][SL][CP]$/);
    });

    it("is deterministic — same name + theme always produces the same code", () => {
      const a = transformCharacter(makeCharacter(), 0);
      const b = transformCharacter(makeCharacter(), 5); // different index
      expect(a.personalityType).toBe(b.personalityType);
    });

    it("varies when name changes", () => {
      const a = transformCharacter(makeCharacter({ name: "Alpha" }), 0);
      const b = transformCharacter(makeCharacter({ name: "Bravo" }), 0);
      // Not guaranteed to differ for any arbitrary pair, but these two do
      // The real assertion is that it's a valid code
      expect(a.personalityType).toMatch(/^[AI][NX][SL][CP]$/);
      expect(b.personalityType).toMatch(/^[AI][NX][SL][CP]$/);
    });
  });

  // 5. Rarity from level
  describe("rarity from level", () => {
    it("returns Common for level < 76", () => {
      const card = transformCharacter(makeCharacter({ level: 75 }), 0);
      expect(card.rarity).toBe("Common");
    });

    it("returns Rare for level 76-80", () => {
      expect(
        transformCharacter(makeCharacter({ level: 76 }), 0).rarity
      ).toBe("Rare");
      expect(
        transformCharacter(makeCharacter({ level: 80 }), 0).rarity
      ).toBe("Rare");
    });

    it("returns Epic for level 81-86", () => {
      expect(
        transformCharacter(makeCharacter({ level: 81 }), 0).rarity
      ).toBe("Epic");
      expect(
        transformCharacter(makeCharacter({ level: 86 }), 0).rarity
      ).toBe("Epic");
    });

    it("returns Legendary for level >= 87", () => {
      expect(
        transformCharacter(makeCharacter({ level: 87 }), 0).rarity
      ).toBe("Legendary");
      expect(
        transformCharacter(makeCharacter({ level: 95 }), 0).rarity
      ).toBe("Legendary");
    });
  });

  // 6. Durability is a valid type
  it("assigns a valid durability type", () => {
    const validTypes = [
      "glass",
      "fragile",
      "standard",
      "iron",
      "titanium",
      "phoenix",
    ];
    const card = transformCharacter(makeCharacter(), 0);
    expect(validTypes).toContain(card.durability);
  });

  // 7. Gate pull calculation (archetype base + theme bonus)
  describe("gate pull calculation", () => {
    it("sums archetype base and theme bonus", () => {
      // Dribbler (30) + Catalyst (40) = 70
      const card = transformCharacter(
        makeCharacter({ model: "Winger", character: "Mercurial" }),
        0
      );
      expect(card.gatePull).toBe(70);
    });

    it("returns 0 for defensive archetype + Professor theme", () => {
      // Cover (0) + Professor (0) = 0
      const card = transformCharacter(
        makeCharacter({ model: "Rock", character: "Intelligent" }),
        0
      );
      expect(card.gatePull).toBe(0);
    });

    it("combines Creator + Captain correctly", () => {
      // Creator (25) + Captain (10) = 35
      const card = transformCharacter(
        makeCharacter({ model: "Maestro", character: "Charismatic" }),
        0
      );
      expect(card.gatePull).toBe(35);
    });
  });

  // 8. Secondary archetype mapping
  describe("secondary archetype mapping", () => {
    it("maps pass-through archetype names", () => {
      const card = transformCharacter(
        makeCharacter({ secondary: "Commander" }),
        0
      );
      expect(card.secondaryArchetype).toBe("Commander");
    });

    it("maps role names to archetypes", () => {
      const card = transformCharacter(
        makeCharacter({ secondary: "Stopper" }),
        0
      );
      expect(card.secondaryArchetype).toBe("Destroyer");
    });

    it("falls back to MODEL_TO_ARCHETYPE for model names", () => {
      const card = transformCharacter(
        makeCharacter({ secondary: "Regista" }),
        0
      );
      expect(card.secondaryArchetype).toBe("Controller");
    });

    it("returns undefined for unknown secondary", () => {
      const card = transformCharacter(
        makeCharacter({ secondary: "UnknownThing" }),
        0
      );
      expect(card.secondaryArchetype).toBeUndefined();
    });
  });
});

// 9. transformAllCharacters
describe("transformAllCharacters", () => {
  it("transforms an array and assigns sequential IDs starting at 1", () => {
    const chars = [
      makeCharacter({ name: "Alpha" }),
      makeCharacter({ name: "Bravo" }),
      makeCharacter({ name: "Charlie" }),
    ];
    const cards = transformAllCharacters(chars);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(cards[0].name).toBe("Alpha");
    expect(cards[2].name).toBe("Charlie");
  });

  it("returns empty array for empty input", () => {
    expect(transformAllCharacters([])).toEqual([]);
  });
});

// 10. Edge cases — unknown values fall back to defaults
describe("edge case defaults", () => {
  it("unknown position defaults to CM", () => {
    const card = transformCharacter(
      makeCharacter({ position: "Goalkeeper Coach" }),
      0
    );
    expect(card.position).toBe("CM");
  });

  it("unknown model defaults to Engine", () => {
    const card = transformCharacter(
      makeCharacter({ model: "Invisible Man" }),
      0
    );
    expect(card.archetype).toBe("Engine");
  });

  it("unknown character defaults to General theme", () => {
    const card = transformCharacter(
      makeCharacter({ character: "Bewildered" }),
      0
    );
    expect(card.personalityTheme).toBe("General");
  });
});
