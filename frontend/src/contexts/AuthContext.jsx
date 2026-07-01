import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Always use /api as base — nginx proxies it to the backend
const API_BASE = '/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('wdb_token'));
  const [loading, setLoading] = useState(true);

  // Set axios auth header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await axios.get('/auth/me');
        if (res.data.success) setUser(res.data.data);
        else logout();
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await axios.post('/auth/login', { username, password });
    if (res.data.success) {
      const { token: tk, user: u } = res.data.data;
      setToken(tk);
      setUser(u);
      localStorage.setItem('wdb_token', tk);
      axios.defaults.headers.common['Authorization'] = `Bearer ${tk}`;
      return { success: true };
    }
    return { success: false, message: res.data.message };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('wdb_token');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // Role checks
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  }, [user]);

  const canDownload = useCallback(() => hasRole(['super_admin','admin','download_user']), [hasRole]);
  const canManageUsers = useCallback(() => hasRole(['super_admin','admin']), [hasRole]);
  const canDelete = useCallback(() => hasRole(['super_admin','admin']), [hasRole]);
  const canSendComms = useCallback(() => hasRole(['super_admin','admin','api_user']), [hasRole]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, canDownload, canManageUsers, canDelete, canSendComms }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
