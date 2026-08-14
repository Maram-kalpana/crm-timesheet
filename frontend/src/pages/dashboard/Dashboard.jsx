import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import TeamLeadDashboard from './TeamLeadDashboard';
import AccountantDashboard from './AccountantDashboard';

const Dashboard = () => {
  const { isAdminOnly, isHr, isTeamLead, isAccountant } = useAuth();
  if (isAccountant) return <AccountantDashboard />;
  if (isAdminOnly || isHr) return <AdminDashboard />;
  if (isTeamLead) return <TeamLeadDashboard />;
  return <EmployeeDashboard />;
};

export default Dashboard;
