import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const LockerContext = createContext(null);

export function LockerProvider({ children }) {
  const [owner, setOwner] = useState(() => {
    try {
      const stored = localStorage.getItem('smart_locker_owner');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('smart_locker_token'));
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAuthenticated = Boolean(token && owner);

  // Fetch dashboard telemetry from real backend
  const refreshDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getDashboard();
      if (res.success && res.data) {
        setDashboardData(res.data);
        setError(null);
      }
    } catch (err) {
      console.warn('[LockerContext] Telemetry fetch warning:', err.message);
      // If server is unreachable
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Backend server offline or unreachable.');
      }
    }
  }, [token]);

  // Initial user verification
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      if (token) {
        try {
          const res = await api.getCurrentUser();
          if (isMounted && res.success && res.owner) {
            setOwner(res.owner);
            localStorage.setItem('smart_locker_owner', JSON.stringify(res.owner));
          }
        } catch (err) {
          if (isMounted) {
            setOwner(null);
            setToken(null);
            localStorage.removeItem('smart_locker_token');
            localStorage.removeItem('smart_locker_owner');
          }
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    }

    checkAuth();
    return () => { isMounted = false; };
  }, [token]);

  // Real-time telemetry polling (every 3 seconds when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    refreshDashboard();
    const interval = setInterval(refreshDashboard, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshDashboard]);

  // Login handler
  const login = async (usernameOrEmail, password) => {
    try {
      const res = await api.login(usernameOrEmail, password);
      if (res.success && res.token) {
        setToken(res.token);
        setOwner(res.owner);
        setError(null);
        await refreshDashboard();
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Invalid credentials or server error.' };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore
    } finally {
      setToken(null);
      setOwner(null);
      setDashboardData(null);
    }
  };

  // Update profile
  const updateOwner = (updatedOwner) => {
    setOwner(updatedOwner);
    localStorage.setItem('smart_locker_owner', JSON.stringify(updatedOwner));
  };

  const value = {
    isAuthenticated,
    owner,
    token,
    dashboardData,
    loading,
    error,
    refreshDashboard,
    login,
    logout,
    updateOwner
  };

  return (
    <LockerContext.Provider value={value}>
      {children}
    </LockerContext.Provider>
  );
}

export function useLocker() {
  const context = useContext(LockerContext);
  if (!context) {
    throw new Error('useLocker must be used within a LockerProvider');
  }
  return context;
}

export default LockerContext;
