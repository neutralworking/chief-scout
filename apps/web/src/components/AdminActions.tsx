"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DataAlert {
  severity: "red" | "amber" | "green";
  label: string;
  count: number;
  detail?: string;
}

interface PipelineJob {
  job: string;
  last_run: string;
  stats: Record<string, unknown> | null;
  runs_24h: number;
}

interface RecentChange {
  id: string;
  person_id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  table_name: string;
  created_at: string;
  player_name: string | null;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminActions() {
  // Admin login state
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("network_admin") === "1";
    return false;
  });
  const [loginError, setLoginError] = useState("");

  // Pipeline actions state
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsResult, setNewsResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState("");
  const [pipelineResult, setPipelineResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cardsRefreshing, setCardsRefreshing] = useState(false);
  const [cardsResult, setCardsResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [valForce, setValForce] = useState(false);
  const [valLimit, setValLimit] = useState("");

  // LLM Profiles state
  const [profilesChecking, setProfilesChecking] = useState(false);
  const [profilesCount, setProfilesCount] = useState<number | null>(null);

  // Scout Notes state
  const [scoutNotesRunning, setScoutNotesRunning] = useState(false);
  const [scoutNotesResult, setScoutNotesResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [flaggedCount, setFlaggedCount] = useState<number | null>(null);

  // Club analysis state
  const [clubAnalysisRunning, setClubAnalysisRunning] = useState(false);
  const [clubAnalysisResult, setClubAnalysisResult] = useState<{
    type: "success" | "error";
    text: string;
    data?: { summary: Record<string, number>; clubs: Record<string, unknown>[] };
  } | null>(null);

  // SQL Runner state
  const [sql, setSql] = useState("");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<{
    type: "success" | "error";
    data?: unknown[];
    rowCount?: number;
    queryType?: string;
    error?: string;
    ms?: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Data quality state
  const [alerts, setAlerts] = useState<DataAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Pipeline health state
  const [pipelineJobs, setPipelineJobs] = useState<PipelineJob[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // Recent changes state
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAdminLogin = () => {
    if (adminUser === "admin" && adminPass === "0.123456789") {
      sessionStorage.setItem("network_admin", "1");
      setAdminLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials");
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("network_admin");
    setAdminLoggedIn(false);
  };

  // ── Data fetching (on login) ──────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch("/api/admin/data-quality");
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch { setAlerts([]); }
    setAlertsLoading(false);
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline-health");
      const data = await res.json();
      setPipelineJobs(data.jobs ?? []);
    } catch { setPipelineJobs([]); }
    setHealthLoading(false);
  }, []);

  const fetchChanges = useCallback(async () => {
    setChangesLoading(true);
    try {
      const res = await fetch("/api/admin/recent-changes");
      const data = await res.json();
      setRecentChanges(data.changes ?? []);
    } catch { setRecentChanges([]); }
    setChangesLoading(false);
  }, []);

  useEffect(() => {
    if (adminLoggedIn) {
      fetchAlerts();
      fetchHealth();
      fetchChanges();
    }
  }, [adminLoggedIn, fetchAlerts, fetchHealth, fetchChanges]);

  // ── Pipeline Actions ──────────────────────────────────────────────────────

  const refreshNews = async () => {
    setNewsRefreshing(true);
    setNewsResult(null);
    try {
      const res = await fetch("/api/cron/news", { headers: { "x-admin": "1" } });
      const data = await res.json();
      if (data.ok) {
        const s = data.stats;
        setNewsResult({ type: "success", text: `Fetched ${s.fetched}, processed ${s.processed}, tagged ${s.tagged} players` });
      } else {
        setNewsResult({ type: "error", text: data.error ?? "Failed" });
      }
    } catch (e) { setNewsResult({ type: "error", text: String(e) }); }
    setNewsRefreshing(false);
  };


  // ── SQL Runner ────────────────────────────────────────────────────────────

  const runSql = async () => {
    if (!sql.trim()) return;
    setSqlRunning(true);
    setSqlResult(null);
    const start = performance.now();
    try {
      const res = await fetch("/api/admin/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sql.trim() }),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - start);
      if (!res.ok) {
        setSqlResult({ type: "error", error: data.error, ms });
      } else {
        setSqlResult({
          type: "success",
          data: Array.isArray(data.data) ? data.data : undefined,
          rowCount: data.rowCount,
          queryType: data.type,
          ms,
        });
      }
    } catch (e) {
      setSqlResult({ type: "error", error: String(e), ms: Math.round(performance.now() - start) });
    }
    setSqlRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSql(); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderTable = (rows: unknown[]) => {
    if (rows.length === 0) return <p className="text-xs text-[var(--text-muted)] italic">No rows returned</p>;
    const cols = Object.keys(rows[0] as Record<string, unknown>);
    const display = rows.slice(0, 200);
    return (
      <div className="overflow-auto max-h-[400px] rounded border border-[var(--border-subtle)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--bg-elevated)]">
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((row, i) => {
              const r = row as Record<string, unknown>;
              return (
                <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                  {cols.map((c) => (
                    <td key={c} className="px-2 py-1 font-mono text-[var(--text-primary)] whitespace-nowrap max-w-[300px] truncate">
                      {r[c] === null ? <span className="text-[var(--text-muted)]">null</span> : String(r[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 200 && <p className="text-[10px] text-[var(--text-muted)] px-2 py-1">Showing 200 of {rows.length} rows</p>}
      </div>
    );
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const severityIcon: Record<string, string> = { red: "●", amber: "●", green: "●" };
  const severityColor: Record<string, string> = {
    red: "text-[var(--color-sentiment-negative)]",
    amber: "text-[var(--color-accent-physical)]",
    green: "text-[var(--color-accent-tactical)]",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Admin Login */}
      <div className="card p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Admin Access
        </h2>
        {adminLoggedIn ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-accent-tactical)]">Logged in</span>
            <span className="text-[10px] text-[var(--text-muted)]">Player editing, pipeline actions & SQL enabled</span>
            <button onClick={handleAdminLogout}
              className="ml-auto px-3 py-1 rounded text-xs font-semibold bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" placeholder="Username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)}
              className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--color-accent-tactical)] transition-colors w-36" />
            <input type="password" placeholder="Password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--color-accent-tactical)] transition-colors w-36" />
            <button onClick={handleAdminLogin}
              className="px-4 py-1.5 rounded bg-[var(--color-accent-tactical)]/20 text-[var(--color-accent-tactical)] text-sm font-semibold hover:bg-[var(--color-accent-tactical)]/30 transition-colors">
              Login
            </button>
            {loginError && <span className="text-xs text-[var(--color-sentiment-negative)]">{loginError}</span>}
          </div>
        )}
      </div>

      {/* ── Data Quality Alerts (always visible when logged in) ──────────── */}
      {adminLoggedIn && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Data Quality
            </h2>
            <button onClick={fetchAlerts} disabled={alertsLoading}
              className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              {alertsLoading ? "Checking..." : "Refresh"}
            </button>
          </div>
          {alerts.length === 0 && !alertsLoading && (
            <p className="text-xs text-[var(--color-accent-tactical)]">All checks passed</p>
          )}
          <div className="space-y-1.5">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-[10px] ${severityColor[alert.severity]}`}>{severityIcon[alert.severity]}</span>
                <span className="text-xs text-[var(--text-secondary)] flex-1">{alert.label}</span>
                <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{alert.count.toLocaleString()}</span>
                {alert.detail && <span className="text-[9px] text-[var(--text-muted)]">{alert.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pipeline Health ──────────────────────────────────────────────── */}
      {adminLoggedIn && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Pipeline Health
            </h2>
            <button onClick={fetchHealth} disabled={healthLoading}
              className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              {healthLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {pipelineJobs.length === 0 && !healthLoading && (
            <p className="text-xs text-[var(--text-muted)]">No cron runs recorded</p>
          )}
          <div className="space-y-2">
            {pipelineJobs.map((job) => {
              const hoursAgo = Math.floor((Date.now() - new Date(job.last_run).getTime()) / 3600000);
              const isStale = hoursAgo > 25;
              return (
                <div key={job.job} className="flex items-center gap-3">
                  <span className={`text-[10px] ${isStale ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-accent-tactical)]"}`}>●</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] w-24">{job.job}</span>
                  <span className={`text-[10px] font-mono ${isStale ? "text-[var(--color-sentiment-negative)]" : "text-[var(--text-secondary)]"}`}>
                    {timeAgo(job.last_run)}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)]">{job.runs_24h} runs/24h</span>
                  {job.stats && typeof job.stats === "object" && (
                    <span className="text-[9px] text-[var(--text-muted)] font-mono truncate max-w-[200px]">
                      {Object.entries(job.stats as Record<string, unknown>)
                        .filter(([k]) => k !== "errors")
                        .map(([k, v]) => `${k}:${v}`)
                        .join(" ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Changes ───────────────────────────────────────────────── */}
      {adminLoggedIn && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Recent Changes
            </h2>
            <button onClick={fetchChanges} disabled={changesLoading}
              className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              {changesLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {recentChanges.length === 0 && !changesLoading && (
            <p className="text-xs text-[var(--text-muted)]">No edits recorded yet</p>
          )}
          {recentChanges.length > 0 && (
            <div className="overflow-auto max-h-[300px] space-y-1">
              {recentChanges.map((change) => (
                <div key={change.id} className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-muted)] font-mono text-[9px] w-12 shrink-0">{timeAgo(change.created_at)}</span>
                  <a href={`/players/${change.person_id}`} className="text-[var(--color-accent-mental)] hover:text-[var(--text-primary)] transition-colors font-medium truncate max-w-[120px]">
                    {change.player_name ?? `#${change.person_id}`}
                  </a>
                  <span className="text-[var(--text-muted)]">{change.table_name}.{change.field}</span>
                  {change.old_value && (
                    <span className="text-[var(--color-sentiment-negative)] font-mono text-[9px] line-through truncate max-w-[80px]">{change.old_value}</span>
                  )}
                  <span className="text-[var(--text-muted)]">&rarr;</span>
                  <span className="text-[var(--color-accent-tactical)] font-mono text-[9px] truncate max-w-[80px]">{change.new_value ?? "null"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pipeline Actions (admin only) ────────────────────────────────── */}
      {adminLoggedIn && (
        <div className="card p-4 ring-1 ring-[var(--color-accent-physical)]/20">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-physical)] mb-3">
            Pipeline Actions
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={refreshNews} disabled={newsRefreshing}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-500 transition-colors cursor-pointer">
              {newsRefreshing ? "Refreshing..." : "Refresh News"}
            </button>
            <button
              onClick={async () => {
                setCardsRefreshing(true);
                setCardsResult(null);
                try {
                  const res = await fetch("/api/cron/refresh-cards", { headers: { "x-admin": "1" } });
                  const data = await res.json();
                  if (data.ok) setCardsResult({ type: "success", text: `Cards refreshed in ${data.ms}ms` });
                  else setCardsResult({ type: "error", text: data.error ?? "Failed" });
                } catch (e) { setCardsResult({ type: "error", text: String(e) }); }
                setCardsRefreshing(false);
              }}
              disabled={cardsRefreshing}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-cyan-500 transition-colors cursor-pointer">
              {cardsRefreshing ? "Refreshing..." : "Refresh Cards"}
            </button>
            <div className="w-px h-6 bg-[var(--border-subtle)]" />
            <button
              onClick={async () => {
                setProfilesChecking(true);
                try {
                  const res = await fetch("/api/admin/sql", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sql: `SELECT COUNT(*) as missing FROM people pe JOIN player_profiles pp ON pp.person_id = pe.id JOIN player_personality pn ON pn.person_id = pe.id JOIN player_market pm ON pm.person_id = pe.id LEFT JOIN player_status ps ON ps.person_id = pe.id WHERE pe.active = true AND pe.name IS NOT NULL AND pe.date_of_birth IS NOT NULL AND pp.position IS NOT NULL AND pp.archetype IS NOT NULL AND pp.blueprint IS NOT NULL AND pp.level IS NOT NULL AND pp.overall IS NOT NULL AND pm.market_value_tier IS NOT NULL AND (ps.scouting_notes IS NULL OR LENGTH(ps.scouting_notes) <= 20)` }),
                  });
                  const data = await res.json();
                  const count = data.data?.[0]?.missing ?? 0;
                  setProfilesCount(Number(count));
                } catch { setProfilesCount(null); }
                setProfilesChecking(false);
              }}
              disabled={profilesChecking}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-500 transition-colors cursor-pointer"
            >
              {profilesChecking ? "Checking..." : "LLM Profiles"}
            </button>
            {profilesCount !== null && (
              <span className="text-xs text-[var(--text-secondary)]">
                <span className="font-mono font-bold text-[var(--color-accent-physical)]">{profilesCount.toLocaleString()}</span> missing bios
                {profilesCount > 0 && (
                  <button
                    onClick={() => { navigator.clipboard.writeText("python 72_gemini_profiles.py --prod-ready"); setPipelineResult({ type: "success", text: "Copied: python 72_gemini_profiles.py --prod-ready" }); }}
                    className="ml-2 text-[9px] text-[var(--text-muted)] hover:text-[var(--color-accent-tactical)] transition-colors underline cursor-pointer"
                  >
                    copy cmd
                  </button>
                )}
              </span>
            )}
          </div>

          {/* Scout Notes */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-[9px] text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">Scout Notes</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={async () => {
                  setScoutNotesRunning(true);
                  setScoutNotesResult(null);
                  try {
                    // Check flagged count first
                    const countRes = await fetch("/api/admin/sql", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sql: "SELECT COUNT(*) as cnt FROM player_status WHERE notes_flagged = true" }),
                    });
                    const countData = await countRes.json();
                    const fc = Number(countData.data?.[0]?.cnt ?? 0);
                    setFlaggedCount(fc);

                    if (fc === 0) {
                      setScoutNotesResult({ type: "success", text: "No flagged notes to regenerate" });
                      setScoutNotesRunning(false);
                      return;
                    }

                    const res = await fetch("/api/admin/scout-notes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-admin": "1" },
                      body: JSON.stringify({ mode: "flagged", limit: 20 }),
                    });
                    const data = await res.json();
                    if (data.ok) setScoutNotesResult({ type: "success", text: data.message });
                    else setScoutNotesResult({ type: "error", text: data.error ?? "Failed" });
                  } catch (e) { setScoutNotesResult({ type: "error", text: String(e) }); }
                  setScoutNotesRunning(false);
                }}
                disabled={scoutNotesRunning}
                className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-purple-500 transition-colors cursor-pointer"
              >
                {scoutNotesRunning ? "Generating..." : "Rewrite Flagged"}
              </button>
              <button
                onClick={async () => {
                  setScoutNotesRunning(true);
                  setScoutNotesResult(null);
                  try {
                    const res = await fetch("/api/admin/scout-notes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-admin": "1" },
                      body: JSON.stringify({ mode: "top", limit: 10 }),
                    });
                    const data = await res.json();
                    if (data.ok) setScoutNotesResult({ type: "success", text: data.message });
                    else setScoutNotesResult({ type: "error", text: data.error ?? "Failed" });
                  } catch (e) { setScoutNotesResult({ type: "error", text: String(e) }); }
                  setScoutNotesRunning(false);
                }}
                disabled={scoutNotesRunning}
                className="px-3 py-1.5 rounded-lg bg-purple-600/70 text-white text-xs font-semibold disabled:opacity-40 hover:bg-purple-500 transition-colors cursor-pointer"
              >
                {scoutNotesRunning ? "Generating..." : "Top 10 Missing"}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText("python 90_scouting_notes.py --top 500 --force"); setScoutNotesResult({ type: "success", text: "Copied: python 90_scouting_notes.py --top 500 --force" }); }}
                className="text-[9px] text-[var(--text-muted)] hover:text-[var(--color-accent-tactical)] transition-colors underline cursor-pointer"
              >
                copy full cmd
              </button>
              {flaggedCount !== null && flaggedCount > 0 && (
                <span className="text-xs text-[var(--text-secondary)]">
                  <span className="font-mono font-bold text-[var(--color-accent-tactical)]">{flaggedCount}</span> flagged
                </span>
              )}
            </div>
            {scoutNotesResult && (
              <p className={`text-xs mt-2 ${scoutNotesResult.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {scoutNotesResult.text}
              </p>
            )}
          </div>

          {/* Compute Pipeline */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-[9px] text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">Compute</p>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: "levels", label: "Levels", color: "bg-orange-600 hover:bg-orange-500" },
                { key: "ratings", label: "Ratings", color: "bg-blue-600 hover:bg-blue-500" },
                { key: "roles", label: "Squad Roles", color: "bg-teal-600 hover:bg-teal-500" },
                { key: "valuations", label: "Valuations", color: "bg-violet-600 hover:bg-violet-500" },
              ] as const).map(({ key, label, color }) => (
                <button key={key}
                  onClick={async () => {
                    setPipelineRunning(key);
                    setPipelineResult(null);
                    try {
                      const params = new URLSearchParams({ steps: key });
                      if (valForce) params.set("force", "true");
                      if (valLimit.trim()) params.set("limit", valLimit.trim());
                      const res = await fetch(`/api/cron/pipeline?${params}`, { headers: { "x-admin": "1" } });
                      const data = await res.json();
                      const step = data.steps?.[0];
                      if (data.ok && step) {
                        const d = step.detail;
                        const parts = Object.entries(d).filter(([k]) => k !== "errors").map(([k, v]) => `${k}: ${v}`);
                        setPipelineResult({ type: "success", text: `${label} — ${parts.join(", ")} (${step.ms}ms)` });
                      } else {
                        setPipelineResult({ type: "error", text: step?.detail?.error ?? data.error ?? "Failed" });
                      }
                    } catch (e) { setPipelineResult({ type: "error", text: String(e) }); }
                    setPipelineRunning("");
                  }}
                  disabled={!!pipelineRunning}
                  className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer ${color}`}>
                  {pipelineRunning === key ? "Running..." : label}
                </button>
              ))}
              <div className="w-px h-6 bg-[var(--border-subtle)]" />
              <button
                onClick={async () => {
                  setPipelineRunning("all");
                  setPipelineResult(null);
                  try {
                    const params = new URLSearchParams();
                    if (valForce) params.set("force", "true");
                    if (valLimit.trim()) params.set("limit", valLimit.trim());
                    const res = await fetch(`/api/cron/pipeline?${params}`, { headers: { "x-admin": "1" } });
                    const data = await res.json();
                    if (data.ok) {
                      const summary = (data.steps as { step: string; ms: number }[]).map((s) => `${s.step} (${s.ms}ms)`).join(" → ");
                      setPipelineResult({ type: "success", text: `Full pipeline: ${summary}` });
                    } else {
                      const failedSteps = (data.steps as { step: string; status: string }[]).filter((s) => s.status === "error").map((s) => s.step);
                      setPipelineResult({ type: "error", text: `Errors in: ${failedSteps.join(", ")}` });
                    }
                  } catch (e) { setPipelineResult({ type: "error", text: String(e) }); }
                  setPipelineRunning("");
                }}
                disabled={!!pipelineRunning}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-teal-600 to-violet-600 text-white text-xs font-semibold disabled:opacity-40 hover:brightness-110 transition-all cursor-pointer">
                {pipelineRunning === "all" ? "Running..." : "Run All"}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <input type="text" placeholder="Limit" value={valLimit} onChange={(e) => setValLimit(e.target.value)}
                className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none w-16" />
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input type="checkbox" checked={valForce} onChange={(e) => setValForce(e.target.checked)} className="accent-violet-500" />
                Force
              </label>
            </div>
          </div>

          {/* Result messages */}
          {newsResult && (
            <p className={`mt-3 text-xs ${newsResult.type === "error" ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-accent-tactical)]"}`}>{newsResult.text}</p>
          )}
          {pipelineResult && (
            <p className={`mt-2 text-xs ${pipelineResult.type === "error" ? "text-[var(--color-sentiment-negative)]" : "text-teal-400"}`}>{pipelineResult.text}</p>
          )}
          {cardsResult && (
            <p className={`mt-2 text-xs ${cardsResult.type === "error" ? "text-[var(--color-sentiment-negative)]" : "text-cyan-400"}`}>{cardsResult.text}</p>
          )}
        </div>
      )}

      {/* ── Club Analysis (admin only) ────────────────────────────────────── */}
      {adminLoggedIn && (
        <div className="card p-4 ring-1 ring-[var(--color-accent-mental)]/20">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-mental)] mb-3">
            Club Analysis
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={async () => {
                setClubAnalysisRunning(true);
                setClubAnalysisResult(null);
                try {
                  const res = await fetch("/api/admin/club-analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    const s = data.summary;
                    setClubAnalysisResult({
                      type: "success",
                      text: `${s.total_clubs} clubs, ${s.total_players} players — ${s.clubs_with_major_gaps} with major gaps, ${s.clubs_missing_levels} missing levels`,
                      data: { summary: s, clubs: data.clubs },
                    });
                  } else {
                    setClubAnalysisResult({ type: "error", text: data.error ?? "Failed" });
                  }
                } catch (e) {
                  setClubAnalysisResult({ type: "error", text: String(e) });
                }
                setClubAnalysisRunning(false);
              }}
              disabled={clubAnalysisRunning}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent-mental)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all cursor-pointer"
            >
              {clubAnalysisRunning ? "Analysing..." : "Run Club Analysis"}
            </button>
          </div>
          {clubAnalysisResult && (
            <div className="mt-3">
              <p className={`text-xs ${clubAnalysisResult.type === "error" ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-accent-mental)]"}`}>
                {clubAnalysisResult.text}
              </p>
              {clubAnalysisResult.data?.clubs && clubAnalysisResult.data.clubs.length > 0 && (
                <div className="mt-3 overflow-auto max-h-[400px] rounded border border-[var(--border-subtle)]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-elevated)]">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Club</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Squad</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Avg Age</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Avg Lvl</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Top</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">Gaps</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">No Lvl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubAnalysisResult.data.clubs.map((club: Record<string, unknown>) => (
                        <tr key={club.club_id as number} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                          <td className="px-2 py-1">
                            <a href={`/clubs/${club.club_id}`} className="text-[var(--color-accent-mental)] hover:text-[var(--text-primary)] transition-colors font-medium">
                              {club.name as string}
                            </a>
                            {club.league ? <span className="ml-1 text-[9px] text-[var(--text-muted)]">{club.league as string}</span> : null}
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-[var(--text-primary)]">{club.squad_size as number}</td>
                          <td className="px-2 py-1 text-right font-mono text-[var(--text-secondary)]">{(club.avg_age as number) ?? "–"}</td>
                          <td className={`px-2 py-1 text-right font-mono font-bold ${(club.avg_level as number) >= 83 ? "text-green-400" : (club.avg_level as number) >= 78 ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                            {(club.avg_level as number) ?? "–"}
                          </td>
                          <td className={`px-2 py-1 text-right font-mono font-bold ${(club.top_level as number) >= 88 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>
                            {(club.top_level as number) ?? "–"}
                          </td>
                          <td className="px-2 py-1 text-[var(--text-muted)]">
                            {(club.position_gaps as string[]).length > 0
                              ? (club.position_gaps as string[]).join(", ")
                              : <span className="text-[var(--color-accent-tactical)]">Full</span>
                            }
                          </td>
                          <td className={`px-2 py-1 text-right font-mono ${(club.missing_levels as number) > 0 ? "text-[var(--color-sentiment-negative)]" : "text-[var(--color-accent-tactical)]"}`}>
                            {club.missing_levels as number}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SQL Console (admin only) ─────────────────────────────────────── */}
      {adminLoggedIn && (
        <div className="card p-4 ring-1 ring-[var(--color-sentiment-negative)]/20">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sentiment-negative)] mb-3">
            SQL Console
          </h2>
          <textarea ref={textareaRef} value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="SELECT * FROM people LIMIT 10;"
            spellCheck={false}
            className="w-full min-h-[100px] p-3 rounded-lg font-mono text-sm resize-y border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent-tactical)] transition-colors" />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={runSql} disabled={sqlRunning || !sql.trim()}
              className="px-4 py-1.5 rounded bg-[var(--color-accent-tactical)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all">
              {sqlRunning ? "Running..." : "Run"}
            </button>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">{"\u2318"}+Enter</span>
            {sqlResult?.ms != null && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono ml-auto">
                {sqlResult.ms}ms
                {sqlResult.type === "success" && sqlResult.queryType === "query" && ` · ${sqlResult.rowCount} rows`}
                {sqlResult.type === "success" && sqlResult.queryType === "mutation" && ` · ${sqlResult.rowCount} affected`}
              </span>
            )}
          </div>
          {sqlResult && (
            <div className="mt-3">
              {sqlResult.type === "error" ? (
                <div className="p-3 rounded-lg bg-[var(--color-sentiment-negative)]/10 border border-[var(--color-sentiment-negative)]/20">
                  <p className="text-sm font-mono text-[var(--color-sentiment-negative)] whitespace-pre-wrap">{sqlResult.error}</p>
                </div>
              ) : sqlResult.queryType === "query" && sqlResult.data ? (
                renderTable(sqlResult.data)
              ) : (
                <div className="p-3 rounded-lg bg-[var(--color-accent-tactical)]/10 border border-[var(--color-accent-tactical)]/20">
                  <p className="text-sm text-[var(--color-accent-tactical)]">{sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? "s" : ""} affected</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
