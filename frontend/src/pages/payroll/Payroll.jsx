import React, { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { timesheetAPI } from "../../services/services";
import { getErrorMessage } from "../../utils/helpers";

const DAY_LABELS = ["Mon", "Tues", "Wed", "Thurs", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const emptyForm = {
  client: "",
  managerName: "",
  rateType: "Hourly",
  rateValue: "",
  periodType: "Weekly",
};

function formatShortDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfISOWeek(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));
  return monday;
}

function parseWeekValue(weekStr) {
  const [yearPart, weekPart] = weekStr.split("-W");
  return getMondayOfISOWeek(parseInt(yearPart, 10), parseInt(weekPart, 10));
}

function buildWeeklyRows(weekValue) {
  const monday = parseWeekValue(weekValue);
  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    rows.push({
      id: `w-${i}-${toISODate(d)}`,
      date: formatShortDate(d),
      entryDate: toISODate(d),
      day: DAY_LABELS[i],
      task: "",
      hrs: "",
    });
  }
  return rows;
}

function buildMonthlyRows(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month - 1, day);
    rows.push({
      id: `m-${year}-${month}-${day}`,
      date: formatShortDate(d),
      entryDate: toISODate(d),
      day: DAY_NAMES[d.getDay()],
      task: "",
      hrs: "",
    });
  }
  return rows;
}

function getCurrentISOWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mapListItem(row) {
  return {
    id: row.id,
    employeeName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    employeeId: row.emp_code || "",
    client: row.client || "",
    managerName: row.manager_name || "",
    rateType: row.rate_type,
    rateValue: row.rate_value,
    periodType: row.period_type,
    period: row.period_label || "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalHours: row.total_hours,
    totalWage: row.total_wage,
    submittedAt: row.submitted_at
      ? new Date(row.submitted_at).toLocaleString()
      : "",
    status: row.status,
    departmentName: row.department_name || "",
  };
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <span style={{ fontSize: 14, color: "#8a8f98" }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle = {
  border: "1px solid #e3e6ea",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 15,
  color: "#1c1f26",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};

const th = {
  padding: "12px 14px",
  textAlign: "center",
  fontWeight: 600,
  fontSize: 13,
  borderBottom: "1px solid #e3e6ea",
};

const td = {
  padding: "12px 14px",
  textAlign: "center",
  borderBottom: "1px solid #eef0f2",
  color: "#1c1f26",
};

function TimesheetTable({
  rows,
  rate,
  editable,
  onTaskChange,
  onHrsChange,
  totalHrs,
  totalWage,
}) {
  return (
    <div style={{ border: "1px solid #e3e6ea", borderRadius: 10, overflow: "hidden", width: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: editable ? "11%" : "12%" }} />
          <col style={{ width: editable ? "9%" : "10%" }} />
          <col style={{ width: editable ? "44%" : "48%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "18%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f7f8fa", color: "#6b7280" }}>
            <th style={th}>Date</th>
            <th style={th}>Day</th>
            <th style={{ ...th, textAlign: "left" }}>Task Description</th>
            <th style={{ ...th, background: "#e8f0fe", color: "#1c1f26" }}>Hrs</th>
            <th style={{ ...th, background: "#e8f0fe", color: "#1c1f26" }}>Total Wage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const wage = (parseFloat(r.hrs) || 0) * rate;
            return (
              <tr key={r.id || idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={td}>{r.date || "—"}</td>
                <td style={td}>{r.day || "—"}</td>
                <td style={{ ...td, textAlign: "left" }}>
                  {editable ? (
                    <input
                      style={{ ...inputStyle, border: "none", padding: "4px 6px", background: "transparent" }}
                      value={r.task}
                      placeholder="Describe the task"
                      onChange={(e) => onTaskChange(idx, e.target.value)}
                    />
                  ) : (
                    r.task || "—"
                  )}
                </td>
                <td style={td}>
                  {editable ? (
                    <input
                      style={{ ...inputStyle, textAlign: "center", padding: "6px 8px" }}
                      type="number"
                      min="0"
                      step="0.5"
                      value={r.hrs}
                      placeholder="0"
                      onChange={(e) => onHrsChange(idx, e.target.value)}
                    />
                  ) : (
                    r.hrs || 0
                  )}
                </td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{wage.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr style={{ background: "#f7f8fa" }}>
            <td style={{ ...td, fontWeight: 700 }} colSpan={3}>
              Total
            </td>
            <td style={{ ...td, fontWeight: 700 }}>{totalHrs}</td>
            <td style={{ ...td, fontWeight: 700 }}>{totalWage.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MailModal({ open, form, onChange, onClose, onSend, sending, periodLabel }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,24,34,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 520,
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1c1f26" }}>Send Timesheet by Email</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f3f6",
              width: 32,
              height: 32,
              borderRadius: 8,
              fontSize: 16,
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
          The timesheet will be attached as an Excel file ({periodLabel || "selected period"}).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="From">
            <input
              style={inputStyle}
              type="email"
              value={form.from}
              onChange={(e) => onChange("from", e.target.value)}
              placeholder="sender@example.com"
            />
          </Field>
          <Field label="To">
            <input
              style={inputStyle}
              type="email"
              value={form.to}
              onChange={(e) => onChange("to", e.target.value)}
              placeholder="recipient@example.com"
            />
          </Field>
          <Field label="CC">
            <input
              style={inputStyle}
              type="text"
              value={form.cc}
              onChange={(e) => onChange("cc", e.target.value)}
              placeholder="cc@example.com (comma-separated for multiple)"
            />
          </Field>
          <Field label="Subject">
            <input
              style={inputStyle}
              value={form.subject}
              onChange={(e) => onChange("subject", e.target.value)}
              placeholder="Timesheet subject"
            />
          </Field>
          <Field label="Body">
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
              value={form.body}
              onChange={(e) => onChange("body", e.target.value)}
              placeholder="Write your message..."
            />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #e3e6ea",
              background: "#fff",
              color: "#1c1f26",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: sending ? "#93b4f5" : "#2f6fed",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send Mail"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewModal({ entry, onClose }) {
  if (!entry) return null;
  const rate = parseFloat(entry.rateValue) || 0;
  const totalHrs = (entry.rows || []).reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0);
  const totalWage = totalHrs * rate;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,24,34,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 900,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1c1f26" }}>
              {entry.employeeName || "Unnamed"} — {entry.period || "No period"}
            </div>
            <div style={{ fontSize: 13, color: "#8a8f98", marginTop: 4 }}>
              Submitted {entry.submittedAt}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f3f6",
              width: 32,
              height: 32,
              borderRadius: 8,
              fontSize: 16,
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 13, color: "#8a8f98" }}>Employee ID</div>
            <div style={{ fontSize: 15, color: "#1c1f26" }}>{entry.employeeId || "—"}</div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 13, color: "#8a8f98" }}>Client</div>
            <div style={{ fontSize: 15, color: "#1c1f26" }}>{entry.client || "—"}</div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 13, color: "#8a8f98" }}>Manager</div>
            <div style={{ fontSize: 15, color: "#1c1f26" }}>{entry.managerName || "—"}</div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 13, color: "#8a8f98" }}>Rate</div>
            <div style={{ fontSize: 15, color: "#1c1f26" }}>
              {entry.rateType} — {entry.rateValue || "0.00"}
            </div>
          </div>
        </div>

        <TimesheetTable
          rows={entry.rows || []}
          rate={rate}
          editable={false}
          totalHrs={totalHrs}
          totalWage={totalWage}
        />
      </div>
    </div>
  );
}

export default function Timesheet() {
  const { user, isAdminOnly, isHr } = useAuth();
  const canManage = isAdminOnly || isHr;
  const canSubmit = !canManage;

  const now = new Date();
  const [tab, setTab] = useState(canManage ? "history" : "new");
  const [form, setForm] = useState(emptyForm);
  const [weekValue, setWeekValue] = useState(getCurrentISOWeek());
  const [monthValue, setMonthValue] = useState(now.getMonth() + 1);
  const [yearValue, setYearValue] = useState(now.getFullYear());
  const [rows, setRows] = useState(() => buildWeeklyRows(getCurrentISOWeek()));
  const [history, setHistory] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [mailForm, setMailForm] = useState({ from: "", to: "", cc: "", subject: "", body: "" });

  const employeeName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
  const employeeId = user?.employeeId || "";

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const rate = parseFloat(form.rateValue) || 0;

  const periodLabel = useMemo(() => {
    if (form.periodType === "Weekly" && weekValue) {
      const weekRows = buildWeeklyRows(weekValue);
      if (weekRows.length) {
        return `${weekRows[0].date} - ${weekRows[weekRows.length - 1].date}`;
      }
    }
    if (form.periodType === "Monthly") {
      return `${MONTH_NAMES[monthValue - 1]} ${yearValue}`;
    }
    return "";
  }, [form.periodType, weekValue, monthValue, yearValue]);

  const periodStart = useMemo(() => {
    if (form.periodType === "Weekly" && weekValue) {
      return buildWeeklyRows(weekValue)[0]?.entryDate || "";
    }
    if (form.periodType === "Monthly") {
      return `${yearValue}-${String(monthValue).padStart(2, "0")}-01`;
    }
    return "";
  }, [form.periodType, weekValue, monthValue, yearValue]);

  const periodEnd = useMemo(() => {
    if (form.periodType === "Weekly" && weekValue) {
      const weekRows = buildWeeklyRows(weekValue);
      return weekRows[weekRows.length - 1]?.entryDate || "";
    }
    if (form.periodType === "Monthly") {
      const lastDay = new Date(yearValue, monthValue, 0).getDate();
      return `${yearValue}-${String(monthValue).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
    return "";
  }, [form.periodType, weekValue, monthValue, yearValue]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = canManage ? await timesheetAPI.getAll() : await timesheetAPI.getMy();
      setHistory((data.data || []).map(mapListItem));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (user?.email) {
      setMailForm((f) => ({ ...f, from: user.email }));
    }
  }, [user?.email]);

  useEffect(() => {
    if (form.periodType === "Weekly" && weekValue) {
      setRows(buildWeeklyRows(weekValue));
    } else if (form.periodType === "Monthly") {
      setRows(buildMonthlyRows(yearValue, monthValue));
    }
  }, [form.periodType, weekValue, monthValue, yearValue]);

  const updateHrs = (idx, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], hrs: value };
      return next;
    });
  };

  const updateTask = (idx, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], task: value };
      return next;
    });
  };

  const totalHrs = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0),
    [rows]
  );
  const totalWage = totalHrs * rate;

  const resetForm = () => {
    setForm(emptyForm);
    setWeekValue(getCurrentISOWeek());
    setMonthValue(now.getMonth() + 1);
    setYearValue(now.getFullYear());
    setRows(buildWeeklyRows(getCurrentISOWeek()));
  };

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a valid period");
      return;
    }
    setSubmitting(true);
    try {
      await timesheetAPI.submit({
        client: form.client,
        managerName: form.managerName,
        rateType: form.rateType,
        rateValue: form.rateValue,
        periodType: form.periodType,
        periodStart,
        periodEnd,
        periodLabel,
        rows,
      });
      toast.success("Timesheet submitted");
      resetForm();
      setTab("history");
      fetchHistory();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const buildTimesheetPayload = () => ({
    employeeName,
    employeeId,
    client: form.client,
    managerName: form.managerName,
    rateType: form.rateType,
    rateValue: form.rateValue,
    periodType: form.periodType,
    periodLabel,
    periodStart,
    periodEnd,
    rows,
    totalHrs,
    totalWage,
  });

  const downloadExcel = async () => {
    const payload = buildTimesheetPayload();
    const { data } = await timesheetAPI.exportExcel(payload);
    const safePeriod = (periodLabel || "timesheet").replace(/[^\w\-]/g, "_");
    const safeEmpId = (employeeId || "employee").replace(/[^\w\-]/g, "_");
    const filename = `Timesheet_${safeEmpId}_${safePeriod}.xlsx`;
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const openMailModal = () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a valid period");
      return;
    }
    setMailForm({
      from: user?.email || "",
      to: "",
      cc: "",
      subject: `Timesheet - ${periodLabel || employeeName}`,
      body: `Hello,\n\nPlease find attached my timesheet for ${periodLabel || "the selected period"}.\n\nEmployee: ${employeeName}\nEmployee ID: ${employeeId}\nPeriod: ${periodLabel}\nTotal Hours: ${totalHrs}\nTotal Wage: ${totalWage.toFixed(2)}\n\nThank you.`,
    });
    setMailOpen(true);
  };

  const handleMailChange = (key, value) => {
    setMailForm((f) => ({ ...f, [key]: value }));
  };

  const openMailClientFallback = () => {
    const subject = encodeURIComponent(mailForm.subject || `Timesheet - ${periodLabel}`);
    const body = encodeURIComponent(mailForm.body || "");
    const ccParam = mailForm.cc?.trim() ? `&cc=${encodeURIComponent(mailForm.cc.trim())}` : "";
    window.location.href = `mailto:${mailForm.to}?subject=${subject}&body=${body}${ccParam}`;
  };

  const handleSendMail = async () => {
    if (!mailForm.from || !mailForm.to || !mailForm.body) {
      toast.error("Please fill From, To, and Body");
      return;
    }
    setSendingMail(true);
    try {
      await timesheetAPI.sendMail({
        from: mailForm.from,
        to: mailForm.to,
        cc: mailForm.cc?.trim() || undefined,
        subject: mailForm.subject,
        body: mailForm.body,
        ...buildTimesheetPayload(),
      });
      toast.success("Timesheet emailed successfully");
      setMailOpen(false);
    } catch (error) {
      const useMailClient = error.response?.data?.useMailClient;
      if (useMailClient) {
        try {
          await downloadExcel();
          openMailClientFallback();
          toast.info("Excel downloaded. Your mail app will open — please attach the downloaded file.");
          setMailOpen(false);
        } catch (downloadError) {
          toast.error(getErrorMessage(downloadError));
        }
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setSendingMail(false);
    }
  };

  const handleView = async (entry) => {
    try {
      const { data } = await timesheetAPI.getById(entry.id);
      const full = data.data;
      setViewing({
        employeeName: `${full.first_name || ""} ${full.last_name || ""}`.trim(),
        employeeId: full.emp_code || "",
        client: full.client || "",
        managerName: full.manager_name || "",
        rateType: full.rate_type,
        rateValue: full.rate_value,
        period: full.period_label || "",
        submittedAt: full.submitted_at ? new Date(full.submitted_at).toLocaleString() : "",
        rows: full.rows || [],
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y += 1) {
    yearOptions.push(y);
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        width: "100%",
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ padding: "24px 32px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1f26" }}>Timesheet</div>
        <div style={{ fontSize: 14, color: "#8a8f98", marginTop: 4 }}>
          {canManage
            ? "Review timesheets submitted by employees"
            : "Submit and track your work hours"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "20px 32px 0", borderBottom: "1px solid #eef0f2" }}>
        {canSubmit && (
          <button
            type="button"
            onClick={() => setTab("new")}
            style={{
              border: "none",
              background: "transparent",
              padding: "10px 16px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              color: tab === "new" ? "#2f6fed" : "#8a8f98",
              borderBottom: tab === "new" ? "2px solid #2f6fed" : "2px solid transparent",
            }}
          >
            New Timesheet
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("history")}
          style={{
            border: "none",
            background: "transparent",
            padding: "10px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            color: tab === "history" ? "#2f6fed" : "#8a8f98",
            borderBottom: tab === "history" ? "2px solid #2f6fed" : "2px solid transparent",
          }}
        >
          {canManage ? "All Timesheets" : `History${history.length ? ` (${history.length})` : ""}`}
        </button>
      </div>

      {tab === "new" && canSubmit && (
        <div style={{ padding: "28px 32px 32px" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
            <Field label="Employee Name">
              <input style={{ ...inputStyle, background: "#f7f8fa" }} value={employeeName} readOnly />
            </Field>
            <Field label="Employee ID">
              <input style={{ ...inputStyle, background: "#f7f8fa" }} value={employeeId} readOnly />
            </Field>
            <Field label="Client">
              <input style={inputStyle} value={form.client} onChange={setField("client")} placeholder="Client name or contact" />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
            <Field label="Manager">
              <input style={inputStyle} value={form.managerName} onChange={setField("managerName")} placeholder="Manager name" />
            </Field>
            <Field label="Rate">
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  style={{ ...inputStyle, width: 120, flex: "0 0 auto" }}
                  value={form.rateType}
                  onChange={setField("rateType")}
                >
                  <option>Hourly</option>
                  <option>Daily</option>
                  <option>Monthly</option>
                </select>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rateValue}
                  onChange={setField("rateValue")}
                  placeholder="0.00"
                />
              </div>
            </Field>
            <Field label="Period">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  style={{ ...inputStyle, width: 120, flex: "0 0 auto" }}
                  value={form.periodType}
                  onChange={setField("periodType")}
                >
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
                {form.periodType === "Weekly" ? (
                  <input
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                    type="week"
                    value={weekValue}
                    onChange={(e) => setWeekValue(e.target.value)}
                  />
                ) : (
                  <>
                    <select
                      style={{ ...inputStyle, width: 140, flex: "0 0 auto" }}
                      value={monthValue}
                      onChange={(e) => setMonthValue(parseInt(e.target.value, 10))}
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <select
                      style={{ ...inputStyle, width: 100, flex: "0 0 auto" }}
                      value={yearValue}
                      onChange={(e) => setYearValue(parseInt(e.target.value, 10))}
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              {periodLabel && (
                <span style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Selected: {periodLabel}
                </span>
              )}
            </Field>
          </div>

          <TimesheetTable
            rows={rows}
            rate={rate}
            editable
            onTaskChange={updateTask}
            onHrsChange={updateHrs}
            totalHrs={totalHrs}
            totalWage={totalWage}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                border: "1px solid #2f6fed",
                background: "#fff",
                color: "#2f6fed",
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={openMailModal}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                border: "none",
                background: "#2f6fed",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Send Mail
            </button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "28px 32px 32px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#8a8f98", padding: "60px 0", fontSize: 15 }}>
              Loading timesheets...
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8a8f98", padding: "60px 0", fontSize: 15 }}>
              {canManage
                ? "No timesheets submitted yet. Employee submissions will appear here."
                : "No timesheets submitted yet. Once you submit a timesheet, it will show up here."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid #e3e6ea",
                    borderRadius: 10,
                    padding: "16px 20px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1c1f26" }}>
                      {entry.period || "No period"}
                    </div>
                    <div style={{ fontSize: 13, color: "#8a8f98", marginTop: 2 }}>
                      {canManage && `${entry.employeeName} · `}
                      {canManage && entry.departmentName && `${entry.departmentName} · `}
                      Submitted {entry.submittedAt}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, color: "#8a8f98" }}>Total wage</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1c1f26" }}>
                        {parseFloat(entry.totalWage || 0).toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleView(entry)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        border: "1px solid #2f6fed",
                        background: "#fff",
                        color: "#2f6fed",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ViewModal entry={viewing} onClose={() => setViewing(null)} />
      <MailModal
        open={mailOpen}
        form={mailForm}
        onChange={handleMailChange}
        onClose={() => setMailOpen(false)}
        onSend={handleSendMail}
        sending={sendingMail}
        periodLabel={periodLabel}
      />
    </div>
  );
}