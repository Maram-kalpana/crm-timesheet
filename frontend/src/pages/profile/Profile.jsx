import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../../components/ui';
import EmployeeProfile from '../employees/EmployeeProfile';

const Profile = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user?.empId) return <Navigate to="/dashboard" replace />;
  return <EmployeeProfile isProfileRoute />;
};

export default Profile;
