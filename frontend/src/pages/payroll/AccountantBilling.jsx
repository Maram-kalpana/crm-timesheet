import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { timesheetAPI } from '../../services/services';
import { getErrorMessage } from '../../utils/helpers';

const inputStyle = {
  border: '1px solid #e3e6ea',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 15,
  color: '#1c1f26',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
};

const STATUS_BADGE = {
  sent: { label: 'Sent', bg: '#e0e7ff', fg: '#3730a3' },
  partially_received: { label: 'Partially Paid', bg: '#fef3c7', fg: '#92400e' },
  received: { label: 'Paid ✓', bg: '#dcfce7', fg: '#166534' },
  not_received: { label: 'Not Received', bg: '#fee2e2', fg: '#991b1b' },
};

function groupKey(entry) {
  const client = (entry.client || 'Unknown Client').trim();
  const period = entry.period_label || entry.period || 'No period';
  return `${client}|||${period}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountantBilling({ history, onRefresh, onView }) {
  const [selected, setSelected] = useState(new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [rateOverrides, setRateOverrides] = useState({});

  // --- payment recording (against the invoice created on send) ---
  // paymentModal stores the group `key` (not just a snapshot of items) so we can
  // always re-resolve the freshest version of the group from `groups` at action time.
  const [paymentModal, setPaymentModal] = useState(null); // { key, group } | null
  const [paymentForm, setPaymentForm] = useState({ transactionId: '', amount: '', date: todayISO(), notes: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [savingPayment, setSavingPayment] = useState(false);
  const [notReceivedModal, setNotReceivedModal] = useState(null); // { key, group } | null
  const [notReceivedReason, setNotReceivedReason] = useState('');
  const [savingNotReceived, setSavingNotReceived] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    history.forEach((entry) => {
      const key = groupKey(entry);
      if (!map.has(key)) {
        map.set(key, {
          key,
          client: entry.client || 'Unknown Client',
          period: entry.period_label || entry.period || 'No period',
          periodType: entry.period_type || entry.periodType,
          items: [],
        });
      }
      map.get(key).items.push(entry);
    });
    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [history]);

  const groupsByKey = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(g.key, g));
    return map;
  }, [groups]);

  const selectedEntries = useMemo(
    () => history.filter((e) => selected.has(e.id)),
    [history, selected]
  );

  const getEffectiveRate = (entry) => {
    const override = rateOverrides[entry.id];
    return override !== undefined && override !== '' ? parseFloat(override) || 0 : (parseFloat(entry.rate_value ?? entry.rateValue) || 0);
  };

  const getEffectiveWage = (entry) => {
    const rate = getEffectiveRate(entry);
    const hours = parseFloat(entry.total_hours ?? entry.totalHours) || 0;
    return rate * hours;
  };

  const combinedTotal = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + getEffectiveWage(e), 0),
    [selectedEntries, rateOverrides]
  );

  const isSent = (entry) => Boolean(entry.sent_to_client_at || entry.sentToClient);

  const toggleSelect = (id, entry) => {
    if (isSent(entry)) {
      toast.info('This timesheet was already sent to the client');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (items) => {
    const pending = items.filter((i) => !isSent(i));
    if (!pending.length) {
      toast.info('All timesheets in this group are already sent');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pending.every((i) => next.has(i.id));
      pending.forEach((i) => {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  };

  const openSendModal = () => {
    if (!selectedEntries.length) {
      toast.error('Select at least one timesheet');
      return;
    }
    const clients = [...new Set(selectedEntries.map((e) => (e.client || '').trim()))];
    const periods = [...new Set(selectedEntries.map((e) => e.period_label || e.period))];
    if (clients.length > 1 || periods.length > 1) {
      toast.error('Select timesheets from the same client and period');
      return;
    }
    setClientEmail('');
    setCc('');
    setSubject(`Timesheet Invoice - ${clients[0] || 'Client'} - ${periods[0] || ''}`);
    const initialRates = {};
    selectedEntries.forEach((e) => {
      initialRates[e.id] = e.rate_value ?? e.rateValue ?? '';
    });
    setRateOverrides(initialRates);
    setSendOpen(true);
  };

  const handleRateChange = (id, value) => {
    setRateOverrides((prev) => ({ ...prev, [id]: value }));
  };

  const handleSend = async () => {
    if (!clientEmail.trim()) {
      toast.error('Client email is required');
      return;
    }
    setSending(true);
    try {
      await timesheetAPI.sendToClient({
        timesheetIds: selectedEntries.map((e) => e.id),
        clientEmail: clientEmail.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim() || undefined,
        rateOverrides: selectedEntries.map((e) => ({
          timesheetId: e.id,
          rateValue: getEffectiveRate(e),
        })),
      });
      toast.success('Billing sent to client successfully');
      setSendOpen(false);
      setSelected(new Set());
      setRateOverrides({});
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  // ---------- payment recording ----------

  const groupInvoiceId = (items) => items.find((i) => i.invoice_id)?.invoice_id || null;
  const groupInvoiceStatus = (items) => items.find((i) => i.invoice_status)?.invoice_status || null;
  const groupInvoiceTotal = (items) => {
    const withInvoice = items.find((i) => i.invoice_total_amount != null);
    if (withInvoice) return parseFloat(withInvoice.invoice_total_amount) || 0;
    return items.reduce((sum, e) => sum + (parseFloat(e.total_wage ?? e.totalWage) || 0), 0);
  };
  const groupAmountReceived = (items) => {
    const withInvoice = items.find((i) => i.invoice_amount_received != null);
    return withInvoice ? parseFloat(withInvoice.invoice_amount_received) || 0 : 0;
  };
  const groupIsFullySent = (items) => items.every((i) => isSent(i));

  const openPaymentModal = (group) => {
    const status = groupInvoiceStatus(group.items);
    const remaining = groupInvoiceTotal(group.items) - groupAmountReceived(group.items);
    setPaymentForm({
      transactionId: '',
      amount: status === 'sent' ? groupInvoiceTotal(group.items).toFixed(2) : Math.max(remaining, 0).toFixed(2),
      date: todayISO(),
      notes: '',
    });
    setReceiptFile(null);
    setPaymentErrors({});
    setPaymentModal({ key: group.key, group });
  };

  const closePaymentModal = () => {
    if (savingPayment) return;
    setPaymentModal(null);
  };

  const validatePaymentForm = () => {
    const errors = {};
    const trimmedTxnId = paymentForm.transactionId.trim();
    if (!trimmedTxnId) {
      errors.transactionId = 'Transaction ID is required';
    } else if (trimmedTxnId.length > 100) {
      errors.transactionId = 'Transaction ID is too long';
    }

    const amountNum = parseFloat(paymentForm.amount);
    if (paymentForm.amount === '' || Number.isNaN(amountNum)) {
      errors.amount = 'Enter a valid amount';
    } else if (amountNum <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }

    if (!paymentForm.date) {
      errors.date = 'Date is required';
    } else if (new Date(paymentForm.date) > new Date(todayISO())) {
      errors.date = 'Date cannot be in the future';
    }

    if (receiptFile && receiptFile.size > 10 * 1024 * 1024) {
      errors.receipt = 'Receipt must be under 10MB';
    }

    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePayment = async () => {
    if (!paymentModal) return;
    if (!validatePaymentForm()) return;

    // Re-resolve against the current `groups` (derived fresh from `history`) instead of
    // trusting the snapshot captured when the modal was opened — avoids acting on stale
    // in-memory data if an invoice was created/updated after this modal was opened.
    const freshGroup = groupsByKey.get(paymentModal.key) || paymentModal.group;
    const invoiceId = groupInvoiceId(freshGroup.items);
    if (!invoiceId) {
      toast.error('No invoice found for this billing group — refreshing data, please try again');
      onRefresh();
      return;
    }

    setSavingPayment(true);
    try {
      const formData = new FormData();
      formData.append('transactionId', paymentForm.transactionId.trim());
      formData.append('amount', paymentForm.amount);
      formData.append('date', paymentForm.date);
      if (paymentForm.notes.trim()) formData.append('notes', paymentForm.notes.trim());
      if (receiptFile) formData.append('receipt', receiptFile);

      await timesheetAPI.logInvoicePayment(invoiceId, formData);
      toast.success('Payment recorded');
      setPaymentModal(null);
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingPayment(false);
    }
  };

  const openNotReceivedModal = (group) => {
    setNotReceivedReason('');
    setNotReceivedModal({ key: group.key, group });
  };

  const handleConfirmNotReceived = async () => {
    if (!notReceivedModal) return;

    const freshGroup = groupsByKey.get(notReceivedModal.key) || notReceivedModal.group;
    const invoiceId = groupInvoiceId(freshGroup.items);
    if (!invoiceId) {
      toast.error('No invoice found for this billing group — refreshing data, please try again');
      onRefresh();
      return;
    }
    setSavingNotReceived(true);
    try {
      await timesheetAPI.markInvoiceNotReceived(invoiceId, notReceivedReason.trim() || undefined);
      toast.success('Marked as not received');
      setNotReceivedModal(null);
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingNotReceived(false);
    }
  };

  if (!history.length) {
    return (
      <div style={{ textAlign: 'center', color: '#8a8f98', padding: '60px 0', fontSize: 15 }}>
        No timesheets submitted yet.
      </div>
    );
  }

  return (
    <div>
      {selectedEntries.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', marginBottom: 16, background: '#eff6ff',
          border: '1px solid #bfdbfe', borderRadius: 10,
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#1c1f26' }}>
              {selectedEntries.length} timesheet(s) selected
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>
              Combined amount due: <strong>${combinedTotal.toFixed(2)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={openSendModal}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#2f6fed', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Send to Client
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.map((group) => {
          const fullySent = groupIsFullySent(group.items);
          const invoiceStatus = groupInvoiceStatus(group.items);
          const invoiceId = groupInvoiceId(group.items);
          const badge = invoiceStatus && STATUS_BADGE[invoiceStatus];
          const invoiceTotal = groupInvoiceTotal(group.items);
          const amountReceived = groupAmountReceived(group.items);

          // TEMP DEBUG — remove once the invoice-detection issue is confirmed fixed.
          console.log('DEBUG', group.client, group.key, 'invoiceId:', invoiceId, 'status:', invoiceStatus, 'fullySent:', fullySent);

          return (
            <div key={group.key} style={{ border: '1px solid #e3e6ea', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: '#f7f8fa', borderBottom: '1px solid #e3e6ea',
                gap: 12, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1c1f26' }}>{group.client}</div>
                  <div style={{ fontSize: 13, color: '#8a8f98', marginTop: 2 }}>
                    {group.periodType} · {group.period} · {group.items.length} employee(s)
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {fullySent && badge && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, background: badge.bg,
                      color: badge.fg, fontSize: 12, fontWeight: 600,
                    }}>
                      {badge.label}
                    </span>
                  )}
                  {/* Only render when a real invoice exists for this group — prevents the
                      "No invoice found" dead-end for sent-but-invoice-less legacy rows. */}
                  {fullySent && invoiceId && invoiceStatus !== 'received' && (
                    <button
                      type="button"
                      onClick={() => openPaymentModal(group)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Record Payment
                    </button>
                  )}
                  {fullySent && invoiceId && invoiceStatus && invoiceStatus !== 'not_received' && (
                    <button
                      type="button"
                      onClick={() => openNotReceivedModal(group)}
                      style={{
                        padding: '5px 12px', borderRadius: 8, border: '1px solid #e3e6ea',
                        background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {amountReceived > 0 ? 'Undo / Dispute' : 'Mark Not Received'}
                    </button>
                  )}
                  {fullySent && !invoiceId && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, background: '#f3f4f6',
                      color: '#6b7280', fontSize: 12, fontWeight: 600,
                    }}>
                      No invoice on record
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => selectGroup(group.items)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid #2f6fed',
                      background: '#fff', color: '#2f6fed', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Select Group
                  </button>
                </div>
              </div>

              {fullySent && invoiceId && invoiceStatus && invoiceStatus !== 'sent' && (
                <div style={{
                  padding: '8px 18px',
                  background: invoiceStatus === 'not_received' ? '#fef2f2' : '#f0fdf4',
                  borderBottom: '1px solid #eef0f2',
                  fontSize: 13,
                  color: invoiceStatus === 'not_received' ? '#991b1b' : '#166534',
                  display: 'flex', gap: 18, flexWrap: 'wrap',
                }}>
                  <span>Invoiced: <strong>${invoiceTotal.toFixed(2)}</strong></span>
                  <span>Received: <strong>${amountReceived.toFixed(2)}</strong></span>
                  {invoiceStatus === 'partially_received' && (
                    <span>Remaining: <strong>${(invoiceTotal - amountReceived).toFixed(2)}</strong></span>
                  )}
                </div>
              )}

              {group.items.map((entry) => {
                const sent = isSent(entry);
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 18px', borderBottom: '1px solid #eef0f2',
                      background: selected.has(entry.id) ? '#f0f7ff' : '#fff',
                      opacity: sent ? 0.9 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      disabled={sent}
                      onChange={() => toggleSelect(entry.id, entry)}
                      style={{ width: 18, height: 18, cursor: sent ? 'not-allowed' : 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1c1f26' }}>
                        {entry.employeeName || `${entry.first_name || ''} ${entry.last_name || ''}`.trim()}
                      </div>
                      <div style={{ fontSize: 13, color: '#8a8f98' }}>
                        {entry.emp_code || entry.employeeId} · Rate: {entry.rate_type || entry.rateType} $
                        {parseFloat(entry.rate_value ?? entry.rateValue ?? 0).toFixed(2)} · {entry.total_hours ?? entry.totalHours}h
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div style={{ fontSize: 13, color: '#8a8f98' }}>Amount</div>
                      <div style={{ fontWeight: 700 }}>${parseFloat(entry.total_wage ?? entry.totalWage ?? 0).toFixed(2)}</div>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: sent ? '#e0e7ff' : '#fef3c7',
                      color: sent ? '#3730a3' : '#92400e',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {sent ? 'Sent' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onView(entry)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #2f6fed',
                        background: '#fff', color: '#2f6fed', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Existing "Send to Client" modal — unchanged */}
      {sendOpen && (
        <div
          onClick={() => setSendOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,34,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, padding: 28, maxHeight: '88vh', overflowY: 'auto' }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Send to Client</div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              Excel timesheet file(s) will be attached (Date, Day, Hours, Comments). Adjust the rate per employee if needed before sending.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {selectedEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid #e3e6ea', borderRadius: 8, padding: '10px 12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1c1f26' }}>
                      {entry.employeeName || `${entry.first_name || ''} ${entry.last_name || ''}`.trim()}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8f98' }}>{entry.total_hours ?? entry.totalHours}h · {entry.rate_type || entry.rateType}</div>
                  </div>
                  <div style={{ width: 120 }}>
                    <input
                      style={{ ...inputStyle, padding: '6px 8px', textAlign: 'right' }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateOverrides[entry.id] ?? ''}
                      onChange={(e) => handleRateChange(entry.id, e.target.value)}
                      placeholder="Rate"
                    />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                    ${getEffectiveWage(entry).toFixed(2)}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                Total due: ${combinedTotal.toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Client Email *</label>
                <input style={inputStyle} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@company.com" />
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>CC</label>
                <input style={inputStyle} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Subject</label>
                <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => setSendOpen(false)} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e3e6ea', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSend} disabled={sending} style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: sending ? '#93b4f5' : '#2f6fed', color: '#fff', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment modal */}
      {paymentModal && (
        <div
          onClick={closePaymentModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,34,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, padding: 28 }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Record Payment</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              {paymentModal.group.client} · {paymentModal.group.period} · Invoiced $
              {groupInvoiceTotal((groupsByKey.get(paymentModal.key) || paymentModal.group).items).toFixed(2)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Transaction ID *</label>
                <input
                  style={inputStyle}
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, transactionId: e.target.value }))}
                  placeholder="e.g. TXN-2026-08123 or bank reference"
                />
                {paymentErrors.transactionId && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{paymentErrors.transactionId}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Amount Received *</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
                {paymentErrors.amount && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{paymentErrors.amount}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Date Received *</label>
                <input
                  style={inputStyle}
                  type="date"
                  max={todayISO()}
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                />
                {paymentErrors.date && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{paymentErrors.date}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Receipt (optional)</label>
                <input
                  style={inputStyle}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
                {paymentErrors.receipt && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{paymentErrors.receipt}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#8a8f98' }}>Notes</label>
                <input
                  style={inputStyle}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional — e.g. wire fee deducted, partial payment"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={closePaymentModal} disabled={savingPayment} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e3e6ea', background: '#fff', cursor: savingPayment ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePayment}
                disabled={savingPayment}
                style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: savingPayment ? '#7fc796' : '#16a34a', color: '#fff', fontWeight: 600, cursor: savingPayment ? 'not-allowed' : 'pointer' }}
              >
                {savingPayment ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Not Received / Undo modal */}
      {notReceivedModal && (
        <div
          onClick={() => !savingNotReceived && setNotReceivedModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(20,24,34,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: 28 }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Mark as Not Received</div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              This clears any recorded payment for {notReceivedModal.group.client} · {notReceivedModal.group.period} and reopens it as awaiting payment. Previous payment records are kept for audit history, not deleted.
            </p>
            <label style={{ fontSize: 14, color: '#8a8f98' }}>Reason (optional)</label>
            <input
              style={inputStyle}
              value={notReceivedReason}
              onChange={(e) => setNotReceivedReason(e.target.value)}
              placeholder="e.g. payment reversed, entered in error, client dispute"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => setNotReceivedModal(null)} disabled={savingNotReceived} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e3e6ea', background: '#fff', cursor: savingNotReceived ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNotReceived}
                disabled={savingNotReceived}
                style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: savingNotReceived ? '#f3a3a3' : '#dc2626', color: '#fff', fontWeight: 600, cursor: savingNotReceived ? 'not-allowed' : 'pointer' }}
              >
                {savingNotReceived ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}