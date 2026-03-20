import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer!;

    const authHeader = request.headers.get("authorization");
    // Also check cookies for direct browser navigation
    const cookieHeader = request.cookies.get("sb-access-token")?.value;
    const token = authHeader?.replace("Bearer ", "") || cookieHeader;

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get stripe_customer_id from fc_users
    const { data } = await supabase
      .from("fc_users")
      .select("stripe_customer_id")
      .eq("auth_id", user.id)
      .single();

    if (!data?.stripe_customer_id) {
      return NextResponse.redirect(new URL("/pricing", request.url));
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (err) {
    console.error("Portal error:", err);
    return NextResponse.redirect(new URL("/pricing", request.url));
  }
}
