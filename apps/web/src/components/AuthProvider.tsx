"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { applyClubTheme } from "@/lib/club-themes";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** The effective user ID for fc_users — auth ID if logged in, localStorage UUID otherwise */
  fcUserId: string;
  /** User's supported club slug for theme accents */
  clubTheme: string | null;
  setClubTheme: (slug: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Get or create anonymous fc_user_id from localStorage */
function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let uid = localStorage.getItem("fc_user_id");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("fc_user_id", uid);
  }
  return uid;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [anonId, setAnonId] = useState(() => getAnonId());
  const [clubTheme, setClubThemeState] = useState<string | null>(null);

  useEffect(() => {
    // Load saved club theme from localStorage
    const savedClub = localStorage.getItem("fc_club_theme");
    if (savedClub) {
      setClubThemeState(savedClub);
      applyClubTheme(savedClub);
    }

    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      // If user just logged in, try to merge anonymous data
      if (s?.user) {
        mergeAnonymousData(s.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        mergeAnonymousData(s.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function mergeAnonymousData(authUserId: string) {
    const localAnonId = localStorage.getItem("fc_user_id");
    if (!localAnonId) return;

    // Check if we already merged
    const mergedKey = `fc_merged_${authUserId}`;
    if (localStorage.getItem(mergedKey)) return;

    try {
      await fetch("/api/auth/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymous_id: localAnonId }),
      });
      localStorage.setItem(mergedKey, "1");
    } catch (err) {
      console.error("Failed to merge anonymous data:", err);
    }
  }

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowser();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signInWithEmail(email: string, password: string) {
    const supabase = createSupabaseBrowser();
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUpWithEmail(email: string, password: string) {
    const supabase = createSupabaseBrowser();
    if (!supabase) return { error: "Auth not configured" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    const supabase = createSupabaseBrowser();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  function setClubTheme(slug: string | null) {
    setClubThemeState(slug);
    applyClubTheme(slug);
    localStorage.setItem("fc_club_theme", slug ?? "none");
    // Persist to profile if logged in
    if (user) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { club_theme: slug } }),
      }).catch(() => {});
    }
  }

  // Use auth user ID if logged in, otherwise fall back to localStorage UUID
  const fcUserId = user?.id ?? anonId;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        fcUserId,
        clubTheme,
        setClubTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
