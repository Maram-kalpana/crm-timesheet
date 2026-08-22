import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { companyAPI } from '../services/services';
import { Button, Select } from './ui';
import { LOCALES, CURRENCY_OPTIONS } from '../utils/localization';
import { getErrorMessage } from '../utils/helpers';

const countryOptions = Object.values(LOCALES).map((l) => ({
  value: l.key,
  label: l.label,
}));

const CompanyLocaleSetupDialog = () => {
  const { user, isAdminOnly, fetchUser } = useAuth();
  const companyId = user?.companyId || user?.company?.id;
  const needsSetup = Boolean(
    isAdminOnly &&
    (user?.needsLocaleSetup || (user?.company && !user.company.localeConfiguredAt))
  );

  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      country: user?.company?.country || 'IN',
      currency: user?.company?.currency || LOCALES.IN.currency,
    },
  });

  const country = watch('country');
  useEffect(() => {
    if (LOCALES[country]) {
      setValue('currency', LOCALES[country].currency);
    }
  }, [country, setValue]);

  if (!needsSetup || !companyId) return null;

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await companyAPI.updateLocale(companyId, {
        country: data.country,
        currency: data.currency,
      });
      toast.success('Company locale saved');
      await fetchUser();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      disableEscapeKeyDown
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return;
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>Set up company locale</Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Choose the country and base currency for {user?.company?.name || 'your company'}. This can only be set once from this screen.
        </Typography>
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
            <Controller
              name="country"
              control={control}
              rules={{ required: 'Country is required' }}
              render={({ field, fieldState }) => (
                <Select
                  label="Country"
                  options={countryOptions}
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              name="currency"
              control={control}
              rules={{ required: 'Currency is required' }}
              render={({ field, fieldState }) => (
                <Select
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button type="submit" loading={saving}>Save & Continue</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CompanyLocaleSetupDialog;
