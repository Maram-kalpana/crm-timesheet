import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  Paper, Box, Typography, TablePagination, IconButton, Menu, MenuItem, Skeleton,
} from '@mui/material';
import { MoreVertical, Download } from 'lucide-react';
import { useState } from 'react';
import EmptyState from './EmptyState';
import Button from './Button';
import { colors } from '../../theme';

const DataTable = ({
  columns,
  rows,
  loading = false,
  pagination,
  onPageChange,
  onRowsPerPageChange,
  onSort,
  sortBy,
  sortOrder,
  onExport,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display.',
  actions,
  stickyHeader = true,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleMenuOpen = (event, row) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  if (loading) {
    return (
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height={56} sx={{ mx: 2, my: 1 }} />
        ))}
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
      {onExport && (
        <Box display="flex" justifyContent="flex-end" p={2} pb={0}>
          <Button variant="outlined" size="small" startIcon={<Download size={16} />} onClick={onExport}>
            Export
          </Button>
        </Box>
      )}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field} align={col.align || 'left'} sx={{ minWidth: col.minWidth }}>
                  {col.sortable && onSort ? (
                    <TableSortLabel
                      active={sortBy === col.field}
                      direction={sortBy === col.field ? sortOrder : 'asc'}
                      onClick={() => onSort(col.field)}
                    >
                      {col.headerName}
                    </TableSortLabel>
                  ) : (
                    col.headerName
                  )}
                </TableCell>
              ))}
              {actions && <TableCell align="right" sx={{ width: 60 }}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {!rows?.length ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row.id || index} hover sx={{ '&:last-child td': { border: 0 } }}>
                  {columns.map((col) => (
                    <TableCell key={col.field} align={col.align || 'left'}>
                      {col.renderCell ? col.renderCell({ row, value: row[col.field] }) : row[col.field]}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, row)}>
                        <MoreVertical size={18} />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          rowsPerPage={pagination.limit}
          onPageChange={(_, page) => onPageChange?.(page + 1)}
          onRowsPerPageChange={(e) => onRowsPerPageChange?.(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      )}
      {actions && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          {actions(selectedRow)?.map((action) => (
            <MenuItem
              key={action.label}
              onClick={() => { action.onClick(selectedRow); handleMenuClose(); }}
              disabled={action.disabled}
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Paper>
  );
};

export default DataTable;
