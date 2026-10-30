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
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"relevance" | "timeline">("relevance");

  async function handleSearch(e?: React.FormEvent, customQuery?: string) {
    if (e) e.preventDefault();
    const q = customQuery !== undefined ? customQuery : query;
    if (!q.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=20`);
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

  function handleQuickSearch(sample: string) {
    setQuery(sample);
    handleSearch(undefined, sample);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Filter & sort results
  const filteredResults = results
    .filter((r) => {
      if (filterType === "all") return true;
      return r.source_type?.toLowerCase() === filterType.toLowerCase();
    })
    .sort((a, b) => {
      if (sortBy === "timeline") {
        return a.start_sec - b.start_sec;
      }
      return (b.score || 0) - (a.score || 0);
    });

  // Highlight query keywords in matched snippet
  function renderHighlightedText(text: string, q: string) {
    if (!q.trim()) return text;
    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (!words.length) return text;

    const regex = new RegExp(`(${words.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-amber-400/30 text-amber-200 font-bold rounded px-1"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group" title="Return to Home">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
              <svg
                width="16"
                height="16"
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
            <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              Echo<span className="text-indigo-400">Notes</span> <span className="text-xs font-mono font-normal text-[var(--text-muted)]">Studio</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1.5 text-xs font-medium">
            <Link
              href="/library"
              className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Library
            </Link>
            <Link
              href="/search"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold shadow-sm"
            >
              Semantic Search
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--text-muted)] hidden md:inline">
            {userEmail}
          </span>
          <Link
            href="/add"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Process Video
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Search View */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 badge-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Semantic Vector Search
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Search natural language ideas, math equations, or quotes across all videos via 384-dimensional pgvector embeddings and jump directly to that exact second.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search concepts, queries, or quotes (e.g. 'how backpropagation computes gradient updates')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-5 py-4 pl-12 pr-28 text-sm text-white placeholder-[var(--text-muted)] shadow-xl focus:border-indigo-500 focus:outline-none transition-all"
            autoFocus
          />
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-4 top-4 text-indigo-400"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setHasSearched(false);
              }}
              className="absolute right-24 top-4 text-xs text-[var(--text-muted)] hover:text-white px-2"
              title="Clear search"
            >
              &times;
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-3 top-2.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Filter Chips & Sorting */}
        {hasSearched && results.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All Sources" },
                { id: "youtube", label: "YouTube" },
                { id: "video", label: "Video" },
                { id: "audio", label: "Audio" },
                { id: "text", label: "Text" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                    filterType === f.id
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-white border border-[var(--border-subtle)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Sort:</span>
              <button
                onClick={() => setSortBy(sortBy === "relevance" ? "timeline" : "relevance")}
                className="font-mono text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                {sortBy === "relevance" ? "Relevance Score" : "Chronological"}
              </button>
            </div>
          </div>
        )}

        {/* Results Header Status */}
        {hasSearched && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Found <strong className="text-white font-mono">{filteredResults.length}</strong> matching moments
            </span>
            {mode && (
              <span className="capitalize px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-medium border border-indigo-500/20 text-[11px]">
                {mode === "semantic" ? "⚡ 384-dim pgvector" : "Keyword Fallback"}
              </span>
            )}
          </div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <span className="spinner" />
          </div>
        ) : filteredResults.length > 0 ? (
          <div className="space-y-3.5 fade-in">
            {filteredResults.map((res, idx) => (
              <Link
                key={idx}
                href={`/item/${res.item_id}?t=${Math.floor(res.start_sec)}`}
                className="block glass-card p-5 rounded-2xl border border-[var(--border-subtle)] hover:border-indigo-500/50 hover:shadow-xl transition-all group"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {res.item_title || "Untitled Video"}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-indigo-400 border border-[var(--border-subtle)]">
                      {res.source_type || "video"}
                    </span>
                  </div>

                  {/* Timestamp Jump Badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold border border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-black transition-all">
                    <span>▶</span>
                    {formatTime(res.start_sec)}
                  </span>
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  &ldquo;{renderHighlightedText(res.text, query)}&rdquo;
                </p>

                {res.score !== undefined && res.score > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                    <div className="w-16 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                        style={{ width: `${Math.min(Math.round(res.score * 100), 100)}%` }}
                      />
                    </div>
                    <span className="text-cyan-400">{Math.round(res.score * 100)}% match confidence</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="text-center py-16 glass-card rounded-2xl border border-[var(--border-subtle)]">
            <p className="text-sm text-white">No matching moments found.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Try broader technical concepts or browse your items in Library.
            </p>
          </div>
        ) : (
          <div className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] text-center py-12">
            <h3 className="text-sm font-bold text-white mb-1.5">
              Instant AI Vector Retrieval
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
              Queries are converted into 384-dimensional embeddings via SentenceTransformers and matched across transcripts using cosine distance in pgvector.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "gradient descent update rule",
                "normal equations matrix algebra",
                "transformer attention mechanism",
                "reinforcement learning from human feedback",
                "react 19 server components",
              ].map((sample) => (
                <button
                  key={sample}
                  onClick={() => handleQuickSearch(sample)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] hover:bg-indigo-500/10 hover:text-indigo-300 border border-[var(--border-subtle)] hover:border-indigo-500/30 text-xs text-[var(--text-secondary)] transition-all font-mono"
                >
                  &ldquo;{sample}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}