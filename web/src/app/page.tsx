import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Hero */}
      <div className="slide-up max-w-2xl">
        {/* Logo mark */}
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border-subtle)]">
          <svg
            width="40"
            height="40"
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

        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Echo<span className="text-[var(--accent)]">Notes</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] mb-3 max-w-lg mx-auto">
          Paste a YouTube link or upload audio — get an AI-powered transcript,
          smart chapters, key points, and a searchable timeline. All running
          locally, no paid APIs.
        </p>

        <p className="text-sm text-[var(--text-muted)] mb-10">
          Open-source &middot; Self-hosted models &middot; 100% private
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-[var(--accent-glow)] active:scale-[0.98]"
          >
            Get Started
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
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <a
            href="https://github.com/sakshamgupta04/Youtube-Video-Summarizer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-8 py-3.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            View Source
          </a>
        </div>
      </div>

      {/* Feature pills */}
      <div className="fade-in mt-20 flex flex-wrap justify-center gap-3 max-w-lg">
        {[
          "🎙️ Transcription",
          "📑 Smart Chapters",
          "🔑 Key Points",
          "📝 Summaries",
          "🔍 Semantic Search",
          "📤 Export Notes",
        ].map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-1.5 text-xs text-[var(--text-secondary)]"
          >
            {feature}
          </span>
        ))}
      </div>
    </main>
  );
}
