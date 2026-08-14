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

function groupKey(entry) {
  const client = (entry.client || 'Unknown Client').trim();
  const period = entry.period || entry.periodLabel || 'No period';
  return `${client}|||${period}`;
}

export default function AccountantBilling({ history, onRefresh, onView }) {
  const [selected, setSelected] = useState(new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    history.forEach((entry) => {
      const key = groupKey(entry);
      if (!map.has(key)) {
        map.set(key, {
          key,
          client: entry.client || 'Unknown Client',
          period: entry.period || 'No period',
          periodType: entry.periodType,
          items: [],
        });
      }
      map.get(key).items.push(entry);
    });
    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [history]);

  const selectedEntries = useMemo(
    () => history.filter((e) => selected.has(e.id)),
    [history, selected]
  );

  const combinedTotal = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + (parseFloat(e.totalWage) || 0), 0),
    [selectedEntries]
  );

  const toggleSelect = (id, entry) => {
    if (entry.sentToClient) {
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
    const pending = items.filter((i) => !i.sentToClient);
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
    const periods = [...new Set(selectedEntries.map((e) => e.period))];
    if (clients.length > 1 || periods.length > 1) {
      toast.error('Select timesheets from the same client and period');
      return;
    }
    setClientEmail('');
    setCc('');
    setSubject(`Timesheet Invoice - ${clients[0] || 'Client'} - ${periods[0] || ''}`);
    setSendOpen(true);
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
      });
      toast.success('Billing sent to client successfully');
      setSendOpen(false);
      setSelected(new Set());
      onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
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
        {groups.map((group) => (
          <div key={group.key} style={{ border: '1px solid #e3e6ea', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', background: '#f7f8fa', borderBottom: '1px solid #e3e6ea',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1c1f26' }}>{group.client}</div>
                <div style={{ fontSize: 13, color: '#8a8f98', marginTop: 2 }}>
                  {group.periodType} · {group.period} · {group.items.length} employee(s)
                </div>
              </div>
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

            {group.items.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', borderBottom: '1px solid #eef0f2',
                  background: selected.has(entry.id) ? '#f0f7ff' : '#fff',
                  opacity: entry.sentToClient ? 0.75 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  disabled={entry.sentToClient}
                  onChange={() => toggleSelect(entry.id, entry)}
                  style={{ width: 18, height: 18, cursor: entry.sentToClient ? 'not-allowed' : 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1c1f26' }}>{entry.employeeName}</div>
                  <div style={{ fontSize: 13, color: '#8a8f98' }}>
                    {entry.employeeId} · Rate: {entry.rateType} ${parseFloat(entry.rateValue || 0).toFixed(2)} · {entry.totalHours}h
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <div style={{ fontSize: 13, color: '#8a8f98' }}>Amount</div>
                  <div style={{ fontWeight: 700 }}>${parseFloat(entry.totalWage || 0).toFixed(2)}</div>
                </div>
                {entry.sentToClient ? (
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, background: '#dcfce7',
                    color: '#166534', fontSize: 12, fontWeight: 600,
                  }}>
                    Sent
                  </span>
                ) : (
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, background: '#fef3c7',
                    color: '#92400e', fontSize: 12, fontWeight: 600,
                  }}>
                    Pending
                  </span>
                )}
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
            ))}
          </div>
        ))}
      </div>

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
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: 28 }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Send to Client</div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Email will use the client timesheet format (Date, Day, Hours, Comments). Total due: ${combinedTotal.toFixed(2)}
            </p>
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
    </div>
  );
}
