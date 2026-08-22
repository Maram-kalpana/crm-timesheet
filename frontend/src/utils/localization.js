export const DEFAULT_LOCALE_KEY = 'IN';

export const LOCALES = {
  IN: { key: 'IN', label: 'India', country: 'India', currency: 'INR', locale: 'en-IN' },
  UK: { key: 'UK', label: 'United Kingdom', country: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  US: { key: 'US', label: 'United States', country: 'United States', currency: 'USD', locale: 'en-US' },
};

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
];

export const getLocaleConfig = (key) => LOCALES[key] || LOCALES[DEFAULT_LOCALE_KEY];

export const formatCurrency = (amount, currency = 'INR', locale = 'en-IN') => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
};

export const formatDate = (date, locale = 'en-IN') => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
};
