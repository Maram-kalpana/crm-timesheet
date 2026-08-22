import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/services';

const AuthContext = createContext(null);

const normalizeRole = (role) => {
  if (role === 'manager') return 'team_lead';
  return role;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const persistUser = (data) => {
    const normalized = {
      ...data.user,
      role: normalizeRole(data.user.role),
      needsLocaleSetup: data.needsLocaleSetup ?? data.user?.needsLocaleSetup ?? false,
    };
    localStorage.setItem('user', JSON.stringify(normalized));
    setUser(normalized);
    return { ...data, user: normalized };
  };

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.me();
      persistUser(data);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('token', data.token);
    return persistUser(data);
  };

  const register = async (payload) => {
    const { data } = await authAPI.register(payload);
    localStorage.setItem('token', data.token);
    return persistUser(data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const role = normalizeRole(user?.role);
  const isAdminOnly = role === 'admin';
  const isHr = role === 'hr';
  const isTeamLead = role === 'team_lead';
  const isEmployee = role === 'employee';
  const isAccountant = role === 'accountant';
  const isAdmin = isAdminOnly || isHr;
  const isManager = isTeamLead || isAdminOnly;
  const canViewAllTimesheets = isAdminOnly || isHr || isAccountant;
  const canSendClientBilling = isAdminOnly || isAccountant;

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, fetchUser,
      isAdmin, isAdminOnly, isHr, isTeamLead, isEmployee, isManager,
      isAccountant, canViewAllTimesheets, canSendClientBilling,
      needsLocaleSetup: Boolean(user?.needsLocaleSetup),
      company: user?.company || null,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
