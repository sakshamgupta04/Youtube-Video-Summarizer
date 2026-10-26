---
title: EchoNotes Worker
emoji: 🎙️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# 🎙️ EchoNotes Worker (Hugging Face Space)

Standalone background processing worker and vector embedding backend for **EchoNotes**.

Runs on a **Free CPU Hugging Face Space** ($0 cost).

## ⚡ Cold Start & Idle Sleep Notice
> **Note on Free Hugging Face Spaces:** Free spaces automatically go to sleep after ~48 hours of inactivity. The first request after sleeping triggers a container wake-up (~30 seconds). The worker includes built-in retry-on-startup to establish database connectivity cleanly once awakened.

## 🔐 Environment Variables (Space Secrets)

Configure the following secrets in your Hugging Face Space Settings (**Settings -> Variables and secrets**):

| Secret Name | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Your Supabase Project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key (bypasses RLS) | `eyJhbGciOi...` |
| `WORKER_SECRET` | Shared secret header for `/embed` authentication | `your-shared-secret-key-384` |
| `SUMMARIZER_MODEL` | Hugging Face model identifier | `sshleifer/distilbart-cnn-12-6` or your fine-tuned LoRA adapter |
| `ENABLE_BACKGROUND_LOOP` | Run polling loop alongside FastAPI server | `true` |

## 🛠️ Endpoints

- `GET /health`: Comprehensive health and readiness check with database connectivity and uptime status.
- `POST /embed`: Protected endpoint generating 384-dimensional `all-MiniLM-L6-v2` dense vector embeddings for semantic search.
