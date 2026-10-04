"""
app.py  —  NeuroClarity backend
GET  /api/health
POST /api/session/reset   { initial_context? }
POST /api/topic-shift     { utterance }
POST /api/transcribe      multipart: audio file  →  { text, topic_status, ... }
"""

import logging
import tempfile
import os
import json
import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
from topic_detector import TopicSession, SIMILARITY_THRESHOLD

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_session = TopicSession()
_whisper_model = None

# ── Session result storage ─────────────────────────────────────────────────────
# Stores all completed sessions as a list of dicts
SESSIONS_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")

def load_sessions():
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_sessions(sessions):
    with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=False)


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        logger.info("Loading Whisper model (base)…")
        _whisper_model = whisper.load_model("base")
        logger.info("Whisper ready.")
    return _whisper_model


# ── Routes ────────────────────────────────────────────────────────────────────

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
        return jsonify({"error": "Internal error."}), 500
    return jsonify(result), 200


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """
    Accepts multipart/form-data with 'audio' (webm).
    Converts to 16kHz wav via imageio-ffmpeg subprocess (full binary path).
    Runs Whisper base via model.transcribe() — no system ffmpeg needed.
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file."}), 400

    audio_file = request.files["audio"]

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        audio_file.save(tmp.name)
        webm_path = tmp.name

    wav_path = webm_path.replace(".webm", ".wav")

    try:
        import imageio_ffmpeg
        import subprocess
        import numpy as np
        import soundfile as sf
        import whisper as _whisper

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        # Convert webm → 16kHz mono wav using the bundled ffmpeg binary
        proc = subprocess.run(
            [ffmpeg_exe, "-y", "-i", webm_path,
             "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=30
        )
        if proc.returncode != 0:
            err = proc.stderr.decode(errors="replace")[-300:]
            logger.error("ffmpeg error: %s", err)
            return jsonify({"error": f"Audio conversion failed: {err}"}), 500

        # Load wav as float32 numpy array
        audio_np, _ = sf.read(wav_path, dtype="float32")
        if audio_np.ndim > 1:
            audio_np = audio_np.mean(axis=1)

        # Run Whisper — model.transcribe() handles padding internally
        model = get_whisper()
        output = model.transcribe(
            audio_np,
            language="en",
            fp16=False,
            no_speech_threshold=0.6,
            logprob_threshold=-1.0,
            compression_ratio_threshold=2.0,
            condition_on_previous_text=False,
        )
        raw_text = output["text"].strip()

        # Suppress repetitive hallucinations (e.g. "Pi Pi Pi Pi Pi")
        words = raw_text.split()
        if words and (max(words.count(w) for w in set(words)) / len(words)) > 0.6:
            logger.warning("Hallucination discarded: %r", raw_text[:80])
            text = ""
        else:
            text = raw_text

        logger.info("Whisper transcript: %r", text)

    except Exception as exc:
        logger.exception("Transcription error: %s", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        for p in [webm_path, wav_path]:
            try: os.unlink(p)
            except Exception: pass

    if not text:
        return jsonify({"text": "", "topic_status": "skipped",
                        "similarity_score": None, "topic_shift": False}), 200

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


@app.route("/api/session/save", methods=["POST"])
def save_session():
    """
    Save a completed session's transcript to sessions.json.
    Body: { utterances: [{text, topic_status, similarity_score, topic_shift}], duration_seconds: int }
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required."}), 400

    sessions = load_sessions()
    session_entry = {
        "id":         len(sessions) + 1,
        "timestamp":  datetime.datetime.now().isoformat(timespec="seconds"),
        "duration":   body.get("duration_seconds", 0),
        "utterances": body.get("utterances", []),
    }
    sessions.append(session_entry)
    save_sessions(sessions)
    logger.info("Session %d saved (%d utterances)", session_entry["id"], len(session_entry["utterances"]))
    return jsonify({"status": "saved", "session_id": session_entry["id"]}), 200


@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    """Return all saved sessions."""
    return jsonify(load_sessions()), 200


@app.route("/api/sessions/latest", methods=["GET"])
def get_latest_session():
    """Return the most recent saved session."""
    sessions = load_sessions()
    if not sessions:
        return jsonify({"error": "No sessions saved yet."}), 404
    return jsonify(sessions[-1]), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True, use_reloader=False)
