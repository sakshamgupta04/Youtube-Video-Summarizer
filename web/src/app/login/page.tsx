"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Mode = "login" | "signup";

function LoginContent() {
  const searchParams = useSearchParams();
  const nextTarget = searchParams.get("next") || "/library";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Verification link sent! Check your inbox or proceed to sign in.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        window.location.href = nextTarget.startsWith("/") ? nextTarget : "/library";
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="slide-up w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Echo<span className="text-indigo-400">Notes</span> <span className="text-xs font-mono font-normal text-[var(--text-muted)]">Studio</span>
          </span>
        </Link>

        {/* Card */}
        <div className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-[var(--bg-input)] p-1 mb-6 border border-white/5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "login"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-xs text-white placeholder-[var(--text-muted)] outline-none transition-all focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-xs text-white placeholder-[var(--text-muted)] outline-none transition-all focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
              />
            </div>

            {/* Message Alert */}
            {message && (
              <div
                className={`rounded-xl px-4 py-2.5 text-xs fade-in ${
                  message.type === "error"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
            >
              {loading && <span className="spinner" />}
              {mode === "login" ? "Sign In to Studio" : "Create Studio Account"}
            </button>
          </form>

          {/* Privacy & Isolation Note */}
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span className="text-emerald-400">🔒</span>
            <span>Zero data sharing &bull; Row-Level Security isolates your videos</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Want to test first? Explore the{" "}
          <Link href="/item/sample-cs229" className="text-indigo-400 hover:underline">
            Public Demo Library
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><span className="spinner" /></div>}>
      <LoginContent />
    </Suspense>
  );
}