"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SAMPLE_ITEMS } from "@/lib/sample-data";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter & search state
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "processing" | "failed" | "samples">("all");

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

    // Poll every 3.5s if any item is still queued/fetching/transcribing/analyzing
    const interval = setInterval(() => {
      fetchItems();
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm("Are you sure you want to delete this item? This will permanently remove its media file, transcript, chapters, and embeddings.")) {
      return;
    }

    setDeletingId(id);
    try {
      // Optimistic update
      setItems((prev) => prev.filter((item) => item.id !== id));
      const res = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete item");
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      fetchItems();
    } finally {
      setDeletingId(null);
    }
  }

  function formatDuration(sec: number | null) {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Calculate stats
  const totalCompleted = items.filter((i) => i.status === "done").length;
  const totalSeconds = items.reduce((acc, i) => acc + (i.duration_sec || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  // Filtered items
  const sampleItemsList: Item[] = Object.values(SAMPLE_ITEMS).map((s) => ({
    id: s.id,
    title: s.title,
    source_type: s.source_type,
    status: "done",
    progress: 100,
    duration_sec: s.duration_sec,
    has_timestamps: s.has_timestamps,
    created_at: s.created_at,
    error: null,
  }));

  const filteredItems = statusFilter === "samples"
    ? sampleItemsList.filter((item) =>
        !searchFilter.trim() ||
        (item.title || "").toLowerCase().includes(searchFilter.toLowerCase())
      )
    : items.filter((item) => {
        const matchesSearch = !searchFilter.trim() ||
          (item.title || "untitled item").toLowerCase().includes(searchFilter.toLowerCase());

        if (!matchesSearch) return false;

        if (statusFilter === "all") return true;
        if (statusFilter === "done") return item.status === "done";
        if (statusFilter === "failed") return item.status === "failed";
        if (statusFilter === "processing") return item.status !== "done" && item.status !== "failed";
        return true;
      });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <Link href="/library" className="flex items-center gap-3">
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
          </Link>

          {/* Navigation links */}
          <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
            <Link
              href="/library"
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold"
            >
              Library
            </Link>
            <Link
              href="/search"
              className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Search
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] hidden md:inline">
            {userEmail}
          </span>
          <Link
            href="/search"
            className="sm:hidden p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Search"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <Link
            href="/add"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98] shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Item
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Summarized lectures, podcasts, and transcripts
            </p>
          </div>
          <Link
            href="/search"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search Library
          </Link>
        </div>

        {/* Library Stats Banner */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl glass-card border border-[var(--border-subtle)]">
            <div className="text-center sm:text-left sm:pl-2">
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block">Total Items</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{items.length}</span>
            </div>
            <div className="text-center border-x border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block">Completed</span>
              <span className="text-lg font-bold text-emerald-400">{totalCompleted}</span>
            </div>
            <div className="text-center sm:text-right sm:pr-2">
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block">Audio/Video</span>
              <span className="text-lg font-bold text-[var(--accent)] font-mono">
                {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes} min`}
              </span>
            </div>
          </div>
        )}

        {/* Filter Controls (Search + Status Chips) */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All" },
                { id: "done", label: "Done" },
                { id: "processing", label: "Processing" },
                { id: "failed", label: "Failed" },
                { id: "samples", label: "✨ Sample Demos (3)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === f.id
                      ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Filter by title..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 pl-8 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-2.5 text-[var(--text-muted)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        )}

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
              Upload an audio/video file, provide a YouTube URL, or paste text to generate summaries and searchable timelines.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/add"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-hover)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Your First Item
              </Link>
              <button
                type="button"
                onClick={() => setStatusFilter("samples")}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-3 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
              >
                <span>✨</span> View 3 Sample Demos
              </button>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="glass-card p-10 text-center rounded-xl border border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-muted)]">No items match your filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => {
              const isDone = item.status === "done";
              const isFailed = item.status === "failed";
              const isInProgress = !isDone && !isFailed;

              const content = (
                <div className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--accent)]">
                      {item.source_type === "audio" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      ) : item.source_type === "video" || item.source_type === "youtube" ? (
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
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isDone ? "text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" : "text-[var(--text-primary)]"}`}>
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

                      {/* Progress bar for in-progress status */}
                      {isInProgress && (
                        <div className="mt-3 max-w-xs">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="capitalize text-[var(--accent)] font-medium">
                              {item.status === "queued" ? "Waiting for worker..." : `${item.status}...`}
                            </span>
                            <span className="text-[var(--text-muted)] font-mono">
                              {item.status === "queued" ? "0%" : `${item.progress || 10}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--bg-primary)] overflow-hidden border border-[var(--border-subtle)]">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--accent)] to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(item.progress || 10, 5)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isFailed && item.error && (
                        <p className="text-xs text-[var(--error)] mt-1 truncate">
                          {item.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.id.startsWith("sample-") ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-subtle)] font-medium">
                        ✨ Demo
                      </span>
                    ) : isDone ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Done
                      </span>
                    ) : isFailed ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                        Failed
                      </span>
                    ) : item.status === "queued" ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        waiting for worker
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Processing
                      </span>
                    )}

                    {/* Delete action */}
                    {!item.id.startsWith("sample-") && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        title="Delete item"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );

              return (
                <div
                  key={item.id}
                  className={`glass-card transition-all rounded-xl border border-[var(--border-subtle)] ${
                    isDone
                      ? "hover:border-[var(--accent)] hover:shadow-lg cursor-pointer group"
                      : ""
                  }`}
                >
                  {isDone ? (
                    <Link href={`/item/${item.id}`} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div>{content}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
