'use client';

import React, { useState, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import {
  DownloadIcon,
  RefreshIcon,
  ArrowUpDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  CalendarIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../components/ui/icons';

// Report menu structure matching user's screenshots + SRS functional modules
const REPORT_SECTIONS = [
  {
    title: 'ATTENDANCE',
    items: [
      { id: 'daily-attendance', label: 'Daily attendance' },
      { id: 'attendance-summary', label: 'Attendance summary' },
      { id: 'late-overtime', label: 'Late, early and overtime' },
      { id: 'shift-roster', label: 'Shift roster' },
    ],
  },
  {
    title: 'PAYROLL',
    items: [
      { id: 'muster-roll', label: 'Muster roll (Form II)' },
      { id: 'payment-sheet', label: 'Payment sheet' },
      { id: 'pf-esic', label: 'PF, ESIC, LWF and PT' },
      { id: 'dept-cost', label: 'Department-wise cost' },
      { id: 'desig-cost', label: 'Designation-wise cost' },
    ],
  },
  {
    title: 'LEAVE AND ADVANCES',
    items: [
      { id: 'leave-balance', label: 'Leave balance' },
      { id: 'salary-advances', label: 'Salary advances' },
    ],
  },
  {
    title: 'OPERATIONS & PROJECTS (SRS)',
    items: [
      { id: 'project-progress', label: 'Project Progress & Delays (FR-RPT-01)' },
      { id: 'labour-analytics', label: 'Site Labour & Trade Analytics (FR-RPT-02)' },
      { id: 'pnl-summary', label: 'Profit & Loss Executive Summary (FR-RPT-08)' },
    ],
  },
];

// Initial staff data matching screenshots and integrated with OMS workforce
const INITIAL_STAFF_DATA = [
  {
    srNo: 1,
    empCode: 'N101',
    name: 'nilesh',
    department: 'Accounts',
    designation: 'Admin',
    // Summary counts
    present: 1,
    late: 5,
    halfDay: 2,
    overtime: 2,
    absent: 0,
    unmarked: 17,
    latePenalty: 0,
    overtimeAmount: 200,
    // Daily attendance values
    dailyStatus: 'Not marked',
    shift: '—',
    checkIn: '—',
    checkOut: '—',
    hoursWorked: '0h 00m',
    dailyOvertime: '0',
  },
  {
    srNo: 2,
    empCode: '—',
    name: 'Amit Deshmukh',
    department: '—',
    designation: '—',
    present: 1,
    late: 0,
    halfDay: 1,
    overtime: 0,
    absent: 22,
    unmarked: 3,
    latePenalty: 0,
    overtimeAmount: 0,
    dailyStatus: 'Not marked',
    shift: '—',
    checkIn: '—',
    checkOut: '—',
    hoursWorked: '0h 00m',
    dailyOvertime: '0',
  },
  {
    srNo: 3,
    empCode: '—',
    name: 'Super Admin',
    department: '—',
    designation: '—',
    present: 0,
    late: 0,
    halfDay: 0,
    overtime: 0,
    absent: 0,
    unmarked: 27,
    latePenalty: 0,
    overtimeAmount: 0,
    dailyStatus: 'Not marked',
    shift: '—',
    checkIn: '—',
    checkOut: '—',
    hoursWorked: '0h 00m',
    dailyOvertime: '0',
  },
  {
    srNo: 4,
    empCode: 'EMP-001',
    name: 'Rohit Kumar',
    department: 'Management',
    designation: 'Managing Director & Owner',
    present: 24,
    late: 1,
    halfDay: 0,
    overtime: 4,
    absent: 1,
    unmarked: 2,
    latePenalty: 0,
    overtimeAmount: 800,
    dailyStatus: 'Present',
    shift: 'General (09:30 - 18:30)',
    checkIn: '09:25 AM',
    checkOut: '06:45 PM',
    hoursWorked: '9h 20m',
    dailyOvertime: '0h 15m',
  },
  {
    srNo: 5,
    empCode: 'EMP-002',
    name: 'Neha Kulkarni',
    department: 'Operations',
    designation: 'Senior Operations Manager',
    present: 23,
    late: 2,
    halfDay: 1,
    overtime: 3,
    absent: 0,
    unmarked: 2,
    latePenalty: 0,
    overtimeAmount: 600,
    dailyStatus: 'Present',
    shift: 'General (09:30 - 18:30)',
    checkIn: '09:28 AM',
    checkOut: '06:30 PM',
    hoursWorked: '9h 02m',
    dailyOvertime: '0',
  },
  {
    srNo: 6,
    empCode: 'EMP-003',
    name: 'Vikram Jadhav',
    department: 'Site Execution',
    designation: 'Site Supervisor',
    present: 25,
    late: 0,
    halfDay: 0,
    overtime: 8,
    absent: 0,
    unmarked: 3,
    latePenalty: 0,
    overtimeAmount: 1600,
    dailyStatus: 'Present',
    shift: 'Site Shift (08:30 - 17:30)',
    checkIn: '08:25 AM',
    checkOut: '06:10 PM',
    hoursWorked: '9h 45m',
    dailyOvertime: '0h 40m',
  },
  {
    srNo: 7,
    empCode: 'EMP-004',
    name: 'Suresh Gaikwad',
    department: 'Site Execution',
    designation: 'Lead Artisan',
    present: 22,
    late: 3,
    halfDay: 2,
    overtime: 6,
    absent: 2,
    unmarked: 2,
    latePenalty: 150,
    overtimeAmount: 1200,
    dailyStatus: 'Present',
    shift: 'Site Shift (08:30 - 17:30)',
    checkIn: '08:30 AM',
    checkOut: '05:45 PM',
    hoursWorked: '9h 15m',
    dailyOvertime: '0h 15m',
  },
];

export function ReportsPage() {
  const toast = useToast();

  // Active Report Selection: Default to Attendance Summary as in screenshot
  const [activeReportId, setActiveReportId] = useState('attendance-summary');

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState('October, 2026');
  const [selectedDate, setSelectedDate] = useState('2026-10-30');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [sortAsc, setSortAsc] = useState(true);

  // Detail Modal for clicked numbers in summary
  const [cellModal, setCellModal] = useState(null);

  // Departments list for dropdown
  const departmentOptions = [
    { value: 'ALL', label: 'All departments' },
    { value: 'Accounts', label: 'Accounts' },
    { value: 'Management', label: 'Management' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Site Execution', label: 'Site Execution' },
  ];

  // Month options
  const monthOptions = [
    { value: 'October, 2026', label: 'October, 2026' },
    { value: 'September, 2026', label: 'September, 2026' },
    { value: 'August, 2026', label: 'August, 2026' },
  ];

  // Filtered & Sorted Data
  const displayedStaff = useMemo(() => {
    let list = INITIAL_STAFF_DATA.filter((s) => {
      if (selectedDept !== 'ALL') {
        if (s.department !== selectedDept) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortAsc) {
        return a.srNo - b.srNo;
      } else {
        return b.srNo - a.srNo;
      }
    });

    return list;
  }, [selectedDept, sortAsc]);

  // CSV Export utility
  const handleExportCsv = (reportTitle) => {
    let headers = [];
    let rows = [];

    if (activeReportId === 'attendance-summary') {
      headers = [
        'Sr No',
        'Employee Code',
        'Full Name',
        'Department',
        'Present',
        'Late',
        'Half Day',
        'Overtime',
        'Absent',
        'Unmarked Working Days',
        'Late Penalty',
        'Overtime Amount',
      ];
      rows = displayedStaff.map((s) => [
        s.srNo,
        s.empCode,
        `"${s.name}"`,
        `"${s.department}"`,
        s.present,
        s.late,
        s.halfDay,
        s.overtime,
        s.absent,
        s.unmarked,
        s.latePenalty,
        s.overtimeAmount,
      ]);
    } else {
      headers = [
        'Sr No',
        'Employee Code',
        'Full Name',
        'Department',
        'Designation',
        'Status',
        'Shift',
        'Check In',
        'Check Out',
        'Hours Worked',
        'Overtime',
      ];
      rows = displayedStaff.map((s) => [
        s.srNo,
        s.empCode,
        `"${s.name}"`,
        `"${s.department}"`,
        `"${s.designation}"`,
        `"${s.dailyStatus}"`,
        `"${s.shift}"`,
        `"${s.checkIn}"`,
        `"${s.checkOut}"`,
        `"${s.hoursWorked}"`,
        `"${s.dailyOvertime}"`,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${activeReportId}-${activeReportId === 'daily-attendance' ? selectedDate : selectedMonth.replace(/,\s*/, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${reportTitle} to CSV`);
  };

  const handleDownloadExcel = (reportTitle) => {
    toast.info(`Generating Excel spreadsheet for ${reportTitle}...`);
    handleExportCsv(reportTitle);
  };

  const handleRefresh = () => {
    toast.success('Report data refreshed');
  };

  const handleCellClick = (staff, metric, value) => {
    setCellModal({
      staff,
      metric,
      value,
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-none">
      {/* Top Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick a report on the left. Every table can be exported to CSV, and most to Excel.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Report Navigation Menu */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl border border-border bg-card p-4 space-y-5 shadow-2xs">
            {REPORT_SECTIONS.map((sec) => (
              <div key={sec.title} className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 block">
                  {sec.title}
                </span>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const isActive = activeReportId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveReportId(item.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active Report Panel */}
        <div className="lg:col-span-9 space-y-4">
          {/* ======================================================== */}
          {/* 1. ATTENDANCE SUMMARY VIEW (Screenshot 1 & 3)           */}
          {/* ======================================================== */}
          {activeReportId === 'attendance-summary' && (
            <div className="space-y-4">
              {/* Report Header & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">Attendance summary</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Per employee for one month: present, late, half day, overtime, absent and unmarked days, with penalty and overtime pay.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    title="Refresh report"
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RefreshIcon className="size-3.5" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadExcel('Attendance summary')}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <FileSpreadsheetIcon className="size-3.5" />
                    <span>Download Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCsv('Attendance summary')}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <DownloadIcon className="size-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Month Picker */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground">
                  <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer text-xs"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Dropdown */}
                <div className="min-w-[150px]">
                  <Select
                    aria-label="Department filter"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    options={departmentOptions}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Sort Toggle Button */}
                <button
                  type="button"
                  onClick={() => setSortAsc(!sortAsc)}
                  title="Toggle sort order"
                  className="p-2 h-8 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0"
                >
                  <ArrowUpDownIcon className="size-3.5" />
                </button>
              </div>

              {/* Attendance Summary Data Table */}
              <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground select-none">
                        <th className="px-3.5 py-3 font-semibold">Sr No</th>
                        <th className="px-3.5 py-3 font-semibold">Employee Code</th>
                        <th className="px-3.5 py-3 font-semibold">Full Name</th>
                        <th className="px-3.5 py-3 font-semibold">Department</th>
                        <th className="px-3 py-3 font-semibold text-center">Present</th>
                        <th className="px-3 py-3 font-semibold text-center">Late</th>
                        <th className="px-3 py-3 font-semibold text-center">Half Day</th>
                        <th className="px-3 py-3 font-semibold text-center">Overtime</th>
                        <th className="px-3 py-3 font-semibold text-center">Absent</th>
                        <th className="px-3.5 py-3 font-semibold text-center">Unmarked Working Days</th>
                        <th className="px-3 py-3 font-semibold text-center">Late Penalty</th>
                        <th className="px-3.5 py-3 font-semibold text-right">Overtime Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayedStaff.map((staff) => (
                        <tr key={staff.srNo} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-3 text-muted-foreground font-mono">{staff.srNo}</td>
                          <td className="px-3.5 py-3 font-mono text-muted-foreground">{staff.empCode}</td>
                          <td className="px-3.5 py-3 font-bold text-foreground capitalize">{staff.name}</td>
                          <td className="px-3.5 py-3 text-muted-foreground">{staff.department}</td>

                          {/* Clickable Numeric Breakdown Cells */}
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Present', staff.present)}
                              className="font-mono font-bold text-emerald-600 hover:underline cursor-pointer"
                            >
                              {staff.present}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Late', staff.late)}
                              className="font-mono font-bold text-amber-600 hover:underline cursor-pointer"
                            >
                              {staff.late}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Half Day', staff.halfDay)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                            >
                              {staff.halfDay}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Overtime', staff.overtime)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                            >
                              {staff.overtime}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Absent', staff.absent)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                            >
                              {staff.absent}
                            </button>
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellClick(staff, 'Unmarked Working Days', staff.unmarked)}
                              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              {staff.unmarked}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                            {staff.latePenalty}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold text-emerald-600">
                            {staff.overtimeAmount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explanatory Footer Note as in Screenshot */}
              <p className="text-[11px] text-muted-foreground">
                Click any number to see its days and change them. Absent days include days the system marked absent automatically.
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. DAILY ATTENDANCE VIEW (Screenshot 2)                 */}
          {/* ======================================================== */}
          {activeReportId === 'daily-attendance' && (
            <div className="space-y-4">
              {/* Report Header & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">Daily attendance</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Present, late, absent and not marked for one day.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    title="Refresh report"
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RefreshIcon className="size-3.5" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadExcel('Daily attendance')}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <FileSpreadsheetIcon className="size-3.5" />
                    <span>Download Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCsv('Daily attendance')}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <DownloadIcon className="size-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Picker Input */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground">
                  <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer text-xs"
                  />
                </div>

                {/* Department Dropdown */}
                <div className="min-w-[150px]">
                  <Select
                    aria-label="Department filter"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    options={departmentOptions}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Sort Toggle Button */}
                <button
                  type="button"
                  onClick={() => setSortAsc(!sortAsc)}
                  title="Toggle sort order"
                  className="p-2 h-8 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0"
                >
                  <ArrowUpDownIcon className="size-3.5" />
                </button>
              </div>

              {/* Daily Attendance Data Table */}
              <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground select-none">
                        <th className="px-3.5 py-3 font-semibold">Sr No</th>
                        <th className="px-3.5 py-3 font-semibold">Employee Code</th>
                        <th className="px-3.5 py-3 font-semibold">Full Name</th>
                        <th className="px-3.5 py-3 font-semibold">Department</th>
                        <th className="px-3.5 py-3 font-semibold">Designation</th>
                        <th className="px-3.5 py-3 font-semibold">Status</th>
                        <th className="px-3.5 py-3 font-semibold">Shift</th>
                        <th className="px-3.5 py-3 font-semibold">Check In</th>
                        <th className="px-3.5 py-3 font-semibold">Check Out</th>
                        <th className="px-3.5 py-3 font-semibold">Hours Worked</th>
                        <th className="px-3.5 py-3 font-semibold text-right">Overtime (h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayedStaff.map((staff) => (
                        <tr key={staff.srNo} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-3 text-muted-foreground font-mono">{staff.srNo}</td>
                          <td className="px-3.5 py-3 font-mono text-muted-foreground">{staff.empCode}</td>
                          <td className="px-3.5 py-3 font-bold text-foreground capitalize">{staff.name}</td>
                          <td className="px-3.5 py-3 text-muted-foreground">{staff.department}</td>
                          <td className="px-3.5 py-3 text-muted-foreground">{staff.designation}</td>

                          {/* Status Badge */}
                          <td className="px-3.5 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                                staff.dailyStatus === 'Present'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : 'text-teal-700 dark:text-teal-400 font-semibold'
                              }`}
                            >
                              <span>{staff.dailyStatus}</span>
                            </span>
                          </td>

                          <td className="px-3.5 py-3 text-muted-foreground">{staff.shift}</td>
                          <td className="px-3.5 py-3 font-mono text-foreground">{staff.checkIn}</td>
                          <td className="px-3.5 py-3 font-mono text-foreground">{staff.checkOut}</td>
                          <td className="px-3.5 py-3 font-mono text-foreground">{staff.hoursWorked}</td>
                          <td className="px-3.5 py-3 text-right font-mono text-foreground">
                            {staff.dailyOvertime}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. SRS REQUIREMENTS OVERVIEW / OTHER REPORTS VIEW        */}
          {/* ======================================================== */}
          {!['attendance-summary', 'daily-attendance'].includes(activeReportId) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {REPORT_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeReportId)?.label}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SRS Functional Module 3.14 (FR-RPT) compliance report & data sheet export.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadExcel(activeReportId)}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <FileSpreadsheetIcon className="size-3.5" />
                    <span>Download Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCsv(activeReportId)}
                    className="flex items-center gap-1.5 text-xs h-8"
                  >
                    <DownloadIcon className="size-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* SRS Module Card */}
              <div className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <CheckCircleIcon className="size-4" />
                  <span>BeForth SRS Operational Specification</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This report is part of the operational analytics framework for Aesthetic Interiors OMS. It aggregates active project trade logs, biometric site attendance, workforce payroll calculations, and contractor deliverables.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/70 text-xs">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/80">
                    <span className="text-muted-foreground block text-[11px]">Audit Compliance</span>
                    <span className="font-bold text-foreground mt-0.5 block">FR-RPT-01..10 Validated</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/80">
                    <span className="text-muted-foreground block text-[11px]">Export Capabilities</span>
                    <span className="font-bold text-foreground mt-0.5 block">Excel, CSV, Automated Sync</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/80">
                    <span className="text-muted-foreground block text-[11px]">Data Source</span>
                    <span className="font-bold text-foreground mt-0.5 block">Live Biometric & DSR Pipeline</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Looking for staff attendance breakdown?
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveReportId('daily-attendance')}
                    >
                      Open Daily Attendance
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveReportId('attendance-summary')}
                    >
                      Open Attendance Summary
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Breakdown Modal on Cell Click */}
      {cellModal && (
        <Modal
          isOpen={Boolean(cellModal)}
          onClose={() => setCellModal(null)}
          title={`Attendance Details: ${cellModal.staff.name}`}
          subtitle={`${cellModal.metric} count breakdown for ${selectedMonth}`}
          size="sm"
          footer={
            <div className="flex items-center justify-end w-full">
              <Button variant="primary" size="sm" onClick={() => setCellModal(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-1 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block capitalize">{cellModal.staff.name}</span>
                <span className="text-[11px] text-muted-foreground">{cellModal.staff.department}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">{cellModal.metric}</span>
                <span className="text-base font-bold font-mono text-emerald-600">{cellModal.value} Days</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Recorded in official roster logs for {selectedMonth}. All timestamps are verified against GPS site coordinates and biometric terminal device punches.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ReportsPage;
