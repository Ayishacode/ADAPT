import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Settings, Mic, Video, CheckCircle2, Info } from 'lucide-react';

const features = [
  {
    id: 'self_summary', icon: '📋', title: 'Self Summarization',
    desc: 'Generate a brief summary of your conversation.',
  },
  {
    id: 'other_summary', icon: '✏️', title: 'Other Summarization',
    desc: 'Identify key points and action items.',
  },
  {
    id: 'word_suggest', icon: '💡', title: 'Word Suggestion',
    desc: 'Provide contextual word/phrase suggestions.',
  },
  {
    id: 'offtopic', icon: '🌀', title: 'Off-topic Detection',
    desc: 'Detect when the conversation moves to a different topic.',
  },
  {
    id: 'popup', icon: '🔔', title: 'Pop-up Animation',
    desc: 'Show real-time feedback and alerts during conversation.',
  },
];

const topics = ['Interview Discussion', 'Team Meeting', 'Casual Chat', 'Presentation', 'Task Planning'];

export default function NewConversation() {
  const nav = useNavigate();
  const [enabled, setEnabled] = useState({ self_summary: true, other_summary: true, word_suggest: true, offtopic: true, popup: true });
  const [topic, setTopic] = useState('Interview Discussion');
  const [showTopics, setShowTopics] = useState(false);
  const [mic, setMic] = useState('Default – Microphone (Realtek)');
  const [cam, setCam] = useState('Default – Integrated Camera');

  const toggle = id => setEnabled(p => ({ ...p, [id]: !p[id] }));
  const enabledList = features.filter(f => enabled[f.id]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => nav('/dashboard')}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>New Conversation</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Choose the features you want to use for this conversation.</p>
        </div>
        {/* Topic picker */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            style={{ gap: 8, padding: '9px 16px' }}
            onClick={() => setShowTopics(p => !p)}
          >
            💬
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>Topic</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{topic}</div>
            </div>
            <ChevronDown size={14} />
          </button>
          {showTopics && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, background: '#fff',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 50, minWidth: 200, padding: 8,
            }}>
              {topics.map(t => (
                <div
                  key={t}
                  style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: t === topic ? 700 : 400, color: t === topic ? 'var(--blue)' : 'var(--text)' }}
                  onClick={() => { setTopic(t); setShowTopics(false); }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* Left panel */}
        <div>
          {/* AI Features */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>AI Features</h2>
              <span style={{ fontSize: 12, color: '#888' }}>All features are enabled by default. You can turn off any feature if you prefer.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {features.map(f => (
                <div
                  key={f.id}
                  className="card"
                  style={{ background: enabled[f.id] ? 'var(--blue-light)' : '#f5ede0', border: `1.5px solid ${enabled[f.id] ? '#c0d4f8' : 'transparent'}`, padding: 14 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{f.icon}</span>
                    <label className="toggle">
                      <input type="checkbox" checked={enabled[f.id]} onChange={() => toggle(f.id)} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            {/* Confirm button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 17, padding: '15px 44px', borderRadius: 50, flexShrink: 0 }}
                onClick={() => nav('/live', { state: { topic } })}
              >
                ▶ Confirm
              </button>
              <span style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>
                Start your conversation with the selected features →
              </span>
            </div>
          </div>

          {/* Microphone & Camera */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Microphone & Camera</h3>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mic size={12} /> Microphone
                </div>
                <select className="select" style={{ width: '100%' }} value={mic} onChange={e => setMic(e.target.value)}>
                  <option>Default – Microphone (Realtek)</option>
                  <option>USB Microphone</option>
                  <option>Headset Microphone</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Video size={12} /> Camera
                </div>
                <select className="select" style={{ width: '100%' }} value={cam} onChange={e => setCam(e.target.value)}>
                  <option>Default – Integrated Camera</option>
                  <option>USB Webcam</option>
                  <option>External Camera</option>
                </select>
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 18, padding: '9px 14px' }}>
                <Settings size={16} />
                <span style={{ fontSize: 13 }}>Advanced Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right panel – Enabled Features */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Enabled Features</h3>
              <div style={{ width: 24, height: 24, background: 'var(--green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={14} color="#fff" />
              </div>
            </div>
            {features.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{f.title}</span>
                </div>
                <CheckCircle2 size={16} color={enabled[f.id] ? 'var(--green)' : '#ccc'} />
              </div>
            ))}
          </div>

          {/* About panel */}
          <div className="card" style={{ background: 'var(--blue-light)', border: '1.5px solid #c0d4f8' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Info size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>About These Features</div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                  These AI features help you get real-time support and insights during your conversation. You can disable any feature based on your preference.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
