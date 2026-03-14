import Link from "next/link";

/**
 * PersonalityExplorer — grid of the 5 personality themes.
 * Each theme links to the players page filtered by those personality types.
 */

interface PersonalityTheme {
  name: string;
  slug: string;
  types: string[];
  description: string;
  gradient: string;
  borderColor: string;
}

const THEMES: PersonalityTheme[] = [
  {
    name: "The General",
    slug: "general",
    types: ["ANLC", "ANSC", "INSC"],
    description: "Structured, disciplined, relentless",
    gradient: "from-zinc-800/80 to-zinc-900/80",
    borderColor: "border-l-zinc-400",
  },
  {
    name: "The Warrior",
    slug: "showman",
    types: ["AXLC", "IXSC", "IXLC"],
    description: "Flair-driven, feeds off the crowd",
    gradient: "from-fuchsia-950/40 to-amber-950/30",
    borderColor: "border-l-fuchsia-500",
  },
  {
    name: "The Maestro",
    slug: "maestro",
    types: ["INSP", "ANLP", "IXSP"],
    description: "Elegant, composed, quietly brilliant",
    gradient: "from-amber-950/20 to-zinc-900/80",
    borderColor: "border-l-amber-400",
  },
  {
    name: "The Captain",
    slug: "captain",
    types: ["INLC", "INLP", "AXSC"],
    description: "Commanding, vocal, leads from the front",
    gradient: "from-red-950/25 to-zinc-900/80",
    borderColor: "border-l-red-500",
  },
  {
    name: "The Professor",
    slug: "professor",
    types: ["ANSP", "AXSP", "IXLP", "AXLP"],
    description: "Analytical, precise, blueprint thinkers",
    gradient: "from-blue-950/25 to-zinc-900/80",
    borderColor: "border-l-blue-500",
  },
];

interface PersonalityCount {
  type: string;
  count: number;
}

export function PersonalityExplorer({ typeCounts }: { typeCounts: PersonalityCount[] }) {
  const countMap = new Map(typeCounts.map((tc) => [tc.type, tc.count]));

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
        Personality Types
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {THEMES.map((theme) => {
          const total = theme.types.reduce((sum, t) => sum + (countMap.get(t) ?? 0), 0);
          return (
            <Link
              key={theme.slug}
              href={`/players?personalities=${theme.types.join(",")}`}
              className="group block"
            >
              <div
                className={`border-l-2 ${theme.borderColor} bg-gradient-to-br ${theme.gradient} rounded-r-lg p-4 hover:brightness-125 transition-all duration-150`}
              >
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                  {theme.name}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mb-2 leading-snug">
                  {theme.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {theme.types.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] font-mono font-bold tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {total > 0 && (
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{total}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
