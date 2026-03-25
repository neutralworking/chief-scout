"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { UpgradeCTA } from "@/components/UpgradeCTA";

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
  pick_count?: number;
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
  const [chosenIds, setChosenIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [prevStreak, setPrevStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [streakAnim, setStreakAnim] = useState<"bounce" | "shake" | null>(null);
  const timerRef = useRef<number>(0);

  void categories;

  const pickCount = currentQuestion?.pick_count ?? 1;

  useEffect(() => {
    const stored = localStorage.getItem("fc_total_answered");
    if (stored) setTotalAnswered(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    fetchQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcUserId]);

  const fetchQuestion = useCallback(
    async () => {
      setLoading(true);
      setResults(null);
      setChosenIds(new Set());
      setAnimatingOut(false);

      try {
        const dynRes = await fetch("/api/choices/dynamic");
        const dynData = await dynRes.json();

        if (dynData.questions?.length > 0) {
          setCurrentQuestion(dynData.questions[0]);
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

  const handleOptionTap = async (optionId: number) => {
    if (!currentQuestion || results !== null) return;

    const newChosenIds = new Set(chosenIds);

    if (newChosenIds.has(optionId)) {
      newChosenIds.delete(optionId);
      setChosenIds(newChosenIds);
      return;
    }

    newChosenIds.add(optionId);
    setChosenIds(newChosenIds);

    // Submit when we've picked enough
    if (newChosenIds.size >= pickCount) {
      await submitVotes(newChosenIds);
    }
  };

  const submitVotes = async (ids: Set<number>) => {
    if (!currentQuestion) return;
    const timeMs = Date.now() - timerRef.current;
    const idsArray = Array.from(ids);

    try {
      const firstOption = currentQuestion.options.find(
        (o) => o.id === idsArray[0]
      );

      const res = await fetch("/api/choices/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: fcUserId,
          question_id: currentQuestion.id,
          option_ids: idsArray,
          time_ms: timeMs,
          is_dynamic: currentQuestion.is_dynamic ?? false,
          person_id: firstOption?.person_id ?? null,
          dimension_weights: firstOption?.dimension_weights ?? null,
        }),
      });
      const data = await res.json();

      if (data.results) {
        setResults(data.results);
      } else if (currentQuestion.is_dynamic) {
        setResults(
          currentQuestion.options.map((o) => ({
            id: o.id,
            label: o.label,
            subtitle: o.subtitle,
            vote_count: ids.has(o.id) ? 1 : 0,
            person_id: o.person_id,
            image_url: o.image_url,
          }))
        );
      }

      setPrevStreak(streak);
      setStreak((s) => s + 1);
      setStreakAnim("bounce");
      setTimeout(() => setStreakAnim(null), 350);

      const newTotal = totalAnswered + 1;
      setTotalAnswered(newTotal);
      localStorage.setItem("fc_total_answered", String(newTotal));

      setTimeout(() => nextQuestion(), 2200);
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

  // Suppress unused var warning
  void prevStreak;

  // ── Full viewport layout ─────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* ── Header bar — sharp ── */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]/30">
        <a
          href="/"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          &larr; Home
        </a>
        <div className="text-sm font-bold tracking-tight text-[var(--text-primary)] uppercase">
          Gaffer
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {streak > 0 && (
            <span
              className={`font-data ${
                streakAnim === "bounce" ? "gaffer-streak-bounce" : ""
              } ${streakAnim === "shake" ? "gaffer-streak-shake" : ""}`}
            >
              <span className="text-[var(--color-accent-tactical)] font-bold">
                {streak}
              </span>{" "}
              streak
            </span>
          )}
          <span className="font-data">{totalAnswered}</span>
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
          <UpgradeCTA
            message="Your manager style is taking shape"
            detail="See which players match your philosophy with full scouting intelligence."
          />
          <button
            onClick={() => fetchQuestion()}
            className="px-6 py-2 mt-4 bg-[var(--color-accent-tactical)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
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
          <div className="flex-none px-4 pt-4 pb-2 text-center animate-slideUp">
            {currentQuestion.category && (
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-tactical)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.15em] font-medium">
                  {currentQuestion.category.name}
                </span>
              </div>
            )}
            <h2 className="text-base sm:text-lg font-bold tracking-tight leading-tight line-clamp-2">
              {currentQuestion.question_text}
            </h2>
            {currentQuestion.subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">
                {currentQuestion.subtitle}
              </p>
            )}
            {pickCount > 1 && !results && (
              <p className="text-[11px] text-[var(--color-accent-tactical)] mt-1 font-medium">
                Pick {pickCount} — {chosenIds.size}/{pickCount} selected
              </p>
            )}
          </div>

          {/* Options zone — fills remaining space */}
          <div className="flex-1 min-h-0 px-3 py-2">
            <OptionGrid
              options={currentQuestion.options}
              results={results}
              chosenIds={chosenIds}
              pickCount={pickCount}
              onVote={handleOptionTap}
              isDynamic={currentQuestion.is_dynamic ?? false}
            />
          </div>

          {/* Action bar — sharp */}
          <div className="flex-none px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between border-t border-[var(--border-subtle)]/30">
            {results ? (
              <>
                <span className="text-xs text-[var(--text-muted)] font-data">
                  {currentQuestion.total_votes + 1} votes
                </span>
                <UpgradeCTA
                  message="See which players match your style"
                  variant="inline"
                />
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2 bg-[var(--color-accent-tactical)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Next &rarr;
                </button>
              </>
            ) : (
              <>
                <div />
                <button
                  onClick={nextQuestion}
                  className="px-4 py-2 border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs hover:text-[var(--text-secondary)] transition-colors"
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
  chosenIds,
  pickCount,
  onVote,
  isDynamic,
}: {
  options: Option[];
  results: VoteResult[] | null;
  chosenIds: Set<number>;
  pickCount: number;
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

  const sorted = [...options].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={`grid ${gridClass} h-full auto-rows-fr`}>
      {sorted.map((opt, index) => {
        const resultData = results?.find((r) => r.id === opt.id);
        const pct =
          resultData && totalVotes > 0
            ? Math.round((resultData.vote_count / totalVotes) * 100)
            : 0;
        const isChosen = chosenIds.has(opt.id);
        const isWinner =
          results && resultData
            ? resultData.vote_count ===
              Math.max(...results.map((r) => r.vote_count ?? 0))
            : false;
        const hasSubmitted = results !== null;
        const canSelect = !hasSubmitted && (isChosen || chosenIds.size < pickCount);
        const intel = opt.player_intel;
        const pos = intel?.position ?? "";

        return (
          <button
            key={opt.id}
            onClick={() => onVote(opt.id)}
            disabled={!canSelect && !isChosen}
            className={`
              gaffer-option-enter relative overflow-hidden border-l-[3px] border transition-all duration-200 text-left flex flex-col justify-center px-3 py-2 min-h-16
              ${POS_BORDER[pos] ?? "border-l-[var(--border-subtle)]"}
              ${
                hasSubmitted
                  ? "cursor-default"
                  : canSelect
                  ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  : "cursor-default opacity-50"
              }
              ${
                isChosen && !hasSubmitted
                  ? "border-[var(--color-accent-tactical)] bg-[var(--color-accent-tactical)]/10 scale-[1.02]"
                  : isChosen && hasSubmitted
                  ? "border-[var(--color-accent-tactical)] bg-[var(--color-accent-tactical)]/10"
                  : "border-[var(--border-subtle)]/50 bg-[var(--bg-surface)]"
              }
              ${isWinner && results ? "gaffer-glow border-[var(--color-accent-tactical)]" : ""}
            `}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Vote percentage bar background */}
            {results && (
              <div
                className={`absolute inset-0 transition-all duration-700 ease-out ${
                  isWinner
                    ? "bg-[var(--color-accent-tactical)]/15"
                    : "bg-[var(--text-muted)]/5"
                }`}
                style={{
                  width: `${pct}%`,
                  animation: "barSlideIn 0.7s ease-out",
                  animationDelay: `${index * 100}ms`,
                  animationFillMode: "backwards",
                }}
              />
            )}

            {/* Content */}
            <div className="relative z-10">
              {/* Row 1: Position + Name */}
              <div className="flex items-center gap-2">
                {(isDynamic || intel) && pos && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 ${
                      POS_BG[pos] ?? "bg-[var(--bg-elevated)]"
                    } text-[var(--text-secondary)]`}
                  >
                    {pos}
                  </span>
                )}
                <span className="font-semibold text-[13px] truncate">
                  {opt.label}
                </span>
                {isChosen && (
                  <svg
                    className="gaffer-check-pop w-4 h-4 text-[var(--color-accent-tactical)] flex-none ml-auto"
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
                    className={`text-sm font-bold font-data ml-auto ${
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
              {hasSubmitted && intel && (isDynamic || opt.player_intel) && (
                <div
                  className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]"
                  style={{
                    opacity: 0,
                    animation: "fadeIn 0.3s ease-out forwards",
                    animationDelay: "800ms",
                  }}
                >
                  {intel.archetype && (
                    <span className="text-[var(--color-accent-technical)]">
                      {intel.archetype}
                    </span>
                  )}
                  {intel.level && (
                    <span>
                      L
                      <span className="font-data font-bold text-[var(--color-accent-tactical)]">
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
