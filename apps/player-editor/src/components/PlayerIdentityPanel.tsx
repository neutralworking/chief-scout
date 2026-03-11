import { PersonalityBadge } from "@/components/PersonalityBadge";
import { ArchetypeShape } from "@/components/ArchetypeShape";

export interface PersonalityData {
  personalityType: string | null;
  ei: number | null;
  sn: number | null;
  tf: number | null;
  jp: number | null;
  competitiveness: number | null;
  coachability: number | null;
}

export interface ArchetypeData {
  archetype: string | null;
  confidence?: string | null;
  modelScores?: Record<string, number>;
  blueprint: string | null;
}

interface PlayerIdentityPanelProps {
  personality: PersonalityData;
  archetype: ArchetypeData;
  layout?: "horizontal" | "vertical";
}

export function PlayerIdentityPanel({
  personality,
  archetype,
  layout = "horizontal",
}: PlayerIdentityPanelProps) {
  const gridClass =
    layout === "horizontal"
      ? "grid grid-cols-1 md:grid-cols-2 gap-3"
      : "flex flex-col gap-3";

  return (
    <div
      className={gridClass}
      style={{
        background:
          "linear-gradient(135deg, rgba(232,197,71,0.05) 0%, transparent 60%)",
      }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
          Personality — WHO
        </h3>
        <PersonalityBadge
          personalityType={personality.personalityType}
          ei={personality.ei}
          sn={personality.sn}
          tf={personality.tf}
          jp={personality.jp}
          competitiveness={personality.competitiveness}
          coachability={personality.coachability}
          size="hero"
        />
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-4">
        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-3">
          Archetype — HOW
        </h3>
        <ArchetypeShape
          archetype={archetype.archetype}
          confidence={archetype.confidence}
          modelScores={archetype.modelScores}
          blueprint={archetype.blueprint}
          size="full"
        />
      </div>
    </div>
  );
}
