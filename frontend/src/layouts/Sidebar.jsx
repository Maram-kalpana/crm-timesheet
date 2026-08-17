import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Divider, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import {
  LayoutDashboard, Clock, Users, FolderKanban, CalendarDays,
  Wallet, FileText, Bell, ChevronLeft, ChevronRight, LogOut, Building2, UserCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';

const DRAWER_WIDTH = 200;
const COLLAPSED_WIDTH = 72;
const NAVY = '#1E3A8A';

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Attendance', icon: Clock, path: '/attendance', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Employees', icon: Users, path: '/employees', roles: ['admin', 'hr', 'team_lead', 'manager'] },
  { label: 'Projects', icon: FolderKanban, path: '/projects', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee'] },
  { label: 'Leave', icon: CalendarDays, path: '/leave', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Timesheet', icon: Wallet, path: '/payroll', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Documents', icon: FileText, path: '/documents', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Profile', icon: UserCircle, path: '/profile', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Resignations', icon: LogOut, path: '/resignations', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
  { label: 'Notifications', icon: Bell, path: '/notifications', roles: ['admin', 'hr', 'team_lead', 'manager', 'employee', 'accountant'] },
];

const Sidebar = ({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const width = collapsed && !isMobile ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const filteredMenu = menuItems.filter((item) => {
    const role = user?.role === 'manager' ? 'team_lead' : user?.role;
    return item.roles.includes(role);
  });

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff' }}>
      <Box sx={{ px: 1.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
        {(!collapsed || isMobile) && (
          <Box display="flex" alignItems="center" gap={1} minWidth={0}>
            <Box
              sx={{
                width: 32, height: 32, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Building2 size={18} color="#fff" />
            </Box>
            <Box minWidth={0}>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2} color="#fff" noWrap>HRMS</Typography>
              <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem' }}>People Platform</Typography>
            </Box>
          </Box>
        )}
        {!isMobile && (
          <IconButton size="small" onClick={onToggleCollapse} sx={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      <List sx={{ flex: 1, px: 0.75, py: 1.5 }}>
        {filteredMenu.map((item) => {
          const active = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const button = (
            <ListItemButton
              key={item.path}
              onClick={() => { navigate(item.path); onMobileClose?.(); }}
              sx={{
                borderRadius: 2, mb: 0.25, py: 0.9, px: 1.25,
                bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                '&:hover': { bgcolor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 0 : 32, color: 'inherit' }}>
                <Icon size={18} />
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 600 : 500, fontSize: '0.85rem' }} />
              )}
            </ListItemButton>
          );
          return collapsed && !isMobile ? (
            <Tooltip key={item.path} title={item.label} placement="right">{button}</Tooltip>
          ) : button;
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
      <Box sx={{ p: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar
            name={`${user?.firstName} ${user?.lastName}`}
            src={user?.avatar}
            size={collapsed && !isMobile ? 32 : 36}
          />
          {(!collapsed || isMobile) && (
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" fontWeight={600} noWrap color="#fff" sx={{ fontSize: '0.82rem' }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" noWrap sx={{ textTransform: 'capitalize', color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem' }}>
                {user?.role} {user?.designation ? `· ${user.designation}` : ''}
              </Typography>
            </Box>
          )}
          {(!collapsed || isMobile) && (
            <Tooltip title="Logout">
              <IconButton
                size="small"
                onClick={() => { logout(); navigate('/login'); }}
                sx={{ color: '#F87171', '&:hover': { bgcolor: 'rgba(248,113,113,0.15)' } }}
              >
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none', bgcolor: NAVY } }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          border: 'none',
          bgcolor: NAVY,
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
export { DRAWER_WIDTH, COLLAPSED_WIDTH, menuItems };