/** Minimal SectionHeader — label with accent color underline */
export function SectionHeader({
  label,
  color = "cyan",
  action,
}: {
  label: string;
  color?: string;
  action?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    cyan: "var(--border-bright, #6fc3df)",
    technical: "var(--color-accent-technical)",
    tactical: "var(--color-accent-tactical)",
    mental: "var(--color-accent-mental)",
    physical: "var(--color-accent-physical)",
    personality: "var(--color-accent-personality)",
  };
  const c = colorMap[color] ?? colorMap.cyan;

  return (
    <div className="flex items-center justify-between">
      <h3
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: c }}
      >
        {label}
      </h3>
      {action}
    </div>
  );
}
