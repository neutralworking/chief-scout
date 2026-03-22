'use client';

import { useState } from 'react';
import { PLAYING_STYLES } from '../lib/scoring';

interface SetupPhaseProps {
  onStart: (formation: string, style: string) => void;
}

const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2'] as const;

export default function SetupPhase({ onStart }: SetupPhaseProps) {
  const [formation, setFormation] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);

  return (
    <div
      className="phase-setup flex flex-col items-center justify-center min-h-screen text-center px-6 py-10"
    >
      {/* Title */}
      <h1
        className="text-4xl uppercase tracking-tight mb-10"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)' }}
      >
        New Season
      </h1>

      {/* Formation picker */}
      <div className="mb-8 w-full max-w-md">
        <h3
          className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
          style={{ color: 'var(--dust)' }}
        >
          Formation
        </h3>
        <div className="flex gap-3 justify-center">
          {FORMATIONS.map(f => {
            const selected = formation === f;
            return (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className="px-6 py-4 rounded-[var(--radius)] font-bold text-lg transition-all hover:scale-[1.03]"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: selected
                    ? 'rgba(232,98,26,0.15)'
                    : 'var(--leather)',
                  border: `2px solid ${selected ? 'var(--amber)' : 'rgba(154,139,115,0.2)'}`,
                  color: selected ? 'var(--amber)' : 'var(--cream-soft)',
                  boxShadow: selected ? '0 0 16px var(--amber-glow)' : 'none',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style picker */}
      <div className="mb-10 w-full max-w-xl">
        <h3
          className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
          style={{ color: 'var(--dust)' }}
        >
          Playing Style
        </h3>
        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(PLAYING_STYLES).map(([key, ps]) => {
            const selected = style === key;
            return (
              <button
                key={key}
                onClick={() => setStyle(key)}
                className="px-4 py-3 rounded-[var(--radius)] text-left min-w-[160px] transition-all hover:scale-[1.02]"
                style={{
                  background: selected
                    ? 'rgba(232,98,26,0.12)'
                    : 'var(--leather)',
                  border: `2px solid ${selected ? 'var(--amber)' : 'rgba(154,139,115,0.2)'}`,
                  boxShadow: selected ? '0 0 12px var(--amber-glow)' : 'none',
                }}
              >
                <div
                  className="font-bold text-sm"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: selected ? 'var(--amber)' : 'var(--cream)',
                  }}
                >
                  {ps.name}
                </div>
                {ps.bonusArchetypes.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ps.bonusArchetypes.map(arch => (
                      <span
                        key={arch}
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{
                          background: 'rgba(212,160,53,0.15)',
                          color: 'var(--gold)',
                          border: '1px solid rgba(212,160,53,0.25)',
                        }}
                      >
                        {arch}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-[10px] mt-1"
                    style={{ color: 'var(--dust)' }}
                  >
                    +{(ps.multiplier * 100).toFixed(0)}% flat per card
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start button */}
      <button
        disabled={!formation || !style}
        onClick={() => formation && style && onStart(formation, style)}
        className="px-10 py-4 rounded-[var(--radius)] text-lg uppercase tracking-wide transition-all hover:scale-[1.03] active:scale-95"
        style={{
          fontFamily: 'var(--font-display)',
          background: formation && style
            ? 'linear-gradient(135deg, var(--amber), var(--amber-soft))'
            : 'var(--leather)',
          color: formation && style ? 'var(--cream)' : 'var(--ink)',
          boxShadow: formation && style ? '0 4px 20px var(--amber-glow)' : 'none',
          cursor: formation && style ? 'pointer' : 'not-allowed',
          opacity: formation && style ? 1 : 0.5,
        }}
      >
        Let&apos;s Go
      </button>
    </div>
  );
}
