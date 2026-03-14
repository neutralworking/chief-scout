"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getClubList } from "@/lib/club-themes";
import Link from "next/link";

interface ProfileData {
  profile: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    preferences: Record<string, unknown>;
    created_at: string;
  };
  stats: {
    total_votes: number;
    squad_complete: boolean;
    squad_picks: { slot: number; player_name: string; person_id: number | null }[];
  };
  identity: {
    flair_vs_function: number | null;
    youth_vs_experience: number | null;
    attack_vs_defense: number | null;
    loyalty_vs_ambition: number | null;
    domestic_vs_global: number | null;
    stats_vs_eye_test: number | null;
    control_vs_chaos: number | null;
    era_bias: string | null;
  };
}

const POSITION_LABELS: Record<number, string> = {
  1: "GK", 2: "RB", 3: "CB", 4: "CB", 5: "LB",
  6: "CM", 7: "CM", 8: "CM",
  9: "RW", 10: "ST", 11: "LW",
};

export default function ProfilePage() {
  const { user, loading: authLoading, signOut, clubTheme, setClubTheme } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) fetchProfile();
  }, [user, authLoading]);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setDisplayName(d.profile.display_name ?? "");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveDisplayName() {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });
    setEditingName(false);
    fetchProfile();
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <p className="text-[var(--text-muted)]">Could not load profile.</p>
      </div>
    );
  }

  const { profile, stats, identity } = data;

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6 inline-block"
      >
        &larr; Back
      </Link>

      {/* Profile header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--accent-tactical)] flex items-center justify-center text-white text-xl font-bold">
              {(profile.display_name ?? profile.email ?? "?")[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent-tactical)]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
                />
                <button
                  onClick={saveDisplayName}
                  className="text-xs text-[var(--accent-tactical)] font-medium"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold truncate">
                  {profile.display_name ?? "Scout"}
                </h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  edit
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)] truncate">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold font-mono">{stats.total_votes}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Votes Cast</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold font-mono">
            {stats.squad_complete ? "11/11" : `${stats.squad_picks.length}/11`}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">All-Time XI</div>
        </div>
      </div>

      {/* All-Time XI summary */}
      {stats.squad_picks.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Your All-Time XI
            </span>
            <Link
              href="/choices"
              className="text-xs text-[var(--accent-tactical)] hover:opacity-80"
            >
              Edit
            </Link>
          </div>
          {stats.squad_picks.map((pick) => (
            <div
              key={pick.slot}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-0"
            >
              <span className="text-[10px] font-bold text-[var(--text-muted)] w-6 text-right">
                {POSITION_LABELS[pick.slot] ?? pick.slot}
              </span>
              <span className="text-sm font-medium">{pick.player_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footballing Identity */}
      {identity.era_bias && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Footballing Identity
          </div>
          <IdentityBar label="Flair vs Function" value={identity.flair_vs_function} left="Flair" right="Function" />
          <IdentityBar label="Youth vs Experience" value={identity.youth_vs_experience} left="Youth" right="Experience" />
          <IdentityBar label="Attack vs Defense" value={identity.attack_vs_defense} left="Attack" right="Defense" />
          <IdentityBar label="Loyalty vs Ambition" value={identity.loyalty_vs_ambition} left="Loyalty" right="Ambition" />
          <IdentityBar label="Domestic vs Global" value={identity.domestic_vs_global} left="Domestic" right="Global" />
          <IdentityBar label="Stats vs Eye Test" value={identity.stats_vs_eye_test} left="Stats" right="Eye Test" />
          <IdentityBar label="Control vs Chaos" value={identity.control_vs_chaos} left="Control" right="Chaos" />
          {identity.era_bias && (
            <div className="mt-3 text-center">
              <span className="text-xs text-[var(--text-muted)]">Era bias: </span>
              <span className="text-sm font-semibold capitalize">{identity.era_bias}</span>
            </div>
          )}
        </div>
      )}

      {/* Club theme */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Your Club
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Pick your supported club to personalise the app accent colours.
        </p>
        <select
          value={clubTheme ?? "none"}
          onChange={(e) => setClubTheme(e.target.value === "none" ? null : e.target.value)}
          className="w-full px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
        >
          <option value="none">No club selected</option>
          {getClubList().map((club) => (
            <option key={club.slug} value={club.slug}>
              {club.name}
            </option>
          ))}
        </select>
        {clubTheme && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "var(--accent-club, #3dba6f)" }} />
            <span className="text-xs text-[var(--text-secondary)]">Theme accent active</span>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="text-center mt-8 mb-8">
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function IdentityBar({
  value,
  left,
  right,
}: {
  label: string;
  value: number | null;
  left: string;
  right: string;
}) {
  if (value === null) return null;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent-tactical)] rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
