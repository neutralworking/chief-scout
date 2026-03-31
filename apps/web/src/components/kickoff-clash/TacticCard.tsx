'use client';

import type { TacticCard as TacticCardType } from '../../lib/kickoff-clash/tactics';

// ---------------------------------------------------------------------------
// Category colour palette
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<TacticCardType['category'], string> = {
  attacking:  '#c0392b',
  defensive:  '#2c6fbb',
  specialist: '#d4a035',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TacticCardProps {
  tactic: TacticCardType;
  onClick?: () => void;
  deployed?: boolean;
  contradicted?: boolean;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TacticCard({
  tactic,
  onClick,
  deployed = false,
  contradicted = false,
  compact = false,
}: TacticCardProps) {
  const accent = CATEGORY_COLORS[tactic.category];

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: compact ? 120 : 140,
    height: compact ? 68 : 80,
    borderRadius: 6,
    borderLeft: `4px solid ${accent}`,
    background: 'linear-gradient(135deg, var(--leather, #3d2b1f) 0%, #2a1e15 100%)',
    padding: compact ? '5px 7px' : '6px 8px',
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    boxSizing: 'border-box',
    boxShadow: deployed
      ? `0 0 0 2px var(--amber, #f59e0b), 0 0 10px var(--amber, #f59e0b)`
      : '0 2px 6px rgba(0,0,0,0.5)',
    opacity: contradicted ? 0.45 : 1,
    transition: 'box-shadow 0.15s ease, opacity 0.15s ease',
  };

  return (
    <div style={containerStyle} onClick={onClick} role={onClick ? 'button' : undefined}>
      {/* Name */}
      <div
        style={{
          fontFamily: 'var(--font-display, sans-serif)',
          fontSize: compact ? 10 : 11,
          color: 'var(--cream, #f5f0e8)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {tactic.name}
      </div>

      {/* Effect */}
      <div
        style={{
          fontFamily: 'var(--font-body, sans-serif)',
          fontSize: compact ? 8 : 9,
          color: 'var(--cream-soft, #c8bfb0)',
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {tactic.effect}
      </div>

      {/* Flavour — hidden in compact mode */}
      {!compact && (
        <div
          style={{
            fontFamily: 'var(--font-flavour, serif)',
            fontStyle: 'italic',
            fontSize: 8,
            color: 'var(--dust, #8a7560)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tactic.flavour}
        </div>
      )}

      {/* Category pip */}
      <div
        style={{
          position: 'absolute',
          top: 5,
          right: 6,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: accent,
          opacity: 0.85,
        }}
      />

      {/* Contradicted overlay — red X */}
      {contradicted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: 'rgba(180, 30, 30, 0.25)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 28,
              color: 'var(--danger, #ef4444)',
              lineHeight: 1,
              opacity: 0.75,
            }}
          >
            ✕
          </span>
        </div>
      )}

      {/* Deployed badge */}
      {deployed && (
        <div
          style={{
            position: 'absolute',
            bottom: 5,
            right: 6,
            fontFamily: 'var(--font-body, sans-serif)',
            fontSize: 7,
            color: 'var(--amber, #f59e0b)',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          ACTIVE
        </div>
      )}
    </div>
  );
}
