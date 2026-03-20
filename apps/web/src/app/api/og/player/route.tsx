import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const POS_COLORS: Record<string, string> = {
  GK: "#b45309", CD: "#1d4ed8", WD: "#2563eb", DM: "#15803d",
  CM: "#16a34a", WM: "#22c55e", AM: "#9333ea", WF: "#dc2626", CF: "#b91c1c",
};

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) return new Response("No DB", { status: 500 });

    const cols = "name,position,club,nation,dob,archetype,best_role,best_role_score,technical_score,tactical_score,mental_score,physical_score,overall_pillar_score";
    const r = await fetch(`${sbUrl}/rest/v1/player_intelligence_card?person_id=eq.${id}&select=${cols}&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    });
    const rows = await r.json();
    if (!rows?.[0]) return new Response("Not found", { status: 404 });
    const p = rows[0];

    const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000) : null;
    const posColor = POS_COLORS[p.position ?? ""] ?? "#555";
    const tec = p.technical_score != null ? String(p.technical_score) : "–";
    const tac = p.tactical_score != null ? String(p.tactical_score) : "–";
    const men = p.mental_score != null ? String(p.mental_score) : "–";
    const phy = p.physical_score != null ? String(p.physical_score) : "–";
    const overall = p.overall_pillar_score != null ? String(p.overall_pillar_score) : "";

    const scores = [p.technical_score, p.tactical_score, p.mental_score, p.physical_score];
    const colors = ["#d4a035", "#9b59b6", "#3dba6f", "#4a90d9"];
    let domColor = "#fff";
    let domVal = -1;
    for (let i = 0; i < 4; i++) {
      if (scores[i] != null && scores[i] > domVal) { domVal = scores[i]; domColor = colors[i]; }
    }

    const line2 = [p.club, p.nation, age != null ? `${age}y` : ""].filter(Boolean).join("  ·  ");
    const line3 = [p.archetype, p.best_role].filter(Boolean).join("  ·  ");
    const roleScore = p.best_role_score != null ? `Role Score: ${p.best_role_score}` : "";

    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#000", padding: 48, color: "#fff", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ background: posColor, color: "#fff", fontSize: 18, fontWeight: 700, padding: "6px 14px", borderRadius: 8, marginRight: 16 }}>{p.position ?? "–"}</div>
              <div style={{ fontSize: 46, fontWeight: 800, flexGrow: 1 }}>{p.name ?? "Unknown"}</div>
              <div style={{ fontSize: 54, fontWeight: 800, color: domColor }}>{overall}</div>
            </div>
            <div style={{ fontSize: 22, color: "#808080", marginBottom: 4 }}>{line2}</div>
            <div style={{ fontSize: 20, color: "#d4a035" }}>{line3}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e1e1e", borderRadius: 12, padding: "16px 32px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d4a035", letterSpacing: 1 }}>TEC</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{tec}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e1e1e", borderRadius: 12, padding: "16px 32px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9b59b6", letterSpacing: 1 }}>TAC</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{tac}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e1e1e", borderRadius: 12, padding: "16px 32px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3dba6f", letterSpacing: 1 }}>MEN</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{men}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e1e1e", borderRadius: 12, padding: "16px 32px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4a90d9", letterSpacing: 1 }}>PHY</div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{phy}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#555", letterSpacing: 2 }}>CHIEF SCOUT</div>
            <div style={{ fontSize: 15, color: "#808080" }}>{roleScore}</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }
}
