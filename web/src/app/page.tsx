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

      {/* Sample Library (No waiting required) */}
      <section className="mt-16 w-full max-w-4xl mx-auto text-left">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Try the Sample Library
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Explore 3 pre-processed public lectures with clickable chapter timelines, synchronized transcripts, and semantic search—instant interactive demo, zero waiting.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-subtle)]">
            Instant Demo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: "sample-cs229",
              title: "Stanford CS229: ML Introduction",
              speaker: "Prof. Andrew Ng",
              duration: "45 min",
              chaptersCount: 5,
              badge: "Machine Learning",
              description: "Gradient descent, normal equations, and supervised regression formulation.",
            },
            {
              id: "sample-karpathy",
              title: "Andrej Karpathy: LLMs & Deep Learning",
              speaker: "Lex Fridman Podcast",
              duration: "60 min",
              chaptersCount: 5,
              badge: "Artificial Intelligence",
              description: "Transformer architectures, SFT, RLHF alignment, and LLM operating systems.",
            },
            {
              id: "sample-nextjs",
              title: "Next.js 15: Full Architecture",
              speaker: "Architecture Deep Dive",
              duration: "40 min",
              chaptersCount: 5,
              badge: "Web Systems",
              description: "Server Components, React Suspense streaming, and Partial Prerendering.",
            },
          ].map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              className="glass-card group p-5 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                    {item.badge}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {item.duration}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-2 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-2 font-medium">
                  {item.speaker}
                </p>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--accent)]">
                <span>{item.chaptersCount} Chapters &bull; Notes</span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Feature pills */}
      <div className="fade-in mt-16 mb-10 flex flex-wrap justify-center gap-3 max-w-lg">
        {[
          "🎙️ Faster-Whisper int8",
          "📑 NLTK Chaptering",
          "🔑 KeyBERT Keywords",
          "📝 LoRA Summaries",
          "🔍 pgvector Search",
          "📤 Markdown Export",
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
