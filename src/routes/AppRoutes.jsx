import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import ProtectedRoute from '../components/layout/ProtectedRoute';
import RoleRoute from '../components/layout/RoleRoute';
import AppShell from '../components/layout/AppShell';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import UsersPage from '../pages/UsersPage';
import NewRolePage from '../pages/NewRolePage';
import ClientsPage from '../pages/ClientsPage';
import ClientDetailPage from '../pages/ClientDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import NewProjectPage from '../pages/NewProjectPage';
import AgenciesPage from '../pages/AgenciesPage';
import AttendancePage from '../pages/AttendancePage';
import TasksPage from '../pages/TasksPage';
import DailyReportsPage from '../pages/DailyReportsPage';
import PaymentsPage from '../pages/PaymentsPage';
import LeavePayslipsPage from '../pages/LeavePayslipsPage';
import LeaveRequestsPage from '../pages/LeaveRequestsPage';
import LeaveTypesPage from '../pages/LeaveTypesPage';
import HolidayListsPage from '../pages/HolidayListsPage';
import PayslipsPage from '../pages/PayslipsPage';
import ReportsPage from '../pages/ReportsPage';
import ComponentsShowcasePage from '../pages/ComponentsShowcasePage';
import PlaceholderPage from '../pages/PlaceholderPage';

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
              <ProjectDetailPage />
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
              <DailyReportsPage />
            </RoleRoute>
          }
        />

        {/* 8. Payments (Admin, Manager, Client) */}
        <Route
          path="payments"
          element={
            <RoleRoute permissions={['payments.client.manage', 'payments.client.viewOwn', 'payments.labour.manage']}>
              <PaymentsPage />
            </RoleRoute>
          }
        />

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
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'attendance.viewBoard']}>
              <LeaveTypesPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave/holidays"
          element={
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'attendance.viewBoard']}>
              <HolidayListsPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave/holidays/new"
          element={
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'attendance.viewBoard']}>
              <HolidayListsPage />
            </RoleRoute>
          }
        />
        <Route
          path="leave-types"
          element={
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'attendance.viewBoard']}>
              <LeaveTypesPage />
            </RoleRoute>
          }
        />

        {/* Payslips Route */}
        <Route
          path="payslips"
          element={
            <RoleRoute permissions={['payslips.viewOwn', 'leave.approve']}>
              <PayslipsPage />
            </RoleRoute>
          }
        />

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
              <PlaceholderPage
                title="Website & Leads"
                subtitle="Inbound inquiries from website, portfolio showcase analytics, and lead qualification pipeline"
                icon="website-leads"
                phase="Phase 4"
              />
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




