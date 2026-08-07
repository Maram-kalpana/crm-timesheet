import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';

const DatePicker = ({ label, value, onChange, error, helperText, ...props }) => (
  <MuiDatePicker
    label={label}
    value={value}
    onChange={onChange}
    slotProps={{
      textField: {
        fullWidth: true,
        error: !!error,
        helperText: error || helperText,
      },
    }}
    {...props}
  />
);

export default DatePicker;
