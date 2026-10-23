import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

export function HRWorkforceOverview({ totalEmployees = 30, recentEmployees = null, recentLeaves = null }) {
  const defaultRecentEmployees = [
    {
      id: 'emp-1',
      name: 'Rahul Chauhan',
      initials: 'RC',
      department: 'Human Resources',
      role: 'Recruiter',
      joinedDate: '23 Jun 2026',
    },
    {
      id: 'emp-2',
      name: 'Harsh Malhotra',
      initials: 'HM',
      department: 'Finance & Accounts',
      role: 'Accountant',
      joinedDate: '05 Jun 2026',
    },
    {
      id: 'emp-3',
      name: 'Divya Sharma',
      initials: 'DS',
      department: 'Engineering',
      role: 'Senior Software Engineer',
      joinedDate: '09 Mar 2026',
    },
    {
      id: 'emp-4',
      name: 'Pooja Malhotra',
      initials: 'PM',
      department: 'Operations',
      role: 'Operations Executive',
      joinedDate: '11 Dec 2025',
    },
  ];

  const defaultLeaveApplications = [
    {
      id: 'leave-1',
      name: 'Payal Verma',
      initials: 'PV',
      leaveType: 'Paid Leave',
      duration: '04 Aug - 04 Aug (1d)',
      status: 'pending_hr',
      statusLabel: 'Level 2 (HR)',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      dotClass: 'bg-amber-500',
    },
    {
      id: 'leave-2',
      name: 'Demo Admin',
      initials: 'DA',
      leaveType: 'Paid Leave',
      duration: '08 Sep - 08 Sep (1d)',
      status: 'rejected',
      statusLabel: '✕ Rejected',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    },
    {
      id: 'leave-3',
      name: 'Aditya Chatterjee',
      initials: 'AC',
      leaveType: 'Paid Leave',
      duration: '19 Aug - 19 Aug (1d)',
      status: 'rejected',
      statusLabel: '✕ Rejected',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    },
    {
      id: 'leave-4',
      name: 'Aman Kulkarni',
      initials: 'AK',
      leaveType: 'Paid Leave',
      duration: '03 Aug - 04 Aug (2d)',
      status: 'approved',
      statusLabel: '✓ Approved',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
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
  const leavesList = recentLeaves || defaultLeaveApplications;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT COLUMN: Recent Employees & Recent Leave Applications */}
      <div className="space-y-6">
        {/* Card A: Recent Employees */}
        <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <h3 className="text-sm font-bold text-text-main">Recent Employees</h3>
            <Link
              to="/users"
              className="text-xs text-text-muted hover:text-brand-600 font-semibold cursor-pointer transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {employeesList.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                    {emp.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-main truncate">{emp.name}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {emp.department} • {emp.role}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-text-muted font-medium shrink-0 ml-3">
                  {emp.joinedDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card B: Recent Leave Applications */}
        <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <h3 className="text-sm font-bold text-text-main">Recent Leave Applications</h3>
            <Link
              to="/leaves"
              className="text-xs text-text-muted hover:text-brand-600 font-semibold cursor-pointer transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {leavesList.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-100">
                    {leave.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-main truncate">{leave.name}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {leave.leaveType} • {leave.duration}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 ml-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${leave.badgeClass}`}
                  >
                    {leave.dotClass && <span className={`w-1.5 h-1.5 rounded-full ${leave.dotClass}`} />}
                    <span>{leave.statusLabel}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Total Employees & Upcoming Holidays */}
      <div className="space-y-6">
        {/* Card C: Total Employees Card */}
        <div className="p-6 bg-surface rounded-2xl border border-border shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              TOTAL EMPLOYEES
            </span>
            <div className="text-4xl font-black text-text-main tracking-tight">
              {totalEmployees}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 pt-1">
              <Icon name="trending-up" size={14} className="stroke-[2.5]" />
              <span>+1 this month</span>
            </div>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
            <Icon name="users" size={28} />
          </div>
        </div>

        {/* Card D: Upcoming Holidays */}
        <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <h3 className="text-sm font-bold text-text-main">Upcoming Holidays</h3>
            <span className="text-xs text-text-muted font-semibold">Calendar</span>
          </div>

          <div className="space-y-3.5">
            {upcomingHolidays.map((hol) => (
              <div key={hol.id} className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                {/* Date Badge */}
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold tracking-wider uppercase leading-none">{hol.month}</span>
                  <span className="text-base font-extrabold leading-none mt-0.5">{hol.day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-main truncate">{hol.name}</p>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">
                    {hol.dayOfWeek} • {hol.relativeTime}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HRWorkforceOverview;
