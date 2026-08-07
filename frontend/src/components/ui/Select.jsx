import { forwardRef } from 'react';
import { FormControl, InputLabel, Select as MuiSelect, MenuItem, FormHelperText } from '@mui/material';

const Select = forwardRef(({
  label,
  value,
  onChange,
  options = [],
  error,
  helperText,
  fullWidth = true,
  multiple,
  name,
  defaultValue = '',
  ...props
}, ref) => (
  <FormControl fullWidth={fullWidth} error={!!error}>
    <InputLabel>{label}</InputLabel>
    <MuiSelect
      label={label}
      name={name}
      value={value ?? defaultValue}
      onChange={onChange}
      multiple={multiple}
      inputRef={ref}
      {...props}
    >
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </MuiSelect>
    {(error || helperText) && <FormHelperText>{error || helperText}</FormHelperText>}
  </FormControl>
));

Select.displayName = 'Select';

export default Select;
