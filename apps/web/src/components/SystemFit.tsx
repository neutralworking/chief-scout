"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  type TacticalPhilosophy,
  scorePlayerForPhilosophy,
  getPhilosophyColor,
  getRadarValues,
  getRadarLabels,
} from "@/lib/tactical-philosophies";
import { RadarChart } from "@/components/RadarChart";
import { createClient } from "@supabase/supabase-js";

interface Props {
  clubId: number | null;
  archetype: string | null;
  personalityType: string | null;
  level: number | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function SystemFit({ clubId, archetype, personalityType, level }: Props) {
  const [philosophies, setPhilosophies] = useState<TacticalPhilosophy[]>([]);
  const [clubPhilosophy, setClubPhilosophy] = useState<TacticalPhilosophy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey);

    async function load() {
      // Fetch all philosophies (only 10 rows)
      const { data: allPhilosophies } = await sb
        .from("tactical_philosophies")
        .select("*")
        .order("name");

      if (!allPhilosophies || allPhilosophies.length === 0) {
        setLoading(false);
        return;
      }

      setPhilosophies(allPhilosophies as TacticalPhilosophy[]);

      // If player has a club, find its philosophy
      if (clubId) {
        const { data: club } = await sb
          .from("clubs")
          .select("philosophy_id")
          .eq("id", clubId)
          .maybeSingle();

        if (club?.philosophy_id) {
          const match = allPhilosophies.find((p: { id: number }) => p.id === club.philosophy_id);
          if (match) setClubPhilosophy(match as TacticalPhilosophy);
        }
      }

      setLoading(false);
    }

    load();
  }, [clubId]);

  if (loading || philosophies.length === 0) return null;

  const player = { archetype, personality_type: personalityType, level };

  // Score against all philosophies, get top 3
  const scored = philosophies
    .map((p) => ({ philosophy: p, score: scorePlayerForPhilosophy(player, p) }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  const clubFit = clubPhilosophy
    ? { philosophy: clubPhilosophy, score: scorePlayerForPhilosophy(player, clubPhilosophy) }
    : null;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">System Fit</h3>

      {/* Club philosophy fit */}
      {clubFit && (
        <div className="mb-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="shrink-0">
              <RadarChart
                labels={getRadarLabels()}
                layers={[{ values: getRadarValues(clubFit.philosophy), color: getPhilosophyColor(clubFit.philosophy.slug), fillOpacity: 0.2 }]}
                size={48}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Club System</span>
              </div>
              <Link
                href={`/tactics/${clubFit.philosophy.slug}`}
                className="text-[12px] font-medium text-[var(--text-primary)] hover:text-white transition-colors"
              >
                {clubFit.philosophy.name}
              </Link>
            </div>
            <span
              className={`font-mono font-bold text-lg shrink-0 ${
                clubFit.score >= 70 ? "text-green-400" : clubFit.score >= 50 ? "text-amber-400" : "text-[var(--text-muted)]"
              }`}
            >
              {clubFit.score}
            </span>
          </div>
        </div>
      )}

      {/* Top 3 best fits */}
      <div className="space-y-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Best Fits</span>
        {top3.map(({ philosophy, score }) => {
          const color = getPhilosophyColor(philosophy.slug);
          const isClub = clubPhilosophy?.id === philosophy.id;
          return (
            <Link
              key={philosophy.id}
              href={`/tactics/${philosophy.slug}`}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--bg-elevated)]/30 transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-[var(--text-primary)] font-medium flex-1 truncate">
                {philosophy.name}
                {isClub && <span className="text-[9px] text-[var(--text-muted)] ml-1">(club)</span>}
              </span>
              <span
                className={`font-mono font-bold text-[11px] shrink-0 ${
                  score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-[var(--text-muted)]"
                }`}
              >
                {score}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
