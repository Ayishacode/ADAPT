import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, MessageCircle, CheckSquare, TrendingUp, Cpu, User, Brain } from 'lucide-react';

import Splash from './pages/Splash';
import Dashboard from './pages/Dashboard';
import NewConversation from './pages/NewConversation';
import LiveConversation from './pages/LiveConversation';
import LiveAnalysis from './pages/LiveAnalysis';
import PostSession from './pages/PostSession';
import Tasks from './pages/Tasks';
import Sensors from './pages/Sensors';
import Progress from './pages/Progress';
import Personalization from './pages/Personalization';

const navItems = [
  { to: '/dashboard', icon: <Home size={18} />, label: 'Home' },
  { to: '/conversation', icon: <MessageCircle size={18} />, label: 'Conversation' },
  { to: '/tasks', icon: <CheckSquare size={18} />, label: 'Tasks' },
  { to: '/progress', icon: <TrendingUp size={18} />, label: 'Progress' },
  { to: '/sensors', icon: <Cpu size={18} />, label: 'Sensors' },
  { to: '/profile', icon: <User size={18} />, label: 'Profile' },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon"><Brain size={24} /></div>
        <span>NeuroClarity</span>
        <small>Speak. Understand.<br />Stay on Track.</small>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            {n.icon} {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function Layout({ children }) {
  const loc = useLocation();
  const noSidebar = ['/', '/splash'].includes(loc.pathname);
  if (noSidebar) return children;
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/conversation" element={<NewConversation />} />
          <Route path="/live" element={<LiveConversation />} />
          <Route path="/analysis" element={<LiveAnalysis />} />
          <Route path="/summary" element={<PostSession />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Personalization />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
