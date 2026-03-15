import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// ── Config ──────────────────────────────────────────────────────────────────

const RSS_SOURCES: Record<string, { url: string; category: string; filterFootball?: boolean }> = {
  bbc_football: { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", category: "general" },
  guardian_football: { url: "https://www.theguardian.com/football/rss", category: "general" },
  skysports_football: { url: "https://www.skysports.com/rss/12040", category: "general", filterFootball: true },
  espn_fc: { url: "https://www.espn.com/espn/rss/soccer/news", category: "general" },
  fourfourtwo: { url: "https://www.fourfourtwo.com/feeds/all", category: "general" },
  football_italia: { url: "https://football-italia.net/feed/", category: "league_ita" },
  "90min": { url: "https://www.90min.com/posts.rss", category: "general" },
};

const GEMINI_PROMPT = `You are a football scouting analyst. Analyze this news article and return structured JSON.

Article headline: {headline}
Article body: {body}

Return ONLY valid JSON with this structure:
{
  "summary": "1-2 sentence scouting-relevant summary",
  "story_type": "transfer|injury|performance|contract|disciplinary|tactical|other",
  "players": [
    {
      "name": "Full player name",
      "club": "Current club if mentioned",
      "sentiment": "positive|negative|neutral",
      "confidence": 0.95
    }
  ]
}

If no football players are mentioned, return {"summary": "...", "story_type": "other", "players": []}.`;

const MAX_PROCESS_BATCH = 15; // Gemini calls per cron run (rate limit friendly)

// ── RSS Parsing ─────────────────────────────────────────────────────────────

function stripCdata(text: string): string {
  return text.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
}

function decodeEntities(text: string): string {
  // Decode numeric entities (&#8217; &#x2019; etc.)
  let result = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  // Decode named entities
  const ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201D", ldquo: "\u201C",
    mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", euro: "\u20AC",
    pound: "\u00A3", deg: "\u00B0", copy: "\u00A9", reg: "\u00AE",
    "#39": "'",
  };
  result = result.replace(/&([a-zA-Z0-9#]+);/g, (match, name) => ENTITIES[name] ?? match);
  return result;
}

function stripHtml(html: string): string {
  return decodeEntities(stripCdata(html).replace(/<[^>]+>/g, "")).trim();
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  // Simple regex-based RSS parser (works for standard RSS 2.0 and Atom-ish feeds)
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim()
      ?? block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const desc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]
      ?? block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ?? "";
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]
      ?? block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]
      ?? block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ?? null;

    if (title && link) {
      items.push({
        title: stripHtml(title),
        link: stripHtml(link),
        description: stripHtml(desc),
        pubDate: pubDate ? pubDate.trim() : null,
      });
    }
  }

  // Also handle Atom <entry> format
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const desc = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]
      ?? block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ?? "";
    const pubDate = block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]
      ?? block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ?? null;

    if (title && link) {
      items.push({
        title: stripHtml(title),
        link: stripHtml(link),
        description: stripHtml(desc),
        pubDate: pubDate ? pubDate.trim() : null,
      });
    }
  }

  return items;
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, headline: string, body: string): Promise<Record<string, unknown> | null> {
  const prompt = GEMINI_PROMPT
    .replace("{headline}", headline)
    .replace("{body}", body.slice(0, 3000));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      if (res.status === 429) return null; // rate limited
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Strip markdown fences
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    // Find JSON object
    if (!cleaned.startsWith("{")) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Player Matching ─────────────────────────────────────────────────────────

async function matchPlayer(
  supabase: NonNullable<typeof supabaseServer>,
  name: string,
  club: string | null
): Promise<number | null> {
  if (!name) return null;

  // Exact match
  const { data: exact } = await supabase
    .from("people")
    .select("id, name")
    .ilike("name", name)
    .limit(5);

  if (exact?.length === 1) return exact[0].id;

  // Contains match
  const { data: contains } = await supabase
    .from("people")
    .select("id, name")
    .ilike("name", `%${name}%`)
    .limit(10);

  if (contains?.length === 1) return contains[0].id;

  // If multiple matches, try to narrow by club
  if (contains && contains.length > 1 && club) {
    const ids = contains.map((c) => c.id);
    const { data: withClub } = await supabase
      .from("people")
      .select("id, clubs!people_club_id_fkey!inner(clubname)")
      .in("id", ids)
      .ilike("clubs.clubname", `%${club}%`)
      .limit(5);

    if (withClub?.length === 1) return withClub[0].id;
  }

  // Last name match
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const { data: lastNameMatch } = await supabase
      .from("people")
      .select("id, name")
      .ilike("name", `% ${lastName}`)
      .limit(5);

    if (lastNameMatch?.length === 1) return lastNameMatch[0].id;
  }

  return null;
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: require CRON_SECRET header (for Vercel Cron), query param, or internal admin call
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const isAdminCall = req.headers.get("x-admin") === "1";

  if (cronSecret && !isAdminCall && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const log: string[] = [];
  const stats = { fetched: 0, skipped: 0, processed: 0, tagged: 0, errors: 0 };

  // ── Phase 1: RSS Fetch ──────────────────────────────────────────────────

  // Get existing URLs for dedup
  const { data: existingStories } = await supabaseServer
    .from("news_stories")
    .select("url")
    .not("url", "is", null)
    .order("ingested_at", { ascending: false })
    .limit(2000);

  const existingUrls = new Set((existingStories ?? []).map((s) => s.url));

  for (const [sourceName, source] of Object.entries(RSS_SOURCES)) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "ChiefScout/1.0 (news aggregator)" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        log.push(`${sourceName}: HTTP ${res.status}`);
        stats.errors++;
        continue;
      }

      const xml = await res.text();
      const items = parseRssXml(xml);

      let newCount = 0;
      const newStories: Array<{
        headline: string;
        body: string | null;
        source: string;
        url: string;
        published_at: string | null;
        processed: boolean;
      }> = [];

      for (const item of items.slice(0, 20)) { // Cap at 20 per source
        if (existingUrls.has(item.link)) {
          stats.skipped++;
          continue;
        }
        // Filter non-football stories from mixed-sport feeds
        if (source.filterFootball) {
          const url = item.link.toLowerCase();
          const isFootball = url.includes("/football/") || url.includes("/soccer/") || url.includes("/premier-league/") || url.includes("/champions-league/");
          if (!isFootball) {
            stats.skipped++;
            continue;
          }
        }
        existingUrls.add(item.link);
        newStories.push({
          headline: item.title,
          body: item.description || null,
          source: sourceName,
          url: item.link,
          published_at: parseDate(item.pubDate),
          processed: false,
        });
        newCount++;
      }

      if (newStories.length > 0) {
        const { error } = await supabaseServer
          .from("news_stories")
          .upsert(newStories, { onConflict: "url", ignoreDuplicates: true });

        if (error) {
          log.push(`${sourceName}: upsert error — ${error.message}`);
          stats.errors++;
        } else {
          stats.fetched += newCount;
        }
      }

      log.push(`${sourceName}: ${newCount} new, ${items.length - newCount} skipped`);
    } catch (e) {
      log.push(`${sourceName}: fetch error — ${e instanceof Error ? e.message : "unknown"}`);
      stats.errors++;
    }
  }

  // ── Phase 2: Gemini Processing ────────────────────────────────────────

  if (geminiKey) {
    const { data: unprocessed } = await supabaseServer
      .from("news_stories")
      .select("id, headline, body")
      .eq("processed", false)
      .order("ingested_at", { ascending: true })
      .limit(MAX_PROCESS_BATCH);

    for (const story of unprocessed ?? []) {
      const result = await callGemini(geminiKey, story.headline, story.body ?? "");

      if (!result) {
        log.push(`gemini: skip "${story.headline.slice(0, 50)}..." — no response`);
        continue;
      }

      const summary = (result.summary as string) ?? "";
      const storyType = (result.story_type as string) ?? "other";
      const players = (result.players as Array<Record<string, unknown>>) ?? [];

      // Update story
      await supabaseServer
        .from("news_stories")
        .update({
          summary,
          story_type: storyType,
          gemini_raw: result,
          processed: true,
        })
        .eq("id", story.id);

      stats.processed++;

      // Tag players
      for (const p of players) {
        const playerName = (p.name as string) ?? "";
        if (!playerName) continue;

        const playerId = await matchPlayer(supabaseServer, playerName, (p.club as string) ?? null);
        if (!playerId) continue;

        const { error } = await supabaseServer
          .from("news_player_tags")
          .upsert(
            {
              story_id: story.id,
              player_id: playerId,
              story_type: storyType,
              confidence: (p.confidence as number) ?? 0.5,
              sentiment: (p.sentiment as string) ?? "neutral",
            },
            { onConflict: "story_id,player_id" }
          );

        if (!error) stats.tagged++;
      }

      // Brief pause between Gemini calls
      await new Promise((r) => setTimeout(r, 300));
    }

    log.push(`gemini: processed ${stats.processed}, tagged ${stats.tagged} players`);
  } else {
    log.push("gemini: GEMINI_API_KEY not set, skipping processing");
  }

  // ── Record run timestamp ──────────────────────────────────────────────

  try {
    await supabaseServer.from("cron_log").insert({
      job: "news",
      stats,
      log,
      ran_at: new Date().toISOString(),
    });
  } catch {
    // cron_log table might not exist yet, that's fine
  }

  return NextResponse.json({
    ok: true,
    stats,
    log,
    timestamp: new Date().toISOString(),
  });
}
