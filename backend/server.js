require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const projectRoutes = require('./routes/projects');
const payrollRoutes = require('./routes/payroll');
const documentRoutes = require('./routes/documents');
const notificationRoutes = require('./routes/notifications');
const departmentRoutes = require('./routes/departments');
const announcementRoutes = require('./routes/announcements');
const resignationRoutes = require('./routes/resignations');
const timesheetRoutes = require('./routes/timesheets');
const companyRoutes = require('./routes/companies');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/income');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HRMS API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/resignations', resignationRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`HRMS Server running on port ${PORT}`);
});

module.exports = app;
