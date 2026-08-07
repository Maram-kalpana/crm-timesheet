import { InputAdornment, TextField } from '@mui/material';
import { Search } from 'lucide-react';

const SearchBar = ({ value, onChange, placeholder = 'Search...', fullWidth = true, sx = {} }) => (
  <TextField
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    fullWidth={fullWidth}
    size="small"
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <Search size={18} />
        </InputAdornment>
      ),
    }}
    sx={{
      '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.paper' },
      ...sx,
    }}
  />
);

export default SearchBar;
