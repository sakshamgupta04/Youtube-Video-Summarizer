"""
Evaluation script 2: Chapter Boundary Segmentation Accuracy
Uses nltk.metrics.segmentation (Pk and WindowDiff) against hand-marked boundaries for 10 videos.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from nltk.metrics.segmentation import pk, windowdiff


def load_chapter_videos(data_path: Path | str | None = None) -> List[Dict[str, Any]]:
    if data_path is None:
        data_path = Path(__file__).parent / "data" / "chapter_videos.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_boundary_f1(
    ref: str,
    hyp: str,
    tolerance: int = 1,
) -> Dict[str, float]:
    """Calculates boundary Precision, Recall, and F1 with optional window tolerance."""
    ref_indices = [i for i, ch in enumerate(ref) if ch == "1"]
    hyp_indices = [i for i, ch in enumerate(hyp) if ch == "1"]

    if not hyp_indices:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    matched_hyp = 0
    for h in hyp_indices:
        if any(abs(h - r) <= tolerance for r in ref_indices):
            matched_hyp += 1

    matched_ref = 0
    for r in ref_indices:
        if any(abs(r - h) <= tolerance for h in hyp_indices):
            matched_ref += 1

    precision = matched_hyp / len(hyp_indices) if hyp_indices else 0.0
    recall = matched_ref / len(ref_indices) if ref_indices else 0.0
    f1 = (
        (2 * precision * recall) / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )

    return {
        "precision": round(precision * 100, 2),
        "recall": round(recall * 100, 2),
        "f1": round(f1 * 100, 2),
    }


def evaluate_chapters(data_path: Path | str | None = None) -> Dict[str, Any]:
    """Runs the full chapter segmentation evaluation on 10 videos."""
    videos = load_chapter_videos(data_path)
    results = []

    pk_scores: List[float] = []
    wd_scores: List[float] = []
    f1_scores: List[float] = []

    for vid in videos:
        ref = vid["reference_boundaries"]
        hyp = vid["predicted_boundaries"]

        # Calculate standard k: half average segment size
        num_ref_boundaries = ref.count("1")
        total_units = len(ref)
        k = max(2, int(round(total_units / (2 * max(num_ref_boundaries, 1)))))

        score_pk = float(pk(ref, hyp, k=k, boundary="1"))
        score_wd = float(windowdiff(ref, hyp, k=k, boundary="1"))
        boundary_f1 = calculate_boundary_f1(ref, hyp, tolerance=1)

        pk_scores.append(score_pk)
        wd_scores.append(score_wd)
        f1_scores.append(boundary_f1["f1"])

        results.append(
            {
                "video_id": vid["video_id"],
                "title": vid["title"],
                "duration_minutes": vid.get("duration_minutes", 0),
                "k_window": k,
                "pk": round(score_pk, 4),
                "windowdiff": round(score_wd, 4),
                "boundary_f1": boundary_f1["f1"],
                "boundary_precision": boundary_f1["precision"],
                "boundary_recall": boundary_f1["recall"],
            }
        )

    mean_pk = round(sum(pk_scores) / len(pk_scores), 4)
    mean_wd = round(sum(wd_scores) / len(wd_scores), 4)
    mean_f1 = round(sum(f1_scores) / len(f1_scores), 2)

    return {
        "num_videos": len(videos),
        "mean_pk": mean_pk,
        "mean_windowdiff": mean_wd,
        "mean_boundary_f1": mean_f1,
        "videos": results,
    }


if __name__ == "__main__":
    res = evaluate_chapters()
    print("=== Chapter Segmentation Accuracy Results (NLTK) ===")
    print(f"Videos Analyzed: {res['num_videos']}")
    print(f"Mean Pk (Beeferman): {res['mean_pk']:.4f} (lower is better, 0.0 = perfect)")
    print(f"Mean WindowDiff (Pevzner & Hearst): {res['mean_windowdiff']:.4f} (lower is better, 0.0 = perfect)")
    print(f"Mean Boundary F1 Score: {res['mean_boundary_f1']:.1f}%\n")

    print(f"{'Video Title':<48} | {'k':<3} | {'Pk':<7} | {'WinDiff':<7} | {'F1 %':<6}")
    print("-" * 80)
    for v in res["videos"]:
        print(
            f"{v['title'][:46]:<48} | {v['k_window']:>3} | {v['pk']:>6.4f} | {v['windowdiff']:>7.4f} | {v['boundary_f1']:>5.1f}%"
        )
