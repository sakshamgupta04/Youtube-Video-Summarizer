"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Item {
  id: string;
  title: string | null;
  source_type: string;
  status: string;
  progress: number;
  duration_sec: number | null;
  has_timestamps: boolean;
  created_at: string;
  error: string | null;
}

interface LibraryClientProps {
  userEmail: string;
}

export default function LibraryClient({ userEmail }: LibraryClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("id, title, source_type, status, progress, duration_sec, has_timestamps, created_at, error")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data as Item[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();

    // Poll every 4s if any item is still queued/fetching/transcribing/analyzing
    const interval = setInterval(() => {
      fetchItems();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "done":
        return <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Done</span>;
      case "failed":
        return <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Failed</span>;
      case "transcribing":
        return <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium animate-pulse">Transcribing...</span>;
      case "fetching":
        return <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium animate-pulse">Fetching...</span>;
      case "queued":
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-medium">Queued</span>;
    }
  }

  function formatDuration(sec: number | null) {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
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
          <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
            {userEmail}
          </span>
          <Link
            href="/add"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Item
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Summarized lectures, podcasts, and transcripts
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <span className="spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="fade-in text-center max-w-md mx-auto py-16">
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
            <h2 className="text-lg font-semibold mb-2">Your library is empty</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Upload an audio/video file or paste a text file to get started with transcription and summaries.
            </p>
            <Link
              href="/add"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-hover)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Your First Item
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="glass-card p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--accent)]">
                    {item.source_type === "audio" ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      </svg>
                    ) : item.source_type === "video" ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-[var(--text-primary)]">
                      {item.title || "Untitled Item"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                      <span className="capitalize">{item.source_type}</span>
                      {item.duration_sec ? (
                        <>
                          <span>&middot;</span>
                          <span>{formatDuration(item.duration_sec)}</span>
                        </>
                      ) : null}
                      <span>&middot;</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    {item.error && (
                      <p className="text-xs text-[var(--error)] mt-1 truncate">
                        Error: {item.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {getStatusBadge(item.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
