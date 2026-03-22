export type Grade = "A" | "B" | "C" | "D";

const GRADE_STYLES: Record<Grade, string> = {
  A: "bg-[var(--color-accent-mental)]/15 text-[var(--color-accent-mental)] border-[var(--color-accent-mental)]/30",
  B: "bg-[var(--border-bright)]/15 text-[var(--border-bright)] border-[var(--border-bright)]/30",
  C: "bg-[var(--color-accent-personality)]/15 text-[var(--color-accent-personality)] border-[var(--color-accent-personality)]/30",
  D: "bg-[var(--color-sentiment-negative)]/15 text-[var(--color-sentiment-negative)] border-[var(--color-sentiment-negative)]/30",
};

interface GradeBadgeProps {
  grade: Grade;
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${GRADE_STYLES[grade]}`}>
      {grade}
    </span>
  );
}

export function scoreToGrade(score: number | null | undefined): Grade {
  if (score == null) return "D";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}
