/**
 * LiveConversation.jsx
 * Browser mic → MediaRecorder (restart every 5s for valid EBML headers)
 * → POST /api/transcribe (Whisper on Flask)
 * → transcript + topic-shift indicator (🟢 / 🔴)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, MessageCircle, BarChart2, Send, Mic, MicOff, Loader } from 'lucide-react';

const API_BASE  = 'http://localhost:5050';
const CHUNK_MS  = 5000;
const NUM_BARS  = 14;

// ── Utterance row ─────────────────────────────────────────────────────────────
function UtteranceRow({ entry }) {
  const onTopic = entry.topic_status === 'on_topic' || entry.topic_status === 'initializing';
  const skipped = entry.topic_status === 'skipped';
  const dot     = skipped ? '#bbb' : onTopic ? '#27ae60' : '#e74c3c';
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: dot,
        marginTop: 6, flexShrink: 0, transition: 'background 0.4s',
        boxShadow: skipped ? 'none' : `0 0 6px ${dot}99`,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: '#2d2d2d' }}>{entry.text}</div>
        {!skipped && entry.similarity_score != null && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
            {onTopic ? '🟢 On topic' : '🔴 Off topic'} · score {entry.similarity_score.toFixed(3)}
            {entry.topic_shift && (
              <span style={{ marginLeft: 8, color: '#e74c3c', fontWeight: 700 }}>⚠ topic shift</span>
            )}
          </div>
        )}
        {skipped && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>too short — skipped</div>}
      </div>
    </div>
  );
}

// ── Topic indicator ───────────────────────────────────────────────────────────
function TopicIndicator({ status, score, backendReady }) {
  const onTopic = status === 'on_topic' || status === 'initializing';
  const skipped = status === 'skipped';
  const colour  = !backendReady ? '#aaa' : skipped ? '#aaa' : onTopic ? '#27ae60' : '#e74c3c';
  const bg      = !backendReady ? '#f0ece4' : skipped ? '#f0ece4' : onTopic ? '#e8f5e8' : '#fee2e2';
  const label   = !backendReady ? 'Connecting…'
    : skipped ? 'Short — skipped'
    : onTopic ? 'On topic'
    : 'Possible topic shift';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 20, padding: '7px 16px',
      transition: 'background 0.4s', width: '100%',
    }}>
      <div style={{
        width: 11, height: 11, borderRadius: '50%', background: colour,
        transition: 'background 0.4s',
        boxShadow: backendReady && !skipped ? `0 0 8px ${colour}cc` : 'none',
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: colour }}>{label}</span>
      {score != null && backendReady && !skipped && (
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>({score.toFixed(2)})</span>
      )}
    </div>
  );
}

// ── Volume waveform ───────────────────────────────────────────────────────────
function VolumeWaveform({ stream }) {
  const [bars, setBars] = useState(Array(NUM_BARS).fill(4));
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!stream) {
      cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
      setBars(Array(NUM_BARS).fill(4));
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.max(1, Math.floor(data.length / NUM_BARS));
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setBars(Array.from({ length: NUM_BARS }, (_, i) => {
          const v = data[Math.min(i * step, data.length - 1)] / 255;
          return Math.max(4, Math.round(v * 44));
        }));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return () => { cancelAnimationFrame(rafRef.current); ctx.close(); ctxRef.current = null; };
    } catch { /* no AudioContext */ }
  }, [stream]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 48 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 5, height: h, borderRadius: 3,
          background: stream ? 'var(--blue)' : '#ccc',
          transition: stream ? 'height 0.06s' : 'height 0.4s, background 0.3s',
        }} />
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LiveConversation() {
  const nav = useNavigate();

  const [seconds,      setSeconds]      = useState(0);
  const [running,      setRunning]      = useState(false);
  const [recording,    setRecording]    = useState(false);
  const [stream,       setStream]       = useState(null);
  const [processing,   setProcessing]   = useState(false);
  const [micError,     setMicError]     = useState(null);
  const [topicStatus,  setTopicStatus]  = useState('initializing');
  const [topicScore,   setTopicScore]   = useState(null);
  const [backendReady, setBackendReady] = useState(false);
  const [transcript,   setTranscript]   = useState([]);
  const [apiError,     setApiError]     = useState(null);
  const [inputText,    setInputText]    = useState('');
  // Live metrics — updated after every Whisper chunk
  const [liveMetrics,  setLiveMetrics]  = useState(null);

  const mediaRecRef = useRef(null);
  const intervalRef = useRef(null);
  const queueRef    = useRef([]);
  const procRef     = useRef(false);
  const bottomRef   = useRef(null);
  const streamRef   = useRef(null);   // keep ref in sync for callbacks

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Backend session reset ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/session/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
      .then(r => r.ok ? setBackendReady(true) : setApiError('Backend error on reset.'))
      .catch(() => setApiError('Cannot reach backend on port 5050. Is Flask running?'));
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Queue processor ────────────────────────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (procRef.current || queueRef.current.length === 0) return;
    procRef.current = true;
    setProcessing(true);

    while (queueRef.current.length > 0) {
      const blob = queueRef.current.shift();
      if (!blob || blob.size < 5000) continue;

      const form = new FormData();
      form.append('audio', blob, 'chunk.webm');

      try {
        const res  = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) { setApiError(data.error); continue; }
        if (!data.text) continue;
        setApiError(null);
        setTopicStatus(data.topic_status);
        setTopicScore(data.similarity_score);
        if (data.metrics) setLiveMetrics(data.metrics.session);
        setTranscript(prev => [...prev, {
          text:             data.text,
          topic_status:     data.topic_status,
          similarity_score: data.similarity_score,
          topic_shift:      data.topic_shift,
          metrics:          data.metrics,
        }]);
      } catch (err) {
        setApiError(`Transcription error: ${err.message}`);
      }
    }

    procRef.current = false;
    setProcessing(false);
  }, []);

  const enqueueBlob = useCallback((blob) => {
    queueRef.current.push(blob);
    processQueue();
  }, [processQueue]);

  // ── Manual text submit ─────────────────────────────────────────────────────
  const submitText = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean) return;
    try {
      const res  = await fetch(`${API_BASE}/api/topic-shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: clean }),
      });
      const data = await res.json();
      setTopicStatus(data.topic_status);
      setTopicScore(data.similarity_score);
      setApiError(null);
      setTranscript(prev => [...prev, {
        text: clean,
        topic_status:     data.topic_status,
        similarity_score: data.similarity_score,
        topic_shift:      data.topic_shift,
      }]);
    } catch (err) {
      setApiError(`Error: ${err.message}`);
    }
  }, []);

  // ── Start recording ────────────────────────────────────────────────────────
  // Each segment is a FRESH MediaRecorder → valid EBML header every time
  const startRecording = useCallback(async () => {
    if (recording) return;
    setMicError(null);

    let micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setMicError('Microphone access denied. Allow mic in browser settings and reload.');
      return;
    }

    streamRef.current = micStream;
    setStream(micStream);
    setRunning(true);
    setRecording(true);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const startSegment = () => {
      if (!streamRef.current) return;
      const mr = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecRef.current = mr;
      const localChunks = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunks.push(e.data);
      };

      mr.onstop = () => {
        if (localChunks.length > 0) {
          const blob = new Blob(localChunks, { type: mimeType });
          if (blob.size > 5000) enqueueBlob(blob);
        }
      };

      mr.start();
    };

    startSegment();

    // Every CHUNK_MS: stop current recorder (onstop fires → blob sent to Whisper)
    // then start a fresh one with a new EBML header
    intervalRef.current = setInterval(() => {
      if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
        mediaRecRef.current.stop();
        setTimeout(startSegment, 150);
      }
    }, CHUNK_MS);

  }, [recording, enqueueBlob]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();   // onstop fires → final blob sent
    }
    mediaRecRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setRecording(false);
    setRunning(false);
  }, []);

  useEffect(() => () => stopRecording(), []);

  const handleStop = () => {
    stopRecording();
    // Save session to backend
    if (transcript.length > 0) {
      fetch(`${API_BASE}/api/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utterances: transcript,
          duration_seconds: seconds,
          metrics: liveMetrics,
        }),
      }).catch(() => {});
    }
    nav('/dashboard');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    submitText(inputText);
    setInputText('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {recording && <div className="pulse-dot" />}
            {processing && (
              <Loader size={12} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: recording ? 'var(--red)' : '#888' }}>
              {recording ? 'Recording…' : 'Ready to start'}
              {processing ? ' · transcribing…' : ''}
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{fmt(seconds)}</h1>
        </div>
        <button className="btn btn-danger" style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={handleStop}>■ Stop</button>
      </div>

      {/* Error banner */}
      {(apiError || micError) && (
        <div style={{
          background: '#fee2e2', border: '1.5px solid #fca5a5',
          borderRadius: 12, padding: '10px 16px', marginBottom: 14,
          fontSize: 13, color: 'var(--red)', fontWeight: 500,
        }}>
          ⚠ {micError || apiError}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 18 }}>
        {[
          { label: 'Conversation', icon: <MessageCircle size={13} /> },
          { label: 'Live Analysis', icon: <BarChart2 size={13} /> },
        ].map((t, i) => (
          <button key={t.label} onClick={() => i === 1 ? nav('/analysis', { state: { metrics: liveMetrics, topicStatus, topicScore, transcript } }) : null}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: i === 0 ? '#fff' : 'transparent',
              color: i === 0 ? 'var(--blue)' : '#888',
              boxShadow: i === 0 ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 24 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TopicIndicator status={topicStatus} score={topicScore} backendReady={backendReady} />

          {/* Transcript box */}
          <div className="card" style={{ minHeight: 260, maxHeight: 420, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Transcript
              {processing && (
                <span style={{ marginLeft: 10, color: 'var(--blue)', fontWeight: 400, textTransform: 'none', fontSize: 11 }}>
                  ⏳ Whisper processing…
                </span>
              )}
            </div>
            {transcript.length === 0 && (
              <div style={{ fontSize: 15, color: '#bbb', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                {recording ? 'Whisper transcribing… speak clearly' : 'Press the mic to start recording'}
              </div>
            )}
            {transcript.map((e, i) => <UtteranceRow key={i} entry={e} />)}
            <div ref={bottomRef} />
          </div>

          {/* Mic controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
            <VolumeWaveform stream={stream} />

            <button
              onClick={() => recording ? stopRecording() : startRecording()}
              style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: recording
                  ? 'linear-gradient(135deg,#e05555,#c0392b)'
                  : 'linear-gradient(135deg,#4a8eff,#6c63ff)',
                color: '#fff',
                boxShadow: recording
                  ? '0 0 0 8px rgba(224,85,85,0.18), 0 4px 20px rgba(224,85,85,0.4)'
                  : '0 4px 20px rgba(74,142,255,0.35)',
                transition: 'all 0.25s',
              }}>
              {recording ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            <button onClick={handleStop}
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none',
                cursor: 'pointer', background: '#fee2e2', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Square size={18} fill="var(--red)" color="var(--red)" />
            </button>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa' }}>
            {recording
              ? 'Recording · Whisper transcribes every 5 s · tap mic to stop'
              : 'Tap the mic to start · powered by Whisper'}
          </div>

          {/* Manual input */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Or type an utterance manually…"
                disabled={!backendReady} style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary"
                disabled={!backendReady || !inputText.trim()}
                style={{ padding: '10px 16px', flexShrink: 0 }}>
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Metrics
            </div>
            {liveMetrics ? (
              [
                { label: 'Speaking Rate', value: `${liveMetrics.speaking_rate_wpm} wpm`, color: '#4a7fe5' },
                { label: 'Filler Rate',   value: `${liveMetrics.filler_rate_pct}%`,      color: '#f0a040' },
                { label: 'Pauses',        value: `${liveMetrics.total_pauses}`,           color: '#e05555' },
                { label: 'Topic Relevance', value: liveMetrics.topic_relevance != null ? liveMetrics.topic_relevance.toFixed(2) : '—', color: '#27ae60' },
                { label: 'Coherence',     value: liveMetrics.avg_coherence != null ? liveMetrics.avg_coherence.toFixed(2) : '—', color: '#6c63ff' },
                { label: 'Words spoken',  value: liveMetrics.total_words,                color: '#888' },
              ].map(m => (
                <div className="metric-row" key={m.label}>
                  <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))
            ) : (
              [
                { label: 'Utterances',   value: transcript.length },
                { label: 'Topic shifts', value: transcript.filter(t => t.topic_shift).length },
                { label: 'On-topic',     value: transcript.filter(t => t.topic_status === 'on_topic').length },
                { label: 'Off-topic',    value: transcript.filter(t => t.topic_status === 'off_topic').length },
              ].map(m => (
                <div className="metric-row" key={m.label}>
                  <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.value}</span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Session Results
            </div>

            {transcript.length === 0 ? (
              <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
                Results will appear here as you speak
              </div>
            ) : (
              <>
                {/* Group into on-topic and off-topic */}
                {(() => {
                  const onTopicItems  = transcript.filter(t => t.topic_status === 'on_topic' || t.topic_status === 'initializing');
                  const offTopicItems = transcript.filter(t => t.topic_status === 'off_topic');
                  const skippedItems  = transcript.filter(t => t.topic_status === 'skipped');
                  return (
                    <>
                      {onTopicItems.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>On-topic</div>
                          {onTopicItems.map((t, i) => (
                            <div key={i} style={{
                              background: '#e8f0fd', color: '#3a6fd4',
                              borderRadius: 12, padding: '10px 14px',
                              fontSize: 13, fontWeight: 500,
                              marginBottom: 8, lineHeight: 1.5,
                            }}>
                              {t.text}
                            </div>
                          ))}
                        </>
                      )}
                      {offTopicItems.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: '#aaa', margin: '6px 0 6px' }}>Off-topic</div>
                          {offTopicItems.map((t, i) => (
                            <div key={i} style={{
                              background: '#fee2e2', color: '#e05555',
                              borderRadius: 12, padding: '10px 14px',
                              fontSize: 13, fontWeight: 500,
                              marginBottom: 8, lineHeight: 1.5,
                            }}>
                              {t.text}
                            </div>
                          ))}
                        </>
                      )}
                      {skippedItems.length > 0 && (
                        <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>
                          {skippedItems.length} short response{skippedItems.length > 1 ? 's' : ''} skipped
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

          <div className="card card-sm" style={{ background: backendReady ? '#e8f5e8' : '#fff3e0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: backendReady ? '#27ae60' : 'var(--orange)' }}>
              {backendReady ? '🟢 Backend connected' : '🟡 Connecting…'}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              Whisper base + all-MiniLM-L6-v2 · port 5050
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
