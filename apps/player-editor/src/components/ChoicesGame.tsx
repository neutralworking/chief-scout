"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface Option {
  id: number;
  person_id: number | null;
  label: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
  vote_count: number;
}

interface Question {
  id: number;
  question_text: string;
  subtitle: string | null;
  option_count: number;
  difficulty: number;
  tags: string[] | null;
  total_votes: number;
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

function getUserId(): string {
  if (typeof window === "undefined") return "";
  let uid = localStorage.getItem("fc_user_id");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("fc_user_id", uid);
  }
  return uid;
}

export function ChoicesGame({ categories }: { categories: Category[] }) {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<VoteResult[] | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const timerRef = useRef<number>(0);
  const userId = useRef("");

  useEffect(() => {
    userId.current = getUserId();
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
      if (userId.current) params.set("user_id", userId.current);
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
  }, []);

  const submitVote = async (optionId: number) => {
    if (!currentQuestion || chosenId !== null) return;

    setChosenId(optionId);
    const timeMs = Date.now() - timerRef.current;

    try {
      const res = await fetch("/api/choices/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId.current,
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
          />

          {/* Results overlay + next button */}
          {results && (
            <div className="mt-6 text-center animate-fadeIn">
              <div className="text-xs text-[var(--text-muted)] mb-3">
                {currentQuestion.total_votes + 1} votes on this question
              </div>
              <button
                onClick={nextQuestion}
                className="px-8 py-3 bg-[var(--accent-tactical)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Next Question →
              </button>
            </div>
          )}
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
}: {
  options: Option[];
  results: VoteResult[] | null;
  chosenId: number | null;
  onVote: (id: number) => void;
  optionCount: number;
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
              <div className="aspect-[3/4] bg-[var(--bg-elevated)] flex items-center justify-center relative">
                {opt.image_url ? (
                  <img
                    src={opt.image_url}
                    alt={opt.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-3xl sm:text-4xl font-bold text-[var(--text-muted)]">
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

              {/* Label */}
              <div className="p-3">
                <div className="font-semibold text-sm truncate">{opt.label}</div>
                {opt.subtitle && (
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{opt.subtitle}</div>
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
