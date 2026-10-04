"""
app.py
------
Flask API backend for NeuroClarity.

Endpoints
---------
POST /api/topic-shift          — analyse a single utterance
POST /api/session/reset        — reset the session for a new conversation
GET  /api/health               — health check

The server stores ONE session per process (single-user demo).
For multi-user production, replace the global session with a
per-session-id store (dict keyed by session UUID).
"""

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from topic_detector import TopicSession, SIMILARITY_THRESHOLD

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})   # allow Vite dev server

logger = logging.getLogger(__name__)

# Global session (single-user; replace with per-user dict for multi-user)
_session = TopicSession()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "all-MiniLM-L6-v2"}), 200


@app.route("/api/session/reset", methods=["POST"])
def reset_session():
    """
    Call this when the user starts a new conversation.
    Optionally accepts a JSON body with an 'initial_context' sentence
    (e.g. the chosen topic name) to seed the context.
    """
    _session.reset()

    body = request.get_json(silent=True) or {}
    initial_context = body.get("initial_context", "").strip()

    if initial_context:
        _session.analyze(initial_context)
        logger.info("Session reset and seeded with topic: %r", initial_context)
        return jsonify({
            "status": "reset",
            "seeded_with": initial_context,
        }), 200

    logger.info("Session reset (no seed).")
    return jsonify({"status": "reset"}), 200


@app.route("/api/topic-shift", methods=["POST"])
def topic_shift():
    """
    Analyse a transcribed utterance for topic relevance.

    Request body (JSON)
    -------------------
    {
        "utterance": "I went shopping with my friends yesterday.",
        "threshold": 0.55   // optional override
    }

    Response (JSON)
    ---------------
    {
        "topic_status":     "off_topic",
        "similarity_score": 0.31,
        "topic_shift":      true,
        "utterance_count":  5,
        "message":          "..."
    }
    """
    body = request.get_json(silent=True)

    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    utterance = body.get("utterance", "")
    if not isinstance(utterance, str):
        return jsonify({"error": "'utterance' must be a string."}), 400

    threshold = body.get("threshold", SIMILARITY_THRESHOLD)
    try:
        threshold = float(threshold)
        if not (0.0 <= threshold <= 1.0):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "'threshold' must be a float between 0 and 1."}), 400

    try:
        result = _session.analyze(utterance, threshold=threshold)
    except Exception as exc:
        logger.exception("Error during topic analysis: %s", exc)
        return jsonify({"error": "Internal error during analysis."}), 500

    return jsonify(result), 200


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
