-- EchoNotes Sample Library Seed
-- Inserts 3 pre-processed public lectures so visitors can explore immediately without waiting.
-- Run this in your Supabase SQL Editor if you wish to persist sample items in your database.

-- 1. Stanford CS229: Machine Learning Introduction
INSERT INTO items (
  id,
  user_id,
  source_type,
  source_url,
  video_id,
  title,
  status,
  progress,
  duration_sec,
  has_timestamps,
  summary,
  key_points,
  chapters,
  transcript,
  created_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  auth.uid(),
  'youtube',
  'https://www.youtube.com/watch?v=jGwO_EiCahm',
  'jGwO_EiCahm',
  'Stanford CS229: Machine Learning Introduction & Linear Regression',
  'done',
  100,
  2700,
  true,
  'Professor Andrew Ng introduces Stanford CS229, defining machine learning through Arthur Samuel''s and Tom Mitchell''s taxonomies. The lecture covers the mathematical formulation of supervised learning via linear regression, derives the batch gradient descent update rule using the calculus chain rule, and contrasts iterative optimization with closed-form normal equations.',
  '["Machine learning algorithms improve performance measure P at task T through experiential data E.", "Supervised learning algorithms map input features X to continuous target values Y via parameterized hypothesis functions.", "The least mean squares (LMS) cost function measures half the squared error between predictions and ground-truth targets.", "Batch gradient descent updates parameters simultaneously in the negative gradient direction across all training examples.", "The normal equation X^T X theta = X^T y provides an exact analytical solution without requiring an iterative learning rate."]'::jsonb,
  '[
    {"start": 0, "end": 480, "title": "Introduction & Taxonomy of Machine Learning", "summary": "Overview of course logistics and fundamental definitions distinguishing supervised regression from unsupervised clustering."},
    {"start": 480, "end": 1140, "title": "Supervised Learning & Linear Hypothesis", "summary": "Formulation of housing price prediction using linear combinations of feature vectors with intercept terms."},
    {"start": 1140, "end": 1680, "title": "Cost Functions & Least Mean Squares", "summary": "Derivation of the quadratic loss function and intuitive geometric visualization of parabolic cost surfaces."},
    {"start": 1680, "end": 2160, "title": "Batch Gradient Descent Algorithm", "summary": "Step-by-step derivation of the gradient descent update equation and impact of the learning rate parameter alpha."},
    {"start": 2160, "end": 2700, "title": "Normal Equations & Matrix Calculus", "summary": "Derivation of the closed-form matrix solution using matrix traces and derivatives of quadratic forms."}
  ]'::jsonb,
  '[
    {"start": 0, "end": 14, "text": "Welcome to CS229, the machine learning class. Today we will start by defining what machine learning is."},
    {"start": 15, "end": 32, "text": "Arthur Samuel described it as the field of study that gives computers the ability to learn without being explicitly programmed."},
    {"start": 480, "end": 510, "text": "Let us consider our first supervised learning algorithm: linear regression on housing prices."},
    {"start": 1140, "end": 1175, "text": "To measure how well our hypothesis fits the training data, we define the cost function J of theta."},
    {"start": 1680, "end": 1715, "text": "In batch gradient descent, we start with some initial guess for theta and repeatedly update in the steepest downhill direction."},
    {"start": 2160, "end": 2200, "text": "Rather than taking small iterative steps, is there an analytical closed-form solution to find the minimum directly?"}
  ]'::jsonb,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 2. Andrej Karpathy: LLMs & Deep Learning Foundations
INSERT INTO items (
  id,
  user_id,
  source_type,
  source_url,
  video_id,
  title,
  status,
  progress,
  duration_sec,
  has_timestamps,
  summary,
  key_points,
  chapters,
  transcript,
  created_at
) VALUES (
  'a0000000-0000-0000-0000-000000000002',
  auth.uid(),
  'youtube',
  'https://www.youtube.com/watch?v=zjkBMFhNj_g',
  'zjkBMFhNj_g',
  'Andrej Karpathy: Large Language Models & Deep Learning Foundations',
  'done',
  100,
  3600,
  true,
  'Andrej Karpathy breaks down the transformer architecture and the multi-stage training pipeline of modern Large Language Models. He explains next-token prediction, pretraining on trillions of tokens, Supervised Fine-Tuning (SFT), Reinforcement Learning from Human Feedback (RLHF), and how LLMs function as emerging operating systems for computation.',
  '["LLM pretraining is a lossy text compression process that compresses internet knowledge into neural network weights.", "The transformer self-attention mechanism enables constant path lengths between any two tokens in a context window.", "Supervised Fine-Tuning (SFT) transforms a raw document completion engine into a responsive conversational assistant.", "RLHF trains reward models on human pairwise comparisons to align model outputs with intent, safety, and helpfulness.", "LLMs are evolving into new computational runtimes where context windows serve as working RAM and tool-calling acts as system calls."]'::jsonb,
  '[
    {"start": 0, "end": 660, "title": "From Computer Vision to Language Transformers", "summary": "Evolution of deep learning from convolutional image backbones to general-purpose transformer sequence models."},
    {"start": 660, "end": 1380, "title": "Pretraining: Lossy Internet Compression", "summary": "How training on 10+ trillion tokens compresses world knowledge into 8-bit and 16-bit parameter matrices."},
    {"start": 1380, "end": 2040, "title": "Tokenization & Byte-Pair Encoding (BPE)", "summary": "How raw unicode characters are transformed into vocabulary tokens and common tokenization quirks."},
    {"start": 2040, "end": 2760, "title": "Post-Training: SFT and RLHF Alignment", "summary": "The transition from next-token pretraining to instruction tuning, preference modeling, and PPO alignment."},
    {"start": 2760, "end": 3600, "title": "LLM as an Operating System & Autonomous Agents", "summary": "Viewing the context window as RAM and tool-use as system peripherals for agentic problem solving."}
  ]'::jsonb,
  '[
    {"start": 0, "end": 20, "text": "A large language model is fundamentally two files: a weights file and a run.c file that evaluates the neural network."},
    {"start": 660, "end": 700, "text": "In pretraining, we scrape a massive chunk of the public internet—roughly 10 trillion tokens of text."},
    {"start": 1380, "end": 1420, "text": "Before text enters the transformer, it passes through a byte-pair encoder that groups characters into integers."},
    {"start": 2040, "end": 2085, "text": "A base model is not an assistant; it is a document completer. To make an assistant, we perform Supervised Fine-Tuning."},
    {"start": 2760, "end": 2810, "text": "Think of the LLM not just as a chatbot, but as the CPU of a new operating system."}
  ]'::jsonb,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 3. Next.js 15 Full Architecture
INSERT INTO items (
  id,
  user_id,
  source_type,
  source_url,
  video_id,
  title,
  status,
  progress,
  duration_sec,
  has_timestamps,
  summary,
  key_points,
  chapters,
  transcript,
  created_at
) VALUES (
  'a0000000-0000-0000-0000-000000000003',
  auth.uid(),
  'youtube',
  'https://www.youtube.com/watch?v=wm5gMKuwSYk',
  'wm5gMKuwSYk',
  'Next.js 15 Full Architecture: Server Components & React Streaming',
  'done',
  100,
  2400,
  true,
  'A comprehensive architectural breakdown of Next.js 15 and React Server Components (RSC). The tutorial demonstrates asynchronous streaming with React Suspense, zero-client-bundle data fetching, Server Actions for form mutations, Partial Prerendering (PPR), and production optimization at the Edge.',
  '["React Server Components execute strictly on the server and send zero client JavaScript runtime to the browser.", "Streaming SSR allows fast Time to First Byte (TTFB) by flushing the HTML shell before heavy database queries finish.", "Server Actions eliminate boilerplate API route endpoints, providing type-safe mutations with automatic revalidation.", "Partial Prerendering (PPR) combines static shell caching with dynamic streaming holes in a single HTTP response.", "Incremental Static Regeneration (ISR) enables on-demand background regeneration of dynamic pages without rebuilding."]'::jsonb,
  '[
    {"start": 0, "end": 420, "title": "Server Components Architecture & Philosophy", "summary": "Explaining the mental model shift from client-side hydration to server-only component trees."},
    {"start": 420, "end": 900, "title": "Streaming SSR with React Suspense", "summary": "How async boundaries stream interactive fallback UI while waiting for slow upstream microservices."},
    {"start": 900, "end": 1440, "title": "Server Actions & Optimistic Mutations", "summary": "Handling form submissions and database writes with useActionState, useOptimistic, and revalidatePath."},
    {"start": 1440, "end": 1980, "title": "Partial Prerendering (PPR) & Cache Tiers", "summary": "Merging static edge delivery speed with dynamic personalized user content in a unified render pass."},
    {"start": 1980, "end": 2400, "title": "Edge Runtime & Global Production Deployments", "summary": "Configuring Vercel edge networks, middleware authentication, and sub-50ms international responses."}
  ]'::jsonb,
  '[
    {"start": 0, "end": 18, "text": "In this deep dive, we explore Next.js 15 and how React Server Components reshape web architecture."},
    {"start": 420, "end": 460, "text": "With React Suspense, we wrap slow components in a suspense boundary and stream the initial HTML shell instantly."},
    {"start": 900, "end": 940, "text": "Server Actions let you write async functions that execute directly on the server without creating REST API routes."},
    {"start": 1440, "end": 1490, "text": "Partial Prerendering combines the instant response of static generation with the freshness of dynamic SSR."},
    {"start": 1980, "end": 2030, "text": "Deploying to the Edge places your lightweight rendering middleware close to users globally with minimal latency."}
  ]'::jsonb,
  now()
) ON CONFLICT (id) DO NOTHING;
