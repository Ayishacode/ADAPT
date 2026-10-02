import { useNavigate } from 'react-router-dom';

const metrics = [
  { label: 'Fluency', value: 85, color: '#4a7fe5' },
  { label: 'Filler Rate', value: 78, color: '#f0a040' },
  { label: 'Pause Handling', value: 80, color: '#6c63ff' },
  { label: 'Speaking Rate', value: 76, color: '#5cb85c' },
  { label: 'Topic Relevance', value: 84, color: '#e05555' },
  { label: 'Semantic Coherence', value: 82, color: '#00bcd4' },
];

export default function PostSession() {
  const nav = useNavigate();
  const overall = 82;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 4 }}>
            📊 Session Summary · 12 May 2026, 10:00 AM
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Post-Session Summary</h1>
        </div>
        <button className="btn btn-ghost">≡ Export</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Left */}
        <div>
          {/* Score */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 20 }}>
            {/* Ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="130" height="130">
                <circle cx="65" cy="65" r="54" fill="none" stroke="#ece6d8" strokeWidth="12" />
                <circle
                  cx="65" cy="65" r="54" fill="none" stroke="#4a7fe5" strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54 * (overall / 100)} ${2 * Math.PI * 54}`}
                  strokeLinecap="round"
                  transform="rotate(-90 65 65)"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{overall}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>/100</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Good Communication!</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
                You performed well in this session. Focus on reducing filler words and improving speaking rate for next time.
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <span className="badge badge-green">↑ +3 from last</span>
                <span className="badge badge-blue">Interview Discussion</span>
              </div>
            </div>
          </div>

          {/* Metric bars */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Performance Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {metrics.map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${m.value}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Feedback */}
          <div className="card" style={{ background: '#fffbe6', border: '1.5px solid #ffe082' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💡 Feedback</div>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              You maintained the topic well — try to reduce filler words and long pauses. Your semantic coherence is strong.
            </p>
          </div>

          {/* Key stats */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Session Stats</h3>
            {[
              { label: 'Duration', value: '3:42' },
              { label: 'Words spoken', value: '412' },
              { label: 'Filler words', value: '18' },
              { label: 'Avg speaking rate', value: '110 wpm' },
              { label: 'Long pauses', value: '4' },
              { label: 'Topic shifts detected', value: '1' },
            ].map(s => (
              <div className="metric-row" key={s.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => nav('/progress')}>
              📈 View Progress
            </button>
            <button className="btn btn-ghost" onClick={() => nav('/profile')}>
              🎯 Get Next Task
            </button>
            <button className="btn btn-ghost" onClick={() => nav('/tasks')}>
              📋 Check Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
