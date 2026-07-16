import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, clearAuthTokens } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.getMe()
        .then(({ data }) => {
          setUser(data.data);
          localStorage.setItem('user', JSON.stringify(data.data));
        })
        .catch(() => {
          clearAuthTokens();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await authAPI.login(credentials);
    const { user, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    toast.success(`Welcome back, ${user.name}!`);
    return user;
  }, []);

  const register = useCallback(async (userData) => {
    const { data } = await authAPI.register(userData);
    const { user, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    toast.success('Account created! Welcome to DataHive.');
    return user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await authAPI.logout(refreshToken); } catch {}
    clearAuthTokens();
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await authAPI.getMe();
    setUser(data.data);
    localStorage.setItem('user', JSON.stringify(data.data));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
