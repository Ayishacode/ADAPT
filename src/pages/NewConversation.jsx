import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Info, Mic } from 'lucide-react';

const features = [
  { id: 'self_summary',  icon: '📋', title: 'Self Summarization',  desc: 'Generate a brief summary of your conversation.' },
  { id: 'other_summary', icon: '✏️', title: 'Other Summarization', desc: 'Identify key points and action items.' },
  { id: 'word_suggest',  icon: '💡', title: 'Word Suggestion',     desc: 'Provide contextual word/phrase suggestions.' },
  { id: 'offtopic',      icon: '🌀', title: 'Off-topic Detection', desc: 'Detect when the conversation moves to a different topic.' },
  { id: 'popup',         icon: '🔔', title: 'Pop-up Animation',    desc: 'Show real-time feedback and alerts during conversation.' },
];

export default function NewConversation() {
  const nav = useNavigate();
  const [enabled, setEnabled] = useState({
    self_summary: true, other_summary: true, word_suggest: true, offtopic: true, popup: true,
  });

  const toggle = id => setEnabled(p => ({ ...p, [id]: !p[id] }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => nav('/dashboard')}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>New Conversation</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Choose the features you want to use, then start talking.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        {/* Left panel */}
        <div>
          {/* AI Features */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>AI Features</h2>
              <span style={{ fontSize: 12, color: '#888' }}>All features are enabled by default.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {features.map(f => (
                <div
                  key={f.id}
                  className="card"
                  style={{
                    background: enabled[f.id] ? 'var(--blue-light)' : '#f5ede0',
                    border: `1.5px solid ${enabled[f.id] ? '#c0d4f8' : 'transparent'}`,
                    padding: 14,
                  }}
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

            {/* Start button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 17, padding: '15px 44px', borderRadius: 50, flexShrink: 0 }}
                onClick={() => nav('/live', { state: { enabled } })}
              >
                <Mic size={18} /> Start Talking
              </button>
              <span style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>
                Your microphone will activate automatically
              </span>
            </div>
          </div>

          {/* Microphone only */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
              <Mic size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Microphone
            </h3>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
              Your browser microphone will be used for real-time speech recognition.
              Make sure your microphone is allowed in browser permissions.
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                Web Speech API — no installation needed
              </span>
            </div>
          </div>
        </div>

        {/* Right panel */}
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
