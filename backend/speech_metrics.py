"""
speech_metrics.py
-----------------
Real communication metrics computed from Whisper transcription output
and SBERT embeddings.

Metrics
-------
1. speaking_rate_wpm      : words per minute
2. filler_rate_pct        : filler words as % of total words
3. pause_count            : number of pauses > PAUSE_THRESHOLD seconds
4. long_pause_count       : pauses > LONG_PAUSE_THRESHOLD seconds
5. topic_relevance        : cosine similarity vs current topic context (from topic_detector)
6. semantic_coherence     : cosine similarity between this utterance and the previous one
7. filler_words_found     : list of filler words detected
8. word_count             : total words spoken in this chunk
9. chunk_duration_sec     : actual audio duration in seconds

All values are derived from:
- Whisper's word-level timestamps  (pause detection, duration, word count)
- Raw transcript text              (filler detection)
- SBERT embeddings                 (topic relevance, semantic coherence)
"""

import re
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
PAUSE_THRESHOLD      = 0.5   # seconds — gap between words counts as a pause
LONG_PAUSE_THRESHOLD = 1.5   # seconds — "long" pause

FILLER_WORDS = {
    "um", "uh", "er", "ah", "like", "you know", "i mean", "basically",
    "literally", "actually", "honestly", "right", "okay", "so", "well",
    "kind of", "sort of", "you see", "i guess", "i think",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    return re.sub(r"[^\w\s']", "", text.lower()).strip()


def count_fillers(text: str) -> tuple[int, list[str]]:
    """Return (count, list_of_found_fillers) for a transcript text."""
    lowered = text.lower()
    found = []
    for fw in sorted(FILLER_WORDS, key=len, reverse=True):   # longest first
        pattern = r'\b' + re.escape(fw) + r'\b'
        matches = re.findall(pattern, lowered)
        found.extend(matches)
    # deduplicate while preserving order
    seen = set()
    unique = []
    for f in found:
        if f not in seen:
            seen.add(f)
            unique.append(f)
    return len(found), unique


def compute_pauses(segments: list[dict]) -> tuple[int, int]:
    """
    Compute pause counts from Whisper word-level timestamps.
    segments: list of {'word': str, 'start': float, 'end': float}
    Returns (pause_count, long_pause_count)
    """
    if not segments or len(segments) < 2:
        return 0, 0

    pause_count      = 0
    long_pause_count = 0

    for i in range(1, len(segments)):
        gap = segments[i]["start"] - segments[i - 1]["end"]
        if gap > PAUSE_THRESHOLD:
            pause_count += 1
        if gap > LONG_PAUSE_THRESHOLD:
            long_pause_count += 1

    return pause_count, long_pause_count


def compute_speaking_rate(word_count: int, duration_sec: float) -> float:
    """Words per minute. Returns 0 if duration is 0."""
    if duration_sec <= 0 or word_count == 0:
        return 0.0
    return round((word_count / duration_sec) * 60, 1)


def compute_semantic_coherence(
    current_embedding: np.ndarray,
    previous_embedding: np.ndarray | None,
) -> float | None:
    """
    Cosine similarity between consecutive utterance embeddings.
    Returns None for the first utterance (no previous to compare).
    """
    if previous_embedding is None:
        return None
    a = current_embedding / (np.linalg.norm(current_embedding) + 1e-9)
    b = previous_embedding / (np.linalg.norm(previous_embedding) + 1e-9)
    return round(float(np.clip(np.dot(a, b), -1.0, 1.0)), 4)


# ── Session state for running totals ─────────────────────────────────────────
class MetricsSession:
    """
    Accumulates metrics across all chunks in a conversation session.
    Reset when a new session starts.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.total_words        = 0
        self.total_fillers      = 0
        self.total_pauses       = 0
        self.total_long_pauses  = 0
        self.total_duration_sec = 0.0
        self.utterance_count    = 0
        self.coherence_scores   = []
        self._prev_embedding    = None   # for coherence between chunks
        logger.debug("MetricsSession reset.")

    def update(
        self,
        text:           str,
        whisper_words:  list[dict],    # [{'word', 'start', 'end'}]
        duration_sec:   float,
        embedding:      np.ndarray,    # SBERT embedding of this utterance
        topic_score:    float | None,  # from topic_detector
    ) -> dict:
        """
        Compute metrics for one chunk and update running totals.
        Returns a dict with per-chunk and cumulative metrics.
        """
        # ── Per-chunk calculations ────────────────────────────────────────────
        words        = text.split()
        word_count   = len(words)
        filler_count, filler_list = count_fillers(text)
        pause_cnt, long_pause_cnt = compute_pauses(whisper_words)
        speaking_rate = compute_speaking_rate(word_count, duration_sec)
        coherence     = compute_semantic_coherence(embedding, self._prev_embedding)

        # ── Update running totals ─────────────────────────────────────────────
        self.total_words        += word_count
        self.total_fillers      += filler_count
        self.total_pauses       += pause_cnt
        self.total_long_pauses  += long_pause_cnt
        self.total_duration_sec += duration_sec
        self.utterance_count    += 1
        if coherence is not None:
            self.coherence_scores.append(coherence)
        self._prev_embedding = embedding.copy()

        # ── Cumulative metrics ────────────────────────────────────────────────
        cum_filler_rate = (
            round(self.total_fillers / self.total_words * 100, 2)
            if self.total_words > 0 else 0.0
        )
        cum_speaking_rate = compute_speaking_rate(
            self.total_words, self.total_duration_sec
        )
        avg_coherence = (
            round(float(np.mean(self.coherence_scores)), 4)
            if self.coherence_scores else None
        )

        logger.info(
            "Chunk metrics | words=%d | fillers=%d | pauses=%d | rate=%.1f wpm | "
            "coherence=%s | topic_score=%s",
            word_count, filler_count, pause_cnt, speaking_rate,
            f"{coherence:.3f}" if coherence is not None else "N/A",
            f"{topic_score:.3f}" if topic_score is not None else "N/A",
        )

        return {
            # ── Per-chunk ──────────────────────────────────────────────────────
            "chunk": {
                "word_count":     word_count,
                "filler_count":   filler_count,
                "filler_words":   filler_list,
                "pause_count":    pause_cnt,
                "long_pauses":    long_pause_cnt,
                "speaking_rate":  speaking_rate,
                "duration_sec":   round(duration_sec, 2),
                "coherence":      coherence,
                "topic_relevance": topic_score,
            },
            # ── Cumulative (session so far) ────────────────────────────────────
            "session": {
                "total_words":        self.total_words,
                "total_fillers":      self.total_fillers,
                "total_pauses":       self.total_pauses,
                "total_long_pauses":  self.total_long_pauses,
                "total_duration_sec": round(self.total_duration_sec, 1),
                "utterance_count":    self.utterance_count,
                "filler_rate_pct":    cum_filler_rate,
                "speaking_rate_wpm":  cum_speaking_rate,
                "avg_coherence":      avg_coherence,
                "topic_relevance":    topic_score,   # latest score
            },
        }
