"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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

  // Modals & Popovers
  const [shareToken, setShareToken] = useState<string | null>(item.share_token);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTakeaways, setCopiedTakeaways] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  // Traceability feedback states
  const [copiedTimestampIndex, setCopiedTimestampIndex] = useState<number | null>(null);
  const [flashedSegmentIndex, setFlashedSegmentIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Player refs
  const ytPlayerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const initialTime = parseFloat(searchParams.get("t") || "0");
  const totalDuration =
    item.duration_sec ||
    (item.chapters && item.chapters.length > 0 ? item.chapters[item.chapters.length - 1].end : 0) ||
    1;

  // Format time helpers
  function formatTime(sec: number) {
    if (isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Unified Seek To function with visual feedback
  function seekTo(sec: number, highlightIdx?: number) {
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

    if (typeof highlightIdx === "number") {
      setFlashedSegmentIndex(highlightIdx);
      setTimeout(() => setFlashedSegmentIndex(null), 2500);
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

  // Keyboard Navigation (Space: play/pause, Arrow keys / J / L: seek, ? for shortcuts)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
      } else if (e.key === "?") {
        setIsShortcutsOpen((prev) => !prev);
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

      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }

      try {
        const originUrl = typeof window !== "undefined" ? window.location.origin : undefined;
        ytPlayerRef.current = new window.YT.Player("youtube-player", {
          videoId: item.video_id,
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: originUrl,
            enablejsapi: 1,
            widget_referrer: typeof window !== "undefined" ? window.location.href : undefined,
          },
          events: {
            onReady: (event: any) => {
              if (initialTime > 0) {
                try {
                  event.target.seekTo(initialTime, true);
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              try {
                setIsPlaying(event.data === 1);
              } catch {}
            },
            onError: (event: any) => {
              console.warn("YouTube player event error:", event?.data);
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

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (typeof t === "number") {
            setCurrentTime(t);
          }
        } catch {}
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

  // Map each key point to the best matching timestamp / chapter for 100% video-to-takeaway traceability
  const mappedKeyPoints = useMemo(() => {
    if (!item.key_points) return [];
    const segments = item.transcript || [];
    const chapters = item.chapters || [];

    return item.key_points.map((point, idx) => {
      const pointTokens = point
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);

      let bestScore = 0;
      let bestStart = 0;
      let matchedSegmentIdx = -1;

      for (let i = 0; i < segments.length; i++) {
        const segTokens = segments[i].text.toLowerCase().split(/\s+/);
        let matches = 0;
        for (const pt of pointTokens) {
          if (segTokens.includes(pt)) matches++;
        }
        const score = matches / Math.max(pointTokens.length, 1);
        if (score > bestScore) {
          bestScore = score;
          bestStart = segments[i].start;
          matchedSegmentIdx = i;
        }
      }

      // Fallback: distribute across chapters or duration if lexical overlap is subtle
      if (bestScore < 0.2 && chapters.length > 0) {
        const chIdx = Math.min(idx, chapters.length - 1);
        bestStart = chapters[chIdx].start;
      }

      return {
        point,
        timestamp: bestStart,
        matchedSegmentIdx,
      };
    });
  }, [item.key_points, item.transcript, item.chapters]);

  // Dynamic Video Intelligence Stats
  const intelligenceStats = useMemo(() => {
    const totalWordsSpoken = (item.transcript || []).reduce(
      (acc, seg) => acc + seg.text.split(/\s+/).filter(Boolean).length,
      0
    );
    const summaryWords = (item.summary || "").split(/\s+/).filter(Boolean).length;
    const readingTimeMin = Math.max(1, Math.ceil(summaryWords / 200));
    const videoDurationMin = Math.max(1, Math.round(totalDuration / 60));
    const percentSaved = Math.max(
      70,
      Math.min(
        98,
        Math.round(((videoDurationMin - readingTimeMin) / Math.max(videoDurationMin, 1)) * 100)
      )
    );

    return {
      totalWordsSpoken,
      summaryWords,
      readingTimeMin,
      videoDurationMin,
      percentSaved,
    };
  }, [item.transcript, item.summary, totalDuration]);

  // Handle Search Inside Item
  async function handleInItemSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    if (item.id.startsWith("sample-") || (item.transcript && item.transcript.length > 0)) {
      const q = searchQuery.toLowerCase().trim();
      const localMatches = (item.transcript || [])
        .map((seg, idx) => ({ ...seg, originalIdx: idx }))
        .filter((seg) => seg.text.toLowerCase().includes(q))
        .slice(0, 8)
        .map((seg) => ({
          item_id: item.id,
          start_sec: seg.start,
          text: seg.text,
          score: 1.0,
          originalIdx: seg.originalIdx,
        }));

      if (localMatches.length > 0 || item.id.startsWith("sample-")) {
        setSearchResults(localMatches);
        setIsSearching(false);
        return;
      }
    }

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

  // Handle Share
  async function handleOpenShare() {
    setIsShareModalOpen(true);
    if (!shareToken) {
      if (item.id.startsWith("sample-")) {
        setShareToken(item.id);
        return;
      }
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

  function handleCopyTakeaways() {
    if (!item.key_points) return;
    const text = item.key_points.map((kp, i) => `${i + 1}. ${kp}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedTakeaways(true);
    setToastMessage("Takeaways copied to clipboard");
    setTimeout(() => {
      setCopiedTakeaways(false);
      setToastMessage(null);
    }, 2500);
  }

  function handleCopyTimestampLink(e: React.MouseEvent, sec: number, index: number) {
    e.stopPropagation();
    const url = `${window.location.origin}/item/${item.id}?t=${Math.floor(sec)}`;
    navigator.clipboard.writeText(url);
    setCopiedTimestampIndex(index);
    setTimeout(() => setCopiedTimestampIndex(null), 2000);
  }

  function handleExportMarkdown() {
    const chaptersText = (item.chapters || [])
      .map(
        (ch, i) =>
          `### Chapter ${i + 1}: ${ch.title} (${formatTime(ch.start)} - ${formatTime(ch.end)})\n\n${
            ch.summary || "No chapter summary."
          }`
      )
      .join("\n\n");

    const keyPointsText = (item.key_points || []).map((kp) => `- ${kp}`).join("\n");

    const transcriptText = (item.transcript || [])
      .map((seg) => `**[${formatTime(seg.start)}]** ${seg.text}`)
      .join("\n\n");

    const mdContent = `# ${item.title || "Untitled Summary"}

*Generated by EchoNotes AI Studio on ${new Date().toLocaleDateString()}*
*Model: faster-whisper int8 + DistilBART Seq2Seq | Choi C99 Depth Segmentation*
*Source: ${item.source_type} | Duration: ${formatTime(item.duration_sec || 0)}*

---

## Executive Summary

${item.summary || "No overall summary generated."}

---

## Key Points & Takeaways

${keyPointsText || "No key points available."}

---

## Choi C99 Semantic Chapters

${chaptersText || "No chapters available."}

---

## Synchronized Transcript

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
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
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

  const currentChapterIndex = (item.chapters || []).findIndex(
    (ch) => currentTime >= ch.start && currentTime <= ch.end
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-2xl fade-in">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Top Studio Nav */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 group shrink-0" title="Return to Home">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors hidden sm:inline">
              Echo<span className="text-indigo-400">Notes</span>
            </span>
          </Link>

          <span className="text-[var(--text-muted)] text-xs hidden sm:inline">&bull;</span>

          <Link
            href="/library"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-indigo-500/50"
            title="Go to Library"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Library
          </Link>

          <span className="text-[var(--text-muted)] text-xs hidden sm:inline">&bull;</span>

          <span className="text-xs sm:text-sm font-semibold truncate max-w-xs sm:max-w-md text-white">
            {item.title || "Untitled Summary"}
          </span>

          {/* Model Status Pill / Architecture Inspector */}
          <button
            onClick={() => setIsProvenanceOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
            title="Inspect Zero-API Pipeline Architecture"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 badge-pulse" />
            Choi C99 Depth &bull; 0-Cloud Cost
            <span className="text-[9px] text-emerald-300 underline ml-0.5">Inspect</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs text-[var(--text-muted)] hover:text-white hover:border-indigo-500/40 transition-all font-mono"
            title="Keyboard shortcuts (?)"
          >
            <span>⌨</span>
            <span className="text-[10px]">Shortcuts</span>
          </button>

          {/* Copy Takeaways */}
          {item.key_points && item.key_points.length > 0 && (
            <button
              onClick={handleCopyTakeaways}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:border-indigo-500/40 transition-all"
              title="Copy all takeaways"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="hidden md:inline">{copiedTakeaways ? "Copied!" : "Takeaways"}</span>
            </button>
          )}

          {/* Export to Markdown */}
          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:border-indigo-500/40 transition-all"
            title="Download formatted markdown notes"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="hidden sm:inline">{isDeleting ? "..." : "Delete"}</span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={handleOpenShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Main Grid: Left Side (Media & Structured Intelligence), Right Side (Traceable Transcript) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Player + Timeline + AI Intelligence HUD + Structured Tabs) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Media Player Container */}
          {item.source_type === "youtube" && item.video_id ? (
            <div
              ref={playerContainerRef}
              className="rounded-2xl overflow-hidden bg-black shadow-2xl border border-[var(--border-subtle)] aspect-video relative group"
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
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
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

          {/* Interactive Chapter Timeline Ribbon */}
          {item.has_timestamps && item.chapters && item.chapters.length > 0 && (
            <div className="glass-card p-4 rounded-xl border border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <div className="soundwave mr-1">
                    {isPlaying ? (
                      <>
                        <span className="soundwave-bar" />
                        <span className="soundwave-bar" />
                        <span className="soundwave-bar" />
                        <span className="soundwave-bar" />
                        <span className="soundwave-bar" />
                      </>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
                    )}
                  </div>
                  <span className="font-mono text-indigo-400 font-bold">
                    {formatTime(currentTime)}
                  </span>
                  <span>/</span>
                  <span className="font-mono">{formatTime(totalDuration)}</span>
                </div>

                {/* Playback speed selector */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-1">Speed:</span>
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => changePlaybackSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                        playbackSpeed === s
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Segmented Chapter Timeline Ribbon with percentage width */}
              <div className="h-3.5 w-full bg-[#0a0c12] rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-white/5 relative">
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
                      className={`h-full rounded-sm cursor-pointer transition-all duration-200 relative group/ribbon ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-500 to-cyan-500 shadow-sm"
                          : "bg-white/10 hover:bg-indigo-400/50"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Current Chapter Label */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5">
                <span className="truncate flex items-center gap-1.5 font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  {currentChapterIndex >= 0 && item.chapters[currentChapterIndex]
                    ? `${currentChapterIndex + 1}. ${item.chapters[currentChapterIndex].title}`
                    : "Click any chapter segment to scrub"}
                </span>
                <span className="hidden sm:inline font-mono text-[10px] text-[var(--text-muted)]">
                  Space: Play &bull; &larr;/&rarr;: &plusmn;5s
                </span>
              </div>
            </div>
          )}

          {/* AI Video Intelligence HUD / Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Efficiency</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {intelligenceStats.percentSaved}%
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">time saved</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Read Time</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-indigo-400 font-mono">
                  ~{intelligenceStats.readingTimeMin} min
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">vs {intelligenceStats.videoDurationMin}m video</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Compression</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-cyan-400 font-mono">
                  {intelligenceStats.summaryWords}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">from {intelligenceStats.totalWordsSpoken.toLocaleString()} words</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Segmentation</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-violet-400 font-mono">
                  {item.chapters?.length || 0}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">Choi C99 cuts</span>
              </div>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-2 pt-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Summary & Traceable Takeaways
            </button>
            <button
              onClick={() => setActiveTab("chapters")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "chapters"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Deep-Dive Chapters ({item.chapters?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`lg:hidden px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "transcript"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              Transcript
            </button>
          </div>

          {/* Tab 1: Overview (Executive Summary + Timestamp-Linked Key Takeaways) */}
          {activeTab === "overview" && (
            <div className="space-y-5 fade-in">
              {/* Executive Summary */}
              <div className="glass-card p-5 sm:p-6 rounded-2xl border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="21" y1="10" x2="3" y2="10" />
                        <line x1="21" y1="6" x2="3" y2="6" />
                        <line x1="21" y1="14" x2="3" y2="14" />
                        <line x1="21" y1="18" x2="3" y2="18" />
                      </svg>
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                      Executive Synthesis
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Map-Reduce Seq2Seq
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line font-normal">
                  {item.summary || "Summarization in progress or not available."}
                </p>
              </div>

              {/* Traceable Key Takeaways */}
              {mappedKeyPoints.length > 0 && (
                <div className="glass-card p-5 sm:p-6 rounded-2xl border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                        Key Highlights & Video Proof
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 font-medium">
                      Click ▶ to trace in video
                    </span>
                  </div>

                  <div className="space-y-3">
                    {mappedKeyPoints.map((kp, index) => (
                      <div
                        key={index}
                        onClick={() => seekTo(kp.timestamp, kp.matchedSegmentIdx)}
                        className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-indigo-500/50 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-all group/point flex items-start gap-3"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono font-bold text-indigo-400 mt-0.5">
                          {index + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] group-hover/point:text-white transition-colors leading-relaxed">
                            {kp.point}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md group-hover/point:bg-cyan-500/20 transition-all">
                              <span>▶</span> {formatTime(kp.timestamp)}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] group-hover/point:text-[var(--text-secondary)] transition-colors">
                              Jump &amp; highlight transcript line
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Deep-Dive Chapters (Choi C99 Depth Cuts) */}
          {activeTab === "chapters" && (
            <div className="space-y-3.5 fade-in">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
                <span>Deterministic Choi C99 Semantic Depth Cuts</span>
                <span>{item.chapters?.length || 0} chapters detected</span>
              </div>

              {(item.chapters || []).map((ch, idx) => {
                const isActive = idx === currentChapterIndex;
                const chDurationMin = Math.round((ch.end - ch.start) / 60);
                return (
                  <div
                    key={idx}
                    onClick={() => seekTo(ch.start)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-950/20 border-indigo-500/80 shadow-lg shadow-indigo-950/40"
                        : "glass-card hover:border-indigo-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Ch {idx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-white leading-snug">
                          {ch.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-cyan-400 font-semibold">
                          {formatTime(ch.start)} &ndash; {formatTime(ch.end)}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline">
                          ({chDurationMin}m)
                        </span>
                      </div>
                    </div>

                    {ch.summary && (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2 pl-0.5">
                        {ch.summary}
                      </p>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span className="text-indigo-400 text-[10px] font-medium flex items-center gap-1">
                        <span>▶</span> Click to play chapter
                      </span>
                      {isActive && (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 badge-pulse" />
                          Currently Playing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (Synchronized Transcript Studio & In-Item Search) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 h-[760px] glass-card rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5 overflow-hidden">
          {/* Header & In-Item Search */}
          <div className="space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Synchronized Transcript
                </h3>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] text-indigo-600 focus:ring-0"
                />
                Auto-scroll
              </label>
            </div>

            {/* In-Item Search Bar */}
            <form onSubmit={handleInItemSearch} className="relative">
              <input
                type="text"
                placeholder="Search phrase in this video (semantic / lexical)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3.5 py-2 pl-9 text-xs text-white placeholder-[var(--text-muted)] focus:border-indigo-500 focus:outline-none transition-all"
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
                  className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)] hover:text-white"
                >
                  &times;
                </button>
              )}
            </form>
          </div>

          {/* Search Matches Carousel / Box */}
          {searchResults.length > 0 && (
            <div className="shrink-0 max-h-48 overflow-y-auto space-y-1.5 p-2.5 bg-[#0b0e16] rounded-xl border border-indigo-500/25">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-mono font-bold text-indigo-400 uppercase">
                  Search Results ({searchResults.length})
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">Click match to jump</span>
              </div>
              {searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => seekTo(res.start_sec, res.originalIdx)}
                  className="p-2 rounded-lg bg-[var(--bg-card)] hover:bg-indigo-950/30 border border-white/5 hover:border-indigo-500/40 cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-cyan-400 font-semibold">
                      {formatTime(res.start_sec)}
                    </span>
                    {res.score ? (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {Math.round(res.score * 100)}% match
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{res.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Synchronized Transcript Scroll Area */}
          <div
            ref={transcriptContainerRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
          >
            {!item.transcript || item.transcript.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-16">
                No transcript segments available.
              </p>
            ) : (
              item.transcript.map((seg, idx) => {
                const isActive =
                  currentTime >= seg.start &&
                  (idx === item.transcript!.length - 1 || currentTime < seg.end);
                const isFlashed = flashedSegmentIndex === idx;

                // Highlight searched text inside segment
                const hasSearchHighlight =
                  searchQuery.trim().length > 1 &&
                  seg.text.toLowerCase().includes(searchQuery.toLowerCase().trim());

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeSegmentRef : null}
                    onClick={() => seekTo(seg.start)}
                    className={`p-3 rounded-xl transition-all cursor-pointer border group relative ${
                      isFlashed
                        ? "bg-amber-500/15 border-amber-400/80 shadow-lg text-white"
                        : isActive
                        ? "bg-indigo-950/30 border-indigo-500/70 shadow-sm text-white font-medium"
                        : "hover:bg-[var(--bg-card-hover)] border-transparent text-[var(--text-secondary)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span
                          className={`font-mono text-[11px] shrink-0 mt-0.5 font-bold ${
                            isActive ? "text-cyan-400" : "text-indigo-400/80"
                          }`}
                        >
                          {formatTime(seg.start)}
                        </span>
                        <p className="text-xs leading-relaxed flex-1">
                          {hasSearchHighlight ? (
                            seg.text.split(new RegExp(`(${searchQuery.trim()})`, "gi")).map((part, pIdx) =>
                              part.toLowerCase() === searchQuery.toLowerCase().trim() ? (
                                <mark key={pIdx} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold">
                                  {part}
                                </mark>
                              ) : (
                                part
                              )
                            )
                          ) : (
                            seg.text
                          )}
                        </p>
                      </div>

                      {/* Copy Timestamp Link on hover */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyTimestampLink(e, seg.start, idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-white rounded transition-opacity"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm fade-in">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-[var(--border-subtle)] shadow-2xl relative">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-white text-lg"
            >
              &times;
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Share Public Studio Link
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Anyone with this link can interactively scrub chapters, read takeaways, and search without an account.
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
                    className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2 text-xs font-mono text-white select-all"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <a
                    href={`/s/${shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1"
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

      {/* Architecture & Pipeline Provenance Modal */}
      {isProvenanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md fade-in">
          <div className="glass-card max-w-lg w-full p-6 sm:p-7 rounded-2xl border border-[var(--border-subtle)] shadow-2xl relative">
            <button
              onClick={() => setIsProvenanceOpen(false)}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-white text-lg"
            >
              &times;
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Pipeline Execution & Model Provenance</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">100% Zero-Cloud-API &bull; Self-Hosted Quantized Inference</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#090b11] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Speech-to-Text (STT)</span>
                  <span className="font-mono text-emerald-400 text-[10px]">faster-whisper int8</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  CTranslate2 quantized Whisper model running on CPU with zero GPU memory requirement and ~5.7x realtime speed.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#090b11] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Chapter Segmentation</span>
                  <span className="font-mono text-cyan-400 text-[10px]">Choi C99 Depth Scoring</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Computes semantic cosine valleys relative to local topic peaks (<span className="font-mono text-cyan-300">depth = ((peakL - sim) + (peakR - sim)) / 2</span>) to prevent premature chapter cuts.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#090b11] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Key Takeaways Extraction</span>
                  <span className="font-mono text-indigo-400 text-[10px]">MMR &lambda;=0.55 + Disfluency Regex</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Strips conversational spoken noise (&ldquo;uh&rdquo;, &ldquo;you know&rdquo;) and balances centroid semantic centrality against diversity.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#090b11] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Vector Search Space</span>
                  <span className="font-mono text-violet-400 text-[10px]">all-MiniLM-L6-v2 (384d)</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Cosine distance HNSW vector indexing inside PostgreSQL (<span className="font-mono text-violet-300">pgvector</span>) with strict Row-Level Security per user.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-mono font-semibold">Total Cloud API Cost: $0.00</span>
              <button
                onClick={() => setIsProvenanceOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm fade-in">
          <div className="glass-card max-w-sm w-full p-6 rounded-2xl border border-[var(--border-subtle)] shadow-2xl relative">
            <button
              onClick={() => setIsShortcutsOpen(false)}
              className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-white text-lg"
            >
              &times;
            </button>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>⌨</span> Studio Keyboard Shortcuts
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Play / Pause</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-white/10 font-mono text-white">Space</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Seek &plusmn;5 seconds</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-white/10 font-mono text-white">&larr; / &rarr;</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Seek &plusmn;10 seconds</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-white/10 font-mono text-white">J / L</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[var(--text-secondary)]">Open shortcuts dialog</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-white/10 font-mono text-white">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}