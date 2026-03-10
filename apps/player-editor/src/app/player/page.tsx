"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { computeAge, PURSUIT_COLORS, POSITION_COLORS } from "@/lib/types";

interface IntelligenceCard {
  person_id: number;
  name: string;
  dob: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  active: boolean;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  model_id: string | null;
  profile_tier: number | null;
  personality_type: string | null;
  pursuit_status: string | null;
  market_value_tier: string | null;
  true_mvt: string | null;
  market_premium: string | null;
  scarcity_score: number | null;
  scouting_notes: string | null;
  squad_role: string | null;
  blueprint: string | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
}

function DimensionBar({ left, right, value }: { left: string; right: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold w-3 text-[var(--accent-personality)]">{left}</span>
      <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-personality)] opacity-60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold w-3 text-[var(--text-muted)]">{right}</span>
      <span className="text-xs font-mono w-6 text-right text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function PlayerDetail() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [player, setPlayer] = useState<IntelligenceCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase || !id) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("player_intelligence_card")
        .select("*")
        .eq("person_id", parseInt(id, 10))
        .single();

      if (!error && data) {
        setPlayer(data as IntelligenceCard);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="text-[var(--text-muted)] text-sm">Loading...</div>;
  }

  if (!player) {
    return (
      <div className="text-center mt-12">
        <p className="text-[var(--text-muted)]">Player not found.</p>
        <Link href="/players" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-4 inline-block">
          &larr; Back to Players
        </Link>
      </div>
    );
  }

  const age = computeAge(player.dob);
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";
  const pursuitColor = PURSUIT_COLORS[player.pursuit_status ?? ""] ?? "";

  return (
    <div className="max-w-4xl">
      <Link
        href="/players"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6 inline-block"
      >
        &larr; Back to Players
      </Link>

      {/* Zone A: Identity Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-lg font-bold text-[var(--text-muted)]">
              {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
                {player.club && <span>{player.club}</span>}
                {player.nation && <><span className="text-[var(--text-muted)]">·</span><span>{player.nation}</span></>}
                {age !== null && <><span className="text-[var(--text-muted)]">·</span><span>{age} years</span></>}
                {player.height_cm && <><span className="text-[var(--text-muted)]">·</span><span>{player.height_cm}cm</span></>}
                {player.preferred_foot && <><span className="text-[var(--text-muted)]">·</span><span>{player.preferred_foot} foot</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${posColor} text-white`}>
              {player.position ?? "–"}
            </span>
            {player.pursuit_status && (
              <span className={`text-[10px] font-semibold tracking-wide px-2 py-1 rounded ${pursuitColor}`}>
                {player.pursuit_status}
              </span>
            )}
            {player.profile_tier === 1 && (
              <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--accent-personality)] border border-[var(--accent-personality)]/30 px-2 py-1 rounded">
                Tier 1
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 max-w-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Level</span>
            <div className="text-2xl font-mono font-bold">{player.level ?? "–"}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Peak</span>
            <div className="text-2xl font-mono font-bold">{player.peak ?? "–"}</div>
          </div>
        </div>
      </div>

      {/* Zone B: Personality + Archetype */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Personality — WHO</h3>
          {player.personality_type ? (
            <div>
              <div className="text-center mb-4">
                <span className="inline-block font-mono text-3xl font-extrabold tracking-[0.15em] text-[var(--accent-personality)] border border-[var(--accent-personality)]/20 px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(232,197,71,0.1)]">
                  {player.personality_type}
                </span>
              </div>
              <div className="space-y-2 mt-4">
                <DimensionBar left="E" right="I" value={player.ei} />
                <DimensionBar left="S" right="N" value={player.sn} />
                <DimensionBar left="T" right="F" value={player.tf} />
                <DimensionBar left="J" right="P" value={player.jp} />
              </div>
              {(player.competitiveness || player.coachability) && (
                <div className="mt-4 flex gap-6 text-xs text-[var(--text-secondary)]">
                  {player.competitiveness != null && (
                    <div><span className="text-[var(--text-muted)]">Competitiveness: </span><span className="font-mono font-bold">{player.competitiveness}</span></div>
                  )}
                  {player.coachability != null && (
                    <div><span className="text-[var(--text-muted)]">Coachability: </span><span className="font-mono font-bold">{player.coachability}</span></div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Personality not yet assessed.</p>
          )}
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Archetype — HOW</h3>
          {player.archetype ? (
            <div>
              <div className="text-xl font-semibold text-[var(--accent-tactical)] mb-1">{player.archetype}</div>
              {player.model_id && <p className="text-xs text-[var(--text-secondary)] mb-4">Model: {player.model_id}</p>}
              {player.blueprint && (
                <div className="mt-4">
                  <h4 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-2">Blueprint</h4>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{player.blueprint}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Archetype not yet assessed.</p>
          )}
        </div>
      </div>

      {/* Zone D: Market Position */}
      {(player.market_value_tier || player.true_mvt) && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6 mb-4">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Market Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {player.market_value_tier && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">MVT</span><span className="font-mono font-bold">{player.market_value_tier}</span></div>
            )}
            {player.true_mvt && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">True MVT</span><span className="font-mono font-bold">{player.true_mvt}</span></div>
            )}
            {player.market_premium && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">Premium</span><span className="font-mono font-bold">{player.market_premium}</span></div>
            )}
            {player.scarcity_score != null && (
              <div><span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block">Scarcity</span><span className="font-mono font-bold">{player.scarcity_score}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Zone F: Scouting Notes */}
      {player.scouting_notes && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">Scouting Notes</h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{player.scouting_notes}</p>
        </div>
      )}
    </div>
  );
}

export default function PlayerDetailPage() {
  return (
    <Suspense fallback={<div className="text-[var(--text-muted)] text-sm">Loading...</div>}>
      <PlayerDetail />
    </Suspense>
  );
}
