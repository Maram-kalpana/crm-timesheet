import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

const Dashboard = () => {
  const { isAdmin, isManager } = useAuth();
  return isAdmin || isManager ? <AdminDashboard /> : <EmployeeDashboard />;
};

export default Dashboard;
