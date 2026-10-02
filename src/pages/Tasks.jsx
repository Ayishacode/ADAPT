import { useState } from 'react';
import { Plus, Bell, MoreHorizontal } from 'lucide-react';

const initialTasks = {
  today: [
    { id: 1, title: 'Submit project report', date: '12 May 2026, 5:00 PM', tags: ['Academic', 'High'], done: false },
    { id: 2, title: 'Call Rahul for guidance', date: '12 May 2026, 11:00 AM', tags: ['Follow-up', 'Medium'], done: false },
    { id: 3, title: 'Read research paper', date: '12 May 2026, 2:00 PM', tags: ['Academic'], done: true },
    { id: 4, title: 'Team meeting', date: '12 May 2026, 4:30 PM', tags: ['Meeting', 'High'], done: false },
  ],
  tomorrow: [
    { id: 5, title: 'Call Rahul', date: '13 May 2026, 7:00 PM', tags: ['Follow-up', 'Medium'], done: false },
    { id: 6, title: 'Prepare presentation', date: '13 May 2026, 9:00 PM', tags: ['Academic', 'High'], done: false },
  ],
};

const aiTasks = [
  { title: 'Submit project report', date: '16 May 2026, 5:00 PM', priority: 'High', category: 'Academic' },
  { title: 'Call Rahul', date: '12 May 2026, 7:00 PM', priority: 'Medium', category: 'Follow-up' },
  { title: 'Buy sensors for project', date: 'Tomorrow, 11:00 AM', priority: 'Medium', category: 'Project' },
];

const tagColor = t => {
  if (t === 'High') return 'badge-red';
  if (t === 'Medium') return 'badge-orange';
  if (t === 'Follow-up') return 'badge-blue';
  if (t === 'Meeting') return 'badge-blue';
  return 'badge-green';
};

const filterTabs = ['All', 'Today', 'Upcoming', 'Completed'];

export default function Tasks() {
  const [filter, setFilter] = useState('All');
  const [tasks, setTasks] = useState(initialTasks);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const toggleDone = (group, id) => {
    setTasks(p => ({
      ...p,
      [group]: p[group].map(t => t.id === id ? { ...t, done: !t.done } : t),
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>My Tasks</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 2 }}>AI-extracted from your conversations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(p => !p)}>
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* AI extracted banner */}
      <div className="card" style={{ background: 'var(--blue-light)', border: '1.5px solid #c0d4f8', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Tasks from Conversation</div>
            <div style={{ fontSize: 12, color: '#888' }}>We found some tasks and commitments in your conversation.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {aiTasks.map((t, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderRadius: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>📅 {t.date}</div>
              </div>
              <span className={`badge ${tagColor(t.category)}`}>{t.category}</span>
              <span className={`badge ${tagColor(t.priority)}`}>{t.priority}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-green" style={{ padding: '4px 10px', fontSize: 11 }}>Add</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>Edit</button>
                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 11 }}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add task input */}
      {showNew && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="New task title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowNew(false)}>Add</button>
          <button className="btn btn-ghost" style={{ flexShrink: 0 }} onClick={() => setShowNew(false)}>Cancel</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#ddd0be', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {filterTabs.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: filter === t ? '#fff' : 'transparent',
              color: filter === t ? 'var(--blue)' : '#888',
              boxShadow: filter === t ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Task lists */}
      {[
        { label: 'Today · 12 May 2026', key: 'today' },
        { label: 'Tomorrow · 13 May 2026', key: 'tomorrow' },
      ].map(section => (
        <div key={section.key} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 10 }}>{section.label}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {tasks[section.key].map((task, idx) => (
              <div
                key={task.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                  borderBottom: idx < tasks[section.key].length - 1 ? '1px solid var(--border)' : 'none',
                  background: task.done ? '#f5ede0' : '#fff',
                }}
              >
                <div
                  className={`checkbox ${task.done ? 'checked' : ''}`}
                  onClick={() => toggleDone(section.key, task.id)}
                >
                  {task.done && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                </div>
                <div style={{ flex: 1, opacity: task.done ? 0.5 : 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>📅 {task.date}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {task.tags.map(t => <span key={t} className={`badge ${tagColor(t)}`}>{t}</span>)}
                </div>
                <Bell size={15} color="#bbb" style={{ cursor: 'pointer' }} />
                <MoreHorizontal size={15} color="#bbb" style={{ cursor: 'pointer' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
