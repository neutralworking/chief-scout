/** Grade scale: numeric score → letter grade */
export function scoreToGrade(score: number | null): string {
  if (score === null) return "—";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function GradeBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "md" }) {
  const grade = scoreToGrade(score);
  const color =
    (score ?? 0) >= 80 ? "var(--color-accent-technical)" :
    (score ?? 0) >= 60 ? "var(--color-accent-mental)" :
    (score ?? 0) >= 40 ? "var(--color-accent-physical)" :
    "var(--text-muted)";

  return (
    <span
      className={`font-mono font-bold ${size === "md" ? "text-sm" : "text-xs"}`}
      style={{ color }}
    >
      {grade}
    </span>
  );
}
