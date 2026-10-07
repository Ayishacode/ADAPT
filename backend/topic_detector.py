"""
topic_detector.py

NeuroClarity Stage-1 Topic Shift Detection

Method:
    SBERT embeddings
        ↓
    cosine similarity
        ↓
    topic context
        ↓
    consecutive off-topic confirmation
"""

import logging
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_NAME = "all-MiniLM-L6-v2"

# Threshold calibrated for MiniLM-L6-v2 on real conversational speech.
# On-topic sentences typically score 0.35–0.65; off-topic drops below 0.20.
SIMILARITY_THRESHOLD = 0.38

# Number of previous on-topic utterances used to represent the current topic.
CONTEXT_WINDOW = 5

# Allow utterances as short as 2 words to build context.
MIN_WORDS = 2

# Require 2 consecutive off-topic scores before confirming a shift.
# This prevents single borderline sentences from resetting the context.
CONFIRM_CONSECUTIVE = 2


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logger = logging.getLogger(__name__)


# ============================================================
# LOAD SBERT
# ============================================================

logger.info(
    "Loading sentence-transformer model: %s",
    MODEL_NAME
)

_model = SentenceTransformer(
    MODEL_NAME
)

logger.info(
    "Sentence-transformer model loaded."
)


# ============================================================
# TOPIC SESSION
# ============================================================

class TopicSession:

    def __init__(self):

        self.reset()

    # --------------------------------------------------------
    # RESET
    # --------------------------------------------------------

    def reset(self):

        self._context_embeddings = []

        self._off_topic_streak = 0

        self._utterance_count = 0

        logger.info(
            "Topic session reset."
        )

    # --------------------------------------------------------
    # EMBEDDING
    # --------------------------------------------------------

    def _embed(
        self,
        text: str
    ) -> np.ndarray:

        embedding = _model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embedding

    # --------------------------------------------------------
    # TOPIC VECTOR
    # --------------------------------------------------------

    def _topic_vector(
        self
    ) -> Optional[np.ndarray]:

        if not self._context_embeddings:

            return None

        mean = np.mean(
            self._context_embeddings,
            axis=0
        )

        norm = np.linalg.norm(
            mean
        )

        if norm > 1e-9:

            mean = mean / norm

        return mean

    # --------------------------------------------------------
    # COSINE SIMILARITY
    # --------------------------------------------------------

    def _cosine_similarity(
        self,
        a: np.ndarray,
        b: np.ndarray
    ) -> float:

        score = np.dot(
            a,
            b
        )

        return float(
            np.clip(
                score,
                -1.0,
                1.0
            )
        )

    # --------------------------------------------------------
    # ADD TO CONTEXT
    # --------------------------------------------------------

    def _add_to_context(
        self,
        embedding: np.ndarray
    ):

        self._context_embeddings.append(
            embedding
        )

        if len(
            self._context_embeddings
        ) > CONTEXT_WINDOW:

            self._context_embeddings.pop(0)

    # --------------------------------------------------------
    # ANALYZE
    # --------------------------------------------------------

    def analyze(
        self,
        utterance: str,
        threshold: float = SIMILARITY_THRESHOLD
    ) -> dict:

        utterance = utterance.strip()

        # ----------------------------------------------------
        # EMPTY
        # ----------------------------------------------------

        if not utterance:

            return self._result(
                "skipped",
                None,
                False,
                "Empty utterance received."
            )

        # ----------------------------------------------------
        # SHORT
        # ----------------------------------------------------

        word_count = len(
            utterance.split()
        )

        if word_count < MIN_WORDS:

            return self._result(
                "skipped",
                None,
                False,
                f"Utterance too short ({word_count} words)."
            )

        self._utterance_count += 1

        # ----------------------------------------------------
        # EMBEDDING
        # ----------------------------------------------------

        embedding = self._embed(
            utterance
        )

        # ----------------------------------------------------
        # FIRST UTTERANCE
        # ----------------------------------------------------

        if not self._context_embeddings:

            self._add_to_context(
                embedding
            )

            logger.info(
                "Topic context initialized with: %r",
                utterance[:60]
            )

            return self._result(
                "on_topic",       # show green on first utterance
                1.0,
                False,
                "Topic context initialized."
            )

        # ----------------------------------------------------
        # CURRENT TOPIC
        # ----------------------------------------------------

        topic_vector = self._topic_vector()

        score = self._cosine_similarity(
            embedding,
            topic_vector
        )

        # Log every score so we can see what's happening
        logger.info(
            "Topic score | utterance=%r | score=%.4f | threshold=%.2f | %s",
            utterance[:60],
            score,
            threshold,
            "OFF_TOPIC" if score < threshold else "ON_TOPIC"
        )

        # ----------------------------------------------------
        # TOPIC DECISION
        # ----------------------------------------------------

        is_off_topic = (
            score < threshold
        )

        # ----------------------------------------------------
        # UPDATE STREAK
        # ----------------------------------------------------

        if is_off_topic:

            self._off_topic_streak += 1

        else:

            self._off_topic_streak = 0

        # ----------------------------------------------------
        # CONFIRMED SHIFT
        # ----------------------------------------------------

        confirmed_shift = (
            self._off_topic_streak
            >= CONFIRM_CONSECUTIVE
        )

        # ----------------------------------------------------
        # CONFIRMED SHIFT
        # ----------------------------------------------------

        if confirmed_shift:

            # New topic becomes the context.
            self._context_embeddings = [
                embedding
            ]

            self._off_topic_streak = 0

            return self._result(
                "off_topic",
                round(score, 4),
                True,
                (
                    "Topic shift confirmed after "
                    f"{CONFIRM_CONSECUTIVE} consecutive "
                    "off-topic utterances."
                )
            )

        # ----------------------------------------------------
        # POSSIBLE OFF TOPIC
        # ----------------------------------------------------

        if is_off_topic:

            return self._result(
                "off_topic",
                round(score, 4),
                False,
                (
                    "Possible topic drift detected. "
                    "Waiting for confirmation."
                )
            )

        # ----------------------------------------------------
        # ON TOPIC
        # ----------------------------------------------------

        self._add_to_context(
            embedding
        )

        return self._result(
            "on_topic",
            round(score, 4),
            False,
            (
                f"On topic "
                f"(similarity={score:.2f})."
            )
        )

    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    def _result(
        self,
        topic_status: str,
        similarity_score: Optional[float],
        topic_shift: bool,
        message: str
    ) -> dict:

        return {

            "topic_status":
                topic_status,

            "similarity_score":
                similarity_score,

            "topic_shift":
                topic_shift,

            "utterance_count":
                self._utterance_count,

            "message":
                message
        }