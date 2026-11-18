'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import { usePagination } from '../hooks/usePagination';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Drawer } from '../components/ui/Drawer';
import { Table } from '../components/ui/Table';
import { DataToolbar } from '../components/ui/DataToolbar';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import {
  DownloadIcon,
  RefreshIcon,
  ArrowUpDownIcon,
  FileTextIcon,
  CalendarIcon,
  UsersIcon,
  WalletIcon,
} from '../components/ui/icons';
import { apiClient } from '../services/apiClient';
import { attendanceService } from '../services/attendanceService';
import { projectService } from '../services/projectService';
import {
  getLocalReportRows,
  lateEarlyRowsFromSummary,
} from '../data/reportsData';

const REPORT_CATEGORIES = [
  {
    key: 'project',
    title: 'Project',
    icon: FileTextIcon,
    items: [
      { id: 'project-portfolio', label: 'Project portfolio', desc: 'Projects with client, status, value and overall progress.' },
      { id: 'project-collections', label: 'Budget vs collection', desc: 'Contract value, collected amount and pending balance by project.' },
    ],
  },
  {
    key: 'attendance',
    title: 'Attendance',
    icon: UsersIcon,
    items: [
      { id: 'daily-attendance', label: 'Daily Attendance', desc: 'Present, late, absent and unmarked records for one day.' },
      { id: 'attendance-summary', label: 'Attendance Summary', desc: 'Monthly present, late, half day, overtime, absent and unmarked days per employee.' },
      { id: 'late-early-overtime', label: 'Late, Early & Overtime', desc: 'Late and early minutes with overtime hours for the selected month.' },
    ],
  },
  {
    key: 'leave-advances',
    title: 'Leave & Advances',
    icon: CalendarIcon,
    items: [
      { id: 'leave-balance', label: 'Leave balance', desc: 'Accrued, consumed and remaining leave per staff member.' },
      { id: 'salary-advances', label: 'Salary advances', desc: 'Advance amount, EMI plan, deducted amount and balance per employee.' },
    ],
  },
  {
    key: 'payment-sheet',
    title: 'Payment Sheet',
    icon: FileTextIcon,
    items: [
      { id: 'payment-sheet', label: 'Payment sheet', desc: 'Gross salary, deductions and net take-home pay by employee.' },
      { id: 'dept-cost', label: 'Department-wise cost', desc: 'Workforce cost rolled up by department.' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments',
    icon: WalletIcon,
    items: [
      { id: 'client-receipts', label: 'Client receipts', desc: 'Instalments with project, client, amount, due date and unpaid balance.' },
      { id: 'labour-payouts', label: 'Labour payouts', desc: 'Worker-wise payouts with trade, project, amount and payment status.' },
    ],
  },
];

const SUMMARY_METRICS = {
  present: { label: 'Present', category: 'present' },
  late: { label: 'Late', category: 'late' },
  halfDay: { label: 'Half Day', category: 'half-day' },
  overtime: { label: 'Overtime', category: 'overtime' },
  absent: { label: 'Absent', category: 'absent' },
  unmarked: { label: 'Unmarked Working Days', category: 'unmarked' },
  latePenalty: { label: 'Late Penalty', category: 'late' },
  overtimeAmount: { label: 'Overtime Amount', category: 'overtime' },
};

const DAY_STATUS_OPTIONS = [
  { value: 'Present', label: 'Present' },
  { value: 'Late', label: 'Late' },
  { value: 'Half Day', label: 'Half day' },
  { value: 'Overtime', label: 'Overtime' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Unmarked Working Days', label: 'Not marked' },
];

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthLabel(value) {
  if (!value) return '';
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('en-US', { month: 'long' })}, ${date.getFullYear()}`;
}

function formatDateLabel(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeStatusLabel(value) {
  const map = {
    present: 'Present',
    late: 'Late',
    'half-day': 'Half Day',
    'half day': 'Half Day',
    overtime: 'Overtime',
    absent: 'Absent',
    leave: 'Absent',
    unmarked: 'Unmarked Working Days',
    'not-marked': 'Unmarked Working Days',
    'not marked': 'Unmarked Working Days',
    off: 'Unmarked Working Days',
  };
  return map[String(value || '').toLowerCase()] || 'Present';
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'present') return 'bg-success/10 text-success border-success/20';
  if (value === 'late') return 'bg-warning/10 text-warning border-warning/20';
  if (value.includes('half')) return 'bg-info/10 text-info border-info/20';
  if (value === 'overtime') return 'bg-primary/10 text-primary border-primary/20';
  if (value === 'absent' || value === 'leave') return 'bg-destructive/10 text-destructive border-destructive/20';
  return 'bg-muted text-muted-foreground border-border';
}

function formatMoney(value) {
  const number = Number(value);
  return `₹${(Number.isFinite(number) ? number : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatHours(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} h` : '—';
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isAttendanceReport(id) {
  return ['daily-attendance', 'attendance-summary', 'late-early-overtime'].includes(id);
}

function isPaymentReport(id) {
  return ['client-receipts', 'labour-payouts'].includes(id);
}

function isProjectReport(id) {
  return ['project-portfolio', 'project-collections'].includes(id);
}

const LIVE_REPORT_ENDPOINTS = {
  'leave-balance': '/reports/leave-balance/',
  'salary-advances': '/reports/salary-advances/',
  'payment-sheet': '/reports/payment-sheet/',
  'dept-cost': '/reports/department-cost/',
};

const LOCAL_REPORT_IDS = new Set([
  'leave-balance',
  'salary-advances',
  'payment-sheet',
  'dept-cost',
  'late-early-overtime',
]);

function isLocalReport(id) {
  return LOCAL_REPORT_IDS.has(id);
}

function supportsDepartmentFilter(id) {
  return isAttendanceReport(id) || ['payment-sheet', 'dept-cost'].includes(id);
}

function hasLiveData(id) {
  return isAttendanceReport(id) || isProjectReport(id) || isPaymentReport(id) || isLocalReport(id);
}

function titleCase(value) {
  return String(value || '—')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportStatusTone(value) {
  const status = String(value || '').toLowerCase().replace(/[_-]/g, ' ');
  if (status === 'done' || status === 'completed' || status === 'paid') return 'bg-success/10 text-success border-success/20';
  if (status === 'overdue') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (status === 'in progress' || status === 'blocked' || status === 'on hold' || status === 'partially paid') {
    return 'bg-warning/10 text-warning border-warning/20';
  }
  if (status === 'todo' || status === 'to do' || status === 'pending' || status === 'not started' || status === 'inactive') {
    return 'bg-muted text-muted-foreground border-border';
  }
  return 'bg-info/10 text-info border-info/20';
}

function ReportStatusPill({ value }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', reportStatusTone(value))}>
      {titleCase(value)}
    </span>
  );
}

function progressForStages(stages) {
  const list = Array.isArray(stages) ? stages : [];
  if (!list.length) return 0;
  const points = list.reduce((total, stage) => {
    const status = String(stage.status || '').toLowerCase().replace(/[_-]/g, ' ');
    if (status === 'done') return total + 100;
    if (status === 'in progress') return total + 50;
    return total;
  }, 0);
  return Math.round(points / list.length);
}

function installmentRowsFromSchedules(schedules) {
  return (Array.isArray(schedules) ? schedules : [])
    .flatMap((schedule) =>
      (Array.isArray(schedule.installments) ? schedule.installments : []).map((installment) => ({
        projectName: schedule.projectName,
        clientName: schedule.clientName,
        title: installment.title,
        amount: installment.amount,
        dueDate: installment.dueDate,
        status: installment.status,
        paidAmount: installment.paidAmount,
        paidDate: installment.paidDate,
        paymentMode: installment.paymentMode,
        receiptNumber: installment.receiptNumber,
        order: installment.order,
      }))
    )
    .sort(
      (a, b) =>
        String(a.projectName || '').localeCompare(String(b.projectName || '')) ||
        (Number(a.order) || 0) - (Number(b.order) || 0)
    );
}

function paymentCsvConfig(reportId, rows) {
  if (reportId === 'client-receipts') {
    return {
      filename: 'client-receipts.csv',
      headers: ['Project', 'Client', 'Instalment', 'Due date', 'Amount', 'Status', 'Paid', 'Paid date', 'Mode', 'Receipt'],
      rows: installmentRowsFromSchedules(rows).map((row) => [
        row.projectName,
        row.clientName,
        row.title,
        row.dueDate,
        row.amount,
        titleCase(row.status),
        row.paidAmount,
        row.paidDate,
        row.paymentMode,
        row.receiptNumber,
      ]),
    };
  }

  if (reportId === 'labour-payouts') {
    return {
      filename: 'labour-payouts.csv',
      headers: ['Worker', 'Trade', 'Project', 'Wage type', 'Rate', 'Units', 'Amount', 'Status', 'Paid date', 'Mode', 'Voucher'],
      rows: rows.map((row) => [
        row.workerName,
        row.trade,
        row.projectName,
        titleCase(row.wageType),
        row.rate,
        row.units,
        row.amount,
        titleCase(row.status),
        row.paidDate,
        row.paymentMode,
        row.voucherNumber,
      ]),
    };
  }

  return { filename: `${reportId}.csv`, headers: [], rows: [] };
}

function projectCsvConfig(reportId, rows) {
  if (reportId === 'project-portfolio') {
    return {
      filename: 'project-portfolio.csv',
      headers: ['Project', 'Client', 'Status', 'Start date', 'Target date', 'Total cost', 'Progress %', 'Stages done', 'Stages total'],
      rows: rows.map((project) => {
        const stages = Array.isArray(project.stages) ? project.stages : [];
        return [
          project.name,
          project.clientName,
          titleCase(project.status),
          project.startDate,
          project.targetDate,
          project.totalCost,
          progressForStages(stages),
          stages.filter((stage) => String(stage.status || '').toLowerCase() === 'done').length,
          stages.length,
        ];
      }),
    };
  }

  if (reportId === 'project-collections') {
    return {
      filename: 'project-budget-collection.csv',
      headers: ['Project', 'Client', 'Contract value', 'Collected', 'Pending', 'Advance paid', 'Instalments', 'Overdue'],
      rows: rows.map((row) => [
        row.projectName,
        row.clientName,
        row.totalCost,
        row.totalPaid,
        row.totalPending,
        row.advancePaid,
        Array.isArray(row.installments) ? row.installments.length : 0,
        Array.isArray(row.installments) ? row.installments.filter((item) => item.status === 'overdue').length : 0,
      ]),
    };
  }

  return { filename: `${reportId}.csv`, headers: [], rows: [] };
}

function localReportCsvConfig(reportId, rows) {
  if (reportId === 'leave-balance') {
    return {
      filename: 'leave-balance.csv',
      headers: ['Employee', 'Employee code', 'Leave type', 'Accrued', 'Consumed', 'Remaining'],
      rows: rows.map((row) => [row.name, row.employeeCode, row.leaveType, row.accrued, row.consumed, row.remaining]),
    };
  }

  if (reportId === 'salary-advances') {
    return {
      filename: 'salary-advances.csv',
      headers: ['Employee', 'Employee code', 'Amount', 'Date', 'EMI months', 'EMI amount', 'Deducted', 'Balance', 'Status'],
      rows: rows.map((row) => [
        row.name,
        row.employeeCode,
        row.amount,
        row.date,
        row.emiMonths,
        row.emiAmount,
        row.deducted,
        row.balance,
        titleCase(row.status),
      ]),
    };
  }

  if (reportId === 'payment-sheet') {
    return {
      filename: 'payment-sheet.csv',
      headers: ['Employee', 'Employee code', 'Department', 'Designation', 'Gross', 'Deductions', 'Net pay'],
      rows: rows.map((row) => [row.name, row.employeeCode, row.department, row.designation, row.gross, row.deductions, row.net]),
    };
  }

  if (reportId === 'dept-cost') {
    return {
      filename: 'department-wise-cost.csv',
      headers: ['Department', 'Employees', 'Gross', 'Total cost'],
      rows: rows.map((row) => [row.name, row.employees, row.gross, row.totalCost]),
    };
  }

  return {
    filename: 'late-early-overtime.csv',
    headers: ['Employee', 'Late minutes', 'Early minutes', 'Overtime hours'],
    rows: rows.map((row) => [row.name, row.lateMinutes, row.earlyMinutes, row.overtimeHours]),
  };
}

/** Generic report table with the standard 10 / 25 / 30 pagination. */
function ReportDataTable({ headers, rows }) {
  const tableRows = useMemo(
    () =>
      rows.map((cells, rowIndex) =>
        cells.reduce((row, cell, cellIndex) => {
          row[String(cellIndex)] = cell;
          return row;
        }, { __key: rowIndex })
      ),
    [rows]
  );
  const pager = usePagination(tableRows);

  return (
    <Table
      variant="clean"
      keyField="__key"
      columns={headers.map((header, index) => ({
        key: String(index),
        header,
        cellClassName: index === 0 ? 'font-medium text-foreground' : index === 1 ? 'text-foreground' : '',
      }))}
      data={pager.paginatedItems}
      pagination={pager.pagination}
    />
  );
}

export function ReportsPage() {
  const toast = useToast();
  const drawerSequence = useRef(0);
  const reportNavRef = useRef(null);

  // Keyboard navigation for the report sidebar (arrows / j-k), like the reference Reports screen.
  const handleReportNavKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key)) return;
    const buttons = Array.from(reportNavRef.current?.querySelectorAll('button[data-report]') ?? []);
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1;
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + step))];
    next?.focus();
    next?.click();
  };

  const [activeReportId, setActiveReportId] = useState('project-portfolio');
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateValue(new Date()));
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [sortAsc, setSortAsc] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [reportRows, setReportRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dayDrawer, setDayDrawer] = useState(null);
  const [savingDay, setSavingDay] = useState(false);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - index);
        return { value: toMonthValue(date), label: monthLabel(toMonthValue(date)) };
      }),
    []
  );

  const currentCategory = useMemo(
    () => REPORT_CATEGORIES.find((category) => category.items.some((item) => item.id === activeReportId)) || REPORT_CATEGORIES[0],
    [activeReportId]
  );

  const currentReportMeta = useMemo(
    () => currentCategory.items.find((item) => item.id === activeReportId) || currentCategory.items[0],
    [activeReportId, currentCategory]
  );

  const sortedRows = useMemo(() => {
    const rows = Array.isArray(reportRows) ? [...reportRows] : [];
    const filtered =
      selectedDept === 'ALL' ? rows : rows.filter((row) => !row.department || row.department === selectedDept);

    return filtered.sort((a, b) => {
      const label = (row) =>
        String(row.name || row.employeeName || row.employeeCode || row.projectName || row.title || row.agencyName || '');
      const left = label(a).localeCompare(label(b));
      return sortAsc ? left : -left;
    });
  }, [reportRows, selectedDept, sortAsc]);

  const reportPager = usePagination(sortedRows);

  const departmentOptions = useMemo(() => {
    const values = new Set((Array.isArray(reportRows) ? reportRows : []).map((row) => row.department).filter(Boolean));
    if (selectedDept !== 'ALL') values.add(selectedDept);
    return [
      { value: 'ALL', label: 'All departments' },
      ...Array.from(values)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((value) => ({ value, label: value })),
    ];
  }, [reportRows, selectedDept]);

  useEffect(() => {
    if (!hasLiveData(activeReportId)) {
      setReportRows([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    let request;

    if (activeReportId === 'daily-attendance') {
      request = attendanceService.getDailyAttendance({ date: selectedDate, department: selectedDept });
    } else if (activeReportId === 'attendance-summary') {
      request = attendanceService.getAttendanceSummary({ month: selectedMonth, department: selectedDept });
    } else if (activeReportId === 'late-early-overtime') {
      request = Promise.resolve(
        attendanceService.getAttendanceSummary({ month: selectedMonth, department: selectedDept })
      )
        .then((rows) => {
          const mapped = lateEarlyRowsFromSummary(rows);
          return mapped.length ? mapped : getLocalReportRows(activeReportId);
        })
        .catch(() => getLocalReportRows(activeReportId));
    } else if (LIVE_REPORT_ENDPOINTS[activeReportId]) {
      const endpoint = LIVE_REPORT_ENDPOINTS[activeReportId];
      request = apiClient
        .get(endpoint)
        .then((rows) => (Array.isArray(rows) && rows.length > 0 ? rows : getLocalReportRows(activeReportId)))
        .catch(() => getLocalReportRows(activeReportId));
    } else if (isLocalReport(activeReportId)) {
      request = Promise.resolve(getLocalReportRows(activeReportId));
    } else if (activeReportId === 'project-portfolio') {
      request = projectService.getAllProjects();
    } else if (activeReportId === 'project-collections' || activeReportId === 'client-receipts') {
      request = apiClient.getAll('/payments/schedules/');
    } else if (activeReportId === 'labour-payouts') {
      request = apiClient.getAll('/payments/labour/');
    }

    Promise.resolve(request)
      .then((rows) => {
        if (!cancelled) setReportRows(Array.isArray(rows) ? rows : []);
      })
      .catch((cause) => {
        if (!cancelled) {
          setReportRows([]);
          setError(cause?.response?.data?.detail || cause?.message || 'Unable to load this report.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeReportId, selectedMonth, selectedDate, selectedDept, refreshKey]);

  const dayDrawerToken = dayDrawer?.token;

  useEffect(() => {
    if (!dayDrawer || dayDrawer.mode !== 'days') return undefined;

    let cancelled = false;
    setDayDrawer((previous) => (previous ? { ...previous, daysLoading: true, daysError: '' } : previous));

    Promise.resolve(
      attendanceService.getSummaryDays({
        userId: dayDrawer.userId,
        month: dayDrawer.month,
        category: dayDrawer.category,
      })
    )
      .then((days) => {
        if (!cancelled) {
          setDayDrawer((previous) =>
            previous && previous.token === dayDrawerToken
              ? { ...previous, days: Array.isArray(days) ? days : [], daysLoading: false }
              : previous
          );
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setDayDrawer((previous) =>
            previous && previous.token === dayDrawerToken
              ? {
                  ...previous,
                  days: [],
                  daysLoading: false,
                  daysError: cause?.response?.data?.detail || cause?.message || 'Unable to load days.',
                }
              : previous
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dayDrawerToken]);

  const handleExportCsv = () => {
    if (!hasLiveData(activeReportId)) {
      toast.info('This report has no live data source yet.');
      return;
    }
    if (!reportRows.length) {
      toast.info('No rows to export.');
      return;
    }

    if (activeReportId === 'attendance-summary') {
      downloadCsv(
        `attendance-summary-${selectedMonth}.csv`,
        [
          'Sr No',
          'Employee Code',
          'Full Name',
          'Department',
          'Present',
          'Late',
          'Half Day',
          'Overtime Hours',
          'Absent',
          'Unmarked Working Days',
          'Late Penalty',
          'Overtime Amount',
        ],
        sortedRows.map((row, index) => [
          index + 1,
          row.employeeCode,
          row.name,
          row.department,
          row.present,
          row.late,
          row.halfDay,
          row.overtime,
          row.absent,
          row.unmarked,
          row.latePenalty,
          row.overtimeAmount,
        ])
      );
    } else if (isProjectReport(activeReportId)) {
      const config = projectCsvConfig(activeReportId, reportRows);
      downloadCsv(config.filename, config.headers, config.rows);
    } else if (isPaymentReport(activeReportId)) {
      const config = paymentCsvConfig(activeReportId, reportRows);
      downloadCsv(config.filename, config.headers, config.rows);
    } else if (isLocalReport(activeReportId)) {
      const config = localReportCsvConfig(activeReportId, sortedRows);
      downloadCsv(config.filename, config.headers, config.rows);
    } else {
      downloadCsv(
        `daily-attendance-${selectedDate}.csv`,
        [
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
          'Overtime Hours',
        ],
        sortedRows.map((row, index) => [
          index + 1,
          row.employeeCode,
          row.name,
          row.department,
          row.designation,
          row.status,
          row.shift,
          row.checkIn,
          row.checkOut,
          row.hoursWorked,
          row.overtimeHrs,
        ])
      );
    }

    toast.success(`${currentReportMeta.label} exported to CSV`);
  };

  const openSummaryCell = (row, key) => {
    const metric = SUMMARY_METRICS[key];
    if (!metric || !row.userId) return;
    setDayDrawer({
      mode: 'days',
      token: ++drawerSequence.current,
      userId: row.userId,
      name: row.name,
      label: metric.label,
      category: metric.category,
      month: selectedMonth,
      days: [],
      daysLoading: true,
      daysError: '',
    });
  };

  const openDailyStatus = (row) => {
    setDayDrawer({
      mode: 'day',
      token: ++drawerSequence.current,
      userId: row.id,
      row,
      name: row.name,
      status: normalizeStatusLabel(row.status),
    });
  };

  const changeDayStatus = (day, status) => {
    if (!dayDrawer || dayDrawer.mode !== 'days') return;
    setSavingDay(true);
    Promise.resolve(
      attendanceService.setDayStatus({
        userId: dayDrawer.userId,
        date: day.date,
        recordId: day.recordId,
        status,
      })
    )
      .then(() => {
        toast.success(`Updated ${formatDateLabel(day.date)} to ${status}`);
        setRefreshKey((value) => value + 1);
        setDayDrawer((previous) => (previous ? { ...previous, token: ++drawerSequence.current } : previous));
      })
      .catch((cause) => {
        toast.error(cause?.response?.data?.detail || cause?.message || 'Unable to update attendance.');
      })
      .finally(() => setSavingDay(false));
  };

  const saveDailyStatus = () => {
    if (!dayDrawer || dayDrawer.mode !== 'day') return;
    setSavingDay(true);
    Promise.resolve(
      attendanceService.setDayStatus({
        userId: dayDrawer.userId,
        date: selectedDate,
        recordId: dayDrawer.row.recordId,
        status: dayDrawer.status,
      })
    )
      .then(() => {
        toast.success(`Updated attendance for ${dayDrawer.name}`);
        setRefreshKey((value) => value + 1);
        setDayDrawer(null);
      })
      .catch((cause) => {
        toast.error(cause?.response?.data?.detail || cause?.message || 'Unable to update attendance.');
      })
      .finally(() => setSavingDay(false));
  };

  const renderMetricButton = (row, key, className) => (
    <button
      type="button"
      onClick={() => openSummaryCell(row, key)}
      className={cn('font-mono font-semibold hover:underline cursor-pointer', className)}
      title={`View ${SUMMARY_METRICS[key].label.toLowerCase()} days`}
    >
      {row[key] ?? 0}
    </button>
  );

  const renderLoading = () => (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
      <Spinner size="lg" />
      <span className="text-xs font-medium">Loading report…</span>
    </div>
  );

  const renderError = () => (
    <div className="p-5">
      <Alert
        type="danger"
        title="Unable to load report"
        action={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    </div>
  );

  const renderEmpty = () => (
    <div className="p-5">
      <EmptyState
        icon="folder"
        title={isAttendanceReport(activeReportId) ? 'No attendance records' : 'No report records'}
        description={
          isAttendanceReport(activeReportId)
            ? 'No rows matched the selected filters. Try another date, month or department.'
            : `No records were returned for ${currentReportMeta.label.toLowerCase()}.`
        }
      />
    </div>
  );

  const renderSummaryTable = () => (
    <Table
      variant="clean"
      keyField="userId"
      data={reportPager.paginatedItems}
      pagination={reportPager.pagination}
      columns={[
        { key: 'srNo', header: 'Sr No', align: 'center', cellClassName: 'font-mono text-muted-foreground', render: (_, __, index) => index + 1 },
        { key: 'employeeCode', header: 'Employee Code', cellClassName: 'font-mono text-muted-foreground' },
        { key: 'name', header: 'Full Name', cellClassName: 'font-semibold text-foreground' },
        { key: 'department', header: 'Department' },
        { key: 'present', header: 'Present', align: 'center', render: (row) => renderMetricButton(row, 'present', 'text-success') },
        { key: 'late', header: 'Late', align: 'center', render: (row) => renderMetricButton(row, 'late', 'text-warning') },
        { key: 'halfDay', header: 'Half Day', align: 'center', render: (row) => renderMetricButton(row, 'halfDay', 'text-info') },
        { key: 'overtime', header: 'Overtime (hrs)', align: 'center', render: (row) => renderMetricButton(row, 'overtime', 'text-primary') },
        { key: 'absent', header: 'Absent', align: 'center', render: (row) => renderMetricButton(row, 'absent', 'text-destructive') },
        { key: 'unmarked', header: 'Unmarked Working Days', align: 'center', render: (row) => renderMetricButton(row, 'unmarked', 'text-muted-foreground') },
        { key: 'latePenalty', header: 'Late Penalty (₹)', align: 'right', render: (row) => renderMetricButton(row, 'latePenalty', 'text-muted-foreground') },
        { key: 'overtimeAmount', header: 'Overtime Amount (₹)', align: 'right', render: (row) => renderMetricButton(row, 'overtimeAmount', 'text-success') },
      ]}
    />
  );

  const renderDailyTable = () => (
    <Table
      variant="clean"
      keyField="id"
      data={reportPager.paginatedItems}
      pagination={reportPager.pagination}
      columns={[
        { key: 'srNo', header: 'Sr No', cellClassName: 'font-mono text-muted-foreground', render: (_, __, index) => index + 1 },
        { key: 'employeeCode', header: 'Employee Code', cellClassName: 'font-mono text-muted-foreground' },
        { key: 'name', header: 'Full Name', cellClassName: 'font-medium text-foreground' },
        { key: 'department', header: 'Department' },
        { key: 'designation', header: 'Designation' },
        {
          key: 'status',
          header: 'Status',
          render: (row) => {
            const status = normalizeStatusLabel(row.status);
            return (
              <button
                type="button"
                onClick={() => openDailyStatus(row)}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer',
                  statusTone(status)
                )}
                title="Change status"
              >
                {status}
              </button>
            );
          },
        },
        { key: 'shift', header: 'Shift' },
        { key: 'checkIn', header: 'Check In', cellClassName: 'font-mono text-muted-foreground' },
        { key: 'checkOut', header: 'Check Out', cellClassName: 'font-mono text-muted-foreground' },
        { key: 'hoursWorked', header: 'Hours Worked', cellClassName: 'font-mono text-foreground', render: (row) => formatHours(row.hoursWorked) },
        { key: 'overtimeHrs', header: 'Overtime', cellClassName: 'font-mono text-foreground', render: (row) => formatHours(row.overtimeHrs) },
      ]}
    />
  );

  const renderProjectTable = (headers, rows) => (
    <ReportDataTable headers={headers} rows={rows} />
  );

  const renderPortfolioTable = () =>
    renderProjectTable(
      ['Project', 'Client', 'Status', 'Start date', 'Target date', 'Contract value', 'Progress', 'Stages'],
      reportRows.map((project) => {
        const stages = Array.isArray(project.stages) ? project.stages : [];
        const done = stages.filter((stage) => String(stage.status || '').toLowerCase().replace(/[_-]/g, ' ') === 'done').length;
        const progress = progressForStages(stages);
        return [
          project.name,
          project.clientName,
          <ReportStatusPill value={project.status} />,
          project.startDate,
          project.targetDate,
          formatMoney(project.totalCost),
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-mono text-foreground">{progress}%</span>
          </div>,
          `${done}/${stages.length}`,
        ];
      })
    );

  const renderCollectionTable = () =>
    renderProjectTable(
      ['Project', 'Client', 'Contract value', 'Collected', 'Pending', 'Advance paid', 'Instalments', 'Overdue'],
      reportRows.map((row) => {
        const installments = Array.isArray(row.installments) ? row.installments : [];
        const overdue = installments.filter((item) => item.status === 'overdue').length;
        return [
          row.projectName,
          row.clientName,
          formatMoney(row.totalCost),
          formatMoney(row.totalPaid),
          <span className={cn('font-mono font-semibold', Number(row.totalPending) > 0 ? 'text-warning' : 'text-success')}>
            {formatMoney(row.totalPending)}
          </span>,
          formatMoney(row.advancePaid),
          installments.length,
          overdue > 0 ? <span className="font-mono font-semibold text-destructive">{overdue}</span> : '—',
        ];
      })
    );

  const renderClientReceiptsTable = () =>
    renderProjectTable(
      ['Project', 'Client', 'Instalment', 'Due date', 'Amount', 'Status', 'Paid', 'Paid date', 'Mode', 'Receipt'],
      installmentRowsFromSchedules(reportRows).map((row) => [
        row.projectName,
        row.clientName,
        row.title,
        row.dueDate,
        <span className="font-mono">{formatMoney(row.amount)}</span>,
        <ReportStatusPill value={row.status} />,
        <span className={cn('font-mono font-semibold', Number(row.paidAmount) > 0 ? 'text-success' : 'text-muted-foreground')}>
          {formatMoney(row.paidAmount)}
        </span>,
        row.paidDate,
        row.paymentMode,
        row.receiptNumber,
      ])
    );

  const renderLabourPayoutsTable = () =>
    renderProjectTable(
      ['Worker', 'Trade', 'Project', 'Wage type', 'Rate', 'Units', 'Amount', 'Status', 'Paid date', 'Voucher'],
      reportRows.map((row) => [
        row.workerName,
        row.trade,
        row.projectName,
        titleCase(row.wageType),
        <span className="font-mono">{formatMoney(row.rate)}</span>,
        `${row.units ?? '—'}${row.unitLabel ? ` ${row.unitLabel}` : ''}`,
        <span className="font-mono font-semibold text-foreground">{formatMoney(row.amount)}</span>,
        <ReportStatusPill value={row.status} />,
        row.paidDate,
        row.voucherNumber,
      ])
    );

  const renderLeaveBalanceTable = () =>
    renderProjectTable(
      ['Employee', 'Code', 'Leave type', 'Accrued', 'Consumed', 'Remaining'],
      sortedRows.map((row) => [
        row.name,
        row.employeeCode,
        row.leaveType,
        row.accrued,
        row.consumed,
        <span
          className={cn(
            'font-mono font-semibold',
            Number(row.remaining) <= 3 ? 'text-warning' : 'text-foreground'
          )}
        >
          {row.remaining}
        </span>,
      ])
    );

  const renderSalaryAdvancesTable = () =>
    renderProjectTable(
      ['Employee', 'Code', 'Amount', 'Date', 'EMI plan', 'Deducted', 'Balance', 'Status'],
      sortedRows.map((row) => [
        row.name,
        row.employeeCode,
        <span className="font-mono">{formatMoney(row.amount)}</span>,
        row.date,
        `${row.emiMonths} × ${formatMoney(row.emiAmount)}`,
        <span className="font-mono text-foreground">{formatMoney(row.deducted)}</span>,
        <span className="font-mono text-foreground">{formatMoney(row.balance)}</span>,
        <ReportStatusPill value={row.status} />,
      ])
    );

  const renderPaymentSheetTable = () =>
    renderProjectTable(
      ['Employee', 'Department', 'Designation', 'Gross', 'Deductions', 'Net pay'],
      sortedRows.map((row) => [
        row.name,
        row.department,
        row.designation,
        <span className="font-mono">{formatMoney(row.gross)}</span>,
        <span className="font-mono text-warning">{formatMoney(row.deductions)}</span>,
        <span className="font-mono font-semibold text-foreground">{formatMoney(row.net)}</span>,
      ])
    );

  const renderCostTable = () =>
    renderProjectTable(
      ['Department', 'Employees', 'Gross', 'Total cost'],
      sortedRows.map((row) => [
        row.name,
        row.employees,
        <span className="font-mono">{formatMoney(row.gross)}</span>,
        <span className="font-mono font-semibold text-foreground">{formatMoney(row.totalCost)}</span>,
      ])
    );

  const renderLateEarlyTable = () =>
    renderProjectTable(
      ['Employee', 'Late (min)', 'Early (min)', 'Overtime (hrs)'],
      sortedRows.map((row) => [
        row.name,
        <span className={cn('font-mono', Number(row.lateMinutes) > 0 && 'text-warning')}>{row.lateMinutes}</span>,
        <span className={cn('font-mono', Number(row.earlyMinutes) > 0 && 'text-warning')}>{row.earlyMinutes}</span>,
        <span className={cn('font-mono font-semibold', Number(row.overtimeHours) > 0 && 'text-success')}>
          {row.overtimeHours}
        </span>,
      ])
    );

  const renderReportShell = (content) => (
    <div className="overflow-hidden rounded-lg border border-border bg-card">{content}</div>
  );

  const renderLiveReport = () => {
    let table;

    if (loading) return renderReportShell(renderLoading());
    if (error) return renderReportShell(renderError());
    if (!reportRows.length) return renderReportShell(renderEmpty());

    if (activeReportId === 'attendance-summary') table = renderSummaryTable();
    else if (activeReportId === 'daily-attendance') table = renderDailyTable();
    else if (activeReportId === 'project-portfolio') table = renderPortfolioTable();
    else if (activeReportId === 'project-collections') table = renderCollectionTable();
    else if (activeReportId === 'leave-balance') table = renderLeaveBalanceTable();
    else if (activeReportId === 'salary-advances') table = renderSalaryAdvancesTable();
    else if (activeReportId === 'payment-sheet') table = renderPaymentSheetTable();
    else if (activeReportId === 'dept-cost') table = renderCostTable();
    else if (activeReportId === 'late-early-overtime') table = renderLateEarlyTable();
    else if (activeReportId === 'client-receipts') table = renderClientReceiptsTable();
    else if (activeReportId === 'labour-payouts') table = renderLabourPayoutsTable();

    return renderReportShell(table);
  };

  return (
    <div className="grid gap-4 pb-12 animate-fadeIn">
      <PageHeader
        title="Reports"
        subtitle="Pick a report on the left. Every table can be exported to CSV."
        className="mb-0"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRefreshKey((value) => value + 1)}
              aria-label="Refresh report"
              title="Refresh report"
              className="h-8 w-8 justify-center p-0"
            >
              <RefreshIcon className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8">
              <DownloadIcon className="size-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Mobile report picker */}
        <div className="lg:hidden">
          <Select
            aria-label="Select report"
            value={activeReportId}
            onChange={(event) => setActiveReportId(event.target.value)}
            options={REPORT_CATEGORIES.flatMap((category) =>
              category.items.map((item) => ({
                value: item.id,
                label: `${category.title} — ${item.label}`,
              }))
            )}
          />
        </div>

        {/* Grouped report navigation */}
        <nav
          ref={reportNavRef}
          aria-label="Reports"
          onKeyDown={handleReportNavKeyDown}
          className="hidden content-start gap-5 lg:grid"
        >
          {REPORT_CATEGORIES.map((category) => (
            <div key={category.key} className="grid gap-0.5">
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {category.title}
              </p>
              {category.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-report={item.id}
                  aria-current={item.id === activeReportId ? 'page' : undefined}
                  onClick={() => setActiveReportId(item.id)}
                  className={cn(
                    'flex h-8 cursor-pointer items-center rounded-md px-2.5 text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
                    item.id === activeReportId
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{currentReportMeta.label}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{currentReportMeta.desc}</p>
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            totalCount={sortedRows.length}
            filters={
              <>
                {activeReportId === 'daily-attendance' && (
                  <Input
                    type="date"
                    aria-label="Date filter"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                )}

                {(activeReportId === 'attendance-summary' ||
                  activeReportId === 'late-early-overtime') && (
                  <div className="w-44">
                    <Select
                      aria-label="Month filter"
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      options={monthOptions}
                      className="h-9 text-xs"
                    />
                  </div>
                )}

                {supportsDepartmentFilter(activeReportId) && (
                  <div className="w-44">
                    <Select
                      aria-label="Department filter"
                      value={selectedDept}
                      onChange={(event) => setSelectedDept(event.target.value)}
                      options={departmentOptions}
                      className="h-9 text-xs"
                    />
                  </div>
                )}

                {activeReportId === 'late-early-overtime' && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{monthLabel(selectedMonth)}</span>
                )}

                <button
                  type="button"
                  onClick={() => setSortAsc((value) => !value)}
                  title="Toggle sort order"
                  aria-label="Toggle sort order"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ArrowUpDownIcon className="size-3.5" />
                </button>
              </>
            }
          />

          {renderLiveReport()}
        </div>
      </div>

      <Drawer
        isOpen={Boolean(dayDrawer)}
        onClose={() => setDayDrawer(null)}
        title={dayDrawer?.mode === 'days' ? 'Attendance days' : 'Mark attendance'}
        subtitle={
          dayDrawer?.mode === 'days'
            ? `${dayDrawer.name} · ${monthLabel(dayDrawer.month)} · ${dayDrawer.label}`
            : `${dayDrawer?.name || ''} · ${formatDateLabel(selectedDate)}`
        }
        placement="right"
        size="sm"
        footer={
          dayDrawer?.mode === 'day' ? (
            <>
              <button
                type="button"
                onClick={() => setDayDrawer(null)}
                className="px-5 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDailyStatus}
                disabled={savingDay}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {savingDay ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDayDrawer(null)}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </button>
          )
        }
      >
        {dayDrawer?.mode === 'days' && (
          <div className="space-y-3 py-1">
            {dayDrawer.daysLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Spinner size="lg" />
              </div>
            ) : dayDrawer.daysError ? (
              <Alert type="danger" title="Unable to load days">
                {dayDrawer.daysError}
              </Alert>
            ) : dayDrawer.days.length === 0 ? (
              <EmptyState icon="folder" title="No days found" description="There are no days behind this number." />
            ) : (
              dayDrawer.days.map((day) => (
                <div key={`${day.date}-${day.recordId || 'new'}`} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-foreground">{formatDateLabel(day.date)}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {day.checkIn || '—'} → {day.checkOut || '—'}
                    </span>
                  </div>
                  <Select
                    aria-label={`Status for ${formatDateLabel(day.date)}`}
                    value={normalizeStatusLabel(day.status)}
                    onChange={(event) => changeDayStatus(day, event.target.value)}
                    options={DAY_STATUS_OPTIONS}
                    disabled={savingDay}
                    className="h-8 text-xs"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {dayDrawer?.mode === 'day' && (
          <div className="space-y-2 py-1">
            <label className="text-xs font-semibold text-muted-foreground block">Status</label>
            <Select
              aria-label="Attendance status"
              value={dayDrawer.status}
              onChange={(event) => setDayDrawer((previous) => (previous ? { ...previous, status: event.target.value } : previous))}
              options={DAY_STATUS_OPTIONS}
              className="h-9 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Choose “Not marked” to remove the attendance record for this date.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default ReportsPage;
