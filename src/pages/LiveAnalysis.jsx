import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const tabs = ['Speech', 'Topic', 'Body', 'Sensors'];

function MiniBarChart({ value, max, color }) {
  // Show a 6-bar mini chart where the last bar = current value
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const heights = [0.3, 0.5, 0.4, 0.6, 0.7, pct];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 6, borderRadius: 3,
          height: `${Math.max(h * 100, 8)}%`,
          background: color,
          opacity: i === heights.length - 1 ? 1 : 0.4 + i * 0.1,
        }} />
      ))}
    </div>
  );
}

export default function LiveAnalysis() {
  const nav = useNavigate();
  const { state } = useLocation();

  // Real metrics passed from LiveConversation via nav state
  const m         = state?.metrics   || null;
  const topicShift = state?.topicStatus === 'off_topic';
  const transcript = state?.transcript || [];

  // Compute overall score from real metrics
  const computeScore = () => {
    if (!m) return null;
    const scores = [];
    // Speaking rate: 120–160 wpm is ideal
    if (m.speaking_rate_wpm > 0) {
      const rateScore = Math.max(0, 100 - Math.abs(m.speaking_rate_wpm - 140) * 0.5);
      scores.push(Math.min(100, rateScore));
    }
    // Filler rate: 0% = 100, 10% = 0
    if (m.filler_rate_pct != null) scores.push(Math.max(0, 100 - m.filler_rate_pct * 10));
    // Topic relevance: 0–1 → 0–100
    if (m.topic_relevance != null) scores.push(m.topic_relevance * 100);
    // Coherence: 0–1 → 0–100
    if (m.avg_coherence != null) scores.push(m.avg_coherence * 100);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
  };

  const overallScore = computeScore();

  const speechMetrics = m ? [
    {
      label: 'Speaking Rate',
      value: `${m.speaking_rate_wpm} wpm`,
      raw: m.speaking_rate_wpm,
      max: 200,
      color: '#4a7fe5',
    },
    {
      label: 'Filler Rate',
      value: `${m.filler_rate_pct} %`,
      raw: m.filler_rate_pct,
      max: 20,
      color: '#f0a040',
    },
    {
      label: 'Pause Frequency',
      value: `${m.total_pauses} pauses`,
      raw: m.total_pauses,
      max: 20,
      color: '#e05555',
    },
    {
      label: 'Topic Relevance',
      value: m.topic_relevance != null ? m.topic_relevance.toFixed(2) : '—',
      raw: m.topic_relevance != null ? m.topic_relevance : 0,
      max: 1,
      color: '#27ae60',
    },
    {
      label: 'Semantic Coherence',
      value: m.avg_coherence != null ? m.avg_coherence.toFixed(2) : '—',
      raw: m.avg_coherence != null ? m.avg_coherence : 0,
      max: 1,
      color: '#6c63ff',
    },
  ] : [
    { label: 'Speaking Rate',     value: '—', raw: 0, max: 200, color: '#4a7fe5' },
    { label: 'Filler Rate',       value: '—', raw: 0, max: 20,  color: '#f0a040' },
    { label: 'Pause Frequency',   value: '—', raw: 0, max: 20,  color: '#e05555' },
    { label: 'Topic Relevance',   value: '—', raw: 0, max: 1,   color: '#27ae60' },
    { label: 'Semantic Coherence',value: '—', raw: 0, max: 1,   color: '#6c63ff' },
  ];

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Live Analysis Panel</h1>
        <button className="btn btn-danger" onClick={() => nav('/dashboard')}>■ Stop & See Summary</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {tabs.map((t, i) => (
          <button key={t} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: i === 0 ? '#fff' : 'transparent',
            color: i === 0 ? 'var(--blue)' : '#888',
            boxShadow: i === 0 ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Metrics */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            Speech Metrics (Live)
            {!m && <span style={{ marginLeft: 10, fontSize: 12, color: '#aaa', fontWeight: 400 }}>
              — start speaking to see real values
            </span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {speechMetrics.map(metric => (
              <div key={metric.label} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: metric.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: metric.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>{metric.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: metric.color }}>{metric.value}</div>
                </div>
                <MiniBarChart value={metric.raw} max={metric.max} color={metric.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Topic shift alert */}
          {topicShift && (
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
          )}

          {/* Live score */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>LIVE SCORE</div>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="100" height="100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#ddd0be" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="#4a7fe5" strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 42 * ((overallScore || 0) / 100)} ${2 * Math.PI * 42}`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{overallScore ?? '—'}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>/100</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginTop: 8 }}>
              {overallScore != null
                ? overallScore >= 70 ? 'Good Progress!' : overallScore >= 50 ? 'Keep Going' : 'Needs Work'
                : 'Waiting…'}
            </div>
          </div>

          {/* Session stats */}
          <div className="card card-sm">
            {[
              { label: 'Duration',      value: m ? fmt(m.total_duration_sec) : '—' },
              { label: 'Words spoken',  value: m ? m.total_words : '—' },
              { label: 'Filler words',  value: m ? m.total_fillers : '—' },
              { label: 'Long pauses',   value: m ? m.total_long_pauses : '—' },
              { label: 'Utterances',    value: transcript.length || '—' },
            ].map(s => (
              <div className="metric-row" key={s.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
