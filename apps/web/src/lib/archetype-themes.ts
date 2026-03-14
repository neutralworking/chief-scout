/**
 * Personality-themed card styles
 *
 * Card visual treatment is driven by PERSONALITY TYPE (WHO the player is),
 * not by playing archetype (HOW they play).
 *
 * The 16 personality types group into 5 visual motifs:
 *
 * "General" — The General (ANLC), The Machine (ANSC), The Director-types
 *   Helvetica business card: clean lines, neutral palette, sharp borders
 *   Personality traits: Analytical, structured, disciplined, relentless
 *
 * "Warrior" — The Warrior (AXLC), The Maverick (IXSC), The Livewire (IXLC)
 *   Carnival: vibrant gradients, rounded shapes, bold color pops
 *   Personality traits: Flair-driven, occasion-fuelled, confrontational
 *
 * "Maestro" — The Maestro (INSP), The Conductor (ANLP), The Genius (IXSP)
 *   Silk: elegant, muted gold accents, refined typography
 *   Personality traits: Composed, brilliant, self-motivated, quietly class
 *
 * "Captain" — The Captain (INLC), The Guardian (INLP), The Enforcer (AXSC)
 *   Military: bold stripe, strong border, commanding presence
 *   Personality traits: Leader, competitive, vocal, organizes others
 *
 * "Professor" — The Professor (ANSP), The Technician (AXSP), The Playmaker (IXLP)
 *   Blueprint: monospace accents, technical borders, precise layout
 *   Personality traits: Analytical, composed, self-contained, precise
 */

export type CardTheme = "general" | "showman" | "maestro" | "captain" | "professor" | "default";

// Maps personality_type 4-letter code → card theme
const PERSONALITY_THEME_MAP: Record<string, CardTheme> = {
  // General — structured, disciplined, business-like
  ANLC: "general",     // The General
  ANSC: "general",     // The Machine
  INSC: "general",     // The Blade

  // Warrior — flair, carnival, feeds off atmosphere
  AXLC: "showman",     // The Warrior
  IXSC: "showman",     // The Maverick
  IXLC: "showman",     // The Livewire

  // Maestro — elegant, composed, silk
  INSP: "maestro",     // The Maestro
  ANLP: "maestro",     // The Conductor
  IXSP: "maestro",     // The Genius

  // Captain — commanding, leader, military
  INLC: "captain",     // The Captain
  INLP: "captain",     // The Guardian
  AXSC: "captain",     // The Enforcer

  // Professor — analytical, composed, technical
  ANSP: "professor",   // The Professor
  AXSP: "professor",   // The Technician
  IXLP: "professor",   // The Playmaker
  AXLP: "professor",   // The Orchestrator
};

/**
 * Get card theme from personality_type code.
 * Falls back to "default" if no personality assigned.
 */
export function getCardTheme(personalityType: string | null): CardTheme {
  if (!personalityType) return "default";
  return PERSONALITY_THEME_MAP[personalityType] ?? "default";
}

export interface ThemeStyles {
  card: string;
  personalityText: string;
  accent: string;
  borderAccent: string;
  nameFont: string;
}

export const THEME_STYLES: Record<CardTheme, ThemeStyles> = {
  general: {
    // Helvetica business card — clean, sharp, corporate
    card: "border-l-2 border-l-zinc-400 bg-gradient-to-br from-[#1a1a2e] to-[#15152a] rounded-none",
    personalityText: "font-sans font-bold uppercase tracking-[0.2em] text-zinc-300",
    accent: "text-zinc-300",
    borderAccent: "border-zinc-500/40",
    nameFont: "font-sans font-bold tracking-wide",
  },
  showman: {
    // Carnival — vibrant gradients, rounded, bold
    card: "border-2 border-transparent bg-gradient-to-br from-fuchsia-950/40 via-[#1a1a2e] to-amber-950/30 rounded-2xl ring-1 ring-fuchsia-500/20",
    personalityText: "font-sans font-black italic text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-amber-400",
    accent: "text-fuchsia-400",
    borderAccent: "border-fuchsia-500/30",
    nameFont: "font-sans font-black",
  },
  maestro: {
    // Silk — elegant, understated gold, refined
    card: "border border-amber-500/15 bg-gradient-to-br from-amber-950/10 to-[#1a1a2e] rounded-xl",
    personalityText: "font-sans font-medium italic text-amber-300/80",
    accent: "text-amber-300/80",
    borderAccent: "border-amber-500/15",
    nameFont: "font-sans font-medium tracking-tight",
  },
  captain: {
    // Military — bold stripe, commanding
    card: "border-l-4 border-l-red-600 bg-gradient-to-br from-red-950/15 to-[#1a1a2e] rounded-lg",
    personalityText: "font-sans font-extrabold uppercase tracking-wider text-red-400",
    accent: "text-red-400",
    borderAccent: "border-red-600/30",
    nameFont: "font-sans font-extrabold",
  },
  professor: {
    // Blueprint — monospace, precise, technical
    card: "border border-blue-500/20 bg-[#12122a] rounded-lg",
    personalityText: "font-mono font-semibold text-blue-400 tracking-wider",
    accent: "text-blue-400",
    borderAccent: "border-blue-500/20",
    nameFont: "font-sans font-semibold",
  },
  default: {
    card: "border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-lg",
    personalityText: "text-[var(--accent-personality)]",
    accent: "text-[var(--accent-personality)]",
    borderAccent: "border-[var(--border-subtle)]",
    nameFont: "font-sans font-semibold",
  },
};
