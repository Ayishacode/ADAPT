"""
topic_detector.py
-----------------
Stage-1 Topic-Shift Detection Module for NeuroClarity.

Algorithm
---------
- Uses sentence-transformers (all-MiniLM-L6-v2) to generate sentence embeddings.
- Maintains a rolling "topic context" from the N most recent ON-TOPIC utterances.
- The topic representation is the mean of those context embeddings.
- Cosine similarity between the new utterance and the topic mean is computed.
- A configurable threshold (default 0.55) determines on-topic vs off-topic.
- Consecutive-utterance confirmation:  a single below-threshold sentence does NOT
  immediately trigger a shift.  Two consecutive off-topic scores confirm a shift.
- After a confirmed shift the context is reset to the new utterance so subsequent
  utterances are evaluated against the new topic.
- Very short utterances (< MIN_WORDS words) are skipped — they carry insufficient
  semantic content and would produce noisy similarity scores.

This module is intentionally model-agnostic at the top level so that the SBERT
detector can later be swapped for a DialSeg-trained classifier without touching
the Flask API or the frontend.
"""

import logging
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer

# ── Configuration (all tunable for DialSeg_711 evaluation) ──────────────────
SIMILARITY_THRESHOLD: float = 0.30   # cosine similarity boundary (tunable via DialSeg_711)
CONTEXT_WINDOW:       int   = 5      # max on-topic utterances kept as context
MIN_WORDS:            int   = 3      # utterances shorter than this are skipped
CONFIRM_CONSECUTIVE:  int   = 2      # off-topic hits needed to confirm a shift

MODEL_NAME = "all-MiniLM-L6-v2"

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ── Model (loaded once at import time) ───────────────────────────────────────
logger.info("Loading sentence-transformer model: %s", MODEL_NAME)
_model = SentenceTransformer(MODEL_NAME)
logger.info("Model loaded.")


# ── Session state (per conversation session) ─────────────────────────────────
class TopicSession:
    """
    Holds the state of a single conversation session.
    Create one instance per conversation; call reset() to start a new session.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        """Reset for a brand-new conversation."""
        self._context_embeddings: list[np.ndarray] = []
        self._off_topic_streak:   int              = 0
        self._utterance_count:    int              = 0
        logger.debug("TopicSession reset.")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _embed(self, text: str) -> np.ndarray:
        return _model.encode(text, convert_to_numpy=True, normalize_embeddings=True)

    def _topic_vector(self) -> Optional[np.ndarray]:
        """Return the mean of all context embeddings (already L2-normalised)."""
        if not self._context_embeddings:
            return None
        mean = np.mean(self._context_embeddings, axis=0)
        norm = np.linalg.norm(mean)
        return mean / norm if norm > 1e-9 else mean

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Cosine similarity of two L2-normalised vectors == their dot product."""
        return float(np.clip(np.dot(a, b), -1.0, 1.0))

    def _add_to_context(self, embedding: np.ndarray) -> None:
        """Add utterance to the rolling context window."""
        self._context_embeddings.append(embedding)
        if len(self._context_embeddings) > CONTEXT_WINDOW:
            self._context_embeddings.pop(0)

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze(self, utterance: str, threshold: float = SIMILARITY_THRESHOLD) -> dict:
        """
        Analyse a new utterance and return a topic-status result dict.

        Parameters
        ----------
        utterance : str
            The latest transcribed utterance from Whisper STT.
        threshold : float
            Cosine similarity threshold (overrides the module default).

        Returns
        -------
        dict with keys:
            topic_status    : "on_topic" | "off_topic" | "initializing" | "skipped"
            similarity_score: float (0–1)  or None
            topic_shift     : bool
            utterance_count : int
            message         : str (human-readable explanation)
        """
        utterance = utterance.strip()

        # ── Guard: empty input ────────────────────────────────────────────────
        if not utterance:
            return self._result("skipped", None, False, "Empty utterance received.")

        # ── Guard: too short ──────────────────────────────────────────────────
        word_count = len(utterance.split())
        if word_count < MIN_WORDS:
            logger.debug(
                "Utterance too short (%d words), skipped: %r", word_count, utterance
            )
            return self._result(
                "skipped", None, False,
                f"Utterance too short ({word_count} words); skipped to avoid noise.",
            )

        self._utterance_count += 1
        emb = self._embed(utterance)

        # ── First utterance: initialise the topic ────────────────────────────
        if not self._context_embeddings:
            self._add_to_context(emb)
            logger.debug(
                "Utterance %d (init): %r  ->  topic initialised.",
                self._utterance_count, utterance,
            )
            return self._result(
                "initializing", 1.0, False,
                "First utterance — topic context initialised.",
            )

        # ── Compute similarity ────────────────────────────────────────────────
        topic_vec = self._topic_vector()
        score     = self._cosine_similarity(emb, topic_vec)

        is_off_topic = score < threshold

        if is_off_topic:
            self._off_topic_streak += 1
        else:
            self._off_topic_streak = 0

        # ── Consecutive-utterance confirmation ────────────────────────────────
        confirmed_shift = self._off_topic_streak >= CONFIRM_CONSECUTIVE

        logger.debug(
            "Utterance: %r | Similarity: %.4f | Threshold: %.2f | "
            "Status: %s | Topic Shift: %s",
            utterance, score, threshold,
            "OFF_TOPIC" if is_off_topic else "ON_TOPIC",
            confirmed_shift,
        )

        if confirmed_shift:
            # Reset context to the new topic
            self._context_embeddings = [emb]
            self._off_topic_streak   = 0
            status = "off_topic"
            msg    = (
                f"Topic shift confirmed after {CONFIRM_CONSECUTIVE} consecutive "
                f"off-topic utterances. Context reset to new topic."
            )
        elif is_off_topic:
            # First off-topic hit — warn but do not shift yet
            status = "off_topic"
            msg    = (
                f"Possible topic drift (score {score:.2f} < {threshold}). "
                f"Monitoring for confirmation."
            )
        else:
            # On topic — add to context window
            self._add_to_context(emb)
            status = "on_topic"
            msg    = f"On topic (score {score:.2f} >= {threshold})."

        return self._result(status, round(score, 4), confirmed_shift, msg)

    # ── Helper ────────────────────────────────────────────────────────────────

    def _result(
        self,
        topic_status:    str,
        similarity_score: Optional[float],
        topic_shift:     bool,
        message:         str,
    ) -> dict:
        return {
            "topic_status":     topic_status,
            "similarity_score": similarity_score,
            "topic_shift":      topic_shift,
            "utterance_count":  self._utterance_count,
            "message":          message,
        }
