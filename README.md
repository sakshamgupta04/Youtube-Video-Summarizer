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

## 📊 Evaluation & Empirical Benchmarks

All benchmark metrics are computed locally using open-source tools with zero paid APIs (see [`results.md`](./results.md) for full breakdown):

| Metric Category | Benchmark Task | Baseline | Fine-Tuned / Local Model | Outcome / Improvement |
|---|---|---|---|---|
| **Speech-to-Text (WER)** | 5 hand-corrected clips | 32.40% (YouTube) | **7.16%** (Faster-Whisper int8) | **77.9% error reduction** |
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

## 📄 License
MIT License. Free to use and modify for personal and educational projects.
