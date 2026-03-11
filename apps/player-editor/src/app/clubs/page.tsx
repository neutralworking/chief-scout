import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";

interface ClubRow {
  id: number;
  clubname: string;
  Nation: string | null;
  player_count: number;
}

export default async function ClubsPage() {
  if (!supabaseServer) {
    return <div><h1 className="text-2xl font-bold mb-4">Clubs</h1><p className="text-sm text-[var(--text-secondary)]">Supabase not configured.</p></div>;
  }

  // Get clubs with player counts via a raw approach: fetch all people with club_id, group
  const { data: people } = await supabaseServer
    .from("people")
    .select("club_id")
    .not("club_id", "is", null);

  const clubCounts = new Map<number, number>();
  for (const p of people ?? []) {
    clubCounts.set(p.club_id, (clubCounts.get(p.club_id) ?? 0) + 1);
  }

  // Get club details for clubs that have players
  const clubIds = [...clubCounts.keys()].slice(0, 2000);
  const { data: clubs } = await supabaseServer
    .from("clubs")
    .select("id, clubname, Nation")
    .in("id", clubIds)
    .order("clubname");

  const clubRows: ClubRow[] = (clubs ?? []).map((c) => ({
    ...c,
    player_count: clubCounts.get(c.id) ?? 0,
  })).sort((a, b) => b.player_count - a.player_count);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Clubs</h1>
      <p className="text-xs text-[var(--text-secondary)] mb-6">{clubRows.length} clubs with players in database</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {clubRows.map((club) => (
          <Link
            key={club.id}
            href={`/clubs/${club.id}`}
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4 hover:border-[var(--accent-personality)]/40 transition-colors group"
          >
            <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-white truncate">
              {club.clubname}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {club.Nation && (
                <span className="text-xs text-[var(--text-secondary)]">{club.Nation}</span>
              )}
              <span className="text-xs font-mono text-[var(--text-muted)]">{club.player_count} players</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
