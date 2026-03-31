import Link from "next/link";
import { PlayerCard as PlayerCardComponent } from "@/components/PlayerCard";
import type { PlayerCard as PlayerCardType } from "@/lib/types";

const FEATURES = [
  {
    title: "Role-Fit Scoring",
    description:
      "Every player scored against 42 tactical roles. Don't just know if they're good — know where they're good.",
    accent: "var(--color-accent-tactical)",
  },
  {
    title: "Personality Profiling",
    description:
      "16 types built on how players think, compete, and lead. The difference between a signing and a fit.",
    accent: "var(--color-accent-personality)",
  },
  {
    title: "Transfer Intelligence",
    description:
      "Valuations, contract status, and free agent tracking. Know the market before the market knows itself.",
    accent: "var(--color-accent-mental)",
  },
];

const STATS = [
  { value: "28,000+", label: "Players" },
  { value: "42", label: "Tactical Roles" },
  { value: "16", label: "Personality Types" },
  { value: "9,200+", label: "Full Profiles" },
];

export function LandingPage({
  showcasePlayers,
}: {
  showcasePlayers: PlayerCardType[];
}) {
  return (
    <div className="landing-page -m-4 -mt-16 lg:-m-8 lg:-ml-64 lg:pl-0">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div>
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            CHIEF SCOUT
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/free-agents"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-accent-personality)] text-[#06060c] hover:brightness-110 transition-all"
          >
            Try Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-12 pb-16 max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.1]">
            See what the{" "}
            <span className="text-[var(--color-accent-personality)]">
              stats don&apos;t tell you
            </span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mt-5 leading-relaxed max-w-xl">
            Role-fit scores, personality profiles, and transfer intelligence
            on 19,000+ players. Find who fits your system — not just who&apos;s available.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/free-agents"
              className="text-sm font-semibold px-6 py-3 rounded-lg bg-[var(--color-accent-personality)] text-[#06060c] hover:brightness-110 transition-all"
            >
              Explore Free Agents
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold px-6 py-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
            >
              See Pricing
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-8 mt-14 pt-8 border-t border-[var(--border-subtle)]">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
                {stat.value}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-8">
            What makes Chief Scout different
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl p-6"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${feature.accent} 8%, transparent), transparent)`,
                  border: `1px solid color-mix(in srgb, ${feature.accent} 15%, transparent)`,
                }}
              >
                <h3
                  className="text-sm font-bold mb-2"
                  style={{ color: feature.accent }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase: Real player cards */}
      {showcasePlayers.length > 0 && (
        <section className="px-6 py-16 border-t border-[var(--border-subtle)]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Live Data
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-8">
              Live from the database.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {showcasePlayers.map((player) => (
                <PlayerCardComponent
                  key={player.person_id}
                  player={player}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing CTA */}
      <section className="px-6 py-16 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
            Pick your level
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
            Free gets you started. Scout gets you serious. Pro gets you
            everything.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { name: "Free", price: "£0", sub: "forever" },
              {
                name: "Scout",
                price: "£9",
                sub: "/month",
                highlight: true,
              },
              { name: "Pro", price: "£29", sub: "/month" },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl p-6 w-44 ${
                  tier.highlight
                    ? "border-2 border-[var(--color-accent-personality)] bg-[var(--color-accent-personality)]/5"
                    : "border border-[var(--border-subtle)]"
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  {tier.name}
                </div>
                <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
                  {tier.price}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    {tier.sub}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/pricing"
              className="text-sm font-semibold px-6 py-3 rounded-lg bg-[var(--color-accent-personality)] text-[#06060c] hover:brightness-110 transition-all"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <span>&copy; {new Date().getFullYear()} Chief Scout</span>
          <div className="flex gap-4">
            <Link
              href="/free-agents"
              className="hover:text-[var(--text-secondary)] transition-colors"
            >
              Free Agents
            </Link>
            <Link
              href="/players"
              className="hover:text-[var(--text-secondary)] transition-colors"
            >
              Players
            </Link>
            <Link
              href="/choices"
              className="hover:text-[var(--text-secondary)] transition-colors"
            >
              Gaffer
            </Link>
            <Link
              href="/pricing"
              className="hover:text-[var(--text-secondary)] transition-colors"
            >
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
