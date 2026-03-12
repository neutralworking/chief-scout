import Link from "next/link";
import { POSITION_COLORS } from "@/lib/types";
import { getCardTheme, THEME_STYLES } from "@/lib/archetype-themes";

interface FeaturedPlayerData {
  person_id: number;
  name: string;
  position: string | null;
  club: string | null;
  nation: string | null;
  level: number | null;
  overall: number | null;
  archetype: string | null;
  blueprint: string | null;
  personality_type: string | null;
  market_value_tier: string | null;
  dob: string | null;
}

const PERSONALITY_NAMES: Record<string, { name: string; oneLiner: string }> = {
  ANLC: { name: "The General", oneLiner: "Structured reader, self-driven, organizes others, thrives in confrontation" },
  IXSP: { name: "The Genius", oneLiner: "Improviser, occasion-driven, self-contained, ice-cold under pressure" },
  ANSC: { name: "The Machine", oneLiner: "Reads the game systematically, self-motivated, quiet but relentless" },
  INLC: { name: "The Captain", oneLiner: "Instinct-driven, self-motivated, vocal leader, fierce competitor" },
  AXLC: { name: "The Showman", oneLiner: "Structured but feeds off atmosphere, demands attention, confrontational" },
  INSP: { name: "The Maestro", oneLiner: "Creative, self-motivated, quietly brilliant, composed under pressure" },
  ANLP: { name: "The Conductor", oneLiner: "Tactical organizer, self-driven, leads through control, ice-cold composure" },
  IXSC: { name: "The Maverick", oneLiner: "Flair player, needs the big stage, self-focused, rises to confrontation" },
  AXSC: { name: "The Enforcer", oneLiner: "Reads patterns, fuelled by occasion, self-focused, aggressive competitor" },
  AXSP: { name: "The Technician", oneLiner: "Structured, occasion-driven, self-contained, calm under pressure" },
  AXLP: { name: "The Orchestrator", oneLiner: "Tactical mind, feeds off the crowd, organizes others, composed decision-maker" },
  INLP: { name: "The Guardian", oneLiner: "Instinctive, self-motivated, vocal organizer, calm presence" },
  INSC: { name: "The Hunter", oneLiner: "Instinctive, self-driven, self-reliant, competitive edge" },
  IXLC: { name: "The Provocateur", oneLiner: "Improviser, occasion-driven, leads vocally, thrives on confrontation" },
  IXLP: { name: "The Playmaker", oneLiner: "Creative improviser, occasion-driven, organizes play, composed" },
  ANSP: { name: "The Professor", oneLiner: "Analytical, self-motivated, self-contained, composed under pressure" },
};

export function FeaturedPlayer({ player }: { player: FeaturedPlayerData }) {
  const theme = getCardTheme(player.personality_type);
  const styles = THEME_STYLES[theme];
  const personality = player.personality_type ? PERSONALITY_NAMES[player.personality_type] : null;
  const posColor = POSITION_COLORS[player.position ?? ""] ?? "bg-zinc-700/60";

  const age = player.dob
    ? Math.floor((Date.now() - new Date(player.dob).getTime()) / 31557600000)
    : null;

  return (
    <Link href={`/players/${player.person_id}`} className="block group">
      <div className={`${styles.card} p-5 hover:brightness-110 transition-all duration-200`}>
        <div className="flex items-start gap-1.5 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Featured
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Position + Name */}
            <div className="flex items-center gap-2.5 mb-2">
              <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${posColor} text-white`}>
                {player.position ?? "–"}
              </span>
              <h2 className={`text-xl ${styles.nameFont} text-[var(--text-primary)] truncate`}>
                {player.name}
              </h2>
            </div>

            {/* Club · Nation · Age */}
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              {[player.club, player.nation, age ? `${age}y` : null].filter(Boolean).join(" · ")}
            </p>

            {/* Archetype line */}
            {player.archetype && (
              <p className="text-sm text-[var(--accent-tactical)] mb-1">
                {player.archetype}
                {player.blueprint && (
                  <span className="text-[var(--text-muted)]"> · {player.blueprint}</span>
                )}
              </p>
            )}
          </div>

          {/* Personality badge area */}
          <div className="shrink-0 text-right">
            {player.personality_type && (
              <div>
                <span className={`inline-block font-mono text-2xl font-extrabold tracking-[0.12em] ${styles.personalityText}`}>
                  {player.personality_type}
                </span>
                {personality && (
                  <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
                    {personality.name}
                  </p>
                )}
              </div>
            )}
            {player.level != null && (
              <div className="mt-2">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Lvl </span>
                <span className="text-lg font-mono font-bold text-[var(--text-primary)]">{player.level}</span>
              </div>
            )}
          </div>
        </div>

        {/* One-liner */}
        {personality && (
          <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed italic">
            &ldquo;{personality.oneLiner}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}
