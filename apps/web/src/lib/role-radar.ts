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
  // ── GK ──
  "Libero GK":       { models: ["GK", "Passer", "Controller", "Cover"],                labels: [] },
  "Sweeper Keeper":  { models: ["GK", "Cover", "Controller", "Passer"],                labels: [] },
  "Comandante":      { models: ["GK", "Commander", "Cover", "Controller"],              labels: [] },
  "Shotstopper":     { models: ["GK", "Target", "Cover", "Commander"],                  labels: [] },
  // ── CD ──
  "Libero":          { models: ["Passer", "Cover", "Controller", "Dribbler"],           labels: [] },
  "Sweeper":         { models: ["Cover", "Controller", "Commander", "Passer"],          labels: [] },
  "Zagueiro":        { models: ["Commander", "Destroyer", "Cover", "Powerhouse"],       labels: [] },
  "Vorstopper":      { models: ["Powerhouse", "Destroyer", "Cover", "Commander"],       labels: [] },
  // ── WD ──
  "Lateral":         { models: ["Passer", "Dribbler", "Engine", "Sprinter"],            labels: [] },
  "Fluidificante":   { models: ["Engine", "Cover", "Sprinter", "Destroyer"],            labels: [] },
  "Invertido":       { models: ["Controller", "Passer", "Cover", "Dribbler"],           labels: [] },
  "Corredor":        { models: ["Sprinter", "Engine", "Cover", "Dribbler"],             labels: [] },
  // ── DM ──
  "Regista":         { models: ["Passer", "Controller", "Creator", "Cover"],            labels: [] },
  "Sentinelle":      { models: ["Cover", "Destroyer", "Controller", "Commander"],       labels: [] },
  "Pivote":          { models: ["Controller", "Cover", "Passer", "Commander"],          labels: [] },
  "Volante":         { models: ["Powerhouse", "Destroyer", "Engine", "Cover"],          labels: [] },
  // ── CM ──
  "Mezzala":         { models: ["Passer", "Creator", "Dribbler", "Engine"],             labels: [] },
  "Tuttocampista":   { models: ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"], labels: [] },
  "Metodista":       { models: ["Controller", "Passer", "Creator", "Cover"],            labels: [] },
  "Relayeur":        { models: ["Sprinter", "Engine", "Passer", "Cover"],               labels: [] },
  // ── WM ──
  "Winger":          { models: ["Dribbler", "Passer", "Sprinter", "Engine"],            labels: [] },
  "Tornante":        { models: ["Engine", "Cover", "Sprinter", "Destroyer"],            labels: [] },
  "False Winger":    { models: ["Controller", "Cover", "Passer", "Dribbler"],           labels: [] },
  "Shuttler":        { models: ["Sprinter", "Engine", "Dribbler", "Cover"],             labels: [] },
  // ── AM ──
  "Trequartista":    { models: ["Dribbler", "Creator", "Controller", "Striker"],        labels: [] },
  "Seconda Punta":   { models: ["Engine", "Striker", "Sprinter", "Creator"],            labels: [] },
  "Enganche":        { models: ["Controller", "Creator", "Passer", "Dribbler"],         labels: [] },
  "Boxcrasher":      { models: ["Sprinter", "Striker", "Engine", "Dribbler"],           labels: [] },
  // ── WF ──
  "Inside Forward":  { models: ["Dribbler", "Sprinter", "Striker", "Creator"],          labels: [] },
  "Raumdeuter":      { models: ["Engine", "Striker", "Cover", "Dribbler"],              labels: [] },
  "Inventor":        { models: ["Creator", "Dribbler", "Passer", "Sprinter"],           labels: [] },
  "Extremo":         { models: ["Sprinter", "Striker", "Dribbler", "Creator"],          labels: [] },
  // ── CF ──
  "Poacher":         { models: ["Striker", "Dribbler", "Sprinter", "Target"],           labels: [] },
  "Spearhead":       { models: ["Engine", "Destroyer", "Striker", "Sprinter"],          labels: [] },
  "Falso Nove":      { models: ["Creator", "Controller", "Dribbler", "Striker"],        labels: [] },
  "Prima Punta":     { models: ["Target", "Powerhouse", "Striker", "Commander"],        labels: [] },
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
