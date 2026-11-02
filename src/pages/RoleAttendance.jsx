import React from 'react';
import { useAuth } from '../context/AuthContext';
import AttendancePage from './AttendancePage';
import WorkerAttendancePage from './WorkerAttendancePage';

/**
 * The route's Attendance page. Chooses by what the person may do (permissions, never role names): someone who can
 * only punch their own attendance gets the worker view (own records and requests). Everyone else keeps the
 * existing page exactly as it is.
 */
export function RoleAttendance(props) {
  const { hasPermission } = useAuth();
  const isWorkerView =
    hasPermission('attendance.markOwn') && !hasPermission('attendance.viewBoard') && !hasPermission('attendance.correct');
  return isWorkerView ? <WorkerAttendancePage /> : <AttendancePage {...props} />;
}

export default RoleAttendance;
