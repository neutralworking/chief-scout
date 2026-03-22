'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Card } from '../lib/scoring';
import {
  rollXI,
  discardAndDraw,
  evaluateHand,
  type HandState,
  type HandScore,
} from '../lib/hand';
import type { JokerCard } from '../lib/jokers';
import { getExtraDiscards } from '../lib/jokers';
import PlayerCard from './PlayerCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HandPhaseProps {
  deck: Card[];
  formation: string;
  playingStyle: string;
  jokers: JokerCard[];
  opponent: { name: string; baseStrength: number; weaknessArchetype: string };
  seed: number;
  round: number;
  onLockIn: (handScore: HandScore, xi: Card[]) => void;
}

// ---------------------------------------------------------------------------
// Card fan transforms
// ---------------------------------------------------------------------------

const CARD_TRANSFORMS = [
  { rotate: -8, translateY: 8 },
  { rotate: -3, translateY: 2 },
  { rotate: 0, translateY: 0 },
  { rotate: 3, translateY: 2 },
  { rotate: 8, translateY: 8 },
];

// ---------------------------------------------------------------------------
// Synergy tier styles
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<number, { bg: string; color: string; glow?: string }> = {
  1: { bg: 'rgba(113,113,122,0.2)', color: '#9a8b73' },
  2: { bg: 'rgba(74,158,255,0.15)', color: '#4a9eff' },
  3: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  4: { bg: 'rgba(212,160,53,0.2)', color: '#d4a035', glow: '0 0 12px rgba(212,160,53,0.4)' },
};

// ---------------------------------------------------------------------------
// Near-miss detection
// ---------------------------------------------------------------------------

function detectNearMiss(xi: Card[]): string | null {
  // Check archetype pairs: if one archetype appears exactly once, that's 1 away from a pair
  const archetypeCounts = new Map<string, number>();
  for (const c of xi) {
    if (c.archetype) {
      archetypeCounts.set(c.archetype, (archetypeCounts.get(c.archetype) ?? 0) + 1);
    }
  }

  // Check personality themes: if one theme has exactly 2, it's 1 away from resonance (needs 3)
  const themeCounts = new Map<string, number>();
  for (const c of xi) {
    if (c.personalityTheme) {
      themeCounts.set(c.personalityTheme, (themeCounts.get(c.personalityTheme) ?? 0) + 1);
    }
  }

  // Personality resonance near-miss (higher tier, more exciting)
  for (const [theme, count] of themeCounts) {
    if (count === 2) {
      const resonanceNames: Record<string, string> = {
        General: 'Chain of Command',
        Catalyst: 'Chaos Factor',
        Maestro: 'Silk',
        Captain: 'Siege Mentality',
        Professor: 'System Player',
      };
      const name = resonanceNames[theme];
      if (name) return `One more ${theme} unlocks ${name}`;
    }
  }

  // Archetype pair near-miss
  for (const [arch, count] of archetypeCounts) {
    if (count === 1) {
      return `One more ${arch} unlocks a synergy pair`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HandPhase({
  deck,
  formation,
  playingStyle,
  jokers,
  opponent,
  seed,
  round,
  onLockIn,
}: HandPhaseProps) {
  // ---- State ----
  const [handState, setHandState] = useState<HandState>(() =>
    rollXI(deck, formation, seed),
  );
  const [score, setScore] = useState<HandScore>(() =>
    evaluateHand(handState.xi, playingStyle, jokers),
  );
  const [prevConnectionKeys, setPrevConnectionKeys] = useState<Set<string>>(
    () => new Set(score.connections.map((c) => c.key)),
  );
  const [discardSeed, setDiscardSeed] = useState(seed * 71 + round);
  const [flashSynergy, setFlashSynergy] = useState<string | null>(null);
  const [scoreAnim, setScoreAnim] = useState<'up' | 'down' | null>(null);
  const [displayScore, setDisplayScore] = useState(score.totalStrength);
  const animFrameRef = useRef<number | null>(null);

  // Extra discards from jokers
  const extraDiscards = useMemo(() => getExtraDiscards(jokers), [jokers]);

  // Initial hand state includes extra discards
  useEffect(() => {
    if (extraDiscards > 0) {
      setHandState((prev) => ({
        ...prev,
        discardsRemaining: 3 + extraDiscards,
      }));
    }
  }, [extraDiscards]);

  // ---- Score animation ----
  useEffect(() => {
    const target = score.totalStrength;
    const start = displayScore;
    if (start === target) return;

    setScoreAnim(target > start ? 'up' : 'down');

    const diff = target - start;
    const steps = Math.min(Math.abs(diff), 20);
    let step = 0;

    function tick() {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayScore(Math.round(start + diff * eased));
      if (step < steps) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayScore(target);
        setTimeout(() => setScoreAnim(null), 400);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.totalStrength]);

  // ---- Discard handler ----
  const handleDiscard = useCallback(
    (card: Card) => {
      if (handState.discardsRemaining <= 0 || handState.locked) return;

      const nextSeed = discardSeed * 31 + 13;
      setDiscardSeed(nextSeed);

      const newHand = discardAndDraw(handState, card, nextSeed);
      if (newHand === handState) return; // nothing changed

      const newScore = evaluateHand(newHand.xi, playingStyle, jokers);

      // Check for new synergies
      const newKeys = new Set(newScore.connections.map((c) => c.key));
      for (const conn of newScore.connections) {
        if (!prevConnectionKeys.has(conn.key)) {
          // New synergy created
          setFlashSynergy(`${conn.name} +${conn.bonus}`);
          setTimeout(() => setFlashSynergy(null), 2000);
          break;
        }
      }

      setPrevConnectionKeys(newKeys);
      setHandState(newHand);
      setScore(newScore);
    },
    [handState, discardSeed, playingStyle, jokers, prevConnectionKeys],
  );

  // ---- Lock in handler ----
  const handleLockIn = useCallback(() => {
    onLockIn(score, handState.xi);
  }, [onLockIn, score, handState.xi]);

  // ---- Near-miss hint ----
  const nearMiss = useMemo(() => detectNearMiss(handState.xi), [handState.xi]);

  // ---- Has synergies (for pulse effect) ----
  const hasSynergies = score.connections.length > 0;

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ background: 'var(--felt)', color: 'var(--cream)' }}
    >
      {/* ================================================================= */}
      {/* TOP ZONE: Opponent info + Hand Score                              */}
      {/* ================================================================= */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'var(--leather)',
          borderBottom: '1px solid rgba(154,139,115,0.15)',
        }}
      >
        {/* Opponent info */}
        <div className="flex flex-col gap-0.5">
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--cream-soft)' }}
          >
            {opponent.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--dust)' }}>
            Str {opponent.baseStrength} &middot; Weak to{' '}
            <span style={{ color: 'var(--amber)' }}>
              {opponent.weaknessArchetype}
            </span>
          </span>
        </div>

        {/* Score display */}
        <div className="flex flex-col items-end">
          <span
            className="leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              color:
                scoreAnim === 'up'
                  ? 'var(--amber)'
                  : scoreAnim === 'down'
                    ? 'var(--danger)'
                    : 'var(--pitch-light)',
              transition: 'color 0.3s ease',
            }}
          >
            {displayScore}
          </span>
          <span className="text-xs" style={{ color: 'var(--dust)' }}>
            {score.basePower} base &times; {score.multiplier.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MIDDLE ZONE: Card Fan + Synergies                                 */}
      {/* ================================================================= */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-2">
        {/* Synergy flash banner */}
        {flashSynergy && (
          <div
            className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full px-6 py-2"
            style={{
              background: 'linear-gradient(90deg, #d4a035, #e8621a)',
              boxShadow: '0 0 20px rgba(212,160,53,0.5)',
              animation: 'synergyFlash 0.4s ease-out forwards',
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                color: '#f5f0e0',
                whiteSpace: 'nowrap',
              }}
            >
              {flashSynergy}
            </span>
          </div>
        )}

        {/* Card fan */}
        <div
          className="relative flex items-end justify-center"
          style={{ minHeight: 200, paddingTop: 24 }}
        >
          {handState.xi.map((card, i) => {
            const t = CARD_TRANSFORMS[i] ?? CARD_TRANSFORMS[2];
            return (
              <div
                key={card.id}
                className="transition-transform duration-200"
                style={{
                  transform: `rotate(${t.rotate}deg) translateY(${t.translateY}px)`,
                  marginRight: i < handState.xi.length - 1 ? -16 : 0,
                  zIndex: i,
                }}
              >
                <PlayerCard
                  card={card}
                  size="full"
                  onClick={
                    handState.discardsRemaining > 0 && !handState.locked
                      ? () => handleDiscard(card)
                      : undefined
                  }
                  dimmed={handState.discardsRemaining <= 0}
                />
              </div>
            );
          })}
        </div>

        {/* Synergy badges */}
        {score.connections.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {score.connections.map((conn) => {
              const style = TIER_STYLES[conn.tier] ?? TIER_STYLES[1];
              return (
                <span
                  key={conn.key}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{
                    background: style.bg,
                    color: style.color,
                    boxShadow: style.glow ?? 'none',
                  }}
                >
                  &#10003; {conn.name} +{conn.bonus}
                </span>
              );
            })}
          </div>
        )}

        {/* Near-miss hint */}
        {nearMiss && score.connections.length === 0 && (
          <p
            className="mt-3 text-center text-xs italic"
            style={{ color: 'var(--dust)' }}
          >
            {nearMiss}
          </p>
        )}
        {nearMiss && score.connections.length > 0 && (
          <p
            className="mt-2 text-center text-xs italic"
            style={{ color: 'var(--dust)' }}
          >
            {nearMiss}
          </p>
        )}
      </div>

      {/* ================================================================= */}
      {/* BOTTOM ZONE: Discards + Lock In                                   */}
      {/* ================================================================= */}
      <div
        className="flex flex-col items-center gap-4 px-4 pb-6 pt-4"
        style={{
          background: 'var(--leather)',
          borderTop: '1px solid rgba(154,139,115,0.15)',
        }}
      >
        {/* Discard info */}
        {handState.discardsRemaining > 0 ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs" style={{ color: 'var(--dust)' }}>
              Tap a card to discard &amp; redraw
            </span>
            <div className="flex items-center gap-2">
              {/* Discard dots */}
              <div className="flex gap-1">
                {Array.from({ length: handState.discardsRemaining }).map(
                  (_, i) => (
                    <span
                      key={i}
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: 'var(--amber)' }}
                    />
                  ),
                )}
                {Array.from({
                  length:
                    3 + extraDiscards - handState.discardsRemaining,
                }).map((_, i) => (
                  <span
                    key={`used-${i}`}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: 'rgba(154,139,115,0.3)' }}
                  />
                ))}
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--amber)' }}
              >
                {handState.discardsRemaining} discard
                {handState.discardsRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--dust)' }}>
            No discards left
          </span>
        )}

        {/* Lock In button */}
        <button
          onClick={handleLockIn}
          className={`w-full rounded-lg px-6 py-3.5 text-center font-bold transition-all duration-200 ${
            hasSynergies ? 'advance-btn-pulse' : ''
          }`}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: 'var(--cream)',
            background: 'linear-gradient(135deg, var(--amber), var(--amber-soft))',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          LOCK IN
        </button>

        {/* Round indicator */}
        <span className="text-xs" style={{ color: 'var(--dust)', opacity: 0.6 }}>
          Round {round}
        </span>
      </div>

      {/* Synergy flash keyframes */}
      <style>{`
        @keyframes synergyFlash {
          0% { transform: translateX(-50%) scale(0.7); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.05); opacity: 1; }
          100% { transform: translateX(-50%) scale(1.0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
