import dayjs from 'dayjs';

export const formatDate = (date, format = 'DD MMM YYYY') => {
  if (!date) return '—';
  return dayjs(date).format(format);
};

export const formatDateTime = (date) => formatDate(date, 'DD MMM YYYY, hh:mm A');

export const formatCurrency = (amount) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

export const getFullName = (first, last) => `${first || ''} ${last || ''}`.trim() || 'Unknown';

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong';

export const calculateWorkingTime = (clockIn) => {
  if (!clockIn) return '00:00:00';
  const start = dayjs(clockIn);
  const diff = dayjs().diff(start, 'second');
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

export const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
