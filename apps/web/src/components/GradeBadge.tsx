export type Grade = "S" | "A" | "B" | "C" | "D" | "E" | "F";

const GRADE_STYLES: Record<Grade, string> = {
  S: "bg-[var(--border-bright)]/15 text-[var(--border-bright)] border-[var(--border-bright)]/30",
  A: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)] border-[var(--color-accent-mental)]/30",
  B: "bg-[var(--color-accent-physical)]/15 text-[var(--color-accent-physical)] border-[var(--color-accent-physical)]/30",
  C: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)] border-[var(--color-accent-personality)]/30",
  D: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30",
  E: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)] border-[var(--color-sentiment-negative)]/30",
  F: "bg-zinc-600/15 text-zinc-600 border-zinc-600/30",
};

export function GradeBadge({ grade }: { grade: Grade | null }) {
  if (!grade) return null;
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${GRADE_STYLES[grade]}`}>
      {grade}
    </span>
  );
}

export function scoreToGrade(score: number | null | undefined): Grade | null {
  if (score == null) return null;
  if (score >= 90) return "S";
  if (score >= 85) return "A";
  if (score >= 78) return "B";
  if (score >= 73) return "C";
  if (score >= 68) return "D";
  if (score >= 62) return "E";
  return "F";
}
