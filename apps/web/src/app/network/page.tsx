"use client";

import { useCallback, useEffect, useState } from "react";
// InsightCard handles its own position colors
import { InsightCard, type InsightData } from "@/components/InsightCard";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PAGE_SIZE = 25;

const LEAGUES = [
  "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1",
  "Eredivisie", "Primeira Liga", "Championship", "Süper Lig", "Jupiler Pro League",
  "Premiership", "Austrian Bundesliga", "Super League", "Superliga",
  "Super League 1", "HNL", "Super Liga", "Liga I", "Czech Liga",
  "Ekstraklasa", "Allsvenskan", "Eliteserien", "First League",
  "MLS", "Liga MX", "Saudi Pro League",
];

export default function GemsPage() {
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [posFilter, setPosFilter] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginPass, setLoginPass] = useState("");

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  function handleLogin() {
    if (loginPass === "0.123456789") {
      sessionStorage.setItem("network_admin", "1");
      setIsAdmin(true);
      setShowLogin(false);
      setLoginPass("");
    }
  }

  const fetchInsights = useCallback(async (off: number, append: boolean) => {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (posFilter) params.set("position", posFilter);
      if (leagueFilter) params.set("league", leagueFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(off));

      const res = await fetch(`/api/insights?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (append) {
        setInsights((prev) => [...prev, ...(data.insights ?? [])]);
      } else {
        setInsights(data.insights ?? []);
      }
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [posFilter, leagueFilter]);

  useEffect(() => {
    setOffset(0);
    setReviewed(new Set());
    fetchInsights(0, false);
  }, [fetchInsights]);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchInsights(next, true);
  }

  function handleAccept(personId: number) {
    setReviewed((prev) => new Set(prev).add(personId));
  }

  function handleSkip(personId: number) {
    setReviewed((prev) => new Set(prev).add(personId));
  }

  // Summary stats
  const avgScore = insights.length > 0
    ? (insights.reduce((sum, i) => sum + i.gem_score, 0) / insights.length).toFixed(1)
    : "0";
  const reviewedCount = reviewed.size;
  const progressPct = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="shrink-0 mb-2">
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-lg font-bold tracking-tight">Network</h1>
          {!isAdmin ? (
            <button
              onClick={() => setShowLogin(!showLogin)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="Admin login"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          ) : (
            <span className="text-[10px] text-[var(--color-accent-tactical)]" title="Editing enabled">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </span>
          )}
          {showLogin && (
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              placeholder="PIN"
              className="w-20 px-2 py-0.5 text-[10px] rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent-tactical)]"
              autoFocus
            />
          )}
        </div>

        {/* Summary bar */}
        <div className="card rounded-xl px-3 py-2 mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--text-secondary)]">
              <span className="font-bold text-[var(--text-primary)]">{total}</span> gems
              <span className="text-[var(--text-muted)] mx-1">·</span>
              avg <span className="font-mono font-bold text-[var(--color-accent-personality)]">{avgScore}</span>
              <span className="text-[var(--text-muted)] mx-1">·</span>
              <span className="font-bold text-[var(--color-accent-tactical)]">{reviewedCount}</span> reviewed
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{progressPct}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent-tactical)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="card rounded-lg p-1.5 mb-2 overflow-hidden">
          {/* Position pills */}
          <div className="flex items-center gap-1 mb-1 overflow-x-auto scrollbar-none">
            <div className="flex gap-0.5 shrink-0">
              <button
                onClick={() => setPosFilter("")}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
                  !posFilter
                    ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                ALL
              </button>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(posFilter === pos ? "" : pos)}
                  className={`text-[9px] font-bold px-1 py-0.5 rounded whitespace-nowrap transition-colors ${
                    posFilter === pos
                      ? "bg-[var(--color-accent-personality)]/20 text-[var(--color-accent-personality)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="ml-auto px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[10px] max-w-[140px] shrink-0"
            >
              <option value="">League</option>
              {LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        )}

        {/* Insight cards */}
        {!loading && insights.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {insights.map((insight) => (
              <InsightCard
                key={`${insight.person_id}-${insight.insight_type}`}
                insight={insight}
                isAdmin={isAdmin}
                isReviewed={reviewed.has(insight.person_id)}
                onAccept={handleAccept}
                onSkip={handleSkip}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && insights.length === 0 && (
          <div className="card rounded-xl py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">No gems found. Run the insights pipeline to generate.</p>
          </div>
        )}

        {/* Show more */}
        {!loading && insights.length < total && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {loadingMore ? "Loading..." : `Show more (${insights.length} of ${total})`}
          </button>
        )}
      </div>
    </div>
  );
}
