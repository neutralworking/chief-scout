'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RunState } from '../lib/run';
import type {
  HandState,
  IncrementScore,
} from '../lib/hand';
import {
  rollXI,
  discardFromBench,
  makeSub,
  evaluateIncrement,
  advanceIncrement,
  getMatchResult,
  INCREMENT_MINUTES,
} from '../lib/hand';
import {
  deployTactic,
  removeTactic,
  canDeploy,
  type TacticCard as TacticCardType,
} from '../lib/tactics';
import { getFormation, ALL_FORMATIONS, type Formation } from '../lib/formations';
import type { JokerCard as JokerCardType } from '../lib/jokers';
import PlayerCard from './PlayerCard';
import TacticCardComp from './TacticCard';
import JokerCardComp from './JokerCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchPhaseProps {
  runState: RunState;
  onMatchComplete: (result: {
    yourGoals: number;
    opponentGoals: number;
    result: 'win' | 'draw' | 'loss';
    handState: HandState;
  }) => void;
}

type MatchSubPhase = 'planning' | 'resolving' | 'halftime' | 'finished';

// ---------------------------------------------------------------------------
// Opponent generation
// ---------------------------------------------------------------------------

const OPPONENT_NAMES = [
  'Dynamo Midtable', 'FC Relegation', 'Sporting Vibes',
  'Real Farmacia', 'Inter Naptime', 'Borussia Teeth',
  'Red Star Sofa', 'Ajax Dishwash', 'Porto Nap',
];

function getOpponentName(seed: number): string {
  return OPPONENT_NAMES[Math.abs(seed) % OPPONENT_NAMES.length];
}

function getOpponentStrength(round: number, seed: number): number {
  const base = 500 + round * 150;
  const variance = ((seed * 7 + 13) % 200) - 100;
  return Math.max(300, base + variance);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatchPhase({ runState, onMatchComplete }: MatchPhaseProps) {
  const formation = getFormation(runState.activeFormation);
  const seedRef = useRef(runState.seed + runState.round * 1000);

  // Core state
  const [handState, setHandState] = useState<HandState>(() =>
    rollXI(runState.deck, formation, seedRef.current),
  );
  const [subPhase, setSubPhase] = useState<MatchSubPhase>('planning');
  const [currentFormation, setCurrentFormation] = useState<Formation>(formation);

  // UI interaction state
  const [selectedBenchId, setSelectedBenchId] = useState<number | null>(null);
  const [selectedXiId, setSelectedXiId] = useState<number | null>(null);
  const [showTacticPicker, setShowTacticPicker] = useState<number | null>(null); // slot index
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<number | null>(null);

  // Cascade animation state
  const [cascadeLines, setCascadeLines] = useState<string[]>([]);
  const [cascadeVisible, setCascadeVisible] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<IncrementScore | null>(null);

  // Warning text
  const [warning, setWarning] = useState<string | null>(null);

  const opponentName = getOpponentName(seedRef.current);
  const opponentStrength = getOpponentStrength(runState.round, seedRef.current);

  // ---- Clear warning after timeout ----
  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 2000);
    return () => clearTimeout(t);
  }, [warning]);

  // ---- Sub logic: tap bench then XI ----
  const handleBenchTap = useCallback(
    (cardId: number) => {
      if (subPhase !== 'planning' && subPhase !== 'halftime') return;

      // If same card tapped again, deselect
      if (selectedBenchId === cardId) {
        setSelectedBenchId(null);
        setShowDiscardConfirm(null);
        return;
      }

      // If an XI card is already selected, make a sub
      if (selectedXiId !== null) {
        const result = makeSub(handState, selectedXiId, cardId);
        if (result !== handState) {
          setHandState(result);
          setSelectedXiId(null);
          setSelectedBenchId(null);
        } else {
          setWarning(handState.isFirstHalf ? 'First half: only injured players can be subbed' : 'Cannot make this sub');
        }
        return;
      }

      setSelectedBenchId(cardId);
      setShowDiscardConfirm(cardId);
      setSelectedXiId(null);
    },
    [subPhase, selectedBenchId, selectedXiId, handState],
  );

  const handleXiTap = useCallback(
    (cardId: number) => {
      if (subPhase !== 'planning' && subPhase !== 'halftime') return;

      // If a bench card is selected, make a sub
      if (selectedBenchId !== null) {
        const result = makeSub(handState, cardId, selectedBenchId);
        if (result !== handState) {
          setHandState(result);
          setSelectedBenchId(null);
          setSelectedXiId(null);
          setShowDiscardConfirm(null);
        } else {
          setWarning(handState.isFirstHalf ? 'First half: only injured players can be subbed' : 'Cannot make this sub');
        }
        return;
      }

      setSelectedXiId(selectedXiId === cardId ? null : cardId);
      setSelectedBenchId(null);
      setShowDiscardConfirm(null);
    },
    [subPhase, selectedBenchId, selectedXiId, handState],
  );

  // ---- Discard from bench ----
  const handleDiscard = useCallback(
    (cardId: number) => {
      const seed = seedRef.current + handState.currentIncrement * 97 + cardId;
      setHandState(prev => discardFromBench(prev, cardId, seed));
      setShowDiscardConfirm(null);
      setSelectedBenchId(null);
    },
    [handState.currentIncrement],
  );

  // ---- Tactic deployment ----
  const handleTacticSlotTap = useCallback(
    (slotIdx: number) => {
      if (subPhase !== 'planning' && subPhase !== 'halftime') return;
      const current = handState.tacticSlots.slots[slotIdx];
      if (current) {
        // Remove deployed tactic
        setHandState(prev => ({
          ...prev,
          tacticSlots: removeTactic(prev.tacticSlots, slotIdx),
        }));
        return;
      }
      setShowTacticPicker(slotIdx);
    },
    [subPhase, handState.tacticSlots],
  );

  const handleDeployTactic = useCallback(
    (tactic: TacticCardType, slotIdx: number) => {
      const check = canDeploy(handState.tacticSlots, tactic);
      if (!check.canDeploy) {
        setWarning('Cannot deploy this tactic');
        setShowTacticPicker(null);
        return;
      }
      if (check.wouldRemove) {
        setWarning(`Removed contradicting tactic`);
      }
      setHandState(prev => ({
        ...prev,
        tacticSlots: deployTactic(prev.tacticSlots, tactic, slotIdx),
      }));
      setShowTacticPicker(null);
    },
    [handState.tacticSlots],
  );

  // ---- Advance increment ----
  const handleAdvance = useCallback(() => {
    if (subPhase !== 'planning') return;
    setSubPhase('resolving');
    setSelectedBenchId(null);
    setSelectedXiId(null);
    setShowTacticPicker(null);
    setShowDiscardConfirm(null);

    const seed = seedRef.current + handState.currentIncrement * 113;
    const score = evaluateIncrement(
      handState,
      runState.playingStyle,
      runState.jokers,
      opponentStrength,
      seed,
    );

    setCurrentEvent(score);

    // Build cascade lines
    const lines: string[] = [
      `Base: ${score.cascade.basePower}`,
      `+ Chemistry: +${score.cascade.chemistryBonus}`,
      `+ Style: +${score.cascade.styleBonus}`,
      `+ Tactics: +${score.cascade.tacticBonus}`,
      `+ Managers: +${score.cascade.managerBonus}`,
      `= ${Math.round((score.cascade.basePower + score.cascade.chemistryBonus + score.cascade.styleBonus + score.cascade.tacticBonus + score.cascade.managerBonus))} x ${score.cascade.chemistryMultiplier.toFixed(2)}`,
      `= ${score.cascade.total} vs ${score.opponentScore}`,
    ];
    setCascadeLines(lines);
    setCascadeVisible(0);

    // Stagger cascade lines
    lines.forEach((_, i) => {
      setTimeout(() => setCascadeVisible(i + 1), (i + 1) * 400);
    });

    // After all lines shown + event, advance
    const totalDelay = (lines.length + 1) * 400 + 1500;
    setTimeout(() => {
      const advanced = advanceIncrement(handState, score);
      setHandState(advanced);

      // Determine next phase
      if (handState.currentIncrement === 1) {
        // Just played 30' -> halftime
        setSubPhase('halftime');
      } else if (handState.currentIncrement === 4) {
        // Just played 90' -> finished
        setSubPhase('finished');
      } else {
        setSubPhase('planning');
      }

      setCascadeLines([]);
      setCascadeVisible(0);
      setCurrentEvent(null);
    }, totalDelay);
  }, [subPhase, handState, runState.playingStyle, runState.jokers, opponentStrength]);

  // ---- Halftime: resume ----
  const handleSecondHalf = useCallback(() => {
    setSubPhase('planning');
  }, []);

  // ---- Halftime: formation change ----
  const handleFormationChange = useCallback(
    (formationId: string) => {
      const newFormation = getFormation(formationId);
      setCurrentFormation(newFormation);
      // Re-map XI cards to new formation slots (keep same cards, just reorder)
      // The slot positions change but cards stay in xi array
    },
    [],
  );

  // ---- Finished: continue ----
  const handleContinue = useCallback(() => {
    const result = getMatchResult(handState);
    onMatchComplete({
      yourGoals: result.yourGoals,
      opponentGoals: result.opponentGoals,
      result: result.result,
      handState: result.handState,
    });
  }, [handState, onMatchComplete]);

  // ---- Group XI cards by formation rows ----
  const formationRows = groupByRows(currentFormation, handState.xi);

  const nextMinute =
    handState.currentIncrement < INCREMENT_MINUTES.length
      ? INCREMENT_MINUTES[handState.currentIncrement]
      : 90;

  // ---- Render ----
  return (
    <div
      style={{
        maxWidth: 430,
        margin: '0 auto',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--felt, #1a3a1a)',
        fontFamily: '"DM Sans", sans-serif',
        color: 'var(--cream, #f5f0e8)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ---- Joker row ---- */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.25)',
          minHeight: 40,
          alignItems: 'center',
          overflowX: 'auto',
        }}
      >
        {runState.jokers.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--dust, #8a7560)' }}>
            No managers active
          </span>
        )}
        {runState.jokers.map(j => (
          <JokerCardComp key={j.id} joker={j} compact />
        ))}
      </div>

      {/* ---- Match bar ---- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, var(--leather, #3d2b1f), #2a1e15)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 36,
              color: 'var(--cream, #f5f0e8)',
              lineHeight: 1,
            }}
          >
            {handState.yourGoals}
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'var(--dust, #8a7560)',
              fontWeight: 600,
            }}
          >
            -
          </span>
          <span
            style={{
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 36,
              color: 'var(--cream, #f5f0e8)',
              lineHeight: 1,
            }}
          >
            {handState.opponentGoals}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--amber, #f59e0b)',
              color: '#1a1a1a',
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 13,
              borderRadius: 6,
              padding: '2px 8px',
              animation: subPhase === 'resolving' ? 'pulse 1s infinite' : undefined,
            }}
          >
            {nextMinute}&apos;
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--dust, #8a7560)', marginTop: 2 }}>
          vs {opponentName} &middot; Round {runState.round}/5
        </span>
      </div>

      {/* ---- Tactic slots ---- */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 10px',
          justifyContent: 'center',
          minHeight: 50,
          alignItems: 'center',
        }}
      >
        {handState.tacticSlots.slots.map((slot, i) => (
          <div key={i}>
            {slot ? (
              <TacticCardComp
                tactic={slot}
                deployed
                compact
                onClick={() => handleTacticSlotTap(i)}
              />
            ) : (
              <button
                onClick={() => handleTacticSlotTap(i)}
                disabled={subPhase === 'resolving' || subPhase === 'finished'}
                style={{
                  width: 120,
                  height: 42,
                  borderRadius: 6,
                  border: '1.5px dashed var(--dust, #8a7560)',
                  background: 'rgba(0,0,0,0.15)',
                  color: 'var(--dust, #8a7560)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >
                + Tactic
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ---- Tactic picker overlay ---- */}
      {showTacticPicker !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 14,
              color: 'var(--cream, #f5f0e8)',
              marginBottom: 8,
            }}
          >
            Deploy a Tactic
          </span>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {runState.tacticsDeck.map(t => {
              const check = canDeploy(handState.tacticSlots, t);
              return (
                <TacticCardComp
                  key={t.id}
                  tactic={t}
                  compact
                  contradicted={!check.canDeploy}
                  onClick={
                    check.canDeploy
                      ? () => handleDeployTactic(t, showTacticPicker)
                      : undefined
                  }
                />
              );
            })}
          </div>
          <button
            onClick={() => setShowTacticPicker(null)}
            style={{
              marginTop: 12,
              padding: '6px 20px',
              borderRadius: 6,
              border: '1px solid var(--dust, #8a7560)',
              background: 'transparent',
              color: 'var(--cream, #f5f0e8)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: '"DM Sans", sans-serif',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ---- XI display ---- */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 4px',
          minHeight: 200,
        }}
      >
        {formationRows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {row.map(card => (
              <div key={card.id} style={{ position: 'relative' }}>
                <PlayerCard
                  card={card}
                  size="mini"
                  onClick={() => handleXiTap(card.id)}
                  selected={selectedXiId === card.id}
                  dimmed={!!card.injured}
                />
                {card.injured && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(239, 68, 68, 0.25)',
                      borderRadius: 10,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>&#x1F3E5;</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ---- Cascade / event display ---- */}
      {(subPhase === 'resolving' || cascadeLines.length > 0) && currentEvent && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 8,
            margin: '0 10px',
            minHeight: 100,
          }}
        >
          {cascadeLines.map((line, i) => (
            <div
              key={i}
              style={{
                opacity: i < cascadeVisible ? 1 : 0,
                transition: 'opacity 0.3s ease',
                fontSize: 12,
                lineHeight: 1.8,
                fontFamily: line.startsWith('Base') || line.startsWith('=')
                  ? '"Archivo Black", sans-serif'
                  : '"DM Sans", sans-serif',
                color: line.includes('Chemistry')
                  ? '#f59e0b'
                  : line.includes('Style')
                    ? '#22c55e'
                    : line.includes('Tactics')
                      ? '#4a9eff'
                      : line.includes('Managers')
                        ? '#a855f7'
                        : 'var(--cream, #f5f0e8)',
              }}
            >
              {line}
            </div>
          ))}

          {/* Event line — shown after all cascade lines */}
          {cascadeVisible >= cascadeLines.length && cascadeLines.length > 0 && (
            <div
              style={{
                marginTop: 8,
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: 14,
                fontWeight: 600,
                color:
                  currentEvent.event.type === 'goal-yours'
                    ? 'var(--amber, #f59e0b)'
                    : currentEvent.event.type === 'goal-opponent'
                      ? '#ef4444'
                      : 'var(--dust, #8a7560)',
              }}
            >
              {currentEvent.event.minute}&apos; &mdash;{' '}
              {currentEvent.event.type === 'goal-yours' && 'GOAL! '}
              {currentEvent.event.type === 'goal-opponent' && 'They score. '}
              {currentEvent.event.text}
            </div>
          )}
        </div>
      )}

      {/* ---- Warning ---- */}
      {warning && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: '#ef4444',
            padding: '4px 0',
          }}
        >
          {warning}
        </div>
      )}

      {/* ---- Bench ---- */}
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid rgba(245,158,11,0.15)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--dust, #8a7560)',
            marginBottom: 4,
          }}
        >
          <span>Bench</span>
          <span>Deck: {handState.remainingDeck.length} remaining</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {handState.bench.map(card => (
            <div key={card.id} style={{ position: 'relative', flexShrink: 0 }}>
              <PlayerCard
                card={card}
                size="mini"
                onClick={() => handleBenchTap(card.id)}
                selected={selectedBenchId === card.id}
              />
              {showDiscardConfirm === card.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDiscard(card.id);
                  }}
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #ef4444',
                    background: 'rgba(239,68,68,0.2)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  Discard
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Action bar ---- */}
      <div
        style={{
          padding: '8px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)',
        }}
      >
        {subPhase === 'planning' && (
          <button
            onClick={handleAdvance}
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '12px 0',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#1a1a1a',
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
            }}
          >
            Advance to {nextMinute}&apos;
          </button>
        )}

        {subPhase === 'resolving' && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--amber, #f59e0b)',
              fontFamily: '"Archivo Black", sans-serif',
              padding: '12px 0',
            }}
          >
            Resolving...
          </div>
        )}

        {subPhase === 'halftime' && (
          <>
            {/* Formation selector */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--dust, #8a7560)' }}>
                Formation:
              </span>
              <select
                value={currentFormation.id}
                onChange={(e) => handleFormationChange(e.target.value)}
                style={{
                  background: 'var(--leather, #3d2b1f)',
                  color: 'var(--cream, #f5f0e8)',
                  border: '1px solid var(--dust, #8a7560)',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 12,
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >
                {runState.ownedFormations.map(fId => {
                  const f = ALL_FORMATIONS.find(fm => fm.id === fId);
                  return f ? (
                    <option key={fId} value={fId}>
                      {f.name}
                    </option>
                  ) : null;
                })}
              </select>
            </div>

            <button
              onClick={handleSecondHalf}
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '12px 0',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#1a1a1a',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
              }}
            >
              Second Half &rarr;
            </button>
          </>
        )}

        {subPhase === 'finished' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 18,
                color: 'var(--cream, #f5f0e8)',
                marginBottom: 4,
              }}
            >
              FULL TIME
            </div>
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 40,
                color: 'var(--cream, #f5f0e8)',
                lineHeight: 1,
              }}
            >
              {handState.yourGoals} - {handState.opponentGoals}
            </div>
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 16,
                marginTop: 6,
                color:
                  handState.yourGoals > handState.opponentGoals
                    ? '#22c55e'
                    : handState.yourGoals < handState.opponentGoals
                      ? '#ef4444'
                      : '#f59e0b',
              }}
            >
              {handState.yourGoals > handState.opponentGoals
                ? 'WIN'
                : handState.yourGoals < handState.opponentGoals
                  ? 'LOSS'
                  : 'DRAW'}
            </div>
            <button
              onClick={handleContinue}
              style={{
                marginTop: 12,
                width: '100%',
                maxWidth: 320,
                padding: '12px 0',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#1a1a1a',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Subs remaining */}
        {subPhase !== 'finished' && (
          <span style={{ fontSize: 10, color: 'var(--dust, #8a7560)' }}>
            Subs: {handState.subsRemaining} remaining
          </span>
        )}
      </div>

      {/* ---- Halftime overlay ---- */}
      {subPhase === 'halftime' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            padding: '16px 0 32px',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 24,
              color: 'var(--amber, #f59e0b)',
            }}
          >
            HALF TIME
          </span>
        </div>
      )}

      {/* ---- Pulse animation ---- */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group XI cards into display rows based on formation slot y-coordinates.
 * Rows sorted top (attack) to bottom (GK).
 */
function groupByRows(formation: Formation, xi: import('../lib/scoring').Card[]): import('../lib/scoring').Card[][] {
  if (xi.length === 0) return [];

  // Pair each card with its slot's y value
  const pairs = xi.map((card, i) => ({
    card,
    y: formation.slots[i]?.y ?? 50,
    x: formation.slots[i]?.x ?? 50,
  }));

  // Group by approximate y (within 10 units = same row)
  const rows: { y: number; cards: { card: typeof pairs[0]['card']; x: number }[] }[] = [];
  for (const p of pairs) {
    const existing = rows.find(r => Math.abs(r.y - p.y) <= 10);
    if (existing) {
      existing.cards.push({ card: p.card, x: p.x });
    } else {
      rows.push({ y: p.y, cards: [{ card: p.card, x: p.x }] });
    }
  }

  // Sort rows: lowest y first (attackers at top)
  rows.sort((a, b) => a.y - b.y);

  // Sort cards within each row by x
  return rows.map(r => {
    r.cards.sort((a, b) => a.x - b.x);
    return r.cards.map(c => c.card);
  });
}
