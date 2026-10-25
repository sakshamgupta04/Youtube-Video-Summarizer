# 🎙️ EchoNotes

> **Open-source podcast & lecture summarizer with interactive searchable timelines.**
> Fully local AI inference — **Zero paid AI APIs**. Built with Next.js, FastAPI, Supabase pgvector, Faster-Whisper, KeyBERT, and DistilBART.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E)](https://supabase.com/)
[![Whisper](https://img.shields.io/badge/Faster--Whisper-int8-orange)](https://github.com/SYSTRAN/faster-whisper)
[![Transformers](https://img.shields.io/badge/HuggingFace-Transformers-yellow)](https://huggingface.co/)

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
  - **Map Step**: Summarizes each individual chapter using `sshleifer/distilbart-cnn-12-6` (split into sub-chunks if exceeding 700 tokens).
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

## 🏗️ Architecture

```
                       ┌─────────────────────────┐
                       │   Next.js 16 Web App    │
                       │  (Tailwind + SSR Auth)  │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
 ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
 │ Supabase Postgres │    │  FastAPI Worker   │    │  Public Read-Only │
 │  (pgvector, Auth, │    │  (Whisper, Embed, │    │  Pages (/s/token) │
 │  Storage Bucket)  │    │  KeyBERT, BART)   │    │ (Server-side key) │
 └───────────────────┘    └───────────────────┘    └───────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v20+ & `npm`
- **Python** 3.10+ (with `venv`)
- **FFmpeg** installed and on system `PATH`
- A free **Supabase** project with `vector` extension enabled

### 2. Database Setup
Paste the contents of `supabase/schema.sql` into your Supabase SQL Editor:
- Creates `items` and `chunks` tables with Row Level Security (RLS)
- Enables `pgvector` and HNSW cosine distance indexing
- Creates the `match_chunks` semantic search RPC function
- Creates a private storage bucket named `uploads`

### 3. Configure Environment Variables

**Frontend (`web/.env.local`)**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_WORKER_URL=http://localhost:8000
WORKER_SECRET=your-shared-secret-key-384
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Worker (`worker/.env`)**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
POLL_INTERVAL_SEC=5
MAX_DURATION_SEC=5400
WORKER_SECRET=your-shared-secret-key-384
SUMMARIZER_MODEL=sshleifer/distilbart-cnn-12-6
```

### 4. Run Locally

**Start Worker**:
```bash
cd worker
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

**Start Next.js App**:
```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start summarizing!

---

## 🧪 Testing

Run unit and pipeline integration tests:
```bash
cd worker
pytest tests/ -v
```

All 37+ tests pass covering:
- Text, Markdown, SRT, VTT parsing
- FFmpeg audio extraction & Whisper transcription
- YouTube video ID parsing, captions, and download fallbacks
- Chunking & pgvector embedding generation
- Chapter boundary detection & KeyBERT extraction
- Map-Reduce summarization pipeline
- Markdown export formatting & share token generation

---

## 📄 License
MIT License. Free to use and modify for personal and educational projects.
