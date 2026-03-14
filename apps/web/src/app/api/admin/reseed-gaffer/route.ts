import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/** The canonical Gaffer category slugs — matches pipeline/20_seed_choices.py */
const GAFFER_SLUGS = [
  "dugout",
  "transfer",
  "pub",
  "academy",
  "scouting",
  "dressing-room",
  "press",
  "dream-xi",
];

export async function POST() {
  if (!supabaseServer) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    // Delete questions + options belonging to old categories first
    const { data: oldCats } = await supabaseServer
      .from("fc_categories")
      .select("id, slug")
      .not("slug", "in", `(${GAFFER_SLUGS.join(",")})`);

    let deletedCategories = 0;
    let deletedQuestions = 0;

    if (oldCats && oldCats.length > 0) {
      const oldIds = oldCats.map((c) => c.id);

      // Delete votes for questions in old categories
      const { data: oldQuestions } = await supabaseServer
        .from("fc_questions")
        .select("id")
        .in("category_id", oldIds);

      if (oldQuestions && oldQuestions.length > 0) {
        const qIds = oldQuestions.map((q) => q.id);
        await supabaseServer.from("fc_votes").delete().in("question_id", qIds);
        await supabaseServer.from("fc_options").delete().in("question_id", qIds);
        await supabaseServer.from("fc_questions").delete().in("id", qIds);
        deletedQuestions = qIds.length;
      }

      // Delete the old categories
      await supabaseServer
        .from("fc_categories")
        .delete()
        .in("id", oldIds);

      deletedCategories = oldCats.length;
    }

    // Get current stats
    const { count: categoryCount } = await supabaseServer
      .from("fc_categories")
      .select("id", { count: "exact", head: true });

    const { count: questionCount } = await supabaseServer
      .from("fc_questions")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    return NextResponse.json({
      ok: true,
      deleted_categories: deletedCategories,
      deleted_questions: deletedQuestions,
      remaining_categories: categoryCount ?? 0,
      active_questions: questionCount ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
