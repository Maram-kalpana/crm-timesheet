import { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, IconButton } from '@mui/material';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { notificationAPI } from '../../services/services';
import { Card, Button, Loader, EmptyState } from '../../components/ui';
import { colors } from '../../theme';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const typeColors = {
  info: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
  leave: '#8B5CF6',
  attendance: colors.primary,
  payroll: colors.success,
  project: colors.warning,
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationAPI.getAll({ limit: 50 });
      setNotifications(data.data);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      fetchNotifications();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (loading) return <Loader />;

  return (
    <Box>
      {unreadCount > 0 && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button variant="outlined" startIcon={<CheckCheck size={18} />} onClick={markAllRead}>
            Mark all read
          </Button>
        </Box>
      )}

      <Card>
        {!notifications.length ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          <List disablePadding>
            {notifications.map((n) => (
              <ListItem
                key={n.id}
                sx={{
                  bgcolor: n.is_read ? 'transparent' : `${colors.primary}06`,
                  borderRadius: 2,
                  mb: 1,
                  border: `1px solid ${colors.border}`,
                  '&:hover': { bgcolor: colors.background },
                }}
                secondaryAction={
                  !n.is_read && (
                    <IconButton edge="end" onClick={() => markRead(n.id)} size="small">
                      <CheckCheck size={18} />
                    </IconButton>
                  )
                }
              >
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%', mr: 2, flexShrink: 0,
                    bgcolor: n.is_read ? 'transparent' : (typeColors[n.type] || colors.primary),
                  }}
                />
                <ListItemText
                  primary={<Typography fontWeight={n.is_read ? 400 : 600}>{n.title}</Typography>}
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">{n.message}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDateTime(n.created_at)}</Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Card>
    </Box>
  );
};

export default Notifications;