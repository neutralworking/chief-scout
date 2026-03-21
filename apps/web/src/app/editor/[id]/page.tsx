"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DofAssessmentSection from "./DofAssessmentSection";
import AttributeGradeEditor from "./AttributeGradeEditor";
import { FourPillarDashboard } from "@/components/FourPillarDashboard";

const POSITIONS = ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"];
const PURSUIT_OPTIONS = ["Priority", "Interested", "Scout Further", "Watch", "Monitor", "Pass"];
const CONTRACT_TAGS = ["Long-Term", "One Year Left", "Six Months", "Expiring", "Free Agent", "Extension Talks"];
const SQUAD_ROLES = ["Key Player", "Important Player", "Rotation", "Backup", "Youth", "Surplus"];
const FEET = ["Right", "Left", "Both"];

const PLAYING_MODELS = [
  "Controller", "Commander", "Creator", "Target", "Sprinter",
  "Powerhouse", "Cover", "Engine", "Destroyer", "Dribbler",
  "Passer", "Striker", "GK",
];

const BLUEPRINT_BY_POSITION: Record<string, string[]> = {
  GK: ["Shot-Stopper", "Complete Keeper", "Modern Keeper"],
  CD: ["Modern CB", "Ball-Playing CB", "Traditional CB", "Aggressive CB", "Ball Winner", "Progressor CB", "Hybrid Defender"],
  WD: ["Defensive Full-Back", "Overlapping Full-Back", "Attacking Full-Back", "Inverted Full-Back", "Two-Way Full-Back", "Flanker", "Playmaking Full-Back", "Ball-Playing Fullback"],
  DM: ["Anchor", "Deep-Lying Playmaker", "Conductor", "Regista", "Box-to-Box Anchor", "Ball Winner", "Holding Midfielder"],
  CM: ["Metronome", "Maestro", "Conductor", "Deep-Lying Playmaker", "Box-to-Box", "Box-to-Box Creator", "Driver", "Interior Playmaker", "Playmaker", "Technical Midfielder", "Ball Winner", "Holding Midfielder", "General"],
  WM: ["Tireless Technician", "Free-Roaming Attacker", "Wide Playmaker", "Work-Rate Winger", "Wide Runner"],
  AM: ["Playmaker", "Floating Playmaker", "Pressing Playmaker", "No.10", "Seconda Punta"],
  WF: ["Wizard", "Explosive Winger", "Inverted Winger", "Work-Rate Winger", "Direct Winger", "Inside Forward", "Wide Playmaker", "Flanker", "Defensive Winger", "No.10"],
  CF: ["Complete Striker", "Poacher", "Colossus", "Prima Punta", "Goal Machine", "Runner", "Mobile Striker", "Falso Nove", "Pressing Forward"],
};

const ALL_BLUEPRINTS = [...new Set(Object.values(BLUEPRINT_BY_POSITION).flat())].sort();

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-amber-700/60", CD: "bg-blue-700/60", WD: "bg-blue-600/60",
  DM: "bg-green-700/60", CM: "bg-green-600/60", WM: "bg-green-500/60",
  AM: "bg-purple-600/60", WF: "bg-red-600/60", CF: "bg-red-700/60",
};

interface PlayerData {
  person_id: number;
  name: string;
  club: string | null;
  nation: string | null;
  position: string | null;
  secondary_position: string | null;
  side: string | null;
  level: number | null;
  peak: number | null;
  overall: number | null;
  archetype: string | null;
  pursuit_status: string | null;
  scouting_notes: string | null;
  squad_role: string | null;
  blueprint: string | null;
  preferred_foot: string | null;
  height_cm: number | null;
  dob: string | null;
  contract_tag: string | null;
  // Completeness fields (from intelligence card)
  personality_type: string | null;
  market_value_tier: string | null;
}

interface Tag {
  id: number;
  tag_name: string;
  category: string;
  is_scout_only?: boolean;
}

interface PlayerTag {
  id: number;
  tag_id: number;
  tag_name: string;
  tag_category: string;
}

// Data completeness check items
interface CompletenessItem {
  label: string;
  filled: boolean;
}

function getCompleteness(player: PlayerData): CompletenessItem[] {
  return [
    { label: "Position", filled: !!player.position },
    { label: "Archetype", filled: !!player.archetype },
    { label: "Blueprint", filled: !!player.blueprint },
    { label: "Scouting Notes", filled: !!player.scouting_notes },
    { label: "Personality", filled: !!player.personality_type },
    { label: "Market Data", filled: !!player.market_value_tier },
  ];
}

function parseArchetype(archetype: string | null): { primary: string; secondary: string } {
  if (!archetype) return { primary: "", secondary: "" };
  const parts = archetype.split("-");
  return { primary: parts[0] ?? "", secondary: parts[1] ?? "" };
}

function composeArchetype(primary: string, secondary: string): string {
  if (!primary) return "";
  if (!secondary) return primary;
  return `${primary}-${secondary}`;
}

export default function PlayerEditorPage() {
  const params = useParams();
  const personId = Number(params.id);

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [profile, setProfile] = useState<Record<string, string | number | boolean | null>>({});
  const [primaryModel, setPrimaryModel] = useState("");
  const [secondaryModel, setSecondaryModel] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [playerTags, setPlayerTags] = useState<PlayerTag[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayer();
  }, [personId]);

  async function loadPlayer() {
    setLoading(true);
    setError(null);
    try {
      const [playerRes, tagsRes, playerTagsRes, statusRes] = await Promise.all([
        fetch(`/api/players/${personId}`),
        fetch("/api/tags"),
        fetch(`/api/players/${personId}/tags`),
        // Fetch intelligence card data for contract_tag + completeness fields
        fetch(`/api/admin/player-search?id=${personId}`),
      ]);

      if (!playerRes.ok) {
        setError("Player not found");
        setLoading(false);
        return;
      }

      const playerData = await playerRes.json();

      // Try to get contract_tag + completeness fields from intelligence card
      let contractTag: string | null = null;
      let personalityType: string | null = null;
      let marketValueTier: string | null = null;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const match = (statusData.players ?? []).find((p: { person_id: number }) => p.person_id === personId);
        if (match) {
          contractTag = match.contract_tag ?? null;
          personalityType = match.personality_type ?? null;
          marketValueTier = match.market_value_tier ?? null;
        }
      }

      const merged: PlayerData = {
        person_id: playerData.id ?? personId,
        name: playerData.name,
        club: playerData.club,
        nation: playerData.nation,
        position: playerData.position,
        secondary_position: playerData.secondary_position,
        side: playerData.Side ?? playerData.side,
        level: playerData.level,
        peak: playerData.peak,
        overall: playerData.overall,
        archetype: playerData.archetype,
        pursuit_status: playerData.pursuit_status,
        scouting_notes: playerData.scouting_notes,
        squad_role: playerData.squad_role,
        blueprint: playerData.blueprint,
        preferred_foot: playerData.preferred_foot,
        height_cm: playerData.height_cm,
        dob: playerData.date_of_birth ?? playerData.dob,
        contract_tag: contractTag,
        personality_type: personalityType,
        market_value_tier: marketValueTier,
      };

      setPlayer(merged);

      // Parse archetype into primary/secondary models
      const { primary, secondary } = parseArchetype(merged.archetype);
      setPrimaryModel(primary);
      setSecondaryModel(secondary);

      setProfile({
        position: merged.position ?? "",
        secondary_position: merged.secondary_position ?? "",
        side: merged.side ?? "",
        level: merged.level ?? "",
        peak: merged.peak ?? "",
        overall: merged.overall ?? "",
        archetype: merged.archetype ?? "",
        pursuit_status: merged.pursuit_status ?? "",
        contract_tag: merged.contract_tag ?? "",
        scouting_notes: merged.scouting_notes ?? "",
        squad_role: merged.squad_role ?? "",
        blueprint: merged.blueprint ?? "",
        preferred_foot: merged.preferred_foot ?? "",
        height_cm: merged.height_cm ?? "",
      });

      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        setAllTags(tags);
      }
      if (playerTagsRes.ok) {
        const pt = await playerTagsRes.json();
        setPlayerTags(pt);
      }
    } catch {
      setError("Failed to load player");
    } finally {
      setLoading(false);
    }
  }

  function setProfileField(field: string, value: string | number | boolean | null) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handlePrimaryModelChange(value: string) {
    setPrimaryModel(value);
    // Clear secondary if it matches the new primary
    const newSecondary = secondaryModel === value ? "" : secondaryModel;
    setSecondaryModel(newSecondary);
    setProfileField("archetype", composeArchetype(value, newSecondary));
  }

  function handleSecondaryModelChange(value: string) {
    setSecondaryModel(value);
    setProfileField("archetype", composeArchetype(primaryModel, value));
  }

  async function addTag(tagId: number) {
    try {
      const res = await fetch(`/api/players/${personId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tagId }),
      });
      if (res.ok) {
        const pt = await fetch(`/api/players/${personId}/tags`);
        if (pt.ok) setPlayerTags(await pt.json());
      }
    } catch {
      // ignore
    }
    setTagFilter("");
  }

  async function removeTag(tagId: number) {
    try {
      await fetch(`/api/players/${personId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tagId }),
      });
      setPlayerTags((prev) => prev.filter((t) => t.tag_id !== tagId));
    } catch {
      // ignore
    }
  }

  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const promises: Promise<Response>[] = [];

      // Save profile fields
      const profileUpdates: Record<string, unknown> = {};
      if (profile.position) profileUpdates.position = profile.position;
      if (profile.secondary_position !== undefined) profileUpdates.secondary_position = profile.secondary_position || null;
      if (profile.side !== undefined) profileUpdates.side = profile.side || null;
      if (profile.level !== "" && profile.level != null) profileUpdates.level = Number(profile.level);
      if (profile.peak !== "" && profile.peak != null) profileUpdates.peak = Number(profile.peak);
      if (profile.overall !== "" && profile.overall != null) profileUpdates.overall = Number(profile.overall);
      if (profile.archetype) profileUpdates.archetype = profile.archetype;
      if (profile.blueprint !== undefined) profileUpdates.blueprint = profile.blueprint || null;

      if (Object.keys(profileUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "player_profiles", updates: profileUpdates }),
          })
        );
      }

      // Save status fields (pursuit_status, squad_role, scouting_notes, contract_tag)
      const statusUpdates: Record<string, unknown> = {};
      if (profile.pursuit_status) statusUpdates.pursuit_status = profile.pursuit_status;
      if (profile.squad_role !== undefined) statusUpdates.squad_role = profile.squad_role || null;
      if (profile.scouting_notes !== undefined) statusUpdates.scouting_notes = profile.scouting_notes || null;
      if (profile.contract_tag !== undefined) statusUpdates.contract_tag = profile.contract_tag || null;

      if (Object.keys(statusUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "player_status", updates: statusUpdates }),
          })
        );
      }

      // Save people fields
      const peopleUpdates: Record<string, unknown> = {};
      if (profile.preferred_foot) peopleUpdates.preferred_foot = profile.preferred_foot;
      if (profile.height_cm !== "" && profile.height_cm != null) peopleUpdates.height_cm = Number(profile.height_cm);

      if (Object.keys(peopleUpdates).length > 0) {
        promises.push(
          fetch("/api/admin/player-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: personId, table: "people", updates: peopleUpdates }),
          })
        );
      }

      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(`${failed.length} update(s) failed`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }, [personId, profile]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-[var(--text-muted)] border-t-[var(--accent-tactical)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/editor" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-4 inline-block">
          &larr; Back to search
        </Link>
        <div className="text-center py-20 text-[var(--text-muted)]">{error}</div>
      </div>
    );
  }

  if (!player) return null;

  const completenessItems = getCompleteness(player);
  const filledCount = completenessItems.filter((c) => c.filled).length;

  // Blueprint options filtered by current position
  const currentPosition = String(profile.position ?? "");
  const blueprintOptions = currentPosition && BLUEPRINT_BY_POSITION[currentPosition]
    ? BLUEPRINT_BY_POSITION[currentPosition]
    : ALL_BLUEPRINTS;

  // Secondary model options: exclude selected primary
  const secondaryModelOptions = PLAYING_MODELS.filter((m) => m !== primaryModel);

  // Group tags by category
  const tagsByCategory = allTags.reduce<Record<string, Tag[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  const playerTagIds = new Set(playerTags.map((t) => t.tag_id));

  // Filter available tags
  const availableTags = allTags.filter(
    (t) => !playerTagIds.has(t.id) && (tagFilter === "" || t.tag_name.toLowerCase().includes(tagFilter.toLowerCase()))
  );

  const CATEGORY_LABELS: Record<string, string> = {
    scouting: "Scouting", style: "Style", fitness: "Fitness",
    mental: "Mental", tactical: "Tactical", contract: "Contract",
    disciplinary: "Disciplinary", archetype: "Archetype",
  };

  const TAG_CATEGORY_COLORS: Record<string, string> = {
    scouting: "bg-[var(--accent-tactical)]/20 text-[var(--accent-tactical)] border-[var(--accent-tactical)]/30",
    style: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    fitness: "bg-green-500/20 text-green-400 border-green-500/30",
    mental: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    tactical: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    contract: "bg-red-500/20 text-red-400 border-red-500/30",
    disciplinary: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    archetype: "bg-[var(--accent-personality)]/20 text-[var(--accent-personality)] border-[var(--accent-personality)]/30",
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <Link href="/editor" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          &larr; Back to search
        </Link>
        <Link href={`/players/${personId}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          View profile &rarr;
        </Link>
      </div>

      {/* Header */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {player.position && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[player.position] ?? "bg-gray-600/60"} text-white`}>
                  {player.position}
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)]">
                {[player.club, player.nation].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">#{personId}</span>
        </div>
      </div>

      {/* Data Completeness */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Data Completeness</h2>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{filledCount}/{completenessItems.length}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {completenessItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium ${
                item.filled
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              <span className="text-xs">{item.filled ? "\u2713" : "\u2717"}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Scouting Profile (PRIMARY) */}
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Scouting Profile</h2>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <FieldSelect label="Position" value={String(profile.position ?? "")} options={POSITIONS} onChange={(v) => setProfileField("position", v)} />
          <FieldSelect label="2nd Position" value={String(profile.secondary_position ?? "")} options={POSITIONS} onChange={(v) => setProfileField("secondary_position", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <FieldSelect label="Primary Model" value={primaryModel} options={PLAYING_MODELS} onChange={handlePrimaryModelChange} />
          <FieldSelect label="Secondary Model" value={secondaryModel} options={secondaryModelOptions} onChange={handleSecondaryModelChange} placeholder="— None —" />
        </div>

        <div className="mb-3">
          <FieldSelect label="Blueprint" value={String(profile.blueprint ?? "")} options={blueprintOptions} onChange={(v) => setProfileField("blueprint", v)} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <FieldSelect label="Side" value={String(profile.side ?? "")} options={["Left", "Right", "Central", "Both"]} onChange={(v) => setProfileField("side", v)} />
          <FieldSelect label="Foot" value={String(profile.preferred_foot ?? "")} options={FEET} onChange={(v) => setProfileField("preferred_foot", v)} />
          <FieldNumber label="Height (cm)" value={profile.height_cm as number} onChange={(v) => setProfileField("height_cm", v)} min={140} max={220} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <FieldNumber label="Level" value={profile.level as number} onChange={(v) => setProfileField("level", v)} min={1} max={99} />
          <FieldNumber label="Peak" value={profile.peak as number} onChange={(v) => setProfileField("peak", v)} min={1} max={99} />
          <div className="flex flex-col">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Overall</label>
            <div className="px-2 py-2.5 rounded-md bg-[var(--bg-surface-solid)]/50 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono">
              {profile.overall ?? "—"}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Scouting Notes</label>
          <textarea
            value={String(profile.scouting_notes ?? "")}
            onChange={(e) => setProfileField("scouting_notes", e.target.value)}
            placeholder="Write scouting observations, strengths, weaknesses, tactical fit..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors resize-y"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="glass rounded-xl p-4 mb-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Tags</h2>

        {/* Current tags */}
        {playerTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {playerTags.map((pt) => (
              <button
                key={pt.tag_id}
                onClick={() => removeTag(pt.tag_id)}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-opacity hover:opacity-70 ${TAG_CATEGORY_COLORS[pt.tag_category] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
                title={`Remove ${pt.tag_name}`}
              >
                {pt.tag_name}
                <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Tag search + add */}
        <div className="relative">
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Search tags to add..."
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
          />

          {tagFilter.length > 0 && availableTags.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              {availableTags.slice(0, 20).map((t) => (
                <button
                  key={t.id}
                  onClick={() => addTag(t.id)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-[var(--bg-elevated)]/50 transition-colors flex items-center justify-between"
                >
                  <span>{t.tag_name}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick-add by category */}
        {tagFilter === "" && (
          <div className="mt-3 space-y-2">
            {["scouting", "style", "fitness", "mental", "tactical", "contract"].map((cat) => {
              const tags = (tagsByCategory[cat] ?? []).filter((t) => !playerTagIds.has(t.id));
              if (tags.length === 0) return null;
              return (
                <div key={cat}>
                  <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addTag(t.id)}
                        className="text-[9px] px-2.5 py-1.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-tactical)]/50 transition-colors"
                      >
                        + {t.tag_name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Four-Pillar Assessment (live scorecard) */}
      <div className="mb-4">
        <FourPillarDashboard playerId={personId} />
      </div>

      {/* Attribute Grades */}
      <AttributeGradeEditor personId={personId} />

      {/* Status (collapsible, closed by default) */}
      <CollapsibleSection title="Status" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldSelect label="Contract" value={String(profile.contract_tag ?? "")} options={CONTRACT_TAGS} onChange={(v) => setProfileField("contract_tag", v)} />
          <FieldSelect label="Squad Role" value={String(profile.squad_role ?? "")} options={SQUAD_ROLES} onChange={(v) => setProfileField("squad_role", v)} />
        </div>
      </CollapsibleSection>

      {/* Overall Override (collapsible, closed by default) */}
      <CollapsibleSection title="Overall Override" defaultOpen={false}>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">Auto-computed by pipeline. Only override if you know what you&apos;re doing.</p>
        <div className="grid grid-cols-1 gap-3">
          <FieldNumber label="Overall" value={profile.overall as number} onChange={(v) => setProfileField("overall", v)} min={1} max={99} />
        </div>
      </CollapsibleSection>

      {/* DoF Assessment */}
      <DofAssessmentSection personId={personId} />

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-50">
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <div className="glass rounded-xl p-3 flex items-center justify-between border border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-muted)]">
              {error && <span className="text-red-400">{error}</span>}
              {saved && <span className="text-[var(--accent-tactical)]">Saved</span>}
              {!error && !saved && (
                <span>{playerTags.length} tags · {player.position ?? "No position"} · {filledCount}/{completenessItems.length} fields</span>
              )}
            </div>
            <button
              onClick={saveAll}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-[var(--accent-tactical)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</h2>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Field Components ────────────────────────────────────────────────────────

function FieldSelect({ label, value, options, onChange, placeholder }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-tactical)]"
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FieldNumber({ label, value, onChange, min, max }: { label: string; value: number | string; onChange: (v: number | string) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        min={min}
        max={max}
        className="w-full px-2 py-2.5 rounded-md bg-[var(--bg-surface-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-tactical)]"
      />
    </div>
  );
}
