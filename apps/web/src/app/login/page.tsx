"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed" ? "Authentication failed. Please try again." : null
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Already logged in — redirect
  if (user) {
    router.push("/profile");
    return null;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "signin") {
      const { error: err } = await signInWithEmail(email, password);
      if (err) {
        setError(err);
      } else {
        router.push("/choices");
      }
    } else {
      const { error: err } = await signUpWithEmail(email, password);
      if (err) {
        setError(err);
      } else {
        setSuccess("Check your email for a confirmation link.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="max-w-sm mx-auto mt-16 sm:mt-24">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-8 inline-block"
      >
        &larr; Back
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Sign in to Chief Scout</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Save your All-Time XI, track your picks, build your profile.
        </p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors mb-4"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-tactical)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-[var(--accent-tactical)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 text-center">
          {success}
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setSuccess(null);
          }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
