-- EchoNotes database schema
-- Run this in the Supabase SQL Editor

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
