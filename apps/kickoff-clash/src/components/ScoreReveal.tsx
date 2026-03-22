'use client';
import { useState, useEffect, useMemo } from 'react';
import type { HandScore, MatchOutcome } from '../lib/hand';
import { resolveMatch } from '../lib/hand';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScoreRevealProps {
  handScore: HandScore;
  opponentName: string;
  opponentStrength: number;
  seed: number;
  onComplete: (outcome: MatchOutcome) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useCountUp(target: number, active: boolean, durationMs = 1400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const steps = 40;
    const stepMs = durationMs / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      const t = step / steps;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (step >= steps) {
        setValue(target);
        clearInterval(id);
      }
    }, stepMs);
    return () => clearInterval(id);
  }, [target, active, durationMs]);

  return value;
}

// ---------------------------------------------------------------------------
// Phase 1: Strength comparison bar
// ---------------------------------------------------------------------------

function StrengthBar({
  label,
  value,
  max,
  active,
  align,
}: {
  label: string;
  value: number;
  max: number;
  active: boolean;
  align: 'left' | 'right';
}) {
  const displayValue = useCountUp(value, active);
  const pct = max > 0 ? Math.round((displayValue / max) * 100) : 0;

  const isLeft = align === 'left';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-end' : 'flex-start', gap: 6 }}>
      <span style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--dust)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 38,
        color: isLeft ? 'var(--amber)' : 'var(--cream-soft)',
        lineHeight: 1,
      }}>
        {displayValue}
      </span>
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isLeft
            ? 'linear-gradient(90deg, var(--amber-soft), var(--amber))'
            : 'linear-gradient(90deg, var(--dust), var(--cream-soft))',
          borderRadius: 3,
          transition: 'width 0.05s linear',
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2: Match event row
// ---------------------------------------------------------------------------

function EventRow({
  minute,
  text,
  type,
  yourScore,
  oppScore,
  visible,
}: {
  minute: number;
  text: string;
  type: 'goal-yours' | 'goal-opponent' | 'chance' | 'save';
  yourScore: number;
  oppScore: number;
  visible: boolean;
}) {
  const isYourGoal = type === 'goal-yours';
  const isOppGoal = type === 'goal-opponent';

  const rowStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 0.4s ease, transform 0.4s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const textStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    fontSize: isYourGoal ? 16 : 13,
    fontFamily: isYourGoal ? 'var(--font-display)' : 'var(--font-body)',
    fontStyle: isOppGoal ? 'italic' : 'normal',
    color: isYourGoal
      ? 'var(--amber)'
      : isOppGoal
      ? '#e05555'
      : 'var(--cream-soft)',
    textShadow: isYourGoal ? '0 0 14px var(--amber-glow)' : 'none',
  };

  const minuteStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--dust)',
    minWidth: 28,
    flexShrink: 0,
  };

  const scoreStyle: React.CSSProperties = {
    marginLeft: 'auto',
    fontSize: 12,
    fontFamily: 'var(--font-display)',
    color: isYourGoal ? 'var(--amber)' : isOppGoal ? '#e05555' : 'var(--ink)',
    flexShrink: 0,
  };

  return (
    <div style={rowStyle}>
      <div style={textStyle}>
        <span style={minuteStyle}>{minute}&apos;</span>
        <span style={{ flex: 1 }}>{text}</span>
        {(isYourGoal || isOppGoal) && (
          <span style={scoreStyle}>{yourScore}–{oppScore}</span>
        )}
      </div>
      {isYourGoal && (
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--amber), transparent)',
          borderRadius: 1,
          marginLeft: 36,
          opacity: 0.6,
        }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScoreReveal({
  handScore,
  opponentName,
  opponentStrength,
  seed,
  onComplete,
}: ScoreRevealProps) {
  const outcome = useMemo(
    () => resolveMatch(handScore, opponentStrength, seed),
    [handScore, opponentStrength, seed],
  );

  // Phase tracking: 0=bars, 1..N=events, N+1=final, N+2=button
  const totalPhases = outcome.events.length + 2; // events + final + button
  const [revealStep, setRevealStep] = useState(0);
  const [barsActive, setBarsActive] = useState(false);

  useEffect(() => {
    // Start bars animation immediately
    const t0 = setTimeout(() => setBarsActive(true), 100);
    // Start event reveals at 2s
    const t1 = setTimeout(() => setRevealStep(1), 2000);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  // Chain event reveals: each event ~1600ms apart
  useEffect(() => {
    if (revealStep === 0) return;

    const eventCount = outcome.events.length;

    if (revealStep <= eventCount) {
      // More events to reveal
      const delay = revealStep < eventCount ? 1600 : 1200;
      const t = setTimeout(() => setRevealStep(s => s + 1), delay);
      return () => clearTimeout(t);
    }

    if (revealStep === eventCount + 1) {
      // Show final result after last event
      const t = setTimeout(() => setRevealStep(s => s + 1), 1800);
      return () => clearTimeout(t);
    }

    // revealStep === eventCount + 2: button phase, nothing to chain
  }, [revealStep, outcome.events.length]);

  const eventCount = outcome.events.length;
  const showFinal = revealStep > eventCount;
  const showButton = revealStep > eventCount + 1;

  // Running score per event
  function scoreAtEvent(idx: number) {
    let yours = 0, opp = 0;
    for (let i = 0; i <= idx; i++) {
      const ev = outcome.events[i];
      if (ev.type === 'goal-yours') yours++;
      else if (ev.type === 'goal-opponent') opp++;
    }
    return { yours, opp };
  }

  const max = Math.max(handScore.totalStrength, opponentStrength, 1);

  const resultWord = outcome.result === 'win' ? 'WIN' : outcome.result === 'loss' ? 'LOSS' : 'DRAW';
  const resultColor =
    outcome.result === 'win' ? 'var(--pitch-light)' :
    outcome.result === 'loss' ? 'var(--danger)' :
    'var(--gold)';
  const resultGlow =
    outcome.result === 'win' ? '0 0 40px rgba(59,165,93,0.6), 0 0 80px rgba(59,165,93,0.2)' :
    outcome.result === 'loss' ? '0 0 40px rgba(192,57,43,0.5), 0 0 80px rgba(192,57,43,0.15)' :
    '0 0 40px rgba(212,160,53,0.5), 0 0 80px rgba(212,160,53,0.15)';

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--felt)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)',
      color: 'var(--cream)',
    }}>

      {/* ── Phase 1: Strength bars ── */}
      <div style={{
        padding: '32px 24px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(45,138,78,0.1) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <StrengthBar
            label="Your Strength"
            value={handScore.totalStrength}
            max={max}
            active={barsActive}
            align="left"
          />
          <span style={{
            fontSize: 13,
            color: 'var(--dust)',
            flexShrink: 0,
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}>
            vs
          </span>
          <StrengthBar
            label={opponentName}
            value={opponentStrength}
            max={max}
            active={barsActive}
            align="right"
          />
        </div>
      </div>

      {/* ── Phase 2: Match events ── */}
      <div style={{
        flex: 1,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        borderBottom: showFinal ? '1px solid rgba(255,255,255,0.06)' : undefined,
      }}>
        {outcome.events.map((ev, idx) => {
          const { yours, opp } = scoreAtEvent(idx);
          return (
            <EventRow
              key={idx}
              minute={ev.minute}
              text={ev.text}
              type={ev.type}
              yourScore={yours}
              oppScore={opp}
              visible={revealStep > idx}
            />
          );
        })}
      </div>

      {/* ── Phase 3: Final result ── */}
      <div style={{
        padding: '28px 24px 32px',
        textAlign: 'center',
        opacity: showFinal ? 1 : 0,
        transform: showFinal ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Full time label */}
        <span style={{
          fontSize: 11,
          letterSpacing: '0.2em',
          color: 'var(--dust)',
          textTransform: 'uppercase',
          fontVariant: 'small-caps',
        }}>
          Full Time
        </span>

        {/* Score */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 56,
          lineHeight: 1,
          color: 'var(--cream)',
          letterSpacing: '-0.02em',
        }}>
          {outcome.yourGoals} <span style={{ color: 'var(--dust)', fontSize: 36 }}>—</span> {outcome.opponentGoals}
        </div>

        {/* Result word */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 48,
          lineHeight: 1,
          color: resultColor,
          textShadow: resultGlow,
          letterSpacing: '0.04em',
        }}>
          {resultWord}
        </div>

        {/* Continue button */}
        <div style={{
          marginTop: 20,
          opacity: showButton ? 1 : 0,
          transform: showButton ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          <button
            onClick={() => onComplete(outcome)}
            style={{
              background: 'linear-gradient(135deg, var(--amber-soft), var(--amber))',
              color: 'var(--felt)',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '14px 40px',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              boxShadow: '0 0 20px var(--amber-glow)',
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
