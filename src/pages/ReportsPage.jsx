'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import Input from '../components/ui/Input';
import {
  PlusIcon,
  DownloadIcon,
  RefreshIcon,
  ArrowUpDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  CalendarIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  CheckIcon,
} from '../components/ui/icons';

// Report categories matching user requirements:
// 1. Attendance (2 options)
// 2. Payroll (5 options)
// 3. Leave and Advances (2 options)
const REPORT_CATEGORIES = [
  {
    key: 'attendance',
    title: 'Attendance',
    items: [
      { id: 'daily-attendance', label: 'Daily attendance', desc: 'Present, late, absent and not marked records for one day.' },
      { id: 'attendance-summary', label: 'Attendance summary', desc: 'Per employee for one month: present, late, half day, overtime, absent and unmarked days, with penalty and overtime pay.' },
    ],
  },
  {
    key: 'payroll',
    title: 'Payroll',
    items: [
      { id: 'muster-roll', label: 'Muster roll (Form II)', desc: 'Statutory Form II muster roll with monthly day-by-day attendance codes and total payable days.' },
      { id: 'payment-sheet', label: 'Payment sheet', desc: 'Net disbursement payroll sheet with gross salary, standard deductions, overtime add-on, and net take-home.' },
      { id: 'pf-esic', label: 'PF, ESIC, LWF and PT', desc: 'Statutory compliance schedule detailing employee and employer contributions for PF, ESIC, and State PT.' },
      { id: 'dept-cost', label: 'Department-wise cost', desc: 'Aggregate workforce expenditure, cost-center allocations, and hourly trade burden by department.' },
      { id: 'desig-cost', label: 'Designation-wise cost', desc: 'Payroll distribution across architectural leads, project managers, site supervisors, and artisans.' },
    ],
  },
  {
    key: 'leave-advances',
    title: 'Leave and Advances',
    items: [
      { id: 'leave-balance', label: 'Leave balance', desc: 'Accrued, consumed, and remaining annual, sick, and compensatory leaves per staff member.' },
      { id: 'salary-advances', label: 'Salary advances', desc: 'Ledger of advance disbursements, interest-free EMI tenures, and monthly payroll deduction status.' },
    ],
  },
];

// Initial staff data matching screenshots and integrated with OMS workforce
const INITIAL_STAFF_DATA = [
  {
    srNo: 1,
    empCode: 'EMP-010',
    name: 'Vivek Zhope',
    department: 'Site Execution',
    designation: 'Site Engineer',
    present: 20,
    late: 2,
    halfDay: 1,
    overtime: 3,
    absent: 1,
    unmarked: 1,
    latePenalty: 0,
    overtimeAmount: 450,
    dailyStatus: null,
    shift: 'General (09:30 - 18:30)',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 2,
    empCode: 'N101',
    name: 'nilesh',
    department: 'Accounts',
    designation: 'Admin',
    present: 1,
    late: 5,
    halfDay: 2,
    overtime: 2,
    absent: 0,
    unmarked: 17,
    latePenalty: 0,
    overtimeAmount: 200,
    dailyStatus: null,
    shift: '—',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 3,
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
    dailyStatus: null,
    shift: '—',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 4,
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
    dailyStatus: null,
    shift: '—',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 5,
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
    dailyStatus: null,
    shift: 'General (09:30 - 18:30)',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 6,
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
    dailyStatus: null,
    shift: 'General (09:30 - 18:30)',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 7,
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
    dailyStatus: null,
    shift: 'Site Shift (08:30 - 17:30)',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
  {
    srNo: 8,
    empCode: 'EMP-004',
    name: 'Suresh Gaikwad',
    department: 'Site Execution',
    designation: 'Lead Site Worker',
    present: 22,
    late: 3,
    halfDay: 2,
    overtime: 6,
    absent: 2,
    unmarked: 2,
    latePenalty: 150,
    overtimeAmount: 1200,
    dailyStatus: null,
    shift: 'Site Shift (08:30 - 17:30)',
    checkIn: '',
    checkOut: '',
    hoursWorked: '—',
    dailyOvertime: '—',
  },
];


const STORAGE_KEY = 'osm_reports_staff_data_v4';

function getStoredStaffData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse stored staff data', e);
  }
  return INITIAL_STAFF_DATA;
}


function formatDrawerSubtitleDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const day = dateObj.getDate();
      const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const year = dateObj.getFullYear();
      return `${weekday}, ${day} ${month}, ${year}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

const DAILY_STATUS_PILLS = [
  { value: 'Present', label: 'Present' },
  { value: 'Late', label: 'Late' },
  { value: 'Half day', label: 'Half day' },
  { value: 'Overtime', label: 'Overtime' },
  { value: 'Absent', label: 'Absent' },
  { value: 'On leave', label: 'On leave' },
];

export function ReportsPage() {
  const toast = useToast();

  // Active Report Selection: Default to Attendance Summary
  const [activeReportId, setActiveReportId] = useState('attendance-summary');
  const [openDropdown, setOpenDropdown] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-dropdown-container]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState('October, 2026');
  const [selectedDate, setSelectedDate] = useState('2026-10-31');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [sortAsc, setSortAsc] = useState(true);

  // Persistent Staff Attendance State
  const [staffList, setStaffList] = useState(getStoredStaffData);

  // Slide-over Drawer State for editing attendance
  const [editingDrawer, setEditingDrawer] = useState(null);
  const [drawerForm, setDrawerForm] = useState({
    dailyStatus: 'Present',
    shift: 'General (09:30 - 18:30)',
    checkIn: '09:30 AM',
    checkOut: '06:30 PM',
    hoursWorked: '9h 00m',
    dailyOvertime: '0',
    present: 0,
    late: 0,
    halfDay: 0,
    overtime: 0,
    absent: 0,
    unmarked: 0,
    latePenalty: 0,
    overtimeAmount: 0,
    activeSection: 'daily', // 'daily' | 'summary'
  });

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

  // Meta for current report
  const currentReportMeta = useMemo(() => {
    for (const cat of REPORT_CATEGORIES) {
      const it = cat.items.find((i) => i.id === activeReportId);
      if (it) return { ...it, category: cat.title };
    }
    return { id: activeReportId, label: 'Report', desc: '', category: 'General' };
  }, [activeReportId]);

  // Filtered & Sorted Data
  const displayedStaff = useMemo(() => {
    let list = staffList.filter((s) => {
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
  }, [staffList, selectedDept, sortAsc]);

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
    } else if (activeReportId === 'daily-attendance') {
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
    } else {
      headers = ['Sr No', 'Full Name', 'Department', 'Designation', 'Gross Pay', 'Net Pay', 'Leave Balance'];
      rows = displayedStaff.map((s) => [
        s.srNo,
        `"${s.name}"`,
        `"${s.department}"`,
        `"${s.designation}"`,
        s.grossSalary,
        s.netPay,
        s.leaveBalance,
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


  const handleOpenAttendanceDrawer = (staff) => {
    setEditingDrawer(staff);
    setDrawerForm({
      dailyStatus: staff.dailyStatus && staff.dailyStatus !== 'Not marked' ? staff.dailyStatus : 'Present',
      shift: staff.shift || 'General (09:30 - 18:30)',
      checkIn: staff.checkIn === '—' ? '' : (staff.checkIn || ''),
      checkOut: staff.checkOut === '—' ? '' : (staff.checkOut || ''),
      hoursWorked: staff.hoursWorked || '0h 00m',
      dailyOvertime: staff.dailyOvertime || '0',
      present: staff.present ?? 0,
      late: staff.late ?? 0,
      halfDay: staff.halfDay ?? 0,
      overtime: staff.overtime ?? 0,
      absent: staff.absent ?? 0,
      unmarked: staff.unmarked ?? 0,
      latePenalty: staff.latePenalty ?? 0,
      overtimeAmount: staff.overtimeAmount ?? 0,
    });
  };

  const handleStatusSelect = (newStatus) => {
    setDrawerForm((prev) => ({
      ...prev,
      dailyStatus: newStatus,
    }));
  };

  const handleSaveDrawer = (e) => {
    e?.preventDefault();
    if (!editingDrawer) return;

    const prevStatus = editingDrawer.dailyStatus;
    const newStatus = drawerForm.dailyStatus;

    let updatedPresent = Number(editingDrawer.present) || 0;
    let updatedLate = Number(editingDrawer.late) || 0;
    let updatedHalfDay = Number(editingDrawer.halfDay) || 0;
    let updatedOvertime = Number(editingDrawer.overtime) || 0;
    let updatedAbsent = Number(editingDrawer.absent) || 0;
    let updatedUnmarked = Number(editingDrawer.unmarked) || 0;

    if (prevStatus !== newStatus) {
      if (prevStatus === 'Present') updatedPresent = Math.max(0, updatedPresent - 1);
      else if (prevStatus === 'Late') updatedLate = Math.max(0, updatedLate - 1);
      else if (prevStatus === 'Half day' || prevStatus === 'Half Day') updatedHalfDay = Math.max(0, updatedHalfDay - 1);
      else if (prevStatus === 'Overtime') updatedOvertime = Math.max(0, updatedOvertime - 1);
      else if (prevStatus === 'Absent') updatedAbsent = Math.max(0, updatedAbsent - 1);
      else if (!prevStatus || prevStatus === 'Not marked') updatedUnmarked = Math.max(0, updatedUnmarked - 1);

      if (newStatus === 'Present') updatedPresent += 1;
      else if (newStatus === 'Late') updatedLate += 1;
      else if (newStatus === 'Half day' || newStatus === 'Half Day') updatedHalfDay += 1;
      else if (newStatus === 'Overtime') updatedOvertime += 1;
      else if (newStatus === 'Absent') updatedAbsent += 1;
      else if (newStatus === 'On leave') updatedAbsent += 1;
    }

    const updatedStaff = {
      ...editingDrawer,
      dailyStatus: newStatus,
      checkIn: drawerForm.checkIn ? drawerForm.checkIn : '—',
      checkOut: drawerForm.checkOut ? drawerForm.checkOut : '—',
      hoursWorked: (drawerForm.checkIn && drawerForm.checkOut) ? '9h 00m' : '—',
      present: updatedPresent,
      late: updatedLate,
      halfDay: updatedHalfDay,
      overtime: updatedOvertime,
      absent: updatedAbsent,
      unmarked: updatedUnmarked,
    };

    const nextList = staffList.map((s) => (s.srNo === editingDrawer.srNo ? updatedStaff : s));
    setStaffList(nextList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (err) {
      console.warn('Failed to save staff data to storage', err);
    }

    toast.success(`Attendance updated for ${editingDrawer.name} (${newStatus})`);
    setEditingDrawer(null);
  };


  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-none">
      {/* Top Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a category dropdown below to view and export operational reports.
        </p>
      </div>

      {/* Horizontal Category Dropdown Navigation Bar */}
      <div className="flex flex-wrap items-center gap-3 pt-1" data-dropdown-container>
        {REPORT_CATEGORIES.map((cat) => {
          const isCategoryActive = cat.items.some((it) => it.id === activeReportId);
          const isOpen = openDropdown === cat.key;
          const activeItem = cat.items.find((it) => it.id === activeReportId);

          return (
            <div key={cat.key} className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(isOpen ? null : cat.key)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer shadow-2xs',
                  isCategoryActive
                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm'
                    : 'bg-card text-foreground border-border hover:bg-muted/60'
                )}
                aria-expanded={isOpen}
              >
                <span>{cat.title}</span>
                {isCategoryActive && activeItem && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 font-normal">
                    {activeItem.label}
                  </span>
                )}
                <ChevronDownIcon
                  className={cn('size-3.5 transition-transform duration-150', isOpen && 'rotate-180')}
                />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {cat.title}
                  </div>
                  <div className="space-y-0.5">
                    {cat.items.map((item) => {
                      const isItemActive = activeReportId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveReportId(item.id);
                            setOpenDropdown(null);
                          }}
                          className={cn(
                            'w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer',
                            isItemActive
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-foreground hover:bg-muted'
                          )}
                        >
                          <span className="truncate">{item.label}</span>
                          {isItemActive && <CheckIcon className="size-3.5 text-primary shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full-Width Report Content Container */}
      <div className="space-y-4">
        {/* ======================================================== */}
        {/* 1. ATTENDANCE SUMMARY VIEW                               */}
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
                  data-tooltip="Refresh report"
                  aria-label="Refresh"
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
              <div className="min-w-[160px]">
                <Select
                  aria-label="Month filter"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  options={monthOptions}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="min-w-[160px]">
                <Select
                  aria-label="Department filter"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  options={departmentOptions}
                  className="h-8 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                data-tooltip="Toggle sort order"
                aria-label="Sort"
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
                      <th className="px-3 py-3 font-semibold text-center w-12">Sr No</th>
                      <th className="px-3 py-3 font-semibold">Employee Code</th>
                      <th className="px-3 py-3 font-semibold">Full Name</th>
                      <th className="px-3 py-3 font-semibold">Department</th>
                      <th className="px-3 py-3 font-semibold text-center text-emerald-600 dark:text-emerald-400">Present</th>
                      <th className="px-3 py-3 font-semibold text-center text-amber-600 dark:text-amber-400">Late</th>
                      <th className="px-3 py-3 font-semibold text-center text-blue-600 dark:text-blue-400">Half day</th>
                      <th className="px-3 py-3 font-semibold text-center text-purple-600 dark:text-purple-400">Overtime (Hours)</th>
                      <th className="px-3 py-3 font-semibold text-center text-rose-600 dark:text-rose-400">Absent</th>
                      <th className="px-3 py-3 font-semibold text-center text-slate-500">Unmarked working days</th>
                      <th className="px-3 py-3 font-semibold text-right">Late penalty (₹)</th>
                      <th className="px-3 py-3 font-semibold text-right">Overtime amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedStaff.map((staff) => (
                        <tr key={staff.srNo} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3.5 py-3 text-muted-foreground font-mono">{staff.srNo}</td>
                          <td className="px-3.5 py-3 font-mono text-muted-foreground">{staff.empCode}</td>
                          <td className="px-3.5 py-3 font-bold text-foreground capitalize">{staff.name}</td>
                          <td className="px-3.5 py-3 text-muted-foreground">{staff.department}</td>

                          {/* Clickable Numeric Breakdown Cells - Opens Mark Attendance Sidebar */}
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-bold text-emerald-600 hover:underline cursor-pointer"
                              title="Click to mark attendance"
                            >
                              {staff.present}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-bold text-amber-600 hover:underline cursor-pointer"
                              title="Click to mark attendance"
                            >
                              {staff.late}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                              title="Click to mark attendance"
                            >
                              {staff.halfDay}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                              title="Click to mark attendance"
                            >
                              {staff.overtime}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-medium text-foreground hover:underline cursor-pointer"
                              title="Click to mark attendance"
                            >
                              {staff.absent}
                            </button>
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              title="Click to mark attendance"
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

                          {/* Action Column: Add Icon Button */}
                          <td className="px-3.5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceDrawer(staff)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs hover:scale-105"
                              title="Mark attendance"
                            >
                              <PlusIcon className="size-3.5 text-primary" />
                              <span>Add</span>
                            </button>
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
        {/* 2. DAILY ATTENDANCE VIEW                                 */}
        {/* ======================================================== */}
        {activeReportId === 'daily-attendance' && (
          <div className="space-y-4">
            {/* Report Header & Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Daily attendance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Present, late, absent and not marked records for one day.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  data-tooltip="Refresh report"
                  aria-label="Refresh"
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
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground">
                <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer text-xs"
                />
              </div>

              <div className="min-w-[150px]">
                <Select
                  aria-label="Department filter"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  options={departmentOptions}
                  className="h-8 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                data-tooltip="Toggle sort order"
                aria-label="Sort"
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
                      <th className="px-3.5 py-3 font-semibold">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedStaff.map((staff) => (
                      <tr key={staff.srNo} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{staff.srNo}</td>
                        <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{staff.empCode}</td>
                        <td className="px-3.5 py-2.5 font-medium text-foreground capitalize">{staff.name}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{staff.department}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{staff.designation}</td>
                        <td className="px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAttendanceDrawer(staff)}
                            className={cn(
                              "group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 hover:shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20",
                              staff.dailyStatus === 'Present'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : staff.dailyStatus === 'Late'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                : staff.dailyStatus === 'Half day' || staff.dailyStatus === 'Half Day'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                : staff.dailyStatus === 'Overtime'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                                : staff.dailyStatus === 'Absent' || staff.dailyStatus === 'On leave'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted'
                            )}
                            title="Click to mark attendance"
                          >
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              staff.dailyStatus === 'Present'
                                ? 'bg-emerald-500'
                                : staff.dailyStatus === 'Late'
                                ? 'bg-amber-500'
                                : staff.dailyStatus === 'Half day' || staff.dailyStatus === 'Half Day'
                                ? 'bg-blue-500'
                                : staff.dailyStatus === 'Overtime'
                                ? 'bg-purple-500'
                                : staff.dailyStatus === 'Absent' || staff.dailyStatus === 'On leave'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            )} />
                            <span>{staff.dailyStatus || 'Not marked'}</span>
                            <PlusIcon className="size-3 text-muted-foreground group-hover:text-foreground shrink-0 ml-0.5" />
                          </button>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{staff.shift}</td>
                        <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{staff.checkIn}</td>
                        <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{staff.checkOut}</td>
                        <td className="px-3.5 py-2.5 font-mono text-foreground">{staff.hoursWorked}</td>
                        <td className="px-3.5 py-2.5 font-mono text-foreground">{staff.dailyOvertime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. PAYROLL & LEAVE REPORTS VIEW                          */}
        {/* ======================================================== */}
        {activeReportId !== 'attendance-summary' && activeReportId !== 'daily-attendance' && (
          <div className="space-y-4">
            {/* Report Header & Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">{currentReportMeta.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentReportMeta.desc || 'Comprehensive report export and analytics table.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  data-tooltip="Refresh report"
                  aria-label="Refresh"
                  className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <RefreshIcon className="size-3.5" />
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadExcel(currentReportMeta.label)}
                  className="flex items-center gap-1.5 text-xs h-8"
                >
                  <FileSpreadsheetIcon className="size-3.5" />
                  <span>Download Excel</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCsv(currentReportMeta.label)}
                  className="flex items-center gap-1.5 text-xs h-8"
                >
                  <DownloadIcon className="size-3.5" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[160px]">
                <Select
                  aria-label="Month filter"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  options={monthOptions}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="min-w-[160px]">
                <Select
                  aria-label="Department filter"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  options={departmentOptions}
                  className="h-8 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                data-tooltip="Toggle sort order"
                aria-label="Sort"
                className="p-2 h-8 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0"
              >
                <ArrowUpDownIcon className="size-3.5" />
              </button>
            </div>

            {/* Generic Operational Data Table */}
            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground select-none">
                      <th className="px-3.5 py-3 font-semibold">Sr No</th>
                      <th className="px-3.5 py-3 font-semibold">Employee</th>
                      <th className="px-3.5 py-3 font-semibold">Department</th>
                      <th className="px-3.5 py-3 font-semibold">Designation</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Gross Salary (₹)</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Net Payable (₹)</th>
                      <th className="px-3.5 py-3 font-semibold text-center">Leave Balance</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Advance Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedStaff.map((staff) => (
                      <tr key={staff.srNo} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{staff.srNo}</td>
                        <td className="px-3.5 py-2.5 font-medium text-foreground capitalize">{staff.name}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{staff.department}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{staff.designation}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">₹{staff.grossSalary?.toLocaleString('en-IN')}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          ₹{staff.netPay?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono">{staff.leaveBalance} Days</td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground">
                          ₹{staff.advanceBalance?.toLocaleString('en-IN') || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Right-Side Attendance Drawer for both Daily Attendance & Attendance Summary */}
      <Drawer
        isOpen={Boolean(editingDrawer)}
        onClose={() => setEditingDrawer(null)}
        title="Mark attendance"
        subtitle={`${editingDrawer?.name} · ${formatDrawerSubtitleDate(selectedDate)}`}
        placement="right"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingDrawer(null)}
              className="px-6 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDrawer}
              className="px-6 py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              Save
            </button>
          </>
        }
      >
        {editingDrawer && (
          <form onSubmit={handleSaveDrawer} className="space-y-6 py-2 text-xs">
            {/* Mark as Status Pills */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-3">
                Mark as
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {DAILY_STATUS_PILLS.map((opt) => {
                  const isSelected =
                    (drawerForm.dailyStatus || '').toLowerCase() === opt.value.toLowerCase() ||
                    (opt.value === 'Half day' && (drawerForm.dailyStatus || '').toLowerCase() === 'half day') ||
                    (opt.value === 'On leave' && (drawerForm.dailyStatus || '').toLowerCase() === 'on leave');

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusSelect(opt.value)}
                      className={cn(
                        'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none',
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                          : 'bg-card border-border text-foreground hover:bg-muted'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Check in & Check out Inputs */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">
                  Check in
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={drawerForm.checkIn === '—' ? '' : drawerForm.checkIn}
                    onChange={(e) => setDrawerForm({ ...drawerForm, checkIn: e.target.value })}
                    placeholder="--:--"
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary pr-9 font-mono"
                  />
                  <ClockIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">
                  Check out
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={drawerForm.checkOut === '—' ? '' : drawerForm.checkOut}
                    onChange={(e) => setDrawerForm({ ...drawerForm, checkOut: e.target.value })}
                    placeholder="--:--"
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary pr-9 font-mono"
                  />
                  <ClockIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Leave the times empty to mark the status only.
            </p>
          </form>
        )}
      </Drawer>
    </div>
  );
}

export default ReportsPage;
