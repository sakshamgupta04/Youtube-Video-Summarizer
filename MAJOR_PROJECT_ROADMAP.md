# 🎓 EchoNotes: Minor to Major Project Evolution Roadmap

> **Academic Track:** Undergraduate Computer Science & Engineering (Final Year Major Project)  
> **Project Title:** EchoNotes – Multimodal Video Intelligence, Temporal Grounding & Active Recall System  
> **Author & Developer:** Saksham Gupta  
> **Live Web Application:** [https://youtube-video-summarizer-sage.vercel.app](https://youtube-video-summarizer-sage.vercel.app)  
> **Repository:** [https://github.com/sakshamgupta04/Youtube-Video-Summarizer](https://github.com/sakshamgupta04/Youtube-Video-Summarizer)  
> **Target Research Paper:** IEEE / Springer Conference Track on Multimodal Learning & AI in Education

---

## 1. Executive Framing: Minor vs. Major Project Scope

| Project Phase | Academic Level | Core Focus & Deliverables | Status |
| :--- | :--- | :--- | :---: |
| **Minor Project** | 6th/7th Semester (Pre-Final Year) | **Foundational Audio Intelligence & Full-Stack Core**<br>&bull; Zero-cost pipeline with quantized Faster-Whisper (7.16% WER).<br>&bull; Sliding-window cosine boundary segmentation ($P_k = 0.0390$).<br>&bull; LoRA fine-tuning of `google/flan-t5-base` (+9.37% ROUGE-1).<br>&bull; Dense vector retrieval in Supabase `pgvector` (100% Hit@5).<br>&bull; Interactive Next.js 15 synchronized player & Vercel deployment. | **100% Complete & Live** |
| **Major Project** | 8th Semester (Final Year) | **Multimodal Vision-Language, Agentic RAG & Active Recall Suite**<br>&bull; **Multimodal Vision**: Blackboard & slide OCR via vision models.<br>&bull; **Conversational Video Agent**: "Chat with Video" RAG with sub-second proof citations.<br>&bull; **Speaker Diarization**: PyAnnote audio acoustic speaker labeling.<br>&bull; **Active Recall Engine**: Spaced-repetition Anki flashcards & Bloom's Taxonomy quizzes.<br>&bull; **Graph RAG**: Conceptual dependency trees & Mermaid mind-maps. | **Planned & Architecture-Ready** |

---

## 2. The 4 Engineering Pillars of the Major Project

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MAJOR PROJECT ARCHITECTURE                                │
├──────────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│    Pillar 1: Vision-Audio    │     Pillar 2: Agentic RAG    │      Pillar 3: Active Recall  │
│         Multimodal           │      (Chat with Video)       │       (Flashcards & Quiz)     │
│  - PySceneDetect keyframes   │  - Local quantized LLM       │  - Anki (.apkg) flashcard gen │
│  - Florence-2 / EasyOCR      │  - Temporal proof citations  │  - Bloom's taxonomy quizzes   │
│  - Slide-to-audio fusion     │  - Sub-second timestamp seek │  - Mermaid.js mind maps       │
├──────────────────────────────┴──────────────────────────────┴───────────────────────────────┤
│                                Pillar 4: Speaker Diarization                                │
│                         - PyAnnote Audio acoustic clustering (Speaker A/B)                  │
│                         - Multi-speaker conversational filtering & summaries                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Pillar 1: Multimodal Vision-Language Engine (Audio + Slides/Video Frames)
* **The Problem:** Technical lecturers write equations, system design diagrams, and code snippets on blackboards or slides without speaking every character aloud. An audio-only pipeline misses these visual insights.
* **The Solution:**
  1. **Scene Transition Detection:** Ingest video frames using OpenCV and PySceneDetect (`ContentDetector`) to capture slides at true visual transition points.
  2. **Optical Character & Formula Extraction:** Run lightweight vision-language models (`Microsoft/Florence-2-base` or `EasyOCR`) to extract latex equations and code blocks.
  3. **Multimodal Alignment:** Merge visual slide blocks with contemporaneous audio segments into a rich, unified multimodal transcript.

### Pillar 2: Conversational "Chat-with-Video" Agent (Temporal RAG)
* **The Problem:** Static summaries do not allow users to ask follow-up questions or clarify difficult concepts.
* **The Solution:**
  1. **In-Video Conversational Agent:** An interactive sidebar embedded directly next to the video player powered by a local quantized language model (`Llama-3.2-3B-Instruct` or `Phi-3.5-mini`).
  2. **Temporal Citation Anchors:** Every factual assertion made by the model is bound to exact video timestamps (e.g., `[14:22]`).
  3. **One-Click Proof Seek:** Clicking any generated citation anchor immediately seeks the YouTube/HTML5 player to that exact millisecond for instant verification.

### Pillar 3: Multi-Speaker Diarization (PyAnnote Audio)
* **The Problem:** In interviews, debates, and classroom Q&A sessions, transcripts currently read as a single speaker, obscuring who asked the question versus who answered it.
* **The Solution:**
  1. Integrate **`pyannote.audio`** for acoustic voiceprint feature extraction and clustering.
  2. Tag transcript utterances dynamically:
     - `[00:04:12] Speaker 1 (Interviewer): What is the core bottleneck in scaling transformers?`
     - `[00:04:18] Speaker 2 (Researcher): Primarily memory bandwidth during autoregressive decoding.`
  3. Enable speaker-specific summaries (e.g., *"Summarize only the questions asked by audience members"*).

### Pillar 4: Automated Pedagogical Intelligence (Active Recall Suite)
* **The Problem:** Passive video consumption leads to rapid cognitive decay (Ebbinghaus Forgetting Curve).
* **The Solution:**
  1. **Automated Flashcard Generation:** Automatically extract definitions, key formulas, and concepts into Anki-compatible `.apkg` flashcard decks for spaced repetition.
  2. **Bloom's Taxonomy Quiz Engine:** Generate 5–10 question self-assessments categorized into Knowledge, Application, and Analysis difficulty tiers with instant feedback.
  3. **Hierarchical Mind Maps:** Produce interactive Mermaid.js and SVG conceptual DAGs displaying topic prerequisites.

---

## 3. Academic Implementation Timeline (Major Project Semester)

| Week | Target Objective | Implementation Details | Deliverable for Evaluation Committee |
| :---: | :--- | :--- | :--- |
| **Weeks 1–3** | **Speaker Diarization** | Integrate `pyannote.audio` embedding model; speaker segmentation in `worker/app/pipeline/diarize.py`. | Transcripts with colored speaker tags and speaker-filter toggles. |
| **Weeks 4–6** | **Chat-with-Video RAG** | Implement conversational retrieval chain with local LLM (`llama.cpp` / Ollama) grounded in `pgvector`. | Interactive chat sidebar with clickable timestamp citation pills. |
| **Weeks 7–9** | **Vision-Language Slide OCR**| Video keyframe extraction via PySceneDetect + OCR formula extraction. | Multimodal notes containing blackboard equations and slide diagrams. |
| **Weeks 10–11**| **Active Recall Suite** | Spaced-repetition flashcards export (Anki `.apkg`) and Bloom's quiz generator. | Functional quiz modal and downloadable flashcard deck. |
| **Weeks 12–14**| **Ablation Studies & Paper** | Comparative benchmarking against GPT-4o / Claude 3.5; author research paper draft. | Complete Major Project Dissertation + Conference Paper Submission. |

---

## 4. Proposed Research Paper & Thesis Abstract

### Paper Title:
> **"A Multimodal Temporal-Grounding Framework for Automated Hierarchical Summarization and Active Recall from Educational Video Streams"**

### Authors:
> **Saksham Gupta**  
> *Department of Computer Science & Engineering*

### Abstract:
> *Long-form educational video streams (such as university lectures and technical symposiums) represent dense repositories of domain knowledge, yet their opaque, non-linear structure poses severe information-retrieval challenges. Existing commercial solutions rely on expensive closed-source APIs, exhibit high hallucination rates, and neglect visual slide data. We present EchoNotes, an end-to-end, zero-cost multimodal video intelligence architecture.*  
> 
> *Our framework integrates quantized Whisper speech-to-text (7.16% WER at 0.1749 RTF) with sliding-window cosine similarity chaptering ($P_k = 0.0390$) and a Parameter-Efficient Fine-Tuned (PEFT/LoRA) Flan-T5 summarizer yielding a +9.37% ROUGE-1 improvement and zero hallucinations across held-out evaluations. To bridge auditory and visual instruction, we introduce optical keyframe scene detection and dense vector retrieval with temporal grounding over PostgreSQL `pgvector`, achieving 100% Hit@5 and 0.9833 MRR. Finally, an automated pedagogical module synthesizes Bloom-compliant quizzes and spaced-repetition flashcards, establishing an open-source paradigm for verifiable, self-hosted educational AI.*

---

## 5. College Review Panel Defense Script

When asked by the panel: *"Why should this be accepted as a major project rather than just an engineering utility?"*

> *"In our minor project, we proved the foundational viability of open-source video summarization: building a local-first pipeline with 7.16% WER, fine-tuning Flan-T5 with LoRA to eliminate hallucinations, and connecting a synchronized Next.js frontend with sub-second vector search.*
>
> *For our major project, we are solving the three fundamental open problems in academic video intelligence:*
> 1. *Multimodal Incompleteness: Audio summarizers miss what is written on blackboards. We are integrating scene-change keyframe extraction and Vision OCR to capture code, formulas, and diagrams.*
> 2. *Passive Consumption: We are shifting students from passive reading to active recall by automatically generating spaced-repetition Anki flashcard decks and Bloom's taxonomy quizzes.*
> 3. *Verifiability: Through Temporal-RAG, students can converse with the lecture, and every single generated sentence is anchored by a clickable millisecond timestamp, eliminating the black-box nature of LLM outputs.*
>
> *This transforms EchoNotes from a media summarizer into a complete, research-grade Multimodal Learning System."*
