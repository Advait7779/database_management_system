import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseIcon, EyeIcon, EyeOffIcon, ShieldIcon } from '../components/Icons';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        toast.error(res.message || 'Invalid credentials');
      }
    } catch (err) {
      toast.error('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060B18 0%, #0D1526 50%, #060B18 100%)' }}>
      {/* Glow orbs */}
      <div className="glow-orb w-96 h-96 -top-20 -left-20" style={{ background: '#6366F1', opacity: 0.12 }} />
      <div className="glow-orb w-80 h-80 bottom-0 right-0" style={{ background: '#8B5CF6', opacity: 0.1 }} />
      <div className="glow-orb w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: '#22D3EE', opacity: 0.06 }} />

      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md mx-4 relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5 mx-auto"
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 8px 32px rgba(0,0,0,0.5)'
            }}>
            <DatabaseIcon size={36} />
          </motion.div>
          <h1 className="text-3xl font-bold font-display gradient-text mb-2">WebDatabase MS</h1>
          <p className="text-secondary text-sm">Enterprise Contact Management Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldIcon size={18} />
            <span className="text-sm font-semibold text-secondary">Secure Login</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-field"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pr-11"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors">
                  {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white text-sm mt-2 flex items-center justify-center gap-3 transition-all duration-300"
              style={{
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.5)',
              }}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : 'Sign In'}
            </motion.button>
          </form>

          {/* Hint */}
          <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-xs text-muted text-center">
              Default credentials: <span className="text-indigo-400 font-mono font-semibold">admin</span> / <span className="text-indigo-400 font-mono font-semibold">Admin@123</span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          WebDatabase MS v1.0 — All activity is monitored and logged
        </p>
      </motion.div>
    </div>
  );
}
