"""
Evaluation script 1: Word Error Rate (WER) using jiwer
Compares Faster-Whisper vs YouTube automated captions against 5 hand-corrected clips.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import jiwer

# Standard text normalization for speech recognition evaluation
TRANSFORMATION = jiwer.Compose(
    [
        jiwer.ToLowerCase(),
        jiwer.RemovePunctuation(),
        jiwer.RemoveMultipleSpaces(),
        jiwer.Strip(),
    ]
)


def load_wer_clips(data_path: Path | str | None = None) -> List[Dict[str, Any]]:
    if data_path is None:
        data_path = Path(__file__).parent / "data" / "wer_clips.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_wer_metrics(
    reference: str,
    hypothesis: str,
) -> Dict[str, float]:
    """Calculates WER, CER, and basic error metrics between reference and hypothesis."""
    ref_norm = TRANSFORMATION(reference)
    hyp_norm = TRANSFORMATION(hypothesis)

    wer_score = float(jiwer.wer(ref_norm, hyp_norm))
    cer_score = float(jiwer.cer(ref_norm, hyp_norm))

    measures = jiwer.process_words(ref_norm, hyp_norm)

    return {
        "wer": round(wer_score * 100, 2),
        "cer": round(cer_score * 100, 2),
        "substitutions": measures.substitutions,
        "deletions": measures.deletions,
        "insertions": measures.insertions,
        "hits": measures.hits,
    }


def evaluate_wer(data_path: Path | str | None = None) -> Dict[str, Any]:
    """Runs the full WER evaluation comparing Whisper vs YouTube Captions."""
    clips = load_wer_clips(data_path)
    results = []

    whisper_wers: List[float] = []
    youtube_wers: List[float] = []
    whisper_cers: List[float] = []
    youtube_cers: List[float] = []

    for clip in clips:
        ref = clip["reference"]
        whisper_hyp = clip["whisper_transcript"]
        youtube_hyp = clip["youtube_captions"]

        whisper_metrics = calculate_wer_metrics(ref, whisper_hyp)
        youtube_metrics = calculate_wer_metrics(ref, youtube_hyp)

        whisper_wers.append(whisper_metrics["wer"])
        youtube_wers.append(youtube_metrics["wer"])
        whisper_cers.append(whisper_metrics["cer"])
        youtube_cers.append(youtube_metrics["cer"])

        results.append(
            {
                "clip_id": clip["clip_id"],
                "title": clip["title"],
                "audio_seconds": clip.get("audio_seconds", 0.0),
                "whisper": whisper_metrics,
                "youtube": youtube_metrics,
            }
        )

    mean_whisper_wer = round(sum(whisper_wers) / len(whisper_wers), 2)
    mean_youtube_wer = round(sum(youtube_wers) / len(youtube_wers), 2)
    mean_whisper_cer = round(sum(whisper_cers) / len(whisper_cers), 2)
    mean_youtube_cer = round(sum(youtube_cers) / len(youtube_cers), 2)

    relative_improvement = round(
        ((mean_youtube_wer - mean_whisper_wer) / mean_youtube_wer) * 100, 1
    ) if mean_youtube_wer > 0 else 0.0

    return {
        "num_clips": len(clips),
        "mean_whisper_wer": mean_whisper_wer,
        "mean_youtube_wer": mean_youtube_wer,
        "mean_whisper_cer": mean_whisper_cer,
        "mean_youtube_cer": mean_youtube_cer,
        "relative_improvement_pct": relative_improvement,
        "clips": results,
    }


if __name__ == "__main__":
    summary = evaluate_wer()
    print("=== Word Error Rate (WER) Evaluation Results ===")
    print(f"Clips Analyzed: {summary['num_clips']}")
    print(f"Whisper Average WER: {summary['mean_whisper_wer']}% (CER: {summary['mean_whisper_cer']}%)")
    print(f"YouTube Captions Average WER: {summary['mean_youtube_wer']}% (CER: {summary['mean_youtube_cer']}%)")
    print(f"Whisper Relative Improvement: {summary['relative_improvement_pct']}% error reduction\n")

    print(f"{'Clip Title':<50} | {'Whisper WER':<12} | {'YouTube WER':<12}")
    print("-" * 80)
    for c in summary["clips"]:
        print(
            f"{c['title'][:48]:<50} | {c['whisper']['wer']:>10.2f}% | {c['youtube']['wer']:>10.2f}%"
        )
