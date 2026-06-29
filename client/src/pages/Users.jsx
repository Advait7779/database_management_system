import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { PlusIcon, EditIcon, DeleteIcon, UsersIcon, CheckIcon, CloseIcon } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';

const ROLES = ['super_admin', 'admin', 'staff', 'download_user', 'api_user'];
const roleBadge = { super_admin: 'badge-violet', admin: 'badge-indigo', staff: 'badge-cyan', download_user: 'badge-amber', api_user: 'badge-emerald' };
const roleLabel = { super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff', download_user: 'Download User', api_user: 'API User' };
const roleOptions = ROLES.map(r => ({ value: r, label: roleLabel[r] }));

function UserModal({ user, onClose, onSave }) {
  const isEdit = Boolean(user?.id);
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'staff', ...user });
  const [loading, setLoading] = useState(false);
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.username || !form.email || (!isEdit && !form.password)) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      if (isEdit) await axios.put(`/users/${user.id}`, form);
      else await axios.post('/users', form);
      toast.success(isEdit ? 'User updated!' : 'User created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="glass-card p-7 w-full max-w-md relative z-10">
          <h3 className="font-bold font-display text-xl text-primary mb-5">{isEdit ? 'Edit User' : 'Add User'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { name: 'full_name', label: 'Full Name', type: 'text' },
              { name: 'username', label: 'Username', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              ...(!isEdit ? [{ name: 'password', label: 'Password', type: 'password', required: true }] : []),
            ].map(f => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">{f.label}{f.required && <span className="text-rose-400 ml-1">*</span>}</label>
                <input name={f.name} type={f.type} value={form[f.name] || ''} onChange={handleChange} className="input-field" required={f.required} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Role *</label>
              <CustomSelect
                value={form.role}
                onChange={val => setForm(p => ({ ...p, role: val }))}
                options={roleOptions}
                className="w-full"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1"><CloseIcon size={16} /> Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckIcon size={16} /> {isEdit ? 'Update' : 'Create'}</>}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Users() {
  const { canManageUsers, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | user object
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { if (!canManageUsers()) { navigate('/dashboard'); return; } fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/users');
      if (res.data.success) setUsers(res.data.data || []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/users/${deleteId}`);
      toast.success('User deleted');
      setDeleteId(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const toggleStatus = async (u) => {
    try {
      await axios.put(`/users/${u.id}`, { status: !u.status });
      toast.success(`User ${!u.status ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update status'); }
  };

  const roleCounts = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {});
  const roleColors = { super_admin: '#8B5CF6', admin: '#6366F1', staff: '#22D3EE', download_user: '#FBBF24', api_user: '#10B981' };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage system users and permissions</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary"><PlusIcon size={16} /> Add User</button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r} className="glass-card p-4 text-center" style={{ borderColor: `${roleColors[r]}30` }}>
            <div className="text-2xl font-bold font-display" style={{ color: roleColors[r] }}>{roleCounts[r]}</div>
            <p className="text-xs text-muted mt-1">{roleLabel[r]}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
              )) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, ${roleColors[u.role]}, ${roleColors[u.role]}80)` }}>
                        {(u.full_name || u.username)[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-primary text-sm">{u.full_name || u.username}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-sm">{u.username}</span></td>
                  <td className="text-sm">{u.email}</td>
                  <td><span className={`badge ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                  <td>
                    <button onClick={() => toggleStatus(u)} disabled={u.id === currentUser?.id}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-300 ${u.status ? 'bg-emerald-500' : 'bg-gray-600'} disabled:opacity-50`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-300 mt-0.5 ${u.status ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="text-xs text-muted">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModal(u)} className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-400/10 transition-colors"><EditIcon size={15} /></button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition-colors"><DeleteIcon size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UserModal user={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSave={() => { setModal(null); fetchUsers(); }} />
      )}
      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete User" message="Are you sure you want to delete this user? This cannot be undone." />
    </div>
  );
}
