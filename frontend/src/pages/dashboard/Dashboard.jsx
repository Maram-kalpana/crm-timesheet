import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import TeamLeadDashboard from './TeamLeadDashboard';

const Dashboard = () => {
  const { isAdminOnly, isHr, isTeamLead } = useAuth();
  if (isAdminOnly || isHr) return <AdminDashboard />;
  if (isTeamLead) return <TeamLeadDashboard />;
  return <EmployeeDashboard />;
};

export default Dashboard;
