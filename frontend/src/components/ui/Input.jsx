import { TextField, InputAdornment } from '@mui/material';

const Input = ({
  label,
  error,
  helperText,
  startIcon,
  endIcon,
  fullWidth = true,
  ...props
}) => (
  <TextField
    label={label}
    error={!!error}
    helperText={error || helperText}
    fullWidth={fullWidth}
    variant="outlined"
    InputProps={{
      startAdornment: startIcon ? (
        <InputAdornment position="start">{startIcon}</InputAdornment>
      ) : undefined,
      endAdornment: endIcon ? (
        <InputAdornment position="end">{endIcon}</InputAdornment>
      ) : undefined,
    }}
    {...props}
  />
);

export default Input;
