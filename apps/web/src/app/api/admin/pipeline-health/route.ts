import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Get latest run for each job from cron_log
  const { data: logs, error } = await supabaseServer
    .from("cron_log")
    .select("job, stats, ran_at")
    .order("ran_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ jobs: [], error: error.message });
  }

  // Group by job, keep only latest per job
  const jobMap = new Map<string, { job: string; last_run: string; stats: unknown; runs_24h: number }>();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  for (const log of logs ?? []) {
    const existing = jobMap.get(log.job);
    if (!existing) {
      jobMap.set(log.job, {
        job: log.job,
        last_run: log.ran_at,
        stats: log.stats,
        runs_24h: new Date(log.ran_at).getTime() > dayAgo ? 1 : 0,
      });
    } else {
      if (new Date(log.ran_at).getTime() > dayAgo) {
        existing.runs_24h++;
      }
    }
  }

  const jobs = [...jobMap.values()].sort((a, b) => a.job.localeCompare(b.job));

  return NextResponse.json({ jobs });
}
