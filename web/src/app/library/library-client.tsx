"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LibraryClientProps {
  userEmail: string;
}

export default function LibraryClient({ userEmail }: LibraryClientProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-subtle)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent)]"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <span className="text-base font-semibold">
            Echo<span className="text-[var(--accent)]">Notes</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--text-muted)] hidden sm:inline">
            {userEmail}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="fade-in text-center max-w-md">
          {/* Empty state icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--text-muted)]"
            >
              <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M3 15h6" />
              <path d="M6 12v6" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold mb-2">Your library is empty</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Paste a YouTube link or upload an audio file to get started. The AI
            will transcribe, summarize, and create searchable chapters.
          </p>

          {/* Placeholder button for Phase 2 */}
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            New Item (coming in Phase 2)
          </button>
        </div>
      </main>
    </div>
  );
}
