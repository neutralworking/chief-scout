import { supabaseServer } from "@/lib/supabase-server";
import { ChoicesGame } from "@/components/ChoicesGame";
import { AllTimeXI } from "@/components/AllTimeXI";
import { ChoicesShell } from "@/components/ChoicesShell";
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
  description: "Build your All-Time XI. See how your picks compare.",
};

export default async function ChoicesPage() {
  let categories: Category[] = [];

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from("fc_categories")
        .select("id, slug, name, description, icon, sort_order")
        .order("sort_order");
      if (!error) categories = (data ?? []) as Category[];
    } catch {
      // Table may not exist yet — migrations 015/016 not applied
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-2 sm:mb-4 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="text-center mb-3 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight mb-1">Football Choices</h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Build your All-Time XI. See how your picks compare.
        </p>
      </div>

      <ChoicesShell categories={categories} />
    </div>
  );
}
