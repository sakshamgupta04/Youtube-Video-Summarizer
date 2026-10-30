import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-12 max-w-6xl mx-auto w-full">
      {/* Top System Status Bar */}
      <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 backdrop-blur-md mb-8 fade-in">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 badge-pulse" />
        <span className="text-xs font-mono font-medium text-indigo-300">
          Zero-Cloud API Architecture &bull; 100% Free Open-Source Models
        </span>
      </div>

      {/* Hero Section */}
      <div className="slide-up max-w-3xl text-center space-y-5">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          AI Video Intelligence <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Without Cloud Fees
          </span>
        </h1>

        <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          Transform hours of lectures, podcasts, and YouTube videos into deterministic
          <strong> Choi C99 semantic chapters</strong>, <strong>MMR key takeaways</strong>, and <strong>384-dimensional pgvector search</strong>—with 100% video-to-transcript traceability.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3.5 justify-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 active:scale-[0.98]"
          >
            Launch Studio
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-7 py-3.5 text-sm font-semibold text-[var(--text-primary)] hover:border-indigo-500/40 hover:bg-[var(--bg-card-hover)] transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Explore Semantic Search
          </Link>

          <a
            href="https://github.com/sakshamgupta04/Youtube-Video-Summarizer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3.5 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:border-white/20 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>

        {/* Live Metrics Bar */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">Cloud API Cost</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">$0.00</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">Avg Reading Time</span>
            <span className="text-lg font-bold text-indigo-400 font-mono">92% Saved</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">Segmentation</span>
            <span className="text-lg font-bold text-cyan-400 font-mono">Choi C99</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">Vector Space</span>
            <span className="text-lg font-bold text-violet-400 font-mono">384-dim</span>
          </div>
        </div>
      </div>

      {/* Interactive Sample Studio Library */}
      <section className="mt-16 w-full text-left">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 badge-pulse" />
              <h2 className="text-xl font-bold text-white tracking-tight">
                Interactive Sample Studio
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Zero-waiting instant interactive playground. Click any card to experience synchronized player scrubbing, Choi depth chapters, and quote traceability.
            </p>
          </div>
          <Link
            href="/library"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View Full Library &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              id: "sample-cs229",
              title: "Stanford CS229: Machine Learning & Linear Regression",
              speaker: "Prof. Andrew Ng",
              duration: "45 min",
              savedPercent: "94% saved",
              chaptersCount: 5,
              badge: "Machine Learning",
              badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
              description: "Gradient descent, normal equations, LMS cost function formulation, and supervised learning taxonomy.",
            },
            {
              id: "sample-karpathy",
              title: "Andrej Karpathy: State of GPT & LLM Systems",
              speaker: "Lex Fridman Podcast #333",
              duration: "60 min",
              savedPercent: "92% saved",
              chaptersCount: 5,
              badge: "Artificial Intelligence",
              badgeColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
              description: "Pre-training token distributions, SFT, RLHF alignment dynamics, and the LLM OS abstraction.",
            },
            {
              id: "sample-nextjs",
              title: "Next.js 15: Deep Architecture & Streaming Internals",
              speaker: "Next.js Conf Architecture",
              duration: "40 min",
              savedPercent: "91% saved",
              chaptersCount: 5,
              badge: "Systems Engineering",
              badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
              description: "React 19 Server Actions, Partial Prerendering (PPR), Turbopack compilation, and streaming pipelines.",
            },
          ].map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              className="glass-card-interactive group p-5 rounded-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)]">
                    <span className="text-emerald-400 font-semibold">{item.savedPercent}</span>
                    <span>&bull;</span>
                    <span>{item.duration}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-indigo-300 transition-colors line-clamp-2 mb-1.5 leading-snug">
                  {item.title}
                </h3>

                <p className="text-xs text-indigo-400/90 font-medium mb-2.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  {item.speaker}
                </p>

                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-indigo-400">
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  {item.chaptersCount} Choi-Depth Chapters
                </span>
                <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-indigo-300">
                  Open Studio &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Architectural USP: Comparison Matrix */}
      <section className="mt-16 w-full text-left">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>🛡️</span> Architectural Advantage: $0.00 vs. Paid APIs
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Why running quantized open-source models outclasses standard paid cloud API wrappers in both cost and privacy.
          </p>
        </div>

        <div className="glass-card overflow-hidden border border-[var(--border-subtle)] rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] font-mono uppercase text-[10px]">
                  <th className="p-3.5">Pipeline Capability</th>
                  <th className="p-3.5">Typical Cloud SaaS (OpenAI / Claude API)</th>
                  <th className="p-3.5 text-indigo-400">EchoNotes Architecture (Local Open-Source)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="p-3.5 font-semibold text-white">Audio Transcription</td>
                  <td className="p-3.5">Whisper API ($0.006 / min) &bull; Metered per run</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">faster-whisper int8 ($0.00 Forever &bull; 4x faster)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-white">Chapter Segmentation</td>
                  <td className="p-3.5">LLM hallucinated boundaries; non-deterministic</td>
                  <td className="p-3.5 text-cyan-400 font-semibold">Choi C99 Semantic Depth Scoring (Exact mathematical cuts)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-white">Key Takeaways</td>
                  <td className="p-3.5">Generic bullet summaries with conversational filler</td>
                  <td className="p-3.5 text-indigo-300 font-semibold">Disfluency Scrubbing + MMR (&lambda;=0.55) &bull; Timestamp-Linked</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-white">Semantic Search</td>
                  <td className="p-3.5">Pinecone / Weaviate ($70/mo cluster minimum)</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">pgvector + all-MiniLM-L6-v2 (Zero infrastructure cost)</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-semibold text-white">Data Privacy</td>
                  <td className="p-3.5">Transcripts sent to third-party data centers</td>
                  <td className="p-3.5 text-emerald-400 font-semibold">100% Private local inference or self-hosted container</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Feature Badges */}
      <div className="mt-16 mb-6 flex flex-wrap justify-center gap-2.5 max-w-2xl">
        {[
          "⚡ faster-whisper int8",
          "📐 Choi C99 Depth Scoring",
          "🔑 KeyBERT Technical Keywords",
          "🎯 MMR &lambda;=0.55 Takeaways",
          "🧠 Seq2Seq Map-Reduce Summarizer",
          "🔍 384-dim pgvector Search",
          "⏱️ Interactive Playhead Sync",
          "📄 Markdown & Quote Export",
        ].map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-1 text-[11px] font-mono text-[var(--text-secondary)] hover:border-indigo-500/40 hover:text-white transition-colors"
          >
            {feature}
          </span>
        ))}
      </div>
    </main>
  );
}