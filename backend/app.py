"""
app.py  —  NeuroClarity backend
GET  /api/health
POST /api/session/reset   { initial_context? }
POST /api/topic-shift     { utterance }
POST /api/transcribe      multipart: audio file
POST /api/session/save    { utterances, duration_seconds, metrics }
GET  /api/sessions
GET  /api/sessions/latest
"""

import logging
import tempfile
import os
import json
import datetime

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

from topic_detector  import TopicSession, SIMILARITY_THRESHOLD
from speech_metrics  import MetricsSession

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_topic_session   = TopicSession()
_metrics_session = MetricsSession()
_whisper_model   = None
_sbert_model     = None

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")


# ── Lazy model loaders ────────────────────────────────────────────────────────

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        logger.info("Loading Whisper model (base)…")
        _whisper_model = whisper.load_model("base")
        logger.info("Whisper ready.")
    return _whisper_model


def get_sbert():
    global _sbert_model
    if _sbert_model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading SBERT model…")
        _sbert_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("SBERT ready.")
    return _sbert_model


# ── Session file helpers ───────────────────────────────────────────────────────

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


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "all-MiniLM-L6-v2 + Whisper base"}), 200


@app.route("/api/session/reset", methods=["POST"])
def reset_session():
    _topic_session.reset()
    _metrics_session.reset()
    body = request.get_json(silent=True) or {}
    ctx  = body.get("initial_context", "").strip()
    if ctx:
        _topic_session.analyze(ctx)
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
        result = _topic_session.analyze(utterance, threshold=threshold)
    except Exception as exc:
        logger.exception("Topic analysis error: %s", exc)
        return jsonify({"error": "Internal error."}), 500
    return jsonify(result), 200


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """
    Accepts multipart/form-data with 'audio' (webm).
    Returns transcript + all 5 real communication metrics.
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
        import soundfile as sf
        import whisper as _whisper

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        # ── webm → 16kHz mono wav ─────────────────────────────────────────────
        proc = subprocess.run(
            [ffmpeg_exe, "-y", "-i", webm_path,
             "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=30
        )
        if proc.returncode != 0:
            err = proc.stderr.decode(errors="replace")[-300:]
            return jsonify({"error": f"Audio conversion failed: {err}"}), 500

        # ── Load wav ──────────────────────────────────────────────────────────
        audio_np, sr = sf.read(wav_path, dtype="float32")
        if audio_np.ndim > 1:
            audio_np = audio_np.mean(axis=1)
        duration_sec = len(audio_np) / sr

        # ── Diagnostic: log audio stats to verify mic is capturing real sound ─
        rms = float(np.sqrt(np.mean(audio_np ** 2)))
        peak = float(np.max(np.abs(audio_np)))
        logger.info("Audio stats | duration=%.2fs | RMS=%.5f | peak=%.5f | samples=%d",
                    duration_sec, rms, peak, len(audio_np))
        if rms < 0.001:
            logger.warning("Audio RMS is very low (%.5f) — mic may not be capturing sound", rms)

        # ── Whisper with word timestamps ──────────────────────────────────────
        model  = get_whisper()
        output = model.transcribe(
            audio_np,
            language="en",
            fp16=False,
            word_timestamps=True,
            no_speech_threshold=0.8,       # raised from 0.6 — less aggressive filtering
            logprob_threshold=-2.0,        # loosened from -1.0
            compression_ratio_threshold=2.4,  # loosened from 2.0
            condition_on_previous_text=False,
        )
        raw_text = output["text"].strip()

        # ── Hallucination filter ──────────────────────────────────────────────
        words = raw_text.split()
        if words and (max(words.count(w) for w in set(words)) / len(words)) > 0.6:
            logger.warning("Hallucination discarded: %r", raw_text[:80])
            text = ""
        else:
            text = raw_text
        logger.info("Whisper transcript: %r", text)

        # ── Extract word-level timestamps from Whisper segments ───────────────
        whisper_words = []
        for seg in output.get("segments", []):
            for w in seg.get("words", []):
                whisper_words.append({
                    "word":  w.get("word", "").strip(),
                    "start": w.get("start", 0.0),
                    "end":   w.get("end",   0.0),
                })

    except Exception as exc:
        logger.exception("Transcription error: %s", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        for p in [webm_path, wav_path]:
            try: os.unlink(p)
            except Exception: pass

    if not text:
        return jsonify({
            "text": "", "topic_status": "skipped",
            "similarity_score": None, "topic_shift": False,
            "metrics": None,
        }), 200

    # ── Topic detection ───────────────────────────────────────────────────────
    try:
        topic_result = _topic_session.analyze(text)
    except Exception:
        topic_result = {"topic_status": "skipped", "similarity_score": None,
                        "topic_shift": False, "message": ""}

    topic_score = topic_result.get("similarity_score")

    # ── SBERT embedding for this utterance ────────────────────────────────────
    try:
        sbert     = get_sbert()
        embedding = sbert.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    except Exception as exc:
        logger.warning("SBERT embedding failed: %s", exc)
        embedding = np.zeros(384)

    # ── Compute all 5 metrics ─────────────────────────────────────────────────
    metrics = _metrics_session.update(
        text         = text,
        whisper_words= whisper_words,
        duration_sec = duration_sec,
        embedding    = embedding,
        topic_score  = topic_score,
    )

    return jsonify({
        "text":             text,
        "topic_status":     topic_result["topic_status"],
        "similarity_score": topic_score,
        "topic_shift":      topic_result["topic_shift"],
        "message":          topic_result.get("message", ""),
        "metrics":          metrics,
    }), 200


@app.route("/api/session/save", methods=["POST"])
def save_session():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required."}), 400
    sessions = load_sessions()
    entry = {
        "id":         len(sessions) + 1,
        "timestamp":  datetime.datetime.now().isoformat(timespec="seconds"),
        "duration":   body.get("duration_seconds", 0),
        "utterances": body.get("utterances", []),
        "metrics":    body.get("metrics", {}),
    }
    sessions.append(entry)
    save_sessions(sessions)
    logger.info("Session %d saved (%d utterances)", entry["id"], len(entry["utterances"]))
    return jsonify({"status": "saved", "session_id": entry["id"]}), 200


@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    return jsonify(load_sessions()), 200


@app.route("/api/sessions/latest", methods=["GET"])
def get_latest_session():
    sessions = load_sessions()
    if not sessions:
        return jsonify({"error": "No sessions saved yet."}), 404
    return jsonify(sessions[-1]), 200


@app.route("/api/debug/save-audio", methods=["POST"])
def debug_save_audio():
    """
    Save the incoming audio as a wav file to debug/last_chunk.wav
    so you can play it back and verify what Whisper is hearing.
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio."}), 400
    audio_file = request.files["audio"]
    debug_dir = os.path.join(os.path.dirname(__file__), "debug")
    os.makedirs(debug_dir, exist_ok=True)
    webm_path = os.path.join(debug_dir, "last_chunk.webm")
    wav_path  = os.path.join(debug_dir, "last_chunk.wav")
    audio_file.save(webm_path)
    try:
        import imageio_ffmpeg, subprocess
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([ffmpeg_exe, "-y", "-i", webm_path,
                        "-ar", "16000", "-ac", "1", wav_path],
                       capture_output=True, timeout=15)
        import soundfile as sf
        import numpy as np
        audio_np, sr = sf.read(wav_path, dtype="float32")
        rms  = float(np.sqrt(np.mean(audio_np ** 2)))
        peak = float(np.max(np.abs(audio_np)))
        return jsonify({
            "saved_to": wav_path,
            "duration_sec": round(len(audio_np) / sr, 2),
            "rms": round(rms, 6),
            "peak": round(peak, 6),
            "message": "Play debug/last_chunk.wav to hear what Whisper receives",
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True, use_reloader=False)
