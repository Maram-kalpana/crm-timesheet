import { Avatar as MuiAvatar } from '@mui/material';
import { colors } from '../../theme';

const Avatar = ({ src, name, size = 40, sx = {} }) => {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <MuiAvatar
      src={src}
      sx={{
        width: size,
        height: size,
        bgcolor: colors.primary,
        fontSize: size * 0.4,
        fontWeight: 600,
        ...sx,
      }}
    >
      {!src && initials}
    </MuiAvatar>
  );
};

export default Avatar;
