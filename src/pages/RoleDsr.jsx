import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isDebug } from '../config/env';
import DailyReportsPage from './DailyReportsPage';
import WorkerDsrPage from './WorkerDsrPage';

/**
 * The route's DSR page. Chooses by what the person may do (permissions, never role names): someone who can log
 * their own work but cannot see everyone's gets the worker view (only their own entries). Everyone else keeps the
 * existing page exactly as it is. The worker view needs the backend; the standalone mock mode keeps the old page.
 */
export function RoleDsr(props) {
  const { hasPermission } = useAuth();
  const isWorkerView =
    !isDebug() && hasPermission('dsr.submit') && !hasPermission('dsr.viewAll') && !hasPermission('dsr.editAll');
  return isWorkerView ? <WorkerDsrPage /> : <DailyReportsPage {...props} />;
}

export default RoleDsr;
