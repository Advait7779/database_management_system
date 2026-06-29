import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  ContactsIcon, PlusIcon, SearchIcon, DownloadIcon,
  SMSIcon, WhatsAppIcon, VoiceIcon, UsersIcon, PinIcon, ArrowRightIcon
} from '../components/Icons';

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.25, ease: 'easeOut' } })
};

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = parseInt(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

const statConfig = [
  { key: 'total_contacts', label: 'Total Contacts', icon: ContactsIcon, grad: 'from-indigo-500 to-violet-500', glow: 'rgba(99,102,241,0.3)', border: 'rgba(99,102,241,0.2)' },
  { key: 'today_contacts', label: "Today's Added", icon: PlusIcon, grad: 'from-cyan-500 to-indigo-500', glow: 'rgba(6,182,212,0.3)', border: 'rgba(6,182,212,0.2)' },
  { key: 'sms_sent', label: 'SMS Sent', icon: SMSIcon, grad: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,0.3)', border: 'rgba(139,92,246,0.2)' },
  { key: 'whatsapp_sent', label: 'WhatsApp Sent', icon: WhatsAppIcon, grad: 'from-emerald-500 to-cyan-500', glow: 'rgba(16,185,129,0.3)', border: 'rgba(16,185,129,0.2)' },
  { key: 'voice_calls', label: 'Voice Calls', icon: VoiceIcon, grad: 'from-amber-500 to-orange-500', glow: 'rgba(245,158,11,0.3)', border: 'rgba(245,158,11,0.2)' },
  { key: 'total_downloads', label: 'Downloads', icon: DownloadIcon, grad: 'from-rose-500 to-pink-600', glow: 'rgba(244,63,94,0.3)', border: 'rgba(244,63,94,0.2)' },
  { key: 'active_users', label: 'Active Users', icon: UsersIcon, grad: 'from-violet-500 to-pink-500', glow: 'rgba(168,85,247,0.3)', border: 'rgba(168,85,247,0.2)' },
  { key: 'total_pincodes', label: 'PIN Codes', icon: PinIcon, grad: 'from-cyan-500 to-indigo-600', glow: 'rgba(34,211,238,0.3)', border: 'rgba(34,211,238,0.2)' },
];

const actionColors = {
  login: 'badge-cyan', add_contact: 'badge-emerald', edit_contact: 'badge-indigo',
  delete_contact: 'badge-rose', download: 'badge-amber', send_sms: 'badge-violet',
  send_whatsapp: 'badge-emerald', send_voice: 'badge-amber', create_user: 'badge-violet',
};

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const { canDownload } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await axios.get('/reports/dashboard');
        if (res.data.success) {
          setStats(res.data.data.stats || {});
          setActivity(res.data.data.recent_activity || []);
        }
      } catch (e) {
        console.error('Dashboard fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/contacts/new')} className="btn-primary">
            <PlusIcon size={16} /> Add Contact
          </button>
          <button onClick={() => navigate('/search')} className="btn-secondary">
            <SearchIcon size={16} /> Search
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statConfig.map((s, i) => (
          <motion.div key={s.key} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
            <div className="glass-card p-5 relative overflow-hidden group cursor-pointer"
              onClick={() => s.key === 'total_contacts' ? navigate('/contacts') : null}>
              {/* Glow bg */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                style={{ background: `radial-gradient(circle at 30% 30%, ${s.glow}, transparent 70%)` }} />
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-4`}
                  style={{ boxShadow: `0 4px 12px ${s.glow}` }}>
                  <s.icon size={20} className="text-white" />
                </div>
                <div className="text-3xl font-bold font-display text-primary mb-1">
                  {loading ? <div className="skeleton h-8 w-16 rounded" /> : <AnimatedNumber value={stats[s.key] || 0} />}
                </div>
                <p className="text-xs text-muted font-medium">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}
          className="glass-card p-6">
          <h2 className="font-semibold font-display text-primary mb-4 text-base">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { label: 'Add New Contact', desc: 'Create a contact record', icon: PlusIcon, color: '#6366F1', path: '/contacts/new' },
              { label: 'Smart Search', desc: 'Search by PIN, City, State', icon: SearchIcon, color: '#22D3EE', path: '/search' },
              { label: 'View All Contacts', desc: 'Browse contact database', icon: ContactsIcon, color: '#10B981', path: '/contacts' },
              ...(canDownload() ? [{ label: 'Download Excel', desc: 'Export filtered data', icon: DownloadIcon, color: '#FBBF24', path: '/downloads' }] : []),
            ].map((action) => (
              <button key={action.path} onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${action.color}20`, border: `1px solid ${action.color}30` }}>
                  <action.icon size={18} style={{ color: action.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">{action.label}</p>
                  <p className="text-xs text-muted">{action.desc}</p>
                </div>
                <ArrowRightIcon size={16} className="text-muted flex-shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
          className="glass-card p-6 lg:col-span-2">
          <h2 className="font-semibold font-display text-primary mb-4 text-base">Recent Activity</h2>
          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1"><div className="skeleton h-3 w-48 rounded" /><div className="skeleton h-2 w-32 rounded" /></div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted">
              <LogsPlaceholder />
              <p className="text-sm mt-3">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((log, i) => (
                <motion.div key={`${log.id || i}-${i}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <span className="text-xs font-bold text-indigo-400">
                      {(log.username || 'S')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-primary">{log.username || 'System'}</span>
                      <span className={`badge ${actionColors[log.action] || 'badge-gray'}`}>{log.action?.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 truncate">{log.description}</p>
                    <p className="text-xs text-muted opacity-60 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function LogsPlaceholder() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="32" height="36" rx="4" stroke="rgba(99,102,241,0.3)" strokeWidth="2"/>
      <line x1="14" y1="16" x2="34" y2="16" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="24" x2="28" y2="24" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="32" x2="22" y2="32" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
