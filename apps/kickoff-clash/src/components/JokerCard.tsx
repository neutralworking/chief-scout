'use client';

import type { JokerCard as JokerCardType } from '../lib/jokers';

const RARITY_BORDER: Record<string, string> = {
  common: '#71717a',
  uncommon: '#4a9eff',
  rare: '#d4a035',
};

interface JokerCardProps {
  joker: JokerCardType;
  onClick?: () => void;
  compact?: boolean;
}

export default function JokerCard({ joker, onClick, compact = false }: JokerCardProps) {
  const borderColor = RARITY_BORDER[joker.rarity] ?? RARITY_BORDER.common;

  const w = compact ? 120 : 140;
  const h = compact ? 72 : 90;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className="relative flex flex-col justify-between overflow-hidden transition-all duration-150"
      style={{
        width: w,
        height: h,
        background: 'linear-gradient(160deg, var(--leather-light), var(--leather))',
        border: `2px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
        boxShadow: `0 0 8px ${borderColor}40, 0 4px 12px rgba(0,0,0,0.4)`,
        cursor: onClick ? 'pointer' : 'default',
        padding: compact ? 6 : 8,
      }}
    >
      {/* Name */}
      <div
        className="truncate leading-tight"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? 10 : 12,
          color: 'var(--cream)',
        }}
      >
        {joker.name}
      </div>

      {/* Effect */}
      <div
        className="leading-snug"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: compact ? 9 : 10,
          color: 'var(--cream-soft)',
        }}
      >
        {joker.effect}
      </div>

      {/* Flavour */}
      <div
        className="truncate leading-tight"
        style={{
          fontFamily: 'var(--font-flavour)',
          fontStyle: 'italic',
          fontSize: compact ? 8 : 9,
          color: 'var(--dust)',
        }}
      >
        {joker.flavour}
      </div>

      {/* Rarity indicator bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, background: borderColor }}
      />
    </div>
  );
}
