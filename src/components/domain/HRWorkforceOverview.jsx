import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

export function HRWorkforceOverview({ totalEmployees = 30, recentEmployees = null, recentLeaves = null }) {
  const toast = useToast();
  const defaultRecentEmployees = [
    {
      id: 'emp-1',
      name: 'Rahul Chauhan',
      department: 'Human Resources',
      role: 'Recruiter',
      joinedDate: '23 Jun 2026',
    },
    {
      id: 'emp-2',
      name: 'Harsh Malhotra',
      department: 'Finance & Accounts',
      role: 'Accountant',
      joinedDate: '05 Jun 2026',
    },
    {
      id: 'emp-3',
      name: 'Divya Sharma',
      department: 'Engineering',
      role: 'Senior Software Engineer',
      joinedDate: '09 Mar 2026',
    },
    {
      id: 'emp-4',
      name: 'Pooja Malhotra',
      department: 'Operations',
      role: 'Operations Executive',
      joinedDate: '11 Dec 2025',
    },
    {
      id: 'emp-5',
      name: 'Vikram Sethi',
      department: 'Site Execution',
      role: 'Civil Site Engineer',
      joinedDate: '28 Nov 2025',
    },
    {
      id: 'emp-6',
      name: 'Ananya Roy',
      department: 'Interior Design',
      role: '3D Visualizer',
      joinedDate: '15 Oct 2025',
    },
  ];

  const defaultLeaveApplications = [
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
    {
      id: 'leave-5',
      name: 'Suresh Raina',
      leaveType: 'Sick Leave',
      duration: '12 Jul - 13 Jul (2d)',
      status: 'approved',
      statusLabel: 'Approved',
    },
    {
      id: 'leave-6',
      name: 'Megha Singhania',
      leaveType: 'Casual Leave',
      duration: '25 Jun - 26 Jun (2d)',
      status: 'pending_hr',
      statusLabel: 'Level 1 (Lead)',
    },
  ];

  const upcomingHolidays = [
    {
      id: 'hol-1',
      month: 'NOV',
      day: '08',
      name: 'Diwali',
      dayOfWeek: 'Sunday',
      relativeTime: '2 weeks, 2 days',
    },
    {
      id: 'hol-2',
      month: 'NOV',
      day: '10',
      name: 'Diwali (Bhai Dooj)',
      dayOfWeek: 'Tuesday',
      relativeTime: '2 weeks, 4 days',
    },
    {
      id: 'hol-3',
      month: 'DEC',
      day: '25',
      name: 'Christmas',
      dayOfWeek: 'Friday',
      relativeTime: '2 months',
    },
  ];

  const employeesList = recentEmployees || defaultRecentEmployees;
  const [leavesList, setLeavesList] = useState(recentLeaves || defaultLeaveApplications);

  const handleApproveLeave = (id) => {
    setLeavesList((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'approved', statusLabel: 'Approved' } : l))
    );
    toast.success('Leave request approved');
  };

  const handleRejectLeave = (id) => {
    setLeavesList((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'rejected', statusLabel: 'Rejected' } : l))
    );
    toast.success('Leave request rejected');
  };
  const pendingLeavesCount = leavesList.filter((l) => l.status === 'pending_hr' || l.status === 'pending').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
      {/* COLUMN 1: Recent Employees Bento Tile */}
      <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-brand-300 transition-all flex flex-col justify-between h-full">
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                <span>Recent Employees</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  {employeesList.length} New
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Newly onboarded staff & site personnel
              </p>
            </div>

            <Link
              to="/users"
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline-offset-2 hover:underline cursor-pointer shrink-0"
            >
              View All →
            </Link>
          </div>

          {/* Employees List with Bento Scrollbar */}
          <div className="flex-1 min-h-[210px] max-h-[260px] overflow-y-auto pr-1.5 space-y-2 scrollbar-thin">
            {employeesList.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={emp.name}
                    size="md"
                    status="online"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                      {emp.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {emp.department} • <span className="font-medium">{emp.role}</span>
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-text-muted bg-secondary/80 px-2 py-0.5 rounded-md border border-border/60 shrink-0 ml-2">
                  {emp.joinedDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
          <span>New team members</span>
          <Link to="/users" className="font-semibold text-brand-600 hover:underline">
            Directory ({employeesList.length})
          </Link>
        </div>
      </div>

      {/* COLUMN 2: Recent Leave Applications Bento Tile */}
      <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between h-full">
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>Recent Leaves</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {pendingLeavesCount} Pending
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Staff leave requests & approval pipeline
              </p>
            </div>

            <Link
              to="/attendance"
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline-offset-2 hover:underline cursor-pointer shrink-0"
            >
              View All →
            </Link>
          </div>

          {/* Leave Applications List with Bento Scrollbar */}
          <div className="flex-1 min-h-[210px] max-h-[260px] overflow-y-auto pr-1.5 space-y-2 scrollbar-thin">
            {leavesList.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={leave.name}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                      {leave.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      <span className="font-semibold text-text-main/80">{leave.leaveType}</span> • {leave.duration}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {leave.status === 'pending_hr' || leave.status === 'pending' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(leave.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                        title="Approve Leave"
                      >
                        <Icon name="check" size={11} className="stroke-[2.5]" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectLeave(leave.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                        title="Reject Leave"
                      >
                        <Icon name="x" size={11} className="stroke-[2.5]" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleApproveLeave(leave.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer",
                          leave.status === 'approved'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-400/30"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-emerald-50 hover:text-emerald-700"
                        )}
                        title="Mark Approved"
                      >
                        <Icon name="check" size={11} className="stroke-[2.5]" />
                        <span>{leave.status === 'approved' ? 'Approved' : 'Approve'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectLeave(leave.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer",
                          leave.status === 'rejected'
                            ? "bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-400/30"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-rose-50 hover:text-rose-700"
                        )}
                        title="Mark Rejected"
                      >
                        <Icon name="x" size={11} className="stroke-[2.5]" />
                        <span>{leave.status === 'rejected' ? 'Rejected' : 'Reject'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
          <span>Leave requests</span>
          <Link to="/attendance" className="font-semibold text-brand-600 hover:underline">
            Manage Attendance
          </Link>
        </div>
      </div>

      {/* COLUMN 3: Right Bento Stack (Total Workforce + Upcoming Holidays) */}
      <div className="flex flex-col gap-4.5 justify-between h-full md:col-span-2 lg:col-span-1">
        {/* Bento Tile 3A: Total Workforce Stat Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-brand-300 shadow-2xs transition-all flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Total Workforce
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shadow-2xs">
              <Icon name="users" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{totalEmployees}</span>
            <span className="text-xs text-text-muted font-medium">Active Staff</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Icon name="trending-up" size={11} className="stroke-[2.5]" />
              <span>+1 this month</span>
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            Active payroll personnel & on-site trade artisans
          </p>
        </div>

        {/* Bento Tile 3B: Upcoming Holidays Card */}
        <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-brand-300 transition-all flex flex-col justify-between flex-1 min-h-[220px]">
          <div className="space-y-3">
            {/* Card Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Upcoming Holidays</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {upcomingHolidays.length} Listed
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Official festive & company non-working schedule
                </p>
              </div>

              <Link
                to="/attendance"
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline-offset-2 hover:underline cursor-pointer shrink-0"
              >
                Calendar →
              </Link>
            </div>

            {/* Holidays List */}
            <div className="space-y-2">
              {upcomingHolidays.map((hol) => (
                <div
                  key={hol.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
                >
                  {/* Clean BefUI Calendar Date Badge */}
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 border border-brand-200/80 flex flex-col items-center justify-center shrink-0 shadow-2xs group-hover:border-brand-300 transition-colors">
                    <span className="text-[9px] font-bold tracking-wider uppercase text-brand-600 leading-none">
                      {hol.month}
                    </span>
                    <span className="text-sm font-black text-brand-900 leading-none mt-0.5">
                      {hol.day}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                      {hol.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5 flex items-center gap-1.5">
                      <span>{hol.dayOfWeek}</span>
                      <span>•</span>
                      <span className="text-brand-700 font-semibold">
                        {hol.relativeTime}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
            <span>Holiday schedule</span>
            <Link to="/attendance" className="font-semibold text-brand-600 hover:underline">
              Full Year Roster
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HRWorkforceOverview;
