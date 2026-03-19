"use client";

/**
 * KCCard — Kickoff Clash card design
 * Marvel Snap meets Pokémon: bold power number, rarity frame,
 * archetype typing, stat bars, and prominent bio/flavor text.
 */

import { MiniRadar } from "@/components/MiniRadar";
import { getRoleRadarConfig } from "@/lib/role-radar";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KCCardData {
  person_id: number;
  name: string;
  position: string;
  archetype: string;
  blueprint?: string | null;
  personality_code: string;
  level?: number | null;
  peak?: number | null;
  overall: number;
  scouting_notes?: string | null;
  nation?: string | null;
  club?: string | null;
  active?: boolean;
  suggested_rarity: "legendary" | "epic" | "rare" | "uncommon" | "common";
  top_attributes: { attribute: string; score: number; source: string }[];
  fingerprint?: number[] | null;
  best_role?: string | null;
  // personality scores for radar
  ei?: number | null;
  sn?: number | null;
  tf?: number | null;
  jp?: number | null;
  competitiveness?: number | null;
  coachability?: number | null;
}

// ── Rarity themes ────────────────────────────────────────────────────────────

const RARITY = {
  legendary: {
    border: "border-amber-400",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.4)]",
    bg: "bg-gradient-to-b from-amber-950/80 via-zinc-950/90 to-zinc-950",
    badge: "bg-amber-500 text-black",
    label: "LEGENDARY",
    accent: "#fbbf24",
    barColor: "bg-amber-400",
  },
  epic: {
    border: "border-purple-500",
    glow: "shadow-[0_0_16px_rgba(168,85,247,0.35)]",
    bg: "bg-gradient-to-b from-purple-950/70 via-zinc-950/90 to-zinc-950",
    badge: "bg-purple-500 text-white",
    label: "EPIC",
    accent: "#a855f7",
    barColor: "bg-purple-400",
  },
  rare: {
    border: "border-blue-500",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)]",
    bg: "bg-gradient-to-b from-blue-950/60 via-zinc-950/90 to-zinc-950",
    badge: "bg-blue-500 text-white",
    label: "RARE",
    accent: "#3b82f6",
    barColor: "bg-blue-400",
  },
  uncommon: {
    border: "border-green-500",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.25)]",
    bg: "bg-gradient-to-b from-green-950/50 via-zinc-950/90 to-zinc-950",
    badge: "bg-green-600 text-white",
    label: "UNCOMMON",
    accent: "#22c55e",
    barColor: "bg-green-400",
  },
  common: {
    border: "border-zinc-500",
    glow: "",
    bg: "bg-gradient-to-b from-zinc-800/50 via-zinc-950/90 to-zinc-950",
    badge: "bg-zinc-600 text-zinc-200",
    label: "COMMON",
    accent: "#71717a",
    barColor: "bg-zinc-400",
  },
};

// Position type badges (Pokémon style)
const POS_TYPE: Record<string, { color: string; label: string }> = {
  GK: { color: "bg-yellow-600", label: "GK" },
  WD: { color: "bg-emerald-600", label: "WD" },
  CD: { color: "bg-sky-700", label: "CD" },
  DM: { color: "bg-teal-600", label: "DM" },
  CM: { color: "bg-indigo-600", label: "CM" },
  WM: { color: "bg-violet-600", label: "WM" },
  AM: { color: "bg-orange-600", label: "AM" },
  WF: { color: "bg-rose-600", label: "WF" },
  CF: { color: "bg-red-600", label: "CF" },
};

// ── Component ────────────────────────────────────────────────────────────────

export function KCCard({
  card,
  size = "md",
}: {
  card: KCCardData;
  size?: "sm" | "md" | "lg";
}) {
  const r = RARITY[card.suggested_rarity] || RARITY.common;
  const pos = POS_TYPE[card.position] || { color: "bg-zinc-600", label: card.position };
  const topAttrs = card.top_attributes?.slice(0, 6) || [];
  const power = card.overall ? Math.round(card.overall) : "?";

  // Radar config
  const radarConfig = getRoleRadarConfig(card.best_role || null, card.position || null);

  const isLg = size === "lg";
  const isSm = size === "sm";

  return (
    <div
      className={`
        relative overflow-hidden border-2 ${r.border} ${r.glow} ${r.bg}
        rounded-2xl
        ${isSm ? "w-[220px]" : isLg ? "w-[340px]" : "w-[280px]"}
        transition-all duration-200 hover:scale-[1.02]
        flex flex-col
      `}
    >
      {/* ── Top bar: Cost + Name + Position type ─────────────────── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {/* Power number — Marvel Snap style top-left */}
        <div
          className={`
            ${isSm ? "w-9 h-9 text-lg" : "w-11 h-11 text-xl"}
            rounded-xl font-black flex items-center justify-center shrink-0
            bg-black/60 border ${r.border}
          `}
          style={{ color: r.accent }}
        >
          {power}
        </div>

        {/* Name + club */}
        <div className="min-w-0 flex-1">
          <div
            className={`
              font-bold truncate text-white
              ${isSm ? "text-sm" : "text-base"}
            `}
          >
            {card.name}
          </div>
          {card.club && (
            <div className="text-[11px] text-zinc-400 truncate">{card.club}</div>
          )}
        </div>

        {/* Position type pill — Pokémon style */}
        <div
          className={`
            ${pos.color} rounded-full shrink-0
            ${isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}
            font-bold text-white uppercase tracking-wider
          `}
        >
          {pos.label}
        </div>
      </div>

      {/* ── Card art area — archetype + radar ────────────────────── */}
      <div
        className={`
          mx-3 mt-1 rounded-xl overflow-hidden
          bg-black/40 border border-white/5
          ${isSm ? "h-28" : isLg ? "h-44" : "h-36"}
          flex items-center justify-center relative
        `}
      >
        {/* Archetype watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
          <span className={`font-black uppercase ${isSm ? "text-4xl" : "text-6xl"} tracking-widest`}>
            {card.archetype?.split("-")[0]}
          </span>
        </div>

        {/* Radar fingerprint */}
        {radarConfig && card.fingerprint && card.fingerprint.some((v) => v > 0) && (() => {
          const labels = radarConfig.labels.length === card.fingerprint!.length
            ? radarConfig.labels
            : radarConfig.labels.slice(0, card.fingerprint!.length);
          return (
            <div className={`${isSm ? "scale-75" : isLg ? "scale-110" : ""}`}>
              <MiniRadar
                values={card.fingerprint!}
                labels={labels}
                showLabels={!isSm}
                color={r.accent}
                size={isSm ? 80 : 110}
              />
            </div>
          );
        })()}

        {/* Nation flag top-right */}
        {card.nation && (
          <div className="absolute top-2 right-2 text-[11px] text-zinc-500">
            {card.nation}
          </div>
        )}

        {/* Rarity badge bottom-left */}
        <div
          className={`
            absolute bottom-2 left-2
            ${r.badge} rounded-full
            px-2 py-0.5 text-[9px] font-black uppercase tracking-widest
          `}
        >
          {r.label}
        </div>

        {/* Personality code bottom-right */}
        <div className="absolute bottom-2 right-2 text-[11px] font-mono text-zinc-400">
          {card.personality_code}
        </div>
      </div>

      {/* ── Archetype title bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 mt-2">
        <div
          className={`
            font-bold uppercase tracking-wide
            ${isSm ? "text-[11px]" : "text-xs"}
          `}
          style={{ color: r.accent }}
        >
          {card.archetype}
        </div>
        {card.blueprint && (
          <div className="text-[10px] text-zinc-500 italic truncate ml-2">
            {card.blueprint}
          </div>
        )}
      </div>

      {/* ── Bio / Scouting notes — high visibility ───────────────── */}
      {card.scouting_notes && (
        <div
          className={`
            mx-3 mt-2 rounded-lg bg-black/30 border border-white/5
            ${isSm ? "px-2 py-1.5" : "px-3 py-2"}
          `}
        >
          <p
            className={`
              text-zinc-300 leading-snug italic
              ${isSm ? "text-[10px]" : isLg ? "text-sm" : "text-xs"}
            `}
          >
            &ldquo;{card.scouting_notes}&rdquo;
          </p>
        </div>
      )}

      {/* ── Stat bars — top attributes ───────────────────────────── */}
      <div className={`px-3 ${isSm ? "mt-1.5 mb-2" : "mt-2 mb-3"} space-y-1`}>
        {topAttrs.map((attr) => (
          <div key={attr.attribute} className="flex items-center gap-2">
            <span
              className={`
                text-zinc-400 uppercase tracking-wider shrink-0
                ${isSm ? "text-[8px] w-14" : "text-[9px] w-16"}
              `}
            >
              {formatAttr(attr.attribute)}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${r.barColor} rounded-full transition-all`}
                style={{ width: `${Math.min(attr.score, 99)}%` }}
              />
            </div>
            <span
              className={`
                font-mono font-bold shrink-0
                ${isSm ? "text-[9px] w-4" : "text-[10px] w-5"}
              `}
              style={{ color: r.accent }}
            >
              {Math.round(attr.score)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Bottom bar: peak + level badges ──────────────────────── */}
      <div
        className={`
          flex items-center justify-between border-t border-white/5
          ${isSm ? "px-3 py-1.5" : "px-3 py-2"}
        `}
      >
        <div className="flex items-center gap-2">
          {card.peak && (
            <span className="text-[10px] text-zinc-500">
              Peak <span className="font-bold text-zinc-300">{card.peak}</span>
            </span>
          )}
          {card.level && (
            <span className="text-[10px] text-zinc-500">
              Lvl <span className="font-bold text-zinc-300">{card.level}</span>
            </span>
          )}
        </div>
        {!card.active && (
          <span className="text-[9px] font-bold text-zinc-600 uppercase">Retired</span>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAttr(attr: string): string {
  return attr
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Close Range", "Finish")
    .replace("Long Range", "Shooting")
    .replace("Pass Accuracy", "Passing")
    .replace("Take Ons", "Dribble")
    .replace("Through Balls", "Thru Ball");
}
