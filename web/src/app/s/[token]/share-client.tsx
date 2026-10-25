"use client";

import { useState } from "react";
import Link from "next/link";

interface Chapter {
  start: number;
  end: number;
  title: string;
  summary: string;
}

interface ShareClientProps {
  title: string;
  durationSec: number | null;
  sourceType: string;
  summary: string;
  keyPoints: string[];
  chapters: Chapter[];
  createdAt: string;
}

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ShareClient({
  title,
  durationSec,
  sourceType,
  summary,
  keyPoints,
  chapters,
  createdAt,
}: ShareClientProps) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [chapterFilter, setChapterFilter] = useState("");

  function handleCopySummary() {
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  }

  function handleDownloadMarkdown() {
    const chaptersText = chapters
      .map(
        (ch, i) =>
          `### Chapter ${i + 1}: ${ch.title} (${formatDuration(ch.start)} - ${formatDuration(ch.end)})\n\n${
            ch.summary || "No chapter summary."
          }`
      )
      .join("\n\n");

    const keyPointsText = keyPoints.map((kp) => `- ${kp}`).join("\n");

    const mdContent = `# ${title || "Shared Summary"}

*EchoNotes Summary &bull; Type: ${sourceType} &bull; Duration: ${formatDuration(durationSec)} &bull; ${new Date(createdAt).toLocaleDateString()}*

---

## Executive Summary

${summary || "No summary available."}

---

## Key Takeaways

${keyPointsText || "No key points available."}

---

## Chapters

${chaptersText || "No chapters available."}
`;

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (title || "summary")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    link.href = url;
    link.download = `${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const filteredChapters = chapters.filter(
    (ch) =>
      ch.title.toLowerCase().includes(chapterFilter.toLowerCase()) ||
      ch.summary.toLowerCase().includes(chapterFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50 backdrop-blur-md sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-3">
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

        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
            Public View
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all shadow-sm"
          >
            Create Your Own
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Title Header with Export & Copy actions */}
        <div className="space-y-4 pb-6 border-b border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono uppercase">
              <span className="capitalize">{sourceType}</span>
              {durationSec ? (
                <>
                  <span>&bull;</span>
                  <span>{formatDuration(durationSec)}</span>
                </>
              ) : null}
              <span>&bull;</span>
              <span>{new Date(createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
                title="Copy Executive Summary to Clipboard"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copiedSummary ? "Copied Summary!" : "Copy Summary"}
              </button>
              <button
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
                title="Download formatted markdown notes"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export .md
              </button>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {title || "Shared Summary"}
          </h1>
        </div>

        {/* Executive Summary */}
        <section className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="21" y1="10" x2="3" y2="10" />
                <line x1="21" y1="6" x2="3" y2="6" />
                <line x1="21" y1="14" x2="3" y2="14" />
                <line x1="21" y1="18" x2="3" y2="18" />
              </svg>
            </div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-[var(--text-primary)]">
              Executive Summary
            </h2>
          </div>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
            {summary || "No summary available."}
          </p>
        </section>

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <section className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-[var(--text-primary)]">
                Key Takeaways
              </h2>
            </div>
            <ul className="space-y-3.5">
              {keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-3.5 text-sm text-[var(--text-secondary)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--accent)] mt-0.5">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Chapters */}
        {chapters.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold tracking-wider uppercase text-[var(--text-primary)]">
                  Chapters & Breakdown ({chapters.length})
                </h2>
              </div>

              {chapters.length > 3 && (
                <input
                  type="text"
                  placeholder="Filter chapters..."
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              )}
            </div>

            <div className="space-y-3">
              {filteredChapters.map((ch, idx) => (
                <div
                  key={idx}
                  className="glass-card p-5 rounded-xl border border-[var(--border-subtle)] space-y-2 hover:border-[var(--accent)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {idx + 1}. {ch.title}
                    </h3>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--accent)] font-semibold shrink-0">
                      {formatDuration(ch.start)} - {formatDuration(ch.end)}
                    </span>
                  </div>
                  {ch.summary && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {ch.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer CTA */}
        <div className="pt-8 pb-12 text-center border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Powered by EchoNotes &bull; Fully open-source local AI summarization
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all shadow-sm"
          >
            Summarize Your Own Videos Free &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
