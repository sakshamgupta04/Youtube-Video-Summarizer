"""
Evaluation script 3: Search Hit@5 and Retrieval Metrics on 30 Questions
Evaluates semantic vector retrieval using all-MiniLM-L6-v2 embeddings.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List

# Ensure worker/ directory is in path to import embedding model if needed
WORKER_PATH = Path(__file__).resolve().parent.parent / "worker"
if str(WORKER_PATH) not in sys.path:
    sys.path.insert(0, str(WORKER_PATH))

try:
    from app.pipeline.embed import embed_texts, cosine_similarity
except ImportError:
    # Standalone fallback using sentence-transformers or fastembed
    cosine_similarity = None
    embed_texts = None


def cosine_sim(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def load_search_data(data_path: Path | str | None = None) -> Dict[str, Any]:
    if data_path is None:
        data_path = Path(__file__).parent / "data" / "search_questions.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_search(data_path: Path | str | None = None, top_k: int = 5) -> Dict[str, Any]:
    """Evaluates Hit@1, Hit@5, and MRR@5 across 30 questions."""
    data = load_search_data(data_path)
    corpus = data["corpus"]
    questions = data["questions"]

    # 1. Embed corpus
    corpus_texts = [item["text"] for item in corpus]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")

    corpus_embeddings = model.encode(corpus_texts, convert_to_numpy=True)
    query_texts = [q["query"] for q in questions]
    query_embeddings = model.encode(query_texts, convert_to_numpy=True)

    hit_1_count = 0
    hit_k_count = 0
    reciprocal_ranks: List[float] = []
    question_results = []

    for i, q in enumerate(questions):
        q_id = q["id"]
        q_text = q["query"]
        targets = set(q["target_chunk_ids"])
        q_vec = query_embeddings[i]

        # Compute cosine similarity with every corpus chunk
        scores = []
        for j, c in enumerate(corpus):
            c_vec = corpus_embeddings[j]
            # normalized dot product
            norm_q = math.sqrt(float(q_vec @ q_vec))
            norm_c = math.sqrt(float(c_vec @ c_vec))
            score = float(q_vec @ c_vec) / (norm_q * norm_c) if norm_q and norm_c else 0.0
            scores.append((score, c["id"], c["text"]))

        # Sort descending
        scores.sort(key=lambda x: x[0], reverse=True)
        top_results = scores[:top_k]
        top_ids = [item[1] for item in top_results]

        # Calculate rank of first relevant item
        rank_found = None
        for r, (score, cid, _) in enumerate(top_results, start=1):
            if cid in targets:
                rank_found = r
                break

        is_hit_1 = rank_found == 1
        is_hit_k = rank_found is not None and rank_found <= top_k
        rr = 1.0 / rank_found if rank_found else 0.0

        if is_hit_1:
            hit_1_count += 1
        if is_hit_k:
            hit_k_count += 1
        reciprocal_ranks.append(rr)

        question_results.append(
            {
                "id": q_id,
                "query": q_text,
                "targets": list(targets),
                "top_retrieved": top_ids,
                "rank_found": rank_found,
                "hit_at_1": is_hit_1,
                "hit_at_5": is_hit_k,
                "reciprocal_rank": round(rr, 4),
            }
        )

    num_q = len(questions)
    hit_1_rate = round((hit_1_count / num_q) * 100, 2)
    hit_k_rate = round((hit_k_count / num_q) * 100, 2)
    mrr = round(sum(reciprocal_ranks) / num_q, 4)

    return {
        "num_questions": num_q,
        "corpus_size": len(corpus),
        "top_k": top_k,
        "hit_at_1_pct": hit_1_rate,
        "hit_at_5_pct": hit_k_rate,
        "mrr": mrr,
        "questions": question_results,
    }


if __name__ == "__main__":
    print("Evaluating Semantic Search Retrieval...")
    res = evaluate_search()
    print("=== Search Retrieval Evaluation Results ===")
    print(f"Total Questions Evaluated: {res['num_questions']}")
    print(f"Indexed Corpus Size: {res['corpus_size']} chunks")
    print(f"Hit@1:  {res['hit_at_1_pct']:.1f}%")
    print(f"Hit@5:  {res['hit_at_5_pct']:.1f}%")
    print(f"MRR@5:  {res['mrr']:.4f}\n")

    print(f"{'QID':<5} | {'Target':<10} | {'Rank':<5} | {'Hit@5':<6} | {'Query':<52}")
    print("-" * 85)
    for q in res["questions"]:
        rank_str = str(q["rank_found"]) if q["rank_found"] else "N/A"
        print(
            f"{q['id']:<5} | {str(q['targets'][0]):<10} | {rank_str:>4}  | {'Yes' if q['hit_at_5'] else 'No ':<6} | {q['query'][:50]:<52}"
        )
