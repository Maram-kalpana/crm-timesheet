import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import theme from './theme/muiTheme';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicRoute, SetupGuard } from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/dashboard/Dashboard';
import Attendance from './pages/attendance/Attendance';
import Employees from './pages/employees/Employees';
import EmployeeProfile from './pages/employees/EmployeeProfile';
import Projects from './pages/projects/Projects';
import Leave from './pages/leave/Leave';
import Payroll from './pages/payroll/Payroll';
import Documents from './pages/documents/Documents';
import Notifications from './pages/notifications/Notifications';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/register" element={<SetupGuard><PublicRoute><Register /></PublicRoute></SetupGuard>} />
              <Route path="/login" element={<SetupGuard><PublicRoute><Login /></PublicRoute></SetupGuard>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/employees/:id" element={<EmployeeProfile />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Dashboard />} />
              </Route>

              <Route path="/" element={<SetupGuard><Navigate to="/login" replace /></SetupGuard>} />
              <Route path="*" element={<SetupGuard><Navigate to="/login" replace /></SetupGuard>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
        />
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
