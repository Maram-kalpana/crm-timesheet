import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Fade } from '@mui/material';
import Sidebar, { DRAWER_WIDTH, COLLAPSED_WIDTH } from './Sidebar';
import Navbar from './Navbar';
import { colors } from '../theme';

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: colors.background }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenuClick={() => setMobileOpen(true)} sidebarWidth={sidebarWidth} />
        <Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 2.5 }, pt: 1.5, pb: { xs: 2, sm: 2.5 }, overflow: 'auto' }}>
          <Fade in timeout={300}>
            <Box><Outlet /></Box>
          </Fade>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;