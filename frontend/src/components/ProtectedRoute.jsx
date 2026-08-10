import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/services';
import { Box, CircularProgress } from '@mui/material';
import { colors } from '../theme';

export const SetupGuard = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const location = useLocation();

  useEffect(() => {
    authAPI.setupStatus()
      .then(({ data }) => setNeedsSetup(data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (authLoading || needsSetup === null) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor={colors.background}>
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (needsSetup && location.pathname !== '/register' && location.pathname !== '/Register') {
    return <Navigate to="/register" replace />;
  }

  if (!needsSetup && (location.pathname === '/register' || location.pathname === '/Register')) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const location = useLocation();

  useEffect(() => {
    authAPI.setupStatus()
      .then(({ data }) => setNeedsSetup(data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (loading || needsSetup === null) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor={colors.background}>
        <CircularProgress />
      </Box>
    );
  }

  if (needsSetup) {
    return <Navigate to="/register" replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles) {
    const userRole = user.role === 'manager' ? 'team_lead' : user.role;
    if (!roles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
