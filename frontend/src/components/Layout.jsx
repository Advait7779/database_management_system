import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  DashboardIcon, ContactsIcon, SearchIcon, DownloadIcon,
  CommsIcon, UsersIcon, ReportsIcon, LogsIcon, DatabaseIcon,
  MenuIcon, CloseIcon, LogoutIcon, UserCircleIcon, ShieldIcon,
  SunIcon, MoonIcon, CalendarIcon, BellIcon, SettingsIcon, UserIcon
} from './Icons';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon, color: '#3B82F6', roles: ['super_admin','admin','staff','download_user','api_user'] },
  { path: '/contacts', label: 'Contacts', icon: ContactsIcon, color: '#8B5CF6', roles: ['super_admin','admin','staff','download_user','api_user'] },
  { path: '/search', label: 'Smart Search', icon: SearchIcon, color: '#06B6D4', roles: ['super_admin','admin','staff','download_user','api_user'] },
  { path: '/downloads', label: 'Downloads', icon: DownloadIcon, color: '#10B981', roles: ['super_admin','admin','download_user'] },
  { path: '/comms', label: 'Communications', icon: CommsIcon, color: '#EC4899', roles: ['super_admin','admin','api_user'] },
  { path: '/users', label: 'User Management', icon: UsersIcon, color: '#F59E0B', roles: ['super_admin','admin'] },
  { path: '/reports', label: 'Reports', icon: ReportsIcon, color: '#EF4444', roles: ['super_admin','admin'] },
  { path: '/logs', label: 'Activity Logs', icon: LogsIcon, color: '#94A3B8', roles: ['super_admin','admin'] },
];

const roleBadgeMap = {
  super_admin: { label: 'Super Admin', className: 'badge badge-violet' },
  admin: { label: 'Admin', className: 'badge badge-indigo' },
  staff: { label: 'Staff', className: 'badge badge-cyan' },
  download_user: { label: 'Download User', className: 'badge badge-amber' },
  api_user: { label: 'API User', className: 'badge badge-emerald' },
};

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unread, setUnread] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/reports/dashboard');
      if (res.data.success) {
        setNotifications(res.data.data?.recent_activity || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('wdb_theme') || 'dark';
    if (saved === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    return saved;
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('wdb_theme', next);
    if (next === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  };

  const getFormattedDate = () => {
    const d = new Date();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => hasRole(item.roles));
  const roleInfo = roleBadgeMap[user?.role] || { label: user?.role, className: 'badge badge-gray' };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-subtle flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
          <DatabaseIcon size={20} className="text-white" />
        </div>
        <AnimatePresence>
          {(sidebarOpen || mobileOpen) && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <p className="font-display font-bold text-sm text-white">WebDatabase</p>
              <p className="text-xs text-muted">Management System</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {filteredNav.map(({ path, label, icon: Icon, color }) => (
          <NavLink key={path} to={path} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-item group ${isActive ? 'active' : ''}`}
            style={({ isActive }) => isActive ? { borderLeft: `3px solid ${color}`, paddingLeft: '13px' } : {}}
          >
            <Icon size={20} style={{ color }} className="transition-transform duration-200 group-hover:scale-110" />
            <AnimatePresence>
              {(sidebarOpen || mobileOpen) && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap">
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User Profile section removed */}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside className="fixed left-0 top-0 h-full z-[100] w-64 lg:hidden"
            initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ background: 'var(--bg-secondary)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-muted hover:text-primary">
              <CloseIcon size={20} />
            </button>
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 h-full w-60"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 flex-shrink-0 relative z-50"
          style={{ borderBottom: '1px solid var(--topbar-border)', background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-screen-2xl mx-auto w-full flex items-center justify-between">
            {/* Left Side: Menu Toggle & Welcome Text */}
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 rounded-xl text-muted hover:text-primary transition-colors"
                onClick={() => setMobileOpen(true)}>
                <MenuIcon size={22} />
              </button>
              <span className="hidden md:block text-lg md:text-xl font-bold text-primary tracking-tight">
                Welcome Back Admin
              </span>
            </div>

            {/* Right Side: Date, Theme Switcher, Notifications, Avatar */}
            <div className="flex items-center gap-4">
              {/* Calendar & Date */}
              <div className="flex items-center gap-2 mr-2">
                <CalendarIcon size={18} className="text-teal-500 flex-shrink-0" />
                <span className="hidden sm:inline text-sm font-bold font-display tracking-tight text-primary">
                  {getFormattedDate()}
                </span>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-secondary hover:text-primary transition-all duration-200 hover:scale-110"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <SunIcon size={20} className="text-amber-500" />
                ) : (
                  <MoonIcon size={20} className="text-secondary" />
                )}
              </button>

              {/* Notification Bell & Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => { setShowNotifications(!showNotifications); setUnread(false); }}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary transition-all duration-200 hover:scale-110 relative" 
                  title="Notifications"
                >
                  <BellIcon size={20} />
                  {unread && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <>
                      {/* Click outside backdrop overlay */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 glass-card p-4 z-50 overflow-hidden text-left"
                        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)' }}
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-subtle mb-3">
                          <span className="font-bold text-sm text-primary">System Notifications</span>
                          <button 
                            onClick={() => { fetchNotifications(); setUnread(false); }}
                            className="text-xs text-indigo-400 hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {notifications.length === 0 ? (
                            <div className="text-center py-6 text-muted text-xs">No recent notifications</div>
                          ) : (
                            notifications.slice(0, 5).map((n, idx) => (
                              <div key={idx} className="pb-2 border-b border-subtle last:border-0 text-xs">
                                <div className="flex justify-between items-start gap-2 mb-1">
                                  <span className="font-semibold text-primary capitalize">
                                    {n.action.replace('_', ' ')}
                                  </span>
                                  <span className="text-[10px] text-muted whitespace-nowrap">
                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-secondary leading-relaxed">{n.description}</p>
                                <span className="text-[10px] text-indigo-400 font-medium">by {n.username}</span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="pt-2 text-center border-t border-subtle mt-2">
                          <button 
                            onClick={() => { setShowNotifications(false); navigate('/logs'); }}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            View All Activity Logs
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* User Profile Avatar Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm cursor-pointer hover:scale-105 transition-all duration-300 relative"
                  style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                  title={`${user?.full_name || user?.username} (${roleInfo.label})`}
                >
                  {(user?.username || 'S')[0].toUpperCase()}
                </button>

                <AnimatePresence>
                  {showUserDropdown && (
                    <>
                      {/* Backdrop overlay */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 glass-card p-3 z-50 text-left"
                        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)' }}
                      >
                        <div className="pb-2 border-b border-subtle mb-2 px-1">
                          <p className="text-xs font-semibold text-primary truncate">{user?.full_name || user?.username}</p>
                          <span className={`inline-block mt-1 ${roleInfo.className}`} style={{ fontSize: '10px' }}>{roleInfo.label}</span>
                        </div>
                        <div className="space-y-1">
                          <button 
                            onClick={() => { setShowUserDropdown(false); navigate('/profile'); }}
                            className="w-full text-left px-2 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-primary hover:bg-white/5 transition-all flex items-center gap-2.5"
                          >
                            <UserIcon size={16} className="text-indigo-400" /> My Profile
                          </button>
                          

                          
                          <div className="border-t border-subtle my-1" />
                          
                          <button 
                            onClick={() => { setShowUserDropdown(false); handleLogout(); }}
                            className="w-full text-left px-2 py-2 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center gap-2.5"
                          >
                            <LogoutIcon size={16} /> Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-screen-2xl mx-auto">
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

const ChevronLeftSmall = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
