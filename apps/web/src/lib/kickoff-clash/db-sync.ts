/**
 * Kickoff Clash — DB Sync (fire-and-forget)
 *
 * Writes run state to kc_runs/kc_run_cards/kc_matches alongside localStorage.
 * All calls are non-blocking — game never waits on DB.
 */

import type { RunState, MatchResult } from './run';

const USER_KEY = 'kickoff-clash-user-id';

/** Get or create an anonymous user UUID (same pattern as Gaffer) */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

/** Create a new run in DB, returns run_id */
export async function dbCreateRun(
  formation: string,
  playingStyle: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/kc-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getOrCreateUserId(),
        formation,
        playing_style: playingStyle,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.run_id ?? null;
  } catch {
    return null;
  }
}

/** Update run summary in DB */
export async function dbUpdateRun(
  runId: string,
  state: RunState
): Promise<void> {
  try {
    const statusMap: Record<string, string> = {
      won: 'won',
      lost: 'lost',
      setup: 'active',
      prematch: 'active',
      playing: 'active',
      postmatch: 'active',
      shop: 'active',
    };

    await fetch(`/api/kc-runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cash: state.cash,
        stadium_tier: state.stadiumTier,
        round: state.round,
        wins: state.wins,
        losses: state.losses,
        status: statusMap[state.status] ?? 'active',
        score: state.wins * 1000 + state.cash,
      }),
    });
  } catch {
    // fire-and-forget
  }
}

/** Record a match result in DB */
export async function dbSaveMatch(
  runId: string,
  result: MatchResult
): Promise<void> {
  try {
    await fetch(`/api/kc-runs/${runId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round: result.round,
        opponent_name: result.opponentName,
        player_score: result.yourGoals,
        opponent_score: result.opponentGoals,
        attendance: result.attendance,
        revenue: result.revenue,
        result: result.result,
        synergies_triggered: result.synergiesTriggered,
      }),
    });
  } catch {
    // fire-and-forget
  }
}

/** End a run (won/lost/abandoned) */
export async function dbEndRun(
  runId: string,
  status: 'won' | 'lost' | 'abandoned',
  state: RunState
): Promise<void> {
  try {
    await fetch(`/api/kc-runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        wins: state.wins,
        losses: state.losses,
        cash: state.cash,
        score: state.wins * 1000 + state.cash,
      }),
    });
  } catch {
    // fire-and-forget
  }
}
