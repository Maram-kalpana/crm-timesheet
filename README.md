# HRMS - Employee Attendance & HR Management System

A production-ready HRMS platform built for software companies with attendance tracking, leave management, payroll, projects, and employee management.

## Tech Stack

### Frontend
- React 19 + Vite
- Material UI v7
- React Router DOM
- Axios + Context API (Auth)
- React Hook Form
- React Toastify
- Chart.js + Day.js
- Lucide React Icons

### Backend
- Node.js + Express (CommonJS)
- JWT Authentication
- MySQL (mysql2)
- bcrypt, multer, nodemailer, pdfkit, exceljs

## Features

- **Authentication** - JWT login, forgot password, role-based access
- **Dashboard** - Admin & employee dashboards with charts and stats
- **Attendance** - Clock in/out, live timer, selfie capture, history, export
- **Employees** - CRUD, profile tabs, search, filter, export
- **Leave** - Apply, approve/reject workflow, balance tracking, calendar
- **Projects** - Kanban board, tasks, comments, activity timeline
- **Payroll** - Salary breakdown, payslip preview, PDF download
- **Documents** - Upload/download offer letters, ID cards, etc.
- **Notifications** - Notification center with unread badges

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8+

### 1. Database Setup

```bash
mysql -u root -p < backend/database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret
npm install
npm run seed
npm run dev
```

Backend runs at `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Default Login

| Role     | Email                  | Password   |
|----------|------------------------|------------|
| Admin    | admin@company.com      | Admin@123  |
| HR       | hr@company.com         | Admin@123  |
| Employee | john.doe@company.com   | Admin@123  |
| Manager  | mike.wilson@company.com| Admin@123  |

## Project Structure

```
CRM/
├── backend/
│   ├── config/          # Database config
│   ├── database/        # Schema & seed
│   ├── middleware/      # Auth, upload, errors
│   ├── routes/          # API routes
│   ├── utils/           # Email, PDF, Excel
│   └── server.js
└── frontend/
    └── src/
        ├── components/  # Reusable UI components
        ├── context/     # Auth context
        ├── layouts/     # Sidebar, Navbar
        ├── pages/       # Feature pages
        ├── services/    # API layer
        └── theme/       # MUI theme
```

## API Endpoints

| Module        | Base URL              |
|---------------|-----------------------|
| Auth          | `/api/auth`           |
| Dashboard     | `/api/dashboard`      |
| Employees     | `/api/employees`      |
| Attendance    | `/api/attendance`     |
| Leaves        | `/api/leaves`         |
| Projects      | `/api/projects`       |
| Payroll       | `/api/payroll`        |
| Documents     | `/api/documents`      |
| Notifications | `/api/notifications`  |

## Roles

- **admin** - Full access
- **hr** - Employee, leave, payroll management
- **manager** - Team oversight, leave approval
- **employee** - Self-service portal

## Production Build

```bash
cd frontend && npm run build
cd backend && npm start
```

Serve frontend `dist/` via nginx or similar, pointing `/api` proxy to backend.

## License

MIT
