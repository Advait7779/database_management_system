import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SMSIcon, WhatsAppIcon, VoiceIcon, SendIcon } from '../components/Icons';
import CustomSelect from '../components/CustomSelect';

const tabs = [
  { key: 'sms', label: 'SMS', icon: SMSIcon, color: '#6366F1' },
  { key: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, color: '#25D366' },
  { key: 'voice', label: 'Voice Call', icon: VoiceIcon, color: '#FBBF24' },
];

const statusBadge = (s) => {
  if (s === 'sent') return 'badge-emerald';
  if (s === 'failed') return 'badge-rose';
  return 'badge-amber';
};

const maskMobile = (mobile) => {
  if (!mobile) return '—';
  const str = String(mobile).trim();
  if (str.length <= 5) return str;
  return str.slice(0, -5) + 'xxxxx';
};

export default function Communications() {
  const [activeTab, setActiveTab] = useState('sms');
  const [mobiles, setMobiles] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('promotional');
  const [mediaUrl, setMediaUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
    if (activeTab === 'sms') setMsgType('promotional');
    else if (activeTab === 'whatsapp') setMsgType('text');
    else setMsgType('automated');
  }, [activeTab]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const endpoint = activeTab === 'sms' ? '/comms/sms-logs' : activeTab === 'whatsapp' ? '/comms/whatsapp-logs' : '/comms/sms-logs';
      const res = await axios.get(endpoint);
      if (res.data.success) setLogs(res.data.data || []);
    } catch { } finally { setLogsLoading(false); }
  };

  const getMsgTypeOptions = () => {
    if (activeTab === 'sms') {
      return [
        { value: 'promotional', label: 'Promotional' },
        { value: 'transactional', label: 'Transactional' },
        { value: 'otp', label: 'OTP' },
      ];
    } else if (activeTab === 'whatsapp') {
      return [
        { value: 'text', label: 'Text' },
        { value: 'image', label: 'Image' },
        { value: 'pdf', label: 'PDF/Document' },
      ];
    } else {
      return [
        { value: 'automated', label: 'Automated' },
        { value: 'ivr', label: 'IVR' },
        { value: 'alert', label: 'Alert' },
      ];
    }
  };

  const getMobileList = () => mobiles.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);

  const handleSend = async () => {
    const mobileList = getMobileList();
    if (mobileList.length === 0) return toast.error('Enter at least one mobile number');
    if (activeTab !== 'voice' && !message.trim()) return toast.error('Enter a message');
    setSending(true);
    try {
      let endpoint = `/comms/${activeTab === 'voice' ? 'voice' : activeTab}`;
      let body = { mobiles: mobileList };
      if (activeTab === 'sms') body = { ...body, message, type: msgType };
      else if (activeTab === 'whatsapp') body = { ...body, message_type: msgType, message, media_url: mediaUrl };
      else body = { ...body, call_type: msgType };
      await axios.post(endpoint, body);
      toast.success(`${activeTab.toUpperCase()} sent to ${mobileList.length} recipient(s)!`);
      setMobiles(''); setMessage(''); setMediaUrl('');
      fetchLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally { setSending(false); }
  };

  const tabConfig = tabs.find(t => t.key === activeTab);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Communications</h1>
        <p className="page-subtitle">Send SMS, WhatsApp messages, and Voice calls</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {tabs.map(({ key, label, icon: Icon, color }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === key ? 'text-white' : 'btn-secondary'}`}
            style={activeTab === key ? { background: color, boxShadow: `0 4px 12px ${color}40` } : {}}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 glass-card p-6 relative z-20">
          <h2 className="font-semibold font-display text-primary mb-5 flex items-center gap-2">
            <tabConfig.icon size={20} /> Compose {tabConfig.label}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                Mobile Numbers <span className="text-muted font-normal">(comma or newline separated)</span>
              </label>
              <textarea value={mobiles} onChange={e => setMobiles(e.target.value)} rows={4}
                placeholder="9876543210&#10;9123456780" className="input-field resize-none font-mono text-sm" />
              <p className="text-xs text-muted mt-1">{getMobileList().length} number(s)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                {activeTab === 'sms' ? 'Message Type' : activeTab === 'whatsapp' ? 'Message Type' : 'Call Type'}
              </label>
              <CustomSelect
                value={msgType}
                onChange={val => setMsgType(val)}
                options={getMsgTypeOptions()}
                className="w-full"
              />
            </div>
            {activeTab !== 'voice' && (
              <div>
                <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                  Message {activeTab === 'sms' && <span className="text-muted font-normal">({message.length}/160)</span>}
                </label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                  placeholder="Type your message..." className="input-field resize-none" />
              </div>
            )}
            {activeTab === 'whatsapp' && ['image', 'pdf'].includes(msgType) && (
              <div>
                <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Media URL</label>
                <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg" className="input-field" />
              </div>
            )}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleSend} disabled={sending}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all"
              style={{ background: tabConfig.color, boxShadow: `0 4px 12px ${tabConfig.color}40` }}>
              {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SendIcon size={18} />}
              Send {tabConfig.label}
            </motion.button>
          </div>
        </div>

        {/* Logs */}
        <div className="lg:col-span-3 glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-subtle">
            <h2 className="font-semibold font-display text-primary">Recent Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Mobile</th><th>Message/Type</th><th>Status</th><th>Time</th></tr>
              </thead>
              <tbody>
                {logsLoading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(4).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
                )) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-muted">No logs yet</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono text-sm">{maskMobile(log.mobile)}</td>
                    <td className="text-xs max-w-xs truncate">{log.message || log.call_type || log.message_type || '—'}</td>
                    <td><span className={`badge ${statusBadge(log.status)}`}>{log.status}</span></td>
                    <td className="text-xs text-muted">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
