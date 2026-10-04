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
import sys

# ── Make imageio-ffmpeg binary available to Whisper ──────────────────────────
try:
    import imageio_ffmpeg as _iio_ffmpeg
    _ffmpeg_dir = os.path.dirname(_iio_ffmpeg.get_ffmpeg_exe())
    if _ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

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
    Accepts multipart/form-data with an 'audio' file (webm).
    Converts to 16kHz wav using pydub+imageio-ffmpeg (no system ffmpeg needed).
    Passes numpy audio array directly to Whisper — no subprocess ffmpeg call.
    Returns { text, topic_status, similarity_score, topic_shift }
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file in request."}), 400

    audio_file = request.files["audio"]

    # Save incoming webm
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
        audio_file.save(tmp_in.name)
        webm_path = tmp_in.name

    wav_path = webm_path.replace(".webm", ".wav")

    try:
        # ── Convert webm → wav using pydub + imageio-ffmpeg binary ────────────
        from pydub import AudioSegment
        import imageio_ffmpeg
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        AudioSegment.converter = ffmpeg_bin
        AudioSegment.ffmpeg    = ffmpeg_bin
        AudioSegment.ffprobe   = ffmpeg_bin

        audio_seg = AudioSegment.from_file(webm_path)
        audio_seg = audio_seg.set_frame_rate(16000).set_channels(1)
        audio_seg.export(wav_path, format="wav")

        # ── Load wav as numpy float32 array ───────────────────────────────────
        import numpy as np
        import soundfile as sf
        audio_np, sr = sf.read(wav_path, dtype="float32")
        if audio_np.ndim > 1:
            audio_np = audio_np.mean(axis=1)

        # ── Run Whisper on the numpy array directly ───────────────────────────
        model = get_whisper()
        import whisper as _whisper
        audio_np = _whisper.pad_or_trim(audio_np)
        mel = _whisper.log_mel_spectrogram(audio_np).to(model.device)

        _, probs = model.detect_language(mel)
        lang = max(probs, key=probs.get)
        logger.info("Detected language: %s", lang)

        options = _whisper.DecodingOptions(fp16=False, language="en")
        decode_result = _whisper.decode(model, mel, options)
        text = decode_result.text.strip()
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
