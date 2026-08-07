import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography, Box,
} from '@mui/material';
import { X } from 'lucide-react';
import Button from './Button';

const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  loading = false,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth={maxWidth}
    fullWidth={fullWidth}
    PaperProps={{
      sx: { borderRadius: 3, p: 1 },
    }}
  >
    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1 }}>
      <Box>
        <Typography variant="h6" fontWeight={600}>{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" mt={0.5}>{subtitle}</Typography>
        )}
      </Box>
      <IconButton onClick={onClose} size="small" sx={{ mt: -0.5 }}>
        <X size={20} />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers={!!actions}>{children}</DialogContent>
    {actions && (
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {actions}
      </DialogActions>
    )}
  </Dialog>
);

export default Modal;
