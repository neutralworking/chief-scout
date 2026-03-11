"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineData {
  counts: Record<string, { label: string; count: number | null }>;
  sourceCounts: Record<string, number>;
}

interface HealthData {
  totalPeople: number;
  coverage: {
    profiles: number;
    personality: number;
    market: number;
    status: number;
    attributes: number;
    wikidata: number;
    fbref: number;
    fullProfiles: number;
  };
}

type Tab = "pipeline" | "health" | "import";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function numOrNull(v: string | undefined): number | null {
  if (!v || v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Components ───────────────────────────────────────────────────────────────

function CoverageBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-mono">
          {value}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor:
              pct >= 80
                ? "var(--accent-tactical)"
                : pct >= 40
                  ? "var(--accent-physical)"
                  : "var(--pursuit-priority)",
          }}
        />
      </div>
    </div>
  );
}

// ── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/pipeline")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-text-secondary">Loading pipeline data...</p>;
  if (error) return <p className="text-pursuit-priority">Error: {error}</p>;
  if (!data) return null;

  const coreOrder = ["people", "player_profiles", "player_personality", "player_market", "player_status", "attribute_grades"];
  const linkOrder = ["player_id_links", "fbref_players", "fbref_player_season_stats"];
  const externalOrder = ["news_stories", "news_player_tags", "sb_events", "sb_lineups", "understat_player_match_stats"];

  const renderGroup = (title: string, keys: string[]) => (
    <div className="mb-6">
      <h3 className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {keys.map((key) => {
          const item = data.counts[key];
          if (!item) return null;
          return (
            <div
              key={key}
              className="p-3 rounded-lg border border-[var(--border-subtle)] bg-bg-surface"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="text-xl font-mono text-text-primary mt-1">
                {item.count !== null ? item.count.toLocaleString() : "?"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {renderGroup("Core Player Data", coreOrder)}
      {renderGroup("ID Links & FBRef", linkOrder)}
      {renderGroup("External Data", externalOrder)}

      {Object.keys(data.sourceCounts).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">
            ID Links by Source
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.sourceCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div
                  key={source}
                  className="p-3 rounded-lg border border-[var(--border-subtle)] bg-bg-surface"
                >
                  <p className="text-xs text-text-secondary">{source}</p>
                  <p className="text-lg font-mono text-text-primary mt-1">
                    {count.toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Health Tab ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-text-secondary">Loading health data...</p>;
  if (error) return <p className="text-pursuit-priority">Error: {error}</p>;
  if (!data) return null;

  const { totalPeople, coverage } = data;

  return (
    <div>
      {/* North star */}
      <div className="mb-8 p-6 rounded-lg border-2 border-[var(--accent-personality)] bg-bg-surface">
        <p className="text-xs font-semibold tracking-widest uppercase text-accent-personality mb-1">
          North Star — Full Profiles
        </p>
        <p className="text-4xl font-mono text-text-primary">
          {coverage.fullProfiles}
          <span className="text-lg text-text-muted ml-2">/ {totalPeople} people</span>
        </p>
        <p className="text-sm text-text-secondary mt-1">
          Players with profile + personality + market + status + attributes
        </p>
      </div>

      {/* Coverage bars */}
      <div className="p-4 rounded-lg border border-[var(--border-subtle)] bg-bg-surface">
        <h3 className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-4">
          Coverage Breakdown
        </h3>
        <CoverageBar label="Profiles" value={coverage.profiles} total={totalPeople} />
        <CoverageBar label="Personality" value={coverage.personality} total={totalPeople} />
        <CoverageBar label="Market Data" value={coverage.market} total={totalPeople} />
        <CoverageBar label="Status" value={coverage.status} total={totalPeople} />
        <CoverageBar label="Attribute Grades" value={coverage.attributes} total={totalPeople} />
        <CoverageBar label="Wikidata ID" value={coverage.wikidata} total={totalPeople} />
        <CoverageBar label="FBRef Linked" value={coverage.fbref} total={totalPeople} />
      </div>
    </div>
  );
}

// ── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState("2025-2026");
  const [compId, setCompId] = useState("9");
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [status, setStatus] = useState<{
    type: "idle" | "parsing" | "uploading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      setStatus({ type: "parsing", message: "Parsing CSV..." });

      const text = await f.text();
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
      setStatus({
        type: "idle",
        message: `Parsed ${rows.length} rows. Review preview then click Import.`,
      });
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!file) return;
    setStatus({ type: "uploading", message: "Uploading..." });

    const text = await file.text();
    const rows = parseCSV(text);

    const players = rows.map((r) => {
      const nameSlug = slugify(r.player || r.name || "");
      const teamSlug = slugify(r.squad || r.team || "");
      const fbrefId =
        r.fbref_id || `csv_${compId}_${season}_${teamSlug}_${nameSlug}`;

      return {
        fbref_id: fbrefId,
        name: r.player || r.name || "",
        nation: r.nation || r.nationality || null,
        position: r.pos || r.position || null,
        team: r.squad || r.team || null,
        comp_id: compId,
        season: season,
        age: numOrNull(r.age),
        born: numOrNull(r.born),
        minutes: numOrNull(r.min || r.minutes),
        goals: numOrNull(r.gls || r.goals),
        assists: numOrNull(r.ast || r.assists),
        xg: numOrNull(r.xg),
        xag: numOrNull(r.xag),
        npxg: numOrNull(r.npxg),
        progressive_carries: numOrNull(r.prgc || r.progressive_carries),
        progressive_passes: numOrNull(r.prgp || r.progressive_passes),
        progressive_passes_received: numOrNull(
          r.prgr || r.progressive_passes_received
        ),
      };
    });

    try {
      const resp = await fetch("/api/admin/fbref-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, season, comp_id: compId }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
      setStatus({
        type: "success",
        message: `Imported ${result.imported} players for ${result.season} (comp ${result.comp_id}).`,
      });
    } catch (e) {
      setStatus({
        type: "error",
        message: `Import failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }, [file, season, compId]);

  const COMP_OPTIONS = [
    { value: "9", label: "Premier League" },
    { value: "12", label: "La Liga" },
    { value: "20", label: "Bundesliga" },
    { value: "11", label: "Serie A" },
    { value: "13", label: "Ligue 1" },
    { value: "22", label: "Eredivisie" },
    { value: "32", label: "Primeira Liga" },
  ];

  return (
    <div>
      <p className="text-sm text-text-secondary mb-4">
        Upload a FBRef CSV export. The file is parsed client-side, then upserted
        to <code className="text-accent-technical">fbref_players</code> and{" "}
        <code className="text-accent-technical">
          fbref_player_season_stats
        </code>
        .
      </p>

      {/* Config */}
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">Season</label>
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="px-3 py-1.5 rounded bg-bg-elevated border border-[var(--border-subtle)] text-text-primary text-sm font-mono w-32"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Competition
          </label>
          <select
            value={compId}
            onChange={(e) => setCompId(e.target.value)}
            className="px-3 py-1.5 rounded bg-bg-elevated border border-[var(--border-subtle)] text-text-primary text-sm"
          >
            {COMP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* File input */}
      <div className="mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm text-text-secondary
            file:mr-4 file:py-2 file:px-4 file:rounded file:border-0
            file:text-sm file:font-semibold file:bg-bg-elevated
            file:text-text-primary hover:file:bg-bg-surface
            file:cursor-pointer file:transition-colors"
        />
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <p className="text-xs text-text-muted mb-2">
            Preview (first 5 rows):
          </p>
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {Object.keys(preview[0]).map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left text-text-muted font-mono"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--border-subtle)]/50"
                >
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-2 py-1 text-text-secondary">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!file || status.type === "uploading"}
        className="px-4 py-2 rounded bg-accent-tactical text-bg-base text-sm font-semibold
          disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
      >
        {status.type === "uploading" ? "Importing..." : "Import to Supabase"}
      </button>

      {/* Status */}
      {status.message && (
        <p
          className={`mt-3 text-sm ${
            status.type === "error"
              ? "text-pursuit-priority"
              : status.type === "success"
                ? "text-accent-tactical"
                : "text-text-secondary"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}

// ── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("pipeline");

  const tabs: { key: Tab; label: string }[] = [
    { key: "pipeline", label: "Pipeline" },
    { key: "health", label: "Data Health" },
    { key: "import", label: "Import" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Admin</h1>
        <p className="text-sm text-text-secondary mt-1">
          Pipeline status, data health, and CSV import
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "text-text-primary border-accent-personality"
                : "text-text-secondary border-transparent hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "pipeline" && <PipelineTab />}
      {tab === "health" && <HealthTab />}
      {tab === "import" && <ImportTab />}
    </div>
  );
}
