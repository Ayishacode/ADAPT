import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ChevronLeft } from 'lucide-react';

const weeks = ['W1', 'W2', 'W3', 'W4'];

const commScoreData = weeks.map((w, i) => ({ week: w, score: [62, 69, 74, 82][i] }));

const metricData = weeks.map((w, i) => ({
  week: w,
  speaking: [95, 102, 108, 112][i],
  filler: [7.2, 6.1, 5.0, 4.8][i],
  pauses: [6, 5, 4, 3][i],
  topic: [0.70, 0.75, 0.80, 0.84][i],
  coherence: [0.65, 0.70, 0.74, 0.76][i],
}));

const metricOptions = ['Speaking Rate', 'Filler Rate', 'Pauses', 'Topic Relevance', 'Coherence'];
const metricKeys = ['speaking', 'filler', 'pauses', 'topic', 'coherence'];
const metricColors = ['#4a7fe5', '#f0a040', '#e05555', '#5cb85c', '#6c63ff'];

const bigTabs = ['Communication', 'Topic', 'Body', 'Sensors'];
const ranges = ['Last 4 Weeks', 'Last Month', 'All Time'];

export default function Progress() {
  const [bigTab, setBigTab] = useState('Communication');
  const [range, setRange] = useState('Last 4 Weeks');
  const [metricIdx, setMetricIdx] = useState(0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Your Progress</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Track your communication improvement over time.</p>
        </div>
        <select className="select" value={range} onChange={e => setRange(e.target.value)}>
          {ranges.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Big category tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#ece6d8', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {bigTabs.map(t => (
          <button
            key={t}
            onClick={() => setBigTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: bigTab === t ? '#fff' : 'transparent',
              color: bigTab === t ? 'var(--blue)' : '#888',
              boxShadow: bigTab === t ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div>
          {/* Communication score trend */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Communication Score</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={commScoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="score" stroke="#4a7fe5" strokeWidth={3} dot={{ r: 6, fill: '#4a7fe5' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Metric trend */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Metric Trends</h3>
              <select className="select" value={metricOptions[metricIdx]} onChange={e => setMetricIdx(metricOptions.indexOf(e.target.value))}>
                {metricOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={metricData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey={metricKeys[metricIdx]} fill={metricColors[metricIdx]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary stats */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>This Month</h3>
            {[
              { label: 'Sessions completed', value: '8' },
              { label: 'Best score', value: '82' },
              { label: 'Avg speaking rate', value: '108 wpm' },
              { label: 'Avg filler rate', value: '5.5%' },
              { label: 'Topics tracked', value: '12' },
              { label: 'Tasks generated', value: '5' },
            ].map(s => (
              <div className="metric-row" key={s.label}>
                <span style={{ fontSize: 12, color: '#666' }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Improvement areas */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Improvement Areas</h3>
            {[
              { area: 'Reduce filler words', color: 'var(--orange)', icon: '⚠️' },
              { area: 'Handle long pauses', color: 'var(--red)', icon: '⏸️' },
              { area: 'Improve semantic coherence', color: 'var(--blue)', icon: '🔗' },
            ].map(a => (
              <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{a.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: a.color }}>{a.area}</span>
              </div>
            ))}
          </div>

          {/* Task history */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent Sessions</h3>
            {[
              { topic: 'Interview Discussion', score: 82, date: '12 May' },
              { topic: 'Team Meeting', score: 74, date: '10 May' },
              { topic: 'Casual Chat', score: 69, date: '8 May' },
            ].map(s => (
              <div key={s.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.topic}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{s.date}</div>
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `conic-gradient(#4a7fe5 ${s.score}%, #ece6d8 ${s.score}%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 26, height: 26, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{s.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
