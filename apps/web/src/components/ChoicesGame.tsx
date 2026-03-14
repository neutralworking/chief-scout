"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

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

type GameState = "menu" | "playing" | "results" | "profile";

export function ChoicesGame({ categories }: { categories: Category[] }) {
  const { fcUserId } = useAuth();
  const [gameState, setGameState] = useState<GameState>("menu");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<VoteResult[] | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const timerRef = useRef<number>(0);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("fc_total_answered");
    if (stored) setTotalAnswered(parseInt(stored, 10));
  }, []);

  const fetchQuestion = useCallback(async (category?: string) => {
    setLoading(true);
    setResults(null);
    setChosenId(null);
    setAnimatingOut(false);

    try {
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
  }, [fcUserId]);

  const submitVote = async (optionId: number) => {
    if (!currentQuestion || chosenId !== null) return;

    setChosenId(optionId);
    const timeMs = Date.now() - timerRef.current;

    try {
      const res = await fetch("/api/choices/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: fcUserId,
          question_id: currentQuestion.id,
          option_id: optionId,
          time_ms: timeMs,
        }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        setStreak((s) => s + 1);
        const newTotal = totalAnswered + 1;
        setTotalAnswered(newTotal);
        localStorage.setItem("fc_total_answered", String(newTotal));
        if (autoAdvance) {
          // Tier 2 needs more time to read the intel cards
          const delay = currentQuestion.tier === 2 ? 3000 : 1500;
          setTimeout(() => nextQuestion(), delay);
        } else {
          // Scroll to next button
          setTimeout(() => {
            nextBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      }
    } catch (err) {
      console.error("Failed to submit vote:", err);
    }
  };

  const nextQuestion = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      fetchQuestion(selectedCategory ?? undefined);
    }, 300);
  };

  const startGame = (categorySlug?: string) => {
    setSelectedCategory(categorySlug ?? null);
    setGameState("playing");
    setStreak(0);
    fetchQuestion(categorySlug);
  };

  // ── Menu screen ──────────────────────────────────────────────────────────
  if (gameState === "menu") {
    return (
      <div className="space-y-4">
        {/* Quick play */}
        <button
          onClick={() => startGame()}
          className="w-full bg-gradient-to-r from-[var(--accent-tactical)] to-[var(--accent-mental)] text-white rounded-xl p-5 text-left hover:opacity-90 transition-opacity"
        >
          <div className="text-lg font-bold">Quick Play</div>
          <div className="text-sm opacity-80 mt-1">Random questions from all categories</div>
        </button>

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => startGame(cat.slug)}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 text-left hover:border-[var(--text-muted)] transition-colors"
            >
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-sm font-semibold">{cat.name}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                {cat.description}
              </div>
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {totalAnswered > 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 text-center">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Your choices</div>
            <div className="text-2xl font-bold font-mono mt-1">{totalAnswered}</div>
          </div>
        )}
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setGameState("menu")}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          &larr; Menu
        </button>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`flex items-center gap-1 transition-colors ${autoAdvance ? "text-[var(--accent-tactical)]" : ""}`}
            title={autoAdvance ? "Auto-advance ON" : "Auto-advance OFF"}
          >
            <span className={`w-6 h-3 rounded-full relative transition-colors ${autoAdvance ? "bg-[var(--accent-tactical)]" : "bg-[var(--bg-elevated)]"}`}>
              <span className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${autoAdvance ? "left-3.5" : "left-0.5"}`} />
            </span>
            <span className="hidden sm:inline">Auto</span>
          </button>
          {streak > 0 && (
            <span className="font-mono">
              Streak: <span className="text-[var(--accent-tactical)] font-bold">{streak}</span>
            </span>
          )}
          <span className="font-mono">{totalAnswered} total</span>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
        </div>
      )}

      {!loading && !currentQuestion && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-lg font-bold mb-2">All caught up!</div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            You&apos;ve answered all available questions in this category.
          </p>
          <button
            onClick={() => setGameState("menu")}
            className="px-6 py-2 bg-[var(--accent-tactical)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to Menu
          </button>
        </div>
      )}

      {!loading && currentQuestion && (
        <div className={`transition-all duration-300 ${animatingOut ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
          {/* Question */}
          <div className="text-center mb-6">
            {currentQuestion.category && (
              <div className="text-xs text-[var(--text-muted)] mb-1">
                {currentQuestion.category.icon} {currentQuestion.category.name}
              </div>
            )}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {currentQuestion.question_text}
            </h2>
            {currentQuestion.subtitle && (
              <p className="text-sm text-[var(--text-secondary)] mt-2">{currentQuestion.subtitle}</p>
            )}
          </div>

          {/* Options grid */}
          <OptionGrid
            options={currentQuestion.options}
            results={results}
            chosenId={chosenId}
            onVote={submitVote}
            optionCount={currentQuestion.option_count}
            isTier2={currentQuestion.tier === 2}
          />

          {/* Results + next / Pass button */}
          <div className="mt-6 flex flex-col items-center gap-3 animate-fadeIn">
            {results ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    {currentQuestion.total_votes + 1} votes
                  </span>
                  {!autoAdvance && (
                    <button
                      ref={nextBtnRef}
                      onClick={nextQuestion}
                      className="px-8 py-3 bg-[var(--accent-tactical)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Next Question →
                    </button>
                  )}
                </div>
                {/* Contextual cross-sell CTA */}
                <CrossSellCTA category={currentQuestion.category?.slug} tags={currentQuestion.tags} />
              </>
            ) : (
              <button
                onClick={nextQuestion}
                className="px-6 py-2 border border-[var(--border-subtle)] text-[var(--text-muted)] rounded-lg text-xs hover:text-[var(--text-secondary)] transition-colors"
              >
                Pass — skip this question
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Option Grid Component ──────────────────────────────────────────────────

function OptionGrid({
  options,
  results,
  chosenId,
  onVote,
  optionCount,
  isTier2,
}: {
  options: Option[];
  results: VoteResult[] | null;
  chosenId: number | null;
  onVote: (id: number) => void;
  optionCount: number;
  isTier2: boolean;
}) {
  const totalVotes = results
    ? results.reduce((sum, r) => sum + (r.vote_count ?? 0), 0)
    : 0;

  // Grid layout based on option count
  const gridClass =
    optionCount === 2
      ? "grid-cols-2 gap-4"
      : optionCount === 3
      ? "grid-cols-3 gap-3"
      : optionCount === 4
      ? "grid-cols-2 gap-3"
      : "grid-cols-3 sm:grid-cols-5 gap-2";

  return (
    <div className={`grid ${gridClass}`}>
      {options
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((opt) => {
          const resultData = results?.find((r) => r.id === opt.id);
          const pct = resultData && totalVotes > 0
            ? Math.round((resultData.vote_count / totalVotes) * 100)
            : 0;
          const isChosen = chosenId === opt.id;
          const isWinner = results && resultData
            ? resultData.vote_count === Math.max(...results.map((r) => r.vote_count ?? 0))
            : false;
          const hasVoted = chosenId !== null;
          const intel = opt.player_intel;
          const showIntel = isTier2 && hasVoted && intel;

          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              disabled={hasVoted}
              className={`
                relative overflow-hidden rounded-xl border-2 transition-all duration-300 text-left
                ${hasVoted ? "cursor-default" : "cursor-pointer hover:scale-[1.02] hover:border-[var(--accent-tactical)] active:scale-[0.98]"}
                ${isChosen ? "border-[var(--accent-tactical)] ring-2 ring-[var(--accent-tactical)]/30" : "border-[var(--border-subtle)]"}
                ${isWinner && results ? "border-[var(--accent-tactical)]" : ""}
                bg-[var(--bg-surface)]
              `}
            >
              {/* Player image or initials */}
              <div className="aspect-[4/3] bg-[var(--bg-elevated)] flex items-center justify-center relative">
                {opt.image_url ? (
                  <img
                    src={opt.image_url}
                    alt={opt.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold text-[var(--text-muted)]">
                    {opt.label
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                )}

                {/* Vote percentage overlay */}
                {results && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-center pb-3 animate-fadeIn">
                    <div className="text-center">
                      <div className={`text-2xl sm:text-3xl font-bold font-mono ${isWinner ? "text-[var(--accent-tactical)]" : "text-white"}`}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Chosen indicator */}
                {isChosen && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--accent-tactical)] rounded-full flex items-center justify-center animate-fadeIn">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Label + info */}
              <div className="p-3">
                <div className="font-semibold text-sm truncate">{opt.label}</div>
                {opt.subtitle && (
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{opt.subtitle}</div>
                )}

                {/* Tier 2 progressive reveal: player intelligence card */}
                {showIntel && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] space-y-1 animate-fadeIn">
                    {intel.level && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Level</span>
                        <span className="text-xs font-bold font-mono text-[var(--accent-tactical)]">{intel.level}</span>
                      </div>
                    )}
                    {intel.position && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pos</span>
                        <span className="text-xs font-mono">{intel.position}</span>
                      </div>
                    )}
                    {intel.archetype && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Type</span>
                        <span className="text-xs">{intel.archetype}</span>
                      </div>
                    )}
                    {intel.personality_code && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">MBTI</span>
                        <span className="text-xs font-mono">{intel.personality_code}</span>
                      </div>
                    )}
                    {opt.person_id && (
                      <a
                        href={`/players/${opt.person_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-[10px] text-[var(--accent-tactical)] hover:underline mt-1"
                      >
                        See full profile &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Vote bar (shown after voting) */}
              {results && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--bg-elevated)]">
                  <div
                    className={`h-full transition-all duration-700 ease-out ${isWinner ? "bg-[var(--accent-tactical)]" : "bg-[var(--text-muted)]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
    </div>
  );
}

// ── Cross-sell CTA ────────────────────────────────────────────────────────────

function CrossSellCTA({ category, tags }: { category?: string | null; tags?: string[] | null }) {
  const tagSet = new Set(tags ?? []);
  const isFreeAgent = tagSet.has("free-agent") || category === "transfer";
  const isScouting = category === "scouting";

  if (isFreeAgent) {
    return (
      <Link
        href="/free-agents"
        className="text-[11px] text-[var(--accent-personality)] hover:underline transition-colors"
      >
        See all free agents available this summer &rarr;
      </Link>
    );
  }

  if (isScouting) {
    return (
      <Link
        href="/players"
        className="text-[11px] text-[var(--accent-tactical)] hover:underline transition-colors"
      >
        Browse full player profiles &rarr;
      </Link>
    );
  }

  return null;
}
