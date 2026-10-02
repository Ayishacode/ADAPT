import { useNavigate } from 'react-router-dom';
import { MessageCircle, CheckSquare, TrendingUp, Cpu, Bell } from 'lucide-react';

const quickActions = [
  { icon: '💬', label: 'Start\nConversation', to: '/conversation', color: '#e8f0fd' },
  { icon: '📋', label: 'View\nTasks', to: '/tasks', color: '#e8f5e8' },
  { icon: '📈', label: 'Progress', to: '/progress', color: '#fff3e0' },
  { icon: '🔌', label: 'Sensors', to: '/sensors', color: '#fce4ec' },
];

const recentMetrics = [
  { label: 'Speaking Rate', value: '108 wpm', change: '+4', pos: true },
  { label: 'Filler Rate', value: '4.2%', change: '-0.6%', pos: true },
  { label: 'Topic Relevance', value: '0.84', change: '+0.02', pos: true },
  { label: 'Overall Score', value: '79/100', change: '+3', pos: true },
];

export default function Dashboard() {
  const nav = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{greeting}, Ayisha 👋</h1>
          <p style={{ color: '#888', marginTop: 4, fontSize: 14 }}>
            Let's stay productive and build better conversations today.
          </p>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(135deg, #4a7fe5,#6c63ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 18, cursor: 'pointer',
        }}>A</div>
      </div>

      {/* Today's Focus */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,#4a7fe5,#6c63ff)', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Today's Focus</div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Communicate clearly and track your progress.</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>2 tasks pending</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>Last score: 79</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="section-header">
        <h2>Quick Actions</h2>
      </div>
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {quickActions.map(a => (
          <div
            key={a.label}
            className="card"
            style={{ cursor: 'pointer', textAlign: 'center', background: a.color, transition: 'transform 0.18s' }}
            onClick={() => nav(a.to)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{a.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Metrics + Notifications */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Recent Performance</h3>
          {recentMetrics.map(m => (
            <div className="metric-row" key={m.label}>
              <span style={{ fontSize: 13, color: '#555' }}>{m.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.value}</span>
                <span style={{ fontSize: 12, color: m.pos ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{m.change}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Notifications</h3>
          {[
            { icon: '🎯', text: 'New task recommended based on your progress', time: '2m ago' },
            { icon: '📊', text: 'Weekly progress report is ready', time: '1h ago' },
            { icon: '🔌', text: 'Sensor device connected successfully', time: '3h ago' },
          ].map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.text}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start button */}
      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 48px' }} onClick={() => nav('/conversation')}>
          Start Conversation
        </button>
      </div>
    </div>
  );
}
