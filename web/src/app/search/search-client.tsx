"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  item_id: string;
  item_title?: string;
  source_type?: string;
  start_sec: number;
  text: string;
  score: number;
}

interface SearchClientProps {
  userEmail: string;
}

function formatTime(sec: number) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SearchClient({ userEmail }: SearchClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setMode(data.mode || "semantic");
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Top Header */}
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
              className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Library
            </Link>
            <Link
              href="/search"
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold"
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

      {/* Main Search View */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Semantic Search
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Search natural language queries across all your transcripts and jump to the exact moment.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Type a concept, quote, or question (e.g. 'gradient descent optimization')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4 pl-12 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] shadow-md focus:border-[var(--accent)] focus:outline-none transition-all"
            autoFocus
          />
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-4 top-4 text-[var(--text-muted)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-3 top-2.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Results Header */}
        {hasSearched && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Found <strong className="text-[var(--text-primary)]">{results.length}</strong> matching moments
            </span>
            {mode && (
              <span className="capitalize px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                {mode === "semantic" ? "AI Semantic Vectors" : "Keyword Fallback"}
              </span>
            )}
          </div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <span className="spinner" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4 fade-in">
            {results.map((res, idx) => (
              <Link
                key={idx}
                href={`/item/${res.item_id}?t=${Math.floor(res.start_sec)}`}
                className="block glass-card p-5 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:shadow-lg transition-all group"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                      {res.item_title || "Untitled Video"}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      {res.source_type || "video"}
                    </span>
                  </div>

                  {/* Timestamp Jump Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-mono text-xs font-bold border border-[var(--accent)]/20 group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {formatTime(res.start_sec)}
                  </span>
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  &ldquo;{res.text}&rdquo;
                </p>

                {res.score !== undefined && res.score > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <div className="w-16 h-1 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full"
                        style={{ width: `${Math.min(Math.round(res.score * 100), 100)}%` }}
                      />
                    </div>
                    <span>{Math.round(res.score * 100)}% relevance</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="text-center py-16 glass-card rounded-2xl border border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-secondary)]">No matching moments found.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Try rephrasing or searching for related terms.
            </p>
          </div>
        ) : (
          <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] text-center py-12">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Search your knowledge base
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mb-6">
              EchoNotes uses vector embeddings to understand the meaning behind your search queries, returning the exact second a topic is discussed.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["neural networks", "gradient descent", "backpropagation", "transformers self-attention"].map(
                (sample) => (
                  <button
                    key={sample}
                    onClick={() => {
                      setQuery(sample);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] transition-all font-mono"
                  >
                    &ldquo;{sample}&rdquo;
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
