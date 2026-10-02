import { useNavigate } from 'react-router-dom';
import { Brain, Mic, Lightbulb } from 'lucide-react';

export default function Splash() {
  const nav = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f0e8 0%, #e8f0fd 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Skip */}
      <button
        onClick={() => nav('/dashboard')}
        style={{
          position: 'absolute', top: 28, right: 28,
          background: 'rgba(255,255,255,0.7)', border: 'none',
          borderRadius: 20, padding: '6px 18px', fontSize: 13,
          color: '#888', cursor: 'pointer', fontWeight: 600,
        }}
      >
        Skip
      </button>

      {/* Floating blobs */}
      <div style={{
        position: 'absolute', width: 320, height: 320,
        borderRadius: '50%', top: -80, left: -80,
        background: 'rgba(74,127,229,0.08)',
      }} />
      <div style={{
        position: 'absolute', width: 240, height: 240,
        borderRadius: '50%', bottom: -60, right: -60,
        background: 'rgba(108,99,255,0.08)',
      }} />

      {/* Logo */}
      <div style={{
        width: 90, height: 90,
        background: 'linear-gradient(135deg, #4a7fe5, #6c63ff)',
        borderRadius: 26, display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: 20,
        boxShadow: '0 8px 32px rgba(74,127,229,0.35)',
      }}>
        <Brain size={44} color="#fff" />
      </div>

      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>NeuroClarity</h1>
      <p style={{ fontSize: 16, color: '#666', marginBottom: 40, maxWidth: 320 }}>
        Speak. Understand. Stay on Track.
        <br />
        <span style={{ fontSize: 14 }}>An AI-powered communication companion for a more focused, confident you.</span>
      </p>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { icon: <Mic size={14} />, text: 'Real-time Speech Analysis' },
          { icon: <Lightbulb size={14} />, text: 'Contextual Suggestions' },
          { icon: <Brain size={14} />, text: 'AI-Powered Insights' },
        ].map(f => (
          <div key={f.text} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', borderRadius: 20, padding: '8px 16px',
            fontSize: 12, fontWeight: 600, color: '#4a7fe5',
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
          }}>
            {f.icon} {f.text}
          </div>
        ))}
      </div>

      {/* Illustration area */}
      <div style={{
        width: 220, height: 180,
        background: 'linear-gradient(135deg, #e8f0fd, #f0eaff)',
        borderRadius: 24, marginBottom: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(74,127,229,0.12)',
        fontSize: 80,
      }}>
        🤖
      </div>

      <button
        className="btn btn-primary"
        style={{ fontSize: 17, padding: '16px 48px', borderRadius: 50 }}
        onClick={() => nav('/dashboard')}
      >
        Get Started →
      </button>
    </div>
  );
}
