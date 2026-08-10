import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../../components/ui';

const Profile = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user?.empId) return <Navigate to="/dashboard" replace />;
  return <Navigate to={`/employees/${user.empId}`} replace />;
};

export default Profile;
