'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Card, SlottedCard } from '../lib/scoring';
import type { RunState, MatchResult, DurabilityResult } from '../lib/run';
import {
  createRun,
  getOpponentBuild,
  postMatchDurabilityCheck,
  applyDurabilityResults,
  advanceToNextMatch,
  addCardToDeck,
  sellCard,
  upgradeAcademy,
  buyAcademyPlayer,
} from '../lib/run';
import type { HandScore, MatchOutcome } from '../lib/hand';
import type { JokerCard } from '../lib/jokers';
import { rehydrateJokers } from '../lib/jokers';
import { calculateAttendance, getTransferFee } from '../lib/economy';
import { findConnections } from '../lib/chemistry';
import TitleScreen from './TitleScreen';
import SetupPhase from './SetupPhase';
import HandPhase from './HandPhase';
import ScoreReveal from './ScoreReveal';
import PostMatch from './PostMatch';
import ShopPhase from './ShopPhase';
import EndScreen from './EndScreen';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kickoff-clash-v3-run';
const HISTORY_KEY = 'kickoff-clash-v3-history';
const MAX_LOSSES = 3;
const MAX_ROUNDS = 5;

// ---------------------------------------------------------------------------
// Serialization helpers — joker compute functions aren't serializable
// ---------------------------------------------------------------------------

interface SerializedRunState extends Omit<RunState, 'jokers'> {
  jokerIds: string[];
}

function serializeRun(state: RunState): string {
  const { jokers, ...rest } = state;
  const serialized: SerializedRunState = {
    ...rest,
    jokerIds: jokers.map(j => j.id),
  };
  return JSON.stringify(serialized);
}

function deserializeRun(json: string): RunState | null {
  try {
    const parsed = JSON.parse(json) as SerializedRunState;
    const { jokerIds, ...rest } = parsed;
    return {
      ...rest,
      jokers: rehydrateJokers(jokerIds ?? []),
    } as RunState;
  } catch {
    return null;
  }
}

function saveRun(state: RunState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeRun(state));
  } catch {
    // localStorage quota or unavailable — silently fail
  }
}

function loadRun(): RunState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserializeRun(json);
  } catch {
    return null;
  }
}

function clearRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function saveHistory(state: RunState): void {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    existing.push({
      status: state.status,
      wins: state.wins,
      losses: state.losses,
      cash: state.cash,
      rounds: state.round,
      matchHistory: state.matchHistory,
      timestamp: Date.now(),
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

type Phase = 'title' | 'setup' | 'hand' | 'scoring' | 'postmatch' | 'shop' | 'end';

function phaseFromStatus(status: RunState['status']): Phase {
  if (status === 'won' || status === 'lost') return 'end';
  return status as Phase;
}

// ---------------------------------------------------------------------------
// GameShell
// ---------------------------------------------------------------------------

export default function GameShell() {
  const [runState, setRunState] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const [handScore, setHandScore] = useState<HandScore | null>(null);
  const [matchOutcome, setMatchOutcome] = useState<MatchOutcome | null>(null);
  const [matchXI, setMatchXI] = useState<Card[]>([]);
  const [hasExistingRun, setHasExistingRun] = useState(false);
  const [durabilityResult, setDurabilityResult] = useState<DurabilityResult | null>(null);
  const [lastMatchResult, setLastMatchResult] = useState<MatchResult | null>(null);

  // Check for existing run on mount
  useEffect(() => {
    const existing = loadRun();
    setHasExistingRun(existing !== null);
  }, []);

  // Persist state after every change
  useEffect(() => {
    if (runState) {
      saveRun(runState);
    }
  }, [runState]);

  // =========================================================================
  // Phase handlers
  // =========================================================================

  // --- Title ---
  const handleNewRun = useCallback(() => {
    clearRun();
    setRunState(null);
    setPhase('setup');
  }, []);

  const handleContinue = useCallback(() => {
    const existing = loadRun();
    if (existing) {
      setRunState(existing);
      setPhase(phaseFromStatus(existing.status));
    }
  }, []);

  // --- Setup ---
  const handleStart = useCallback((formation: string, style: string) => {
    const run = createRun(formation, style);
    setRunState(run);
    setPhase('hand');
  }, []);

  // --- Hand ---
  const handleLockIn = useCallback((score: HandScore, xi: Card[]) => {
    setHandScore(score);
    setMatchXI(xi);
    setPhase('scoring');
  }, []);

  // --- Scoring ---
  const handleScoreComplete = useCallback((outcome: MatchOutcome) => {
    if (!runState || !handScore) return;

    setMatchOutcome(outcome);

    // Convert Card[] xi to SlottedCard[] for attendance + durability
    const slottedXI: SlottedCard[] = matchXI.map((card, i) => ({
      card,
      slot: `slot_${i}`,
    }));

    // Calculate connections for attendance
    const connections = findConnections(slottedXI);

    // Calculate attendance
    const attendanceResult = calculateAttendance(
      slottedXI,
      connections,
      outcome.yourGoals,
      outcome.opponentGoals,
      0, // actionFanAccumulator
      runState.stadiumTier,
      runState.ticketPriceBonus,
    );

    // Build match result
    const opponent = getOpponentBuild(runState.round);
    const matchResult: MatchResult = {
      round: runState.round,
      opponentName: opponent.name,
      yourGoals: outcome.yourGoals,
      opponentGoals: outcome.opponentGoals,
      attendance: attendanceResult.attendance,
      revenue: attendanceResult.revenue,
      result: outcome.result,
      synergiesTriggered: handScore.connections.map(c => c.name),
      shattered: [],
      injured: [],
      promoted: [],
    };

    // Durability check
    const durResult = postMatchDurabilityCheck(slottedXI, runState.seed + runState.round * 777);
    setDurabilityResult(durResult);

    // Update match result with durability info
    matchResult.shattered = durResult.shattered.map(c => c.name);
    matchResult.injured = durResult.injured.map(c => c.name);
    matchResult.promoted = durResult.promoted.map(c => c.name);

    setLastMatchResult(matchResult);

    // Apply durability to deck
    const updatedDeck = applyDurabilityResults(runState.deck, durResult);

    // Update run state
    const newWins = runState.wins + (outcome.result === 'win' ? 1 : 0);
    const newLosses = runState.losses + (outcome.result === 'loss' ? 1 : 0);

    setRunState({
      ...runState,
      deck: updatedDeck,
      cash: runState.cash + attendanceResult.revenue,
      wins: newWins,
      losses: newLosses,
      matchHistory: [...runState.matchHistory, matchResult],
      status: 'postmatch',
    });

    setPhase('postmatch');
  }, [runState, handScore, matchXI]);

  // --- Post Match ---
  const handlePostMatchContinue = useCallback(() => {
    if (!runState) return;

    if (runState.losses >= MAX_LOSSES) {
      setRunState(prev => {
        if (!prev) return prev;
        const ended = { ...prev, status: 'lost' as const };
        saveHistory(ended);
        clearRun();
        return ended;
      });
      setPhase('end');
    } else if (runState.round >= MAX_ROUNDS) {
      setRunState(prev => {
        if (!prev) return prev;
        const ended = { ...prev, status: 'won' as const };
        saveHistory(ended);
        clearRun();
        return ended;
      });
      setPhase('end');
    } else {
      setRunState(prev => prev ? { ...prev, status: 'shop' as const } : prev);
      setPhase('shop');
    }
  }, [runState]);

  // --- Shop handlers ---
  const handleBuyCard = useCallback((card: Card, cost: number) => {
    setRunState(prev => {
      if (!prev || prev.cash < cost) return prev;
      const withCard = addCardToDeck(prev, card);
      return { ...withCard, cash: withCard.cash - cost };
    });
  }, []);

  const handleSellCard = useCallback((card: Card) => {
    setRunState(prev => {
      if (!prev) return prev;
      return sellCard(prev, card);
    });
  }, []);

  const handleBuyJoker = useCallback((joker: JokerCard) => {
    setRunState(prev => {
      if (!prev || prev.jokers.length >= 3 || prev.cash < 25_000) return prev;
      return {
        ...prev,
        jokers: [...prev.jokers, joker],
        cash: prev.cash - 25_000,
      };
    });
  }, []);

  const handleBuyAcademy = useCallback((card: Card) => {
    setRunState(prev => {
      if (!prev) return prev;
      const result = buyAcademyPlayer(prev, card);
      return result ?? prev;
    });
  }, []);

  const handleUpgradeAcademy = useCallback(() => {
    setRunState(prev => {
      if (!prev) return prev;
      const result = upgradeAcademy(prev);
      return result ?? prev;
    });
  }, []);

  const handleShopNext = useCallback(() => {
    setRunState(prev => {
      if (!prev) return prev;
      return advanceToNextMatch(prev);
    });
    setPhase('hand');
  }, []);

  // --- End ---
  const handleEndNewRun = useCallback(() => {
    clearRun();
    setRunState(null);
    setHandScore(null);
    setMatchOutcome(null);
    setMatchXI([]);
    setDurabilityResult(null);
    setLastMatchResult(null);
    setHasExistingRun(false);
    setPhase('title');
  }, []);

  // =========================================================================
  // Render
  // =========================================================================

  switch (phase) {
    case 'title':
      return (
        <TitleScreen
          onNewRun={handleNewRun}
          onContinue={handleContinue}
          hasExistingRun={hasExistingRun}
        />
      );

    case 'setup':
      return <SetupPhase onStart={handleStart} />;

    case 'hand': {
      if (!runState) return null;
      const opponent = getOpponentBuild(runState.round);
      const matchSeed = runState.seed + runState.round * 1000;
      return (
        <HandPhase
          deck={runState.deck}
          formation={runState.formation}
          playingStyle={runState.playingStyle}
          jokers={runState.jokers}
          opponent={{
            name: opponent.name,
            baseStrength: opponent.baseStrength,
            weaknessArchetype: opponent.weaknessArchetype,
          }}
          seed={matchSeed}
          round={runState.round}
          onLockIn={handleLockIn}
        />
      );
    }

    case 'scoring': {
      if (!handScore || !runState) return null;
      const scoringOpponent = getOpponentBuild(runState.round);
      const scoringSeed = runState.seed + runState.round * 1000 + 500;
      return (
        <ScoreReveal
          handScore={handScore}
          opponentName={scoringOpponent.name}
          opponentStrength={scoringOpponent.baseStrength}
          seed={scoringSeed}
          onComplete={handleScoreComplete}
        />
      );
    }

    case 'postmatch': {
      if (!lastMatchResult || !durabilityResult) return null;
      return (
        <PostMatch
          matchResult={lastMatchResult}
          durabilityResult={durabilityResult}
          onContinue={handlePostMatchContinue}
        />
      );
    }

    case 'shop': {
      if (!runState) return null;
      const shopSeed = runState.seed + runState.round * 500 + 333;
      return (
        <ShopPhase
          state={runState}
          onBuyCard={handleBuyCard}
          onSellCard={handleSellCard}
          onBuyJoker={handleBuyJoker}
          onBuyAcademy={handleBuyAcademy}
          onUpgradeAcademy={handleUpgradeAcademy}
          onNext={handleShopNext}
          shopSeed={shopSeed}
        />
      );
    }

    case 'end': {
      if (!runState) return null;
      return (
        <EndScreen
          state={runState}
          onNewRun={handleEndNewRun}
        />
      );
    }

    default:
      return null;
  }
}
