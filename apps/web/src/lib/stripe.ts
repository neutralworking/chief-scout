import Stripe from "stripe";
import { SupabaseClient } from "@supabase/supabase-js";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  });
}

export { getStripe };

export const TIER_LIMITS = {
  free: { playerLimit: 500, showArchetypes: false, apiAccess: false, shortlists: false },
  scout: { playerLimit: null, showArchetypes: true, apiAccess: false, shortlists: true },
  pro: { playerLimit: null, showArchetypes: true, apiAccess: true, shortlists: true },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

const TIER_RANK: Record<Tier, number> = { free: 0, scout: 1, pro: 2 };

export function hasTierAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

export async function getUserTier(
  supabase: SupabaseClient,
  userId: string
): Promise<Tier> {
  const { data, error } = await supabase
    .from("fc_users")
    .select("tier")
    .eq("auth_id", userId)
    .single();

  if (error || !data) return "free";
  return (data.tier as Tier) || "free";
}

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string
): Promise<Stripe.Checkout.Session> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: { userId },
  });

  return session;
}

export function tierFromPriceId(priceId: string): Tier {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_SCOUT_PRICE_ID) return "scout";
  return "free";
}
