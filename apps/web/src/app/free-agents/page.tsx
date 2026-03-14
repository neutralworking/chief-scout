import { supabaseServer } from "@/lib/supabase-server";
import { PlayerCard as PlayerCardComponent } from "@/components/PlayerCard";
import { PlayerCard as PlayerCardType, POSITIONS, computeAge } from "@/lib/types";
import Link from "next/link";

export const metadata = {
  title: "Free Agents & Expiring Contracts — Chief Scout",
  description:
    "Every available player and expiring contract. Full scouting intelligence — position, archetype, personality, valuation.",
};

interface FreeAgentPlayer extends PlayerCardType {
  contract_expiry_date: string | null;
}

// Position display order: GK → CF
const POSITION_ORDER = ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"];

const POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeepers",
  CD: "Centre-Backs",
  WD: "Full-Backs",
  DM: "Defensive Midfielders",
  CM: "Central Midfielders",
  WM: "Wide Midfielders",
  AM: "Attacking Midfielders",
  WF: "Wingers",
  CF: "Centre-Forwards",
};

async function getFreeAgents(): Promise<FreeAgentPlayer[]> {
  if (!supabaseServer) return [];

  const SELECT =
    "person_id, name, dob, height_cm, preferred_foot, active, nation, club, position, level, archetype, model_id, profile_tier, personality_type, pursuit_status, market_value_tier, true_mvt, market_value_eur, director_valuation_meur";

  // Get people with expiring contracts
  const { data: expiring } = await supabaseServer
    .from("people")
    .select("id, contract_expiry_date")
    .not("contract_expiry_date", "is", null)
    .lte("contract_expiry_date", "2026-09-01");

  // Get people with free-agent-like contract tags
  const { data: freeStatus } = await supabaseServer
    .from("player_status")
    .select("person_id, contract_tag")
    .or(
      "contract_tag.ilike.%free%,contract_tag.ilike.%expir%,contract_tag.ilike.%end of contract%"
    );

  const playerIds = new Set<number>();
  const contractDates: Record<number, string> = {};

  for (const row of expiring ?? []) {
    playerIds.add(row.id);
    contractDates[row.id] = row.contract_expiry_date;
  }
  for (const row of freeStatus ?? []) {
    playerIds.add(row.person_id);
  }

  if (playerIds.size === 0) return [];

  const { data } = await supabaseServer
    .from("player_intelligence_card")
    .select(SELECT)
    .in("person_id", Array.from(playerIds))
    .order("level", { ascending: false, nullsFirst: false });

  return (data ?? []).map((p: unknown) => ({
    ...(p as unknown as PlayerCardType),
    contract_expiry_date: contractDates[(p as Record<string, unknown>).person_id as number] ?? null,
  }));
}

export default async function FreeAgentsPage() {
  const players = await getFreeAgents();

  // Group by position
  const byPosition: Record<string, FreeAgentPlayer[]> = {};
  for (const p of players) {
    const pos = p.position ?? "Unknown";
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(p);
  }

  const totalCount = players.length;
  const withLevel = players.filter((p) => p.level != null);
  const avgLevel =
    withLevel.length > 0
      ? Math.round(
          withLevel.reduce((sum, p) => sum + (p.level ?? 0), 0) / withLevel.length
        )
      : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-2 sm:mb-4 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Free Agents &amp; Expiring Contracts
          </h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--accent-tactical)]/20 text-[var(--accent-tactical)]">
            {totalCount} available
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl">
          Every player with an expiring contract or available on a free. Full
          scouting intelligence — position, archetype, personality, valuation.
          Better than Transfermarkt&apos;s list, with deeper data.
        </p>
        {avgLevel && (
          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span>
              Avg. level:{" "}
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {avgLevel}
              </span>
            </span>
            <span>
              Positions covered:{" "}
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {Object.keys(byPosition).length}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Gaffer cross-sell */}
      <Link
        href="/choices"
        className="block mb-6 sm:mb-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 hover:border-[var(--accent-personality)] transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-personality)]">
              Gaffer
            </span>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Which free agent would you sign? Play Gaffer to test your transfer
              instincts.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--accent-personality)] group-hover:translate-x-1 transition-transform">
            Play &rarr;
          </span>
        </div>
      </Link>

      {/* Position groups */}
      {totalCount === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-[var(--text-muted)]">
            No free agents found. Contract data may not be populated yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {POSITION_ORDER.filter((pos) => byPosition[pos]?.length).map(
            (pos) => (
              <section key={pos}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {POSITION_LABELS[pos] ?? pos}
                  </h2>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    ({byPosition[pos].length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byPosition[pos].map((player) => (
                    <div key={player.person_id} className="relative">
                      <PlayerCardComponent player={player} />
                      {player.contract_expiry_date && (
                        <div className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">
                          Exp:{" "}
                          {new Date(
                            player.contract_expiry_date
                          ).toLocaleDateString("en-GB", {
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
          )}

          {/* Unknown positions */}
          {byPosition["Unknown"]?.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                Position TBD
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byPosition["Unknown"].map((player) => (
                  <PlayerCardComponent
                    key={player.person_id}
                    player={player}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
