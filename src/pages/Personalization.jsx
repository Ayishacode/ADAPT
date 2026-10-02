import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const focusAreas = [
  { area: 'Reduce filler words', color: 'var(--orange)', icon: '⚠️' },
  { area: 'Handle long pauses', color: 'var(--red)', icon: '⏸️' },
  { area: 'Improve semantic coherence', color: 'var(--blue)', icon: '🔗' },
];

const taskHistory = [
  { task: 'Interview Discussion', difficulty: 'Medium', score: 82 },
  { task: 'Team Meeting', difficulty: 'Easy', score: 74 },
  { task: 'Presentation Practice', difficulty: 'Hard', score: 69 },
];

const weakAreaData = [
  { metric: 'Filler', score: 68 },
  { metric: 'Pauses', score: 72 },
  { metric: 'Coherence', score: 74 },
  { metric: 'Rate', score: 78 },
  { metric: 'Topic', score: 84 },
];

const difficultyColor = d => d === 'Easy' ? 'badge-green' : d === 'Medium' ? 'badge-orange' : 'badge-red';

export default function Personalization() {
  const nav = useNavigate();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Recommended for You</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Based on your recent performance · ML-powered</p>
        </div>
        <div style={{
          width: 50, height: 50, borderRadius: 16,
          background: 'linear-gradient(135deg,#4a7fe5,#6c63ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 14px rgba(74,127,229,0.3)',
        }}>A</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        <div>
          {/* Next suggested task */}
          <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #f5f0e8, #e8f0fd)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>⭐ Next Suggested Task</div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 16, background: 'linear-gradient(135deg,#e8f0fd,#f0eaff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, flexShrink: 0,
              }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Topic Discussion</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span className="badge badge-orange">Difficulty: Medium</span>
                </div>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                  This task will help you improve topic maintenance and coherence — your two weakest areas this month.
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16, width: '100%', fontSize: 15, padding: '13px' }}
              onClick={() => nav('/conversation')}
            >
              Start Task →
            </button>
          </div>

          {/* Weak area chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Performance by Area</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weakAreaData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="metric" tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="score" fill="#4a7fe5" radius={[0, 6, 6, 0]} background={{ fill: '#ddd0be', radius: [0, 6, 6, 0] }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Task history */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Task History</h3>
            {taskHistory.map(t => (
              <div key={t.task} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.task}</div>
                </div>
                <span className={`badge ${difficultyColor(t.difficulty)}`}>{t.difficulty}</span>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `conic-gradient(#4a7fe5 ${t.score}%, #ddd0be ${t.score}%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 28, height: 28, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{t.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Profile */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'linear-gradient(135deg,#4a7fe5,#6c63ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#fff', margin: '0 auto 10px', fontWeight: 700,
            }}>A</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Ayisha</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Communication Level: Intermediate</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
              <span className="badge badge-blue">8 sessions</span>
              <span className="badge badge-green">Score: 79 avg</span>
            </div>
          </div>

          {/* Focus areas */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Focus Areas</h3>
            {focusAreas.map(a => (
              <div key={a.area} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: a.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{a.icon}</div>
                <span style={{ fontSize: 13, fontWeight: 500, color: a.color }}>{a.area}</span>
              </div>
            ))}
          </div>

          {/* ML model info */}
          <div className="card" style={{ background: 'var(--blue-light)', border: '1.5px solid #c0d4f8' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🤖 Personalization Engine</div>
            <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              Uses <strong>Random Forest/XGBoost</strong> to recommend next tasks and difficulty levels based on your past performance profile.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => nav('/progress')}>
            📈 View Full Progress
          </button>
        </div>
      </div>
    </div>
  );
}
