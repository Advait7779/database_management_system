import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckIcon, ChevronLeftIcon } from '../components/Icons';
import CustomSelect from '../components/CustomSelect';

const fields = [
  { name: 'name', label: 'Full Name', type: 'text', required: true, col: 2 },
  { name: 'mobile', label: 'Mobile Number', type: 'tel', required: true },
  { name: 'email', label: 'Email Address', type: 'email' },
  { name: 'gender', label: 'Gender', type: 'select', required: true, options: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
  ] },
  { name: 'address', label: 'Address', type: 'text', col: 2 },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'state', label: 'State', type: 'text' },
  { name: 'village', label: 'Village', type: 'text' },
  { name: 'pincode', label: 'PIN Code', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea', col: 2 },
];

export default function AddEditContact() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', gender: 'male',
    address: '', city: '', state: '', village: '', pincode: '', notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    const fetchContact = async () => {
      try {
        const res = await axios.get(`/contacts/${id}`);
        if (res.data.success) {
          const c = res.data.data;
          setForm({
            name: c.name || '', mobile: c.mobile || '',
            email: c.email || '', gender: c.gender || 'male', address: c.address || '',
            city: c.city || '', state: c.state || '', village: c.village || '',
            pincode: c.pincode || '', notes: c.notes || ''
          });
        }
      } catch { toast.error('Failed to load contact'); }
      finally { setFetching(false); }
    };
    fetchContact();
  }, [id, isEdit]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Full Name is required');
    if (!form.mobile.trim()) return toast.error('Mobile Number is required');
    setLoading(true);
    try {
      if (isEdit) {
        await axios.put(`/contacts/${id}`, form);
        toast.success('Contact updated successfully!');
      } else {
        await axios.post('/contacts', form);
        toast.success('Contact added successfully!');
      }
      navigate('/contacts');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save contact');
    } finally { setLoading(false); }
  };

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );

  return (
    <div>
      <div className="page-header max-w-4xl mx-auto">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-muted hover:text-primary transition-colors mb-4 text-sm">
          <ChevronLeftIcon size={16} /> Back to Contacts
        </button>
        <h1 className="page-title">{isEdit ? 'Edit Contact' : 'Add New Contact'}</h1>
        <p className="page-subtitle">{isEdit ? 'Update contact information' : 'Create a new contact record'}</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="glass-card p-8 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((f) => (
              <div key={f.name} className={f.col === 2 ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                  {f.label}{f.required && <span className="text-rose-400 ml-1">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea name={f.name} value={form[f.name]} onChange={handleChange} rows={3}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                    className="input-field resize-none" />
                ) : f.type === 'select' ? (
                  <CustomSelect
                    value={form[f.name]}
                    onChange={val => setForm(p => ({ ...p, [f.name]: val }))}
                    options={f.options}
                    className="w-full"
                  />
                ) : (
                  <input name={f.name} type={f.type} value={form[f.name]} onChange={handleChange}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                    className="input-field" required={f.required} />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-8 pt-6 border-t border-subtle">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><CheckIcon size={16} /> {isEdit ? 'Update Contact' : 'Add Contact'}</>
              )}
            </button>
            <button type="button" onClick={() => navigate('/contacts')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
