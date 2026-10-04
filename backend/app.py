"""
app.py  —  NeuroClarity backend
Endpoints:
  GET  /api/health
  POST /api/session/reset
  POST /api/topic-shift      { utterance }
  POST /api/transcribe       multipart: audio file  →  { text }
"""

import logging
import tempfile
import os

from flask import Flask, request, jsonify
from flask_cors import CORS

from topic_detector import TopicSession, SIMILARITY_THRESHOLD

# ── Setup ────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_session = TopicSession()

# ── Lazy-load Whisper (loads on first transcription request) ─────────────────
_whisper_model = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        logger.info("Loading Whisper model (base)…")
        _whisper_model = whisper.load_model("base")
        logger.info("Whisper ready.")
    return _whisper_model


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "all-MiniLM-L6-v2 + Whisper base"}), 200


@app.route("/api/session/reset", methods=["POST"])
def reset_session():
    _session.reset()
    body = request.get_json(silent=True) or {}
    ctx  = body.get("initial_context", "").strip()
    if ctx:
        _session.analyze(ctx)
        return jsonify({"status": "reset", "seeded_with": ctx}), 200
    return jsonify({"status": "reset"}), 200


@app.route("/api/topic-shift", methods=["POST"])
def topic_shift():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required."}), 400
    utterance = body.get("utterance", "")
    if not isinstance(utterance, str):
        return jsonify({"error": "'utterance' must be a string."}), 400
    threshold = float(body.get("threshold", SIMILARITY_THRESHOLD))
    try:
        result = _session.analyze(utterance, threshold=threshold)
    except Exception as exc:
        logger.exception("Topic analysis error: %s", exc)
        return jsonify({"error": "Internal analysis error."}), 500
    return jsonify(result), 200


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """
    Accepts a multipart/form-data upload with an 'audio' file (webm/ogg/wav).
    Returns { text: "..." } using Whisper base model.
    Also automatically runs topic-shift detection on the transcript
    and returns the full result.
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file in request."}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    # Save to a temp file — Whisper needs a file path
    suffix = ".webm"
    if "." in audio_file.filename:
        suffix = "." + audio_file.filename.rsplit(".", 1)[-1]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        model  = get_whisper()
        result = model.transcribe(tmp_path, language="en", fp16=False)
        text   = result["text"].strip()
        logger.info("Whisper transcript: %r", text)
    except Exception as exc:
        logger.exception("Whisper transcription error: %s", exc)
        os.unlink(tmp_path)
        return jsonify({"error": "Transcription failed."}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    if not text:
        return jsonify({"text": "", "topic_status": "skipped",
                        "similarity_score": None, "topic_shift": False}), 200

    # Run topic detection on the fresh transcript
    try:
        topic_result = _session.analyze(text)
    except Exception:
        topic_result = {"topic_status": "skipped", "similarity_score": None,
                        "topic_shift": False, "message": ""}

    return jsonify({
        "text":             text,
        "topic_status":     topic_result["topic_status"],
        "similarity_score": topic_result["similarity_score"],
        "topic_shift":      topic_result["topic_shift"],
        "message":          topic_result.get("message", ""),
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
