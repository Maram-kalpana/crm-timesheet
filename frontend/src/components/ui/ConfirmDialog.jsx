import Modal from './Modal';
import Button from './Button';
import { Typography } from '@mui/material';

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  danger = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    maxWidth="xs"
    actions={
      <>
        <Button variant="outlined" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button color={danger ? 'error' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <Typography variant="body1" color="text.secondary">{message}</Typography>
  </Modal>
);

export default ConfirmDialog;
