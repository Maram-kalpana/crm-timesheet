import { createTheme } from '@mui/material/styles';
import { colors, borderRadius } from './index';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.primary, light: '#60A5FA', dark: '#1D4ED8' },
    success: { main: colors.success },
    warning: { main: colors.warning },
    error: { main: colors.danger },
    background: { default: colors.background, paper: colors.card },
    text: { primary: colors.text.primary, secondary: colors.text.secondary },
    divider: colors.border,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem' },
    h2: { fontWeight: 700, fontSize: '1.5rem' },
    h3: { fontWeight: 600, fontSize: '1.25rem' },
    h4: { fontWeight: 600, fontSize: '1.125rem' },
    h5: { fontWeight: 600, fontSize: '1rem' },
    h6: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' },
        },
        contained: {
          background: `linear-gradient(135deg, ${colors.primary} 0%, #1D4ED8 100%)`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
          border: `1px solid ${colors.border}`,
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius, backgroundImage: 'none' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { borderRadius: 12 } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            backgroundColor: colors.background,
            color: colors.text.secondary,
          },
        },
      },
    },
  },
});

export default theme;
