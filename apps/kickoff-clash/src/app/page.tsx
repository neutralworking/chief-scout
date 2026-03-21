'use client';

import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import {
  RunState, MatchResult, DurabilityResult,
  createRun, startMatch, playRound, finalizeMatch,
  advanceToNextMatch, getFormationSlots, getSlotDisplayName,
  getOpponent, getOpponentBuild, getShopCards, addCardToDeck, sellCard,
  buyShopItem, buyAcademyPlayer, upgradeAcademy,
  analyzeDeck,
  ALL_CARDS,
  createSubCards, executeSubstitution,
} from '../lib/run';
import type { OpponentBuild, OpponentPlayer } from '../lib/run';
import {
  PLAYING_STYLES, type Card, type SlottedCard, type Durability,
  type MatchState, type RoundResult,
  previewRound, type RoundPreview,
} from '../lib/scoring';
import {
  SHOP_ITEMS, STADIUMS, getTransferFee, getStadium,
  ACADEMY_TIERS, ACADEMY_UPGRADE_COST, getAcademyTier,
  generateAcademyDurability,
  type ShopItem,
} from '../lib/economy';
import { type ActionCard, canPlayAction } from '../lib/actions';
import { findConnections } from '../lib/chemistry';
import { seededRandom } from '../lib/scoring';

// ---------------------------------------------------------------------------
// Visual Constants
// ---------------------------------------------------------------------------

const RARITY_COLORS: Record<string, string> = {
  Common: '#71717a',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
};

const RARITY_GLOW: Record<string, string> = {
  Common: '0 0 6px rgba(113,113,122,0.3)',
  Rare: '0 0 10px rgba(59,130,246,0.4)',
  Epic: '0 0 14px rgba(168,85,247,0.5)',
  Legendary: '0 0 18px rgba(245,158,11,0.6), 0 0 36px rgba(245,158,11,0.2)',
};

const THEME_GRADIENTS: Record<string, string> = {
  General: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  Catalyst: 'linear-gradient(135deg, #2d1b35 0%, #3d1f1f 100%)',
  Maestro: 'linear-gradient(135deg, #2a2517 0%, #1f2a1f 100%)',
  Captain: 'linear-gradient(135deg, #2d1520 0%, #1a1a2e 100%)',
  Professor: 'linear-gradient(135deg, #151f2e 0%, #1a2a3e 100%)',
};

const THEME_ICONS: Record<string, string> = {
  General: '\u2694',
  Catalyst: '\u26a1',
  Maestro: '\u266b',
  Captain: '\u2764',
  Professor: '\ud83d\udcda',
};

const DURABILITY_STYLES: Record<Durability, { label: string; badge: string; border: string; bg: string }> = {
  glass:    { label: 'Glass',    badge: '\ud83d\udd2e', border: 'rgba(200,200,220,0.3)', bg: 'rgba(200,200,220,0.08)' },
  fragile:  { label: 'Fragile',  badge: '\ud83e\ude78', border: 'rgba(200,180,160,0.4)', bg: 'rgba(200,180,160,0.06)' },
  standard: { label: 'Standard', badge: '\ud83d\udee1\ufe0f',  border: 'rgba(160,160,180,0.5)', bg: 'transparent' },
  iron:     { label: 'Iron',     badge: '\u2699\ufe0f',  border: 'rgba(180,200,220,0.7)', bg: 'rgba(180,200,220,0.08)' },
  titanium: { label: 'Titanium', badge: '\u2b50',  border: 'rgba(255,215,0,0.8)', bg: 'rgba(255,215,0,0.1)' },
  phoenix:  { label: 'Phoenix',  badge: '\ud83d\udd25',  border: 'rgba(255,140,50,0.7)', bg: 'rgba(255,140,50,0.1)' },
};

const ACTION_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'attacking':     { bg: 'rgba(220,50,50,0.15)', border: '#dc3232', text: '#ff6b6b' },
  'defensive':     { bg: 'rgba(50,120,220,0.15)', border: '#3278dc', text: '#6bb5ff' },
  'moment':        { bg: 'rgba(220,180,30,0.15)', border: '#dcb41e', text: '#ffd95c' },
  'mind_game':     { bg: 'rgba(50,180,80,0.15)', border: '#32b450', text: '#6bff8c' },
  'substitution':  { bg: 'rgba(46,204,113,0.15)', border: '#2ecc71', text: '#6bffaa' },
};

function getActionTypeKey(card: ActionCard): string {
  if (card.type === 'tactical') return card.subtype ?? 'attacking';
  if (card.type === 'substitution') return 'substitution';
  return card.type;
}

const ROUND_MINUTES = [15, 30, 45, 60, 75];

// ---------------------------------------------------------------------------
// Card Components
// ---------------------------------------------------------------------------

function DurabilityBadge({ durability, small = false }: { durability: Durability; small?: boolean }) {
  const d = DURABILITY_STYLES[durability];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full ${small ? 'px-1 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'} font-bold`}
      style={{ background: d.bg, border: `1px solid ${d.border}`, color: d.border }}
      title={d.label}
    >
      {d.badge} {!small && d.label}
    </span>
  );
}

// Context for card detail inspection — avoids prop-drilling through every phase
const InspectCardContext = createContext<((card: Card) => void) | null>(null);

function CardDisplay({
  card, size = 'normal', onClick, onInspect, selected = false, sellMode = false, subbed = false,
}: {
  card: Card;
  size?: 'normal' | 'small' | 'mini';
  onClick?: () => void;
  onInspect?: (card: Card) => void;
  selected?: boolean;
  sellMode?: boolean;
  subbed?: boolean;
}) {
  const contextInspect = useContext(InspectCardContext);
  const inspect = onInspect ?? contextInspect;
  const rarityColor = RARITY_COLORS[card.rarity] ?? '#71717a';
  const glow = RARITY_GLOW[card.rarity] ?? 'none';
  const bg = THEME_GRADIENTS[card.personalityTheme ?? 'General'] ?? THEME_GRADIENTS.General;

  const isMini = size === 'mini';
  const isSmall = size === 'small';

  // Fix 3: Mini cards are landscape-oriented pills (wider, shorter)
  const w = isMini ? 'w-[100px]' : isSmall ? 'w-[100px]' : 'w-[130px]';
  const h = isMini ? 'h-[44px]' : isSmall ? 'h-[125px]' : 'h-[170px]';

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 flex-shrink-0
        ${selected ? 'ring-2 ring-[var(--color-accent-primary)] scale-105' : ''}
        ${w} ${h}
        ${onClick ? 'hover:scale-105 hover:brightness-110 active:scale-95' : ''}
        ${card.injured ? 'opacity-50 grayscale' : ''}
      `}
      style={{
        background: bg,
        border: `2px solid ${rarityColor}`,
        boxShadow: selected ? `0 0 16px rgba(231,76,60,0.5), ${glow}` : glow,
      }}
    >
      {isMini ? (
        <>
          {/* Mini: landscape pill layout — position | name | power inline */}
          <div className="flex items-center h-full px-1.5 gap-1">
            <div className="rounded px-1 py-0.5 font-black uppercase text-[7px] flex-shrink-0"
              style={{ background: rarityColor, color: '#fff' }}>
              {card.position}
            </div>
            <div className="font-bold text-white truncate text-[9px] flex-1 min-w-0">
              {card.name}
            </div>
            <div className="font-black text-sm flex-shrink-0"
              style={{ color: rarityColor, textShadow: `0 0 6px ${rarityColor}` }}>
              {card.power}
            </div>
          </div>
          {/* Durability badge — bottom right */}
          <div className="absolute bottom-0.5 right-0.5">
            <DurabilityBadge durability={card.durability} small />
          </div>
        </>
      ) : (
        <>
          {/* Position badge */}
          <div
            className={`absolute top-0.5 left-0.5 rounded px-1 font-black uppercase text-[9px]`}
            style={{ background: rarityColor, color: '#fff' }}
          >
            {card.position}
          </div>

          {/* Power */}
          <div className={`absolute top-0.5 right-1 font-black ${isSmall ? 'text-lg' : 'text-2xl'}`}
            style={{ color: rarityColor, textShadow: `0 0 6px ${rarityColor}` }}
          >
            {card.power}
          </div>

          {/* Name */}
          <div className={`${isSmall ? 'mt-6' : 'mt-8'} px-1 text-center`}>
            <div className={`font-bold text-white truncate ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
              {card.name}
            </div>
          </div>

          {/* Archetype + Role */}
          <div className="px-1 mt-0.5 text-center">
            <div className={`text-[${isSmall ? '8' : '9'}px] text-[var(--color-text-secondary)] truncate`}>
              {card.archetype}
            </div>
          </div>

          {/* Durability badge */}
          <div className="absolute bottom-1 left-0.5">
            <DurabilityBadge durability={card.durability} small={isSmall} />
          </div>

          {/* Theme icon */}
          <div className={`absolute bottom-1 right-1 ${isSmall ? 'text-[10px]' : 'text-xs'}`} title={card.personalityTheme}>
            {THEME_ICONS[card.personalityTheme ?? 'General'] ?? ''}
          </div>
        </>
      )}

      {/* Ability name */}
      {!isMini && !isSmall && card.abilityName && (
        <div className="absolute bottom-6 left-0 right-0 px-1 text-center">
          <div className="text-[8px] text-[var(--color-accent-gold)] font-semibold truncate italic">
            {card.abilityName}
          </div>
        </div>
      )}

      {/* Info button — opens card detail popup */}
      {!isMini && inspect && card.bio && (
        <button
          onClick={e => { e.stopPropagation(); inspect(card); }}
          className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white/10 hover:bg-white/25 text-[8px] text-white/60 hover:text-white flex items-center justify-center transition-all"
          title="View details"
        >
          i
        </button>
      )}

      {/* Sub indicator */}
      {subbed && (
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 px-1 rounded bg-green-500 text-[7px] font-black text-white">
          SUB
        </div>
      )}

      {/* Sell overlay */}
      {sellMode && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
          <div className="text-center">
            <div className="text-[9px] text-[var(--color-text-secondary)]">SELL</div>
            <div className={`${isMini ? 'text-xs' : 'text-sm'} font-black text-[var(--color-accent-green)]`}>
              \u00a3{getTransferFee(card).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Injured overlay */}
      {card.injured && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
          <span className="text-lg">\ud83e\ude78</span>
        </div>
      )}

      {/* Rarity bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: rarityColor }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Detail Popup — shows bio, quirk, tags, strengths/weaknesses
// ---------------------------------------------------------------------------

function CardDetailPopup({ card, onClose }: { card: Card; onClose: () => void }) {
  const rarityColor = RARITY_COLORS[card.rarity] ?? '#71717a';
  const bg = THEME_GRADIENTS[card.personalityTheme ?? 'General'] ?? THEME_GRADIENTS.General;
  const themeIcon = THEME_ICONS[card.personalityTheme ?? 'General'] ?? '';
  const durStyle = DURABILITY_STYLES[card.durability];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full rounded-xl overflow-hidden border-2 animate-in zoom-in-95 duration-200"
        style={{ background: bg, borderColor: rarityColor, boxShadow: `0 0 30px ${rarityColor}40` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 font-black uppercase text-[10px]"
                  style={{ background: rarityColor, color: '#fff' }}>
                  {card.position}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  {card.rarity}
                </span>
              </div>
              <h3 className="text-xl font-black text-white mt-1">{card.name}</h3>
              {card.nation && (
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{card.nation}</div>
              )}
            </div>
            <div className="text-4xl font-black" style={{ color: rarityColor, textShadow: `0 0 10px ${rarityColor}` }}>
              {card.power}
            </div>
          </div>

          {/* Role + Archetype */}
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-secondary)]">
            <span>{themeIcon} {card.personalityTheme}</span>
            <span>{card.archetype}</span>
            {card.tacticalRole && <span className="text-[var(--color-text-muted)]">{card.tacticalRole}</span>}
          </div>

          {/* Durability */}
          <div className="mt-1">
            <DurabilityBadge durability={card.durability} />
          </div>
        </div>

        {/* Bio */}
        {card.bio && (
          <div className="mx-4 p-3 rounded-lg bg-black/30 border border-white/10">
            <p className="text-xs text-[var(--color-text-secondary)] italic leading-relaxed">
              &ldquo;{card.bio}&rdquo;
            </p>
          </div>
        )}

        {/* Quirk */}
        {card.quirk && card.quirk.length > 0 && (
          <div className="mx-4 mt-2 flex items-center gap-1.5">
            <span className="text-[10px]">{'\u2728'}</span>
            <span className="text-[11px] text-[var(--color-accent-gold)]">{card.quirk}</span>
          </div>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="px-4 mt-3 flex flex-wrap gap-1.5">
            {card.tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-[var(--color-text-secondary)] border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Strengths & Weaknesses */}
        {((card.strengths && card.strengths.length > 0) || (card.weaknesses && card.weaknesses.length > 0)) && (
          <div className="px-4 mt-3 flex gap-4">
            {card.strengths && card.strengths.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-widest text-green-400 font-bold mb-1">Strengths</div>
                {card.strengths.map((s, i) => (
                  <div key={i} className="text-[11px] text-green-300/80">{'\u2713'} {s}</div>
                ))}
              </div>
            )}
            {card.weaknesses && card.weaknesses.length > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-widest text-red-400 font-bold mb-1">Weaknesses</div>
                {card.weaknesses.map((w, i) => (
                  <div key={i} className="text-[11px] text-red-300/80">{'\u2717'} {w}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ability */}
        {card.abilityName && (
          <div className="mx-4 mt-3 p-2 rounded bg-[var(--color-accent-gold)]/10 border border-[var(--color-accent-gold)]/30">
            <div className="text-[10px] font-bold text-[var(--color-accent-gold)]">{card.abilityName}</div>
            {card.abilityText && (
              <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{card.abilityText}</div>
            )}
          </div>
        )}

        {/* Gate Pull */}
        <div className="px-4 py-3 mt-2 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
          <span>Fan Pull: +{card.gatePull}</span>
          <span>{durStyle.badge} {durStyle.label}</span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white/80 hover:text-white text-sm flex items-center justify-center"
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  );
}

function OpponentCardDisplay({
  player, isStar = false,
}: {
  player: OpponentPlayer;
  isStar?: boolean;
}) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden flex-shrink-0 w-[100px] h-[60px]
        ${isStar ? 'ring-1 ring-[var(--color-accent-gold)]' : ''}
      `}
      style={{
        background: 'linear-gradient(135deg, #2a0a0a 0%, #1a0505 100%)',
        border: `1.5px solid ${isStar ? 'rgba(255,215,0,0.6)' : 'rgba(220,50,50,0.4)'}`,
        boxShadow: isStar ? '0 0 8px rgba(255,215,0,0.3)' : 'none',
      }}
    >
      <div className="flex items-center h-full px-1.5 gap-1">
        <div className="rounded px-1 py-0.5 font-black uppercase text-[7px] flex-shrink-0"
          style={{ background: 'rgba(220,50,50,0.6)', color: '#fff' }}>
          {player.position}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-red-200 truncate text-[9px]">
            {player.name}
          </div>
          <div className="text-[7px] text-red-400/70 truncate">
            {player.archetype}
          </div>
        </div>
        <div className="font-black text-sm flex-shrink-0 text-red-300">
          {player.power}
        </div>
      </div>
      {isStar && (
        <div className="absolute -top-0.5 -right-0.5 text-[10px]" title="Star Player">
          {'\u2b50'}
        </div>
      )}
    </div>
  );
}

function ActionCardDisplay({
  card, onClick, selected = false, disabled = false, compact = false,
}: {
  card: ActionCard;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const typeKey = getActionTypeKey(card);
  const colors = ACTION_TYPE_COLORS[typeKey] ?? ACTION_TYPE_COLORS['attacking'];
  const typeLabel = card.type === 'tactical'
    ? (card.subtype === 'defensive' ? 'DEF' : 'ATK')
    : card.type === 'moment' ? 'MOM' : card.type === 'substitution' ? 'SUB' : 'MIND';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`relative rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0
        ${compact ? 'w-[120px] h-[80px]' : 'w-[150px] h-[120px]'}
        ${selected ? 'ring-2 ring-white scale-105 -translate-y-5' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105 hover:-translate-y-2 active:scale-95'}
        ${card.type === 'substitution' ? 'sub-card' : ''}
      `}
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? '#fff' : colors.border}`,
        boxShadow: selected ? `0 0 12px ${colors.border}` : 'none',
      }}
    >
      {/* Type badge */}
      <div
        className={`absolute top-0.5 left-0.5 rounded px-1 font-black uppercase ${compact ? 'text-[7px]' : 'text-[8px]'}`}
        style={{ background: colors.border, color: '#000' }}
      >
        {typeLabel}
      </div>

      {/* Name */}
      <div className={`${compact ? 'mt-4 px-1' : 'mt-5 px-2'}`}>
        <div className={`font-bold truncate ${compact ? 'text-[10px]' : 'text-xs'}`} style={{ color: colors.text }}>
          {card.name}
        </div>
      </div>

      {/* Flavour */}
      <div className={`${compact ? 'px-1 mt-0.5' : 'px-2 mt-1'}`}>
        <div className={`text-[var(--color-text-muted)] italic ${compact ? 'text-[8px] truncate' : 'text-[9px] line-clamp-2'}`}>
          {card.flavour}
        </div>
      </div>

      {/* Effect summary */}
      {!compact && (
        <div className="absolute bottom-1.5 left-2 right-2">
          <div className="text-[8px] text-[var(--color-text-secondary)] line-clamp-2">
            {formatEffect(card)}
          </div>
        </div>
      )}

      {/* Fan impact */}
      {card.fanImpact !== 0 && !compact && (
        <div className="absolute top-0.5 right-1 text-[9px]" style={{ color: card.fanImpact > 0 ? '#2ecc71' : '#e74c3c' }}>
          {card.fanImpact > 0 ? '+' : ''}{card.fanImpact}
        </div>
      )}
    </div>
  );
}

function formatEffect(card: ActionCard): string {
  const e = card.effect;
  const parts: string[] = [];
  if (e.yourGoalMod) parts.push(`+${(e.yourGoalMod * 100).toFixed(0)}% goal`);
  if (e.opponentGoalMod) parts.push(`${(e.opponentGoalMod * 100).toFixed(0)}% opp`);
  if (e.yourNextRoundMod) parts.push(`+${(e.yourNextRoundMod * 100).toFixed(0)}% next`);
  if (e.opponentRestOfMatchMod) parts.push(`${(e.opponentRestOfMatchMod * 100).toFixed(0)}% opp rest`);
  if (e.successChance) parts.push(`${(e.successChance * 100).toFixed(0)}% chance`);
  if (e.cancelOpponentAction) parts.push('Cancel opp action');
  if (e.perCardGoalMod) parts.push(`+${(e.perCardGoalMod * 100).toFixed(0)}%/card`);
  if (e.requiresInXI) parts.push(`Req: ${e.requiresInXI}`);
  if (e.onlyAtRound) parts.push(`Only at ${ROUND_MINUTES[e.onlyAtRound - 1]}'`);
  return parts.join(' | ') || card.flavour;
}

// ---------------------------------------------------------------------------
// 1. Setup Phase
// ---------------------------------------------------------------------------

function SetupPhase({ onStart }: { onStart: (formation: string, style: string) => void }) {
  const [formation, setFormation] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const formations = ['4-3-3', '4-4-2', '3-5-2'];

  return (
    <div className="phase-setup flex flex-col items-center justify-center min-h-screen text-center space-y-10 p-6">
      <div>
        <h1 className="text-6xl font-black tracking-tight uppercase mb-2">
          <span className="text-[var(--color-accent-primary)]">Kickoff</span>{' '}
          <span className="text-[var(--color-accent-secondary)]">Clash</span>
        </h1>
        <p className="text-[var(--color-text-secondary)] text-lg">
          Build your squad. Play your cards. Win the season.
        </p>
      </div>

      {/* Formation */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Formation</h3>
        <div className="flex gap-3">
          {formations.map(f => (
            <button key={f} onClick={() => setFormation(f)}
              className={`px-6 py-3 rounded-lg font-bold text-lg transition-all border-2
                ${formation === f
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/20 text-white scale-105'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-secondary)]'
                }`}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Playing Style</h3>
        <div className="flex flex-wrap justify-center gap-3 max-w-xl">
          {Object.entries(PLAYING_STYLES).map(([key, ps]) => (
            <button key={key} onClick={() => setStyle(key)}
              className={`px-4 py-3 rounded-lg transition-all text-left border-2 min-w-[160px]
                ${style === key
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/20 text-white scale-105'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-secondary)]'
                }`}
            >
              <div className="font-bold text-sm">{ps.name}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {ps.bonusArchetypes.length > 0
                  ? `+${(ps.multiplier * 100).toFixed(0)}% for ${ps.bonusArchetypes.join(', ')}`
                  : `+${(ps.multiplier * 100).toFixed(0)}% flat per card`
                }
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!formation || !style}
        onClick={() => formation && style && onStart(formation, style)}
        className={`px-10 py-4 rounded-lg text-lg font-black uppercase tracking-wide transition-all
          ${formation && style
            ? 'bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-accent-primary)]/30'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
      >
        Kick Off
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Pre-Match Phase
// ---------------------------------------------------------------------------

function PreMatchPhase({
  state, onStartMatch,
}: {
  state: RunState;
  onStartMatch: () => void;
}) {
  const opponent = getOpponent(state.round);
  const opponentBuild = getOpponentBuild(state.round);
  const deckAnalysis = analyzeDeck(state.deck, opponentBuild);
  const xi = state.lineup;
  const bench = state.bench;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 overflow-y-auto max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--color-bg-surface)] rounded-lg px-4 py-3 border border-[var(--color-border-subtle)]">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Match {state.round} of 5</div>
          <div className="font-bold text-lg">{opponent.name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{opponentBuild.formation} {opponentBuild.style} {'\u2022'} Strength: {opponent.baseStrength}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Cash</div>
          <div className="font-bold text-lg text-[var(--color-accent-green)]">{'\u00a3'}{state.cash.toLocaleString()}</div>
        </div>
      </div>

      {/* Opponent Build */}
      <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-red-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">
            Opponent XI
          </h3>
          <div className="text-[10px] text-red-300/70">{opponentBuild.formation} | {opponentBuild.style}</div>
        </div>

        {/* Opponent players */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {opponentBuild.xi.map((p, i) => (
            <OpponentCardDisplay key={i} player={p} isStar={p.name === opponentBuild.starPlayer.name} />
          ))}
        </div>

        {/* Star player callout */}
        <div className="flex items-center gap-2 bg-yellow-900/20 rounded px-3 py-1.5 border border-yellow-700/30">
          <span className="text-[10px]">{'\u2b50'}</span>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-yellow-300">{opponentBuild.starPlayer.name}</span>
            <span className="text-[9px] text-yellow-400/70 ml-1.5">{opponentBuild.starAbility}</span>
          </div>
        </div>

        {/* Opponent synergies */}
        {opponentBuild.synergies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opponentBuild.synergies.map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                style={{
                  background: 'rgba(220,50,50,0.15)',
                  color: '#ff6b6b',
                  border: '1px solid rgba(220,50,50,0.3)',
                }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Weakness */}
        <div className="flex items-center gap-2 bg-green-900/20 rounded px-3 py-1.5 border border-green-700/30">
          <span className="text-[10px]">{'\u26a1'}</span>
          <span className="text-[10px] font-bold text-green-300">Weak to: {opponentBuild.weaknessArchetype}</span>
          <span className="text-[9px] text-green-400/70">({opponentBuild.weakness})</span>
        </div>
      </div>

      {/* XI */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          Starting XI
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {xi.map(sc => (
            <div key={sc.card.id} className="relative">
              <CardDisplay card={sc.card} size="small" />
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[7px] font-bold text-[var(--color-text-secondary)]">
                {getSlotDisplayName(sc.slot)}
              </div>
              {sc.card.durability === 'titanium' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded text-[7px] font-black"
                  style={{ background: 'rgba(255,215,0,0.3)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.5)' }}>
                  AUTO-START
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deck Analysis */}
      <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-[var(--color-border-subtle)] space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          Deck Analysis
        </h3>

        {/* Archetype mix */}
        <div className="space-y-1">
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold">Archetypes</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(deckAnalysis.archetypeCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([arch, count]) => (
                <span key={arch} className={`px-1.5 py-0.5 rounded text-[9px] font-bold
                  ${arch === opponentBuild.weaknessArchetype
                    ? 'bg-green-900/30 text-green-300 border border-green-600/40'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                  }`}>
                  {arch} x{count}
                </span>
              ))}
          </div>
        </div>

        {/* Position coverage */}
        <div className="space-y-1">
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold">Positions</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(deckAnalysis.positionCounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([pos, count]) => (
                <span key={pos} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                  {pos} x{count}
                </span>
              ))}
          </div>
        </div>

        {/* Active synergies */}
        {deckAnalysis.activeSynergies.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold">Active Synergies</div>
            <div className="flex flex-wrap gap-1">
              {deckAnalysis.activeSynergies.map((s, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-900/20 text-green-300 border border-green-700/30">
                  {'\u2713'} {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Near synergies */}
        {deckAnalysis.nearSynergies.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold">Near Synergies</div>
            <div className="flex flex-wrap gap-1">
              {deckAnalysis.nearSynergies.slice(0, 4).map((s, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                  {'\u25cb'} {s.name} (need {s.missing})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Opponent match */}
        <div className="flex items-center gap-2 bg-[var(--color-bg-elevated)] rounded px-3 py-2 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)]">vs {opponentBuild.weaknessArchetype} weakness:</span>
          <span className={`text-[10px] font-black ${deckAnalysis.opponentMatch.count > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {deckAnalysis.opponentMatch.count > 0
              ? `${deckAnalysis.opponentMatch.count} ${opponentBuild.weaknessArchetype}${deckAnalysis.opponentMatch.count > 1 ? 's' : ''} ${'\u2713'.repeat(deckAnalysis.opponentMatch.count)}`
              : 'None in deck'
            }
          </span>
        </div>

        {/* Warnings */}
        {deckAnalysis.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deckAnalysis.warnings.map((w, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-900/20 text-orange-300 border border-orange-700/30">
                {'\u26a0'} {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Bench ({bench.length})
          </h3>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {bench.map((c, i) => (
              <CardDisplay key={`bench-${c.id}-${i}`} card={c} size="mini" />
            ))}
          </div>
        </div>
      )}

      {/* Opening Hand */}
      {state.matchState && state.matchState.hand.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Opening Hand ({state.matchState.hand.length} cards)
          </h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {state.matchState.hand.map((ac, i) => (
              <ActionCardDisplay key={`${ac.id}-${i}`} card={ac} compact />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-4 pb-8">
        <button onClick={onStartMatch}
          className="px-10 py-4 rounded-lg text-lg font-black uppercase tracking-wide bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--color-accent-primary)]/30 animate-pulse"
        >
          Start Match
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Match Phase
// ---------------------------------------------------------------------------

function MatchPhase({
  state, matchState, commentary, onPlayRound,
}: {
  state: RunState;
  matchState: MatchState;
  commentary: string[];
  onPlayRound: (playedCards: ActionCard[], discardedIdx: number | null, subCardsPlayed?: ActionCard[]) => void;
}) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [discardedIdx, setDiscardedIdx] = useState<number | null>(null);
  const [displayedCommentary, setDisplayedCommentary] = useState<string[]>([]);
  const [isAnimatingCommentary, setIsAnimatingCommentary] = useState(false);
  const [showOpponentPanel, setShowOpponentPanel] = useState(false);
  const commentaryEndRef = useRef<HTMLDivElement>(null);
  const prevCommentaryLenRef = useRef(0);

  const opponent = getOpponent(state.round);
  const opponentBuild = getOpponentBuild(state.round);
  const round = matchState.round;
  const minute = ROUND_MINUTES[round - 1] ?? 90;
  const nextMinute = ROUND_MINUTES[round] ?? 90;
  const isFinalRound = round >= 5;
  const maxPlays = isFinalRound ? 99 : 2;
  const playsRemaining = maxPlays - selectedCards.length;

  // Fix 1: Create sub cards from bench
  const subCards = createSubCards(matchState.bench);

  // Combine hand + sub cards for display
  const allHandCards = [...matchState.hand, ...subCards];
  const handLength = matchState.hand.length; // divider between action and sub cards

  // Fix 2: Strength preview — recalculate when selection changes
  const selectedActionCards = selectedCards
    .filter(idx => idx < handLength) // only actual action cards, not subs
    .map(i => matchState.hand[i]);
  const preview = previewRound(matchState, selectedActionCards);

  // Fix 4: Commentary phasing — animate new lines with delays
  useEffect(() => {
    if (commentary.length > prevCommentaryLenRef.current) {
      const newLines = commentary.slice(prevCommentaryLenRef.current);
      setIsAnimatingCommentary(true);
      let addedCount = 0;
      newLines.forEach((line, i) => {
        setTimeout(() => {
          setDisplayedCommentary(prev => [...prev, line]);
          addedCount++;
          if (addedCount === newLines.length) {
            setIsAnimatingCommentary(false);
          }
        }, (i + 1) * 400);
      });
      prevCommentaryLenRef.current = commentary.length;
    }
  }, [commentary]);

  // Scroll commentary to bottom
  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedCommentary]);

  const totalYourGoals = matchState.yourGoals;
  const totalOppGoals = matchState.opponentGoals;

  const toggleCard = (idx: number) => {
    if (selectedCards.includes(idx)) {
      setSelectedCards(selectedCards.filter(i => i !== idx));
    } else if (selectedCards.length < maxPlays) {
      if (discardedIdx === idx) setDiscardedIdx(null);
      setSelectedCards([...selectedCards, idx]);
    }
  };

  const toggleDiscard = (idx: number) => {
    if (selectedCards.includes(idx)) return;
    if (discardedIdx === idx) {
      setDiscardedIdx(null);
    } else {
      setDiscardedIdx(idx);
    }
  };

  const handleAdvance = () => {
    const played = selectedCards
      .filter(idx => idx < handLength)
      .map(i => matchState.hand[i]);
    // Collect sub card indices (those >= handLength)
    const subIndices = selectedCards.filter(idx => idx >= handLength);
    onPlayRound(played, discardedIdx, subIndices.map(idx => subCards[idx - handLength]));
    setSelectedCards([]);
    setDiscardedIdx(null);
  };

  const connections = findConnections(matchState.xi);

  // Classify commentary lines for styling
  const classifyLine = (line: string): string => {
    if (line.includes('GOAL!') || line.includes('scores!')) return 'commentary-goal-yours';
    if (line.includes('Opponent scores')) return 'commentary-goal-opponent';
    return '';
  };

  return (
    <div className="phase-match max-w-2xl mx-auto p-3 pb-16 flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Top Bar: Scoreline */}
      <div className="flex-shrink-0 bg-[var(--color-bg-surface)] rounded-lg px-4 py-2 border border-[var(--color-border-subtle)] mb-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--color-text-muted)]">YOU</div>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black">{totalYourGoals}</span>
            <span className="text-lg text-[var(--color-text-muted)]">-</span>
            <span className="text-3xl font-black">{totalOppGoals}</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">{opponent.name}</div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-1.5">
            {ROUND_MINUTES.map((m, i) => (
              <div key={m} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all
                ${i < round - 1 ? 'bg-[var(--color-accent-green)] text-black' :
                  i === round - 1 ? 'bg-[var(--color-accent-primary)] text-white animate-pulse' :
                  'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                }`}
              >
                {m}&apos;
              </div>
            ))}
          </div>
          <div className="text-xs text-[var(--color-accent-gold)] font-bold">{'\u00a3'}{state.cash.toLocaleString()}</div>
        </div>
      </div>

      {/* Collapsible Opponent Panel */}
      <div className="flex-shrink-0 mb-2">
        <button
          onClick={() => setShowOpponentPanel(!showOpponentPanel)}
          className="w-full text-left px-3 py-1.5 rounded bg-red-950/40 border border-red-900/30 text-[10px] font-bold text-red-300 hover:bg-red-950/60 transition-all flex items-center justify-between"
        >
          <span>{'\ud83d\udccb'} Opponent: {opponentBuild.name} ({opponentBuild.formation})</span>
          <span className="text-[8px] text-green-400">{'\u26a1'} Weak to {opponentBuild.weaknessArchetype}</span>
          <span className="text-red-400">{showOpponentPanel ? '\u25b2' : '\u25bc'}</span>
        </button>
        {showOpponentPanel && (
          <div className="mt-1 px-2 py-2 bg-red-950/20 rounded border border-red-900/20">
            <div className="flex flex-wrap gap-1 justify-center">
              {opponentBuild.xi.map((p, i) => (
                <OpponentCardDisplay key={i} player={p} isStar={p.name === opponentBuild.starPlayer.name} />
              ))}
            </div>
            {opponentBuild.synergies.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center mt-1.5">
                {opponentBuild.synergies.map((s, i) => (
                  <span key={i} className="px-1 py-0.5 rounded text-[7px] font-bold bg-red-900/20 text-red-300 border border-red-800/30">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* XI Row — landscape pill cards */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex gap-1 justify-center overflow-x-auto pb-1 flex-wrap">
          {matchState.xi.map(sc => (
            <div key={sc.card.id} className="relative">
              <CardDisplay card={sc.card} size="mini" />
            </div>
          ))}
        </div>
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-1">
            {connections.slice(0, 3).map((conn, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                style={{
                  background: conn.tier === 1 ? 'rgba(113,113,122,0.2)' : conn.tier === 2 ? 'rgba(59,130,246,0.2)' : conn.tier === 3 ? 'rgba(168,85,247,0.2)' : 'rgba(245,158,11,0.2)',
                  color: conn.tier === 1 ? '#a1a1aa' : conn.tier === 2 ? '#60a5fa' : conn.tier === 3 ? '#c084fc' : '#fbbf24',
                  border: `1px solid ${conn.tier === 1 ? 'rgba(113,113,122,0.3)' : conn.tier === 2 ? 'rgba(59,130,246,0.3)' : conn.tier === 3 ? 'rgba(168,85,247,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                T{conn.tier} {conn.name} +{conn.bonus}
              </span>
            ))}
            {connections.length > 3 && (
              <span className="text-[8px] text-[var(--color-text-muted)]">+{connections.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      {/* Commentary Feed — Fix 4 styled, Fix 5 phase class */}
      <div className="commentary-feed flex-1 min-h-0 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)] mb-3 overflow-y-auto p-3">
        {displayedCommentary.length === 0 && (
          <div className="text-sm text-[var(--color-text-muted)] text-center py-8 font-mono">
            {minute}&apos; {'\u2014'} The referee is ready. Play your cards and advance.
          </div>
        )}
        {displayedCommentary.map((line, i) => (
          <div key={i} className={`text-[11px] font-mono py-0.5 border-b border-[var(--color-border-subtle)]/30 last:border-0 transition-opacity duration-300 ${classifyLine(line) || 'text-[var(--color-text-secondary)]'}`}>
            {line}
          </div>
        ))}
        <div ref={commentaryEndRef} />
      </div>

      {/* Fix 2: Strength Preview */}
      {selectedCards.length > 0 && (
        <div className="flex-shrink-0 bg-[var(--color-bg-elevated)] rounded-lg px-3 py-2 mb-2 border border-[var(--color-border-subtle)]">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-3">
              <span className="text-[var(--color-text-muted)]">Your Strength:</span>
              <span className="font-bold text-white">{preview.yourStrength}</span>
              <span className="text-[var(--color-text-muted)]">Goal:</span>
              <span className={`font-bold ${preview.strengthDelta > 0 ? 'text-[var(--color-accent-green)]' : preview.strengthDelta < 0 ? 'text-[var(--color-accent-primary)]' : 'text-white'}`}>
                {Math.round(preview.yourGoalChance * 100)}%
                {preview.strengthDelta !== 0 && (
                  <span className="ml-1">({preview.strengthDelta > 0 ? '+' : ''}{preview.strengthDelta}%)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[var(--color-text-muted)]">vs Opp:</span>
              <span className="font-bold text-white">{preview.opponentStrength}</span>
              <span className="text-[var(--color-text-muted)]">({Math.round(preview.opponentGoalChance * 100)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Hand — Fix 3: Fan layout with overlapping rotated cards + Fix 1: sub cards appended */}
      <div className="flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Hand ({allHandCards.length}) {'\u2014'} {isFinalRound ? 'No limit' : `${playsRemaining} plays left`}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {discardedIdx !== null ? '1 discard queued' : 'Tap discard to remove'}
          </span>
        </div>
        <div className="flex justify-center overflow-x-auto pb-2 px-4"
          style={{ perspective: '800px' }}
        >
          {allHandCards.map((ac, idx) => {
            const isSelected = selectedCards.includes(idx);
            const isDiscarded = discardedIdx === idx;
            const isSub = idx >= handLength;
            const isPlayable = isSub || canPlayAction(ac, round);
            const center = (allHandCards.length - 1) / 2;
            const offset = idx - center;
            // Fix 3: Increased rotation and vertical curve
            const rotation = offset * 6;
            const verticalOffset = Math.abs(offset) * Math.abs(offset) * 3; // parabolic curve

            return (
              <div key={`${ac.id}-${idx}`}
                className="relative flex-shrink-0"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  marginTop: isSelected ? `${verticalOffset - 20}px` : isDiscarded ? `${verticalOffset + 12}px` : `${verticalOffset}px`,
                  marginLeft: idx === 0 ? '0' : '-20px', // Fix 3: 30% overlap via negative margin
                  transition: 'all 0.2s ease-out',
                  zIndex: isSelected ? 50 : 10 + idx,
                  minWidth: '44px', // Fix: touch target min size
                }}
              >
                <ActionCardDisplay
                  card={ac}
                  selected={isSelected}
                  disabled={!isPlayable || (playsRemaining <= 0 && !isSelected)}
                  onClick={() => toggleCard(idx)}
                />
                {/* Discard button — visible button, not tiny text */}
                {!isSelected && !isDiscarded && !isSub && discardedIdx === null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDiscard(idx); }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[8px] font-bold bg-red-900/60 text-red-300 border border-red-700/40 hover:bg-red-800/70 transition-all min-h-[28px] min-w-[44px]"
                  >
                    DISCARD
                  </button>
                )}
                {isDiscarded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <button onClick={(e) => { e.stopPropagation(); toggleDiscard(idx); }}
                      className="px-3 py-1.5 rounded text-[10px] font-bold bg-red-700 text-white min-h-[32px]">
                      DISCARDING
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Advance button — Fix: full-width mobile, minute transition, pulse when cards selected, gold Final Whistle */}
        <div className="flex justify-center pb-2">
          <button onClick={handleAdvance}
            disabled={isAnimatingCommentary}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-lg font-black uppercase tracking-wide transition-all text-sm min-h-[48px]
              ${isFinalRound
                ? 'bg-[var(--color-accent-gold)] text-black hover:brightness-110 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-accent-gold)]/30'
                : 'bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-accent-primary)]/30'
              }
              ${selectedCards.length > 0 && !isFinalRound ? 'advance-btn-pulse' : ''}
              ${isAnimatingCommentary ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            {isFinalRound ? 'Final Whistle' : `\u25b6 ${minute}\u2019 \u2192 ${nextMinute}\u2019`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Post-Match Phase
// ---------------------------------------------------------------------------

function PostMatchPhase({
  state, matchResult, durabilityResult, allCommentary, onContinue,
}: {
  state: RunState;
  matchResult: MatchResult;
  durabilityResult: DurabilityResult;
  allCommentary: string[];
  onContinue: () => void;
}) {
  const [revealStep, setRevealStep] = useState(0);

  useEffect(() => {
    if (revealStep < 6) {
      const timer = setTimeout(() => setRevealStep(s => s + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [revealStep]);

  const resultColor = matchResult.result === 'win'
    ? 'var(--color-accent-green)' : matchResult.result === 'loss'
    ? 'var(--color-accent-primary)' : 'var(--color-accent-gold)';
  const resultText = matchResult.result === 'win' ? 'WIN' : matchResult.result === 'loss' ? 'LOSS' : 'DRAW';

  return (
    <div className="phase-postmatch max-w-lg mx-auto p-4 space-y-6 overflow-y-auto max-h-screen">
      {/* Scoreline — Fix 5: radial spotlight */}
      <div className={`transition-all duration-500 ${revealStep >= 0 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-center relative">
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Full Time</div>
          <div className="flex items-center justify-center gap-6">
            <span className="text-5xl font-black">{matchResult.yourGoals}</span>
            <span className="text-2xl text-[var(--color-text-muted)]">-</span>
            <span className="text-5xl font-black">{matchResult.opponentGoals}</span>
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">vs {matchResult.opponentName}</div>
        </div>
      </div>

      {/* Result */}
      <div className={`transition-all duration-500 ${revealStep >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="text-center">
          <div className="text-6xl font-black uppercase tracking-widest"
            style={{ color: resultColor, textShadow: `0 0 30px ${resultColor}` }}>
            {resultText}
          </div>
        </div>
      </div>

      {/* Match Stats */}
      <div className={`transition-all duration-500 ${revealStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex gap-3 justify-center flex-wrap">
          <StatBox label="Goals" value={matchResult.yourGoals.toString()} />
          <StatBox label="Synergies" value={matchResult.synergiesTriggered.length.toString()} color="var(--color-accent-secondary)" />
          <StatBox label="Attendance" value={matchResult.attendance.toLocaleString()} />
          <StatBox label="Revenue" value={`\u00a3${matchResult.revenue.toLocaleString()}`} color="var(--color-accent-green)" />
        </div>
      </div>

      {/* Durability Resolution */}
      <div className={`transition-all duration-500 ${revealStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {durabilityResult.commentary.length > 0 && (
          <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-[var(--color-border-subtle)] space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Durability Check</h4>
            {durabilityResult.commentary.map((line, i) => {
              const isShatter = durabilityResult.shattered.some(c => line.includes(c.name));
              const isPromotion = durabilityResult.promoted.some(c => line.includes(c.name));
              const isInjury = durabilityResult.injured.some(c => line.includes(c.name));

              return (
                <div key={i} className={`text-sm font-mono py-1 px-2 rounded
                  ${isShatter ? 'bg-red-900/30 text-red-300 border border-red-700/30' :
                    isPromotion ? 'bg-amber-900/30 text-amber-300 border border-amber-700/30' :
                    isInjury ? 'bg-orange-900/30 text-orange-300 border border-orange-700/30' :
                    'text-[var(--color-text-secondary)]'
                  }`}>
                  {isShatter && '\ud83d\udca5 '}{isPromotion && '\u2b50 '}{isInjury && '\ud83e\ude78 '}{line}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Continue */}
      <div className={`transition-all duration-500 ${revealStep >= 5 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex justify-center pt-4">
          <button onClick={onContinue}
            className="px-8 py-3 rounded-lg font-bold uppercase tracking-wide bg-[var(--color-accent-secondary)] text-black hover:brightness-110 hover:scale-105 active:scale-95 transition-all"
          >
            {state.status === 'won' || state.status === 'lost' ? 'See Results' : 'Continue to Shop'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--color-bg-surface)] rounded-lg px-4 py-3 border border-[var(--color-border-subtle)] text-center min-w-[80px]">
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-lg font-bold" style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Shop Phase
// ---------------------------------------------------------------------------

function ShopPhase({
  state, onBuyCard, onSellCard, onBuyItem, onBuyAcademy, onUpgradeAcademy, onNext,
}: {
  state: RunState;
  onBuyCard: (card: Card, cost: number) => void;
  onSellCard: (card: Card) => void;
  onBuyItem: (item: ShopItem) => void;
  onBuyAcademy: (card: Card) => void;
  onUpgradeAcademy: () => void;
  onNext: () => void;
}) {
  const [shopCards] = useState(() => getShopCards(state.seed + state.round * 999, false));
  const [rareCards] = useState(() => getShopCards(state.seed + state.round * 999 + 1, true));
  const [showCardPick, setShowCardPick] = useState<'normal' | 'rare' | null>(null);
  const [sellMode, setSellMode] = useState(false);

  // Next opponent analysis (if not the last match)
  const nextRound = state.round + 1;
  const hasNextOpponent = nextRound <= 5;
  const nextOpponent = hasNextOpponent ? getOpponentBuild(nextRound) : null;
  const nextDeckAnalysis = nextOpponent ? analyzeDeck(state.deck, nextOpponent) : null;

  const academy = getAcademyTier(state.academyTier);
  const acSeed = state.seed + state.round * 777;
  const academyDurabilities = generateAcademyDurability(state.academyTier, academy.playersOffered, acSeed);

  // Generate academy cards from full pool
  const academyPool = ALL_CARDS.filter(c => {
    if (academy.maxRarity === 'Common') return c.rarity === 'Common';
    if (academy.maxRarity === 'Rare') return c.rarity === 'Common' || c.rarity === 'Rare';
    return c.rarity !== 'Legendary';
  });

  const academyCards: Card[] = [];
  for (let i = 0; i < academy.playersOffered && i < academyPool.length; i++) {
    const idx = Math.floor(seededRandom(acSeed + i * 31) * academyPool.length);
    const base = academyPool[idx];
    academyCards.push({
      ...base,
      id: state.seed + 90000 + state.round * 100 + i,
      durability: academyDurabilities[i],
    });
  }

  const cardPickCost = 15000;
  const rarePickCost = 35000;

  return (
    <div className="phase-shop max-w-2xl mx-auto p-4 space-y-5 overflow-y-auto max-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-wider">Transfer Window</h2>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Cash</div>
          <div className="text-2xl font-black text-[var(--color-accent-green)]">{'\u00a3'}{state.cash.toLocaleString()}</div>
        </div>
      </div>

      {/* Next opponent banner */}
      {nextOpponent && nextDeckAnalysis && (
        <div className="bg-red-950/30 rounded-lg px-4 py-3 border border-red-900/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Next: {nextOpponent.name}</span>
              <span className="text-[9px] text-red-300/60">{nextOpponent.formation} {nextOpponent.style}</span>
            </div>
            <span className="text-[10px] font-bold text-red-300">Str {nextOpponent.baseStrength}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]">{'\u26a1'}</span>
            <span className="text-[10px] font-bold text-green-300">Weak to: {nextOpponent.weaknessArchetype}</span>
            <span className={`text-[10px] font-black ${nextDeckAnalysis.opponentMatch.count > 0 ? 'text-green-400' : 'text-orange-400'}`}>
              ({nextDeckAnalysis.opponentMatch.count} in deck)
            </span>
          </div>
          {/* Archetype counts for deck */}
          <div className="flex flex-wrap gap-1">
            {Object.entries(nextDeckAnalysis.archetypeCounts)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([arch, count]) => (
                <span key={arch} className={`px-1 py-0.5 rounded text-[8px] font-bold
                  ${arch === nextOpponent.weaknessArchetype
                    ? 'bg-green-900/30 text-green-300 border border-green-600/40'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'
                  }`}>
                  {arch} x{count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Match record */}
      <div className="flex gap-2 justify-center">
        {state.matchHistory.map((m, i) => (
          <div key={i} className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold
            ${m.result === 'win' ? 'bg-green-600/30 text-green-400' : m.result === 'loss' ? 'bg-red-600/30 text-red-400' : 'bg-yellow-600/30 text-yellow-400'}
          `}>{m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'}</div>
        ))}
        {Array.from({ length: 5 - state.matchHistory.length }, (_, i) => (
          <div key={`f-${i}`} className="w-8 h-8 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]" />
        ))}
      </div>

      {/* Academy */}
      <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            Academy (Tier {state.academyTier} \u2014 {academy.name})
          </h3>
          {state.academyTier < 4 && (
            <button
              disabled={state.cash < ACADEMY_UPGRADE_COST}
              onClick={onUpgradeAcademy}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all
                ${state.cash >= ACADEMY_UPGRADE_COST
                  ? 'bg-[var(--color-accent-gold)]/20 text-[var(--color-accent-gold)] border border-[var(--color-accent-gold)]/30 hover:bg-[var(--color-accent-gold)]/30'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
                }`}
            >
              Upgrade \u00a3{ACADEMY_UPGRADE_COST.toLocaleString()}
            </button>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          {academyCards.map((card, i) => (
            <div key={card.id} className="text-center">
              <CardDisplay card={card} size="small"
                onClick={() => {
                  if (academy.cost === 0 || state.cash >= academy.cost) {
                    onBuyAcademy(card);
                  }
                }}
              />
              <div className="text-[10px] font-bold mt-1 text-[var(--color-accent-gold)]">
                {academy.cost === 0 ? 'FREE' : `\u00a3${academy.cost.toLocaleString()}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card pick modal */}
      {showCardPick && (
        <div className="bg-[var(--color-bg-elevated)] rounded-xl p-6 border-2 border-[var(--color-accent-secondary)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4 text-center">Pick 1 of 3</h3>
          <div className="flex gap-4 justify-center">
            {(showCardPick === 'rare' ? rareCards : shopCards).map(card => {
              // Check if this card matches next opponent weakness
              const matchesWeakness = nextOpponent && card.archetype === nextOpponent.weaknessArchetype;
              // Check if this card unlocks a near-synergy
              const unlockedSynergy = nextDeckAnalysis?.nearSynergies.find(
                ns => card.tacticalRole === ns.missing
              );

              return (
                <div key={card.id} className="text-center">
                  <CardDisplay card={card}
                    onClick={() => {
                      onBuyCard(card, showCardPick === 'rare' ? rarePickCost : cardPickCost);
                      setShowCardPick(null);
                    }}
                  />
                  {matchesWeakness && (
                    <div className="mt-1 px-1 py-0.5 rounded text-[8px] font-bold bg-green-900/30 text-green-300 border border-green-700/30">
                      {'\u26a1'} Exploits weakness
                    </div>
                  )}
                  {unlockedSynergy && (
                    <div className="mt-1 px-1 py-0.5 rounded text-[8px] font-bold bg-blue-900/30 text-blue-300 border border-blue-700/30">
                      {'\ud83d\udd17'} Unlocks {unlockedSynergy.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setShowCardPick(null)}
            className="mt-4 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors block mx-auto">
            Cancel
          </button>
        </div>
      )}

      {/* Transfer Market */}
      {!showCardPick && (
        <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Transfer Market</h3>
          <div className="grid grid-cols-2 gap-2">
            <ShopButton label="Card Pick" desc="Choose 1 of 3" cost={cardPickCost} cash={state.cash} onClick={() => setShowCardPick('normal')} />
            <ShopButton label="Rare+ Pick" desc="Rare or better" cost={rarePickCost} cash={state.cash} onClick={() => setShowCardPick('rare')} />
            {SHOP_ITEMS.filter(item =>
              item.category === 'action_pack' || item.category === 'manager'
            ).map(item => (
              <ShopButton key={item.id} label={item.name} desc={item.description} cost={item.cost} cash={state.cash} onClick={() => onBuyItem(item)} />
            ))}
          </div>
        </div>
      )}

      {/* Upgrades */}
      {!showCardPick && (
        <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Upgrades</h3>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_ITEMS.filter(item => item.category === 'upgrade' || item.category === 'utility').map(item => (
              <ShopButton key={item.id} label={item.name} desc={item.description} cost={item.cost} cash={state.cash} onClick={() => onBuyItem(item)} />
            ))}
          </div>
        </div>
      )}

      {/* Sell */}
      <div className="space-y-2">
        <button onClick={() => setSellMode(!sellMode)}
          className={`text-sm font-bold uppercase tracking-widest transition-colors ${
            sellMode ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)] hover:text-white'
          }`}>
          {sellMode ? '\u2716 Cancel Selling' : '\ud83d\udcb0 Sell Cards'}
        </button>
        {sellMode && (
          <div className="flex flex-wrap gap-2 justify-center">
            {state.deck.map(card => (
              <CardDisplay key={card.id} card={card} size="small" sellMode
                onClick={() => {
                  if (confirm(`Sell ${card.name} for \u00a3${getTransferFee(card).toLocaleString()}?`)) {
                    onSellCard(card);
                  }
                }}
              />
            ))}
            {state.deck.length === 0 && (
              <div className="text-sm text-[var(--color-text-muted)] py-4">No cards to sell</div>
            )}
          </div>
        )}
      </div>

      {/* Next Match */}
      <div className="flex justify-center pt-4 pb-8">
        <button onClick={onNext}
          className="px-10 py-4 rounded-lg text-lg font-black uppercase tracking-wide bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--color-accent-primary)]/30"
        >
          Next Match \u2192
        </button>
      </div>
    </div>
  );
}

function ShopButton({ label, desc, cost, cash, onClick }: {
  label: string; desc: string; cost: number; cash: number; onClick: () => void;
}) {
  const canAfford = cash >= cost;
  return (
    <button disabled={!canAfford} onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-all
        ${canAfford
          ? 'border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 hover:bg-[var(--color-bg-elevated)] hover:scale-[1.02]'
          : 'border-[var(--color-border-subtle)]/30 bg-[var(--color-bg-surface)] opacity-40 cursor-not-allowed'
        }`}
    >
      <div className="font-bold text-xs">{label}</div>
      <div className="text-[9px] text-[var(--color-text-muted)]">{desc}</div>
      <div className="text-xs font-bold text-[var(--color-accent-gold)] mt-1">\u00a3{cost.toLocaleString()}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 6. End Phase
// ---------------------------------------------------------------------------

function EndPhase({ state, onNewRun }: { state: RunState; onNewRun: () => void }) {
  const won = state.status === 'won';
  const totalGoals = state.matchHistory.reduce((s, m) => s + m.yourGoals, 0);
  const totalRevenue = state.matchHistory.reduce((s, m) => s + m.revenue, 0);
  const allSynergies = new Set(state.matchHistory.flatMap(m => m.synergiesTriggered));
  const totalShattered = state.matchHistory.reduce((s, m) => s + m.shattered.length, 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-8 p-6">
      <div>
        <div className="text-6xl font-black uppercase tracking-widest mb-2"
          style={{
            color: won ? 'var(--color-accent-gold)' : 'var(--color-accent-primary)',
            textShadow: won ? '0 0 40px rgba(241,196,15,0.5)' : '0 0 40px rgba(231,76,60,0.5)',
          }}>
          {won ? 'CHAMPIONS!' : 'RELEGATED!'}
        </div>
        <p className="text-[var(--color-text-secondary)]">
          {won ? 'You conquered all five opponents!' : `You suffered ${state.losses} defeats.`}
        </p>
      </div>

      {/* Match record */}
      <div className="flex gap-2 justify-center">
        {state.matchHistory.map((m, i) => (
          <div key={i} className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-sm font-bold
            ${m.result === 'win' ? 'bg-green-600/30 text-green-400 border border-green-500/30' :
              m.result === 'loss' ? 'bg-red-600/30 text-red-400 border border-red-500/30' :
              'bg-yellow-600/30 text-yellow-400 border border-yellow-500/30'
            }`}>
            <span>{m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'}</span>
            <span className="text-[7px]">{m.yourGoals}-{m.opponentGoals}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-sm w-full">
        <StatBox label="Matches Won" value={state.wins.toString()} color="var(--color-accent-green)" />
        <StatBox label="Total Goals" value={totalGoals.toString()} />
        <StatBox label="Revenue" value={`\u00a3${totalRevenue.toLocaleString()}`} color="var(--color-accent-gold)" />
        <StatBox label="Synergies" value={allSynergies.size.toString()} color="var(--color-accent-secondary)" />
        <StatBox label="Cards Shattered" value={totalShattered.toString()} color="var(--color-accent-primary)" />
        <StatBox label="Final Cash" value={`\u00a3${state.cash.toLocaleString()}`} color="var(--color-accent-green)" />
      </div>

      <button onClick={onNewRun}
        className="px-10 py-4 rounded-lg text-lg font-black uppercase tracking-wide bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--color-accent-primary)]/30"
      >
        New Season
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deck Viewer Overlay
// ---------------------------------------------------------------------------

const POSITION_ORDER = ['GK', 'CD', 'WD', 'DM', 'CM', 'WM', 'AM', 'WF', 'CF'];

const ARCHETYPE_COMPOUND_COLORS: Record<string, string> = {
  // Mental
  Controller: '#60a5fa', Commander: '#60a5fa', Creator: '#60a5fa',
  // Physical
  Target: '#fbbf24', Sprinter: '#fbbf24', Powerhouse: '#fbbf24',
  // Tactical
  Cover: '#4ade80', Engine: '#4ade80', Destroyer: '#4ade80',
  // Technical
  Dribbler: '#c084fc', Passer: '#c084fc', Striker: '#c084fc',
  // GK
  GK: '#71717a',
};

function DeckViewer({
  runState, phase, onClose, onSellCard,
}: {
  runState: RunState;
  phase: string;
  onClose: () => void;
  onSellCard?: (card: Card) => void;
}) {
  const [activeTab, setActiveTab] = useState<'cards' | 'analysis' | 'opponent'>('cards');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Slide-up animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const deck = runState.deck;
  const nextRound = runState.round + (runState.status === 'shop' ? 1 : 0);
  const hasNextOpponent = nextRound <= 5;
  const nextOpponentBuild = hasNextOpponent ? getOpponentBuild(nextRound) : null;
  const deckAnalysis = nextOpponentBuild
    ? analyzeDeck(deck, nextOpponentBuild)
    : analyzeDeck(deck, getOpponentBuild(runState.round));

  // Group cards by position
  const groupedCards: Record<string, Card[]> = {};
  for (const card of deck) {
    if (!groupedCards[card.position]) groupedCards[card.position] = [];
    groupedCards[card.position].push(card);
  }

  // Personality theme counts
  const personalityThemeCounts: Record<string, number> = {};
  for (const card of deck) {
    const theme = card.personalityTheme ?? 'General';
    personalityThemeCounts[theme] = (personalityThemeCounts[theme] ?? 0) + 1;
  }

  const maxArchetypeCount = Math.max(1, ...Object.values(deckAnalysis.archetypeCounts));
  const isShopPhase = phase === 'shop';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: 'rgba(10, 10, 15, 0.97)',
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black uppercase tracking-wider">Your Squad</h2>
          <span className="text-xs text-[var(--color-text-muted)] font-bold">{deck.length} cards</span>
        </div>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-surface)] transition-all text-lg font-bold"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[var(--color-border-subtle)]">
        {(['cards', 'analysis', 'opponent'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all
              ${activeTab === tab
                ? 'text-white border-b-2 border-[var(--color-accent-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
          >
            {tab === 'cards' ? 'Cards' : tab === 'analysis' ? 'Analysis' : 'Next Opponent'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ---- Cards Tab ---- */}
        {activeTab === 'cards' && (
          <>
            {POSITION_ORDER.filter(pos => groupedCards[pos]?.length).map(pos => (
              <div key={pos}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                  {pos} ({groupedCards[pos].length} {groupedCards[pos].length === 1 ? 'card' : 'cards'})
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {groupedCards[pos].map(card => (
                    <div key={card.id} className="relative">
                      <CardDisplay
                        card={card}
                        size="small"
                        onClick={() => setSelectedCard(card)}
                      />
                      {card.injured && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black text-orange-300 bg-black/70 px-1 rounded">
                          INJURED
                        </div>
                      )}
                      {card.durability === 'phoenix' && (
                        <div className="absolute -top-1 right-0 text-[8px] font-black text-orange-400 bg-black/70 px-1 rounded">
                          {'\u26a1'} {card.phoenixMatchesSurvived ?? 0}/3
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {deck.length === 0 && (
              <div className="text-center text-[var(--color-text-muted)] py-12">No cards in deck</div>
            )}
          </>
        )}

        {/* ---- Analysis Tab ---- */}
        {activeTab === 'analysis' && (
          <>
            {/* Archetype Mix */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Archetype Mix</div>
              {Object.entries(deckAnalysis.archetypeCounts)
                .sort(([,a], [,b]) => b - a)
                .map(([arch, count]) => {
                  const pct = (count / maxArchetypeCount) * 100;
                  const color = ARCHETYPE_COMPOUND_COLORS[arch] ?? '#71717a';
                  return (
                    <div key={arch} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)] w-20 text-right truncate">{arch}</span>
                      <div className="flex-1 h-4 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
                        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                      </div>
                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)] w-4">{count}</span>
                    </div>
                  );
                })}
            </div>

            {/* Durability Risk */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Durability Risk</div>
              {(() => {
                const reliable = (deckAnalysis.durabilityCounts['standard'] ?? 0) +
                  (deckAnalysis.durabilityCounts['iron'] ?? 0) +
                  (deckAnalysis.durabilityCounts['titanium'] ?? 0);
                const risky = (deckAnalysis.durabilityCounts['glass'] ?? 0) +
                  (deckAnalysis.durabilityCounts['phoenix'] ?? 0) +
                  (deckAnalysis.durabilityCounts['fragile'] ?? 0);
                const total = Math.max(1, reliable + risky);
                const reliablePct = Math.round((reliable / total) * 100);
                return (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-[var(--color-bg-elevated)] rounded overflow-hidden flex">
                        <div className="h-full bg-green-500/60 transition-all" style={{ width: `${reliablePct}%` }} />
                        <div className="h-full bg-red-500/60 transition-all" style={{ width: `${100 - reliablePct}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-green-400">{reliablePct}% reliable ({reliable} Standard/Iron/Titanium)</span>
                      <span className="text-red-400">{100 - reliablePct}% risky ({risky} Glass/Fragile/Phoenix)</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Position Coverage */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Position Coverage</div>
              <div className="flex flex-wrap gap-1.5">
                {POSITION_ORDER.map(pos => {
                  const count = deckAnalysis.positionCounts[pos] ?? 0;
                  return (
                    <span key={pos} className={`px-1.5 py-0.5 rounded text-[9px] font-bold
                      ${count === 0
                        ? 'bg-red-900/30 text-red-400 border border-red-700/30'
                        : count === 1
                        ? 'bg-orange-900/20 text-orange-300 border border-orange-700/30'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                      }`}>
                      {pos}:{count}
                    </span>
                  );
                })}
              </div>
              {deckAnalysis.warnings.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {deckAnalysis.warnings.map((w, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-900/20 text-orange-300 border border-orange-700/30">
                      {'\u26a0'} {w}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active Synergies */}
            {deckAnalysis.activeSynergies.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Active Synergies {'\u2713'}</div>
                <div className="space-y-1">
                  {deckAnalysis.activeSynergies.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-green-900/20 border border-green-700/30">
                      <span className="text-green-400 text-[10px]">{'\u2713'}</span>
                      <span className="text-[10px] font-bold text-green-300">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Near Synergies */}
            {deckAnalysis.nearSynergies.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Near Synergies {'\u25cb'}</div>
                <div className="space-y-1">
                  {deckAnalysis.nearSynergies.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                      <span className="text-[var(--color-text-muted)] text-[10px]">{'\u25cb'}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        <span className="font-bold text-[var(--color-text-secondary)]">{s.name}</span> {'\u2014'} need {s.missing}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personality Themes */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Personality Themes</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(personalityThemeCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([theme, count]) => (
                    <span key={theme} className={`px-2 py-1 rounded text-[10px] font-bold
                      ${count >= 3
                        ? 'bg-purple-900/30 text-purple-300 border border-purple-600/40'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                      }`}>
                      {THEME_ICONS[theme] ?? ''} {theme}: {count}
                    </span>
                  ))}
              </div>
              {(() => {
                const hasResonance = Object.values(personalityThemeCounts).some(c => c >= 3);
                return hasResonance
                  ? <div className="text-[9px] text-purple-300 font-bold">{'\u2713'} Personality resonance active!</div>
                  : <div className="text-[9px] text-[var(--color-text-muted)]">{'\u2192'} No theme has 3+ yet {'\u2014'} build towards resonance!</div>;
              })()}
            </div>
          </>
        )}

        {/* ---- Next Opponent Tab ---- */}
        {activeTab === 'opponent' && (
          <>
            {nextOpponentBuild ? (
              <>
                {/* Opponent header */}
                <div className="bg-red-950/30 rounded-lg px-4 py-3 border border-red-900/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-red-300">{nextOpponentBuild.name}</div>
                      <div className="text-[10px] text-red-400/70">{nextOpponentBuild.formation} | {nextOpponentBuild.style}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-red-400/70">Strength</div>
                      <div className="text-lg font-black text-red-300">{nextOpponentBuild.baseStrength}</div>
                    </div>
                  </div>
                </div>

                {/* Opponent XI */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-400">Their XI</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {nextOpponentBuild.xi.map((p, i) => (
                      <OpponentCardDisplay key={i} player={p} isStar={p.name === nextOpponentBuild.starPlayer.name} />
                    ))}
                  </div>
                </div>

                {/* Star player */}
                <div className="flex items-center gap-2 bg-yellow-900/20 rounded px-3 py-2 border border-yellow-700/30">
                  <span className="text-sm">{'\u2b50'}</span>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-yellow-300">{nextOpponentBuild.starPlayer.name}</span>
                    <span className="text-[9px] text-yellow-400/70 ml-1.5">{nextOpponentBuild.starAbility}</span>
                  </div>
                </div>

                {/* Their synergies */}
                {nextOpponentBuild.synergies.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-red-400">Their Synergies</div>
                    <div className="flex flex-wrap gap-1">
                      {nextOpponentBuild.synergies.map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-900/20 text-red-300 border border-red-800/30">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weakness callout */}
                <div className="bg-green-900/20 rounded-lg px-4 py-3 border border-green-700/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{'\u26a1'}</span>
                    <span className="text-xs font-bold text-green-300">Weak to: {nextOpponentBuild.weaknessArchetype}</span>
                  </div>
                  <div className="text-[10px] text-green-400/70">{nextOpponentBuild.weakness}</div>
                  <div className="text-[10px] font-bold">
                    +3% goal chance per {nextOpponentBuild.weaknessArchetype} in your XI
                  </div>
                </div>

                {/* Your match */}
                {(() => {
                  const matchCount = deckAnalysis.opponentMatch.count;
                  return (
                    <div className={`rounded-lg px-4 py-3 border space-y-1 ${
                      matchCount > 0
                        ? 'bg-green-900/20 border-green-700/30'
                        : 'bg-orange-900/20 border-orange-700/30'
                    }`}>
                      <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Your Match</div>
                      {matchCount > 0 ? (
                        <div className="text-sm font-bold text-green-300">
                          You have {matchCount} {nextOpponentBuild.weaknessArchetype}{matchCount > 1 ? 's' : ''} {'\u2014'} +{matchCount * 3}% goal chance bonus! {'\u2713'.repeat(matchCount)}
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-orange-300">
                          {'\u26a0'} You have 0 {nextOpponentBuild.weaknessArchetype}s {'\u2014'} consider buying one
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center text-[var(--color-text-muted)] py-12">
                {runState.round >= 5 ? 'No more opponents — this is the final match!' : 'No opponent data available'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Card Detail Popup */}
      {selectedCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setSelectedCard(null)}>
          <div className="bg-[var(--color-bg-surface)] rounded-xl p-6 border border-[var(--color-border-subtle)] max-w-sm w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center">
              <CardDisplay card={selectedCard} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Position</div>
                <div className="font-bold">{selectedCard.position}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Archetype</div>
                <div className="font-bold">{selectedCard.archetype}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Role</div>
                <div className="font-bold">{selectedCard.tacticalRole ?? 'None'}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Personality</div>
                <div className="font-bold">{selectedCard.personalityTheme ?? 'General'}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Power</div>
                <div className="font-bold">{selectedCard.power}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)]">
                <div className="text-[var(--color-text-muted)]">Rarity</div>
                <div className="font-bold" style={{ color: RARITY_COLORS[selectedCard.rarity] }}>{selectedCard.rarity}</div>
              </div>
              <div className="bg-[var(--color-bg-elevated)] rounded px-2 py-1.5 border border-[var(--color-border-subtle)] col-span-2">
                <div className="text-[var(--color-text-muted)]">Durability</div>
                <div className="font-bold flex items-center gap-1">
                  <DurabilityBadge durability={selectedCard.durability} />
                  {selectedCard.durability === 'phoenix' && (
                    <span className="text-orange-400 text-[9px] ml-1">
                      {'\u26a1'} Survived {selectedCard.phoenixMatchesSurvived ?? 0}/3
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ability */}
            {selectedCard.abilityName && (
              <div className="bg-[var(--color-bg-elevated)] rounded px-3 py-2 border border-[var(--color-accent-gold)]/30">
                <div className="text-[10px] text-[var(--color-accent-gold)] font-bold italic">{selectedCard.abilityName}</div>
                <div className="text-[9px] text-[var(--color-text-secondary)]">{selectedCard.abilityText}</div>
              </div>
            )}

            {/* Injured status */}
            {selectedCard.injured && (
              <div className="bg-orange-900/20 rounded px-3 py-2 border border-orange-700/30">
                <div className="text-[10px] font-bold text-orange-300">{'\ud83e\ude78'} INJURED {'\u2014'} misses next match</div>
              </div>
            )}

            {/* Sell button (shop phase only) */}
            {isShopPhase && onSellCard && (
              <button
                onClick={() => {
                  if (confirm(`Sell ${selectedCard.name} for \u00a3${getTransferFee(selectedCard).toLocaleString()}?`)) {
                    onSellCard(selectedCard);
                    setSelectedCard(null);
                  }
                }}
                className="w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)] border border-[var(--color-accent-green)]/30 hover:bg-[var(--color-accent-green)]/30 transition-all"
              >
                Sell for {'\u00a3'}{getTransferFee(selectedCard).toLocaleString()}
              </button>
            )}

            <button
              onClick={() => setSelectedCard(null)}
              className="w-full py-2 rounded-lg text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Game Controller
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Persistence — save/load run state to localStorage
// ---------------------------------------------------------------------------

const SAVE_KEY = 'kickoff-clash-run';
const HISTORY_KEY = 'kickoff-clash-history';

interface SavedRun {
  runState: RunState;
  phase: string;
  matchCommentary: string[];
  activeMatchState: MatchState | null;
  savedAt: number;
}

interface RunHistoryEntry {
  formation: string;
  style: string;
  wins: number;
  losses: number;
  result: 'won' | 'lost' | 'abandoned';
  timestamp: number;
}

function saveRunToStorage(data: SavedRun) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

function loadRunFromStorage(): SavedRun | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedRun;
  } catch { return null; }
}

function clearRunStorage() {
  localStorage.removeItem(SAVE_KEY);
}

function addToHistory(entry: RunHistoryEntry) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: RunHistoryEntry[] = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    // Keep last 20
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch { /* ignore */ }
}

function loadHistory(): RunHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Title Screen
// ---------------------------------------------------------------------------

function TitleScreen({ onNewRun, onContinue, hasSavedRun }: {
  onNewRun: () => void;
  onContinue: () => void;
  hasSavedRun: boolean;
}) {
  const [history] = useState(loadHistory);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-6xl font-black tracking-tight uppercase">
          <span className="text-[var(--color-accent-primary)]">Kickoff</span>{' '}
          <span className="text-[var(--color-accent-secondary)]">Clash</span>
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base">
          Roguelike card battler. 500 players. 5 matches. One shot.
        </p>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        {hasSavedRun && (
          <button
            onClick={onContinue}
            className="w-full px-8 py-4 rounded-lg text-lg font-black uppercase tracking-wide
              bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95
              shadow-lg shadow-[var(--color-accent-primary)]/30 transition-all"
          >
            Continue Run
          </button>
        )}
        <button
          onClick={onNewRun}
          className={`w-full px-8 py-4 rounded-lg text-lg font-black uppercase tracking-wide transition-all
            ${hasSavedRun
              ? 'bg-[var(--color-bg-surface)] border-2 border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-secondary)] hover:text-white'
              : 'bg-[var(--color-accent-primary)] text-white hover:brightness-110 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-accent-primary)]/30'
            }`}
        >
          New Run
        </button>
      </div>

      {/* Run History */}
      {history.length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Recent Runs
          </h3>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {history.slice(0, 8).map((h, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-xs">
                <div>
                  <span className="font-bold text-white">{h.formation}</span>
                  <span className="text-[var(--color-text-muted)] ml-1.5">
                    {Object.entries(PLAYING_STYLES).find(([k]) => k === h.style)?.[1]?.name ?? h.style}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-secondary)]">{h.wins}W-{h.losses}L</span>
                  <span className={`font-bold ${h.result === 'won' ? 'text-green-400' : h.result === 'lost' ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                    {h.result === 'won' ? 'WON' : h.result === 'lost' ? 'LOST' : 'DNF'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [runState, setRunState] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<'title' | 'setup' | 'pre_match' | 'match' | 'post_match' | 'shop' | 'end'>('title');
  const [lastMatchResult, setLastMatchResult] = useState<MatchResult | null>(null);
  const [lastDurabilityResult, setLastDurabilityResult] = useState<DurabilityResult | null>(null);
  const [matchCommentary, setMatchCommentary] = useState<string[]>([]);
  const [activeMatchState, setActiveMatchState] = useState<MatchState | null>(null);
  const [showDeckViewer, setShowDeckViewer] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  // Track the last matchState before it was cleared (for finalizeMatch)
  const lastMatchStateRef = useRef<MatchState | null>(null);
  const [hasSavedRun, setHasSavedRun] = useState(false);

  // Check for saved run on mount
  useEffect(() => {
    const saved = loadRunFromStorage();
    setHasSavedRun(!!saved);
  }, []);

  // Auto-save run state on changes
  useEffect(() => {
    if (runState && phase !== 'title' && phase !== 'end') {
      saveRunToStorage({
        runState,
        phase,
        matchCommentary,
        activeMatchState,
        savedAt: Date.now(),
      });
    }
  }, [runState, phase, matchCommentary, activeMatchState]);

  // Continue saved run
  const handleContinueRun = useCallback(() => {
    const saved = loadRunFromStorage();
    if (!saved) return;
    setRunState(saved.runState);
    setPhase(saved.phase as typeof phase);
    setMatchCommentary(saved.matchCommentary);
    setActiveMatchState(saved.activeMatchState);
  }, []);

  // 1. Setup -> create run, prepare pre-match
  const handleStart = useCallback((formation: string, style: string) => {
    const seed = Date.now();
    const run = createRun(formation, style, seed);
    // Immediately start match to populate XI
    const withMatch = startMatch(run);
    setRunState(withMatch);
    setActiveMatchState(withMatch.matchState);
    setPhase('pre_match');
  }, []);

  // 2. Pre-match -> enter match
  const handleStartMatch = useCallback(() => {
    setMatchCommentary([]);
    setPhase('match');
  }, []);

  // 3. Match -> play round (updated for Fix 1: subs)
  const handlePlayRound = useCallback((playedCards: ActionCard[], discardedIdx: number | null, subCardsPlayed?: ActionCard[]) => {
    if (!runState || !activeMatchState) return;

    // Fix 1: Handle substitutions first
    let currentMS = { ...activeMatchState };
    if (subCardsPlayed && subCardsPlayed.length > 0) {
      let currentXI = [...currentMS.xi];
      let currentBench = [...currentMS.bench];
      for (const subAC of subCardsPlayed) {
        const benchCard = subAC._benchCard;
        if (benchCard) {
          const result = executeSubstitution(currentXI, currentBench, benchCard);
          currentXI = result.xi;
          currentBench = result.bench;
        }
      }
      currentMS = { ...currentMS, xi: currentXI, bench: currentBench };
    }

    // Handle discard: remove card from hand, draw 1 replacement
    if (discardedIdx !== null && discardedIdx >= 0 && discardedIdx < currentMS.hand.length) {
      const newHand = [...currentMS.hand];
      newHand.splice(discardedIdx, 1);
      if (currentMS.actionDeck.length > 0 && newHand.length < 5) {
        newHand.push(currentMS.actionDeck[0]);
        currentMS = { ...currentMS, hand: newHand, actionDeck: currentMS.actionDeck.slice(1) };
      } else {
        currentMS = { ...currentMS, hand: newHand };
      }
    }

    // Save match state before round (for finalization if this is the last round)
    lastMatchStateRef.current = currentMS;

    // Play the round through the engine (pass weakness archetype for bonus)
    const currentOpponentBuild = getOpponentBuild(runState.round);
    const currentRun = { ...runState, matchState: currentMS };
    const { state: newRunState, result } = playRound(currentRun, playedCards, currentOpponentBuild.weaknessArchetype);

    // Accumulate commentary (never cleared between rounds)
    setMatchCommentary(prev => [...prev, ...result.commentary]);

    if (newRunState.status === 'postmatch') {
      // Build final match state with accumulated goals for finalizeMatch.
      // playRound already advanced goals on currentMS via advanceMatchState,
      // but status changed to postmatch and matchState was cleared.
      // We reconstruct from the pre-advance state + this round's result.
      const finalMS: MatchState = {
        ...currentMS,
        yourGoals: currentMS.yourGoals + (result.yourScored ? 1 : 0),
        opponentGoals: currentMS.opponentGoals + (result.opponentScored ? 1 : 0),
        fanAccumulator: currentMS.fanAccumulator + result.fansEarned,
      };

      const { state: finalState, matchResult, durabilityResult } = finalizeMatch(
        { ...runState, matchState: finalMS },
        finalMS,
      );

      setRunState(finalState);
      setLastMatchResult(matchResult);
      setLastDurabilityResult(durabilityResult);
      setActiveMatchState(null);
      setPhase('post_match');
    } else {
      // Match continues -- newRunState.matchState has updated goals, new hand, etc.
      setRunState(newRunState);
      setActiveMatchState(newRunState.matchState);
    }
  }, [runState, activeMatchState]);

  // 4. Post-match -> shop or end
  const handlePostMatchContinue = useCallback(() => {
    if (!runState) return;
    if (runState.status === 'won' || runState.status === 'lost') {
      setPhase('end');
    } else {
      setPhase('shop');
    }
  }, [runState]);

  // 5. Shop actions
  const handleBuyCard = useCallback((card: Card, cost: number) => {
    if (!runState || runState.cash < cost) return;
    let newState = { ...runState, cash: runState.cash - cost };
    newState = addCardToDeck(newState, card);
    setRunState(newState);
  }, [runState]);

  const handleSellCard = useCallback((card: Card) => {
    if (!runState) return;
    setRunState(sellCard(runState, card));
  }, [runState]);

  const handleBuyItem = useCallback((item: ShopItem) => {
    if (!runState) return;
    const result = buyShopItem(runState, item);
    if (result) setRunState(result);
  }, [runState]);

  const handleBuyAcademy = useCallback((card: Card) => {
    if (!runState) return;
    const result = buyAcademyPlayer(runState, card);
    if (result) setRunState(result);
  }, [runState]);

  const handleUpgradeAcademy = useCallback(() => {
    if (!runState) return;
    const result = upgradeAcademy(runState);
    if (result) setRunState(result);
  }, [runState]);

  const handleNextMatch = useCallback(() => {
    if (!runState) return;
    const advanced = advanceToNextMatch(runState);
    // Immediately start match to populate XI
    const withMatch = startMatch(advanced);
    setRunState(withMatch);
    setActiveMatchState(withMatch.matchState);
    setLastMatchResult(null);
    setLastDurabilityResult(null);
    setMatchCommentary([]);
    setPhase('pre_match');
  }, [runState]);

  // 6. New run (save old run to history first)
  const handleNewRun = useCallback(() => {
    if (runState) {
      addToHistory({
        formation: runState.formation,
        style: runState.playingStyle,
        wins: runState.wins,
        losses: runState.losses,
        result: runState.status === 'won' ? 'won' : runState.status === 'lost' ? 'lost' : 'abandoned',
        timestamp: Date.now(),
      });
    }
    clearRunStorage();
    setRunState(null);
    setPhase('setup');
    setLastMatchResult(null);
    setLastDurabilityResult(null);
    setMatchCommentary([]);
    setActiveMatchState(null);
    setHasSavedRun(false);
  }, [runState]);

  // Should the deck viewer button be visible?
  const showDeckButton = runState && phase !== 'title' && phase !== 'setup' && phase !== 'end';

  // Render current phase
  let phaseContent: React.ReactNode = null;
  switch (phase) {
    case 'title':
      phaseContent = (
        <TitleScreen
          onNewRun={() => setPhase('setup')}
          onContinue={handleContinueRun}
          hasSavedRun={hasSavedRun}
        />
      );
      break;

    case 'setup':
      phaseContent = <SetupPhase onStart={handleStart} />;
      break;

    case 'pre_match':
      if (!runState) break;
      phaseContent = <PreMatchPhase state={runState} onStartMatch={handleStartMatch} />;
      break;

    case 'match':
      if (!runState || !activeMatchState) break;
      phaseContent = (
        <MatchPhase
          state={runState}
          matchState={activeMatchState}
          commentary={matchCommentary}
          onPlayRound={handlePlayRound}
        />
      );
      break;

    case 'post_match':
      if (!runState || !lastMatchResult || !lastDurabilityResult) break;
      phaseContent = (
        <PostMatchPhase
          state={runState}
          matchResult={lastMatchResult}
          durabilityResult={lastDurabilityResult}
          allCommentary={matchCommentary}
          onContinue={handlePostMatchContinue}
        />
      );
      break;

    case 'shop':
      if (!runState) break;
      phaseContent = (
        <ShopPhase
          state={runState}
          onBuyCard={handleBuyCard}
          onSellCard={handleSellCard}
          onBuyItem={handleBuyItem}
          onBuyAcademy={handleBuyAcademy}
          onUpgradeAcademy={handleUpgradeAcademy}
          onNext={handleNextMatch}
        />
      );
      break;

    case 'end':
      if (!runState) break;
      phaseContent = <EndPhase state={runState} onNewRun={handleNewRun} />;
      break;

    default:
      phaseContent = <SetupPhase onStart={handleStart} />;
  }

  return (
    <InspectCardContext.Provider value={setDetailCard}>
      {phaseContent}

      {/* Floating Deck Viewer Button */}
      {showDeckButton && (
        <button
          onClick={() => setShowDeckViewer(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-sm
            bg-[var(--color-bg-surface)] border-2 border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]
            hover:border-[var(--color-accent-secondary)] hover:text-white hover:scale-105
            active:scale-95 transition-all shadow-lg shadow-black/30"
        >
          {'\ud83d\udccb'} Deck ({runState.deck.length})
        </button>
      )}

      {/* Deck Viewer Overlay */}
      {showDeckViewer && runState && (
        <DeckViewer
          runState={runState}
          phase={phase}
          onClose={() => setShowDeckViewer(false)}
          onSellCard={phase === 'shop' ? handleSellCard : undefined}
        />
      )}

      {/* Card Detail Popup */}
      {detailCard && (
        <CardDetailPopup card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </InspectCardContext.Provider>
  );
}
