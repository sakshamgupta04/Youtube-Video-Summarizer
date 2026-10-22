# EchoNotes – Build Plan

Podcast & lecture summarizer with searchable timeline. No paid AI APIs. All models are open-source and run by you.

Input: YouTube link, or uploaded audio / video / text file. Output: transcript, chapters, key points, summary, semantic search, shareable page, export to notes.

## 0. How to use this file with Antigravity (free tier)
- Put this file in your repo root as PROJECT_RULES.md.
- Start every new agent chat with: "Read PROJECT_RULES.md first. Today we do Phase N only."
- One phase per chat. Small tasks use fewer free-tier credits and cause fewer agent mistakes.
- After each phase passes its "Done when" check, run git commit. If the agent breaks something, you can roll back.
- If the agent loops or rewrites unrelated files, stop it and re-send a smaller prompt.
- Keep secrets in .env files only. Never paste keys into chat.
- Develop with short test files (a 2-minute audio clip, a 5-minute YouTube video). Do not test with hour-long files.

### Rules for the agent
- Do not change the stack below.
- Do not add paid APIs or new services.
- Keep each file small and functions short, with type hints.
- Write one simple test for each module you add.
- When something fails, show a clear error message; never crash silently.
- Never store downloaded YouTube audio after transcription. Delete it.

---

## 1. Stack (fixed)

| Part | Tool |
|---|---|
| Frontend | Next.js (TypeScript), Tailwind, deployed on Vercel (free) |
| Backend / worker | Python 3.11, FastAPI |
| Database, auth, storage | Supabase (Postgres + pgvector + Auth + Storage) |
| Speech-to-text | faster-whisper (model base, int8, CPU) |
| YouTube | youtube-transcript-api first, yt-dlp second |
| Audio handling | ffmpeg |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 (384 dims) |
| Key phrases | keybert |
| Summaries | baseline sshleifer/distilbart-cnn-12-6, then your fine-tuned model |
| Evaluation | jiwer, rouge-score, bert-score, nltk |

No Redis, no queue service. The items table is the job queue.

---

## 2. Input ladder (the "full-proof" part)

Every input becomes the same thing: a list of segments `[{start, end, text}]`. After that, the pipeline is identical.

| Input | Try 1 | Try 2 | Try 3 |
|---|---|---|---|
| YouTube link | Read existing captions (fast, free) | yt-dlp audio, then Whisper | Show message: "Couldn't fetch this video. Upload the file instead." |
| Audio / video file | ffmpeg to wav, then Whisper | n/a | Clear error |
| .txt / .md | Split into paragraphs (no timestamps) | n/a | n/a |
| .srt / .vtt | Parse (real timestamps) | n/a | n/a |
| RSS podcast (later) | Download public MP3, then Whisper | n/a | n/a |

### Rules:
- Run `pip install -U yt-dlp` when the worker starts, because YouTube changes often.
- YouTube often blocks cloud IPs. If it fails online, it will still work when the worker runs on your own machine. The upload option is always available as the backup.
- Text files have no timestamps. Save `has_timestamps = false` and hide times in the UI.
- Limits: max 90 minutes, max 50 MB upload (Supabase free tier cap; check your dashboard), 10 items per user per day.

---

## 3. Folder structure
```
echonotes/
├── PROJECT_RULES.md
├── web/                       # Next.js app
│   └── app/ (login, library, item/[id], search, s/[token], api/search)
├── worker/
│   ├── app/
│   │   ├── main.py            # FastAPI: /health, /embed
│   │   ├── loop.py            # polls DB for queued items
│   │   ├── db.py, config.py
│   │   ├── ingest/ youtube.py, files.py, rss.py
│   │   └── pipeline/ transcribe.py, chunk.py, embed.py,
│   │                 chapters.py, keypoints.py, summarize.py
│   ├── tests/
│   └── requirements.txt
├── eval/                      # metric scripts + test data
├── notebooks/finetune_summarizer.ipynb   # run on Colab/Kaggle
└── supabase/schema.sql
```

---

## 4. Database (paste into Supabase SQL editor)

```sql
create extension if not exists vector;

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  source_type text not null check (source_type in ('youtube','audio','video','text','rss')),
  source_url text, video_id text, storage_path text, title text,
  status text not null default 'queued',  -- queued|fetching|transcribing|analyzing|done|failed
  progress int default 0, error text,
  duration_sec int, has_timestamps boolean default true,
  transcript jsonb,   -- [{start,end,text}]
  chapters jsonb,     -- [{start,end,title,summary}]
  key_points jsonb,   -- ["..."]
  summary text,
  share_token text unique,
  created_at timestamptz default now()
);

create table chunks (
  id bigserial primary key,
  item_id uuid not null references items on delete cascade,
  user_id uuid not null,
  start_sec real, text text,
  embedding vector(384)
);

create index on chunks using hnsw (embedding vector_cosine_ops);
create index on items (user_id, created_at desc);

alter table items  enable row level security;
alter table chunks enable row level security;
create policy own_items  on items  for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_chunks on chunks for select using (auth.uid() = user_id);

create function match_chunks(q vector(384), n int default 10, only_item uuid default null)
returns table(item_id uuid, start_sec real, text text, score float)
language sql stable as $$
  select item_id, start_sec, text, 1 - (embedding <=> q)
  from chunks
  where user_id = auth.uid() and (only_item is null or item_id = only_item)
  order by embedding <=> q limit n;
$$;
```

Also create a Storage bucket named `uploads` (private). The worker uses the service role key (bypasses RLS). The website uses only the anon key. The service key never goes in `web/`.

---

## 5. How the pipeline works (each step in one line)
1. **Claim job**: worker sets one queued item to fetching (atomic update, so two workers never take the same item).
2. **Cache check**: if another done item has the same video_id, copy its results and finish.
3. **Ingest**: follow the input ladder to get segments. Update status and progress at each step.
4. **Chunk**: group about 5 segments (roughly 30 to 60 seconds) per chunk.
5. **Embed**: embed every chunk, store in chunks.
6. **Chapters**: embed windows of segments, compute similarity between neighbors, put a boundary where similarity drops sharply. Minimum 2 minutes per chapter (about 10 windows for text). Title each chapter with the top KeyBERT phrase.
7. **Key points**: per chapter, pick the 2 to 3 most central sentences (TextRank or MMR on embeddings).
8. **Summary (map-reduce)**: summarize each chapter (input at most about 700 tokens, split if longer), then summarize the chapter summaries into one overall summary.
9. **Finish**: write results, set status = done. On any error set status = failed and a readable error.

---

## 6. Build phases (each ends with a "Done when" check)

### Phase 1 – Project, database, login
Done when: you can sign up, log in, see an empty library, and GET /health returns ok.
