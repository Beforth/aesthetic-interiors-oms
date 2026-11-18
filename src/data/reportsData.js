/**
 * Small, self-contained datasets for report tabs that do not have a dedicated
 * backend endpoint yet. Values mirror the payroll, leave and attendance mock
 * data used elsewhere in the app so the reports stay consistent with the rest
 * of the OMS.
 */
import { mockLeaveBalances } from './leaves';

const LEAVE_EMPLOYEES = [
  {
    name: 'Rohit Kumar',
    employeeCode: 'EMP-101',
    categories: mockLeaveBalances.categories,
  },
  {
    name: 'Neha Kulkarni',
    employeeCode: 'EMP-102',
    categories: [
      { type: 'Privileged Leave', allotted: 10, used: 2, balance: 8 },
      { type: 'Medical Leave', allotted: 12, used: 1, balance: 11 },
      { type: 'Leave Without Pay', allotted: 36, used: 0, balance: 36 },
    ],
  },
  {
    name: 'Vikram Jadhav',
    employeeCode: 'EMP-103',
    categories: [
      { type: 'Privileged Leave', allotted: 10, used: 4, balance: 6 },
      { type: 'Medical Leave', allotted: 12, used: 3, balance: 9 },
      { type: 'Leave Without Pay', allotted: 36, used: 2, balance: 34 },
    ],
  },
  {
    name: 'Suresh Gaikwad',
    employeeCode: 'EMP-104',
    categories: [
      { type: 'Privileged Leave', allotted: 10, used: 1, balance: 9 },
      { type: 'Medical Leave', allotted: 12, used: 2, balance: 10 },
      { type: 'Leave Without Pay', allotted: 36, used: 1, balance: 35 },
    ],
  },
  {
    name: 'Priya Sharma',
    employeeCode: 'EMP-105',
    categories: [
      { type: 'Privileged Leave', allotted: 10, used: 3, balance: 7 },
      { type: 'Medical Leave', allotted: 12, used: 0, balance: 12 },
      { type: 'Leave Without Pay', allotted: 36, used: 0, balance: 36 },
    ],
  },
];

export const reportLeaveBalanceRows = LEAVE_EMPLOYEES.flatMap((employee) =>
  employee.categories.map((category) => ({
    id: `${employee.employeeCode}-${category.type}`,
    name: employee.name,
    employeeCode: employee.employeeCode,
    leaveType: category.type,
    accrued: category.allotted,
    consumed: category.used,
    remaining: category.balance,
  }))
);

export const reportSalaryAdvanceRows = [
  {
    id: 'adv-101',
    name: 'Suresh Gaikwad',
    employeeCode: 'EMP-104',
    amount: 15000,
    date: '2026-10-05',
    emiMonths: 3,
    emiAmount: 5000,
    deducted: 10000,
    status: 'Active',
  },
  {
    id: 'adv-102',
    name: 'Mohan Lal',
    employeeCode: 'EMP-106',
    amount: 12000,
    date: '2026-10-12',
    emiMonths: 4,
    emiAmount: 3000,
    deducted: 3000,
    status: 'Active',
  },
  {
    id: 'adv-103',
    name: 'Vikram Jadhav',
    employeeCode: 'EMP-103',
    amount: 20000,
    date: '2026-09-18',
    emiMonths: 4,
    emiAmount: 5000,
    deducted: 20000,
    status: 'Completed',
  },
  {
    id: 'adv-104',
    name: 'Neha Kulkarni',
    employeeCode: 'EMP-102',
    amount: 25000,
    date: '2026-11-02',
    emiMonths: 5,
    emiAmount: 5000,
    deducted: 0,
    status: 'Pending',
  },
].map((row) => ({ ...row, balance: Math.max(0, row.amount - row.deducted) }));

/**
 * Salary structures mirror the PF / ESIC / LWF / PT fields from PayslipsPage.
 * Employee rows are assigned to realistic departments and designations so the
 * payment-sheet and cost reports have something useful to show.
 */
const RAW_PAYROLL_ROWS = [
  {
    id: 'pay-101',
    name: 'Rohit Kumar',
    employeeCode: 'EMP-101',
    department: 'Management',
    designation: 'Managing Director',
    gross: 165000,
    pf: 1800,
    esic: 0,
    lwf: 0,
    pt: 200,
    tds: 12000,
    employerPf: 1800,
    employerEsic: 0,
    employerLwf: 0,
  },
  {
    id: 'pay-102',
    name: 'Neha Kulkarni',
    employeeCode: 'EMP-102',
    department: 'Management',
    designation: 'Senior Operations Manager',
    gross: 97000,
    pf: 1800,
    esic: 0,
    lwf: 0,
    pt: 200,
    tds: 6000,
    employerPf: 1800,
    employerEsic: 0,
    employerLwf: 0,
  },
  {
    id: 'pay-103',
    name: 'Priya Sharma',
    employeeCode: 'EMP-105',
    department: 'Design',
    designation: 'Interior Designer',
    gross: 75000,
    pf: 1800,
    esic: 0,
    lwf: 0,
    pt: 200,
    tds: 4000,
    employerPf: 1800,
    employerEsic: 0,
    employerLwf: 0,
  },
  {
    id: 'pay-104',
    name: 'Vikram Jadhav',
    employeeCode: 'EMP-103',
    department: 'Projects',
    designation: 'Site Supervisor',
    gross: 53000,
    pf: 1800,
    esic: 0,
    lwf: 0,
    pt: 200,
    tds: 2000,
    employerPf: 1800,
    employerEsic: 0,
    employerLwf: 0,
  },
  {
    id: 'pay-105',
    name: 'Suresh Gaikwad',
    employeeCode: 'EMP-104',
    department: 'Site Execution',
    designation: 'Site Worker',
    gross: 33000,
    pf: 1800,
    esic: 158,
    lwf: 12,
    pt: 200,
    tds: 0,
    employerPf: 1950,
    employerEsic: 683,
    employerLwf: 12,
  },
  {
    id: 'pay-106',
    name: 'Mohan Lal',
    employeeCode: 'EMP-106',
    department: 'Site Execution',
    designation: 'Carpentry Lead',
    gross: 42000,
    pf: 1800,
    esic: 158,
    lwf: 12,
    pt: 200,
    tds: 0,
    employerPf: 1950,
    employerEsic: 683,
    employerLwf: 12,
  },
];

function withPayrollTotals(row) {
  const deductions = row.pf + row.esic + row.lwf + row.pt + row.tds;
  const employerShare = row.employerPf + row.employerEsic + row.employerLwf;
  return {
    ...row,
    deductions,
    net: row.gross - deductions,
    employerShare,
    totalCost: row.gross + employerShare,
  };
}

export const reportPayrollRows = RAW_PAYROLL_ROWS.map(withPayrollTotals);

export function aggregatePayrollBy(field) {
  const groups = new Map();

  reportPayrollRows.forEach((row) => {
    const key = row[field] || 'Unassigned';
    const group = groups.get(key) || {
      name: key,
      employees: 0,
      gross: 0,
      employerPf: 0,
      employerEsic: 0,
      employerLwf: 0,
      totalCost: 0,
    };
    group.employees += 1;
    group.gross += row.gross;
    group.employerPf += row.employerPf;
    group.employerEsic += row.employerEsic;
    group.employerLwf += row.employerLwf;
    group.totalCost += row.totalCost;
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export const reportDepartmentCostRows = aggregatePayrollBy('department');
export const reportDesignationCostRows = aggregatePayrollBy('designation');

export const reportContributionRows = reportPayrollRows.map((row) => ({
  id: row.id,
  name: row.name,
  employeeCode: row.employeeCode,
  pf: row.pf,
  esic: row.esic,
  lwf: row.lwf,
  pt: row.pt,
  employerShare: row.employerShare,
}));

export const reportShiftRosterRows = [
  { id: 'shift-101', name: 'Rohit Kumar', shiftName: 'General Shift', start: '10:00', end: '18:30', days: 'Mon - Sat' },
  { id: 'shift-102', name: 'Neha Kulkarni', shiftName: 'General Shift', start: '10:00', end: '18:30', days: 'Mon - Fri' },
  { id: 'shift-103', name: 'Priya Sharma', shiftName: 'General Shift', start: '10:00', end: '18:30', days: 'Mon - Fri' },
  { id: 'shift-104', name: 'Vikram Jadhav', shiftName: 'Site Shift', start: '09:00', end: '18:00', days: 'Mon - Sat' },
  { id: 'shift-105', name: 'Suresh Gaikwad', shiftName: 'Site Shift', start: '08:00', end: '17:00', days: 'Mon - Sat' },
  { id: 'shift-106', name: 'Mohan Lal', shiftName: 'Extended Site Shift', start: '08:00', end: '18:00', days: 'Mon - Sat' },
];

const SHIFT_TIMINGS = {
  'General Shift': ['10:00', '18:30'],
  'Site Shift': ['09:00', '18:00'],
  'Extended Site Shift': ['08:00', '18:00'],
};

/** Builds a roster from live daily-attendance rows; callers fall back to the sample roster. */
export function shiftRosterRowsFromDaily(rows) {
  const roster = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.name || !row?.shift || roster.has(row.name)) return;
    const [start, end] = SHIFT_TIMINGS[row.shift] || ['09:00', '18:00'];
    roster.set(row.name, {
      id: row.id || row.employeeCode || row.name,
      name: row.name,
      shiftName: row.shift,
      start,
      end,
      days: 'Mon - Sat',
    });
  });

  return Array.from(roster.values());
}

export const reportLateEarlyRows = [
  { id: 'late-101', name: 'Neha Kulkarni', lateMinutes: 45, earlyMinutes: 30, overtimeHours: 2.5 },
  { id: 'late-102', name: 'Vikram Jadhav', lateMinutes: 75, earlyMinutes: 0, overtimeHours: 4 },
  { id: 'late-103', name: 'Suresh Gaikwad', lateMinutes: 30, earlyMinutes: 45, overtimeHours: 6.5 },
  { id: 'late-104', name: 'Mohan Lal', lateMinutes: 15, earlyMinutes: 0, overtimeHours: 3 },
  { id: 'late-105', name: 'Priya Sharma', lateMinutes: 60, earlyMinutes: 15, overtimeHours: 1.5 },
];

/** Derives the same three columns from a live attendance-summary response. */
export function lateEarlyRowsFromSummary(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row) return null;
      const late = Number(row.late) || 0;
      const halfDays = Number(row.halfDay) || 0;
      const overtime = Number(row.overtime) || 0;
      if (!late && !halfDays && !overtime) return null;
      return {
        id: row.userId || row.employeeCode,
        name: row.name || row.employeeName || row.employeeCode,
        lateMinutes: Math.round(late * 15),
        earlyMinutes: Math.round(halfDays * 60),
        overtimeHours: overtime,
      };
    })
    .filter(Boolean);
}

const LOCAL_REPORT_ROWS = {
  'leave-balance': reportLeaveBalanceRows,
  'salary-advances': reportSalaryAdvanceRows,
  'payment-sheet': reportPayrollRows,
  'dept-cost': reportDepartmentCostRows,
  'desig-cost': reportDesignationCostRows,
  'pf-esic': reportContributionRows,
  'shift-roster': reportShiftRosterRows,
  'late-early-overtime': reportLateEarlyRows,
};

export function getLocalReportRows(reportId) {
  return LOCAL_REPORT_ROWS[reportId] || [];
}
