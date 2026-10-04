/**
 * LiveConversation.jsx
 * --------------------
 * Real-time conversation view with Topic-Shift Detection.
 *
 * Pipeline:
 *   User types/speaks utterance
 *     → POST /api/topic-shift  (Flask backend, all-MiniLM-L6-v2)
 *     → Cosine similarity vs rolling topic context
 *     → 🟢 On topic  /  🔴 Possible topic shift
 *
 * The topic indicator updates with a subtle CSS transition — no popup,
 * no interruption to the conversation flow.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Square, Pause, Play, MessageCircle, BarChart2, Send } from 'lucide-react';

const API_BASE = 'http://localhost:5050';

// ── Utterance row component ─────────────────────────────────────────────────
function UtteranceRow({ entry }) {
  const isOnTopic   = entry.topic_status === 'on_topic' || entry.topic_status === 'initializing';
  const isSkipped   = entry.topic_status === 'skipped';
  const dotColour   = isSkipped ? '#bbb' : isOnTopic ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
      opacity: isSkipped ? 0.55 : 1,
      transition: 'opacity 0.3s',
    }}>
      {/* Topic dot */}
      <div title={isSkipped ? 'Too short — skipped' : isOnTopic ? 'On topic' : 'Possible topic shift'}
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: dotColour, marginTop: 5, flexShrink: 0,
          transition: 'background 0.4s ease',
          boxShadow: isSkipped ? 'none' : `0 0 6px ${dotColour}88`,
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

// ── Topic Status indicator ──────────────────────────────────────────────────
function TopicIndicator({ status, score, backendReady }) {
  const onTopic   = status === 'on_topic' || status === 'initializing';
  const skipped   = status === 'skipped';
  const colour    = !backendReady ? '#bbb' : skipped ? '#bbb' : onTopic ? 'var(--green)' : 'var(--red)';
  const bg        = !backendReady ? '#f5f5f5' : skipped ? '#f5f5f5' : onTopic ? '#e8f5e8' : '#fee2e2';
  const label     = !backendReady
    ? 'Connecting…'
    : skipped ? 'Short response'
    : onTopic ? 'On topic'
    : 'Possible topic shift';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 20,
      padding: '6px 14px', transition: 'background 0.4s ease',
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: colour,
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

// ── Main page ───────────────────────────────────────────────────────────────
export default function LiveConversation() {
  const nav      = useNavigate();
  const location = useLocation();

  // Topic seed passed from NewConversation page (e.g. "Interview Discussion")
  const seedTopic = location.state?.topic || '';

  const [running,       setRunning]       = useState(true);
  const [seconds,       setSeconds]       = useState(0);
  const [tab,           setTab]           = useState('conversation');

  // Topic detection state
  const [topicStatus,   setTopicStatus]   = useState('initializing');
  const [topicScore,    setTopicScore]    = useState(null);
  const [backendReady,  setBackendReady]  = useState(false);
  const [transcript,    setTranscript]    = useState([]);

  // Input for manual utterance submission (demo / testing without Whisper)
  const [inputText,     setInputText]     = useState('');
  const [analyzing,     setAnalyzing]     = useState(false);
  const [apiError,      setApiError]      = useState(null);

  const transcriptEndRef = useRef(null);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // ── Reset backend session when page mounts ───────────────────────────────
  useEffect(() => {
    const resetSession = async () => {
      try {
        const body = seedTopic
          ? JSON.stringify({ initial_context: seedTopic })
          : '{}';
        const res = await fetch(`${API_BASE}/api/session/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (res.ok) {
          setBackendReady(true);
          setApiError(null);
        } else {
          setApiError('Backend returned an error on session reset.');
        }
      } catch {
        setApiError('Cannot reach backend. Make sure the Flask server is running on port 5050.');
      }
    };
    resetSession();
  }, [seedTopic]);

  // ── Auto-scroll transcript ────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Analyse an utterance via the backend API ─────────────────────────────
  const analyzeUtterance = useCallback(async (text) => {
    if (!text.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/topic-shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: text.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setTopicStatus(data.topic_status);
      setTopicScore(data.similarity_score);
      setApiError(null);

      setTranscript(prev => [...prev, {
        text: text.trim(),
        topic_status:    data.topic_status,
        similarity_score: data.similarity_score,
        topic_shift:     data.topic_shift,
      }]);
    } catch (err) {
      setApiError(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    analyzeUtterance(inputText);
    setInputText('');
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Demo sentences for quick testing ─────────────────────────────────────
  const demoOnTopic = [
    'My final-year project is about an AI system that helps users improve their communication.',
    'We use Whisper to convert speech into text in real time.',
    'The system also analyzes speaking rate, pauses, and filler words.',
    'Sentence transformers generate embeddings for semantic similarity.',
  ];
  const demoOffTopic = [
    'I went shopping with my friends yesterday.',
    'The weather today is really nice outside.',
  ];

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
              Conversation in progress
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{fmt(seconds)}</h1>
        </div>
        <button className="btn btn-danger" style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={() => nav('/summary')}>
          ■ Stop
        </button>
      </div>

      {/* ── API error banner ─────────────────────────────────────────────── */}
      {apiError && (
        <div style={{
          background: '#fee2e2', border: '1.5px solid #fca5a5',
          borderRadius: 12, padding: '10px 16px', marginBottom: 16,
          fontSize: 13, color: 'var(--red)', fontWeight: 500,
        }}>
          ⚠ {apiError}
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {['conversation', 'live analysis'].map(t => (
          <button key={t}
            onClick={() => t === 'live analysis' ? nav('/analysis') : setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? 'var(--blue)' : '#888',
              boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
              textTransform: 'capitalize',
            }}>
            {t === 'conversation'
              ? <><MessageCircle size={13} style={{ marginRight: 5 }} />Conversation</>
              : <><BarChart2 size={13} style={{ marginRight: 5 }} />Live Analysis</>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div>
          {/* Topic status indicator (subtle, near transcript) */}
          <div style={{ marginBottom: 12 }}>
            <TopicIndicator
              status={topicStatus}
              score={topicScore}
              backendReady={backendReady}
            />
            {seedTopic && (
              <span style={{ marginLeft: 12, fontSize: 12, color: '#aaa' }}>
                Topic: <strong>{seedTopic}</strong>
              </span>
            )}
          </div>

          {/* Transcript */}
          <div className="card" style={{ marginBottom: 16, minHeight: 180, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Transcript
            </div>
            {transcript.length === 0 ? (
              <div style={{ fontSize: 14, color: '#aaa', fontStyle: 'italic', padding: '12px 0' }}>
                Start speaking or type an utterance below to begin…
              </div>
            ) : (
              transcript.map((e, i) => <UtteranceRow key={i} entry={e} />)
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Utterance input (manual / Whisper output feeds here) */}
          <form className="card" style={{ padding: '12px 14px', marginBottom: 16 }} onSubmit={handleSubmit}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Type utterance (Whisper output / manual test)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Enter transcribed utterance…"
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

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <div className="waveform">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="wave-bar" style={{ height: running ? undefined : 8 }} />
              ))}
            </div>
            <button
              className="btn btn-ghost"
              style={{ width: 64, height: 64, borderRadius: '50%', padding: 0, background: 'var(--blue)', color: '#fff' }}
              onClick={() => setRunning(p => !p)}>
              {running ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" />}
            </button>
            <button
              className="btn btn-danger"
              style={{ width: 56, height: 56, borderRadius: '50%', padding: 0 }}
              onClick={() => nav('/summary')}>
              <Square size={20} fill="var(--red)" />
            </button>
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick test sentences */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🧪 Quick Test
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>On-topic examples</div>
            {demoOnTopic.map((s, i) => (
              <div key={i}
                onClick={() => analyzeUtterance(s)}
                style={{
                  padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--blue-light)', color: 'var(--blue)',
                  fontSize: 12, marginBottom: 5, lineHeight: 1.4,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {s.length > 60 ? s.slice(0, 60) + '…' : s}
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#aaa', margin: '8px 0 6px' }}>Off-topic examples</div>
            {demoOffTopic.map((s, i) => (
              <div key={i}
                onClick={() => analyzeUtterance(s)}
                style={{
                  padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
                  background: '#fee2e2', color: 'var(--red)',
                  fontSize: 12, marginBottom: 5, lineHeight: 1.4,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {s}
              </div>
            ))}
          </div>

          {/* Live Metrics */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live Metrics
            </div>
            {[
              { label: 'Utterances', value: transcript.length },
              { label: 'Topic shifts', value: transcript.filter(t => t.topic_shift).length },
              { label: 'On-topic', value: transcript.filter(t => t.topic_status === 'on_topic').length },
              { label: 'Off-topic', value: transcript.filter(t => t.topic_status === 'off_topic').length },
              { label: 'Skipped', value: transcript.filter(t => t.topic_status === 'skipped').length },
            ].map(m => (
              <div className="metric-row" key={m.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Backend status */}
          <div className="card card-sm" style={{ background: backendReady ? '#e8f5e8' : '#fff3e0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: backendReady ? 'var(--green)' : 'var(--orange)' }}>
              {backendReady ? '🟢 Backend connected' : '🟡 Connecting to backend…'}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              all-MiniLM-L6-v2 · port 5050
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
