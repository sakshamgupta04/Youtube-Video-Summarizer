# 🎙️ EchoNotes

> **EchoNotes** is a fully local, open-source podcast and lecture summarization platform that transforms long audio, video, and YouTube links into searchable timestamped transcripts, intelligent chapters, key takeaways, and hierarchical summaries—with **$0 in paid AI API costs** and zero cloud subscription fees. Designed with a Next.js 16 frontend, an asynchronous FastAPI worker, and Supabase pgvector, it features interactive video scrubbing, synchronized transcript highlighting, semantic timestamp search, public read-only links, and one-click Markdown notes export.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Deploy with Vercel](https://img.shields.io/badge/Vercel-Live%20Demo-black?logo=vercel)](https://youtube-video-summarizer-sage.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E)](https://supabase.com/)
[![Whisper](https://img.shields.io/badge/Faster--Whisper-int8-orange)](https://github.com/SYSTRAN/faster-whisper)
[![LoRA](https://img.shields.io/badge/PEFT-LoRA%20Flan--T5-purple)](https://huggingface.co/)

**🚀 Live Web Application:** [https://youtube-video-summarizer-sage.vercel.app](https://youtube-video-summarizer-sage.vercel.app)

---

## ✨ Features

- **Multi-Source Ingestion**:
  - **YouTube**: Auto-extracts captions via `youtube-transcript-api`; seamlessly falls back to `yt-dlp` audio download + local Whisper transcription if no captions exist.
  - **Audio & Video**: Uploads `.mp3`, `.mp4`, `.wav`, `.m4a` files up to 50 MB, transcribed locally with `faster-whisper` (`base`, `int8`).
  - **Text & Transcripts**: Paste or upload `.txt`, `.md`, `.srt`, or `.vtt` documents.
- **Smart Semantic Chunking & pgvector**:
  - Encodes transcript segments into 384-dimensional dense vectors with `sentence-transformers/all-MiniLM-L6-v2`.
  - Stored with HNSW indexes in Supabase Postgres using `pgvector`.
- **Semantic Chapters with KeyBERT**:
  - Detects topic transitions using sliding cosine similarity drops between adjacent segment windows.
  - Generates descriptive 2–3 word chapter titles via `KeyBERT`.
- **Central Key Points**:
  - Extracts 5–10 central takeaways using embedding centrality and Maximal Marginal Relevance (MMR).
- **Map-Reduce Summaries**:
  - **Map Step**: Summarizes each individual chapter using `sshleifer/distilbart-cnn-12-6` or fine-tuned `flan-t5-base-lora`.
  - **Reduce Step**: Condenses chapter summaries into one high-level Executive Summary.
- **Interactive Video Player**:
  - **YouTube IFrame API** for links, **HTML5 Video/Audio** for uploads (with secure signed URLs), and document view for text.
  - **Clickable Chapter Timeline**: Clicking any chapter seeks the player to that exact second.
  - **Live Synchronized Transcript**: Highlights the current spoken line in real time and smoothly auto-scrolls.
  - **Playback Speed**: Control speed from `0.75x` to `2.0x`.
  - **Keyboard Shortcuts**: Space to Play/Pause, Left/Right arrows for &plusmn;5s seek, J/L for &plusmn;10s.
- **Cross-Library Semantic Search**:
  - Global Search (`/search`) and In-Item Search.
  - Search natural language questions or concepts and jump directly to the exact moment.
- **Public Read-Only Sharing (`/s/[token]`)**:
  - Generate a secure public link to share summaries, key points, and chapters without requiring viewers to log in.
- **Export to Markdown**:
  - One-click client-side download to export clean `.md` notes with timestamps, summaries, and transcripts.

---

## 🚀 Try the Sample Library (No Waiting Required)

Explore 3 pre-processed public lectures with clickable chapter timelines, synchronized transcripts, and semantic search—instant interactive demo, zero waiting:

1. **[Stanford CS229: Machine Learning Introduction & Linear Regression](http://localhost:3000/item/sample-cs229)** (Prof. Andrew Ng) &bull; 45 min &bull; 5 Chapters
2. **[Andrej Karpathy: Large Language Models & Deep Learning Foundations](http://localhost:3000/item/sample-karpathy)** (Lex Fridman Podcast) &bull; 60 min &bull; 5 Chapters
3. **[Next.js 15 Full Architecture: Server Components & React Streaming](http://localhost:3000/item/sample-nextjs)** (Architecture Deep Dive) &bull; 40 min &bull; 5 Chapters

---

## 🏗️ Architecture

```
                       ┌─────────────────────────────────┐
                       │       Next.js 16 Web App        │
                       │     (Vercel Edge / SSR Auth)    │
                       └────────────────┬────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
 ┌───────────────────┐        ┌───────────────────┐        ┌───────────────────┐
 │ Supabase Postgres │        │  FastAPI Worker   │        │  Public Read-Only │
 │  (pgvector HNSW,  │◄───────┤  (Whisper, Embed, │        │  Pages (/s/token) │
 │  Auth & Storage)  │        │  KeyBERT, LoRA)   │        │ (Server-side key) │
 └───────────────────┘        └───────────────────┘        └───────────────────┘
                                        ▲
                                        │
                               ┌────────┴────────┐
                               │ Hugging Face    │
                               │ Spaces (Docker) │
                               └─────────────────┘
```

---

## 📊 Evaluation & Empirical Benchmarks

All benchmark metrics are computed locally using open-source tools with zero paid APIs (see [`results.md`](./results.md) for full breakdown):

| Metric Category | Benchmark Task | Baseline | Fine-Tuned / Local Model | Outcome / Improvement |
|---|---|---|---|---|
| **Speech-to-Text (WER)** | 5 hand-corrected clips | 32.40% (YouTube) | **7.16%** (Faster-Whisper int8) | **77.9% error reduction** |
| **Character Error Rate (CER)** | 5 hand-corrected clips | 9.09% (YouTube) | **5.99%** (Faster-Whisper int8) | **34.1% error reduction** |
| **Chaptering ($P_k$)** | 10 educational videos | Target < 0.10 | **0.0390** ($P_k$ & WindowDiff) | **100% Boundary $F_1$** |
| **Search Hit@5** | 30 technical questions | Random / Keyword | **100.0%** (Hit@1: 96.7%, MRR: 0.9833) | **Exact timestamp retrieval** |
| **Efficiency (RTF)** | Real-Time Factor | 1.0 (real-time) | **0.1749** (CPU int8) | **5.72x faster than playback** |
| **Summarizer ROUGE-1** | Held-out transcript test | 47.87% | **57.24%** (Flan-T5 LoRA) | **+9.37% gain** |
| **Summarizer ROUGE-2** | Held-out transcript test | 20.10% | **26.72%** (Flan-T5 LoRA) | **+6.62% gain** |
| **Summarizer ROUGE-L** | Held-out transcript test | 37.63% | **41.77%** (Flan-T5 LoRA) | **+4.14% gain** |
| **Factuality & Hallucination** | 20-sample human audit | 30.0% error rate | **0.0%** (0/20 hallucinations) | **100% factual accuracy** |

---

## 🔬 Fine-Tuning Your Own Summarizer (Phase 8b)

You can fine-tune `google/flan-t5-base` with **LoRA (PEFT)** on a free Google Colab T4 GPU or Kaggle notebook ($0 cost):

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/sakshamgupta04/Youtube-Video-Summarizer/blob/main/notebooks/finetune_summarizer.ipynb)

- **Notebook**: [`notebooks/finetune_summarizer.ipynb`](./notebooks/finetune_summarizer.ipynb)
- **Base Model**: `google/flan-t5-base` (248M params)
- **Trainable Parameters**: ~1.8M params (~0.7% of model via LoRA rank=16, alpha=32)
- **Data**: Curated conversational and media summaries from SAMSum & MediaSum
- **Training Time**: ~15–20 minutes on a free Colab T4 GPU
- **Hub Upload & Worker Integration**: Upload the adapter weights to Hugging Face Hub, then configure `SUMMARIZER_MODEL=your-username/flan-t5-base-echonotes-summarizer` in `worker/.env`. The worker automatically detects and loads PEFT/LoRA adapters on startup.

---

## 🛡️ Fault Tolerance & Fallback Table (Section 7)

EchoNotes is engineered to be resilient against real-world network failures, cloud timeouts, and format mismatches. Every critical component features an automated, graceful fallback path:

| What breaks | What happens | Implementation Details |
|---|---|---|
| **yt-dlp fails** | Message asks the user to upload the file | Caught in `worker/app/ingest/youtube.py`; records friendly prompt: `"Couldn't fetch this video. Please upload the file instead."` |
| **No captions** | Whisper path | `try_fetch_captions()` falls back cleanly to local `faster-whisper` (`base`, `int8`) audio transcription |
| **Video too long** | Friendly error with the 90-minute limit | Duration metadata checked before download; rejects media exceeding 5,400 seconds (90 min) with friendly cap error |
| **Worker is down or asleep** | Item stays queued; UI shows "waiting for worker" | Items remain safely queued in Supabase Postgres. Both Library and Item detail views show an active `"waiting for worker"` status indicator |
| **Embedding service down** | Search falls back to keyword search | In `web/src/app/api/search/route.ts`, if `/embed` is unreachable or times out, query instantly degrades to Postgres `ilike` keyword search (`mode: "keyword"`) |
| **Summary model fails** | Show key points and chapters only; mark summary unavailable | Summarizer execution is isolated with `try...except`; all generated chapters and key takeaways are preserved, while summary is cleanly marked `"Summary unavailable."` |
| **Spotify link pasted** | Message: "Spotify isn't supported yet. Upload the file, or paste the YouTube link." | Intercepted in both Web client form and Worker pipeline: `"Spotify isn't supported yet. Upload the file, or paste the YouTube link."` |

---

## ⚠️ Known Limits & Edge Cases

1. **Spotify Podcasts Not Supported Directly**:
   - Spotify encrypts audio streams using Widevine DRM and does not offer a public stream audio URL.
   - *Workaround:* Use the podcast's public RSS feed URL or export/upload the `.mp3`/`.m4a` file directly into EchoNotes.
2. **YouTube Datacenter IP Blocking**:
   - YouTube bot-detection often blocks or rate-limits requests originating from cloud datacenter IPs (AWS, GCP, Vercel, Azure).
   - *Workaround:* If running in cloud hosting and a link fails, upload the audio directly or run the EchoNotes worker on your local machine / residential IP.
3. **90-Minute Duration Cap**:
   - Ingestion enforces a hard 90-minute maximum duration limit (`MAX_DURATION_SECONDS = 5400`) to prevent CPU exhaustion on free tier resources.
4. **50 MB Upload Cap**:
   - File uploads are capped at 50 MB (`MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024`) to stay within Supabase Storage free-tier quotas.
5. **Hugging Face Spaces Idle Sleep**:
   - Free CPU Hugging Face Spaces sleep after ~48 hours of inactivity. The first request takes ~30 seconds to spin up, after which all subsequent requests execute in real-time. EchoNotes worker includes built-in retry-on-startup with exponential backoff to handle sleep wake-ups gracefully.

---

## 🚢 Deployment Guide

### Deploy Web App to Vercel
1. Push this repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/), click **New Project** and import `web/`.
3. Set the Root Directory to `web`.
4. Configure the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `NEXT_PUBLIC_WORKER_URL`: `https://your-worker.hf.space` (or your worker URL)
   - `WORKER_SECRET`: `your-shared-secret-key-384`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-supabase-service-role-key`
5. Click **Deploy**.

### Deploy Worker to Hugging Face Spaces (Free CPU Docker)
1. In [Hugging Face Spaces](https://huggingface.co/spaces), create a new Space.
2. Select **Docker** as the SDK and **CPU Basic (Free)**.
3. Push the `worker/` directory or connect your GitHub repository.
4. In Space **Settings -> Variables and secrets**, add:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_KEY`: `your-supabase-service-role-key`
   - `WORKER_SECRET`: `your-shared-secret-key-384`
   - `SUMMARIZER_MODEL`: `sshleifer/distilbart-cnn-12-6` (or your fine-tuned LoRA model)
   - `ENABLE_BACKGROUND_LOOP`: `true`
5. The container starts automatically and runs the FastAPI `/health` endpoint and polling queue worker concurrently.

---

## 🧪 Testing

Run unit and pipeline integration tests:
```bash
# In repository root:
worker\.venv\Scripts\python.exe -m pytest worker/tests/ -v
worker\.venv\Scripts\python.exe -m pytest eval/test_eval.py -v
```

All 45+ tests pass covering:
- Text, Markdown, SRT, VTT parsing
- FFmpeg audio extraction & Whisper transcription
- YouTube video ID parsing, captions, and download fallbacks
- Chunking & pgvector embedding generation
- Chapter boundary detection & KeyBERT extraction
- Map-Reduce summarization pipeline
- Markdown export formatting & share token generation
- Evaluation suite: WER with jiwer, Chapter segmentation with NLTK Pk/WindowDiff, Search Hit@5, RTF, and LoRA Summarizer comparison

---

## 📄 License
MIT License. Free to use and modify for personal and educational projects.
