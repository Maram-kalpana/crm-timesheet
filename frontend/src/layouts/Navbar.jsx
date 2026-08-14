import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Box, Badge, Menu, MenuItem,
  Typography, InputBase, alpha, Tooltip,
} from '@mui/material';
import { Menu as MenuIcon, Bell, Search, Moon, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { notificationAPI } from '../services/services';
import { colors } from '../theme';
import { menuItems } from './Sidebar';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);

  const currentPage = menuItems.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = location.pathname.startsWith('/employees/')
    ? 'Employee Profile'
    : (currentPage?.label || 'Dashboard');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await notificationAPI.getAll({ unreadOnly: true, limit: 1 });
        setUnreadCount(data.unreadCount || 0);
      } catch { /* silent */ }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        width: '100%',
        bgcolor: alpha(colors.card, 0.85),
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${colors.border}`,
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ gap: 2, minHeight: { xs: 56, sm: 60 }, py: 0.5 }}>
        <IconButton edge="start" onClick={onMenuClick} sx={{ display: { md: 'none' } }}>
          <MenuIcon size={22} />
        </IconButton>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, pl: 2 }}>
  <Typography
    variant="h5"
    fontWeight={700}
    noWrap
    sx={{ display: { xs: 'none', sm: 'block' } }}
  >
    {pageTitle}
  </Typography>
</Box>

        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            bgcolor: colors.background,
            borderRadius: 3,
            px: 2, py: 0.75,
            width: '100%', maxWidth: 400,
            border: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <Search size={18} color={colors.text.muted} />
          <InputBase
            placeholder="Search employees, projects..."
            sx={{ ml: 1, flex: 1, fontSize: '0.875rem' }}
          />
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          <Tooltip title="Dark mode (coming soon)">
            <IconButton size="small" disabled sx={{ opacity: 0.5 }}>
              <Moon size={20} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton size="small" onClick={() => navigate('/notifications')}>
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <Bell size={20} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Box
            display="flex"
            alignItems="center"
            gap={1}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ cursor: 'pointer', borderRadius: 2, p: 0.5, '&:hover': { bgcolor: colors.background } }}
          >
            <Avatar name={`${user?.firstName} ${user?.lastName}`} src={user?.avatar} size={36} />
            <Box display={{ xs: 'none', lg: 'block' }}>
              <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {user?.role}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
            <User size={16} style={{ marginRight: 8 }} /> Profile
          </MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }}>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;