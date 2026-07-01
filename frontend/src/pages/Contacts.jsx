import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useDebounce } from 'use-debounce';
import { useAuth } from '../contexts/AuthContext';
import { PlusIcon, ImportIcon, EditIcon, DeleteIcon, SearchIcon, EyeIcon, RefreshIcon } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';

const genderOptions = [
  { value: '', label: 'All Genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const rowVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.02, duration: 0.15, ease: 'easeOut' } })
};

const maskMobile = (mobile) => {
  if (!mobile) return '—';
  const str = String(mobile).trim();
  if (str.length <= 5) return str;
  return str.slice(0, -5) + 'xxxxx';
};

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [columns, setColumns] = useState([]);
  const { canDelete, canManageUsers } = useAuth();
  const navigate = useNavigate();
  const limit = 50;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (debouncedSearch) params.q = debouncedSearch;
      if (cityFilter) params.city = cityFilter;
      if (stateFilter) params.state = stateFilter;
      if (genderFilter) params.gender = genderFilter;
      const res = await axios.get('/contacts', { params });
      if (res.data.success) {
        setContacts(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
        setColumns(res.data.columns || []);
      }
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, cityFilter, stateFilter, genderFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const customCols = columns.filter(col => {
    const stdCols = new Set([
      'id', 'name', 'gender', 'mobile', 'city', 'state', 'village', 'pincode', 'email', 'notes',
      'created_by', 'created_at', 'updated_at', 'created_by_name'
    ]);
    return !stdCols.has(col.toLowerCase());
  });

  const handleDelete = async () => {
    try {
      await axios.delete(`/contacts/${deleteId}`);
      toast.success('Contact deleted');
      setDeleteId(null);
      fetchContacts();
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading('Importing contacts...');
    try {
      const res = await axios.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Contacts imported successfully!', { id: toastId });
        fetchContacts();
      } else {
        toast.error(res.data.message || 'Import failed', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import file', { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Contacts
            <span className="badge badge-indigo text-sm font-bold">{total.toLocaleString()}</span>
          </h1>
          <p className="page-subtitle">Manage your contact database</p>
        </div>
        <div className="flex gap-3">
          {canManageUsers() && (
            <label className="btn-secondary cursor-pointer">
              <ImportIcon size={16} /> Import Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          )}
          {canManageUsers() && (
            <button onClick={() => navigate('/contacts/new')} className="btn-primary">
              <PlusIcon size={16} /> Add Contact
            </button>
          )}
          <button className="btn-secondary" title="Refresh" onClick={fetchContacts}>
            <RefreshIcon size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-5 relative z-30">
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-row md:items-center md:justify-between">
          <div className="search-bar w-full md:max-w-xs">
            <SearchIcon size={18} className="text-muted flex-shrink-0" />
            <input placeholder="Search by name or mobile..." value={search} onChange={handleSearch} />
          </div>
          <div className="contents md:flex md:flex-row md:items-center md:gap-3 md:ml-auto">
            <input value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1); }}
              placeholder="Filter by city" className="input-field w-full md:w-40" />
            <input value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}
              placeholder="Filter by state" className="input-field w-full md:w-40" />
            <CustomSelect
              value={genderFilter}
              onChange={val => { setGenderFilter(val); setPage(1); }}
              options={genderOptions}
              className="w-full md:w-36"
            />
            {(search || cityFilter || stateFilter || genderFilter) && (
              <button onClick={() => { setSearch(''); setCityFilter(''); setStateFilter(''); setGenderFilter(''); setPage(1); }}
                className="btn-secondary text-xs w-full md:w-auto justify-center col-span-2 md:col-span-1">Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Mobile</th>
                <th>City</th>
                <th>State</th>
                <th>PIN Code</th>
                {customCols.map(col => (
                  <th key={col} className="capitalize">{col.replace(/_/g, ' ')}</th>
                ))}
                <th>Added</th>
                {canManageUsers() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(limit).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(9 + customCols.length).fill(0).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={9 + customCols.length} className="text-center py-16 text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="20" stroke="rgba(99,102,241,0.3)" strokeWidth="2"/>
                        <path d="M24 16v8l5 3" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <p className="font-medium">No contacts found</p>
                      <button onClick={() => navigate('/contacts/new')} className="btn-primary mt-2">
                        <PlusIcon size={14} /> Add First Contact
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {contacts.map((c, i) => (
                    <tr key={c.id}>
                      <td className="text-muted text-xs">{(page - 1) * limit + i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            {c.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-primary text-xs leading-tight whitespace-nowrap">{c.name}</p>
                            {c.email && <p className="text-[10px] text-muted leading-tight whitespace-nowrap">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c.gender === 'female' ? 'badge-rose' : c.gender === 'male' ? 'badge-indigo' : 'badge-gray'} text-[10px] py-0.5 px-1.5 capitalize`}>
                          {c.gender || 'male'}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs">{maskMobile(c.mobile)}</span></td>
                      <td>{c.city || <span className="text-muted text-[10px]">—</span>}</td>
                      <td>{c.state || <span className="text-muted text-[10px]">—</span>}</td>
                      <td>
                        {c.pincode ? <span className="badge badge-cyan text-[10px] py-0.5 px-1.5">{c.pincode}</span> : <span className="text-muted text-[10px]">—</span>}
                      </td>
                      {customCols.map(col => (
                        <td key={col} className="text-xs">
                          {c[col] !== undefined && c[col] !== null ? (
                            String(c[col])
                          ) : (
                            <span className="text-muted text-[10px]">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-xs text-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                      {canManageUsers() && (
                        <td>
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/contacts/${c.id}/edit`)}
                              className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-400/10 transition-colors" title="Edit">
                              <EditIcon size={15} />
                            </button>
                            {canDelete() && (
                              <button onClick={() => setDeleteId(c.id)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition-colors" title="Delete">
                                <DeleteIcon size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-4 border-t border-subtle">
            <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
      />
    </div>
  );
}
