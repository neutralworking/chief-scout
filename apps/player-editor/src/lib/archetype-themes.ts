/**
 * Archetype-themed card styles
 *
 * "General" theme (Commander, Controller, Cover, Destroyer) — Helvetica business card:
 *   Clean lines, neutral palette, structured layout, sharp borders
 *
 * "Entertainer" theme (Creator, Dribbler, Striker) — Carnival:
 *   Vibrant gradients, rounded shapes, bold color pops
 *
 * "Athlete" theme (Target, Sprinter, Powerhouse, Engine) — Sports performance:
 *   Bold typography, dynamic borders, energy colors
 *
 * "Technician" theme (Passer, Keeper) — Blueprint:
 *   Monospace accents, technical borders, precise layout
 */

export type CardTheme = "general" | "entertainer" | "athlete" | "technician" | "default";

const ARCHETYPE_THEME_MAP: Record<string, CardTheme> = {
  // General — structured, commanding, business-like
  Commander: "general",
  Controller: "general",
  Cover: "general",
  Destroyer: "general",
  // Entertainer — flair, creativity, showmanship
  Creator: "entertainer",
  Dribbler: "entertainer",
  Striker: "entertainer",
  // Athlete — power, speed, engine
  Target: "athlete",
  Sprinter: "athlete",
  Powerhouse: "athlete",
  Engine: "athlete",
  // Technician — precision, passing, positioning
  Passer: "technician",
  Keeper: "technician",
};

export function getCardTheme(archetype: string | null): CardTheme {
  if (!archetype) return "default";
  return ARCHETYPE_THEME_MAP[archetype] ?? "default";
}

export interface ThemeStyles {
  card: string;
  archetypeText: string;
  accent: string;
  borderAccent: string;
  nameFont: string;
}

export const THEME_STYLES: Record<CardTheme, ThemeStyles> = {
  general: {
    // Helvetica business card — clean, sharp, corporate
    card: "border-l-2 border-l-zinc-400 bg-gradient-to-br from-[#1a1a2e] to-[#15152a] rounded-none",
    archetypeText: "font-sans font-bold uppercase tracking-[0.2em] text-zinc-300",
    accent: "text-zinc-300",
    borderAccent: "border-zinc-500/40",
    nameFont: "font-sans font-bold tracking-wide",
  },
  entertainer: {
    // Carnival — vibrant gradients, rounded, bold
    card: "border-2 border-transparent bg-gradient-to-br from-fuchsia-950/40 via-[#1a1a2e] to-amber-950/30 rounded-2xl ring-1 ring-fuchsia-500/20",
    archetypeText: "font-sans font-black italic text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-amber-400",
    accent: "text-fuchsia-400",
    borderAccent: "border-fuchsia-500/30",
    nameFont: "font-sans font-black",
  },
  athlete: {
    // Sports performance — bold, dynamic
    card: "border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-950/20 to-[#1a1a2e] rounded-lg",
    archetypeText: "font-sans font-extrabold uppercase tracking-wider text-amber-400",
    accent: "text-amber-400",
    borderAccent: "border-amber-500/30",
    nameFont: "font-sans font-extrabold",
  },
  technician: {
    // Blueprint — monospace, precise, technical
    card: "border border-blue-500/20 bg-[#12122a] rounded-lg",
    archetypeText: "font-mono font-semibold text-blue-400 tracking-wider",
    accent: "text-blue-400",
    borderAccent: "border-blue-500/20",
    nameFont: "font-sans font-semibold",
  },
  default: {
    card: "border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-lg",
    archetypeText: "text-[var(--accent-tactical)]",
    accent: "text-[var(--accent-tactical)]",
    borderAccent: "border-[var(--border-subtle)]",
    nameFont: "font-sans font-semibold",
  },
};
