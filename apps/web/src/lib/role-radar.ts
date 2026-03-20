/**
 * Role-specific radar axes.
 *
 * Each tactical role maps to 4-5 key models that define what makes
 * someone good at that role. The MiniRadar uses these as axes instead
 * of a generic radar. Falls back to position-specific axes.
 */

import { MODEL_LABEL } from "@/lib/models";

export interface RoleRadarConfig {
  models: string[];  // Full model names (e.g. "Controller")
  labels: string[];  // Short display labels (e.g. "CTR")
}

/** Role name → radar axes (4-5 models most relevant to that role).
 *
 * PRIMARY entries: pipeline-computed roles from 27_player_ratings.py TACTICAL_ROLES.
 * Legacy entries kept as aliases so old best_role values still get a radar. */
export const ROLE_RADAR_AXES: Record<string, RoleRadarConfig> = {
  // ── GK (pipeline: Torwart, Sweeper Keeper, Ball-Playing GK) ────
  "Torwart":            { models: ["GK", "Cover", "Commander", "Target"],                labels: [] },
  "Sweeper Keeper":     { models: ["GK", "Passer", "Controller", "Cover"],               labels: [] },
  "Ball-Playing GK":    { models: ["GK", "Passer", "Controller", "Cover"],               labels: [] },

  // ── CD (pipeline: Libero, Vorstopper, Sweeper, Zagueiro) ───────
  "Libero":             { models: ["Cover", "Passer", "Controller", "Dribbler"],         labels: [] },
  "Vorstopper":         { models: ["Destroyer", "Cover", "Powerhouse", "Commander"],     labels: [] },
  "Sweeper":            { models: ["Cover", "Controller", "Commander", "Passer"],        labels: [] },
  "Zagueiro":           { models: ["Destroyer", "Commander", "Cover", "Passer"],         labels: [] },

  // ── WD (pipeline: Lateral, Invertido, Carrilero) ───────────────
  "Lateral":            { models: ["Engine", "Dribbler", "Passer", "Sprinter"],          labels: [] },
  "Invertido":          { models: ["Controller", "Passer", "Cover", "Dribbler"],         labels: [] },
  "Carrilero":          { models: ["Engine", "Sprinter", "Cover", "Destroyer"],          labels: [] },

  // ── DM (pipeline: Sentinelle, Regista, Volante) ────────────────
  "Sentinelle":         { models: ["Cover", "Destroyer", "Controller", "Commander"],     labels: [] },
  "Regista":            { models: ["Controller", "Passer", "Creator", "Cover"],          labels: [] },
  "Volante":            { models: ["Destroyer", "Engine", "Cover", "Dribbler"],          labels: [] },

  // ── CM (pipeline: Metodista, Tuttocampista, Mezzala, Relayeur) ─
  "Metodista":          { models: ["Controller", "Passer", "Creator", "Cover"],          labels: [] },
  "Tuttocampista":      { models: ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"], labels: [] },
  "Mezzala":            { models: ["Passer", "Creator", "Dribbler", "Engine"],           labels: [] },
  "Relayeur":           { models: ["Engine", "Destroyer", "Passer", "Cover"],            labels: [] },

  // ── WM (pipeline: Fantasista, Winger, Raumdeuter) ──────────────
  "Fantasista":         { models: ["Creator", "Passer", "Dribbler", "Controller"],       labels: [] },
  "Winger":             { models: ["Sprinter", "Passer", "Dribbler", "Engine"],          labels: [] },
  "Raumdeuter":         { models: ["Dribbler", "Striker", "Engine", "Cover"],            labels: [] },

  // ── AM (pipeline: Trequartista, Enganche, Seconda Punta) ───────
  "Trequartista":       { models: ["Creator", "Dribbler", "Controller", "Striker"],      labels: [] },
  "Enganche":           { models: ["Controller", "Creator", "Passer", "Dribbler"],       labels: [] },
  "Seconda Punta":      { models: ["Dribbler", "Striker", "Sprinter", "Creator"],        labels: [] },

  // ── WF (pipeline: Inside Forward, Extremo, Inverted Winger) ────
  "Inside Forward":     { models: ["Dribbler", "Sprinter", "Striker", "Creator"],        labels: [] },
  "Extremo":            { models: ["Sprinter", "Striker", "Dribbler", "Creator"],        labels: [] },
  "Inverted Winger":    { models: ["Creator", "Dribbler", "Passer", "Sprinter"],         labels: [] },

  // ── CF (pipeline: Prima Punta, Poacher, Complete Forward, Falso Nove, Seconda Punta) ─
  "Prima Punta":        { models: ["Target", "Powerhouse", "Striker", "Commander"],      labels: [] },
  "Poacher":            { models: ["Striker", "Sprinter", "Dribbler", "Target"],         labels: [] },
  "Complete Forward":   { models: ["Striker", "Creator", "Target", "Engine"],            labels: [] },
  "Falso Nove":         { models: ["Creator", "Controller", "Dribbler", "Striker"],      labels: [] },
};

// Auto-fill labels from model short codes
for (const config of Object.values(ROLE_RADAR_AXES)) {
  config.labels = config.models.map((m) => MODEL_LABEL[m] ?? m.slice(0, 3).toUpperCase());
}

/** Position-specific fallback axes for players without a best_role */
export const POSITION_AXES: Record<string, RoleRadarConfig> = {
  GK: { models: ["GK", "Commander", "Cover", "Passer"],                   labels: [] },
  CD: { models: ["Destroyer", "Cover", "Commander", "Passer"],            labels: [] },
  WD: { models: ["Engine", "Cover", "Passer", "Sprinter"],               labels: [] },
  DM: { models: ["Cover", "Destroyer", "Controller", "Engine"],           labels: [] },
  CM: { models: ["Controller", "Passer", "Cover", "Engine"],              labels: [] },
  WM: { models: ["Dribbler", "Sprinter", "Passer", "Engine"],            labels: [] },
  AM: { models: ["Creator", "Dribbler", "Controller", "Striker"],         labels: [] },
  WF: { models: ["Dribbler", "Sprinter", "Striker", "Creator"],           labels: [] },
  CF: { models: ["Striker", "Target", "Dribbler", "Sprinter"],            labels: [] },
};

// Auto-fill position axis labels
for (const config of Object.values(POSITION_AXES)) {
  config.labels = config.models.map((m) => MODEL_LABEL[m] ?? m.slice(0, 3).toUpperCase());
}

/** Get radar config for a role. Falls back to position-specific config. */
export function getRoleRadarConfig(bestRole: string | null, position: string | null): RoleRadarConfig {
  if (bestRole && ROLE_RADAR_AXES[bestRole]) {
    return ROLE_RADAR_AXES[bestRole];
  }
  if (position && POSITION_AXES[position]) {
    return POSITION_AXES[position];
  }
  // Ultimate fallback: generic midfielder
  return POSITION_AXES["CM"];
}
