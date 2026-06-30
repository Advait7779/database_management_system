import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, hasRole } = useAuth();
  
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    designation: user?.designation || ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const [sessions, setSessions] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const res = await axios.get('/auth/me/sessions');
      if (res.data.success) {
        setSessions(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const res = await axios.put('/auth/me/profile', profileForm);
      if (res.data.success) {
        toast.success('Profile details updated successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile details');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      return toast.error('New passwords do not match');
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters');
    }
    setPwLoading(true);
    try {
      const res = await axios.put('/auth/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      if (res.data.success) {
        toast.success('Password updated successfully');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  const roleLabel = {
    super_admin: 'SUPER ADMIN',
    admin: 'ADMIN',
    staff: 'STAFF',
    download_user: 'DOWNLOAD USER',
    api_user: 'API USER'
  };

  const roleBadgeColor = {
    super_admin: 'rgba(139,92,246,0.15)',
    admin: 'rgba(99,102,241,0.15)',
    staff: 'rgba(6,182,212,0.15)',
    download_user: 'rgba(245,158,11,0.15)',
    api_user: 'rgba(16,185,129,0.15)'
  };

  const roleTextColor = {
    super_admin: '#8B5CF6',
    admin: '#6366F1',
    staff: '#0891B2',
    download_user: '#D97706',
    api_user: '#10B981'
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your personal information, security settings, and view system credentials.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Cards) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Profile Overview Card */}
          <div className="glass-card p-6 text-center">
            <div className="flex flex-col items-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-3xl mb-4"
                style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
              >
                {(user?.username || 'S')[0].toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">{profileForm.full_name || user?.username}</h2>
              <span 
                className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider border mb-6"
                style={{
                  background: roleBadgeColor[user?.role] || 'rgba(255,255,255,0.05)',
                  color: roleTextColor[user?.role] || '#94A3B8',
                  borderColor: roleTextColor[user?.role] + '30'
                }}
              >
                {roleLabel[user?.role] || 'USER'}
              </span>
            </div>

            <div className="text-left space-y-4 pt-4 border-t border-subtle">
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted tracking-wider">Email Address</span>
                <span className="text-sm font-medium text-secondary truncate block">{profileForm.email || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted tracking-wider">System Designation</span>
                <span className="text-sm font-medium text-secondary truncate block">{profileForm.designation || 'Global Root Administrator'}</span>
              </div>
            </div>
          </div>

          {/* Permissions Card */}
          <div className="glass-card p-6">
            <h3 className="font-semibold font-display text-sm text-primary mb-4 uppercase tracking-wider">Root Control Permissions</h3>
            <ul className="space-y-3.5">
              {[
                { label: 'Full Read & Write Access', grant: hasRole(['super_admin', 'admin']) },
                { label: 'User Management & Role Assignment', grant: hasRole(['super_admin', 'admin']) },
                { label: 'Financial Ledger & Invoice Creation', grant: hasRole(['super_admin', 'admin']) },
                { label: 'System Configuration Settings', grant: hasRole(['super_admin', 'admin']) },
                { label: 'Activity Audit Log Viewing', grant: hasRole(['super_admin', 'admin']) },
                { label: 'Database Backup & Restore Operations', grant: hasRole(['super_admin']) }
              ].map((p, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${p.grant ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {p.grant ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${p.grant ? 'text-secondary' : 'text-muted line-through'}`}>{p.label}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Right Column (Forms) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Details Form Card */}
          <div className="glass-card p-6">
            <h3 className="font-semibold font-display text-primary mb-5 text-base">Personal Profile Details</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Full Name *</label>
                  <input 
                    name="full_name"
                    value={profileForm.full_name} 
                    onChange={handleProfileChange}
                    placeholder="Enter full name" 
                    className="input-field" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Email Address *</label>
                  <input 
                    name="email"
                    type="email"
                    value={profileForm.email} 
                    onChange={handleProfileChange}
                    placeholder="Enter email address" 
                    className="input-field" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Phone Number</label>
                  <input 
                    name="phone"
                    value={profileForm.phone} 
                    onChange={handleProfileChange}
                    placeholder="Enter phone number" 
                    className="input-field" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Designation Badge</label>
                  <input 
                    name="designation"
                    value={profileForm.designation} 
                    onChange={handleProfileChange}
                    placeholder="e.g. Global Administrator" 
                    className="input-field" 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={saveLoading} className="btn-primary">
                  {saveLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save Profile Details
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Password Reset Form Card */}
          <div className="glass-card p-6">
            <h3 className="font-semibold font-display text-primary mb-5 text-base">Security & Password Update</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Current Password</label>
                  <input 
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword} 
                    onChange={handlePasswordChange}
                    placeholder="••••••••" 
                    className="input-field" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">New Password</label>
                  <input 
                    name="newPassword"
                    type="password"
                    value={passwordForm.newPassword} 
                    onChange={handlePasswordChange}
                    placeholder="Min 6 chars" 
                    className="input-field" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-2 uppercase tracking-wider">Confirm New Password</label>
                  <input 
                    name="confirmNewPassword"
                    type="password"
                    value={passwordForm.confirmNewPassword} 
                    onChange={handlePasswordChange}
                    placeholder="••••••••" 
                    className="input-field" 
                    required 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={pwLoading} className="btn-primary">
                  {pwLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>


        </div>

      </div>
    </div>
  );
}
