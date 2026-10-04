/**
 * LiveConversation.jsx
 * Real microphone recording with:
 * - Web Audio API volume bars (only move when sound is detected)
 * - Web Speech API continuous recognition
 * - Interim results also analyzed when >= 6 words (catches phone playback)
 * - Robust auto-restart on onend
 * - Topic-shift detection via Flask backend
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, MessageCircle, BarChart2, Send, Mic, MicOff } from 'lucide-react';

const API_BASE    = 'http://localhost:5050';
const SR_SUPPORTED = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const NUM_BARS    = 12;
const MIN_INTERIM_WORDS = 6; // analyze long interim chunks even before final

// ── Utterance row ────────────────────────────────────────────────────────────
function UtteranceRow({ entry }) {
  const onTopic = entry.topic_status === 'on_topic' || entry.topic_status === 'initializing';
  const skipped = entry.topic_status === 'skipped';
  const dot     = skipped ? '#bbb' : onTopic ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
      opacity: skipped ? 0.5 : 1,
    }}>
      <div title={skipped ? 'Too short' : onTopic ? 'On topic' : 'Possible topic shift'}
        style={{
          width: 10, height: 10, borderRadius: '50%', background: dot,
          marginTop: 6, flexShrink: 0, transition: 'background 0.4s',
          boxShadow: skipped ? 'none' : `0 0 6px ${dot}88`,
        }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{entry.text}</div>
        {!skipped && entry.similarity_score != null && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            similarity: {entry.similarity_score.toFixed(3)}
            {entry.topic_shift && (
              <span style={{ marginLeft: 8, color: 'var(--red)', fontWeight: 600 }}>⚠ shift</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Topic indicator ──────────────────────────────────────────────────────────
function TopicIndicator({ status, score, backendReady }) {
  const onTopic = status === 'on_topic' || status === 'initializing';
  const skipped = status === 'skipped';
  const colour  = !backendReady ? '#bbb' : skipped ? '#bbb' : onTopic ? 'var(--green)' : 'var(--red)';
  const bg      = !backendReady ? '#f0ece4' : skipped ? '#f0ece4' : onTopic ? '#e8f5e8' : '#fee2e2';
  const label   = !backendReady ? 'Connecting…'
    : skipped ? 'Short response'
    : onTopic ? 'On topic'
    : 'Possible topic shift';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 20, padding: '7px 16px',
      transition: 'background 0.4s ease',
    }}>
      <div style={{
        width: 11, height: 11, borderRadius: '50%', background: colour,
        transition: 'background 0.4s',
        boxShadow: backendReady && !skipped ? `0 0 7px ${colour}bb` : 'none',
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: colour, transition: 'color 0.4s' }}>
        {label}
      </span>
      {score != null && backendReady && !skipped && (
        <span style={{ fontSize: 11, color: '#aaa' }}>({score.toFixed(2)})</span>
      )}
    </div>
  );
}

// ── Real-time volume waveform (Web Audio API) ────────────────────────────────
function VolumeWaveform({ micActive, streamRef }) {
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef  = useRef(null);
  const dataRef      = useRef(null);
  const [bars, setBars] = useState(Array(NUM_BARS).fill(4));

  useEffect(() => {
    if (!micActive || !streamRef.current) {
      // Mic off — flat bars
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      setBars(Array(NUM_BARS).fill(4));
      return;
    }

    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const source   = ctx.createMediaStreamSource(streamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataRef.current     = new Uint8Array(analyser.frequencyBinCount);

      const draw = () => {
        analyser.getByteFrequencyData(dataRef.current);
        // Map frequency bins to NUM_BARS
        const step     = Math.floor(dataRef.current.length / NUM_BARS);
        const newBars  = Array.from({ length: NUM_BARS }, (_, i) => {
          const val = dataRef.current[i * step] / 255; // 0–1
          return Math.max(4, Math.round(val * 44));     // min 4px, max 44px
        });
        setBars(newBars);
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      return () => {
        cancelAnimationFrame(animFrameRef.current);
        ctx.close();
      };
    } catch {
      // AudioContext not available — fall back to CSS animation
    }
  }, [micActive, streamRef]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 48 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 5,
          height: h,
          borderRadius: 3,
          background: micActive ? 'var(--blue)' : '#ccc',
          transition: micActive ? 'height 0.05s ease' : 'height 0.3s ease, background 0.3s',
        }} />
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LiveConversation() {
  const nav = useNavigate();

  const [seconds,      setSeconds]      = useState(0);
  const [running,      setRunning]      = useState(false);
  const [micActive,    setMicActive]    = useState(false);
  const [interim,      setInterim]      = useState('');
  const [micError,     setMicError]     = useState(null);

  const [topicStatus,  setTopicStatus]  = useState('initializing');
  const [topicScore,   setTopicScore]   = useState(null);
  const [backendReady, setBackendReady] = useState(false);
  const [transcript,   setTranscript]   = useState([]);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [apiError,     setApiError]     = useState(null);
  const [inputText,    setInputText]    = useState('');

  const srRef            = useRef(null);
  const streamRef        = useRef(null);   // MediaStream for Web Audio
  const shouldRunRef     = useRef(false);  // intent flag for auto-restart
  const analyzingRef     = useRef(false);  // sync ref for analyzeUtterance
  const lastInterimRef   = useRef('');     // track last sent interim
  const transcriptEndRef = useRef(null);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Backend session reset ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/session/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
      .then(r => r.ok ? setBackendReady(true) : setApiError('Backend error.'))
      .catch(() => setApiError('Cannot reach backend on port 5050.'));
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Analyse utterance ─────────────────────────────────────────────────────
  const analyzeUtterance = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean || analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/topic-shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: clean }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      setApiError(`Analysis failed: ${err.message}`);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, []);

  // ── Start mic ─────────────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    if (!SR_SUPPORTED) {
      setMicError('SpeechRecognition not supported. Use Chrome or Edge, or type below.');
      return;
    }
    if (srRef.current) return;

    shouldRunRef.current = true;

    // Get MediaStream for Web Audio visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      // Visualizer won't work but speech still might
    }

    const sr = new SpeechRecognitionAPI();
    sr.continuous      = true;
    sr.interimResults  = true;
    sr.lang            = 'en-US';
    sr.maxAlternatives = 1;

    sr.onstart = () => {
      setMicActive(true);
      setRunning(true);
      setMicError(null);
    };

    sr.onresult = (event) => {
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          const finalText = result[0].transcript.trim();
          if (finalText) {
            analyzeUtterance(finalText);
            lastInterimRef.current = '';
          }
          setInterim('');
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) {
        setInterim(interimText);
        // Also analyze long interim chunks (catches phone audio that may not
        // produce a clean final result before the recognizer resets)
        const wordCount = interimText.trim().split(/\s+/).length;
        if (
          wordCount >= MIN_INTERIM_WORDS &&
          interimText.trim() !== lastInterimRef.current
        ) {
          lastInterimRef.current = interimText.trim();
          analyzeUtterance(interimText.trim());
        }
      }
    };

    sr.onerror = (e) => {
      if (e.error === 'no-speech') return;           // normal silence
      if (e.error === 'aborted') return;             // we called stop()
      if (e.error === 'not-allowed') {
        setMicError('Microphone access denied. Allow mic in browser settings and try again.');
        shouldRunRef.current = false;
      } else {
        setMicError(`Mic error: ${e.error}`);
      }
    };

    sr.onend = () => {
      // Auto-restart as long as user hasn't explicitly stopped
      if (shouldRunRef.current) {
        try { sr.start(); } catch { /* already started */ }
      } else {
        setMicActive(false);
        setRunning(false);
      }
    };

    srRef.current = sr;
    try {
      sr.start();
    } catch (err) {
      setMicError(`Could not start mic: ${err.message}`);
    }
  }, [analyzeUtterance]);

  // ── Stop mic ──────────────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    shouldRunRef.current = false;
    if (srRef.current) {
      srRef.current.stop();
      srRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setMicActive(false);
    setInterim('');
    setRunning(false);
  }, []);

  useEffect(() => () => stopMic(), [stopMic]);

  // ── Manual submit ─────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    analyzeUtterance(inputText);
    setInputText('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {micActive && <div className="pulse-dot" />}
            <span style={{ fontSize: 13, fontWeight: 600, color: micActive ? 'var(--red)' : '#888' }}>
              {micActive ? 'Listening…' : 'Ready to start'}
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{fmt(seconds)}</h1>
        </div>
        <button className="btn btn-danger" style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={() => { stopMic(); nav('/summary'); }}>
          ■ Stop
        </button>
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
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {['Conversation', 'Live Analysis'].map((t, i) => (
          <button key={t}
            onClick={() => i === 1 ? nav('/analysis') : null}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: i === 0 ? '#fff' : 'transparent',
              color:      i === 0 ? 'var(--blue)' : '#888',
              boxShadow:  i === 0 ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
            }}>
            {i === 0
              ? <><MessageCircle size={13} style={{ marginRight: 5 }} />{t}</>
              : <><BarChart2 size={13} style={{ marginRight: 5 }} />{t}</>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 24 }}>
        {/* Left */}
        <div>
          {/* Topic indicator */}
          <div style={{ marginBottom: 14 }}>
            <TopicIndicator status={topicStatus} score={topicScore} backendReady={backendReady} />
          </div>

          {/* Transcript */}
          <div className="card" style={{ marginBottom: 14, minHeight: 200, maxHeight: 320, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Transcript
            </div>
            {transcript.length === 0 && !interim && (
              <div style={{ fontSize: 14, color: '#bbb', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                {micActive ? 'Speak now…' : 'Press the mic button to start'}
              </div>
            )}
            {transcript.map((e, i) => <UtteranceRow key={i} entry={e} />)}
            {interim && (
              <div style={{
                padding: '8px 0', fontSize: 14, color: '#aaa', fontStyle: 'italic', lineHeight: 1.6,
                borderTop: transcript.length ? '1px dashed var(--border)' : 'none',
                marginTop: transcript.length ? 4 : 0,
              }}>
                🎙 {interim}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Volume waveform + mic button */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, marginBottom: 12 }}>
            <VolumeWaveform micActive={micActive} streamRef={streamRef} />

            {/* Mic toggle button */}
            <button
              title={micActive ? 'Stop recording' : 'Start recording'}
              onClick={() => micActive ? stopMic() : startMic()}
              style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: micActive
                  ? 'linear-gradient(135deg,#e05555,#c0392b)'
                  : 'linear-gradient(135deg,#4a8eff,#6c63ff)',
                color: '#fff',
                boxShadow: micActive
                  ? '0 0 0 8px rgba(224,85,85,0.18), 0 4px 20px rgba(224,85,85,0.4)'
                  : '0 4px 20px rgba(74,142,255,0.35)',
                transition: 'all 0.25s ease',
              }}
            >
              {micActive ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            {/* Stop session */}
            <button
              onClick={() => { stopMic(); nav('/summary'); }}
              style={{
                width: 50, height: 50, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Square size={18} fill="var(--red)" color="var(--red)" />
            </button>
          </div>

          {/* Status hint */}
          <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginBottom: 16 }}>
            {!SR_SUPPORTED
              ? '⚠ Speech not supported in this browser — type below instead'
              : micActive
              ? 'Recording — bars show live mic volume · tap to stop'
              : 'Tap the mic to start recording'}
          </div>

          {/* Manual / fallback input */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Or type an utterance manually…"
                disabled={!backendReady || analyzing}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!backendReady || analyzing || !inputText.trim()}
                style={{ padding: '10px 16px', flexShrink: 0 }}
              >
                {analyzing ? '…' : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Live metrics */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Metrics
            </div>
            {[
              { label: 'Utterances',   value: transcript.length },
              { label: 'Topic shifts', value: transcript.filter(t => t.topic_shift).length },
              { label: 'On-topic',     value: transcript.filter(t => t.topic_status === 'on_topic').length },
              { label: 'Off-topic',    value: transcript.filter(t => t.topic_status === 'off_topic').length },
              { label: 'Skipped',      value: transcript.filter(t => t.topic_status === 'skipped').length },
            ].map(m => (
              <div className="metric-row" key={m.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Quick test */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Quick Test
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>On-topic</div>
            {[
              'My project uses AI to analyze communication.',
              'We use Whisper to convert speech into text.',
              'The system measures speaking rate and pauses.',
            ].map((s, i) => (
              <div key={i} onClick={() => analyzeUtterance(s)}
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: 'var(--blue-light)', color: 'var(--blue)', fontSize: 12, marginBottom: 5, lineHeight: 1.4, transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {s}
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#aaa', margin: '8px 0 6px' }}>Off-topic</div>
            {[
              'I went shopping with friends yesterday.',
              'The weather today is really nice.',
            ].map((s, i) => (
              <div key={i} onClick={() => analyzeUtterance(s)}
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: '#fee2e2', color: 'var(--red)', fontSize: 12, marginBottom: 5, lineHeight: 1.4, transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {s}
              </div>
            ))}
          </div>

          {/* Backend status */}
          <div className="card card-sm" style={{ background: backendReady ? '#e8f5e8' : '#fff3e0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: backendReady ? 'var(--green)' : 'var(--orange)' }}>
              {backendReady ? '🟢 Backend connected' : '🟡 Connecting…'}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>all-MiniLM-L6-v2 · port 5050</div>
          </div>
        </div>
      </div>
    </div>
  );
}
