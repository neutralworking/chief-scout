"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScoutingNotes } from "@/components/ScoutingNotes";

interface ScoutingNotesAdminProps {
  personId: number;
  text: string;
  initialFlagged: boolean;
  clamp?: number;
  className?: string;
}

export function ScoutingNotesAdmin({ personId, text, initialFlagged, clamp = 2, className = "" }: ScoutingNotesAdminProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [flagged, setFlagged] = useState(initialFlagged);
  const router = useRouter();

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem("network_admin") === "1");
  }, []);

  async function handleToggleFlag() {
    const newVal = !flagged;
    setFlagged(newVal);
    try {
      const res = await fetch("/api/admin/player-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId, table: "player_status", updates: { notes_flagged: newVal } }),
      });
      if (!res.ok) {
        // Revert on failure
        setFlagged(!newVal);
      } else {
        router.refresh();
      }
    } catch {
      setFlagged(!newVal);
    }
  }

  return (
    <ScoutingNotes
      text={text}
      clamp={clamp}
      className={className}
      flagged={flagged}
      onToggleFlag={handleToggleFlag}
      showFlagButton={isAdmin}
    />
  );
}
