import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { DownloadIcon, ExcelIcon, ShieldIcon, FilterIcon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';
import Pagination from '../components/Pagination';

const genderOptions = [
  { value: '', label: 'All Genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function Downloads() {
  const { user, canDownload } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ pincode: '', city: '', state: '', name: '', gender: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlLoading, setDlLoading] = useState('');
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!canDownload()) { navigate('/dashboard'); return; }
    fetchLogs(1);
  }, []);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await axios.get('/download/logs', { params: { page: p, limit: 5 } });
      if (res.data.success) {
        setLogs(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch { } finally { setLoading(false); }
  };

  const handleChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v.trim()) params[k] = v.trim(); });
      const res = await axios.get('/search', { params: { ...params, limit: 1 } });
      setPreviewCount(res.data.pagination?.total || 0);
    } catch { toast.error('Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const handleDownload = async (type) => {
    setDlLoading(type);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v.trim()) params[k] = v.trim(); });
      const res = await axios.get(`/download/${type}`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${Date.now()}.${type === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded!`);
      setPage(1);
      fetchLogs(1);
    } catch { toast.error('Download failed'); }
    finally { setDlLoading(''); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Download Center</h1>
        <p className="page-subtitle">Export contact data as Excel or CSV</p>
      </div>

      {/* Security Notice */}
      <div className="flex items-center gap-3 p-4 rounded-xl mb-6"
        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <ShieldIcon size={20} className="text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-400 font-medium">
          All downloads are logged with your IP address and timestamp for security purposes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Filters */}
        <div className="lg:col-span-2 glass-card p-6 relative z-20">
          <h2 className="font-semibold font-display text-primary mb-5 flex items-center gap-2">
            <FilterIcon size={18} className="text-indigo-400" /> Download Filters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {[
              { name: 'pincode', label: 'PIN Code', placeholder: 'e.g. 560001' },
              { name: 'city', label: 'City', placeholder: 'e.g. Bangalore' },
              { name: 'state', label: 'State', placeholder: 'e.g. Karnataka' },
              { name: 'name', label: 'Name contains', placeholder: 'e.g. Kumar' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">{f.label}</label>
                <input name={f.name} value={filters[f.name]} onChange={handleChange}
                  placeholder={f.placeholder} className="input-field" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Gender</label>
              <CustomSelect
                value={filters.gender}
                onChange={val => setFilters(p => ({ ...p, gender: val }))}
                options={genderOptions}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={handlePreview} disabled={previewLoading} className="btn-secondary">
              {previewLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Preview Count'}
            </button>
            {previewCount !== null && (
              <span className="badge badge-indigo text-sm font-bold px-4 py-2">
                {previewCount.toLocaleString()} records match
              </span>
            )}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="glass-card p-6 flex flex-col gap-4">
          <h2 className="font-semibold font-display text-primary mb-2">Export Data</h2>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleDownload('excel')} disabled={!!dlLoading}
            className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            {dlLoading === 'excel' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ExcelIcon size={22} />}
            Download Excel (.xlsx)
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleDownload('csv')} disabled={!!dlLoading}
            className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            {dlLoading === 'csv' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DownloadIcon size={22} />}
            Download CSV (.csv)
          </motion.button>
          <p className="text-xs text-muted text-center mt-2">Leave filters empty to download all contacts</p>
        </div>
      </div>

      {/* Download History */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h2 className="font-semibold font-display text-primary">Download History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Type</th><th>Filters</th><th>Records</th><th>IP Address</th><th>Time</th></tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
              )) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted">No downloads yet</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td className="font-medium">{log.username || `User #${log.user_id}`}</td>
                  <td><span className={`badge ${log.file_type === 'excel' ? 'badge-emerald' : 'badge-indigo'}`}>{log.file_type?.toUpperCase()}</span></td>
                  <td className="text-xs text-muted">{log.filters_applied ? JSON.stringify(log.filters_applied) : 'All'}</td>
                  <td><span className="badge badge-cyan">{(log.record_count || 0).toLocaleString()}</span></td>
                  <td className="font-mono text-xs">{log.ip_address || '—'}</td>
                  <td className="text-xs text-muted">{new Date(log.download_time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && logs.length > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-subtle flex justify-end">
            <Pagination
              page={page}
              total={total}
              limit={5}
              onPageChange={(p) => {
                setPage(p);
                fetchLogs(p);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
