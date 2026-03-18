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

/** Role name → radar axes (4-5 models most relevant to that role) */
export const ROLE_RADAR_AXES: Record<string, RoleRadarConfig> = {
  // GK
  "Shot Stopper":       { models: ["GK", "Cover", "Commander", "Target"],                labels: [] },
  "Sweeper Keeper":     { models: ["GK", "Passer", "Controller", "Cover"],               labels: [] },
  "Sweeper":            { models: ["GK", "Passer", "Controller", "Cover"],               labels: [] },

  // CD
  "Stopper":            { models: ["Destroyer", "Cover", "Powerhouse", "Target", "Commander"], labels: [] },
  "Ball-Playing CB":    { models: ["Cover", "Passer", "Controller", "Destroyer"],        labels: [] },
  "Enforcer":           { models: ["Destroyer", "Commander", "Powerhouse", "Cover"],     labels: [] },
  "Ball-Carrier":       { models: ["Cover", "Dribbler", "Passer", "Controller"],         labels: [] },
  "Ball-Carrying CB":   { models: ["Cover", "Dribbler", "Passer", "Controller"],         labels: [] },

  // WD
  "Overlapping FB":     { models: ["Engine", "Dribbler", "Sprinter", "Passer"],          labels: [] },
  "Overlapping Full-Back": { models: ["Engine", "Dribbler", "Sprinter", "Passer"],       labels: [] },
  "Inverted FB":        { models: ["Cover", "Passer", "Controller", "Engine"],           labels: [] },
  "Inverted Full-Back": { models: ["Cover", "Passer", "Controller", "Engine"],           labels: [] },
  "Wing-Back":          { models: ["Engine", "Sprinter", "Dribbler", "Cover"],           labels: [] },
  "Lateral":            { models: ["Engine", "Sprinter", "Dribbler", "Cover"],           labels: [] },

  // DM
  "Anchor":             { models: ["Cover", "Destroyer", "Controller", "Commander"],     labels: [] },
  "Sentinelle":         { models: ["Cover", "Destroyer", "Controller", "Commander"],     labels: [] },
  "Regista":            { models: ["Controller", "Passer", "Creator", "Cover"],          labels: [] },
  "Ball Winner":        { models: ["Destroyer", "Engine", "Powerhouse", "Cover"],        labels: [] },
  "Ball-Winner":        { models: ["Destroyer", "Engine", "Powerhouse", "Cover"],        labels: [] },

  // CM
  "Deep Playmaker":     { models: ["Controller", "Passer", "Creator", "Cover"],          labels: [] },
  "Metodista":          { models: ["Controller", "Passer", "Creator", "Cover"],          labels: [] },
  "Box-to-Box":         { models: ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"], labels: [] },
  "Tuttocampista":      { models: ["Engine", "Cover", "Destroyer", "Powerhouse", "Sprinter"], labels: [] },
  "Mezzala":            { models: ["Passer", "Creator", "Dribbler", "Engine"],           labels: [] },

  // WM
  "Wide Playmaker":     { models: ["Dribbler", "Passer", "Creator", "Controller"],      labels: [] },
  "Traditional Winger": { models: ["Engine", "Sprinter", "Dribbler", "Passer"],         labels: [] },
  "Direct Winger":      { models: ["Sprinter", "Dribbler", "Engine", "Passer"],         labels: [] },
  "Wide Provider":      { models: ["Passer", "Engine", "Controller", "Dribbler"],       labels: [] },

  // AM
  "Trequartista":       { models: ["Creator", "Dribbler", "Controller", "Striker"],      labels: [] },
  "Advanced Playmaker": { models: ["Controller", "Creator", "Passer", "Dribbler"],      labels: [] },
  "Shadow Striker":     { models: ["Dribbler", "Striker", "Sprinter", "Engine"],         labels: [] },
  "Enganche":           { models: ["Creator", "Dribbler", "Controller", "Passer"],       labels: [] },

  // WF
  "Inside Forward":     { models: ["Dribbler", "Sprinter", "Striker", "Creator"],        labels: [] },
  "Extremo":            { models: ["Sprinter", "Dribbler", "Striker", "Creator"],        labels: [] },
  "Wide Forward":       { models: ["Striker", "Dribbler", "Sprinter", "Passer"],         labels: [] },
  "Inverted Winger":    { models: ["Creator", "Dribbler", "Passer", "Sprinter"],         labels: [] },

  // CF
  "Target Man":         { models: ["Striker", "Target", "Powerhouse", "Commander"],      labels: [] },
  "Complete Forward":   { models: ["Target", "Powerhouse", "Striker", "Engine"],         labels: [] },
  "Poacher":            { models: ["Striker", "Sprinter", "Dribbler", "Target"],         labels: [] },
  "False 9":            { models: ["Dribbler", "Striker", "Creator", "Controller"],      labels: [] },
  "Deep-Lying Forward": { models: ["Creator", "Striker", "Passer", "Engine"],            labels: [] },
  "Pressing Forward":   { models: ["Engine", "Destroyer", "Striker", "Sprinter"],        labels: [] },
  "Raumdeuter":         { models: ["Cover", "Striker", "Engine", "Sprinter"],            labels: [] },
  "Seconda Punta":      { models: ["Striker", "Dribbler", "Sprinter", "Creator"],        labels: [] },
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
