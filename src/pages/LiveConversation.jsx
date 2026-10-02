import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, Pause, Play, MessageCircle, BarChart2 } from 'lucide-react';

const sampleTranscript = [
  "I think working in a team is very important because it helps us share ideas and",
  "build on each other's strengths. When we collaborate effectively, we can...",
  "solve complex problems much faster than working alone.",
];

const suggestions = [
  'solve problems together',
  'different perspectives',
  'learn from each other',
];

export default function LiveConversation() {
  const nav = useNavigate();
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(135);
  const [topicStatus, setTopicStatus] = useState('on-topic');
  const [tab, setTab] = useState('conversation');

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Conversation in progress</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{fmt(seconds)}</h1>
        </div>
        <button
          className="btn btn-danger"
          style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={() => nav('/summary')}
        >
          ■ Stop
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {['conversation', 'live analysis'].map(t => (
          <button
            key={t}
            onClick={() => t === 'live analysis' ? nav('/analysis') : setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? 'var(--blue)' : '#888',
              boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
              textTransform: 'capitalize',
            }}
          >
            {t === 'conversation' ? <><MessageCircle size={13} style={{ marginRight: 5 }} />Conversation</> : <><BarChart2 size={13} style={{ marginRight: 5 }} />Live Analysis</>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* Main */}
        <div>
          {/* Transcript */}
          <div className="card" style={{ marginBottom: 20, minHeight: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Transcript</div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: '#2d2d2d' }}>
              {sampleTranscript.map((line, i) => (
                <span key={i}>{line} </span>
              ))}
              <span style={{ display: 'inline-block', width: 8, height: 16, background: 'var(--blue)', borderRadius: 2, animation: 'pulse 1s infinite', verticalAlign: 'middle', marginLeft: 2 }} />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            {/* Waveform */}
            <div className="waveform">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="wave-bar" style={{ height: running ? undefined : 8 }} />
              ))}
            </div>

            <button
              className="btn btn-ghost"
              style={{ width: 64, height: 64, borderRadius: '50%', padding: 0, background: 'var(--blue)', color: '#fff' }}
              onClick={() => setRunning(p => !p)}
            >
              {running ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" />}
            </button>

            <button
              className="btn btn-danger"
              style={{ width: 56, height: 56, borderRadius: '50%', padding: 0 }}
              onClick={() => nav('/summary')}
            >
              <Square size={20} fill="var(--red)" />
            </button>
          </div>

          {/* Topic status */}
          <div className="card card-sm" style={{ background: topicStatus === 'on-topic' ? '#e8f5e8' : '#fff3e0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: topicStatus === 'on-topic' ? 'var(--green)' : 'var(--orange)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Topic Status</span>
              <span style={{ fontSize: 13, color: topicStatus === 'on-topic' ? 'var(--green)' : 'var(--orange)' }}>
                {topicStatus === 'on-topic' ? '✓ On topic' : '⚠ Topic shift detected'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: suggestions */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>💡 Live Suggestions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map(s => (
                <div key={s} className="chip" style={{ display: 'block', textAlign: 'center', padding: '10px 14px', borderRadius: 14 }}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Mini metrics */}
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Metrics</div>
            {[
              { label: 'Speaking Rate', value: '112 wpm' },
              { label: 'Filler Rate', value: '4.8%' },
              { label: 'Pauses', value: '3' },
            ].map(m => (
              <div className="metric-row" key={m.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
