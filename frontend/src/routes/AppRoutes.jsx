import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../config/roles';
import { permissionMatrix } from '../config/permissions';

import ProtectedRoute from '../components/layout/ProtectedRoute';
import RoleRoute from '../components/layout/RoleRoute';
import AppShell from '../components/layout/AppShell';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import UsersPage from '../pages/UsersPage';
import ClientsPage from '../pages/ClientsPage';
import ClientDetailPage from '../pages/ClientDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import AgenciesPage from '../pages/AgenciesPage';
import ComponentsShowcasePage from '../pages/ComponentsShowcasePage';
import PlaceholderPage from '../pages/PlaceholderPage';

export function AppRoutes() {
  const { role } = useAuth();

  // Root redirect destination depending on role
  const defaultDestination = role === ROLES.CLIENT ? '/projects' : '/dashboard';

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
              <PlaceholderPage
                title="Attendance"
                subtitle="Daily site punch-in/out, biometric logs, overtime records, and site muster roll"
                icon="attendance"
                phase="Phase 3"
              />
            </RoleRoute>
          }
        />

        {/* 6. Tasks (Admin, Manager, Supervisor, Worker) */}
        <Route
          path="tasks"
          element={
            <RoleRoute permissions={['tasks.updateOwn', 'tasks.create', 'tasks.viewAll']}>
              <PlaceholderPage
                title="Tasks"
                subtitle="Daily site trade checklists, subcontractor inspection tickets, and snag list tracking"
                icon="tasks"
                phase="Phase 3"
              />
            </RoleRoute>
          }
        />

        {/* 7. Daily Reports (All roles) */}
        <Route
          path="daily-reports"
          element={
            <RoleRoute permissions={['dsr.submit', 'dsr.viewAll', 'feedback.submit']}>
              <PlaceholderPage
                title="Daily Reports"
                subtitle="Daily Site Reports (DSR), photo documentation, material arrivals, and client updates"
                icon="daily-reports"
                phase="Phase 3"
              />
            </RoleRoute>
          }
        />

        {/* 8. Payments (Admin, Manager, Client) */}
        <Route
          path="payments"
          element={
            <RoleRoute permissions={['payments.client.manage', 'payments.client.viewOwn', 'payments.labour.manage']}>
              <PlaceholderPage
                title="Payments"
                subtitle="Milestone payment schedules, vendor invoices, stage advance approvals, and client receipts"
                icon="payments"
                phase="Phase 4"
              />
            </RoleRoute>
          }
        />

        {/* 9. Leave & Payslips (Admin, Manager, Supervisor, Worker) */}
        <Route
          path="leave-payslips"
          element={
            <RoleRoute permissions={['leave.apply', 'leave.approve', 'payslips.viewOwn']}>
              <PlaceholderPage
                title="Leave & Payslips"
                subtitle="Worker leave requests, supervisor approvals, monthly payslips, and piece-rate artisan payouts"
                icon="leave-payslips"
                phase="Phase 4"
              />
            </RoleRoute>
          }
        />

        {/* 10. Reports (Admin & Manager) */}
        <Route
          path="reports"
          element={
            <RoleRoute permission="reports.view">
              <PlaceholderPage
                title="Reports & Analytics"
                subtitle="Operational velocity, stage delay metrics, vendor performance ratings, and financial margins"
                icon="reports"
                phase="Phase 4"
              />
            </RoleRoute>
          }
        />

        {/* 11. Settings & Sub-routes (Admin only) */}
        <Route path="settings" element={<Navigate to="/settings/users" replace />} />
        <Route
          path="settings/users"
          element={
            <RoleRoute permission="users.manage">
              <UsersPage />
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
