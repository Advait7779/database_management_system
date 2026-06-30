import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { ReportsIcon, RefreshIcon } from '../components/Icons';

export default function Reports() {
  const [stats, setStats] = useState({ cities: [], states: [], pincodes: [], gender: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/reports/contact-stats');
        if (res.data.success) {
          const d = res.data.data;
          setStats({
            cities: d.by_city || [],
            states: d.by_state || [],
            pincodes: d.by_pincode || [],
            gender: d.by_gender || [],
          });
        }
      } catch { } finally { setLoading(false); }
    };
    fetch();
  }, []);

  const maxCity = Math.max(...(stats.cities?.map(c => c.count) || [1]), 1);
  const maxState = Math.max(...(stats.states?.map(s => s.count) || [1]), 1);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Contact distribution across regions</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-secondary"><RefreshIcon size={16} /> Refresh</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* City bar chart */}
        <div className="glass-card p-6">
          <h2 className="font-semibold font-display text-primary mb-5 flex items-center gap-2">
            <ReportsIcon size={18} /> Top Cities by Contacts
          </h2>
          {loading ? <div className="space-y-3">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton h-8 rounded" />)}</div> : (
            <div className="space-y-3">
              {stats.cities?.slice(0, 10).map((c, i) => (
                <motion.div key={c.city || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{c.city || 'Unknown'}</span>
                    <span className="text-xs font-bold text-indigo-400">{Number(c.count).toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / maxCity) * 100}%` }}
                      transition={{ delay: i * 0.03 + 0.1, duration: 0.35, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                  </div>
                </motion.div>
              ))}
              {(!stats.cities || stats.cities.length === 0) && <p className="text-muted text-center py-8">No data available</p>}
            </div>
          )}
        </div>

        {/* State distribution */}
        <div className="glass-card p-6">
          <h2 className="font-semibold font-display text-primary mb-5">State-wise Distribution</h2>
          {loading ? <div className="space-y-3">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton h-8 rounded" />)}</div> : (
            <div className="space-y-3">
              {stats.states?.slice(0, 10).map((s, i) => (
                <motion.div key={s.state || i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{s.state || 'Unknown'}</span>
                    <span className="text-xs font-bold text-cyan-400">{Number(s.count).toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(s.count / maxState) * 100}%` }}
                      transition={{ delay: i * 0.03 + 0.1, duration: 0.35, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #22D3EE, #6366F1)' }} />
                  </div>
                </motion.div>
              ))}
              {(!stats.states || stats.states.length === 0) && <p className="text-muted text-center py-8">No data available</p>}
            </div>
          )}
        </div>

        {/* Gender distribution */}
        <div className="glass-card p-6">
          <h2 className="font-semibold font-display text-primary mb-5">Gender-wise Distribution</h2>
          {loading ? <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-8 rounded" />)}</div> : (
            <div className="space-y-4">
              {stats.gender?.map((g, i) => {
                const total = stats.gender.reduce((acc, curr) => acc + curr.count, 0) || 1;
                const pct = Math.round((g.count / total) * 100);
                const isFemale = g.gender === 'female';
                const isMale = g.gender === 'male';
                const barColor = isFemale ? 'linear-gradient(90deg, #F472B6, #EC4899)' : isMale ? 'linear-gradient(90deg, #60A5FA, #3B82F6)' : 'linear-gradient(90deg, #94A3B8, #64748B)';
                const labelColor = isFemale ? 'text-pink-400' : isMale ? 'text-blue-400' : 'text-slate-400';
                
                return (
                  <motion.div key={g.gender || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-primary capitalize">{g.gender || 'Unknown'}</span>
                      <span className="text-xs font-bold">
                        <span className={`${labelColor} mr-1.5`}>{pct}%</span>
                        <span className="text-muted">({g.count})</span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.05 + 0.1, duration: 0.45, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: barColor }} />
                    </div>
                  </motion.div>
                );
              })}
              {(!stats.gender || stats.gender.length === 0) && <p className="text-muted text-center py-8">No data available</p>}
            </div>
          )}
        </div>
      </div>

      {/* PIN Code table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h2 className="font-semibold font-display text-primary">PIN Code Distribution</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>#</th><th>PIN Code</th><th>City</th><th>State</th><th>Contacts</th></tr></thead>
            <tbody>
              {loading ? Array(10).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
              )) : (stats.pincodes || []).slice(0, 30).map((p, i) => (
                <tr key={p.pincode || i}>
                  <td className="text-muted text-xs">{i + 1}</td>
                  <td><span className="badge badge-cyan font-mono">{p.pincode}</span></td>
                  <td>{p.city || '—'}</td>
                  <td>{p.state || '—'}</td>
                  <td><span className="font-bold text-indigo-400">{Number(p.count).toLocaleString()}</span></td>
                </tr>
              ))}
              {!loading && (!stats.pincodes || stats.pincodes.length === 0) && (
                <tr><td colSpan={5} className="text-center py-10 text-muted">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
