import { supabaseServer } from "@/lib/supabase-server";
import { ChoicesGame } from "@/components/ChoicesGame";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

export const metadata = {
  title: "Gaffer — Chief Scout",
  description: "Make the calls a manager would. Build your footballing identity.",
};

export default async function ChoicesPage() {
  let categories: Category[] = [];

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from("fc_categories")
        .select("id, slug, name, description, icon, sort_order")
        .order("sort_order");
      if (!error && data) {
        // Filter to categories with active questions — parallel queries
        const counts = await Promise.all(
          data.map((cat: Category) =>
            supabaseServer!
              .from("fc_questions")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id)
              .eq("active", true)
              .then(({ count }: { count: number | null }) => count ?? 0)
          )
        );
        categories = data.filter((_: Category, i: number) => counts[i] > 0) as Category[];
      }
    } catch {
      // Table may not exist yet — migrations 015/016 not applied
    }
  }

  return <ChoicesGame categories={categories} />;
}
