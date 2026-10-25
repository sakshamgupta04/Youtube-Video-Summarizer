# EchoNotes – Phase 8a Evaluation Benchmark Results

> **Generated:** 2026-10-26 00:07:46  
> **Environment:** Open-source local models (Faster-Whisper int8, all-MiniLM-L6-v2, KeyBERT, DistilBART-CNN-12-6)  
> **Status:** All 4 Evaluation Metrics Successfully Benchmarked

---

## 1. Executive Summary Table

| Metric Category | Target Benchmark | Measured Result | Benchmark Status |
|---|---|---|---|
| **Speech-to-Text Accuracy (WER)** | Whisper vs YouTube Captions | **7.16%** (Whisper) vs **32.4%** (YouTube) | **77.9% error reduction** |
| **Character Error Rate (CER)** | Whisper vs YouTube Captions | **5.99%** (Whisper) vs **9.09%** (YouTube) | **Passed** |
| **Chapter Segmentation (Pk)** | NLTK Segmentation Pk (lower is better) | **0.0390** (0.0 = perfect) | **Excellent (< 0.10)** |
| **Chapter Segmentation (WindowDiff)** | NLTK WindowDiff (lower is better) | **0.0390** | **Excellent (< 0.10)** |
| **Chapter Boundary F1** | Tolerance ±1 segment | **100.0%** | **Passed** |
| **Search Hit@5** | Top-5 Retrieval Accuracy (30 queries) | **100.0%** | **Target 100% Achieved** |
| **Search Hit@1** | Top-1 Exact Retrieval Accuracy | **96.7%** | **High Precision** |
| **Search MRR@5** | Mean Reciprocal Rank | **0.9833** | **Outstanding (> 0.95)** |
| **Real-Time Factor (RTF)** | processing_sec / audio_sec (< 1.0) | **0.1749** | **5.72x faster than real-time** |

---

## 2. Speech-to-Text Evaluation: Word Error Rate (WER with jiwer)

Comparing **Faster-Whisper (int8 CPU)** against **YouTube automated captions** on 5 hand-corrected audio clips across varied technical and conversational domains.

| Clip ID | Clip Title | Audio Length | Whisper WER | YouTube WER | Absolute Diff | Relative Whisper Advantage |
|---|---|---|---|---|---|---|
| `clip_01_ml_lecture` | Stanford CS229 - Gradient Descent & Backpropagation | 124s | **0.00%** | 5.88% | -5.88% | **+100.0%** |
| `clip_02_tech_podcast` | Lex Fridman Podcast - LLMs and Transformer Architecture | 142s | **0.00%** | 27.59% | -27.59% | **+100.0%** |
| `clip_03_swe_tutorial` | Kubernetes Ingress & Container Orchestration | 115s | **4.00%** | 40.00% | -36.00% | **+90.0%** |
| `clip_04_startup_pitch` | Y Combinator Demo Day - SaaS Economics & Growth Metrics | 98s | **31.82%** | 40.91% | -9.09% | **+22.2%** |
| `clip_05_biology_lecture` | CRISPR-Cas9 Gene Editing Mechanisms | 136s | **0.00%** | 47.62% | -47.62% | **+100.0%** |

**Key Insight:** Automated YouTube captions frequently fail on domain-specific vocabulary (e.g. *protospacer adjacent motif*, *NGINX ingress controller*, *softmax scaling factor*). Faster-Whisper captures technical acoustic phonetics accurately, delivering a **77.9% error reduction**.

---

## 3. Chapter Boundary Accuracy (NLTK Segmentation: Pk & WindowDiff)

Evaluated against hand-marked ground truth chapter boundaries across 10 educational videos and podcast episodes.

- **Pk (Beeferman et al.)**: Probability that two random units distance $k$ apart are falsely classified across a boundary. (Lower is better, 0.0 = perfect match).
- **WindowDiff (Pevzner & Hearst)**: Penalizes missing and false boundary predictions within a sliding window of size $k$. (Lower is better, 0.0 = perfect match).

| Video ID | Title | Duration | Window Size ($k$) | Pk Metric | WindowDiff | Boundary F1 (±1 unit) |
|---|---|---|---|---|---|---|
| `vid_01_stanford_cs229` | Stanford CS229: Machine Learning Introduction | 45 min | 4 | **0.0476** | **0.0476** | 100.0% |
| `vid_02_karpathy_ai` | Lex Fridman Podcast: Andrej Karpathy on AI | 60 min | 6 | **0.0364** | **0.0364** | 100.0% |
| `vid_03_nextjs_architecture` | Next.js 15 Full Course & Architecture Deep Dive | 40 min | 4 | **0.0541** | **0.0541** | 100.0% |
| `vid_04_mit_6006_sorting` | MIT 6.006: Introduction to Algorithms & Sorting | 50 min | 5 | **0.0435** | **0.0435** | 100.0% |
| `vid_05_raft_consensus` | Building Distributed Systems with Raft Consensus | 35 min | 4 | **0.0000** | **0.0000** | 100.0% |
| `vid_06_huberman_dopamine` | The Huberman Lab: Optimize Dopamine for Focus | 55 min | 6 | **0.0400** | **0.0400** | 100.0% |
| `vid_07_python_concurrency` | Python Concurrency: Asyncio, Threading, Multiprocessing | 30 min | 3 | **0.0714** | **0.0714** | 100.0% |
| `vid_08_database_internals` | Database Internals: B-Trees, LSM-Trees & WAL | 45 min | 4 | **0.0000** | **0.0000** | 100.0% |
| `vid_09_cs50_cybersecurity` | Harvard CS50: Cybersecurity Fundamentals | 40 min | 4 | **0.0541** | **0.0541** | 100.0% |
| `vid_10_vector_databases` | Designing Scalable Vector Databases for AI | 50 min | 5 | **0.0435** | **0.0435** | 100.0% |

**Aggregate Metrics:**
- **Mean Pk:** **0.0390**
- **Mean WindowDiff:** **0.0390**
- **Mean Boundary F1:** **100.0%**

---

## 4. Semantic Search Retrieval Accuracy (Hit@5 on 30 Questions)

Evaluated using `all-MiniLM-L6-v2` dense vector embeddings and cosine similarity against an indexed corpus of knowledge chunks.

- **Total Questions:** 30
- **Corpus Size:** 30 chunks
- **Hit@1 Rate:** **96.7%** (29/30 questions)
- **Hit@5 Rate:** **100.0%** (30/30 questions)
- **Mean Reciprocal Rank (MRR@5):** **0.9833**

| Question ID | Target Chunk | Found Rank | Hit@5 | Query |
|---|---|---|---|---|
| `q01` | `chunk_02` | **#1** | Yes | How does backpropagation compute gradients through hidden layers? |
| `q02` | `chunk_01` | **#1** | Yes | Why does stochastic gradient descent escape saddle points? |
| `q03` | `chunk_03` | **#1** | Yes | How do transformers compute multi-head self-attention? |
| `q04` | `chunk_04` | **#2** | Yes | Why are dot product attention scores scaled by the square root of dimension? |
| `q05` | `chunk_05` | **#1** | Yes | What is the role of RLHF and reward models in post-training language models? |
| `q06` | `chunk_06` | **#1** | Yes | What are the performance advantages of Next.js Server Components? |
| `q07` | `chunk_07` | **#1** | Yes | How do Next.js Server Actions perform database mutations? |
| `q08` | `chunk_08` | **#1** | Yes | What is the time complexity and mechanism of merge sort? |
| `q09` | `chunk_09` | **#1** | Yes | How is the Master Theorem used to solve divide and conquer recurrences? |
| `q10` | `chunk_10` | **#1** | Yes | How does Raft maintain consistency across replicated state machines? |
| `q11` | `chunk_11` | **#1** | Yes | Why does Raft use randomized election timeouts for candidate nodes? |
| `q12` | `chunk_12` | **#1** | Yes | What biological function does dopamine serve in motivation and pursuit? |
| `q13` | `chunk_13` | **#1** | Yes | How does deliberate cold exposure influence baseline dopamine levels? |
| `q14` | `chunk_14` | **#1** | Yes | What is the Python Global Interpreter Lock and how does it limit threading? |
| `q15` | `chunk_15` | **#1** | Yes | How does asyncio event loop achieve non-blocking concurrency? |
| `q16` | `chunk_16` | **#1** | Yes | How do B+ Trees optimize disk page reads for range queries? |
| `q17` | `chunk_17` | **#1** | Yes | How do LSM-Trees and MemTables handle high throughput write workloads? |
| `q18` | `chunk_18` | **#1** | Yes | How does write-ahead logging ensure crash recovery in database systems? |
| `q19` | `chunk_19` | **#1** | Yes | How do HNSW graphs perform approximate nearest neighbor vector search? |
| `q20` | `chunk_20` | **#1** | Yes | What is product quantization and how does it compress vector embeddings? |
| `q21` | `chunk_21` | **#1** | Yes | How does Cas9 endonuclease use guide RNA to introduce double strand breaks? |
| `q22` | `chunk_22` | **#1** | Yes | What is the function of the protospacer adjacent motif sequence in CRISPR? |
| `q23` | `chunk_23` | **#1** | Yes | How do Kubernetes ingress controllers route traffic to container pods? |
| `q24` | `chunk_24` | **#1** | Yes | What is an ideal LTV to CAC ratio for SaaS unit economics? |
| `q25` | `chunk_25` | **#1** | Yes | How do attackers execute Cross-Site Scripting vulnerabilities in web browsers? |
| `q26` | `chunk_26` | **#1** | Yes | How can unsanitized user input lead to SQL injection vulnerabilities? |
| `q27` | `chunk_27` | **#1** | Yes | How does PostgreSQL Row-Level Security enforce per-user access control? |
| `q28` | `chunk_28` | **#1** | Yes | How does Faster-Whisper achieve fast speech-to-text inference with int8 quantization? |
| `q29` | `chunk_29` | **#1** | Yes | How does KeyBERT identify the most relevant keyphrases in a document? |
| `q30` | `chunk_30` | **#1** | Yes | How does map-reduce summarization generate hierarchical summaries of long content? |

---

## 5. Computational Efficiency: Real-Time Factor (RTF)

$$\text{RTF} = \frac{\text{Processing Time (seconds)}}{\text{Audio Duration (seconds)}}$$

A Real-Time Factor **< 1.0** indicates processing finishes faster than real-time audio playback.

| Audio Duration | Processing Time (sec) | Measured RTF | Speedup Factor | Status |
|---|---|---|---|---|
| 1m 0s (60s) | 11.95s | **0.1992** | **5.02x** | Faster than real-time |
| 2m 0s (120s) | 22.03s | **0.1836** | **5.45x** | Faster than real-time |
| 5m 0s (300s) | 52.27s | **0.1742** | **5.74x** | Faster than real-time |
| 10m 0s (600s) | 102.67s | **0.1711** | **5.84x** | Faster than real-time |

**Overall Real-Time Factor (RTF):** **0.1749**  
**End-to-End Speedup:** **5.72x faster than playback speed**

### Pipeline Stage Timing Breakdown

```
Audio Input (100%)
├── 1. Ingest & FFmpeg Audio Extraction : ~ 3.4% of total time
├── 2. Faster-Whisper (int8 CPU)        : ~48.6% of total time
├── 3. Chunking & Sentence Embeddings   : ~ 6.9% of total time
├── 4. Chaptering & KeyBERT Scoring     : ~11.4% of total time
└── 5. DistilBART Map-Reduce Summaries  : ~25.7% of total time
```

---
*Report generated automatically by `eval/run_eval.py` for EchoNotes Phase 8a.*
