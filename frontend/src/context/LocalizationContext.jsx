import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  DEFAULT_LOCALE_KEY,
  LOCALES,
  getLocaleConfig,
  formatCurrency as formatCurrencyUtil,
  formatDate as formatDateUtil,
} from '../utils/localization';

const LocalizationContext = createContext(null);

const STORAGE_KEY = 'viewerLocale';

export const LocalizationProvider = ({ children }) => {
  const { user } = useAuth();
  const companyCountry = user?.company?.country;
  const companyCurrency = user?.company?.currency;

  const [viewerLocale, setViewerLocaleState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const localeKey = viewerLocale || (LOCALES[companyCountry] ? companyCountry : null) || DEFAULT_LOCALE_KEY;
  const config = getLocaleConfig(localeKey);
  const currency = companyCurrency || config.currency;

  useEffect(() => {
    // Seed from company country only when the user has not manually overridden locale.
    if (!viewerLocale && companyCountry && LOCALES[companyCountry]) {
      // no-op: localeKey already falls back to companyCountry
    }
  }, [viewerLocale, companyCountry]);

  const setViewerLocale = (key) => {
    setViewerLocaleState(key);
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const value = useMemo(() => ({
    localeKey,
    config,
    currency,
    LOCALES,
    viewerLocale,
    setViewerLocale,
    formatCurrency: (amount, overrideCurrency) =>
      formatCurrencyUtil(amount, overrideCurrency || currency, config.locale),
    formatDate: (date) => formatDateUtil(date, config.locale),
  }), [localeKey, config, currency, viewerLocale]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
};
