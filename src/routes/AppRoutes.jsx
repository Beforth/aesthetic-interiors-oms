import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import ProtectedRoute from '../components/layout/ProtectedRoute';
import RoleRoute from '../components/layout/RoleRoute';
import AppShell from '../components/layout/AppShell';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/RoleDashboard';
import UsersPage from '../pages/UsersPage';
import NewRolePage from '../pages/NewRolePage';
import ClientsPage from '../pages/ClientsPage';
import ClientDetailPage from '../pages/ClientDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import NewProjectPage from '../pages/NewProjectPage';
import AgenciesPage from '../pages/AgenciesPage';
import AttendancePage from '../pages/RoleAttendance';
import TasksPage from '../pages/TasksPage';
import DailyReportsPage from '../pages/DailyReportsPage';
import ClientUpdatesPage from '../pages/ClientUpdatesPage';
import PaymentsPage from '../pages/PaymentsPage';
import LeavePayslipsPage from '../pages/LeavePayslipsPage';
import LeaveRequestsPage from '../pages/RoleLeaveRequests';
import LeaveTypesPage from '../pages/LeaveTypesPage';
import HolidayListsPage from '../pages/HolidayListsPage';
import PayslipsPage from '../pages/PayslipsPage';
import IncentivesPage from '../pages/IncentivesPage';
import ExpensesPage from '../pages/ExpensesPage';
import MyExpensesPage from '../pages/MyExpensesPage';
import MyPayslipsPage from '../pages/MyPayslipsPage';
import ReportsPage from '../pages/ReportsPage';
import ApprovalsPage from '../pages/ApprovalsPage';
import EstimatesPage from '../pages/EstimatesPage';
import NotificationsPage from '../pages/NotificationsPage';
import ComponentsShowcasePage from '../pages/ComponentsShowcasePage';
import PlaceholderPage from '../pages/PlaceholderPage';
import WebsiteLeadsPage from '../pages/WebsiteLeadsPage';
import ClientProjectPage from '../pages/ClientProjectPage';
import SharedProjectPage from '../pages/SharedProjectPage';

/**
 * A project's page. Someone who sees only their own project (a client) gets the progress-and-updates screen;
 * everyone else keeps the full project workspace.
 */
function ProjectRoute() {
  const { hasPermission } = useAuth();
  const isClientOnly = hasPermission('projects.viewOwn') && !hasPermission('projects.viewAll');
  return isClientOnly ? <ClientProjectPage /> : <ProjectDetailPage />;
}

/**
 * Expenses. Someone who can approve and see everyone's money (`payments.labour.manage`) gets the full page; everyone
 * else on staff gets their own requests only: ask for a claim or a salary advance, follow the status, withdraw.
 */
function ExpensesRoute({ mode }) {
  const { hasPermission } = useAuth();
  return hasPermission('payments.labour.manage') ? <ExpensesPage mode={mode} /> : <MyExpensesPage mode={mode} />;
}

/** The DSR tab. People who write or review reports get the DSR page; a client gets their site updates (read-only). */
function DailyReportsRoute() {
  const { hasPermission } = useAuth();
  return hasPermission('dsr.submit') || hasPermission('dsr.viewAll') ? <DailyReportsPage /> : <ClientUpdatesPage />;
}

/** Payroll. Whoever runs payroll (`leave.approve`) gets the full page; everyone else sees only their own payslips. */
function PayrollRoute() {
  const { hasPermission } = useAuth();
  return hasPermission('leave.approve') ? <PayslipsPage /> : <MyPayslipsPage />;
}

export function AppRoutes() {
  const { hasPermission } = useAuth();

  // Root redirect destination depending on permissions. A "client" sees their own projects but not all of
  // them; the Owner holds every permission, so it must not be mistaken for one.
  const isClientOnly = hasPermission('projects.viewOwn') && !hasPermission('projects.viewAll');
  const defaultDestination = isClientOnly ? '/projects' : '/dashboard';

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      {/* A project update a client opens from the private link staff send them: no login */}
      <Route path="/share/:token" element={<SharedProjectPage />} />

      {/* Protected AppShell Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={defaultDestination} replace />} />

        {/* 1. Dashboard (Staff roles) */}
        <Route
          path="dashboard"
          element={
            <RoleRoute permissions={['tasks.updateOwn', 'attendance.markOwn', 'tasks.viewAll']}>
              <DashboardPage />
            </RoleRoute>
          }
        />

        {/* 2. Clients (Admin & Manager) */}
        <Route
          path="clients"
          element={
            <RoleRoute permission="clients.view">
              <ClientsPage />
            </RoleRoute>
          }
        />
        <Route
          path="clients/:id"
          element={
            <RoleRoute permissions={['clients.view', 'projects.viewOwn']}>
              <ClientDetailPage />
            </RoleRoute>
          }
        />

        {/* 3. Projects (All roles - row-level filtered in projectService) */}
        <Route
          path="projects"
          element={
            <RoleRoute permissions={['projects.viewAll', 'projects.viewAssigned', 'projects.viewOwn']}>
              <ProjectsPage />
            </RoleRoute>
          }
        />
        <Route
          path="projects/new"
          element={
            <RoleRoute permission="projects.create">
              <NewProjectPage />
            </RoleRoute>
          }
        />
        <Route
          path="projects/:id"
          element={
            <RoleRoute permissions={['projects.viewAll', 'projects.viewAssigned', 'projects.viewOwn']}>
              <ProjectRoute />
            </RoleRoute>
          }
        />

        {/* 4. Agencies (Admin & Manager) */}
        <Route
          path="agencies"
          element={
            <RoleRoute permission="agencies.manage">
              <AgenciesPage />
            </RoleRoute>
          }
        />

        {/* 5. Attendance (Admin, Manager, Supervisor, Worker) */}
        <Route
          path="attendance"
          element={
            <RoleRoute permissions={['attendance.markOwn', 'attendance.viewBoard']}>
              <AttendancePage />
            </RoleRoute>
          }
        />

        {/* 6. Tasks (Admin, Manager, Supervisor, Worker) */}
        <Route
          path="tasks"
          element={
            <RoleRoute permissions={['tasks.updateOwn', 'tasks.create', 'tasks.viewAll']}>
              <TasksPage />
            </RoleRoute>
          }
        />

        {/* 7. Daily Reports (All roles) */}
        <Route
          path="daily-reports"
          element={
            <RoleRoute permissions={['dsr.submit', 'dsr.viewAll', 'feedback.submit']}>
              <DailyReportsRoute />
            </RoleRoute>
          }
        />

        {/* 8. Payments (Admin, Manager, Client) */}
        <Route path="payments" element={<Navigate to="/payments/received" replace />} />
        <Route
          path="payments/received"
          element={
            <RoleRoute permissions={['payments.client.manage', 'payments.labour.manage']}>
              <PaymentsPage mode="received" />
            </RoleRoute>
          }
        />
        <Route
          path="payments/pay"
          element={
            <RoleRoute permissions={['payments.client.manage', 'payments.labour.manage']}>
              <PaymentsPage mode="pay" />
            </RoleRoute>
          }
        />
        <Route
          path="payments/settings"
          element={
            <RoleRoute permissions={['payments.client.manage', 'payments.labour.manage']}>
              <PaymentsPage mode="settings" />
            </RoleRoute>
          }
        />

        {/* Full Notifications & Updates Page */}
        <Route path="notifications" element={<NotificationsPage />} />

        {/* Leave Routes */}
        <Route path="leave" element={<Navigate to="/leave/requests" replace />} />
        <Route
          path="leave/requests"
          element={
            <RoleRoute permissions={['attendance.markOwn', 'attendance.viewBoard', 'leave.apply', 'leave.approve']}>
              <LeaveRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave/types"
          element={
            <RoleRoute permissions={['attendance.viewBoard', 'leave.approve']}>
              <LeaveTypesPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave/holidays"
          element={
            <RoleRoute permissions={['attendance.viewBoard', 'leave.approve']}>
              <HolidayListsPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave/holidays/new"
          element={
            <RoleRoute permissions={['leave.approve', 'attendance.viewBoard']}>
              <HolidayListsPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave-types"
          element={
            <RoleRoute permissions={['leave.approve', 'attendance.viewBoard']}>
              <LeaveTypesPage />
            </RoleRoute>
          }
        />

        {/* Expenses Routes */}
        <Route path="expenses" element={<Navigate to="/expenses/claims" replace />} />
        <Route
          path="expenses/claims"
          element={
            <RoleRoute permissions={['payments.labour.manage', 'expenses.requestOwn']}>
              <ExpensesRoute mode="claims" />
            </RoleRoute>
          }
        />
        <Route
          path="expenses/advances"
          element={
            <RoleRoute permissions={['payments.labour.manage', 'expenses.requestOwn']}>
              <ExpensesRoute mode="advances" />
            </RoleRoute>
          }
        />
        <Route path="finance/expenses" element={<Navigate to="/expenses/claims" replace />} />

        {/* Payslips Route */}
                <Route
          path="incentives"
          element={
            <RoleRoute permissions={['payments.labour.manage', 'tasks.viewAll', 'attendance.markOwn']}>
              <IncentivesPage />
            </RoleRoute>
          }
        />
        <Route path="finance/incentives" element={<Navigate to="/incentives" replace />} />
        {/* Payroll / Payslips Routes */}
        <Route
          path="payroll"
          element={
            <RoleRoute permissions={['payslips.viewOwn', 'leave.approve']}>
              <PayrollRoute />
            </RoleRoute>
          }
        />
        <Route path="payslips" element={<Navigate to="/payroll" replace />} />
        <Route path="finance/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="finance/payslips" element={<Navigate to="/payroll" replace />} />

        {/* 9. Leave & Payslips Legacy Fallback */}
        <Route
          path="leave-payslips"
          element={
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'payslips.viewOwn']}>
              <LeavePayslipsPage />
            </RoleRoute>
          }
        />

        {/* 10. Reports (Admin & Manager) */}
        <Route
          path="reports"
          element={
            <RoleRoute permission="reports.view">
              <ReportsPage />
            </RoleRoute>
          }
        />

        {/* 10b. Approvals (Admin only) - what managers decided, and what is still pending */}
        <Route
          path="approvals"
          element={
            <RoleRoute permission="approvals.view">
              <ApprovalsPage />
            </RoleRoute>
          }
        />

        {/* 10c. Estimates (Admin & Manager) - client requirement/cost sheets with a PDF download */}
        <Route
          path="estimates"
          element={
            <RoleRoute permission="estimates.manage">
              <EstimatesPage />
            </RoleRoute>
          }
        />

        {/* 11. Settings & Sub-routes: open to anyone with users.manage, roles.change or settings.stageTemplate
              (the page itself shows only the tabs each permission allows; mirrors backend accounts/defaults.py) */}
        <Route path="settings" element={<Navigate to="/settings/users" replace />} />
        <Route path="users" element={<Navigate to="/settings/users" replace />} />
        <Route
          path="settings/users"
          element={
            <RoleRoute permissions={['users.manage', 'roles.change']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="settings/roles/new"
          element={
            <RoleRoute permission="roles.change">
              <NewRolePage />
            </RoleRoute>
          }
        />

        {/* 12. Website & Leads (Admin & Manager) */}
        <Route
          path="website-leads"
          element={
            <RoleRoute permission="leads.manage">
              <WebsiteLeadsPage />
            </RoleRoute>
          }
        />

        {/* 13. Design System Showcase */}
        <Route path="components" element={<ComponentsShowcasePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;




