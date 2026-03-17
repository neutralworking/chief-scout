"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface PlayerIntel {
  position: string | null;
  level: number | null;
  archetype: string | null;
  personality_code: string | null;
  club?: string | null;
  nation?: string | null;
  age?: number | null;
  best_role?: string | null;
  best_role_score?: number | null;
}

interface Option {
  id: number;
  person_id: number | null;
  label: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
  vote_count: number;
  dimension_weights?: Record<string, number> | null;
  player_intel?: PlayerIntel | null;
}

interface Question {
  id: number;
  question_text: string;
  subtitle: string | null;
  option_count: number;
  difficulty: number;
  tags: string[] | null;
  total_votes: number;
  tier: number | null;
  is_dynamic?: boolean;
  template?: string;
  category: Category | null;
  options: Option[];
}

interface VoteResult {
  id: number;
  label: string;
  subtitle: string | null;
  vote_count: number;
  person_id: number | null;
  image_url: string | null;
}

// ── Position colors for left border ──────────────────────────────────────────

const POS_BORDER: Record<string, string> = {
  GK: "border-l-amber-500",
  CD: "border-l-blue-500",
  WD: "border-l-blue-400",
  DM: "border-l-green-600",
  CM: "border-l-green-500",
  WM: "border-l-green-400",
  AM: "border-l-purple-500",
  WF: "border-l-red-500",
  CF: "border-l-red-600",
};

const POS_BG: Record<string, string> = {
  GK: "bg-amber-500/20",
  CD: "bg-blue-500/20",
  WD: "bg-blue-400/20",
  DM: "bg-green-600/20",
  CM: "bg-green-500/20",
  WM: "bg-green-400/20",
  AM: "bg-purple-500/20",
  WF: "bg-red-500/20",
  CF: "bg-red-600/20",
};

// ── Main Component ───────────────────────────────────────────────────────────

export function ChoicesGame({ categories }: { categories: Category[] }) {
  const { fcUserId } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<VoteResult[] | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const timerRef = useRef<number>(0);

  // Suppress categories unused warning — kept for future category filter
  void categories;

  useEffect(() => {
    const stored = localStorage.getItem("fc_total_answered");
    if (stored) setTotalAnswered(parseInt(stored, 10));
  }, []);

  // Auto-fetch first question on mount
  useEffect(() => {
    fetchQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcUserId]);

  const fetchQuestion = useCallback(
    async (category?: string) => {
      setLoading(true);
      setResults(null);
      setChosenId(null);
      setAnimatingOut(false);

      try {
        // Try dynamic first
        const dynRes = await fetch("/api/choices/dynamic");
        const dynData = await dynRes.json();

        if (dynData.questions?.length > 0) {
          setCurrentQuestion(dynData.questions[0]);
          timerRef.current = Date.now();
          setLoading(false);
          return;
        }

        // Fall back to static
        const params = new URLSearchParams();
        if (fcUserId) params.set("user_id", fcUserId);
        if (category) params.set("category", category);
        params.set("count", "1");

        const res = await fetch(`/api/choices?${params}`);
        const data = await res.json();

        if (data.questions?.length > 0) {
          setCurrentQuestion(data.questions[0]);
          timerRef.current = Date.now();
        } else {
          setCurrentQuestion(null);
        }
      } catch (err) {
        console.error("Failed to fetch question:", err);
      } finally {
        setLoading(false);
      }
    },
    [fcUserId]
  );

  const submitVote = async (optionId: number) => {
    if (!currentQuestion || chosenId !== null) return;

    setChosenId(optionId);
    const timeMs = Date.now() - timerRef.current;

    try {
      // For dynamic questions, send dimension_weights along
      const chosenOption = currentQuestion.options.find(
        (o) => o.id === optionId
      );

      const res = await fetch("/api/choices/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: fcUserId,
          question_id: currentQuestion.id,
          option_id: optionId,
          time_ms: timeMs,
          is_dynamic: currentQuestion.is_dynamic ?? false,
          person_id: chosenOption?.person_id ?? null,
          dimension_weights: chosenOption?.dimension_weights ?? null,
        }),
      });
      const data = await res.json();

      if (data.results) {
        setResults(data.results);
      } else if (currentQuestion.is_dynamic) {
        // For dynamic questions, build results from the options we already have
        setResults(
          currentQuestion.options.map((o) => ({
            id: o.id,
            label: o.label,
            subtitle: o.subtitle,
            vote_count: o.id === optionId ? 1 : 0,
            person_id: o.person_id,
            image_url: o.image_url,
          }))
        );
      }

      setStreak((s) => s + 1);
      const newTotal = totalAnswered + 1;
      setTotalAnswered(newTotal);
      localStorage.setItem("fc_total_answered", String(newTotal));

      // Auto-advance after delay
      setTimeout(() => nextQuestion(), 2000);
    } catch (err) {
      console.error("Failed to submit vote:", err);
    }
  };

  const nextQuestion = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      fetchQuestion();
    }, 250);
  };

  // ── Full viewport layout ─────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* ── Header bar ── */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]/30">
        <a
          href="/"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          &larr; Home
        </a>
        <div className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
          Gaffer
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {streak > 0 && (
            <span className="font-mono">
              <span className="text-[var(--color-accent-tactical)] font-bold">
                {streak}
              </span>{" "}
              streak
            </span>
          )}
          <span className="font-mono">{totalAnswered}</span>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--color-accent-tactical)] rounded-full animate-spin" />
        </div>
      )}

      {/* ── No questions left ── */}
      {!loading && !currentQuestion && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-4xl mb-4">⚽</div>
          <div className="text-lg font-bold mb-2">All caught up!</div>
          <p className="text-sm text-[var(--text-secondary)] mb-6 text-center">
            You&apos;ve answered everything. New questions coming soon.
          </p>
          <button
            onClick={() => fetchQuestion()}
            className="px-6 py-2 bg-[var(--color-accent-tactical)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Question + Options ── */}
      {!loading && currentQuestion && (
        <div
          className={`flex-1 flex flex-col min-h-0 transition-all duration-250 ${
            animatingOut
              ? "opacity-0 translate-y-4"
              : "opacity-100 translate-y-0"
          }`}
        >
          {/* Question zone */}
          <div className="flex-none px-4 pt-4 pb-2 text-center">
            {currentQuestion.category && (
              <div className="text-[11px] text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                {currentQuestion.category.icon}{" "}
                {currentQuestion.category.name}
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-tight line-clamp-2">
              {currentQuestion.question_text}
            </h2>
            {currentQuestion.subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">
                {currentQuestion.subtitle}
              </p>
            )}
          </div>

          {/* Options zone — fills remaining space */}
          <div className="flex-1 min-h-0 px-3 py-2">
            <OptionGrid
              options={currentQuestion.options}
              results={results}
              chosenId={chosenId}
              onVote={submitVote}
              isDynamic={currentQuestion.is_dynamic ?? false}
            />
          </div>

          {/* Action bar */}
          <div className="flex-none px-4 py-3 flex items-center justify-between border-t border-[var(--border-subtle)]/30">
            {results ? (
              <>
                <span className="text-xs text-[var(--text-muted)]">
                  {currentQuestion.total_votes + 1} votes
                </span>
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2 bg-[var(--color-accent-tactical)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Next &rarr;
                </button>
              </>
            ) : (
              <>
                <div />
                <button
                  onClick={nextQuestion}
                  className="px-4 py-2 border border-[var(--border-subtle)] text-[var(--text-muted)] rounded-lg text-xs hover:text-[var(--text-secondary)] transition-colors"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Option Grid ──────────────────────────────────────────────────────────────

function OptionGrid({
  options,
  results,
  chosenId,
  onVote,
  isDynamic,
}: {
  options: Option[];
  results: VoteResult[] | null;
  chosenId: number | null;
  onVote: (id: number) => void;
  isDynamic: boolean;
}) {
  const totalVotes = results
    ? results.reduce((sum, r) => sum + (r.vote_count ?? 0), 0)
    : 0;

  const count = options.length;
  const gridClass =
    count === 2
      ? "grid-cols-1 sm:grid-cols-2 gap-2"
      : count === 3
      ? "grid-cols-1 sm:grid-cols-3 gap-2"
      : "grid-cols-2 gap-2";

  return (
    <div className={`grid ${gridClass} h-full auto-rows-fr`}>
      {options
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((opt) => {
          const resultData = results?.find((r) => r.id === opt.id);
          const pct =
            resultData && totalVotes > 0
              ? Math.round((resultData.vote_count / totalVotes) * 100)
              : 0;
          const isChosen = chosenId === opt.id;
          const isWinner =
            results && resultData
              ? resultData.vote_count ===
                Math.max(...results.map((r) => r.vote_count ?? 0))
              : false;
          const hasVoted = chosenId !== null;
          const intel = opt.player_intel;
          const pos = intel?.position ?? "";

          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              disabled={hasVoted}
              className={`
                relative overflow-hidden rounded-xl border-l-4 border transition-all duration-200 text-left flex flex-col justify-center px-3 py-2 min-h-0
                ${POS_BORDER[pos] ?? "border-l-[var(--border-subtle)]"}
                ${
                  hasVoted
                    ? "cursor-default"
                    : "cursor-pointer hover:scale-[1.01] active:scale-[0.98]"
                }
                ${
                  isChosen
                    ? "border-[var(--color-accent-tactical)] bg-[var(--color-accent-tactical)]/10"
                    : "border-[var(--border-subtle)]/50 bg-[var(--bg-surface)]"
                }
                ${isWinner && results ? "border-[var(--color-accent-tactical)]" : ""}
              `}
            >
              {/* Vote percentage bar background */}
              {results && (
                <div
                  className={`absolute inset-0 transition-all duration-700 ease-out ${
                    isWinner
                      ? "bg-[var(--color-accent-tactical)]/15"
                      : "bg-[var(--text-muted)]/5"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}

              {/* Content */}
              <div className="relative z-10">
                {/* Row 1: Position + Name */}
                <div className="flex items-center gap-2">
                  {(isDynamic || intel) && pos && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        POS_BG[pos] ?? "bg-[var(--bg-elevated)]"
                      } text-[var(--text-secondary)]`}
                    >
                      {pos}
                    </span>
                  )}
                  <span className="font-semibold text-sm truncate">
                    {opt.label}
                  </span>
                  {isChosen && (
                    <svg
                      className="w-4 h-4 text-[var(--color-accent-tactical)] flex-none ml-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {results && (
                    <span
                      className={`text-sm font-bold font-mono ml-auto ${
                        isWinner
                          ? "text-[var(--color-accent-tactical)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {pct}%
                    </span>
                  )}
                </div>

                {/* Row 2: Subtitle (club · nation) */}
                {opt.subtitle && (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                    {opt.subtitle}
                  </div>
                )}

                {/* Row 3: Intel (archetype · level) — shown after voting for dynamic */}
                {hasVoted && intel && (isDynamic || opt.player_intel) && (
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)] animate-fadeIn">
                    {intel.archetype && (
                      <span className="text-[var(--color-accent-technical)]">
                        {intel.archetype}
                      </span>
                    )}
                    {intel.level && (
                      <span>
                        L
                        <span className="font-mono font-bold text-[var(--color-accent-tactical)]">
                          {intel.level}
                        </span>
                      </span>
                    )}
                    {intel.age && <span>{intel.age}y</span>}
                    {intel.best_role && (
                      <span className="text-[var(--color-accent-mental)]">
                        {intel.best_role}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
}
