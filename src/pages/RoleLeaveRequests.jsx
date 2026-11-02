import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isDebug } from '../config/env';
import LeaveRequestsPage from './LeaveRequestsPage';
import WorkerLeavePage from './WorkerLeavePage';

/**
 * The route's Leave requests page. Chooses by what the person may do (permissions, never role names): someone who
 * can ask for leave but cannot approve it gets the worker view (only their own requests). Everyone else keeps the
 * existing page exactly as it is. The worker view needs the backend; the standalone mock mode keeps the old page.
 */
export function RoleLeaveRequests(props) {
  const { hasPermission } = useAuth();
  const isWorkerView =
    !isDebug() && hasPermission('leave.apply') && !hasPermission('leave.approve') && !hasPermission('attendance.viewBoard');
  return isWorkerView ? <WorkerLeavePage /> : <LeaveRequestsPage {...props} />;
}

export default RoleLeaveRequests;
