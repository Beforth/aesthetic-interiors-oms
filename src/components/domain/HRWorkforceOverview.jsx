'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';
import { CheckIcon, XIcon } from '../ui/icons';
import { userService } from '../../services/userService';
import { attendanceService } from '../../services/attendanceService';
import { leaveService } from '../../services/leaveService';
import { ROLE_LABELS } from '../../config/roles';
import { formatDate } from '../../utils/formatters';

export function HRWorkforceOverview({
  users: propUsers = null,
  recentEmployees: propRecentEmployees = null,
  recentLeaves: propRecentLeaves = null,
  onDataRefresh,
}) {
  const toast = useToast();

  const defaultRecentEmployees = useMemo(
    () => [
      {
        id: 'emp-1',
        name: 'Rahul Chauhan',
        department: 'Human Resources',
        role: 'Recruiter',
        joinedDate: '23 Jun 2026',
        joinedOn: '2026-06-23',
      },
      {
        id: 'emp-2',
        name: 'Harsh Malhotra',
        department: 'Finance & Accounts',
        role: 'Accountant',
        joinedDate: '05 Jun 2026',
        joinedOn: '2026-06-05',
      },
      {
        id: 'emp-3',
        name: 'Divya Sharma',
        department: 'Engineering',
        role: 'Senior Software Engineer',
        joinedDate: '09 Mar 2026',
        joinedOn: '2026-03-09',
      },
      {
        id: 'emp-4',
        name: 'Pooja Malhotra',
        department: 'Operations',
        role: 'Operations Executive',
        joinedDate: '11 Dec 2025',
        joinedOn: '2025-12-11',
      },
      {
        id: 'emp-5',
        name: 'Vikram Sethi',
        department: 'Site Execution',
        role: 'Civil Site Engineer',
        joinedDate: '28 Nov 2025',
        joinedOn: '2025-11-28',
      },
      {
        id: 'emp-6',
        name: 'Ananya Roy',
        department: 'Interior Design',
        role: '3D Visualizer',
        joinedDate: '15 Oct 2025',
        joinedOn: '2025-10-15',
      },
    ],
    []
  );

  const defaultLeaveApplications = useMemo(
    () => [
      {
        id: 'leave-1',
        name: 'Payal Verma',
        leaveType: 'Paid Leave',
        duration: '04 Aug - 04 Aug (1d)',
        status: 'pending_hr',
        statusLabel: 'Level 2 (HR)',
      },
      {
        id: 'leave-2',
        name: 'Demo Admin',
        leaveType: 'Paid Leave',
        duration: '08 Sep - 08 Sep (1d)',
        status: 'rejected',
        statusLabel: 'Rejected',
      },
      {
        id: 'leave-3',
        name: 'Aditya Chatterjee',
        leaveType: 'Paid Leave',
        duration: '19 Aug - 19 Aug (1d)',
        status: 'rejected',
        statusLabel: 'Rejected',
      },
      {
        id: 'leave-4',
        name: 'Aman Kulkarni',
        leaveType: 'Paid Leave',
        duration: '03 Aug - 04 Aug (2d)',
        status: 'approved',
        statusLabel: 'Approved',
      },
    ],
    []
  );

  const [employeesList, setEmployeesList] = useState([]);
  const [leavesList, setLeavesList] = useState([]);

  // Load and format employees
  const loadEmployees = async () => {
    try {
      const allUsers = (propUsers && propUsers.length > 0) ? propUsers : await userService.getAllUsers();
      const staffOnly = (allUsers || []).filter(
        (u) => u.role !== 'client' && u.status !== 'inactive'
      );

      const formatted = staffOnly.map((u) => {
        let dept = u.department;
        if (!dept) {
          const r = String(u.role || '').toLowerCase();
          if (r === 'admin' || r === 'owner') dept = 'Management';
          else if (r === 'manager') dept = 'Operations';
          else if (r === 'supervisor') dept = 'Site Execution';
          else if (r === 'worker') dept = 'Site Trade';
          else dept = 'Human Resources';
        }
        return {
          id: u.id,
          name: u.name,
          department: dept,
          role: u.title || (ROLE_LABELS[u.role] || u.role || 'Staff Member'),
          joinedDate: u.joinedOn ? formatDate(u.joinedOn) : (u.joinedDate || 'Recent'),
          joinedOn: u.joinedOn || '2026-10-20',
        };
      });

      // Sort newest joined employees first
      formatted.sort((a, b) => new Date(b.joinedOn || '1970-01-01') - new Date(a.joinedOn || '1970-01-01'));

      // Ensure at least 6 rich items by appending default list if needed
      const existingNames = new Set(formatted.map((e) => e.name.toLowerCase()));
      const merged = [...formatted];
      defaultRecentEmployees.forEach((d) => {
        if (!existingNames.has(d.name.toLowerCase()) && merged.length < 6) {
          merged.push(d);
          existingNames.add(d.name.toLowerCase());
        }
      });

      setEmployeesList(merged);
    } catch (e) {
      console.error('Failed to load recent employees', e);
      setEmployeesList(defaultRecentEmployees);
    }
  };

    // Load and format attendance leave requests directly from attendanceService
  const loadLeaves = async () => {
    try {
      // 1. Load from dedicated leave requests
      const leaveApps = leaveService.getLeaveRequests();
      const pendingLeaves = (leaveApps || []).filter((r) => String(r.status).toLowerCase() === 'pending');
      const formattedLeaves = pendingLeaves.map((r) => ({
        id: r.id,
        name: r.employeeName || 'Staff Member',
        leaveType: r.leaveType || 'Privileged Leave',
        duration: r.durationDays ? `${r.durationDays} d` : '1 d',
        status: 'pending',
        statusLabel: 'Pending',
        reason: r.reason || '',
        date: r.startDate || '',
        isLeaveApp: true,
      }));

      // 2. Also load from attendance regularizations
      let formattedAtt = [];
      try {
        const reqs = await attendanceService.getRequests();
        const pendingReqs = (reqs || []).filter((r) => {
          const s = String(r.status || '').toLowerCase();
          return s === 'pending' || s === 'pending_hr';
        });
        formattedAtt = pendingReqs.map((r) => ({
          id: r.id,
          name: r.employeeName || r.userName || r.name || 'Staff Member',
          leaveType: r.leaveType || r.type || 'Punch Regularization',
          duration: r.duration || (r.date ? `${r.date} (1d)` : '1d'),
          status: 'pending',
          statusLabel: 'Pending',
          reason: r.reason || '',
          date: r.date || '',
          isLeaveApp: false,
        }));
      } catch (attErr) {}

      const combined = [...formattedLeaves, ...formattedAtt];
      setLeavesList(combined);
    } catch (e) {
      console.error('Failed to load recent leaves', e);
      setLeavesList([]);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadLeaves();

    const handleUsersUpdate = () => {
      loadEmployees();
    };
    const handleLeavesUpdate = () => {
      loadLeaves();
    };

    window.addEventListener('osm_users_updated', handleUsersUpdate);
    window.addEventListener('osm_user_created', handleUsersUpdate);
    window.addEventListener('osm_attendance_requests_updated', handleLeavesUpdate);
    window.addEventListener('osm_leave_applications_updated', handleLeavesUpdate);
    window.addEventListener('osm_attendance_updated', handleLeavesUpdate);
    window.addEventListener('storage', handleLeavesUpdate);

    return () => {
      window.removeEventListener('osm_users_updated', handleUsersUpdate);
      window.removeEventListener('osm_user_created', handleUsersUpdate);
      window.removeEventListener('osm_attendance_requests_updated', handleLeavesUpdate);
      window.removeEventListener('osm_leave_applications_updated', handleLeavesUpdate);
      window.removeEventListener('osm_attendance_updated', handleLeavesUpdate);
      window.removeEventListener('storage', handleLeavesUpdate);
    };
  }, []);

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      loadEmployees();
    }
  }, [propUsers]);

  // Leave applications and attendance requests are numbered separately, so a row is known by its kind and its id
  const rowKey = (row) => `${row.isLeaveApp ? 'leave' : 'attendance'}-${row.id}`;
  const [decidingKey, setDecidingKey] = useState(null);

  const handleDecide = async (row, decision) => {
    setDecidingKey(rowKey(row));
    try {
      if (row.isLeaveApp) {
        await leaveService.decideLeave(row.id, decision);
      } else {
        await attendanceService.decideRequest(row.id, decision);
      }
      setLeavesList((prev) => prev.filter((l) => rowKey(l) !== rowKey(row)));
      toast.success(`Request from ${row.name} ${decision === 'approve' ? 'approved' : 'rejected'}`);
      if (onDataRefresh) onDataRefresh();
    } catch (e) {
      console.error(`Could not ${decision} the request`, e);
      toast.error(e?.message || `Could not ${decision} the request from ${row.name}`);
      loadLeaves();
    } finally {
      setDecidingKey(null);
    }
  };

  const leaveCard = (
    <Card
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col"
      title="Leave requests"
      headerAction={
        <Link to="/attendance?tab=requests" className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      }
    >
      {leavesList.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-success">
            <CheckIcon className="size-5" />
          </span>
          <p className="mt-2 text-[13px] font-semibold text-foreground">All caught up</p>
          <p className="text-[11px] text-muted-foreground">No requests waiting.</p>
        </div>
      ) : (
        <>
          <ul className="max-h-44 space-y-1 overflow-y-auto scrollbar-thin">
          {leavesList.map((leave) => (
            <li key={rowKey(leave)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-muted">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{leave.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {leave.leaveType} · {leave.duration}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDecide(leave, 'approve')}
                  disabled={decidingKey !== null}
                  className="cursor-pointer rounded-lg p-1.5 text-success transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Approve request"
                  aria-label={`Approve request from ${leave.name}`}
                >
                  <CheckIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDecide(leave, 'reject')}
                  disabled={decidingKey !== null}
                  className="cursor-pointer rounded-lg p-1.5 text-destructive transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Reject request"
                  aria-label={`Reject request from ${leave.name}`}
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </li>
          ))}
          </ul>
          <p className="mt-auto rounded-lg bg-brand-50 px-3 py-2 text-center text-[11px] font-semibold text-primary">
            {leavesList.length} {leavesList.length === 1 ? 'request' : 'requests'} waiting for your decision
          </p>
        </>
      )}
    </Card>
  );

  // six tiles fill two rows; with more people the sixth tile says how many are left
  const shownPeople = employeesList.length > 6 ? employeesList.slice(0, 5) : employeesList;
  const morePeople = employeesList.length - shownPeople.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="Recent employees"
        headerAction={
          <Link to="/settings/users" className="text-xs font-semibold text-primary hover:underline">
            Manage users
          </Link>
        }
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownPeople.map((emp) => (
            <li key={emp.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-muted p-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50">
              <Avatar name={emp.name} size="md" className="shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-foreground">{emp.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground" title={`${emp.department} · ${emp.role}`}>
                  {emp.role}
                </span>
                <span className="block truncate text-[11px] text-primary">
                  {emp.joinedDate === 'Recent' ? emp.department : `Joined ${emp.joinedDate}`}
                </span>
              </span>
            </li>
          ))}
          {morePeople > 0 && (
            <li>
              <Link
                to="/settings/users"
                className="flex h-full min-h-16 items-center justify-center rounded-xl border border-dashed border-brand-300 p-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-brand-50"
              >
                +{morePeople} more
              </Link>
            </li>
          )}
        </ul>
      </Card>

      {leaveCard}
    </div>
  );
}

export default HRWorkforceOverview;
