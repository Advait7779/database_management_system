import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { RefreshIcon } from '../components/Icons';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';

const actionOptions = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'add_contact', label: 'Add Contact' },
  { value: 'edit_contact', label: 'Edit Contact' },
  { value: 'delete_contact', label: 'Delete Contact' },
  { value: 'download', label: 'Download' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'send_whatsapp', label: 'Send WhatsApp' },
  { value: 'send_voice', label: 'Send Voice' },
  { value: 'create_user', label: 'Create User' },
];

const actionColors = {
  login: 'badge-cyan',
  add_contact: 'badge-emerald',
  edit_contact: 'badge-indigo',
  delete_contact: 'badge-rose',
  download: 'badge-amber',
  send_sms: 'badge-violet',
  send_whatsapp: 'badge-emerald',
  send_voice: 'badge-amber',
  create_user: 'badge-violet',
  update_user: 'badge-indigo',
  delete_user: 'badge-rose',
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (actionFilter) params.action = actionFilter;
      const res = await axios.get('/reports/activity', { params });
      if (res.data.success) {
        setLogs(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-subtitle font-display">System-wide audit logs for security and tracking</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary">
          <RefreshIcon size={16} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center relative z-20">
        <CustomSelect
          value={actionFilter}
          onChange={(val) => {
            setActionFilter(val);
            setPage(1);
          }}
          options={actionOptions}
          className="w-full sm:w-56"
        />
        {actionFilter && (
          <button
            onClick={() => {
              setActionFilter('');
              setPage(1);
            }}
            className="btn-secondary text-xs w-full sm:w-auto justify-center"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
                <th>IP Address</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(10)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i}>
                      {Array(5)
                        .fill(0)
                        .map((_, j) => (
                          <td key={j}>
                            <div className="skeleton h-4 rounded w-full" />
                          </td>
                        ))}
                    </tr>
                  ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="font-semibold text-primary">
                        {log.username || `User #${log.user_id}`}
                      </td>
                      <td>
                        <span className={`badge ${actionColors[log.action] || 'badge-gray'}`}>
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-sm max-w-md truncate" title={log.description}>
                        {log.description}
                      </td>
                      <td className="font-mono text-xs">{log.ip_address || '—'}</td>
                      <td className="text-xs text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        {total > limit && (
          <div className="px-4 py-4 border-t border-subtle">
            <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
