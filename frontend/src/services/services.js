import api from './api';

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  setupStatus: () => api.get('/auth/setup-status'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const dashboardAPI = {
  adminStats: () => api.get('/dashboard/stats'),
  employeeStats: () => api.get('/dashboard/employee'),
  teamLeadStats: () => api.get('/dashboard/team-lead'),
};

export const employeeAPI = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  getAssignable: (params) => api.get('/employees/assignable', { params }),
  getTeamLeads: (params) => api.get('/employees/team-leads', { params }),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  assignTeam: (id, data) => api.put(`/employees/${id}/team`, data),
  resetPassword: (id) => api.post(`/employees/${id}/reset-password`),
  delete: (id) => api.delete(`/employees/${id}`),
  export: () => api.get('/employees/export', { responseType: 'blob' }),
  uploadAvatar: (id, formData) => api.post(`/employees/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const attendanceAPI = {
  clockIn: (formData) => api.post('/attendance/clock-in', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  clockOut: (formData) => api.post('/attendance/clock-out', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
}),
  today: () => api.get('/attendance/today'),
  history: (params) => api.get('/attendance/history', { params }),
  calendar: (employeeId, year, month) => api.get(`/attendance/calendar/${employeeId}/${year}/${month}`),
  getAll: (params) => api.get('/attendance/all', { params }),
  export: (params) => api.get('/attendance/export', { params, responseType: 'blob' }),
};

export const leaveAPI = {
  getTypes: () => api.get('/leaves/types'),
  getBalances: (params) => api.get('/leaves/balances', { params }),
  getAll: (params) => api.get('/leaves', { params }),
  getById: (id) => api.get(`/leaves/${id}`),
  getStats: (params) => api.get('/leaves/stats', { params }),
  create: (data) => api.post('/leaves', data),
  approve: (id, data) => api.put(`/leaves/${id}/approve`, data),
  reject: (id, data) => api.put(`/leaves/${id}/reject`, data),
  cancel: (id) => api.put(`/leaves/${id}/cancel`),
};

export const projectAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id, params) => api.get(`/projects/${id}`, { params }),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  createTask: (id, data) => api.post(`/projects/${id}/tasks`, data),
  updateTask: (taskId, data) => api.put(`/projects/tasks/${taskId}`, data),
  addComment: (id, data) => api.post(`/projects/${id}/comments`, data),
  addUpdate: (id, data) => api.post(`/projects/${id}/updates`, data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  }),
  getUpdates: (id, params) => api.get(`/projects/${id}/updates`, { params }),
};

export const payrollAPI = {
  getSummary: (params) => api.get('/payroll/summary', { params }),
  getMy: () => api.get('/payroll/my'),
  getById: (id) => api.get(`/payroll/${id}`),
  generate: (data) => api.post('/payroll/generate', data),
  download: (id) => api.get(`/payroll/${id}/download`, { responseType: 'blob' }),
  updateSalary: (employeeId, data) => api.put(`/payroll/salary/${employeeId}`, data),
};

export const documentAPI = {
  getMy: (params) => api.get('/documents/my', { params }),
  getAll: (params) => api.get('/documents', { params }),
  upload: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/documents/${id}`),
};

export const timesheetAPI = {
  getAll: () => api.get('/timesheets'),
  getMy: () => api.get('/timesheets/my'),
  getById: (id) => api.get(`/timesheets/${id}`),
  submit: (data) => api.post('/timesheets', data),
  sendMail: (data) => api.post('/timesheets/send-mail', data),
  exportExcel: (data) => api.post('/timesheets/export-excel', data, { responseType: 'blob' }),
};

export const resignationAPI = {
  getAll: () => api.get('/resignations'),
  getMy: () => api.get('/resignations/my'),
  submit: (data) => api.post('/resignations', data),
  approve: (id) => api.put(`/resignations/${id}/approve`),
  reject: (id, data) => api.put(`/resignations/${id}/reject`, data),
  complete: (id) => api.put(`/resignations/${id}/complete`),
};

export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const departmentAPI = {
  getAll: () => api.get('/departments'),
  create: (data) => api.post('/departments', data),
};

export const announcementAPI = {
  getAll: () => api.get('/announcements'),
  getHolidays: (params) => api.get('/announcements/holidays', { params }),
  create: (data) => api.post('/announcements', data),
};