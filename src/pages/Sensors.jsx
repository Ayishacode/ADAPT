import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wifi, RefreshCw, Settings } from 'lucide-react';

const heartData = [
  { t: '10:00', bpm: 72 }, { t: '10:02', bpm: 75 }, { t: '10:04', bpm: 78 },
  { t: '10:06', bpm: 74 }, { t: '10:08', bpm: 80 }, { t: '10:10', bpm: 76 },
];

const activityColors = { Low: '#5cb85c', Normal: '#4a7fe5', High: '#e05555' };

export default function Sensors() {
  const connected = true;
  const heartRate = 72;
  const activity = 'Normal';
  const movement = 'Low';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Sensor Monitoring</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 2 }}>ESP32 wearable device · BLE connection</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: connected ? '#e8f5e8' : '#fee2e2',
            borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600,
            color: connected ? 'var(--green)' : 'var(--red)',
          }}>
            <Wifi size={14} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px 12px' }}><RefreshCw size={16} /></button>
          <button className="btn btn-ghost" style={{ padding: '8px 12px' }}><Settings size={16} /></button>
        </div>
      </div>

      {/* Sensor cards row */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {/* Heart Rate */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #fce4ec, #fff)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>❤️ Heart Rate</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
            <span className="sensor-value">{heartRate}</span>
            <span className="sensor-unit" style={{ marginBottom: 6 }}>bpm</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Resting · Normal range</div>
          <div style={{ marginTop: 10, background: '#fce4ec', borderRadius: 8, height: 4 }}>
            <div style={{ height: 4, background: '#e05555', borderRadius: 8, width: '60%' }} />
          </div>
        </div>

        {/* Activity */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #e8f0fd, #fff)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>🏃 Activity Level</div>
          <div style={{ marginBottom: 4 }}>
            <span className="sensor-value" style={{ color: activityColors[activity] }}>{activity}</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Current activity state</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {['Low', 'Normal', 'High'].map(a => (
              <div key={a} style={{
                flex: 1, height: 8, borderRadius: 4,
                background: a === activity ? activityColors[a] : '#ddd0be',
              }} />
            ))}
          </div>
        </div>

        {/* Movement */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #e8f5e8, #fff)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8 }}>📡 Movement</div>
          <div style={{ marginBottom: 4 }}>
            <span className="sensor-value" style={{ color: '#5cb85c' }}>{movement}</span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Accelerometer reading</div>
          <div style={{ marginTop: 10, background: '#e8f5e8', borderRadius: 8, height: 4 }}>
            <div style={{ height: 4, background: '#5cb85c', borderRadius: 8, width: '20%' }} />
          </div>
        </div>
      </div>

      {/* Heart rate chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Heart Rate – Last 10 Minutes</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={heartData}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e05555" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#e05555" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 90]} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="bpm" stroke="#e05555" strokeWidth={2.5} fill="url(#hrGrad)" dot={{ r: 4, fill: '#e05555' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Device info + contextual note */}
      <div className="grid-2">
        <div className="card card-sm">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Device Info</h3>
          {[
            { label: 'Device', value: 'ESP32 Wearable v1' },
            { label: 'Battery', value: '78%' },
            { label: 'Connection', value: 'BLE 5.0' },
            { label: 'Firmware', value: 'v2.1.0' },
            { label: 'Last sync', value: '1 min ago' },
          ].map(d => (
            <div className="metric-row" key={d.label}>
              <span style={{ fontSize: 12, color: '#666' }}>{d.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.value}</span>
            </div>
          ))}
        </div>

        <div className="card card-sm" style={{ background: 'var(--blue-light)', border: '1.5px solid #c0d4f8' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>ℹ️ About Sensor Data</div>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            Physiological data is used as <strong>contextual information</strong> to enrich communication analysis. It is <strong>not</strong> used for diagnostic purposes or ADHD assessment.
          </p>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 6 }}>HYPERAKTIV dataset compatible</div>
            <div style={{ fontSize: 11, color: '#888' }}>Heart rate and activity aligned with session performance metrics.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
