import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Box } from '@mui/material';

const Breadcrumb = ({ items = [] }) => (
  <Breadcrumbs
    separator={<ChevronRight size={14} />}
    sx={{ '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center' } }}
  >
    <Link
      component={RouterLink}
      to="/dashboard"
      underline="hover"
      color="text.secondary"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
    >
      <Home size={14} />
      Home
    </Link>
    {items.map((item, index) => {
      const isLast = index === items.length - 1;
      return isLast ? (
        <Typography key={item.label} color="text.primary" fontSize="0.875rem" fontWeight={500}>
          {item.label}
        </Typography>
      ) : (
        <Link
          key={item.label}
          component={RouterLink}
          to={item.path}
          underline="hover"
          color="text.secondary"
          fontSize="0.875rem"
        >
          {item.label}
        </Link>
      );
    })}
  </Breadcrumbs>
);

export default Breadcrumb;
