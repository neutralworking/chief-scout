"use client";

import { useState, useRef } from "react";

export function AdminActions() {
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsResult, setNewsResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cardsRefreshing, setCardsRefreshing] = useState(false);
  const [cardsResult, setCardsResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const refreshCards = async () => {
    setCardsRefreshing(true);
    setCardsResult(null);
    try {
      const res = await fetch("/api/admin/refresh-cards", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setCardsResult({ type: "success", text: "Player cards refreshed" });
      } else {
        setCardsResult({ type: "error", text: data.error ?? "Failed" });
      }
    } catch (e) {
      setCardsResult({ type: "error", text: String(e) });
    }
    setCardsRefreshing(false);
  };

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
    } catch (e) {
      setNewsResult({ type: "error", text: String(e) });
    }
    setNewsRefreshing(false);
  };

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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runSql();
    }
  };

  // Render table from query results
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
                <th key={c} className="text-left px-2 py-1.5 font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] whitespace-nowrap">
                  {c}
                </th>
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
        {rows.length > 200 && (
          <p className="text-[10px] text-[var(--text-muted)] px-2 py-1">Showing 200 of {rows.length} rows</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Pipeline Actions */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
          Pipeline Actions
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={refreshNews}
            disabled={newsRefreshing}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            {newsRefreshing ? "Refreshing..." : "Refresh News"}
          </button>
          <button
            onClick={refreshCards}
            disabled={cardsRefreshing}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-amber-500 transition-colors cursor-pointer"
          >
            {cardsRefreshing ? "Refreshing..." : "Refresh Cards"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">Run after pipeline changes</span>
        </div>
        {newsResult && (
          <p className={`mt-3 text-sm ${newsResult.type === "error" ? "text-[var(--sentiment-negative)]" : "text-[var(--accent-tactical)]"}`}>
            {newsResult.text}
          </p>
        )}
        {cardsResult && (
          <p className={`mt-3 text-sm ${cardsResult.type === "error" ? "text-[var(--sentiment-negative)]" : "text-[var(--accent-tactical)]"}`}>
            {cardsResult.text}
          </p>
        )}
      </div>

      {/* SQL Runner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
          SQL Console
        </h2>
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM people LIMIT 10;"
          spellCheck={false}
          className="w-full min-h-[120px] p-3 rounded-lg font-mono text-sm resize-y border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={runSql}
            disabled={sqlRunning || !sql.trim()}
            className="px-4 py-1.5 rounded bg-[var(--accent-tactical)] text-[var(--bg-base)] text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
          >
            {sqlRunning ? "Running..." : "Run"}
          </button>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {"\u2318"}+Enter to run
          </span>
          {sqlResult?.ms != null && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono ml-auto">
              {sqlResult.ms}ms
              {sqlResult.type === "success" && sqlResult.queryType === "query" && ` \u00B7 ${sqlResult.rowCount} rows`}
              {sqlResult.type === "success" && sqlResult.queryType === "mutation" && ` \u00B7 ${sqlResult.rowCount} affected`}
            </span>
          )}
        </div>

        {/* Results */}
        {sqlResult && (
          <div className="mt-4">
            {sqlResult.type === "error" ? (
              <div className="p-3 rounded-lg bg-[var(--sentiment-negative)]/10 border border-[var(--sentiment-negative)]/20">
                <p className="text-sm font-mono text-[var(--sentiment-negative)] whitespace-pre-wrap">{sqlResult.error}</p>
              </div>
            ) : sqlResult.queryType === "query" && sqlResult.data ? (
              renderTable(sqlResult.data)
            ) : (
              <div className="p-3 rounded-lg bg-[var(--accent-tactical)]/10 border border-[var(--accent-tactical)]/20">
                <p className="text-sm text-[var(--accent-tactical)]">
                  {sqlResult.rowCount} row{sqlResult.rowCount !== 1 ? "s" : ""} affected
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
