/**
 * LiveConversation.jsx
 * --------------------
 * Real-time speech → topic analysis pipeline:
 *
 *   Browser microphone
 *     ↓  Web Speech API (SpeechRecognition)
 *   Continuous transcript (interim + final)
 *     ↓  on every FINAL result sentence
 *   POST /api/topic-shift  (Flask · all-MiniLM-L6-v2)
 *     ↓  cosine similarity vs rolling context
 *   🟢 On topic  /  🔴 Possible topic shift
 *
 * Works in Chrome / Edge out of the box.
 * Firefox does NOT support SpeechRecognition — a fallback type-box is shown.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, Pause, Play, MessageCircle, BarChart2, Send, Mic, MicOff } from 'lucide-react';

const API_BASE = 'http://localhost:5050';
const SR_SUPPORTED = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// ── Utterance row ───────────────────────────────────────────────────────────
function UtteranceRow({ entry }) {
  const isOnTopic = entry.topic_status === 'on_topic' || entry.topic_status === 'initializing';
  const isSkipped = entry.topic_status === 'skipped';
  const dot = isSkipped ? '#bbb' : isOnTopic ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
      opacity: isSkipped ? 0.5 : 1, transition: 'opacity 0.3s',
    }}>
      <div
        title={isSkipped ? 'Too short — skipped' : isOnTopic ? 'On topic' : 'Possible topic shift'}
        style={{
          width: 10, height: 10, borderRadius: '50%', background: dot,
          marginTop: 5, flexShrink: 0, transition: 'background 0.4s ease',
          boxShadow: isSkipped ? 'none' : `0 0 6px ${dot}88`,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{entry.text}</div>
        {!isSkipped && entry.similarity_score !== null && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            similarity: {entry.similarity_score.toFixed(3)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Topic indicator ─────────────────────────────────────────────────────────
function TopicIndicator({ status, score, backendReady }) {
  const onTopic = status === 'on_topic' || status === 'initializing';
  const skipped = status === 'skipped';
  const colour  = !backendReady ? '#bbb' : skipped ? '#bbb' : onTopic ? 'var(--green)' : 'var(--red)';
  const bg      = !backendReady ? '#f5f5f5' : skipped ? '#f5f5f5' : onTopic ? '#e8f5e8' : '#fee2e2';
  const label   = !backendReady ? 'Connecting…'
    : skipped   ? 'Short response'
    : onTopic   ? 'On topic'
    : 'Possible topic shift';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 20, padding: '6px 14px',
      transition: 'background 0.4s ease',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%', background: colour,
        transition: 'background 0.4s ease',
        boxShadow: backendReady && !skipped ? `0 0 6px ${colour}99` : 'none',
      }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: colour, transition: 'color 0.4s' }}>
        {label}
      </span>
      {score !== null && backendReady && !skipped && (
        <span style={{ fontSize: 11, color: '#aaa' }}>({score?.toFixed(2)})</span>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function LiveConversation() {
  const nav = useNavigate();

  // Timer
  const [seconds,      setSeconds]      = useState(0);
  const [running,      setRunning]      = useState(false);

  // Mic / speech
  const [micActive,    setMicActive]    = useState(false);
  const [interim,      setInterim]      = useState('');   // live partial text
  const [micError,     setMicError]     = useState(null);
  const srRef = useRef(null);

  // Topic detection
  const [topicStatus,  setTopicStatus]  = useState('initializing');
  const [topicScore,   setTopicScore]   = useState(null);
  const [backendReady, setBackendReady] = useState(false);
  const [transcript,   setTranscript]   = useState([]);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [apiError,     setApiError]     = useState(null);

  // Manual fallback input
  const [inputText,    setInputText]    = useState('');

  const transcriptEndRef = useRef(null);
  const tab = 'conversation';

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Backend session reset on mount ───────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/session/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(r => r.ok ? setBackendReady(true) : setApiError('Backend error on session reset.'))
      .catch(() => setApiError('Cannot reach backend on port 5050.'));
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Analyse utterance ────────────────────────────────────────────────────
  const analyzeUtterance = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean || analyzing) return;
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
        text:             clean,
        topic_status:     data.topic_status,
        similarity_score: data.similarity_score,
        topic_shift:      data.topic_shift,
      }]);
    } catch (err) {
      setApiError(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  // ── Speech Recognition ───────────────────────────────────────────────────
  const startMic = useCallback(() => {
    if (!SR_SUPPORTED) {
      setMicError('SpeechRecognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (srRef.current) return; // already running

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
          if (finalText) analyzeUtterance(finalText);
          setInterim('');
        } else {
          interimText += result[0].transcript;
        }
      }
      if (interimText) setInterim(interimText);
    };

    sr.onerror = (e) => {
      // 'no-speech' is normal during silence — don't show as error
      if (e.error === 'no-speech') return;
      if (e.error === 'not-allowed') {
        setMicError('Microphone access denied. Please allow microphone in browser settings.');
      } else {
        setMicError(`Mic error: ${e.error}`);
      }
      stopMic();
    };

    sr.onend = () => {
      // Auto-restart if still supposed to be running (continuous mode sometimes stops)
      if (srRef.current) {
        try { srRef.current.start(); } catch { /* ignore */ }
      }
    };

    srRef.current = sr;
    sr.start();
  }, [analyzeUtterance]);

  const stopMic = useCallback(() => {
    if (srRef.current) {
      srRef.current.onend = null; // prevent auto-restart
      srRef.current.stop();
      srRef.current = null;
    }
    setMicActive(false);
    setInterim('');
    setRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopMic(), [stopMic]);

  // Manual input submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    analyzeUtterance(inputText);
    setInputText('');
  };

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
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

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {(apiError || micError) && (
        <div style={{
          background: '#fee2e2', border: '1.5px solid #fca5a5',
          borderRadius: 12, padding: '10px 16px', marginBottom: 14,
          fontSize: 13, color: 'var(--red)', fontWeight: 500,
        }}>
          ⚠ {micError || apiError}
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {['conversation', 'live analysis'].map(t => (
          <button key={t}
            onClick={() => t === 'live analysis' ? nav('/analysis') : null}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: t === 'conversation' ? '#fff' : 'transparent',
              color:      t === 'conversation' ? 'var(--blue)' : '#888',
              boxShadow:  t === 'conversation' ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
              textTransform: 'capitalize',
            }}>
            {t === 'conversation'
              ? <><MessageCircle size={13} style={{ marginRight: 5 }} />Conversation</>
              : <><BarChart2 size={13} style={{ marginRight: 5 }} />Live Analysis</>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 24 }}>
        {/* ── Left ─────────────────────────────────────────────────────── */}
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
              <div style={{ fontSize: 14, color: '#bbb', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                {micActive ? 'Speak now…' : 'Press the mic button to start'}
              </div>
            )}

            {transcript.map((e, i) => <UtteranceRow key={i} entry={e} />)}

            {/* Live interim (grey, not yet analysed) */}
            {interim && (
              <div style={{
                padding: '8px 0', fontSize: 14, color: '#aaa',
                fontStyle: 'italic', lineHeight: 1.6,
                borderTop: transcript.length ? '1px dashed var(--border)' : 'none',
                marginTop: transcript.length ? 4 : 0,
              }}>
                <span style={{ marginRight: 8, fontSize: 12 }}>🎙</span>{interim}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* ── Mic button + waveform ──────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            {/* Waveform — only animates when mic is live */}
            <div className="waveform">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="wave-bar"
                  style={{ height: micActive ? undefined : 6, background: micActive ? 'var(--blue)' : '#ccc' }} />
              ))}
            </div>

            {/* Main mic button */}
            <button
              className="btn"
              title={micActive ? 'Stop recording' : 'Start recording'}
              style={{
                width: 72, height: 72, borderRadius: '50%', padding: 0,
                background: micActive
                  ? 'linear-gradient(135deg,#e05555,#c0392b)'
                  : 'linear-gradient(135deg,#4a8eff,#6c63ff)',
                color: '#fff',
                boxShadow: micActive
                  ? '0 0 0 6px rgba(224,85,85,0.2), 0 4px 20px rgba(224,85,85,0.4)'
                  : '0 4px 20px rgba(74,142,255,0.35)',
                transition: 'all 0.25s ease',
                border: 'none', cursor: 'pointer',
              }}
              onClick={() => micActive ? stopMic() : startMic()}
            >
              {micActive ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            {/* Stop session button */}
            <button
              className="btn btn-danger"
              style={{ width: 52, height: 52, borderRadius: '50%', padding: 0 }}
              onClick={() => { stopMic(); nav('/summary'); }}>
              <Square size={18} fill="var(--red)" />
            </button>
          </div>

          {/* Mic status hint */}
          <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginBottom: 14 }}>
            {!SR_SUPPORTED
              ? '⚠ Speech API not supported — use the text input below'
              : micActive
              ? 'Recording… tap mic to pause'
              : 'Tap the mic to start recording'}
          </div>

          {/* Manual / fallback text input */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={SR_SUPPORTED ? 'Or type an utterance manually…' : 'Type your utterance here…'}
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

        {/* ── Right ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Live metrics */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Metrics
            </div>
            {[
              { label: 'Utterances',  value: transcript.length },
              { label: 'Topic shifts',value: transcript.filter(t => t.topic_shift).length },
              { label: 'On-topic',    value: transcript.filter(t => t.topic_status === 'on_topic').length },
              { label: 'Off-topic',   value: transcript.filter(t => t.topic_status === 'off_topic').length },
              { label: 'Skipped',     value: transcript.filter(t => t.topic_status === 'skipped').length },
            ].map(m => (
              <div className="metric-row" key={m.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Quick test sentences */}
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
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: 'var(--blue-light)', color: 'var(--blue)', fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {s.length > 55 ? s.slice(0, 55) + '…' : s}
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#aaa', margin: '8px 0 6px' }}>Off-topic</div>
            {[
              'I went shopping with friends yesterday.',
              'The weather today is really nice.',
            ].map((s, i) => (
              <div key={i} onClick={() => analyzeUtterance(s)}
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: '#fee2e2', color: 'var(--red)', fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}
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
