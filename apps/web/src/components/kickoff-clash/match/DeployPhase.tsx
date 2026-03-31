'use client';

import { useMemo } from 'react';
import type { MatchV5State, AttackDefenceSplit } from '../../../lib/kickoff-clash/match-v5';
import { evaluateSplit } from '../../../lib/kickoff-clash/match-v5';
import type { Formation } from '../../../lib/kickoff-clash/formations';
import type { JokerCard } from '../../../lib/kickoff-clash/jokers';
import type { TacticSlots } from '../../../lib/kickoff-clash/tactics';
import type { Card } from '../../../lib/kickoff-clash/scoring';
import PlayerCard from '../PlayerCard';
import SynergyPreview from './SynergyPreview';

interface DeployPhaseProps {
  matchState: MatchV5State;
  formation: Formation;
  jokers: JokerCard[];
  tacticSlots: TacticSlots;
  onToggleAttacker: (cardId: number) => void;
  onKickOff: () => void;
}

export default function DeployPhase({
  matchState,
  formation,
  jokers,
  tacticSlots,
  onToggleAttacker,
  onKickOff,
}: DeployPhaseProps) {
  // Live preview: evaluate current split
  const split: AttackDefenceSplit = useMemo(
    () => evaluateSplit(matchState, jokers, tacticSlots),
    [matchState, jokers, tacticSlots],
  );

  const { xi, attackerIds } = matchState;
  const maxAtk = formation.maxAttackers;
  const atkCount = attackerIds.size;
  const overCap = atkCount > maxAtk;

  // Sort attackers by power desc to determine which are diminished
  const sortedAttackerIds = useMemo(() => {
    const attackers = xi
      .filter((c) => attackerIds.has(c.id))
      .sort((a, b) => b.power - a.power);
    return new Set(attackers.slice(maxAtk).map((c) => c.id));
  }, [xi, attackerIds, maxAtk]);

  // Group XI into attackers (top) and defenders (bottom)
  const attackers = xi.filter((c) => attackerIds.has(c.id));
  const defenders = xi.filter((c) => !attackerIds.has(c.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Synergy preview */}
      <SynergyPreview
        attackSynergies={split.attackSynergies}
        defenceSynergies={split.defenceSynergies}
        crossSynergies={split.crossSynergies}
      />

      {/* Score preview + cap indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          padding: '4px 10px',
          flexShrink: 0,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>ATK</div>
          <div
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 20,
              color: '#fbbf24',
            }}
          >
            {split.attackScore}
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: overCap ? '#ef4444' : 'var(--dust, #8a7560)',
            fontWeight: overCap ? 700 : 400,
            textAlign: 'center',
          }}
        >
          {atkCount}/{maxAtk} attackers
          {overCap && <div style={{ fontSize: 9, color: '#ef4444' }}>diminished!</div>}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>DEF</div>
          <div
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 20,
              color: '#60a5fa',
            }}
          >
            {split.defenceScore}
          </div>
        </div>
      </div>

      {/* Attack zone */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          gap: 2,
        }}
      >
        {/* Attack zone label */}
        {attackers.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#fbbf24',
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: '2px 0',
            }}
          >
            Attack
          </div>
        )}

        {/* Attacker cards */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 4,
            padding: '0 4px',
          }}
        >
          {attackers.map((card) => (
            <PlayerCard
              key={card.id}
              card={card}
              size="pill"
              assignment="attacking"
              diminished={sortedAttackerIds.has(card.id)}
              onClick={() => onToggleAttacker(card.id)}
            />
          ))}
        </div>

        {/* Pitch line */}
        <div
          style={{
            height: 1,
            background: 'rgba(245,158,11,0.2)',
            margin: '4px 20px',
          }}
        />

        {/* Defence zone label */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: '#60a5fa',
            letterSpacing: 1,
            textTransform: 'uppercase',
            padding: '2px 0',
          }}
        >
          Defend
        </div>

        {/* Defender cards */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 4,
            padding: '0 4px',
          }}
        >
          {defenders.map((card) => (
            <PlayerCard
              key={card.id}
              card={card}
              size="pill"
              assignment="defending"
              onClick={card.injured ? undefined : () => onToggleAttacker(card.id)}
              dimmed={!!card.injured}
            />
          ))}
        </div>
      </div>

      {/* Kick Off button */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onKickOff}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '12px 0',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#1a1a1a',
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
          }}
        >
          Kick Off
        </button>
      </div>
    </div>
  );
}
