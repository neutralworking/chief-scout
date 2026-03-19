/**
 * Canonical personality type definitions.
 * Single source of truth — import this everywhere, don't duplicate.
 */

export interface PersonalityType {
  code: string;
  name: string;        // Display name without "The"
  fullName: string;    // "The X" for narrative contexts
  oneLiner: string;    // Short description with full stops
  theme: PersonalityTheme;
}

export type PersonalityTheme = "general" | "catalyst" | "maestro" | "captain" | "professor";

export const PERSONALITY_TYPES: Record<string, PersonalityType> = {
  ANLC: {
    code: "ANLC", name: "General", fullName: "The General",
    oneLiner: "Reads the game analytically. Self-driven. Organises others. Thrives when it matters most.",
    theme: "general",
  },
  ANSC: {
    code: "ANSC", name: "Machine", fullName: "The Machine",
    oneLiner: "Systematic reader of the game. Self-motivated. Quiet but relentless. Consistently delivers.",
    theme: "general",
  },
  ANLP: {
    code: "ANLP", name: "Conductor", fullName: "The Conductor",
    oneLiner: "Tactical organiser. Self-driven. Leads through control. Ice-cold composure.",
    theme: "general",
  },
  ANSP: {
    code: "ANSP", name: "Professor", fullName: "The Professor",
    oneLiner: "Analytical. Self-motivated. Self-contained. Composed under the highest pressure.",
    theme: "professor",
  },
  INLC: {
    code: "INLC", name: "Captain", fullName: "The Captain",
    oneLiner: "Instinct-driven. Self-motivated. Vocal leader. Fierce competitor who sets the standard.",
    theme: "captain",
  },
  INSC: {
    code: "INSC", name: "Mamba", fullName: "The Mamba",
    oneLiner: "Instinctive. Self-driven. Self-reliant. Strikes with precision and competitive edge.",
    theme: "general",
  },
  INSP: {
    code: "INSP", name: "Maestro", fullName: "The Maestro",
    oneLiner: "Creative and self-motivated. Quietly brilliant. Composed under pressure.",
    theme: "maestro",
  },
  INLP: {
    code: "INLP", name: "Guardian", fullName: "The Guardian",
    oneLiner: "Instinctive. Self-motivated. Vocal organiser. A calm and steady presence.",
    theme: "captain",
  },
  AXLC: {
    code: "AXLC", name: "Catalyst", fullName: "The Catalyst",
    oneLiner: "Analytical mind fuelled by atmosphere. Demands attention. Leads through confrontation.",
    theme: "catalyst",
  },
  AXSC: {
    code: "AXSC", name: "Enforcer", fullName: "The Enforcer",
    oneLiner: "Reads patterns. Fuelled by the occasion. Self-focused. Aggressive competitor.",
    theme: "catalyst",
  },
  AXSP: {
    code: "AXSP", name: "Technician", fullName: "The Technician",
    oneLiner: "Structured thinker. Occasion-driven. Self-contained. Calm under pressure.",
    theme: "professor",
  },
  AXLP: {
    code: "AXLP", name: "Orchestrator", fullName: "The Orchestrator",
    oneLiner: "Tactical mind who feeds off the crowd. Organises others. Composed and decisive.",
    theme: "professor",
  },
  IXSC: {
    code: "IXSC", name: "Maverick", fullName: "The Maverick",
    oneLiner: "Flair player who needs the big stage. Self-focused. Rises to confrontation.",
    theme: "catalyst",
  },
  IXSP: {
    code: "IXSP", name: "Spark", fullName: "The Spark",
    oneLiner: "Improviser who lives for the occasion. Self-contained. Ice-cold under pressure.",
    theme: "maestro",
  },
  IXLC: {
    code: "IXLC", name: "Livewire", fullName: "The Livewire",
    oneLiner: "Improviser fuelled by occasion. Leads vocally. Thrives on confrontation.",
    theme: "catalyst",
  },
  IXLP: {
    code: "IXLP", name: "Playmaker", fullName: "The Playmaker",
    oneLiner: "Creative improviser. Occasion-driven. Organises play. Composed decision-maker.",
    theme: "maestro",
  },
};

/** Get personality name from code. Returns code itself if unknown. */
export function getPersonalityName(code: string | null): string | null {
  if (!code) return null;
  return PERSONALITY_TYPES[code]?.name ?? code;
}

/** Get full personality name ("The X") from code. */
export function getPersonalityFullName(code: string | null): string | null {
  if (!code) return null;
  return PERSONALITY_TYPES[code]?.fullName ?? code;
}

/** Get one-liner description from code. */
export function getPersonalityOneLiner(code: string | null): string | null {
  if (!code) return null;
  return PERSONALITY_TYPES[code]?.oneLiner ?? null;
}

/** Format for display: "Mamba (INSC)" — codename primary, acronym secondary. */
export function formatPersonality(code: string | null): string | null {
  if (!code) return null;
  const pt = PERSONALITY_TYPES[code];
  if (!pt) return code;
  return `${pt.name} (${code})`;
}
