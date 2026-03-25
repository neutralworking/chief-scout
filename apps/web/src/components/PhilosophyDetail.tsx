"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RadarChart } from "@/components/RadarChart";
import {
  type TacticalPhilosophy,
  type PhilosophyFormation,
  type PhilosophyRole,
  getRadarValues,
  getRadarLabels,
  getPhilosophyColor,
  scorePlayerForPhilosophy,
  affinityStyle,
  importanceStyle,
} from "@/lib/tactical-philosophies";
import { POSITION_COLORS } from "@/lib/types";

interface Club {
  id: number;
  clubname: string;
  league_name: string | null;
  short_name: string | null;
}

interface FormationInfo {
  id: number;
  name: string;
}

interface RoleInfo {
  id: number;
  name: string;
  position: string;
  description: string | null;
}

interface Player {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  level: number | null;
  archetype: string | null;
  personality_type: string | null;
}

interface Props {
  philosophy: TacticalPhilosophy;
  clubs: Club[];
  formationLinks: PhilosophyFormation[];
  roleLinks: PhilosophyRole[];
  players: Player[];
  formations: FormationInfo[];
  roles: RoleInfo[];
}

export function PhilosophyDetail({
  philosophy,
  clubs,
  formationLinks,
  roleLinks,
  players,
  formations,
  roles,
}: Props) {
  const [showFullStory, setShowFullStory] = useState(false);
  const color = getPhilosophyColor(philosophy.slug);
  const radarValues = getRadarValues(philosophy);
  const radarLabels = getRadarLabels();

  const formationMap = new Map(formations.map((f) => [f.id, f]));
  const roleMap = new Map(roles.map((r) => [r.id, r]));

  const affinityOrder: Record<string, number> = { primary: 0, secondary: 1, compatible: 2 };
  const importanceOrder: Record<string, number> = { essential: 0, preferred: 1, compatible: 2 };
  const sortedFormations = [...formationLinks].sort((a, b) => (affinityOrder[a.affinity] ?? 3) - (affinityOrder[b.affinity] ?? 3));
  const sortedRoles = [...roleLinks].sort((a, b) => (importanceOrder[a.importance] ?? 3) - (importanceOrder[b.importance] ?? 3));

  // Score and rank players
  const scoredPlayers = players
    .map((p) => ({ ...p, score: scorePlayerForPhilosophy(p, philosophy) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // Group formations by affinity
  const formationsByAffinity = {
    primary: sortedFormations.filter((f) => f.affinity === "primary"),
    secondary: sortedFormations.filter((f) => f.affinity === "secondary"),
    compatible: sortedFormations.filter((f) => f.affinity === "compatible"),
  };

  // Group roles by importance
  const rolesByImportance = {
    essential: sortedRoles.filter((r) => r.importance === "essential"),
    preferred: sortedRoles.filter((r) => r.importance === "preferred"),
    compatible: sortedRoles.filter((r) => r.importance === "compatible"),
  };

  const storyText = philosophy.origin_story ?? "";
  const isLongStory = storyText.length > 300;
  const displayStory = isLongStory && !showFullStory ? storyText.slice(0, 300) + "…" : storyText;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="shrink-0 mx-auto sm:mx-0">
            <RadarChart
              labels={radarLabels}
              tooltips={["Possession orientation", "Pressing intensity", "Directness", "Defensive depth", "Width emphasis", "Fluidity"]}
              layers={[{ values: radarValues, color, fillOpacity: 0.25 }]}
              size={180}
            />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{philosophy.name}</h1>
              {philosophy.era && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {philosophy.era}
                </span>
              )}
            </div>
            {philosophy.tagline && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-1 italic leading-relaxed">
                {philosophy.tagline}
              </p>
            )}

            {/* Prophets & Disciples */}
            {philosophy.defining_managers && philosophy.defining_managers.length > 0 && (
              <div className="mt-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Prophets & Disciples</span>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {philosophy.defining_managers.map((m, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-[11px] text-[var(--text-primary)] font-medium">{m}</span>
                      {i < (philosophy.defining_managers?.length ?? 0) - 1 && (
                        <span className="text-[var(--text-muted)]">&rarr;</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Origin Story ── */}
      {storyText && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Origin</h2>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
            {displayStory}
          </p>
          {isLongStory && (
            <button
              onClick={() => setShowFullStory(!showFullStory)}
              className="text-[11px] mt-1 text-[var(--color-accent-tactical)] hover:underline"
            >
              {showFullStory ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {/* ── Key Principles ── */}
      {philosophy.key_principles && philosophy.key_principles.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Key Principles</h2>
          <div className="flex flex-wrap gap-1.5">
            {philosophy.key_principles.map((p, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-elevated)]/50"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Clubs ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Clubs ({clubs.length})
        </h2>
        {clubs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/60 transition-colors"
              >
                <span className="text-[12px] text-[var(--text-primary)] font-medium truncate">
                  {club.clubname}
                </span>
                {club.league_name && (
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{club.league_name}</span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)]">No clubs assigned yet</p>
        )}
      </div>

      {/* ── Best-Fit Players ── */}
      {scoredPlayers.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Best-Fit Players</h2>
          <div className="space-y-1">
            {scoredPlayers.map((p) => {
              const posColor = POSITION_COLORS[p.position ?? ""] ?? "bg-zinc-700/60";
              return (
                <Link
                  key={p.person_id}
                  href={`/players/${p.person_id}`}
                  className="flex items-center gap-2 text-[12px] p-1.5 rounded hover:bg-[var(--bg-elevated)]/30 transition-colors"
                >
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white shrink-0`}>
                    {p.position ?? "?"}
                  </span>
                  <span className="text-[var(--text-primary)] font-medium truncate flex-1">{p.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">{p.club}</span>
                  {p.archetype && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] hidden sm:inline">
                      {p.archetype}
                    </span>
                  )}
                  <span
                    className={`font-mono font-bold text-[11px] shrink-0 ${
                      p.score >= 70 ? "text-green-400" : p.score >= 50 ? "text-amber-400" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {p.score}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Preferred Formations ── */}
      {sortedFormations.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Preferred Formations ({sortedFormations.length})
          </h2>
          <div className="space-y-2">
            {(["primary", "secondary", "compatible"] as const).map((level) => {
              const links = formationsByAffinity[level];
              if (links.length === 0) return null;
              return (
                <div key={level}>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">{level}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {links.map((link) => {
                      const f = formationMap.get(link.formation_id);
                      if (!f) return null;
                      return (
                        <span
                          key={link.formation_id}
                          className={`text-[11px] px-2 py-1 rounded border ${affinityStyle(link.affinity)}`}
                        >
                          {f.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Key Roles ── */}
      {sortedRoles.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Key Roles ({sortedRoles.length})
          </h2>
          <div className="space-y-3">
            {(["essential", "preferred", "compatible"] as const).map((level) => {
              const links = rolesByImportance[level];
              if (links.length === 0) return null;
              return (
                <div key={level}>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">{level}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                    {links.map((link) => {
                      const r = roleMap.get(link.role_id);
                      if (!r) return null;
                      const posColor = POSITION_COLORS[r.position] ?? "bg-zinc-700/60";
                      return (
                        <div key={link.role_id} className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-elevated)]/30">
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${posColor} text-white shrink-0`}>
                            {r.position}
                          </span>
                          <span className="text-[11px] text-[var(--text-primary)] font-medium flex-1 truncate">{r.name}</span>
                          <span className={`text-[8px] px-1 py-0.5 rounded ${importanceStyle(link.importance)}`}>
                            {link.importance}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Show rationale for essential roles */}
                  {level === "essential" && links.some((l) => l.rationale) && (
                    <div className="mt-1.5 space-y-0.5">
                      {links.filter((l) => l.rationale).map((link) => {
                        const r = roleMap.get(link.role_id);
                        return r ? (
                          <p key={link.role_id} className="text-[10px] text-[var(--text-muted)]">
                            <span className="text-[var(--text-secondary)] font-medium">{r.name}</span> — {link.rationale}
                          </p>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fit Profile ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Fit Profile</h2>

        {/* Archetype requirements */}
        {philosophy.archetype_requirements && Object.keys(philosophy.archetype_requirements).length > 0 && (
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Archetype Affinity</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(philosophy.archetype_requirements)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([archetype, threshold]) => (
                  <span
                    key={archetype}
                    className="text-[10px] px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    {archetype} <span className="text-[var(--text-muted)] font-mono">{threshold as number}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Personality preferences */}
        {philosophy.personality_preferences && Object.keys(philosophy.personality_preferences).length > 0 && (
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Personality Preferences</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(philosophy.personality_preferences)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([pole, importance]) => {
                  const poleNames: Record<string, string> = {
                    A: "Anchor", I: "Improviser", X: "Explosive", N: "Narrator",
                    S: "Spark", L: "Lifer", C: "Catalyst", P: "Professor",
                  };
                  return (
                    <span
                      key={pole}
                      className="text-[10px] px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    >
                      {poleNames[pole] ?? pole} ({pole}) <span className="text-[var(--text-muted)] font-mono">{(importance as number).toFixed(1)}</span>
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* Preferred & concern tags */}
        <div className="flex flex-wrap gap-3">
          {philosophy.preferred_tags && philosophy.preferred_tags.length > 0 && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Preferred Tags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {philosophy.preferred_tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {philosophy.concern_tags && philosophy.concern_tags.length > 0 && (
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Concern Tags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {philosophy.concern_tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Key attributes */}
        {philosophy.key_attributes && philosophy.key_attributes.length > 0 && (
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Key Attributes</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {philosophy.key_attributes.map((attr, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
