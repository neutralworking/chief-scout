"use client";

import { useEffect, useState } from "react";
import { KCCard, type KCCardData } from "@/components/KCCard";

const RARITIES = ["all", "legendary", "epic", "rare", "uncommon", "common"] as const;
const POSITIONS = ["all", "GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"] as const;

export function KCPreviewTab() {
  const [cards, setCards] = useState<KCCardData[]>([]);
  const [rarity, setRarity] = useState<string>("all");
  const [position, setPosition] = useState<string>("all");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (rarity !== "all") params.set("rarity", rarity);
    if (position !== "all") params.set("position", position);
    params.set("limit", "48");

    fetch(`/api/kc-templates?${params}`)
      .then((r) => r.json())
      .then((data) => { setCards(data); setLoading(false); });
  }, [rarity, position]);

  const counts = cards.reduce(
    (acc, c) => { acc[c.suggested_rarity] = (acc[c.suggested_rarity] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {RARITIES.map((r) => (
            <button key={r} onClick={() => setRarity(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                rarity === r ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >{r}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button key={p} onClick={() => setPosition(p)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                position === p ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >{p}</button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(["sm", "md", "lg"] as const).map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase ${
                size === s ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Rarity counts */}
      <div className="mb-4 flex gap-4 text-xs text-zinc-500">
        {Object.entries(counts).map(([r, n]) => (
          <span key={r}><span className="font-bold text-zinc-300">{n}</span> {r}</span>
        ))}
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="text-center text-[var(--text-muted)] py-12">Loading templates...</div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {cards.map((card) => (
            <KCCard key={card.person_id} card={card} size={size} />
          ))}
        </div>
      )}
    </div>
  );
}
