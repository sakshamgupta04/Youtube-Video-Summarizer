"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Chapter {
  start: number;
  end: number;
  title: string;
  summary: string;
}

interface Item {
  id: string;
  title: string | null;
  source_type: string;
  source_url: string | null;
  video_id: string | null;
  storage_path: string | null;
  status: string;
  duration_sec: number | null;
  has_timestamps: boolean;
  transcript: Segment[] | null;
  chapters: Chapter[] | null;
  key_points: string[] | null;
  summary: string | null;
  share_token: string | null;
  created_at: string;
}

interface ItemClientProps {
  item: Item;
  mediaUrl: string | null;
  userEmail: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function ItemClient({ item, mediaUrl, userEmail }: ItemClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"overview" | "chapters" | "transcript">("overview");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Search inside item
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Share modal state
  const [shareToken, setShareToken] = useState<string | null>(item.share_token);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  // Timestamp copy toast feedback
  const [copiedTimestampIndex, setCopiedTimestampIndex] = useState<number | null>(null);

  // Player refs
  const ytPlayerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const initialTime = parseFloat(searchParams.get("t") || "0");
  const totalDuration = item.duration_sec || (item.chapters && item.chapters.length > 0 ? item.chapters[item.chapters.length - 1].end : 0) || 1;

  // Format time helpers
  function formatTime(sec: number) {
    if (isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Unified Seek To function
  function seekTo(sec: number) {
    setCurrentTime(sec);

    if (item.source_type === "youtube" && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(sec, true);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
      } catch (err) {
        console.warn("YouTube seek error:", err);
      }
    } else if (mediaRef.current) {
      try {
        mediaRef.current.currentTime = sec;
        mediaRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Media seek error:", err);
      }
    }
  }

  // Toggle Play / Pause
  function togglePlayPause() {
    if (item.source_type === "youtube" && ytPlayerRef.current) {
      try {
        const state = ytPlayerRef.current.getPlayerState?.();
        if (state === 1) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch {}
    } else if (mediaRef.current) {
      if (mediaRef.current.paused) {
        mediaRef.current.play();
        setIsPlaying(true);
      } else {
        mediaRef.current.pause();
        setIsPlaying(false);
      }
    }
  }

  // Set Playback Speed
  function changePlaybackSpeed(speed: number) {
    setPlaybackSpeed(speed);
    if (item.source_type === "youtube" && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setPlaybackRate?.(speed);
      } catch {}
    } else if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
    }
  }

  // Keyboard Navigation (Space for play/pause, Arrow keys for seek)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 5));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekTo(Math.min(totalDuration, currentTime + 5));
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 10));
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        seekTo(Math.min(totalDuration, currentTime + 10));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, totalDuration]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (item.source_type !== "youtube" || !item.video_id) return;

    let isSubscribed = true;

    function initYT() {
      if (!isSubscribed) return;
      if (!window.YT || !window.YT.Player) return;
      const container = document.getElementById("youtube-player");
      if (!container) return;

      // Clean up previous instance if already mounted
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }

      try {
        ytPlayerRef.current = new window.YT.Player("youtube-player", {
          videoId: item.video_id,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
            enablejsapi: 1,
          },
          events: {
            onReady: (event: any) => {
              if (initialTime > 0) {
                event.target.seekTo(initialTime, true);
              }
            },
            onStateChange: (event: any) => {
              setIsPlaying(event.data === 1);
            },
          },
        });
      } catch (err) {
        console.warn("YouTube player init error:", err);
      }
    }

    if (!window.YT || !window.YT.Player) {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
      window.onYouTubeIframeAPIReady = initYT;
    } else {
      initYT();
    }

    // Polling interval to track YouTube player time
    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (typeof t === "number") {
            setCurrentTime(t);
          }
        } catch {
          // ignore if player destroyed
        }
      }
    }, 250);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '<div id="youtube-player" class="w-full h-full"></div>';
      }
    };
  }, [item.source_type, item.video_id, initialTime]);

  // Initial seek for HTML5 media
  useEffect(() => {
    if (initialTime > 0 && mediaRef.current) {
      mediaRef.current.currentTime = initialTime;
    }
  }, [initialTime]);

  // Auto-scroll transcript to active line
  useEffect(() => {
    if (autoScroll && activeSegmentRef.current && transcriptContainerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime, autoScroll]);

  // Handle Search Inside Item
  async function handleInItemSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&item_id=${item.id}&limit=8`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }

  // Handle Share button click
  async function handleOpenShare() {
    setIsShareModalOpen(true);
    if (!shareToken) {
      setIsGeneratingShare(true);
      try {
        const generatedToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { error } = await supabase
          .from("items")
          .update({ share_token: generatedToken })
          .eq("id", item.id);

        if (!error) {
          setShareToken(generatedToken);
        }
      } catch (err) {
        console.error("Failed to generate share token:", err);
      } finally {
        setIsGeneratingShare(false);
      }
    }
  }

  function handleCopyShareLink() {
    const url = `${window.location.origin}/s/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Copy direct link to timestamp
  function handleCopyTimestampLink(e: React.MouseEvent, sec: number, index: number) {
    e.stopPropagation();
    const url = `${window.location.origin}/item/${item.id}?t=${Math.floor(sec)}`;
    navigator.clipboard.writeText(url);
    setCopiedTimestampIndex(index);
    setTimeout(() => setCopiedTimestampIndex(null), 2000);
  }

  // Export to Markdown (client-side download)
  function handleExportMarkdown() {
    const chaptersText = (item.chapters || [])
      .map(
        (ch, i) =>
          `### Chapter ${i + 1}: ${ch.title} (${formatTime(ch.start)} - ${formatTime(ch.end)})\n\n${
            ch.summary || "No chapter summary."
          }`
      )
      .join("\n\n");

    const keyPointsText = (item.key_points || [])
      .map((kp) => `- ${kp}`)
      .join("\n");

    const transcriptText = (item.transcript || [])
      .map((seg) => `**[${formatTime(seg.start)}]** ${seg.text}`)
      .join("\n\n");

    const mdContent = `# ${item.title || "Untitled Summary"}

*Generated by EchoNotes on ${new Date().toLocaleDateString()}*
*Type: ${item.source_type} | Duration: ${formatTime(item.duration_sec || 0)}*

---

## Executive Summary

${item.summary || "No overall summary generated."}

---

## Key Points & Takeaways

${keyPointsText || "No key points available."}

---

## Chapters

${chaptersText || "No chapters available."}

---

## Full Transcript

${transcriptText || "No transcript available."}
`;

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (item.title || "summary")
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

  async function handleDeleteItem() {
    if (
      !confirm(
        "Are you sure you want to delete this item? This will permanently remove its media file from storage, transcript, chapters, and embeddings."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete item");
      }

      router.push("/library");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete item");
      setIsDeleting(false);
    }
  }

  // Determine active chapter based on currentTime
  const currentChapterIndex = (item.chapters || []).findIndex(
    (ch) => currentTime >= ch.start && currentTime <= ch.end
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/library"
            className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Library
          </Link>
          <span className="text-sm font-semibold truncate max-w-md">
            {item.title || "Untitled Summary"}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Export to Markdown */}
          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
            title="Download formatted markdown notes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Export .md</span>
          </button>

          {/* Delete Button */}
          {!item.id.startsWith("sample-") && (
            <button
              onClick={handleDeleteItem}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-all"
              title="Delete item and reclaim storage"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="hidden sm:inline">{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={handleOpenShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>
      </header>

      {/* Main Grid: Left Side (Media & Content), Right Side (Transcript & Timeline) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {item.status === "queued" && (
          <div className="lg:col-span-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">waiting for worker</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Item is queued. If the worker is asleep or spinning up on free tier, processing will start automatically shortly.
                </p>
              </div>
            </div>
            <Link
              href="/library"
              className="text-xs text-amber-400 font-medium px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 transition-all shrink-0"
            >
              Library &rarr;
            </Link>
          </div>
        )}

        {/* Left Column (Player + Chapter Scrubber + Summary + Key Points) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Media Player Container */}
          {item.source_type === "youtube" && item.video_id ? (
            <div
              ref={playerContainerRef}
              className="rounded-2xl overflow-hidden bg-black shadow-xl border border-[var(--border-subtle)] aspect-video"
            >
              <div id="youtube-player" className="w-full h-full" />
            </div>
          ) : (item.source_type === "video" || item.source_type === "audio") && mediaUrl ? (
            <div className="rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-xl p-2">
              {item.source_type === "video" ? (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={mediaUrl}
                  controls
                  className="w-full rounded-xl aspect-video bg-black"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="p-6 flex flex-col items-center justify-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={mediaUrl}
                    controls
                    className="w-full max-w-md"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </div>
              )}
            </div>
          ) : null}

          {/* Interactive Chapter Timeline Scrubber & Speed Controls */}
          {item.has_timestamps && item.chapters && item.chapters.length > 0 && (
            <div className="glass-card p-4 rounded-xl border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--accent)] font-bold">
                    {formatTime(currentTime)}
                  </span>
                  <span>/</span>
                  <span className="font-mono">{formatTime(totalDuration)}</span>
                </div>

                {/* Playback speed selector */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--text-muted)] mr-1">Speed:</span>
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => changePlaybackSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                        playbackSpeed === s
                          ? "bg-[var(--accent)] text-white font-bold"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Segmented Chapter Timeline Bar */}
              <div className="h-3 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-[var(--border-subtle)]">
                {item.chapters.map((ch, idx) => {
                  const chDuration = Math.max(1, ch.end - ch.start);
                  const widthPercent = (chDuration / totalDuration) * 100;
                  const isActive = idx === currentChapterIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => seekTo(ch.start)}
                      style={{ width: `${widthPercent}%` }}
                      title={`${ch.title} (${formatTime(ch.start)} - ${formatTime(ch.end)})`}
                      className={`h-full rounded-sm cursor-pointer transition-all ${
                        isActive
                          ? "bg-[var(--accent)] shadow-sm"
                          : "bg-[var(--border-subtle)] hover:bg-[var(--accent)]/50"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5">
                <span className="truncate">
                  {currentChapterIndex >= 0 && item.chapters[currentChapterIndex]
                    ? `Current: ${item.chapters[currentChapterIndex].title}`
                    : "Click on timeline to jump"}
                </span>
                <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">
                  Space: Play/Pause &bull; &larr;/&rarr;: &plusmn;5s
                </span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "overview"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Summary & Key Points
            </button>
            <button
              onClick={() => setActiveTab("chapters")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "chapters"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Chapters ({item.chapters?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`lg:hidden px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "transcript"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Transcript
            </button>
          </div>

          {/* Tab Content: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6 fade-in">
              {/* Executive Summary */}
              <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="21" y1="10" x2="3" y2="10" />
                      <line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" />
                      <line x1="21" y1="18" x2="3" y2="18" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)] uppercase">
                    Executive Summary
                  </h2>
                </div>
                {item.summary === "Summary unavailable." ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Summary unavailable for this item. Key points and chapters have been fully preserved below.</span>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
                    {item.summary || "Summarization in progress or not available."}
                  </p>
                )}
              </div>

              {/* Key Takeaways */}
              {item.key_points && item.key_points.length > 0 && (
                <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)] uppercase">
                      Key Takeaways
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {item.key_points.map((point, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--accent)] mt-0.5">
                          {index + 1}
                        </span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Chapters */}
          {activeTab === "chapters" && (
            <div className="space-y-4 fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight uppercase text-[var(--text-muted)]">
                  Click a chapter to jump
                </h2>
              </div>
              <div className="space-y-3">
                {(item.chapters || []).map((ch, idx) => {
                  const isActive = idx === currentChapterIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => seekTo(ch.start)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-[var(--accent-subtle)] border-[var(--accent)] shadow-md"
                          : "glass-card hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {idx + 1}. {ch.title}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--accent)] font-semibold shrink-0">
                          {formatTime(ch.start)} - {formatTime(ch.end)}
                        </span>
                      </div>
                      {ch.summary && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
                          {ch.summary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Synchronized Transcript & In-Item Search) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-[750px] glass-card rounded-2xl border border-[var(--border-subtle)] p-4 overflow-hidden">
          {/* Header & In-Item Search Input */}
          <div className="space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Transcript & Search
              </h3>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] text-[var(--accent)] focus:ring-0"
                />
                Auto-scroll
              </label>
            </div>

            {/* In-Item Search Bar */}
            <form onSubmit={handleInItemSearch} className="relative">
              <input
                type="text"
                placeholder="Search phrase in this video..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2 pl-9 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-all"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-2.5 text-[var(--text-muted)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  &times;
                </button>
              )}
            </form>
          </div>

          {/* Search Results (if query active) */}
          {searchResults.length > 0 && (
            <div className="shrink-0 max-h-48 overflow-y-auto space-y-2 p-2 bg-[var(--bg-primary)] rounded-xl border border-[var(--accent-subtle)]">
              <p className="text-[11px] font-semibold text-[var(--accent)] uppercase">
                Search Matches ({searchResults.length})
              </p>
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => seekTo(res.start_sec)}
                  className="p-2 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-subtle)] border border-[var(--border-subtle)] cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">
                      {formatTime(res.start_sec)}
                    </span>
                    {res.score ? (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {Math.round(res.score * 100)}% match
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[var(--text-secondary)] line-clamp-2">{res.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Synchronized Transcript Scroll Area */}
          <div
            ref={transcriptContainerRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
          >
            {(!item.transcript || item.transcript.length === 0) ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-12">
                No transcript segments available.
              </p>
            ) : (
              item.transcript.map((seg, idx) => {
                const isActive =
                  currentTime >= seg.start &&
                  (idx === item.transcript!.length - 1 || currentTime < seg.end);

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeSegmentRef : null}
                    onClick={() => seekTo(seg.start)}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer border group relative ${
                      isActive
                        ? "bg-[var(--accent-subtle)] border-[var(--accent)] shadow-sm text-[var(--text-primary)] font-medium"
                        : "hover:bg-[var(--bg-card-hover)] border-transparent text-[var(--text-secondary)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="font-mono text-[11px] text-[var(--accent)] shrink-0 mt-0.5 font-semibold">
                          {formatTime(seg.start)}
                        </span>
                        <p className="text-xs leading-relaxed flex-1">{seg.text}</p>
                      </div>

                      {/* Copy Timestamp Link on hover */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyTimestampLink(e, seg.start, idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--accent)] rounded transition-opacity"
                        title="Copy link to this timestamp"
                      >
                        {copiedTimestampIndex === idx ? (
                          <span className="text-[10px] text-emerald-400 font-semibold">Copied!</span>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Share Modal Dialog */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-[var(--border-subtle)] shadow-2xl relative">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg"
            >
              &times;
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Share Public Summary
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Anyone with this link can view the summary, chapters, and key points without logging in.
                </p>
              </div>
            </div>

            {isGeneratingShare ? (
              <div className="py-6 flex justify-center">
                <span className="spinner" />
              </div>
            ) : shareToken ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : ""}
                    className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2 text-xs font-mono text-[var(--text-primary)] select-all"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white transition-all shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <a
                    href={`/s/${shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                  >
                    Open preview &rarr;
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400">Could not generate share link.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
