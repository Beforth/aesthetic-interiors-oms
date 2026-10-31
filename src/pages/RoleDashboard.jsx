import React from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardPage from './DashboardPage';
import WorkerDashboard from '../components/domain/WorkerDashboard';

/**
 * The route's Dashboard. Chooses by what the person may do (permissions, never role names): a site worker punches
 * in, does the tasks given to them and sees only their own data, so they get the small worker view. Everyone else
 * keeps the existing dashboard exactly as it is.
 */
export function RoleDashboard() {
  const { hasPermission } = useAuth();
  const isWorkerView =
    hasPermission('attendance.markOwn') &&
    !hasPermission('attendance.viewBoard') &&
    !hasPermission('tasks.create') &&
    !hasPermission('tasks.viewAll');
  return isWorkerView ? <WorkerDashboard /> : <DashboardPage />;
}

export default RoleDashboard;
