"""
Unit tests for Phase 8a Evaluation scripts:
  - test_eval_wer: verifies WER calculation using jiwer
  - test_eval_chapters: verifies Pk and WindowDiff using nltk.metrics.segmentation
  - test_eval_search: verifies Hit@5 retrieval logic
  - test_eval_rtf: verifies Real-Time Factor calculations
  - test_run_eval: verifies master report generation
"""

import os
import sys
from pathlib import Path

# Add eval/ to path
EVAL_DIR = Path(__file__).resolve().parent
if str(EVAL_DIR) not in sys.path:
    sys.path.insert(0, str(EVAL_DIR))

from eval_wer import evaluate_wer, calculate_wer_metrics
from eval_chapters import evaluate_chapters, calculate_boundary_f1
from eval_search import evaluate_search
from eval_rtf import benchmark_pipeline_rtf


def test_calculate_wer_metrics():
    ref = "The quick brown fox jumps over the lazy dog."
    hyp = "The quick brown fox jumps over the lazy dog."
    res = calculate_wer_metrics(ref, hyp)
    assert res["wer"] == 0.0
    assert res["cer"] == 0.0

    # Substitution
    hyp_sub = "The fast brown fox jumps over the lazy dog."
    res_sub = calculate_wer_metrics(ref, hyp_sub)
    assert res_sub["wer"] > 0.0
    assert res_sub["substitutions"] == 1


def test_evaluate_wer_dataset():
    data_path = EVAL_DIR / "data" / "wer_clips.json"
    res = evaluate_wer(data_path)
    assert res["num_clips"] == 5
    assert 0.0 <= res["mean_whisper_wer"] < res["mean_youtube_wer"]
    assert res["relative_improvement_pct"] > 50.0


def test_evaluate_chapters_nltk():
    data_path = EVAL_DIR / "data" / "chapter_videos.json"
    res = evaluate_chapters(data_path)
    assert res["num_videos"] == 10
    # Both Pk and WindowDiff should be under 0.10 for high accuracy
    assert 0.0 <= res["mean_pk"] < 0.10
    assert 0.0 <= res["mean_windowdiff"] < 0.10
    assert res["mean_boundary_f1"] >= 90.0


def test_boundary_f1_calculation():
    ref = "100010001"
    hyp = "100010001"
    res = calculate_boundary_f1(ref, hyp, tolerance=0)
    assert res["f1"] == 100.0


def test_evaluate_search_hit_at_5():
    data_path = EVAL_DIR / "data" / "search_questions.json"
    res = evaluate_search(data_path, top_k=5)
    assert res["num_questions"] == 30
    assert res["corpus_size"] == 30
    assert res["hit_at_5_pct"] >= 95.0
    assert res["mrr"] > 0.90


def test_benchmark_pipeline_rtf():
    res = benchmark_pipeline_rtf([60.0, 120.0])
    assert res["total_audio_seconds"] == 180.0
    assert res["overall_rtf"] < 1.0  # Faster than real-time
    assert res["overall_speedup"] > 1.0


def test_evaluate_summarization_models():
    from eval_summarize_comparison import evaluate_summarization_models
    data_path = EVAL_DIR / "data" / "summarization_test.json"
    res = evaluate_summarization_models(data_path)
    assert res["num_samples"] == 20
    # Verify fine-tuned model matches or beats baseline on at least one metric (here, all metrics)
    assert res["finetuned"]["rougeL"] >= res["baseline"]["rougeL"]
    assert res["finetuned"]["rouge1"] >= res["baseline"]["rouge1"]
    assert res["finetuned"]["rouge2"] >= res["baseline"]["rouge2"]
    assert res["finetuned"]["bertscore"] >= res["baseline"]["bertscore"]
    assert res["finetuned"]["hallucination_rate_pct"] <= res["baseline"]["hallucination_rate_pct"]


def test_results_md_exists_and_contains_tables():
    results_path = EVAL_DIR / "results.md"
    assert results_path.exists()
    content = results_path.read_text(encoding="utf-8")
    assert "Executive Summary Table" in content
    assert "Word Error Rate" in content
    assert "Chapter Boundary Accuracy" in content
    assert "Hit@5" in content
    assert "Real-Time Factor" in content
    assert "Summarization Fine-Tuning" in content
