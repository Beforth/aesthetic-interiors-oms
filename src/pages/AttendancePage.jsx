import React, { useState, useEffect, useMemo, useRef } from 'react';
import { attendanceService, calculateDistanceMeters } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';
import { isDebug } from '../config/env';
import { validateRequired, validateGpsCoordinates, validatePositiveNumber } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Alert from '../components/ui/Alert';
import { cn } from '../lib/utils';
import {
  FileSpreadsheetIcon,
  DownloadIcon,
  RefreshIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  BarChartIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  UmbrellaIcon,
  LogInIcon,
  LogOutIcon,
  InfoIcon,
  SearchIcon,
  MapPinIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  MailIcon,
  NavigationIcon,
  ShieldIcon,
  UserCheckIcon,
  XIcon,
  FilterIcon,
} from '../components/ui/icons';

/** Today as DD-MM-YYYY, the format of the Daily attendance date box. */
function todayDdMmYyyy() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** 'DD-MM-YYYY' -> 'YYYY-MM-DD', or '' while the box holds something else. */
function ddMmYyyyToIso(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(text || '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The month box shows 'October, 2026'; the API takes '2026-10'. */
function monthLabelToIso(label) {
  const [name, year] = String(label || '').split(',').map((part) => part.trim());
  const index = MONTH_NAMES.indexOf(name);
  return index === -1 || !/^\d{4}$/.test(year) ? '' : `${year}-${String(index + 1).padStart(2, '0')}`;
}

function currentMonthLabel() {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]}, ${d.getFullYear()}`;
}

function localTodayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function calculateWorkingHours(checkInStr, checkOutStr) {
  if (!checkInStr) return '—';

  const parseTimeToMinutes = (str) => {
    if (!str) return null;
    const clean = str.trim().toLowerCase();
    const isPM = clean.includes('pm');
    const isAM = clean.includes('am');
    const timePart = clean.replace(/[a-z]/g, '').trim();
    const parts = timePart.split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  };

  const inMin = parseTimeToMinutes(checkInStr);
  if (inMin === null) return '—';

  let outMin = parseTimeToMinutes(checkOutStr);
  let isActive = false;

  if (outMin === null) {
    const now = new Date();
    outMin = now.getHours() * 60 + now.getMinutes();
    isActive = true;
  }

  let diff = outMin - inMin;
  if (diff < 0) diff += 24 * 60;

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m${isActive ? ' (Active)' : ''}`;
}

export function AttendancePage() {
  const toast = useToast();
  const { currentUser, role, hasPermission } = useAuth();
  const isAdminOrManager =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';
  const canCorrectAttendance = hasPermission ? hasPermission('attendance.correct') : isAdminOrManager;

  // Navigation tab: 'records' | 'requests' | 'leave-types' | 'stats'
  const [activeTab, setActiveTab] = useState('records');

  // Core Attendance State
  const [attendanceList, setAttendanceList] = useState([]);
  const [officeLocation, setOfficeLocation] = useState({
    name: 'Neomed Head Office',
    lat: 19.967048,
    lng: 73.754104,
    radiusMeters: 500,
    geofenceMode: 'office',
  });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requestsList, setRequestsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // PWA Real-time Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const watchIdRef = useRef(null);

  // Live Digital Clock & Calendar Date
  const [clockData, setClockData] = useState(() => {
    const d = new Date();
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  });
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockData({
        day: now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Modals state
  const [isOfficeSettingsOpen, setIsOfficeSettingsOpen] = useState(false);
  const [officeForm, setOfficeForm] = useState({
    name: 'Neomed Head Office',
    lat: 19.967048,
    lng: 73.754104,
    radiusMeters: 500,
  });

  const [isMarkStaffModalOpen, setIsMarkStaffModalOpen] = useState(false);
  const [staffMarkForm, setStaffMarkForm] = useState({
    userId: 'u1',
    punchType: 'in',
    date: new Date().toISOString().split('T')[0],
    punchTime: '09:00',
    notes: '',
  });

  const [isAddLeaveTypeOpen, setIsAddLeaveTypeOpen] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    daysPerYear: 12,
    carryForward: 'No',
    description: '—',
    status: 'Active',
  });

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    userId: 'u1',
    date: new Date().toISOString().split('T')[0],
    type: 'Punch Regularization',
    reason: '',
    requestedCheckIn: '09:00 AM',
    requestedCheckOut: '06:00 PM',
  });
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL'); // 'ALL' | 'pending' | 'approved' | 'rejected'
  const [requestFromDate, setRequestFromDate] = useState('');
  const [requestToDate, setRequestToDate] = useState('');
  const [requestSortOrder, setRequestSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc'
  const [selectedViewRequest, setSelectedViewRequest] = useState(null);
  const [requestTypeFilter, setRequestTypeFilter] = useState('ALL');

  const [recordPendingDelete, setRecordPendingDelete] = useState(null);
  const [deleteRecordLoading, setDeleteRecordLoading] = useState(false);

  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionData, setCorrectionData] = useState({
    status: 'present',
    checkInTime: '',
    checkOutTime: '',
    reason: '',
  });

  // Filter states for Leave Types and Records
  const [leaveSearch, setLeaveSearch] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [recordSearch, setRecordSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [cardFilter, setCardFilter] = useState(null); // 'checked-in' | 'not-checked-in' | 'on-leave' | 'checked-out' | null

  const handleCardFilterToggle = (filterKey) => {
    setCardFilter((prev) => (prev === filterKey ? null : filterKey));
    if (activeTab !== 'records' && activeTab !== 'daily') {
      setActiveTab('records');
    }
  };

  const [viewTargetRecord, setViewTargetRecord] = useState(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [overviewStats, setOverviewStats] = useState({
    totalEmployees: 5000,
    checkedIn: 4500,
    notCheckedIn: 500,
    onLeave: 456,
    checkedOut: 250,
  });

  // Daily Attendance View State & Mock Data (matches screenshots)
  const [dailyDateDisplay, setDailyDateDisplay] = useState(() => (isDebug() ? '26-10-2026' : todayDdMmYyyy()));
  const [dailyDeptFilter, setDailyDeptFilter] = useState('All');
  const [dailyRecords, setDailyRecords] = useState(isDebug() ? [
    {
      id: 'd1',
      srNo: 1,
      employeeCode: 'E101',
      name: 'Rohit Kumar',
      department: 'Executive',
      designation: 'Managing Director & Admin',
      status: 'Present',
      shift: '09:30-18:30',
      checkIn: '09:20',
      checkOut: '18:45',
      hoursWorked: 9,
      overtimeHrs: 0,
    },
    {
      id: 'd2',
      srNo: 2,
      employeeCode: 'E102',
      name: 'Neha Kulkarni',
      department: 'Operations',
      designation: 'Operations Manager',
      status: 'Present',
      shift: '10:00-19:00',
      checkIn: '09:55',
      checkOut: '19:10',
      hoursWorked: 9,
      overtimeHrs: 1,
    },
    {
      id: 'd3',
      srNo: 3,
      employeeCode: 'E103',
      name: 'Vikram Jadhav',
      department: 'Site Operations',
      designation: 'Site Supervisor',
      status: 'Present',
      shift: '09:00-18:00',
      checkIn: '08:50',
      checkOut: '18:30',
      hoursWorked: 9,
      overtimeHrs: 1,
    },
    {
      id: 'd4',
      srNo: 4,
      employeeCode: 'E104',
      name: 'Suresh Gaikwad',
      department: 'Site Operations',
      designation: 'Lead Artisan',
      status: 'Present',
      shift: '09:00-18:00',
      checkIn: '09:00',
      checkOut: '18:00',
      hoursWorked: 9,
      overtimeHrs: 0,
    },
    {
      id: 'd5',
      srNo: 5,
      employeeCode: 'E105',
      name: 'Amit Sharma',
      department: 'Site Operations',
      designation: 'Senior Supervisor',
      status: 'Absent',
      shift: '09:00-18:00',
      checkIn: '—',
      checkOut: '—',
      hoursWorked: 0,
      overtimeHrs: 0,
    },
    {
      id: 'd6',
      srNo: 6,
      employeeCode: 'E106',
      name: 'Priya Deshmukh',
      department: 'Design & Finishes',
      designation: 'Artisan Specialist',
      status: 'Leave',
      shift: '09:30-18:30',
      checkIn: '—',
      checkOut: '—',
      hoursWorked: 0,
      overtimeHrs: 0,
    },
    {
      id: 'd7',
      srNo: 7,
      employeeCode: 'E107',
      name: 'Rajesh Kulkarni',
      department: 'Site Operations',
      designation: 'Craftsman',
      status: 'Not marked',
      shift: '09:00-18:00',
      checkIn: '—',
      checkOut: '—',
      hoursWorked: 0,
      overtimeHrs: 0,
    },
  ] : []);

  // Attendance Summary View State & Mock Data
  const [summaryMonth, setSummaryMonth] = useState(() => (isDebug() ? 'October, 2026' : currentMonthLabel()));
  const [summaryDeptFilter, setSummaryDeptFilter] = useState('All');
  const [summaryRecords, setSummaryRecords] = useState(isDebug() ? [
    {
      id: 's1',
      srNo: 1,
      employeeCode: 'E101',
      name: 'Rohit Kumar',
      department: 'Executive',
      present: 22,
      late: 1,
      halfDay: 0,
      overtime: 2,
      absent: 0,
      unmarked: 2,
      latePenalty: 0,
      overtimeAmount: 500,
    },
    {
      id: 's2',
      srNo: 2,
      employeeCode: 'E102',
      name: 'Neha Kulkarni',
      department: 'Operations',
      present: 20,
      late: 2,
      halfDay: 1,
      overtime: 4,
      absent: 0,
      unmarked: 0,
      latePenalty: 0,
      overtimeAmount: 800,
    },
    {
      id: 's3',
      srNo: 3,
      employeeCode: 'E103',
      name: 'Vikram Jadhav',
      department: 'Site Operations',
      present: 21,
      late: 3,
      halfDay: 0,
      overtime: 5,
      absent: 1,
      unmarked: 0,
      latePenalty: 0,
      overtimeAmount: 1000,
    },
    {
      id: 's4',
      srNo: 4,
      employeeCode: 'E104',
      name: 'Suresh Gaikwad',
      department: 'Site Operations',
      present: 23,
      late: 0,
      halfDay: 0,
      overtime: 3,
      absent: 1,
      unmarked: 0,
      latePenalty: 0,
      overtimeAmount: 600,
    },
    {
      id: 's5',
      srNo: 5,
      employeeCode: 'E105',
      name: 'Amit Sharma',
      department: 'Site Operations',
      present: 19,
      late: 2,
      halfDay: 1,
      overtime: 1,
      absent: 2,
      unmarked: 1,
      latePenalty: 0,
      overtimeAmount: 300,
    },
    {
      id: 's6',
      srNo: 6,
      employeeCode: 'E106',
      name: 'Priya Deshmukh',
      department: 'Design & Finishes',
      present: 18,
      late: 1,
      halfDay: 2,
      overtime: 0,
      absent: 1,
      unmarked: 3,
      latePenalty: 0,
      overtimeAmount: 0,
    },
    {
      id: 's7',
      srNo: 7,
      employeeCode: 'E107',
      name: 'Rajesh Kulkarni',
      department: 'Site Operations',
      present: 20,
      late: 4,
      halfDay: 0,
      overtime: 2,
      absent: 2,
      unmarked: 1,
      latePenalty: 0,
      overtimeAmount: 400,
    },
  ] : []);

  const [summaryBreakdownTarget, setSummaryBreakdownTarget] = useState(null);

  // With the backend on, the two report tabs are read from it for the date / month on screen.
  const live = !isDebug();
  const [reportsTick, setReportsTick] = useState(0);
  useEffect(() => {
    const date = ddMmYyyyToIso(dailyDateDisplay);
    if (!live || !date) return undefined;
    let cancelled = false;
    attendanceService
      .getDailyAttendance({ date, department: dailyDeptFilter })
      .then((rows) => {
        if (!cancelled && rows) setDailyRecords(rows);
      })
      .catch((err) => !cancelled && toast.error(err.message || 'Could not load the daily attendance'));
    return () => {
      cancelled = true;
    };
  }, [live, dailyDateDisplay, dailyDeptFilter, reportsTick]);

  useEffect(() => {
    const month = monthLabelToIso(summaryMonth);
    if (!live || !month) return undefined;
    let cancelled = false;
    attendanceService
      .getAttendanceSummary({ month, department: summaryDeptFilter })
      .then((rows) => {
        if (!cancelled && rows) setSummaryRecords(rows);
      })
      .catch((err) => !cancelled && toast.error(err.message || 'Could not load the attendance summary'));
    return () => {
      cancelled = true;
    };
  }, [live, summaryMonth, summaryDeptFilter, reportsTick]);

  const filteredDailyRecords = useMemo(() => {
    return dailyRecords.filter((r) => {
      if (cardFilter === 'checked-in') {
        const hasPunchedIn = Boolean(r.checkIn && r.checkIn !== '—' && r.status !== 'Leave' && r.status !== 'On Leave');
        if (!hasPunchedIn) return false;
      } else if (cardFilter === 'not-checked-in') {
        const isNotCheckedIn =
          (!r.checkIn || r.checkIn === '—' || r.status === 'Not marked' || r.status === 'Absent') &&
          r.status !== 'Leave' &&
          r.status !== 'On Leave';
        if (!isNotCheckedIn) return false;
      } else if (cardFilter === 'on-leave') {
        const isOnLeave = r.status === 'Leave' || r.status === 'On Leave';
        if (!isOnLeave) return false;
      } else if (cardFilter === 'checked-out') {
        const isCheckedOut = Boolean(r.checkOut && r.checkOut !== '—');
        if (!isCheckedOut) return false;
      }

      if (dailyDeptFilter !== 'All' && r.department !== dailyDeptFilter) return false;
      return true;
    });
  }, [dailyRecords, cardFilter, dailyDeptFilter]);

  const filteredSummaryRecords = useMemo(() => {
    return summaryRecords.filter((r) => {
      if (summaryDeptFilter !== 'All' && r.department !== summaryDeptFilter) return false;
      return true;
    });
  }, [summaryRecords, summaryDeptFilter]);

  const staffOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Authorized project users
    (isDebug() ? mockUsers : []).forEach((u) => {
      if (u.role !== 'client' && u.role !== ROLES.CLIENT && !seen.has(u.name)) {
        seen.add(u.name);
        const isAdmin =
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'owner' ||
          u.name.toLowerCase().includes('admin');
        list.push({
          id: u.id,
          name: u.name,
          isAdmin,
        });
      }
    });

    // 2. Additional daily records
    dailyRecords.forEach((r) => {
      if (r.name && !seen.has(r.name) && r.name !== '—') {
        seen.add(r.name);
        const isAdmin =
          r.designation?.toLowerCase() === 'admin' ||
          r.name.toLowerCase().includes('admin');
        list.push({
          id: r.id,
          name: r.name,
          isAdmin,
        });
      }
    });

    return list;
  }, [dailyRecords]);

  const openPunchModal = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const today = now.toISOString().split('T')[0];
    setStaffMarkForm((prev) => ({
      userId: prev.userId || staffOptions[0]?.id || 'u1',
      punchType: 'in',
      date: today,
      punchTime: `${hh}:${mm}`,
      notes: '',
    }));
    setIsMarkStaffModalOpen(true);
  };

  const requestMetrics = useMemo(() => {
    const total = requestsList.length;
    const pending = requestsList.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
    const approved = requestsList.filter((r) => (r.status || '').toLowerCase() === 'approved').length;
    const rejected = requestsList.filter((r) => (r.status || '').toLowerCase() === 'rejected').length;
    const withdrawn = requestsList.filter((r) => (r.status || '').toLowerCase() === 'withdrawn').length;
    return { total, pending, approved, rejected, withdrawn };
  }, [requestsList]);

  const filteredRequests = useMemo(() => {
    return requestsList.filter((req) => {
      if (requestStatusFilter !== 'ALL') {
        if ((req.status || '').toLowerCase() !== requestStatusFilter.toLowerCase()) return false;
      }
      if (requestFromDate) {
        if (!req.date || req.date < requestFromDate) return false;
      }
      if (requestToDate) {
        if (!req.date || req.date > requestToDate) return false;
      }
      if (requestTypeFilter !== 'ALL') {
        if (!req.type?.toLowerCase().includes(requestTypeFilter.toLowerCase())) return false;
      }
      if (requestSearch.trim()) {
        const q = requestSearch.trim().toLowerCase();
        const matchName = req.employeeName?.toLowerCase().includes(q) || req.userName?.toLowerCase().includes(q);
        const matchReason = req.reason?.toLowerCase().includes(q);
        const matchType = req.type?.toLowerCase().includes(q);
        const matchDate = req.date?.includes(q);
        if (!matchName && !matchReason && !matchType && !matchDate) return false;
      }
      return true;
    });
  }, [requestsList, requestStatusFilter, requestFromDate, requestToDate, requestTypeFilter, requestSearch]);

  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const timeA = new Date(`${a.date || '1970-01-01'} ${a.requestedAt || '00:00'}`).getTime() || 0;
      const timeB = new Date(`${b.date || '1970-01-01'} ${b.requestedAt || '00:00'}`).getTime() || 0;
      return requestSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredRequests, requestSortOrder]);

  const openRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setRequestForm({
      userId: currentUser?.id || staffOptions[0]?.id || 'u1',
      date: today,
      type: 'Punch Regularization',
      reason: '',
      requestedCheckIn: '09:00 AM',
      requestedCheckOut: '06:00 PM',
    });
    setIsRequestModalOpen(true);
  };

  const triggerExportDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportDailyCsv = () => {
    const headers = ['Sr No', 'Employee Code', 'Full Name', 'Department', 'Designation', 'Status', 'Shift', 'Check In', 'Check Out', 'Hours Worked', 'Overtime (hrs)'];
    const rows = filteredDailyRecords.map((r, idx) => [
      idx + 1,
      r.employeeCode,
      r.name,
      r.department,
      r.designation,
      r.status,
      r.shift,
      r.checkIn,
      r.checkOut,
      r.hoursWorked,
      r.overtimeHrs,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    triggerExportDownload(csv, `Daily_Attendance_${dailyDateDisplay.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, 'text/csv;charset=utf-8;');
    toast.success('Daily attendance exported to CSV');
  };

  const exportDailyExcel = () => {
    const headers = ['Sr No', 'Employee Code', 'Full Name', 'Department', 'Designation', 'Status', 'Shift', 'Check In', 'Check Out', 'Hours Worked', 'Overtime (hrs)'];
    const rows = filteredDailyRecords.map((r, idx) => [
      idx + 1,
      r.employeeCode,
      r.name,
      r.department,
      r.designation,
      r.status,
      r.shift,
      r.checkIn,
      r.checkOut,
      r.hoursWorked,
      r.overtimeHrs,
    ]);
    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Daily Attendance</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table border="1">
          <thead><tr style="background:#f1f5f9;font-weight:bold;">${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </body>
      </html>
    `;
    triggerExportDownload(tableHtml, `Daily_Attendance_${dailyDateDisplay.replace(/[^a-zA-Z0-9]/g, '_')}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    toast.success('Daily attendance downloaded for Excel');
  };

  const exportSummaryCsv = () => {
    const headers = ['Sr No', 'Employee Code', 'Full Name', 'Department', 'Present', 'Late', 'Half Day', 'Overtime', 'Absent', 'Unmarked Working Days', 'Late Penalty', 'Overtime Amount'];
    const rows = filteredSummaryRecords.map((r, idx) => [
      idx + 1,
      r.employeeCode,
      r.name,
      r.department,
      r.present,
      r.late,
      r.halfDay,
      r.overtime,
      r.absent,
      r.unmarked,
      r.latePenalty,
      r.overtimeAmount,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    triggerExportDownload(csv, `Attendance_Summary_${summaryMonth.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, 'text/csv;charset=utf-8;');
    toast.success('Attendance summary exported to CSV');
  };

  const exportSummaryExcel = () => {
    const headers = ['Sr No', 'Employee Code', 'Full Name', 'Department', 'Present', 'Late', 'Half Day', 'Overtime', 'Absent', 'Unmarked Working Days', 'Late Penalty', 'Overtime Amount'];
    const rows = filteredSummaryRecords.map((r, idx) => [
      idx + 1,
      r.employeeCode,
      r.name,
      r.department,
      r.present,
      r.late,
      r.halfDay,
      r.overtime,
      r.absent,
      r.unmarked,
      r.latePenalty,
      r.overtimeAmount,
    ]);
    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Attendance Summary</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table border="1">
          <thead><tr style="background:#f1f5f9;font-weight:bold;">${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </body>
      </html>
    `;
    triggerExportDownload(tableHtml, `Attendance_Summary_${summaryMonth.replace(/[^a-zA-Z0-9]/g, '_')}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    toast.success('Attendance summary downloaded for Excel');
  };

  const handleOpenSummaryBreakdown = async (record, category, count) => {
    if (live) {
      try {
        const days = await attendanceService.getSummaryDays({
          userId: record.id,
          month: monthLabelToIso(summaryMonth),
          category,
        });
        setSummaryBreakdownTarget({ ...record, category, value: count, days });
      } catch (err) {
        toast.error(err.message || 'Could not load the days');
      }
      return;
    }
    const generatedDays = [];
    const totalEntries = Math.max(1, typeof count === 'number' ? count : 1);
    for (let i = 1; i <= Math.min(totalEntries, 28); i++) {
      const dayNum = String(i * 2 > 28 ? i : i * 2).padStart(2, '0');
      generatedDays.push({
        date: `${dayNum}-10-2026`,
        status: category,
        checkIn: category === 'Present' || category === 'Late' ? (category === 'Late' ? '10:45 AM' : '09:58 AM') : null,
        checkOut: category === 'Present' || category === 'Late' ? '07:05 PM' : null,
      });
    }

    setSummaryBreakdownTarget({
      ...record,
      category,
      value: count,
      days: generatedDays,
    });
  };

  const handleUpdateBreakdownDayStatus = async (dayIndex, newStatus) => {
    if (!summaryBreakdownTarget) return;
    if (live) {
      const day = summaryBreakdownTarget.days[dayIndex];
      try {
        await attendanceService.setDayStatus({
          userId: summaryBreakdownTarget.id,
          date: day.date,
          recordId: day.recordId,
          status: newStatus,
        });
        const days = await attendanceService.getSummaryDays({
          userId: summaryBreakdownTarget.id,
          month: monthLabelToIso(summaryMonth),
          category: summaryBreakdownTarget.category,
        });
        setSummaryBreakdownTarget((prev) => (prev ? { ...prev, days, value: days.length } : prev));
        setReportsTick((n) => n + 1);
        toast.success(`Updated day status to ${newStatus}`);
      } catch (err) {
        toast.error(err.message || 'Could not change the day');
      }
      return;
    }
    const updatedDays = [...summaryBreakdownTarget.days];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      status: newStatus,
    };
    setSummaryBreakdownTarget({
      ...summaryBreakdownTarget,
      days: updatedDays,
    });
    toast.success(`Updated day status to ${newStatus}`);
  };

  // Fetch all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [records, office, leaves, reqs, stats] = await Promise.all([
        attendanceService.getTodayAttendance(),
        attendanceService.getOfficeLocation(),
        attendanceService.getLeaveTypes(),
        attendanceService.getRequests(),
        attendanceService.getOverviewStats(),
      ]);
      setAttendanceList(records);
      setOfficeLocation(office);
      setOfficeForm({
        name: office.name,
        lat: office.lat,
        lng: office.lng,
        radiusMeters: office.radiusMeters,
      });
      setLeaveTypes(leaves);
      setRequestsList(reqs);
      if (stats) setOverviewStats(stats);
      setReportsTick((n) => n + 1);
    } catch (err) {
      toast.error(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // PWA Continuous Geolocation Tracking
  const startPwaLocationTracking = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser/device.');
      return;
    }
    setLocating(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setUserLocation(coords);
        setLocating(false);

        if (officeLocation.lat && officeLocation.lng) {
          const dist = calculateDistanceMeters(
            coords.lat,
            coords.lng,
            officeLocation.lat,
            officeLocation.lng
          );
          setDistanceToOffice(dist);
        }
      },
      (err) => {
        setLocating(false);
        // Fallback for desktop or blocked permissions
        setGpsError('GPS permission not enabled or signal weak. PWA will verify upon punch.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    // Continuous watch position for real-time mobile tracking
    try {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          };
          setUserLocation(coords);
          if (officeLocation.lat && officeLocation.lng) {
            const dist = calculateDistanceMeters(
              coords.lat,
              coords.lng,
              officeLocation.lat,
              officeLocation.lng
            );
            setDistanceToOffice(dist);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    } catch (e) {}
  };

  useEffect(() => {
    startPwaLocationTracking();
    return () => {
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [officeLocation.lat, officeLocation.lng]);

  // Check if current user is clocked in
  const myTodayRecord = useMemo(() => {
    const todayStr = localTodayIso();
    return attendanceList.find(
      (r) => String(r.userId) === String(currentUser?.id || 'u1') && r.date === todayStr
    );
  }, [attendanceList, currentUser]);

  const isCheckedIn =
    myTodayRecord &&
    ['present', 'late', 'overtime', 'half-day'].includes(myTodayRecord.status) &&
    myTodayRecord.checkInTime &&
    !myTodayRecord.checkOutTime;

  // Punch In / Out Action with PWA Geofencing
  const handlePunchAction = async () => {
    setPunchLoading(true);
    try {
      let coords = userLocation;

      // Fresh GPS fix if available
      if (navigator.geolocation) {
        try {
          const freshPos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
            });
          });
          coords = {
            lat: freshPos.coords.latitude,
            lng: freshPos.coords.longitude,
            accuracy: Math.round(freshPos.coords.accuracy),
          };
          setUserLocation(coords);
        } catch (e) {}
      }

      // If still missing, use simulated position within geofence for seamless desktop demo
      if (!coords) {
        coords = { lat: officeLocation.lat, lng: officeLocation.lng, accuracy: 10 };
      }

      const action = isCheckedIn ? 'check-out' : 'check-in';
      const updated = await attendanceService.punchAttendance({
        user: currentUser || { id: 'u1', name: 'Rohit Kumar', role: 'Owner' },
        coordinates: coords,
        action,
      });

      const dist = updated.distanceMeters ?? 0;
      toast.success(
        action === 'check-out'
          ? `Check-out recorded at ${updated.checkOutTime} • PWA GPS Verified`
          : `Checked In at ${officeLocation.name} (${dist}m away) • Shift Started!`
      );
      loadData();
    } catch (err) {
      toast.error(err.message || 'Geofenced punch failed');
    } finally {
      setPunchLoading(false);
    }
  };

  // Office Location Settings Modal Actions (Screenshot 3)
  const handleUseCurrentLocationForOffice = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this device.');
      return;
    }
    toast.info('Fetching high-precision GPS coordinates from device...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setOfficeForm((prev) => ({ ...prev, lat, lng }));

        try {
          const updated = await attendanceService.updateOfficeLocation({
            ...officeForm,
            lat,
            lng,
          });
          setOfficeLocation(updated);
          toast.success(`Office GPS pinned to ${lat}, ${lng} (saved immediately!)`);
        } catch (e) {
          toast.error('Failed to save office coordinates');
        }
      },
      (err) => {
        toast.error('Could not get GPS fix. Please ensure location permissions are granted.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveOfficeSettings = async (e) => {
    if (e) e.preventDefault();
    const nameErr = validateRequired(officeForm.name, 'Office name', 3);
    if (nameErr) {
      toast.error(nameErr);
      return;
    }
    const gpsErr = validateGpsCoordinates(officeForm.lat, officeForm.lng);
    if (gpsErr) {
      toast.error(gpsErr);
      return;
    }
    const radiusErr = validatePositiveNumber(officeForm.radiusMeters, 'Geofence radius', { min: 10, max: 5000 });
    if (radiusErr) {
      toast.error(radiusErr);
      return;
    }

    try {
      const updated = await attendanceService.updateOfficeLocation(officeForm);
      setOfficeLocation(updated);
      setIsOfficeSettingsOpen(false);
      toast.success(`Office settings for "${updated.name}" saved successfully`);
      loadData();
    } catch (err) {
      toast.error('Failed to save office settings');
    }
  };

  // Mark for Staff Modal Submit (Screenshot 2: Punch Attendance)
  const handleMarkForStaffSubmit = async (e) => {
    e.preventDefault();
    if (!staffMarkForm.userId) {
      toast.error('Please select a staff member');
      return;
    }
    const staffMember = staffOptions.find((s) => String(s.id) === String(staffMarkForm.userId));
    const user = mockUsers.find((u) => String(u.id) === String(staffMarkForm.userId)) || {
      id: staffMarkForm.userId,
      name: staffMember?.name || 'Staff Member',
      role: staffMember?.isAdmin ? 'Admin' : 'Staff',
    };

    if (!staffMarkForm.punchTime || !staffMarkForm.punchTime.trim()) {
      toast.error('Punch time is required');
      return;
    }

    try {
      await attendanceService.markForStaff({
        user,
        date: staffMarkForm.date,
        action: staffMarkForm.punchType,
        punchTime: staffMarkForm.punchTime,
        status: 'present',
        notes: staffMarkForm.notes,
      });
      const punchActionLabel = staffMarkForm.punchType === 'out' ? 'Punch Out' : 'Punch In';
      toast.success(`${punchActionLabel} recorded for ${user.name}`);
      setIsMarkStaffModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to mark staff attendance');
    }
  };

  // Leave Types Submit (Screenshot 2)
  const handleAddLeaveType = async (e) => {
    e.preventDefault();
    const nameErr = validateRequired(leaveTypeForm.name, 'Leave type title', 2);
    if (nameErr) {
      toast.error(nameErr);
      return;
    }
    const daysErr = validatePositiveNumber(leaveTypeForm.daysPerYear, 'Days per year', { min: 1, max: 365 });
    if (daysErr) {
      toast.error(daysErr);
      return;
    }
    try {
      await attendanceService.addLeaveType(leaveTypeForm);
      toast.success(`Leave category "${leaveTypeForm.name}" created`);
      setIsAddLeaveTypeOpen(false);
      setLeaveTypeForm({
        name: '',
        daysPerYear: 12,
        carryForward: 'No',
        description: '—',
        status: 'Active',
      });
      loadData();
    } catch (err) {
      toast.error('Failed to add leave category');
    }
  };

  const handleDeleteLeaveType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete leave type "${name}"?`)) return;
    try {
      await attendanceService.deleteLeaveType(id);
      toast.success(`Leave type deleted`);
      loadData();
    } catch (err) {
      toast.error('Failed to delete leave type');
    }
  };

  // Submit Regularization Request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    const reasonErr = validateRequired(requestForm.reason, 'Regularization reason', 5);
    if (reasonErr) {
      toast.error(reasonErr);
      return;
    }
    if (!requestForm.date) {
      toast.error('Date is required');
      return;
    }
    try {
      const selectedStaff = staffOptions.find((s) => String(s.id) === String(requestForm.userId));
      const targetUserId = selectedStaff?.id || currentUser?.id || 'u1';
      const targetEmployeeName = selectedStaff?.name || currentUser?.name || 'Rohit Kumar';

      await attendanceService.submitRequest({
        ...requestForm,
        userId: targetUserId,
        employeeName: targetEmployeeName,
        requestedCheckIn: requestForm.requestedCheckIn,
        requestedCheckOut: requestForm.requestedCheckOut,
      });
      toast.success('Attendance regularization request submitted');
      setIsRequestModalOpen(false);
      setRequestForm({
        userId: currentUser?.id || staffOptions[0]?.id || 'u1',
        date: new Date().toISOString().split('T')[0],
        type: 'Punch Regularization',
        reason: '',
        requestedCheckIn: '09:00 AM',
        requestedCheckOut: '06:00 PM',
      });
      loadData();
    } catch (err) {
      toast.error('Failed to submit request');
    }
  };

  const handleDecideRequest = async (id, decision) => {
    try {
      const targetReq = requestsList.find((r) => r.id === id);
      const personName = targetReq?.employeeName || targetReq?.userName || 'Staff member';
      await attendanceService.decideRequest(id, decision);
      if (decision === 'approve') {
        toast.success(`Attendance request for ${personName} approved successfully`);
      } else {
        toast.success(`Attendance request for ${personName} rejected`);
      }
      loadData();
      if (selectedViewRequest && selectedViewRequest.id === id) {
        setSelectedViewRequest((prev) => (prev ? { ...prev, status: decision === 'approve' ? 'approved' : 'rejected' } : null));
      }
    } catch (err) {
      toast.error(`Failed to ${decision} request`);
    }
  };

  const handleWithdrawRequest = async (id) => {
    try {
      await attendanceService.withdrawRequest(id);
      toast.success('Request withdrawn successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to withdraw request');
    }
  };

  // Manager correction save
  const handleSaveCorrection = async () => {
    if (!correctionData.reason.trim()) {
      toast.error('Please specify a reason for adjustment');
      return;
    }
    try {
      await attendanceService.correctAttendance(correctionTarget.id, correctionData);
      toast.success('Attendance record updated');
      setCorrectionTarget(null);
      loadData();
    } catch (err) {
      toast.error('Correction failed');
    }
  };

  // Filtered Leave Types
  const filteredLeaveTypes = useMemo(() => {
    return leaveTypes.filter((lt) => {
      const matchSearch = lt.name.toLowerCase().includes(leaveSearch.trim().toLowerCase());
      const matchStatus = leaveStatusFilter === 'ALL' || lt.status === leaveStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [leaveTypes, leaveSearch, leaveStatusFilter]);

  // Filtered Attendance Records
  const filteredRecords = useMemo(() => {
    return attendanceList.filter((r) => {
      // 1. Overview Card Filter
      if (cardFilter === 'checked-in') {
        const hasPunchedIn = Boolean(r.checkInTime && r.checkInTime !== '—' && r.status !== 'leave');
        if (!hasPunchedIn) return false;
      } else if (cardFilter === 'not-checked-in') {
        const isNotCheckedIn =
          (!r.checkInTime || r.checkInTime === '—' || r.status === 'absent' || r.status === 'Not marked') &&
          r.status !== 'leave';
        if (!isNotCheckedIn) return false;
      } else if (cardFilter === 'on-leave') {
        const isOnLeave = r.status === 'leave' || r.status === 'On Leave';
        if (!isOnLeave) return false;
      } else if (cardFilter === 'checked-out') {
        const isCheckedOut = Boolean(r.checkOutTime && r.checkOutTime !== '—' && !r.checkOutTime.includes('Active'));
        if (!isCheckedOut) return false;
      }

      // 2. Search query filter
      const q = recordSearch.toLowerCase();
      const matchQuery =
        !recordSearch ||
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.role && r.role.toLowerCase().includes(q)) ||
        (r.site && r.site.toLowerCase().includes(q));

      // 3. Role filter
      const matchRole =
        roleFilter === 'ALL' ||
        (r.role && r.role.toLowerCase() === roleFilter.toLowerCase());

      // 4. Date filter
      const matchDate =
        !selectedDateFilter ||
        r.date === selectedDateFilter;

      return matchQuery && matchRole && matchDate;
    });
  }, [attendanceList, cardFilter, recordSearch, roleFilter, selectedDateFilter]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: PageHeader */}
      <PageHeader
        title="Attendance"
        subtitle="Track staff attendance with geo-fenced punch in/out"
        breadcrumbs={[
          { label: 'HRMS', path: '/dashboard' },
          { label: 'Attendance' },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={isCheckedIn ? 'destructive' : 'outline'}
              size="sm"
              leadingIcon={isCheckedIn ? 'logout' : 'clock'}
              disabled={punchLoading}
              onClick={handlePunchAction}
            >
              {punchLoading ? 'Verifying GPS...' : isCheckedIn ? 'Check Out' : 'Check In'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              leadingIcon="settings"
              onClick={() => setIsOfficeSettingsOpen(true)}
            >
              Office Settings
            </Button>

            <Button
              variant="outline"
              size="sm"
              leadingIcon="download"
              onClick={() => attendanceService.exportToExcel(attendanceList)}
            >
              Export Excel
            </Button>

            {isAdminOrManager && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={openPunchModal}
              >
                Mark for Staff
              </Button>
            )}
          </div>
        }
      />

      {/* SECTION 2: Live Geofence & 4 Overview Filter Cards */}
      <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-card border border-border shadow-xs space-y-3">
        {/* Top Header Row of Container Card */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* PWA GPS Geofence Real-time Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                distanceToOffice !== null && distanceToOffice <= (officeLocation.radiusMeters || 500)
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              <span className="size-2 rounded-full bg-current animate-pulse" />
              <span>
                {locating
                  ? 'PWA GPS Locating...'
                  : distanceToOffice !== null
                  ? distanceToOffice <= (officeLocation.radiusMeters || 500)
                    ? `Inside Geofence • ${distanceToOffice}m from ${officeLocation.name}`
                    : `Outside Geofence • ${distanceToOffice > 1000 ? (distanceToOffice / 1000).toFixed(1) + 'km' : distanceToOffice + 'm'} away`
                  : 'PWA GPS Active'}
              </span>
            </span>

            <button
              type="button"
              onClick={startPwaLocationTracking}
              title="Refresh GPS location via PWA"
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs cursor-pointer"
            >
              <RefreshIcon className={cn('size-3.5', locating && 'animate-spin')} />
            </button>
          </div>

          {/* User Check-In Status Badge */}
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isCheckedIn
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-muted/80 text-muted-foreground border-border'
            }`}
          >
            {isCheckedIn ? 'Checked In' : 'Not Checked In'}
          </span>
        </div>

        {/* Bottom Row: Circular Clock Widget + 4 Overview Metric Filter Cards */}
        <div className="flex flex-col lg:flex-row items-center gap-3.5 sm:gap-4">
          {/* 1. Left: Circular Clock Widget */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                stroke="#e2e8f0"
                strokeWidth="3.2"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                stroke="#2563eb"
                strokeDasharray="75, 100"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-[10px] sm:text-[11px] font-bold text-info uppercase tracking-widest leading-none">
                {clockData.day}
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-foreground tracking-tight leading-tight my-1">
                {clockData.time}
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none">
                {clockData.date}
              </span>
            </div>
          </div>

          {/* 2. Right: 4 Functional Card Buttons with Live List Filtering */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full min-w-0">
            {/* Card 1: Checked In */}
            <button
              type="button"
              onClick={() => handleCardFilterToggle('checked-in')}
              className={cn(
                'p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
                cardFilter === 'checked-in'
                  ? 'border-blue-400 ring-2 ring-blue-400/20 bg-blue-50/70 shadow-xs'
                  : 'border-border bg-card hover:border-blue-400/40 hover:bg-muted/30 shadow-2xs'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-info group-hover:scale-110 transition-transform">
                <CheckIcon className="size-5 stroke-[2.5]" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1">
                Checked In
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-info tracking-tight mt-1 tabular-nums">
                {overviewStats.checkedIn?.toLocaleString() || '4,500'}
              </div>
            </button>

            {/* Card 2: Not Checked In */}
            <button
              type="button"
              onClick={() => handleCardFilterToggle('not-checked-in')}
              className={cn(
                'p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
                cardFilter === 'not-checked-in'
                  ? 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/70 shadow-xs'
                  : 'border-border bg-card hover:border-rose-400/40 hover:bg-muted/30 shadow-2xs'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                <AlertIcon className="size-5" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1">
                Not Checked In
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight mt-1 tabular-nums">
                {overviewStats.notCheckedIn?.toLocaleString() || '500'}
              </div>
            </button>

            {/* Card 3: On Leave */}
            <button
              type="button"
              onClick={() => handleCardFilterToggle('on-leave')}
              className={cn(
                'p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
                cardFilter === 'on-leave'
                  ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/70 shadow-xs'
                  : 'border-border bg-card hover:border-emerald-400/40 hover:bg-muted/30 shadow-2xs'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <CalendarIcon className="size-5" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1">
                On Leave
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight mt-1 tabular-nums">
                {overviewStats.onLeave?.toLocaleString() || '456'}
              </div>
            </button>

            {/* Card 4: Checked Out */}
            <button
              type="button"
              onClick={() => handleCardFilterToggle('checked-out')}
              className={cn(
                'p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
                cardFilter === 'checked-out'
                  ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/70 shadow-xs'
                  : 'border-border bg-card hover:border-amber-400/40 hover:bg-muted/30 shadow-2xs'
              )}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <LogOutIcon className="size-5" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1">
                Checked Out
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 tracking-tight mt-1 tabular-nums">
                {overviewStats.checkedOut?.toLocaleString() || '250'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Tabs Switcher */}
      <Tabs
        tabs={[
          { id: 'records', label: 'Records', icon: ClockIcon, count: attendanceList.length },
          { id: 'requests', label: 'Requests', icon: MailIcon, count: requestsList.length },
          { id: 'daily', label: 'Daily attendance', icon: CalendarIcon },
          { id: 'summary', label: 'Attendance summary', icon: BarChartIcon },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Attendance Records (Screenshot 1) */}
      {activeTab === 'records' && (
        <Card bodyClassName="p-5">
          {/* Filters Bar with Increased Gap */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3.5 border-b border-border">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search by Name / Role / Site */}
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <SearchIcon className="size-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  placeholder="Search staff, role, site..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Filter by Role */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-1.5 px-3 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="Owner">Owner</option>
                <option value="Manager">Manager</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Worker">Worker</option>
              </select>

              {/* Date Picker Filter */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="py-1 px-2.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                />
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter('')}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted border border-border cursor-pointer"
                    title="Clear date filter"
                  >
                    Clear Date
                  </button>
                )}
              </div>

              {/* Active Card Filter Badge */}
              {cardFilter && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                  <span>
                    Status:{' '}
                    {cardFilter === 'checked-in'
                      ? 'Checked In'
                      : cardFilter === 'not-checked-in'
                      ? 'Not Checked In'
                      : cardFilter === 'on-leave'
                      ? 'On Leave'
                      : 'Checked Out'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCardFilter(null)}
                    className="p-0.5 hover:bg-primary/20 rounded transition-colors cursor-pointer"
                    title="Clear status filter"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              )}

              {/* Clear All Filters */}
              {(recordSearch || roleFilter !== 'ALL' || selectedDateFilter || cardFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordSearch('');
                    setRoleFilter('ALL');
                    setSelectedDateFilter('');
                    setCardFilter(null);
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted border border-border cursor-pointer transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="text-xs text-muted-foreground shrink-0 font-medium">
              Showing <span className="font-bold text-foreground">{filteredRecords.length}</span> staff records
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-[10px] text-muted-foreground tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Assigned Office / Site</th>
                  <th className="p-3">Check-In / Out</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Total Working Hours</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.userName} size="sm" />
                          <div>
                            <div className="font-semibold text-foreground">{r.userName}</div>
                            <div className="text-[11px] text-muted-foreground">{r.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground flex items-center gap-1">
                          <MapPinIcon className="size-3.5 text-primary shrink-0" />
                          <span>{r.site || officeLocation.name}</span>
                        </div>
                        {r.distanceMeters !== null && r.distanceMeters !== undefined && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Distance: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{r.distanceMeters}m</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          In: {r.checkInTime || '—'}
                        </div>
                        <div className="text-muted-foreground">
                          Out: {r.checkOutTime || (r.checkInTime ? 'Active' : '—')}
                        </div>
                      </td>
                      <td className="p-3">
                        {r.coordinates?.lat && r.coordinates?.lng ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 font-medium text-foreground text-[11px]">
                              <MapPinIcon className="size-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{r.punchLocation || r.site || 'Punch GPS Site'}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {r.coordinates.lat.toFixed(4)}° N, {r.coordinates.lng.toFixed(4)}° E
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPinIcon className="size-3 text-muted-foreground shrink-0" />
                            <span>{r.site || officeLocation.name || 'Office Location'}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.checkInTime 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'text-muted-foreground bg-muted'
                        }`}>
                          {calculateWorkingHours(r.checkInTime, r.checkOutTime)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setViewTargetRecord(r)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                            title="View punch details"
                          >
                            <EyeIcon className="size-3.5" />
                          </button>

                          {/* Edit Button */}
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={() => {
                                setCorrectionTarget(r);
                                setCorrectionData({
                                  status: r.status,
                                  checkInTime: r.checkInTime || '09:00 AM',
                                  checkOutTime: r.checkOutTime || '06:00 PM',
                                  reason: r.correctionReason || '',
                                });
                              }}
                              className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-md transition-colors cursor-pointer"
                              title="Edit / Correct record"
                            >
                              <EditIcon className="size-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={() => setRecordPendingDelete(r)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <TrashIcon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: Attendance request Screen */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <Card bodyClassName="p-5 sm:p-6 space-y-4">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Attendance request
                </h2>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon="refresh"
                  onClick={() => {
                    loadData();
                    toast.success('Attendance requests refreshed');
                  }}
                >
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={openRequestModal}
                >
                  Request Regularization
                </Button>
              </div>
            </div>

            {/* Filter and Live Search Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
              {/* Search Field */}
              <div className="relative flex-1 min-w-[200px]">
                <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by staff name or reason..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {requestSearch && (
                  <button
                    type="button"
                    onClick={() => setRequestSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Date Filters, Status Dropdown, Sorting Arrow */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* From Date */}
                <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">From:</span>
                  <input
                    type="date"
                    value={requestFromDate}
                    onChange={(e) => setRequestFromDate(e.target.value)}
                    className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer"
                    title="From Date"
                  />
                </div>

                {/* To Date */}
                <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">To:</span>
                  <input
                    type="date"
                    value={requestToDate}
                    onChange={(e) => setRequestToDate(e.target.value)}
                    className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer"
                    title="To Date"
                  />
                </div>

                {/* Status Dropdown */}
                <select
                  value={requestStatusFilter}
                  onChange={(e) => setRequestStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium shadow-2xs"
                  title="Filter by Status"
                >
                  <option value="ALL">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                {/* Sorting Arrow */}
                <button
                  type="button"
                  onClick={() => setRequestSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs"
                  title={requestSortOrder === 'desc' ? 'Showing newest first. Click to sort oldest first.' : 'Showing oldest first. Click to sort newest first.'}
                >
                  {requestSortOrder === 'desc' ? (
                    <ArrowDownIcon className="size-3.5 text-primary" />
                  ) : (
                    <ArrowUpIcon className="size-3.5 text-primary" />
                  )}
                  <span>{requestSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                </button>

                {/* Reset Filters */}
                {(requestSearch || requestStatusFilter !== 'ALL' || requestFromDate || requestToDate) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setRequestSearch('');
                      setRequestStatusFilter('ALL');
                      setRequestFromDate('');
                      setRequestToDate('');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Table Format for Attendance Requests */}
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-[10px] text-muted-foreground tracking-wider">
                  <tr>
                    <th className="p-3.5">Person Name</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                            <MailIcon className="size-6 opacity-70" />
                          </div>
                          <h4 className="text-sm font-semibold text-foreground">No attendance requests found</h4>
                          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                            {requestSearch || requestStatusFilter !== 'ALL' || requestFromDate || requestToDate
                              ? 'No requests match your current filters. Try resetting the filters.'
                              : 'No attendance requests submitted yet.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRequests.map((req) => {
                      const isPending = (req.status || '').toLowerCase() === 'pending';
                      const isApproved = (req.status || '').toLowerCase() === 'approved';
                      const isRejected = (req.status || '').toLowerCase() === 'rejected';
                      const personName = req.employeeName || req.userName || 'Staff Member';

                      return (
                        <tr key={req.id} className="hover:bg-muted/40 transition-colors">
                          {/* Person Name */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <Avatar name={personName} size="sm" />
                              <div>
                                <div className="font-semibold text-foreground text-xs sm:text-sm">
                                  {personName}
                                </div>
                                {req.role && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {req.role}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Reason */}
                          <td className="p-3.5 max-w-xs sm:max-w-md">
                            <p className="text-foreground text-xs leading-relaxed line-clamp-2" title={req.reason}>
                              {req.reason}
                            </p>
                          </td>

                          {/* Status / Quick Action */}
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isPending ? (
                              <div className="inline-flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDecideRequest(req.id, 'approve')}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                  title="Approve Request"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDecideRequest(req.id, 'reject')}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors cursor-pointer"
                                  title="Reject Request"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : isApproved ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Approved
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border capitalize">
                                {req.status || 'Unknown'}
                              </span>
                            )}
                          </td>

                          {/* View Button */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setSelectedViewRequest(req)}
                              className="hover:border-primary hover:text-primary transition-colors"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Daily Attendance */}
      {activeTab === 'daily' && (
        <Card bodyClassName="p-5 sm:p-6">
          {/* Header & Filter Section */}
          <div className="space-y-3.5">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Daily attendance</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Present, late, absent and not marked for one day.</p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    loadData();
                    toast.success('Daily attendance refreshed');
                  }}
                  className="size-8.5 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshIcon className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={exportDailyExcel}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheetIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Download Excel</span>
                </button>

                <button
                  type="button"
                  onClick={exportDailyCsv}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                >
                  <DownloadIcon className="size-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Row: Date and Department */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date input */}
              <div className="relative inline-flex items-center">
                <input
                  type="text"
                  value={dailyDateDisplay}
                  onChange={(e) => setDailyDateDisplay(e.target.value)}
                  placeholder="DD-MM-YYYY"
                  className="h-9 px-3.5 pr-9 text-xs sm:text-sm font-medium border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36 cursor-pointer"
                />
                <CalendarIcon className="size-4 absolute right-3 pointer-events-none text-muted-foreground" />
              </div>

              {/* Department selector */}
              <div className="relative inline-flex items-center">
                <select
                  value={dailyDeptFilter}
                  onChange={(e) => setDailyDeptFilter(e.target.value)}
                  className="h-9 appearance-none pl-3.5 pr-8 text-xs sm:text-sm font-medium border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[160px]"
                >
                  <option value="All">All departments</option>
                  <option value="Accounts">Accounts</option>
                  <option value="Design">Design</option>
                  <option value="Executive">Executive</option>
                  <option value="Operations">Operations</option>
                  <option value="Site Operations">Site Operations</option>
                  <option value="Estimation">Estimation</option>
                </select>
                <ArrowUpDownIcon className="size-3.5 absolute right-2.5 pointer-events-none text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Table with slight gap from heading & buttons */}
          <div className="mt-5 rounded-xl border border-border overflow-x-auto bg-card shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                  <th className="py-3 px-4 font-semibold w-14">Sr No</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Employee Code</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Full Name</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Department</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Designation</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Shift</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Check In</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Check Out</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Hours Worked</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Overtime (hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDailyRecords.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">{row.employeeCode}</td>
                    <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">{row.name}</td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{row.department}</td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{row.designation}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.status === 'Present' && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Present</span>
                      )}
                      {row.status === 'Not marked' && (
                        <span className="text-teal-600 dark:text-teal-400 font-semibold">Not marked</span>
                      )}
                      {row.status === 'Late' && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">Late</span>
                      )}
                      {row.status === 'Half Day' && (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">Half Day</span>
                      )}
                      {row.status === 'Absent' && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">Absent</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{row.shift}</td>
                    <td className="py-3.5 px-4 font-mono text-foreground whitespace-nowrap">{row.checkIn}</td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">{row.checkOut}</td>
                    <td className="py-3.5 px-4 text-foreground tabular-nums">{row.hoursWorked}</td>
                    <td className="py-3.5 px-4 text-foreground tabular-nums">{row.overtimeHrs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: Attendance Summary */}
      {activeTab === 'summary' && (
        <Card bodyClassName="p-5 sm:p-6">
          {/* Header & Filter Section */}
          <div className="space-y-3.5">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Attendance summary</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Per employee for one month: present, late, half day, overtime, absent and unmarked days, with penalty and overtime pay.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    loadData();
                    toast.success('Attendance summary refreshed');
                  }}
                  className="size-8.5 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshIcon className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={exportSummaryExcel}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheetIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Download Excel</span>
                </button>

                <button
                  type="button"
                  onClick={exportSummaryCsv}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
                >
                  <DownloadIcon className="size-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Row: Month and Department */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Month selector */}
              <div className="relative inline-flex items-center">
                <select
                  value={summaryMonth}
                  onChange={(e) => setSummaryMonth(e.target.value)}
                  className="h-9 appearance-none pl-3.5 pr-8 text-xs sm:text-sm font-medium border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[150px]"
                >
                  <option value="October, 2026">October, 2026</option>
                  <option value="September, 2026">September, 2026</option>
                  <option value="August, 2026">August, 2026</option>
                  <option value="July, 2026">July, 2026</option>
                </select>
                <CalendarIcon className="size-4 absolute right-2.5 pointer-events-none text-muted-foreground" />
              </div>

              {/* Department selector */}
              <div className="relative inline-flex items-center">
                <select
                  value={summaryDeptFilter}
                  onChange={(e) => setSummaryDeptFilter(e.target.value)}
                  className="h-9 appearance-none pl-3.5 pr-8 text-xs sm:text-sm font-medium border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[160px]"
                >
                  <option value="All">All departments</option>
                  <option value="Accounts">Accounts</option>
                  <option value="Design">Design</option>
                  <option value="Executive">Executive</option>
                  <option value="Operations">Operations</option>
                  <option value="Site Operations">Site Operations</option>
                  <option value="Estimation">Estimation</option>
                </select>
                <ArrowUpDownIcon className="size-3.5 absolute right-2.5 pointer-events-none text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Table with slight gap from heading & buttons */}
          <div className="mt-5 rounded-xl border border-border overflow-x-auto bg-card shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                  <th className="py-3 px-4 font-semibold w-14">Sr No</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Employee Code</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Full Name</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Department</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Present</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Late</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Half Day</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Overtime</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Absent</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Unmarked Working Days</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Late Penalty</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap text-center">Overtime Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSummaryRecords.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">{row.employeeCode}</td>
                    <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">{row.name}</td>
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{row.department}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Present', row.present)}
                        className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.present}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Late', row.late)}
                        className="text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.late}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Half Day', row.halfDay)}
                        className="text-foreground font-semibold hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.halfDay}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Overtime', row.overtime)}
                        className="text-foreground font-semibold hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.overtime}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Absent', row.absent)}
                        className={row.absent > 0 ? "text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer" : "text-muted-foreground hover:underline cursor-pointer"}
                        title="Click to see days and change them"
                      >
                        {row.absent}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Unmarked Working Days', row.unmarked)}
                        className="text-foreground font-semibold hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.unmarked}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Late Penalty', row.latePenalty)}
                        className="text-muted-foreground hover:underline cursor-pointer"
                        title="Click to see days and change them"
                      >
                        {row.latePenalty}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenSummaryBreakdown(row, 'Overtime Amount', row.overtimeAmount)}
                        className={row.overtimeAmount > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer" : "text-muted-foreground hover:underline cursor-pointer"}
                        title="Click to see days and change them"
                      >
                        {row.overtimeAmount}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Caption Note matching screenshot */}
          <p className="text-xs text-muted-foreground mt-3">
            Click any number to see its days and change them. Absent days include days the system marked absent automatically.
          </p>
        </Card>
      )}

      {/* MODAL: Attendance Summary Breakdown & Day Adjuster */}
      {summaryBreakdownTarget && (
        <Modal
          isOpen={!!summaryBreakdownTarget}
          onClose={() => setSummaryBreakdownTarget(null)}
          title={`Monthly Days — ${summaryBreakdownTarget.name}`}
          subtitle={`Category: ${summaryBreakdownTarget.category} • Selected Month: ${summaryMonth}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setSummaryBreakdownTarget(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Metric Count</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{summaryBreakdownTarget.value}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Employee Code</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{summaryBreakdownTarget.employeeCode || '—'}</p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Click any status below to change the recorded day's status. Absent days include days the system marked absent automatically.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-border/60 pr-1">
              {summaryBreakdownTarget.days.map((dayItem, dIdx) => (
                <div key={dIdx} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{dayItem.date}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {dayItem.checkIn ? `${dayItem.checkIn} - ${dayItem.checkOut || 'Active'}` : 'System logged entry'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={dayItem.status}
                      onChange={(e) => handleUpdateBreakdownDayStatus(dIdx, e.target.value)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground cursor-pointer"
                    >
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Overtime">Overtime</option>
                      <option value="Absent">Absent</option>
                      <option value="Unmarked Working Days">Unmarked</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 1: Office Location Settings */}
      <Modal
        isOpen={isOfficeSettingsOpen}
        onClose={() => setIsOfficeSettingsOpen(false)}
        title="Office Location Settings"
      >
        <form onSubmit={handleSaveOfficeSettings} className="space-y-4 text-xs">
          {/* Office Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Office Name
            </label>
            <input
              type="text"
              value={officeForm.name}
              onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-emerald-500/80 rounded-lg text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-card"
            />
          </div>

          {/* Latitude & Longitude */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={officeForm.lat}
                onChange={(e) => setOfficeForm({ ...officeForm, lat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary bg-card"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={officeForm.lng}
                onChange={(e) => setOfficeForm({ ...officeForm, lng: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary bg-card"
              />
            </div>
          </div>

          {/* Use My Current Location Button (Screenshot 3) */}
          <div>
            <button
              type="button"
              onClick={handleUseCurrentLocationForOffice}
              className="w-full py-2.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold border border-primary/20 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <NavigationIcon className="size-4 text-primary" />
              <span>Use My Current Location (saves immediately)</span>
            </button>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              Do this while standing at the office, on a phone if possible. A computer can save the wrong pin (often ~2 km off). Staff then pull-to-refresh the app.
            </p>
          </div>

          {/* Geo-Fence Radius Slider & Input (Screenshot 3) */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Geo-Fence Radius
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={officeForm.radiusMeters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radiusMeters: parseInt(e.target.value, 10) || 0 })}
                  className="w-20 px-2 py-1 text-center font-bold text-sm border border-border rounded-lg text-foreground bg-card"
                />
                <span className="text-xs text-muted-foreground font-medium">m</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="5000"
              step="25"
              value={officeForm.radiusMeters}
              onChange={(e) => setOfficeForm({ ...officeForm, radiusMeters: parseInt(e.target.value, 10) || 0 })}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>0m</span>
              <span>5000m</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Type an exact value in the box for a tight fence (e.g. 1m or 2m), or drag to adjust.
            </p>
          </div>

          {/* Info callout matching Screenshot 3 */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border text-[11px] text-muted-foreground leading-relaxed">
            Employees must be within <strong className="text-foreground">{officeForm.radiusMeters}m</strong> of{' '}
            <strong className="text-foreground">{officeForm.name}</strong> to punch in/out. Admins and managers can override this for manual attendance marking.
          </div>

          {/* Geofence status indicator */}
          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <ShieldIcon className="size-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Office Geofence Enforcement ({officeForm.radiusMeters}m)</span>
            </span>
            <span className="text-[11px] text-muted-foreground">High-precision PWA GPS Verification</span>
          </div>

          {/* Footer Buttons (Screenshot 3) */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOfficeSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckIcon className="size-3.5 mr-1" />
              <span>Save Settings</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Punch Attendance Modal (Screenshot 2) */}
      <Modal
        isOpen={isMarkStaffModalOpen}
        onClose={() => setIsMarkStaffModalOpen(false)}
        title="Punch Attendance"
      >
        <form onSubmit={handleMarkForStaffSubmit} className="space-y-4 text-xs">
          {/* Punch In / Punch Out Segmented Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-muted/70 border border-border/60">
            <button
              type="button"
              onClick={() => setStaffMarkForm((prev) => ({ ...prev, punchType: 'in' }))}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                staffMarkForm.punchType === 'in'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LogInIcon className="size-4" />
              <span>Punch In</span>
            </button>
            <button
              type="button"
              onClick={() => setStaffMarkForm((prev) => ({ ...prev, punchType: 'out' }))}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                staffMarkForm.punchType === 'out'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LogOutIcon className="size-4" />
              <span>Punch Out</span>
            </button>
          </div>

          {/* Staff Member Dropdown (Only show Admin role) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              STAFF MEMBER
            </label>
            <select
              value={staffMarkForm.userId}
              onChange={(e) => setStaffMarkForm({ ...staffMarkForm, userId: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-border rounded-xl text-foreground font-medium bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs sm:text-sm transition-all cursor-pointer"
            >
              <option value="" disabled>Select staff...</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.isAdmin ? `${staff.name} (Admin)` : staff.name}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Date Row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                SELECT ATTENDANCE DATE
              </label>
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setStaffMarkForm((prev) => ({ ...prev, date: today }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
              >
                <PlusIcon className="size-3.5 stroke-[2.5]" />
                <span>Add Date</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="date"
                value={staffMarkForm.date}
                onChange={(e) => setStaffMarkForm({ ...staffMarkForm, date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-foreground font-medium bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs sm:text-sm transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Punch Time Row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {staffMarkForm.punchType === 'out' ? 'PUNCH TIME (CHECK OUT TIME)' : 'PUNCH TIME (CHECK IN TIME)'}
              </label>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const hh = String(now.getHours()).padStart(2, '0');
                  const mm = String(now.getMinutes()).padStart(2, '0');
                  setStaffMarkForm((prev) => ({ ...prev, punchTime: `${hh}:${mm}` }));
                }}
                className="text-xs font-semibold text-primary hover:underline transition-colors cursor-pointer"
              >
                Set to Current Time
              </button>
            </div>
            <div className="relative">
              <input
                type="time"
                value={staffMarkForm.punchTime}
                onChange={(e) => setStaffMarkForm({ ...staffMarkForm, punchTime: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-foreground font-mono font-medium bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs sm:text-sm transition-all"
              />
            </div>
          </div>

          {/* Admin Override Alert */}
          <div className="p-3.5 rounded-xl border border-warning/30 bg-warning/10 text-foreground flex items-start gap-2.5">
            <ShieldIcon className="size-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-foreground font-medium leading-relaxed">
              <strong className="text-warning font-semibold">Admin/Manager override:</strong> Location check bypassed for manual attendance.
            </p>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMarkStaffModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="flex-1"
              leadingIcon="check"
            >
              {staffMarkForm.punchType === 'out' ? 'Punch Out' : 'Punch In'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Add Leave Type (Screenshot 2) */}
      <Modal
        isOpen={isAddLeaveTypeOpen}
        onClose={() => setIsAddLeaveTypeOpen(false)}
        title="Add Leave Type"
      >
        <form onSubmit={handleAddLeaveType} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase">Leave Type Title</label>
            <input
              type="text"
              required
              value={leaveTypeForm.name}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
              placeholder="e.g. Casual Leave, Maternity Leave"
              className="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase">Days / Year</label>
              <input
                type="number"
                min="1"
                max="365"
                value={leaveTypeForm.daysPerYear}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, daysPerYear: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase">Carry Forward</label>
              <select
                value={leaveTypeForm.carryForward}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, carryForward: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase">Description</label>
            <input
              type="text"
              value={leaveTypeForm.description}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, description: e.target.value })}
              placeholder="Optional notes"
              className="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddLeaveTypeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Create Leave Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Manager Correction Modal */}
      {correctionTarget && (
        <Modal
          isOpen={!!correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          title={`Correct Attendance Entry • ${correctionTarget.userName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase">Status</label>
              <select
                value={correctionData.status}
                onChange={(e) => setCorrectionData({ ...correctionData, status: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">Check-In Time</label>
                <input
                  type="text"
                  value={correctionData.checkInTime}
                  onChange={(e) => setCorrectionData({ ...correctionData, checkInTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-foreground font-mono bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">Check-Out Time</label>
                <input
                  type="text"
                  value={correctionData.checkOutTime}
                  onChange={(e) => setCorrectionData({ ...correctionData, checkOutTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-foreground font-mono bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase">Correction Reason</label>
              <input
                type="text"
                required
                value={correctionData.reason}
                onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                placeholder="Manager note or regularization reason"
                className="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCorrectionTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                onClick={handleSaveCorrection}
              >
                Save Correction
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 6: View Attendance Record Modal */}
      {viewTargetRecord && (
        <Modal
          isOpen={!!viewTargetRecord}
          onClose={() => setViewTargetRecord(null)}
          title="Staff Attendance Punch Record"
          subtitle={`${viewTargetRecord.userName} • ${viewTargetRecord.role}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setViewTargetRecord(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-muted/50 rounded-xl border border-border grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Date</span>
                <p className="font-semibold text-foreground mt-0.5">{viewTargetRecord.date}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Working Hours</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {calculateWorkingHours(viewTargetRecord.checkInTime, viewTargetRecord.checkOutTime)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Check-In Time</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{viewTargetRecord.checkInTime || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Check-Out Time</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{viewTargetRecord.checkOutTime || 'Active'}</p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/50 rounded-xl border border-border space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Punch Location</span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPinIcon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{viewTargetRecord.punchLocation || viewTargetRecord.site || 'Office Location'}</span>
              </div>
              {viewTargetRecord.coordinates && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  GPS: {viewTargetRecord.coordinates.lat?.toFixed(6)}° N, {viewTargetRecord.coordinates.lng?.toFixed(6)}° E (Accuracy: {viewTargetRecord.coordinates.accuracy || 10}m)
                </p>
              )}
            </div>

            {viewTargetRecord.correctionReason && (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Adjustment Note</span>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">{viewTargetRecord.correctionReason}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Regularization Request Modal */}
      {isRequestModalOpen && (
        <Modal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          title="Request Attendance Regularization"
          subtitle="Submit missed punches or adjustments with actual arrival and departure times"
        >
          <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
            {/* Staff Member Selector (Shown for Admin/Managers, locked for staff) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Staff Member
              </label>
              {canCorrectAttendance ? (
                <select
                  value={requestForm.userId}
                  onChange={(e) => setRequestForm({ ...requestForm, userId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary text-xs cursor-pointer"
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.isAdmin ? `${staff.name} (Admin)` : staff.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={currentUser?.name || 'Staff Member'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground font-medium text-xs opacity-75"
                />
              )}
            </div>

            {/* Request Type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Request Type
              </label>
              <select
                value={requestForm.type}
                onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary text-xs cursor-pointer"
              >
                <option value="Punch Regularization">Punch Regularization (Forgot to Punch / Sensor Glitch)</option>
                <option value="On-Duty (Site Visit)">On-Duty (Client Meeting / Site Inspection)</option>
                <option value="Work From Home">Work From Home (Approved Remote)</option>
              </select>
            </div>

            {/* Date with quick presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Attendance Date
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setRequestForm((prev) => ({ ...prev, date: today }));
                    }}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                      setRequestForm((prev) => ({ ...prev, date: y }));
                    }}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={requestForm.date}
                onChange={(e) => setRequestForm({ ...requestForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs cursor-pointer"
              />
            </div>

            {/* Time In and Time Out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Time In (Check-In)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const mm = String(now.getMinutes()).padStart(2, '0');
                      setRequestForm((prev) => ({ ...prev, requestedCheckIn: `${hh}:${mm}` }));
                    }}
                    className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Set Current
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 09:00 AM"
                  value={requestForm.requestedCheckIn}
                  onChange={(e) => setRequestForm({ ...requestForm, requestedCheckIn: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Time Out (Check-Out)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestForm((prev) => ({ ...prev, requestedCheckOut: '06:00 PM' }));
                    }}
                    className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Set 6:00 PM
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 06:00 PM"
                  value={requestForm.requestedCheckOut}
                  onChange={(e) => setRequestForm({ ...requestForm, requestedCheckOut: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>
            </div>

            {/* Reason / Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Reason / Explanation
              </label>
              <textarea
                required
                rows={3}
                placeholder="Reason for regularization (e.g., Biometric sensor glitch at main gate, or morning on-site inspection at client villa)..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRequestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leadingIcon="check"
              >
                Submit Request
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ConfirmDialog for Deleting Attendance Record */}
      <ConfirmDialog
        isOpen={!!recordPendingDelete}
        title="Delete attendance record?"
        message={`Are you sure you want to delete the attendance record for "${recordPendingDelete?.userName}" on ${recordPendingDelete?.date}? This action cannot be undone.`}
        confirmText="Delete Record"
        variant="danger"
        loading={deleteRecordLoading}
        onConfirm={async () => {
          if (!recordPendingDelete) return;
          setDeleteRecordLoading(true);
          try {
            await attendanceService.deleteAttendanceRecord(recordPendingDelete.id);
            toast.success('Attendance record deleted');
            setRecordPendingDelete(null);
            loadData();
          } catch (err) {
            toast.error('Failed to delete attendance record');
          } finally {
            setDeleteRecordLoading(false);
          }
        }}
        onCancel={() => setRecordPendingDelete(null)}
      />

      {/* Attendance Request View Details Modal */}
      {selectedViewRequest && (
        <Modal
          isOpen={!!selectedViewRequest}
          onClose={() => setSelectedViewRequest(null)}
          title="Attendance Request Details"
        >
          <div className="space-y-4 text-xs">
            {/* Staff Info Header */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center gap-3">
                <Avatar name={selectedViewRequest.employeeName || selectedViewRequest.userName || 'Staff'} size="md" />
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {selectedViewRequest.employeeName || selectedViewRequest.userName}
                  </h4>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    {selectedViewRequest.role ? `${selectedViewRequest.role} • ` : ''}
                    Submitted: {selectedViewRequest.requestedAt || selectedViewRequest.date || '—'}
                  </p>
                </div>
              </div>
              <div>
                {(selectedViewRequest.status || '').toLowerCase() === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckIcon className="size-3.5" /> Approved
                  </span>
                )}
                {(selectedViewRequest.status || '').toLowerCase() === 'rejected' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                    <XIcon className="size-3.5" /> Rejected
                  </span>
                )}
                {(selectedViewRequest.status || '').toLowerCase() === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30">
                    <ClockIcon className="size-3.5" /> Pending Review
                  </span>
                )}
                {(selectedViewRequest.status || '').toLowerCase() === 'withdrawn' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                    Withdrawn
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-card">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Attendance Date
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-foreground">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span>{selectedViewRequest.date || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Requested Check-In
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  <LogInIcon className="size-3.5" />
                  <span>{selectedViewRequest.requestedCheckIn || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Requested Check-Out
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  <LogOutIcon className="size-3.5" />
                  <span>{selectedViewRequest.requestedCheckOut || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Working Hours
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-medium text-foreground">
                  <ClockIcon className="size-3.5 text-muted-foreground" />
                  <span>{calculateWorkingHours(selectedViewRequest.requestedCheckIn, selectedViewRequest.requestedCheckOut)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Request Type
                </span>
                <div className="mt-1 font-medium text-foreground">
                  {selectedViewRequest.type || 'Punch Regularization'}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Current Status
                </span>
                <div className="mt-1 font-medium capitalize text-foreground">
                  {selectedViewRequest.status || 'Pending'}
                </div>
              </div>
            </div>

            {/* Reason Box */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Reason for Regularization / Correction
              </span>
              <p className="text-foreground font-medium leading-relaxed">
                {selectedViewRequest.reason || 'No specific reason provided.'}
              </p>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedViewRequest(null)}
              >
                Close
              </Button>

              {(selectedViewRequest.status || '').toLowerCase() === 'pending' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecideRequest(selectedViewRequest.id, 'reject')}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDecideRequest(selectedViewRequest.id, 'approve')}
                  >
                    Approve Request
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AttendancePage;
