import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardPage from './DashboardPage';
import PersonalDashboard from '../components/domain/PersonalDashboard';

/**
 * The route's Dashboard. Chooses by what the person may do (permissions, never role names): someone who punches in
 * but cannot see every project (a site worker or a site supervisor) gets the personal dashboard, which is built from
 * their own permissions. Admin and manager keep the existing dashboard exactly as it is.
 */
export function RoleDashboard() {
  const { hasPermission } = useAuth();
  const isPersonalView = hasPermission('attendance.markOwn') && !hasPermission('projects.viewAll');
  return isPersonalView ? <PersonalDashboard /> : <DashboardPage />;
}

export default RoleDashboard;
