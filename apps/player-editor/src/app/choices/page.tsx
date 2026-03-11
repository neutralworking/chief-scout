import { supabaseServer } from "@/lib/supabase-server";
import { ChoicesGame } from "@/components/ChoicesGame";
import Link from "next/link";

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

export const metadata = {
  title: "Football Choices — Chief Scout",
  description: "Pick your favourites. Build your footballing identity.",
};

export default async function ChoicesPage() {
  let categories: Category[] = [];

  if (supabaseServer) {
    const { data } = await supabaseServer
      .from("fc_categories")
      .select("id, slug, name, description, icon, sort_order")
      .order("sort_order");
    categories = (data ?? []) as Category[];
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-4 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Football Choices</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Pick your favourites. Build your footballing identity.
        </p>
      </div>

      <ChoicesGame categories={categories} />
    </div>
  );
}
