"""
Evaluation script 5: Summarization Model Comparison
Compares Baseline (DistilBART-CNN-12-6 / untuned Flan-T5) vs Fine-Tuned Flan-T5 (LoRA PEFT).
Computes:
  1. ROUGE-1, ROUGE-2, ROUGE-L F1 scores (via rouge-score)
  2. BERTScore semantic similarity (via embeddings)
  3. Qualitative Factuality & Hallucination audit on 20 held-out summaries.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List

from rouge_score import rouge_scorer


def load_summarization_test_data(data_path: Path | str | None = None) -> List[Dict[str, Any]]:
    if data_path is None:
        data_path = Path(__file__).parent / "data" / "summarization_test.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def compute_bertscore_similarity(
    references: List[str],
    hypotheses: List[str],
) -> List[float]:
    """Calculates cosine semantic similarity (BERTScore) using the local sentence transformer."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    ref_vecs = model.encode(references, convert_to_numpy=True)
    hyp_vecs = model.encode(hypotheses, convert_to_numpy=True)

    sims = []
    for r, h in zip(ref_vecs, hyp_vecs):
        norm_r = math.sqrt(float(r @ r))
        norm_h = math.sqrt(float(h @ h))
        sim = float(r @ h) / (norm_r * norm_h) if (norm_r and norm_h) else 0.0
        sims.append(round(sim, 4))
    return sims


def evaluate_summarization_models(
    data_path: Path | str | None = None,
) -> Dict[str, Any]:
    """Evaluates baseline vs fine-tuned summarization models across all quantitative and qualitative metrics."""
    data = load_summarization_test_data(data_path)
    scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)

    refs = [item["reference"] for item in data]
    base_hyps = [item["baseline_summary"] for item in data]
    ft_hyps = [item["finetuned_summary"] for item in data]

    base_bert_scores = compute_bertscore_similarity(refs, base_hyps)
    ft_bert_scores = compute_bertscore_similarity(refs, ft_hyps)

    base_r1, base_r2, base_rl = [], [], []
    ft_r1, ft_r2, ft_rl = [], [], []

    base_hallucinations = sum(1 for item in data if item["baseline_has_hallucination"])
    ft_hallucinations = sum(1 for item in data if item["finetuned_has_hallucination"])

    detailed_samples = []

    for i, item in enumerate(data):
        ref = item["reference"]
        b_hyp = item["baseline_summary"]
        f_hyp = item["finetuned_summary"]

        b_score = scorer.score(ref, b_hyp)
        f_score = scorer.score(ref, f_hyp)

        base_r1.append(b_score["rouge1"].fmeasure)
        base_r2.append(b_score["rouge2"].fmeasure)
        base_rl.append(b_score["rougeL"].fmeasure)

        ft_r1.append(f_score["rouge1"].fmeasure)
        ft_r2.append(f_score["rouge2"].fmeasure)
        ft_rl.append(f_score["rougeL"].fmeasure)

        detailed_samples.append(
            {
                "id": item["id"],
                "topic": item["topic"],
                "baseline_rougeL": round(b_score["rougeL"].fmeasure * 100, 2),
                "finetuned_rougeL": round(f_score["rougeL"].fmeasure * 100, 2),
                "baseline_bertscore": base_bert_scores[i],
                "finetuned_bertscore": ft_bert_scores[i],
                "baseline_hallucinated": item["baseline_has_hallucination"],
                "finetuned_hallucinated": item["finetuned_has_hallucination"],
            }
        )

    num_samples = len(data)

    def avg_pct(arr: List[float]) -> float:
        return round((sum(arr) / len(arr)) * 100, 2)

    def avg_raw(arr: List[float]) -> float:
        return round(sum(arr) / len(arr), 4)

    results = {
        "num_samples": num_samples,
        "baseline": {
            "model_name": "sshleifer/distilbart-cnn-12-6 (Baseline)",
            "rouge1": avg_pct(base_r1),
            "rouge2": avg_pct(base_r2),
            "rougeL": avg_pct(base_rl),
            "bertscore": avg_raw(base_bert_scores),
            "hallucination_count": base_hallucinations,
            "hallucination_rate_pct": round((base_hallucinations / num_samples) * 100, 1),
            "factuality_accuracy_pct": round(
                ((num_samples - base_hallucinations) / num_samples) * 100, 1
            ),
        },
        "finetuned": {
            "model_name": "flan-t5-base-echonotes-lora (Fine-Tuned)",
            "rouge1": avg_pct(ft_r1),
            "rouge2": avg_pct(ft_r2),
            "rougeL": avg_pct(ft_rl),
            "bertscore": avg_raw(ft_bert_scores),
            "hallucination_count": ft_hallucinations,
            "hallucination_rate_pct": round((ft_hallucinations / num_samples) * 100, 1),
            "factuality_accuracy_pct": round(
                ((num_samples - ft_hallucinations) / num_samples) * 100, 1
            ),
        },
        "samples": detailed_samples,
    }

    # Calculate deltas
    results["deltas"] = {
        "rouge1": round(results["finetuned"]["rouge1"] - results["baseline"]["rouge1"], 2),
        "rouge2": round(results["finetuned"]["rouge2"] - results["baseline"]["rouge2"], 2),
        "rougeL": round(results["finetuned"]["rougeL"] - results["baseline"]["rougeL"], 2),
        "bertscore": round(
            results["finetuned"]["bertscore"] - results["baseline"]["bertscore"], 4
        ),
        "factuality_accuracy": round(
            results["finetuned"]["factuality_accuracy_pct"]
            - results["baseline"]["factuality_accuracy_pct"],
            1,
        ),
    }

    return results


if __name__ == "__main__":
    res = evaluate_summarization_models()
    print("=== Summarization Model Evaluation: Baseline vs Fine-Tuned ===")
    print(f"Test Samples: {res['num_samples']} held-out transcripts\n")

    b = res["baseline"]
    f = res["finetuned"]
    d = res["deltas"]

    print(f"{'Metric':<25} | {'Baseline':<12} | {'Fine-Tuned':<12} | {'Delta':<10}")
    print("-" * 65)
    print(f"{'ROUGE-1 F1':<25} | {b['rouge1']:>10.2f}% | {f['rouge1']:>10.2f}% | {d['rouge1']:>+9.2f}%")
    print(f"{'ROUGE-2 F1':<25} | {b['rouge2']:>10.2f}% | {f['rouge2']:>10.2f}% | {d['rouge2']:>+9.2f}%")
    print(f"{'ROUGE-L F1':<25} | {b['rougeL']:>10.2f}% | {f['rougeL']:>10.2f}% | {d['rougeL']:>+9.2f}%")
    print(f"{'BERTScore (Cosine)':<25} | {b['bertscore']:>10.4f}  | {f['bertscore']:>10.4f}  | {d['bertscore']:>+9.4f}")
    print(f"{'Hallucination Rate':<25} | {b['hallucination_rate_pct']:>10.1f}% | {f['hallucination_rate_pct']:>10.1f}% | {(-b['hallucination_rate_pct'] + f['hallucination_rate_pct']):>+9.1f}%")
    print(f"{'Factuality Accuracy':<25} | {b['factuality_accuracy_pct']:>10.1f}% | {f['factuality_accuracy_pct']:>10.1f}% | {d['factuality_accuracy']:>+9.1f}%")
