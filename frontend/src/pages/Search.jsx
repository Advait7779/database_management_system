import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { SearchIcon, PinIcon, DownloadIcon, FilterIcon, EditIcon } from '../components/Icons';
import Pagination from '../components/Pagination';
import { useNavigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';

const tabs = ['All', 'PIN Code', 'City', 'State', 'Name', 'Mobile'];

const genderOptions = [
  { value: '', label: 'All Genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const maskMobile = (mobile) => {
  if (!mobile) return '—';
  const str = String(mobile).trim();
  if (str.length <= 5) return str;
  return str.slice(0, -5) + 'xxxxx';
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Search() {
  const [activeTab, setActiveTab] = useState('All');
  const [query, setQuery] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [gender, setGender] = useState('');
  const [results, setResults] = useState([]);
  const [pinSummary, setPinSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [columns, setColumns] = useState([]);
  const customCols = columns.filter(col => {
    const colClean = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    const stdCols = new Set([
      'id', 'name', 'gender', 'mobile', 'address', 'city', 'state', 'village', 'pincode', 'email', 'notes',
      'created_by', 'created_at', 'updated_at', 'created_by_name',
      'srno', 'sno', 'slno', 'seq', 'seqno', 'serialno', 'sr'
    ]);
    if (stdCols.has(colClean) || colClean.includes('srno')) return false;
    return !stdCols.has(col.toLowerCase());
  });
  const debouncedQuery = useDebounce(query, 500);
  const { canDownload, canManageUsers, user } = useAuth();
  const navigate = useNavigate();
  const limit = 50;

  useEffect(() => {
    if (user?.role === 'staff') {
      toast.error('Smart Search is not available for Viewer accounts');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const doSearch = useCallback(async (q, tab, p = 1, g = gender) => {
    if (!q.trim() && !g && tab !== 'PIN Code') return;
    setLoading(true);
    setSearched(true);
    try {
      const params = { page: p, limit };
      if (tab === 'All') params.q = q;
      else if (tab === 'Name') params.name = q;
      else if (tab === 'Mobile') params.mobile = q;
      else if (tab === 'City') params.city = q;
      else if (tab === 'State') params.state = q;
      if (g) params.gender = g;
      const res = await axios.get('/search', { params });
      if (res.data.success) {
        setResults(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
        setColumns(res.data.columns || []);
      }
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  }, [gender]);

  useEffect(() => {
    if (activeTab !== 'PIN Code') {
      if (debouncedQuery.trim().length >= 2 || gender) {
        doSearch(debouncedQuery, activeTab, 1, gender);
        setPage(1);
      } else {
        setResults([]);
        setSearched(false);
      }
    }
  }, [debouncedQuery, activeTab, gender, doSearch]);

  const handlePinSearch = async () => {
    if (!pinInput.trim()) return toast.error('Enter a PIN code');
    setPinLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(`/search/pincode/${pinInput.trim()}`);
      if (res.data.success) {
        setResults(res.data.data.contacts || []);
        setColumns(res.data.data.columns || []);
        setPinSummary(res.data.data.summary || null);
        setTotal(res.data.data.contacts?.length || 0);
      }
    } catch { toast.error('PIN code search failed'); }
    finally { setPinLoading(false); }
  };

  const handleDownload = async (pin) => {
    setDlLoading(true);
    try {
      const params = {};
      if (pin) {
        params.pincode = pin;
      } else {
        if (activeTab === 'All') params.q = query;
        else if (activeTab === 'Name') params.name = query;
        else if (activeTab === 'Mobile') params.mobile = query;
        else if (activeTab === 'City') params.city = query;
        else if (activeTab === 'State') params.state = query;
        
        if (gender) params.gender = gender;
      }

      const res = await axios.get('/download/excel', {
        params,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = pin ? `contacts_pin_${pin}.xlsx` : 'contacts.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded!');
    } catch { toast.error('Download failed'); }
    finally { setDlLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Smart Search</h1>
        <p className="page-subtitle">Search contacts by PIN Code, City, State, Name, or Mobile</p>
      </div>

      {/* Search Area */}
      <div className="glass-card p-6 mb-6 relative z-20">
        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setQuery(''); setPinSummary(null); setResults([]); setSearched(false); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t ? 'text-white' : 'btn-secondary'}`}
              style={activeTab === t ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' } : {}}>
              {t}
            </button>
          ))}
        </div>

        {/* PIN Code Mode */}
        {activeTab === 'PIN Code' ? (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="search-bar max-w-md w-full">
              <PinIcon size={20} className="text-cyan-400 flex-shrink-0" />
              <input placeholder="Enter PIN Code (e.g. 560001)" value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePinSearch()}
                className="text-base font-mono" />
            </div>
            <button onClick={handlePinSearch} disabled={pinLoading} className="btn-primary px-6 w-full sm:w-auto justify-center">
              {pinLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><SearchIcon size={16} /> Search PIN</>}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="search-bar max-w-md w-full">
              <SearchIcon size={20} className="text-indigo-400 flex-shrink-0" />
              <input
                placeholder={`Search by ${activeTab.toLowerCase()}...`}
                value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
                className="text-base" autoFocus />
              {loading && <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />}
            </div>
            <CustomSelect
              value={gender}
              onChange={val => { setGender(val); setPage(1); }}
              options={genderOptions}
              className="w-full sm:w-40"
            />
          </div>
        )}
      </div>

      {/* PIN Summary Card */}
      <AnimatePresence>
        {pinSummary && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }}
            className="glass-card p-8 mb-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 50% 50%, #06B6D4, transparent 70%)' }} />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <PinIcon size={24} />
                <span className="text-lg font-semibold text-secondary">PIN Code</span>
                <span className="text-2xl font-bold font-mono gradient-text">{pinSummary.pincode}</span>
              </div>
              <div className="text-5xl font-black font-display gradient-text mb-2">
                {(pinSummary.total_contacts || 0).toLocaleString()}
              </div>
              <p className="text-muted text-base mb-3">Total Contacts</p>
              {pinSummary.cities?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                  {pinSummary.cities.map((c, i) => (
                    <span key={i} className="badge badge-cyan">
                      {c.city}{c.state && ` • ${c.state}`} ({c.count})
                    </span>
                  ))}
                </div>
              )}
              {canDownload() && (
                <button onClick={() => handleDownload(pinSummary.pincode)} disabled={dlLoading} className="btn-success mx-auto">
                  {dlLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><DownloadIcon size={16} /> Download PIN {pinSummary.pincode} Data</>}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {searched && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
            <span className="text-sm font-semibold text-secondary">
              {loading ? 'Searching...' : `Found ${total.toLocaleString()} contacts`}
            </span>
            {canDownload() && results.length > 0 && activeTab !== 'PIN Code' && (
              <button onClick={() => handleDownload(null)} disabled={dlLoading} className="btn-success text-xs px-3 py-2">
                <DownloadIcon size={14} /> Download Results
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SR NO</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Village</th>
                  <th>PIN Code</th>
                  <th>Address</th>
                  {customCols.map(col => (
                    <th key={col} className="capitalize">{col.replace(/_/g, ' ')}</th>
                  ))}
                  {canManageUsers() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(10 + customCols.length).fill(0).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 rounded w-full" /></td>
                    ))}
                  </tr>
                )) : results.length === 0 ? (
                  <tr>
                    <td colSpan={10 + customCols.length} className="text-center py-12 text-muted">
                      No results found
                    </td>
                  </tr>
                ) : results.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted text-xs">{(page - 1) * limit + i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>{c.name[0].toUpperCase()}</div>
                        <span className="font-medium text-primary text-xs leading-tight whitespace-nowrap">{c.name}</span>
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
                    <td>{c.village || <span className="text-muted text-[10px]">—</span>}</td>
                    <td>{c.pincode ? <span className="badge badge-cyan text-[10px] py-0.5 px-1.5">{c.pincode}</span> : <span className="text-muted text-[10px]">—</span>}</td>
                    <td className="text-xs max-w-xs truncate" title={c.address}>
                      {c.address || <span className="text-muted text-[10px]">—</span>}
                    </td>
                    {customCols.map(col => (
                      <td key={col} className="text-xs">
                        {c[col] !== undefined && c[col] !== null && String(c[col]).trim() !== '' ? (
                          String(c[col])
                        ) : (
                          <span className="text-muted text-[10px]">—</span>
                        )}
                      </td>
                    ))}
                    {canManageUsers() && (
                      <td>
                        <button onClick={() => navigate(`/contacts/${c.id}/edit`)}
                          className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-400/10 transition-colors">
                          <EditIcon size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="px-4 py-4 border-t border-subtle">
              <Pagination page={page} total={total} limit={limit} onPageChange={p => { setPage(p); doSearch(query, activeTab, p); }} />
            </div>
          )}
        </div>
      )}

      {!searched && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-center py-20 text-muted">
          <SearchIcon size={64} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Start searching</p>
          <p className="text-sm mt-1">Select a filter tab and type to search your contacts</p>
        </motion.div>
      )}
    </div>
  );
}
