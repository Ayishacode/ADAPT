import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, MessageCircle, BarChart2, Send, Mic, MicOff } from 'lucide-react';

const API_BASE         = 'http://localhost:5050';
const SR_SUPPORTED     = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
const SpeechRecAPI     = window.SpeechRecognition || window.webkitSpeechRecognition;
const NUM_BARS         = 14;

// ── Utterance row ────────────────────────────────────────────────────────────
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
            {entry.topic_shift && <span style={{ marginLeft: 8, color: '#e74c3c', fontWeight: 700 }}> ⚠ topic shift</span>}
          </div>
        )}
        {skipped && (
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>too short — skipped</div>
        )}
      </div>
    </div>
  );
}

// ── Topic status pill ────────────────────────────────────────────────────────
function TopicIndicator({ status, score, backendReady }) {
  const onTopic = status === 'on_topic' || status === 'initializing';
  const skipped = status === 'skipped';
  const colour  = !backendReady ? '#aaa'
    : skipped   ? '#aaa'
    : onTopic   ? '#27ae60'
    : '#e74c3c';
  const bg      = !backendReady ? '#f0ece4'
    : skipped   ? '#f0ece4'
    : onTopic   ? '#e8f5e8'
    : '#fee2e2';
  const label   = !backendReady ? 'Connecting…'
    : skipped   ? 'Short — skipped'
    : onTopic   ? 'On topic'
    : 'Possible topic shift';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 20, padding: '7px 16px',
      transition: 'background 0.4s',
    }}>
      <div style={{
        width: 11, height: 11, borderRadius: '50%',
        background: colour, transition: 'background 0.4s',
        boxShadow: backendReady && !skipped ? `0 0 8px ${colour}cc` : 'none',
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: colour }}>
        {label}
      </span>
      {score != null && backendReady && !skipped && (
        <span style={{ fontSize: 11, color: '#aaa' }}>({score.toFixed(2)})</span>
      )}
    </div>
  );
}

// ── Real volume waveform ─────────────────────────────────────────────────────
function VolumeWaveform({ micActive, streamRef, streamReady }) {
  const [bars, setBars]    = useState(Array(NUM_BARS).fill(4));
  const ctxRef             = useRef(null);
  const rafRef             = useRef(null);

  useEffect(() => {
    if (!micActive || !streamReady || !streamRef.current) {
      cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
      setBars(Array(NUM_BARS).fill(4));
      return;
    }
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const src      = ctx.createMediaStreamSource(streamRef.current);
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
      return () => {
        cancelAnimationFrame(rafRef.current);
        ctx.close();
        ctxRef.current = null;
      };
    } catch { /* no AudioContext */ }
  }, [micActive, streamReady, streamRef]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 48 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 5, height: h, borderRadius: 3,
          background: micActive ? 'var(--blue)' : '#ccc',
          transition: micActive ? 'height 0.06s' : 'height 0.4s, background 0.3s',
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
  const [streamReady,  setStreamReady]  = useState(false);
  const [interim,      setInterim]      = useState('');
  const [micError,     setMicError]     = useState(null);
  const [topicStatus,  setTopicStatus]  = useState('initializing');
  const [topicScore,   setTopicScore]   = useState(null);
  const [backendReady, setBackendReady] = useState(false);
  const [transcript,   setTranscript]   = useState([]);
  const [apiError,     setApiError]     = useState(null);
  const [inputText,    setInputText]    = useState('');

  const srRef          = useRef(null);
  const streamRef      = useRef(null);
  const shouldRunRef   = useRef(false);
  // Queue: array of strings waiting to be analysed
  const queueRef       = useRef([]);
  const processingRef  = useRef(false);
  const lastInterimRef = useRef('');
  const bottomRef      = useRef(null);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Backend reset ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/session/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
      .then(r => r.ok ? setBackendReady(true) : setApiError('Backend error.'))
      .catch(() => setApiError('Cannot reach backend on port 5050. Is the Flask server running?'));
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interim]);

  // ── Queue processor ───────────────────────────────────────────────────────
  // Processes one utterance at a time; drains the queue after each response.
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const text = queueRef.current.shift();
      if (!text) continue;
      try {
        const res  = await fetch(`${API_BASE}/api/topic-shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ utterance: text }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTopicStatus(data.topic_status);
        setTopicScore(data.similarity_score);
        setApiError(null);
        setTranscript(prev => [...prev, {
          text,
          topic_status:     data.topic_status,
          similarity_score: data.similarity_score,
          topic_shift:      data.topic_shift,
        }]);
      } catch (err) {
        setApiError(`Analysis error: ${err.message}`);
      }
    }
    processingRef.current = false;
  }, []);

  const enqueue = useCallback((text) => {
    const clean = text.trim();
    if (!clean) return;
    queueRef.current.push(clean);
    processQueue();
  }, [processQueue]);

  // ── Speech recognition ────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    if (!SR_SUPPORTED) {
      setMicError('SpeechRecognition not supported. Use Chrome or Edge, or type below.');
      return;
    }
    if (srRef.current) return;
    shouldRunRef.current = true;

    // SpeechRecognition manages its own mic — visualizer stream attached separately after SR starts
    const sr = new SpeechRecAPI();
    sr.continuous     = true;
    sr.interimResults = true;
    sr.lang           = 'en-US';

    sr.onstart = () => { setMicActive(true); setRunning(true); setMicError(null); };

    sr.onresult = (event) => {
      let interimBuf = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) { enqueue(t); lastInterimRef.current = ''; }
          setInterim('');
        } else {
          interimBuf += r[0].transcript;
        }
      }
      if (interimBuf) {
        setInterim(interimBuf);
        // Send long interim chunks immediately (handles phone audio bursts)
        const words = interimBuf.trim().split(/\s+/).length;
        if (words >= 5 && interimBuf.trim() !== lastInterimRef.current) {
          lastInterimRef.current = interimBuf.trim();
          enqueue(interimBuf.trim());
        }
      }
    };

    sr.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        setMicError('Microphone blocked. Allow mic in browser permissions and reload.');
        shouldRunRef.current = false;
      } else {
        setMicError(`Mic error: ${e.error}`);
      }
    };

    sr.onend = () => {
      if (shouldRunRef.current) {
        // Brief delay then restart to avoid rapid-fire restarts
        setTimeout(() => {
          if (shouldRunRef.current && srRef.current) {
            try { srRef.current.start(); } catch { /* already starting */ }
          }
        }, 200);
      } else {
        setMicActive(false);
        setRunning(false);
      }
    };

    srRef.current = sr;
    try {
      sr.start();
      // Attach visualizer stream slightly after SR has started
      // so SR gets priority on the mic
      setTimeout(async () => {
        if (shouldRunRef.current && !streamRef.current) {
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStreamReady(true);
          } catch { /* visualizer optional */ }
        }
      }, 500);
    } catch (e) { setMicError(`Cannot start mic: ${e.message}`); }
  }, [enqueue]);

  const stopMic = useCallback(() => {
    shouldRunRef.current = false;
    if (srRef.current) { srRef.current.stop(); srRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setMicActive(false);
    setInterim('');
    setRunning(false);
    setStreamReady(false);
  }, []);

  useEffect(() => () => stopMic(), [stopMic]);

  const handleStop = () => { stopMic(); nav('/dashboard'); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    enqueue(inputText);
    setInputText('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {micActive && <div className="pulse-dot" />}
            <span style={{ fontSize: 13, fontWeight: 600, color: micActive ? 'var(--red)' : '#888' }}>
              {micActive ? 'Listening…' : 'Ready to start'}
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{fmt(seconds)}</h1>
        </div>
        <button
          className="btn btn-danger"
          style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={handleStop}
        >
          ■ Stop
        </button>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {(apiError || micError) && (
        <div style={{
          background: '#fee2e2', border: '1.5px solid #fca5a5',
          borderRadius: 12, padding: '10px 16px', marginBottom: 14,
          fontSize: 13, color: 'var(--red)', fontWeight: 500,
        }}>
          ⚠ {micError || apiError}
        </div>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 18 }}>
        {[
          { label: 'Conversation', icon: <MessageCircle size={13} /> },
          { label: 'Live Analysis', icon: <BarChart2 size={13} /> },
        ].map((t, i) => (
          <button key={t.label}
            onClick={() => i === 1 ? nav('/analysis') : null}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: i === 0 ? '#fff' : 'transparent',
              color:      i === 0 ? 'var(--blue)' : '#888',
              boxShadow:  i === 0 ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 24 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Topic indicator */}
          <TopicIndicator status={topicStatus} score={topicScore} backendReady={backendReady} />

          {/* ── Transcript box ─────────────────────────────────────────── */}
          <div className="card" style={{
            flex: 1, minHeight: 260, maxHeight: 420,
            overflowY: 'auto', padding: '16px 18px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#aaa',
              marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Live Transcript
            </div>

            {/* Empty state */}
            {transcript.length === 0 && !interim && (
              <div style={{
                fontSize: 15, color: '#ccc', fontStyle: 'italic',
                textAlign: 'center', padding: '40px 0',
              }}>
                {micActive ? 'Speak now…' : 'Press the mic button below to start'}
              </div>
            )}

            {/* Committed utterances */}
            {transcript.map((e, i) => <UtteranceRow key={i} entry={e} />)}

            {/* Live interim — shown in real time as you speak */}
            {interim && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 0',
                borderTop: transcript.length ? '1px dashed #e2d5c0' : 'none',
                marginTop: transcript.length ? 4 : 0,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#4a8eff', marginTop: 6, flexShrink: 0,
                  animation: 'pulse 1s infinite',
                }} />
                <div style={{ fontSize: 15, color: '#888', fontStyle: 'italic', lineHeight: 1.65 }}>
                  {interim}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Mic controls ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
            <VolumeWaveform micActive={micActive} streamRef={streamRef} streamReady={streamReady} />

            {/* Mic toggle */}
            <button
              onClick={() => micActive ? stopMic() : startMic()}
              title={micActive ? 'Stop recording' : 'Start recording'}
              style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: micActive
                  ? 'linear-gradient(135deg,#e05555,#c0392b)'
                  : 'linear-gradient(135deg,#4a8eff,#6c63ff)',
                color: '#fff',
                boxShadow: micActive
                  ? '0 0 0 8px rgba(224,85,85,0.18), 0 4px 20px rgba(224,85,85,0.4)'
                  : '0 4px 20px rgba(74,142,255,0.35)',
                transition: 'all 0.25s',
              }}>
              {micActive ? <MicOff size={28} /> : <Mic size={28} />}
            </button>

            {/* End session */}
            <button onClick={handleStop} title="End session"
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none',
                cursor: 'pointer', background: '#fee2e2', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Square size={18} fill="var(--red)" color="var(--red)" />
            </button>
          </div>

          {/* Hint */}
          <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa' }}>
            {!SR_SUPPORTED
              ? '⚠ Speech not supported — type below'
              : micActive
              ? 'Recording · bars reflect mic volume · tap mic to stop'
              : 'Tap the mic to start · bars will move when sound is detected'}
          </div>

          {/* Manual / fallback input */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Or type an utterance manually…"
                disabled={!backendReady}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary"
                disabled={!backendReady || !inputText.trim()}
                style={{ padding: '10px 16px', flexShrink: 0 }}>
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Right column */}
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
              <div key={i} onClick={() => enqueue(s)}
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: 'var(--blue-light)', color: 'var(--blue)', fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}
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
              <div key={i} onClick={() => enqueue(s)}
                style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: '#fee2e2', color: 'var(--red)', fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {s}
              </div>
            ))}
          </div>

          {/* Backend status */}
          <div className="card card-sm" style={{ background: backendReady ? '#e8f5e8' : '#fff3e0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: backendReady ? '#27ae60' : 'var(--orange)' }}>
              {backendReady ? '🟢 Backend connected' : '🟡 Connecting…'}
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
