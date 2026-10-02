import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const tabs = ['Speech', 'Topic', 'Body', 'Sensors'];

const speechMetrics = [
  { label: 'Speaking Rate', value: '112 wpm', bars: [3, 4, 3, 5, 4, 5], color: '#4a7fe5' },
  { label: 'Filler Rate', value: '4.8 %', bars: [2, 3, 4, 3, 2, 3], color: '#f0a040' },
  { label: 'Pause Frequency', value: '3 pauses', bars: [1, 2, 1, 3, 2, 1], color: '#e05555' },
  { label: 'Topic Relevance', value: '0.82', bars: [4, 5, 4, 5, 4, 5], color: '#5cb85c' },
  { label: 'Semantic Coherence', value: '0.76', bars: [3, 4, 3, 4, 4, 3], color: '#6c63ff' },
];

function MiniBarChart({ bars, color }) {
  const max = Math.max(...bars);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            width: 6, borderRadius: 3,
            height: `${(b / max) * 100}%`,
            background: color, opacity: 0.7 + i * 0.05,
          }}
        />
      ))}
    </div>
  );
}

export default function LiveAnalysis() {
  const nav = useNavigate();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Live Analysis Panel</h1>
        <button className="btn btn-danger" onClick={() => nav('/summary')}>■ Stop & See Summary</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#ece6d8', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {tabs.map((t, i) => (
          <button
            key={t}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: i === 0 ? '#fff' : 'transparent',
              color: i === 0 ? 'var(--blue)' : '#888',
              boxShadow: i === 0 ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Metrics */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Speech Metrics (Live)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {speechMetrics.map(m => (
              <div
                key={m.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0', borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: m.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: m.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
                <MiniBarChart bars={m.bars} color={m.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Topic shift alert */}
          <div className="card" style={{ background: '#fff8e1', border: '1.5px solid #ffe082' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>Topic Shift Alert</div>
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
                  You seem to be moving to a different topic. Try to stay focused on the current discussion.
                </div>
              </div>
            </div>
          </div>

          {/* Real-time score */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>LIVE SCORE</div>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="100" height="100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#ece6d8" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="#4a7fe5" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 42 * 0.74} ${2 * Math.PI * 42}`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>74</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>/100</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginTop: 8 }}>Good Progress!</div>
          </div>

          {/* Session info */}
          <div className="card card-sm">
            {[
              { label: 'Duration', value: '2:15' },
              { label: 'Words spoken', value: '248' },
              { label: 'Filler words', value: '12' },
              { label: 'Long pauses', value: '3' },
            ].map(m => (
              <div className="metric-row" key={m.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{m.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
