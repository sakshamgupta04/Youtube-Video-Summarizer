"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface AddClientProps {
  userId: string;
  userEmail: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export default function AddItemClient({ userId, userEmail }: AddClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"upload" | "link">("link");

  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  // Link tab state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [submittingLink, setSubmittingLink] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function getSourceType(fileName: string): "text" | "audio" | "video" {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["txt", "md", "srt", "vtt"].includes(ext)) {
      return "text";
    }
    if (["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(ext)) {
      return "audio";
    }
    if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
      return "video";
    }
    return "audio";
  }

  function handleFileSelection(file: File) {
    setErrorMessage(null);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("File exceeds 50 MB limit. Please select a smaller file.");
      return;
    }
    setSelectedFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const sourceType = getSourceType(selectedFile.name);

      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: selectedFile.name }),
      });

      if (!signRes.ok) {
        const errData = await signRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initialize upload.");
      }

      const { storagePath, signedUrl } = await signRes.json();

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      const itemTitle = uploadTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
      const { error: insertError } = await supabase.from("items").insert({
        user_id: userId,
        source_type: sourceType,
        storage_path: storagePath,
        title: itemTitle,
        status: "queued",
        progress: 0,
      });

      if (insertError) {
        throw new Error(`Failed to create item record: ${insertError.message}`);
      }

      router.push("/library");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during upload.");
      setUploading(false);
    }
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = youtubeUrl.trim();
    if (
      trimmed.includes("spotify.com") ||
      trimmed.startsWith("spotify:") ||
      trimmed.includes("open.spotify.com")
    ) {
      setErrorMessage("Spotify isn't supported yet. Upload the file, or paste the YouTube link.");
      return;
    }

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setErrorMessage(
        "Invalid YouTube URL. Please enter a valid link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)."
      );
      return;
    }

    setSubmittingLink(true);

    try {
      const itemTitle = linkTitle.trim() || `YouTube Video (${videoId})`;
      const { error: insertError } = await supabase.from("items").insert({
        user_id: userId,
        source_type: "youtube",
        source_url: youtubeUrl.trim(),
        video_id: videoId,
        title: itemTitle,
        status: "queued",
        progress: 0,
      });

      if (insertError) {
        throw new Error(`Failed to submit link: ${insertError.message}`);
      }

      router.push("/library");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setSubmittingLink(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur-md sticky top-0 z-20">
        <Link href="/library" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
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
          <span className="text-base font-bold tracking-tight text-white">
            Echo<span className="text-indigo-400">Notes</span> <span className="text-xs font-mono font-normal text-[var(--text-muted)]">Studio</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">
            {userEmail}
          </span>
          <Link
            href="/library"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-white transition-all"
          >
            &larr; Studio Library
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="slide-up w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono font-medium text-indigo-400 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 badge-pulse" />
              Zero-Cloud API Processing
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">Process New Video</h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Paste a YouTube link or upload audio/video to generate Choi C99 chapters, takeaways, and search embeddings
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
            {/* Tabs */}
            <div className="flex rounded-xl bg-[var(--bg-input)] p-1 mb-6 border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("link");
                  setErrorMessage(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                  activeTab === "link"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                YouTube Link
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("upload");
                  setErrorMessage(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                  activeTab === "upload"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload File (up to 50 MB)
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 fade-in">
                {errorMessage}
              </div>
            )}

            {/* YouTube Link Tab Form */}
            {activeTab === "link" && (
              <form onSubmit={handleLinkSubmit} className="space-y-5">
                <div>
                  <label htmlFor="youtubeUrl" className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                    YouTube URL
                  </label>
                  <input
                    id="youtubeUrl"
                    type="url"
                    required
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-all focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5 font-mono">
                    Supports regular videos, lectures, shorts, and timestamped links (up to 90 min)
                  </p>
                </div>

                <div>
                  <label htmlFor="linkTitle" className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                    Custom Title (optional)
                  </label>
                  <input
                    id="linkTitle"
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Auto-detected from video if left blank"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-all focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingLink || !youtubeUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {submittingLink ? (
                    <>
                      <span className="spinner" />
                      Queuing YouTube Video...
                    </>
                  ) : (
                    "Process Video into Notes & Chapters"
                  )}
                </button>
              </form>
            )}

            {/* Upload Tab Form */}
            {activeTab === "upload" && (
              <form onSubmit={handleUploadSubmit} className="space-y-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelection(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-[var(--border-subtle)] hover:border-indigo-500/40 bg-[var(--bg-input)]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mov,.webm,.mkv,.avi,.txt,.md,.srt,.vtt,audio/*,video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelection(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &middot; Click to replace
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-white">
                        Choose an audio/video file or drag & drop here
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 font-mono">
                        .mp3, .wav, .m4a, .mp4, .webm, .srt &middot; Max 50 MB
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="uploadTitle" className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                    Title (optional)
                  </label>
                  <input
                    id="uploadTitle"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Stanford Lecture on Deep Learning"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-all focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <span className="spinner" />
                      Uploading & Queuing...
                    </>
                  ) : (
                    "Upload and Process"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}