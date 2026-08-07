import { Card as MuiCard, CardContent, CardHeader, CardActions, Box } from '@mui/material';

const Card = ({
  title,
  subtitle,
  action,
  children,
  footer,
  hover = true,
  padding = 3,
  sx = {},
  onClick,
  ...props
}) => (
  <MuiCard
    onClick={onClick}
    sx={{
      cursor: onClick ? 'pointer' : 'default',
      ...(hover && {
        '&:hover': { transform: 'translateY(-2px)' },
      }),
      ...sx,
    }}
    {...props}
  >
    {(title || action) && (
      <CardHeader
        title={title}
        subheader={subtitle}
        action={action}
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        subheaderTypographyProps={{ variant: 'body2' }}
        sx={{ pb: title && children ? 0 : 2 }}
      />
    )}
    {children && (
      <CardContent sx={{ p: padding, pt: title ? 2 : padding, '&:last-child': { pb: footer ? 2 : padding } }}>
        {children}
      </CardContent>
    )}
    {footer && (
      <CardActions sx={{ px: padding, pb: padding }}>
        {footer}
      </CardActions>
    )}
  </MuiCard>
);

export default Card;
