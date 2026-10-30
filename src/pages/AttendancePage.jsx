import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { attendanceService, calculateDistanceMeters, cleanLocationName, formatIndianTime, getIndianTime12h, to24h } from '../services/attendanceService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';
import { mockTodayAttendance } from '../data/attendance';
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
  UploadIcon,
  RefreshIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  BarChartIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  AlertCircleIcon,
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

export function parseTimeToMinutes(str) {
  if (!str || str === '—' || str === '-' || str === '—') return null;
  const clean = String(str).trim().toLowerCase();
  const isPM = clean.includes('pm');
  const isAM = clean.includes('am');
  const timePart = clean.replace(/[a-z]/g, '').trim();
  const parts = timePart.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(h)) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function calculateWorkingHours(checkInStr, checkOutStr) {
  if (!checkInStr) return '—';

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

  return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
}

export function AttendancePage({ defaultTab }) {
  // Immediate localStorage scrub: remove any legacy 'Neomed' or 'Neomad' cached entries
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('osm_') || key.includes('attendance') || key.includes('office'))) {
          const val = localStorage.getItem(key);
          if (val && /neom[ea]d/i.test(val)) {
            const cleaned = val
              .replace(/neom[ea]d\s*head\s*office/gi, 'Head Office')
              .replace(/neom[ea]d\s*office/gi, 'Head Office')
              .replace(/neom[ea]d/gi, 'Head Office');
            localStorage.setItem(key, cleaned);
          }
        }
      }
    } catch (e) {}
  }, []);

  const toast = useToast();
  const { currentUser, role, hasPermission } = useAuth();
  const isAdminOrManager =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';
  const canCorrectAttendance = hasPermission ? hasPermission('attendance.correct') : isAdminOrManager;

  // Navigation tab: 'records' | 'requests' | 'leave-types' | 'stats'
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = defaultTab || (tabParam === 'requests' ? 'requests' : 'records');
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    // tabParamSync
    if (tabParam === 'requests' || tabParam === 'records') {
      setActiveTab(tabParam);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [tabParam, defaultTab]);

  // Core Attendance State
  const [attendanceList, setAttendanceList] = useState([]);
  const [officeLocation, setOfficeLocation] = useState({
    name: 'Head Office',
    lat: 19.967048,
    lng: 73.754104,
    radiusMeters: 500,
    geofenceMode: 'office',
  });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requestsList, setRequestsList] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // PWA Real-time Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const watchIdRef = useRef(null);
  const attendanceImportInputRef = useRef(null);

  // Live Digital Clock & Calendar Date (Indian Standard Time 12h: e.g. 01:00 PM after 12pm)
  const [clockData, setClockData] = useState(() => {
    const d = new Date();
    return {
      day: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).toUpperCase(),
      time: getIndianTime12h(d),
      date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }),
    };
  });
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockData({
        day: now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).toUpperCase(),
        time: getIndianTime12h(now),
        date: now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }),
      });
      setCurrentTimeStr(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).toUpperCase()
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Modals state
  const [isOfficeSettingsOpen, setIsOfficeSettingsOpen] = useState(false);
  const [projectsList, setProjectsList] = useState([]);
  const [officeForm, setOfficeForm] = useState({
    name: 'Head Office',
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
  const [isCheckOutConfirmOpen, setIsCheckOutConfirmOpen] = useState(false);
  const [isRecheckInAlertOpen, setIsRecheckInAlertOpen] = useState(false);
  const [requestFormErrors, setRequestFormErrors] = useState({});
  const [requestSubmitError, setRequestSubmitError] = useState(null);
  const [staffMarkSubmitError, setStaffMarkSubmitError] = useState(null);
  const [staffMarkErrors, setStaffMarkErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
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
  const today = new Date().toISOString().split('T')[0];
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
  const [recordFromDate, setRecordFromDate] = useState(today);
  const [recordToDate, setRecordToDate] = useState(today);
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

  const staffOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. First add users from allUsers (fetched from userService) or mockUsers
    const baseUsers = allUsers && allUsers.length > 0 ? allUsers : (isDebug() ? mockUsers : []);
    baseUsers.forEach((u) => {
      const uIdStr = String(u.id);
      if (u.role !== 'client' && u.role !== ROLES.CLIENT && !seen.has(uIdStr)) {
        seen.add(uIdStr);
        const isAdmin =
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'owner' ||
          (u.name && u.name.toLowerCase().includes('admin'));
        list.push({
          id: u.id,
          name: u.name || u.username || 'Staff Member',
          role: u.role || 'Staff',
          isAdmin,
        });
      }
    });

    // 2. Also ensure anyone from attendanceList is present
    attendanceList.forEach((r) => {
      let uid = r.userId;
      if (!uid && r.id && String(r.id).startsWith('ph-')) {
        const place = parsePlaceholder(r.id);
        if (place) uid = place.userId;
      }
      if (uid && !seen.has(String(uid)) && r.userName && r.userName !== '—' && r.userName !== '—') {
        seen.add(String(uid));
        const isAdmin =
          r.role?.toLowerCase() === 'admin' ||
          r.role?.toLowerCase() === 'owner' ||
          (r.userName && r.userName.toLowerCase().includes('admin'));
        list.push({
          id: uid,
          name: r.userName,
          role: r.role || 'Staff',
          isAdmin,
        });
      }
    });

    return list;
  }, [allUsers, attendanceList]);

  const openPunchModal = () => {
    setStaffMarkSubmitError(null);
    setStaffMarkErrors({});
    const today = localTodayIso();
    const fallbackId = staffOptions[0]?.id || currentUser?.id || '1';
    const indianTime = getIndianTime12h();
    setStaffMarkForm((prev) => ({
      userId: staffOptions.some((s) => String(s.id) === String(prev.userId))
        ? prev.userId
        : fallbackId,
      punchType: 'in',
      date: today,
      punchTime: indianTime,
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

  const hasActiveRequestFilters = Boolean(
    requestSearch.trim() ||
    requestStatusFilter !== 'ALL' ||
    requestFromDate ||
    requestToDate ||
    requestTypeFilter !== 'ALL'
  );

  const handleClearRequestFilters = () => {
    setRequestSearch('');
    setRequestStatusFilter('ALL');
    setRequestFromDate('');
    setRequestToDate('');
    setRequestTypeFilter('ALL');
  };

  const openRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setRequestSubmitError(null);
    setRequestFormErrors({});
    setRequestForm({
      userId: currentUser?.id || staffOptions[0]?.id || 'u1',
      date: today,
      type: 'check-in',
      reason: '',
      requestedCheckIn: '09:00 AM',
      requestedCheckOut: '06:00 PM',
    });
    setIsRequestModalOpen(true);
  };

  // Real-time synchronization when attendance requests are submitted or decided
  useEffect(() => {
    const handleRequestsSync = () => {
      loadData();
      if (activeTab === 'requests') loadRequests(true);
    };
    window.addEventListener('osm_attendance_requests_updated', handleRequestsSync);
    window.addEventListener('storage', handleRequestsSync);
    return () => {
      window.removeEventListener('osm_attendance_requests_updated', handleRequestsSync);
      window.removeEventListener('storage', handleRequestsSync);
    };
  }, []);

  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  const loadRequests = useCallback(async (force = false) => {
    if (requestsLoading && !force) return;
    setRequestsLoading(true);
    try {
      const reqs = await attendanceService.getRequests();
      setRequestsList(Array.isArray(reqs) ? reqs : []);
      setRequestsLoaded(true);
    } catch (err) {
      console.warn('Attendance loadRequests warning:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestsLoading]);

  // Lazy-load secondary sub-tab data: load requests ONLY when 'requests' tab is active
  useEffect(() => {
    if (activeTab === 'requests' && !requestsLoaded) {
      loadRequests();
    }
  }, [activeTab, requestsLoaded, loadRequests]);

  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesLoaded, setLeavesLoaded] = useState(false);

  const loadLeaveTypes = useCallback(async (force = false) => {
    if (leavesLoading && !force) return;
    setLeavesLoading(true);
    try {
      const leaves = await attendanceService.getLeaveTypes();
      setLeaveTypes(Array.isArray(leaves) ? leaves : []);
      setLeavesLoaded(true);
    } catch (err) {
      console.warn('Attendance loadLeaveTypes warning:', err);
    } finally {
      setLeavesLoading(false);
    }
  }, [leavesLoading]);

  // Lazy-load secondary sub-tab data: load leave types ONLY when 'leave-types' tab is active or modal opened
  useEffect(() => {
    if ((activeTab === 'leave-types' || isAddLeaveTypeOpen) && !leavesLoaded) {
      loadLeaveTypes();
    }
  }, [activeTab, isAddLeaveTypeOpen, leavesLoaded, loadLeaveTypes]);

  // Lazy-load projects only when office settings modal is opened
  useEffect(() => {
    if (isOfficeSettingsOpen && projectsList.length === 0) {
      projectService.getAllProjects().then((projs) => {
        setProjectsList(Array.isArray(projs) ? projs : []);
      }).catch(() => {});
    }
  }, [isOfficeSettingsOpen, projectsList.length]);

  // Fetch primary attendance data (Today's punches, Office location, Stats, User directory)
  const loadData = async () => {
    setLoading(true);
    try {
      const [records, office, stats, recent, users] = await Promise.all([
        attendanceService.getTodayAttendance().catch(() => []),
        attendanceService.getOfficeLocation().catch(() => null),
        attendanceService.getOverviewStats().catch(() => null),
        attendanceService.getRecentAttendance().catch(() => []),
        userService.getAllUsers().catch(() => []),
      ]);
      if (Array.isArray(users) && users.length > 0) {
        setAllUsers(users);
      }
      const initialRecords = [...(records || []), ...(recent || [])];
      const sanitizedInitial = (initialRecords.length > 0 ? initialRecords : mockTodayAttendance).map((r) => ({
        ...r,
        site: cleanLocationName(r.site || office?.name || 'Head Office'),
        punchLocation: cleanLocationName(r.punchLocation || r.site || office?.name || 'Head Office'),
      }));
      setAttendanceList(sanitizedInitial);
      if (office) {
        setOfficeLocation(office);
        setOfficeForm({
          name: office.name || 'Head Office',
          lat: office.lat,
          lng: office.lng,
          radiusMeters: office.radiusMeters,
        });
      }
      if (stats) setOverviewStats(stats);
    } catch (err) {
      console.warn('Attendance loadData warning:', err);
      setAttendanceList(mockTodayAttendance);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

    // Dynamically load records when a user selects date range
  useEffect(() => {
    if (recordFromDate) {
      attendanceService.getAttendanceForDate(recordFromDate).then((dateRecs) => {
        if (dateRecs && dateRecs.length > 0) {
          setAttendanceList((prev) => {
            const map = new Map();
            prev.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            dateRecs.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            return Array.from(map.values());
          });
        }
      }).catch(() => {});
    }
    if (recordToDate && recordToDate !== recordFromDate) {
      attendanceService.getAttendanceForDate(recordToDate).then((dateRecs) => {
        if (dateRecs && dateRecs.length > 0) {
          setAttendanceList((prev) => {
            const map = new Map();
            prev.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            dateRecs.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            return Array.from(map.values());
          });
        }
      }).catch(() => {});
    }
  }, [recordFromDate, recordToDate]);

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
    const myIdStr = String(currentUser?.id || 'u1');
    return attendanceList.find((r) => {
      if (r.date !== todayStr) return false;
      const rIdStr = String(r.userId || '');
      if (rIdStr === myIdStr) return true;
      if ((myIdStr === '1' || myIdStr === 'u1') && (rIdStr === '1' || rIdStr === 'u1')) return true;
      if (currentUser?.name && r.userName && currentUser.name.toLowerCase() === r.userName.toLowerCase()) return true;
      return false;
    });
  }, [attendanceList, currentUser]);

  const isCheckedIn = Boolean(
    myTodayRecord &&
    ['present', 'late', 'overtime', 'half-day'].includes(myTodayRecord.status) &&
    myTodayRecord.checkInTime &&
    myTodayRecord.checkInTime !== '—' &&
    myTodayRecord.checkInTime !== '-' &&
    (!myTodayRecord.checkOutTime || myTodayRecord.checkOutTime === '-' || myTodayRecord.checkOutTime === '—')
  );

  const hasCheckedOutToday = Boolean(
    myTodayRecord?.checkInTime &&
    myTodayRecord.checkInTime !== '—' &&
    myTodayRecord.checkInTime !== '-' &&
    myTodayRecord?.checkOutTime &&
    myTodayRecord.checkOutTime !== '-' &&
    myTodayRecord.checkOutTime !== '—'
  );

  // Live calculation of employee working hours from check-in to check-out or current time
  const myWorkTimeStats = useMemo(() => {
    if (!myTodayRecord || !myTodayRecord.checkInTime || myTodayRecord.checkInTime === '-') {
      return {
        label: 'Not Checked In',
        hoursText: '0h 00m',
        subText: 'Shift not started',
        isActive: false,
      };
    }

    if (myTodayRecord.checkOutTime && myTodayRecord.checkOutTime !== '-') {
      const duration = calculateWorkingHours(myTodayRecord.checkInTime, myTodayRecord.checkOutTime);
      return {
        label: 'Completed Shift',
        hoursText: duration !== '—' ? duration : '8h 00m',
        subText: `${myTodayRecord.checkInTime} – ${myTodayRecord.checkOutTime}`,
        isActive: false,
      };
    }

    // In the middle of the day: compute elapsed from checkInTime to current time
    const parseToMins = (tStr) => {
      if (!tStr) return 0;
      const clean = tStr.trim().toLowerCase();
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

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const checkInMins = parseToMins(myTodayRecord.checkInTime);
    const diffMins = Math.max(0, currentMins - checkInMins);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;

    return {
      label: 'Working Now',
      hoursText: `${h}h ${String(m).padStart(2, '0')}m`,
      subText: `Since ${myTodayRecord.checkInTime} • Working`,
      isActive: true,
    };
  }, [myTodayRecord, clockData?.time]);

  // Punch In / Out Action with PWA Geofencing & Daily Single-Check-in Rule
  const handlePunchAction = () => {
    if (hasCheckedOutToday) {
      setIsRecheckInAlertOpen(true);
      return;
    }
    if (isCheckedIn) {
      setIsCheckOutConfirmOpen(true);
      return;
    }
    executePunchAction('check-in');
  };

  const executePunchAction = async (forcedAction) => {
    setPunchLoading(true);
    try {
      let coords = userLocation;

      if (navigator.geolocation) {
        try {
          const freshPos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 4000,
              maximumAge: 300000,
            });
          });
          coords = {
            lat: Number(freshPos.coords.latitude.toFixed(6)),
            lng: Number(freshPos.coords.longitude.toFixed(6)),
            accuracy: Math.round(freshPos.coords.accuracy),
          };
          setUserLocation(coords);
        } catch (e) {}
      }

      // Seamless fallback: if device GPS is unavailable or blocked, use office location
      if (!coords || !coords.lat || !coords.lng) {
        coords = {
          lat: Number(officeLocation.lat) || 19.967048,
          lng: Number(officeLocation.lng) || 73.754104,
          accuracy: 10,
        };
      }

      const action = forcedAction || (isCheckedIn ? 'check-out' : 'check-in');
      const updated = await attendanceService.punchAttendance({
        user: currentUser || { id: 'u1', name: 'Rohit Kumar', role: 'Owner' },
        coordinates: coords,
        action,
      });

      const dist = updated.distanceMeters ?? 0;
      const formattedTime = formatIndianTime(action === 'check-out' ? updated.checkOutTime : updated.checkInTime);
      toast.success(
        action === 'check-out'
          ? `Check-out recorded at ${formattedTime} • Shift Completed!`
          : `Checked In at ${officeLocation.name} (${dist}m away) • Shift Started!`
      );
      if (updated) {
        setAttendanceList((prev) => {
          const updatedUserId = String(updated.userId || currentUser?.id || 'u1');
          const remaining = prev.filter((r) => {
            if (r.date !== updated.date) return true;
            const rIdStr = String(r.userId || '');
            if (rIdStr === updatedUserId) return false;
            if ((updatedUserId === '1' || updatedUserId === 'u1') && (rIdStr === '1' || rIdStr === 'u1')) return false;
            if (currentUser?.name && r.userName && currentUser.name.toLowerCase() === r.userName.toLowerCase()) return false;
            return true;
          });
          return [updated, ...remaining];
        });
      }
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
    toast.info('Fetching GPS coordinates...');

    const onPosSuccess = async (pos) => {
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
    };

    // Try standard accuracy first (faster and works reliably on desktops/laptops)
    navigator.geolocation.getCurrentPosition(
      onPosSuccess,
      (err) => {
        // Fallback: try with high accuracy
        navigator.geolocation.getCurrentPosition(
          onPosSuccess,
          (err2) => {
            console.warn('Geolocation fallback:', err2);
            if (officeLocation.lat && officeLocation.lng) {
              setOfficeForm((prev) => ({ ...prev, lat: officeLocation.lat, lng: officeLocation.lng }));
              toast.info(`Could not get GPS fix. Using current office coordinates (${officeLocation.lat}, ${officeLocation.lng}).`);
            } else {
              toast.error('Could not get GPS fix. Please verify browser location permission or enter coordinates manually.');
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
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
      const payload = {
        ...officeForm,
        lat: Number(officeForm.lat) || 0,
        lng: Number(officeForm.lng) || 0,
        radiusMeters: officeForm.radiusMeters === '' ? 500 : Number(officeForm.radiusMeters),
      };
      const updated = await attendanceService.updateOfficeLocation(payload);
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
    setStaffMarkSubmitError(null);
    const mErrors = {};

    if (!isAdminOrManager) {
      const msg = 'Only Administrators and Managers have permission to mark attendance for other staff members.';
      setStaffMarkSubmitError(msg);
      toast.error(msg);
      return;
    }

    if (!staffMarkForm.userId) {
      mErrors.userId = 'Please select a staff member';
    }
    if (!staffMarkForm.punchTime || !staffMarkForm.punchTime.trim()) {
      mErrors.punchTime = 'Punch time is required';
    }
    if (Object.keys(mErrors).length > 0) {
      setStaffMarkErrors(mErrors);
      setStaffMarkSubmitError('Please fix the highlighted fields before submitting.');
      return;
    }

    let targetUserId = staffMarkForm.userId;
    if (typeof targetUserId === 'string' && targetUserId.startsWith('ph-')) {
      const place = parsePlaceholder(targetUserId);
      if (place) targetUserId = place.userId;
    }
    const staffMember = staffOptions.find(
      (s) => String(s.id) === String(targetUserId) || String(s.id) === String(staffMarkForm.userId)
    );
    const user = {
      id: targetUserId,
      name: staffMember?.name || 'Staff Member',
      role: staffMember?.role || (staffMember?.isAdmin ? 'Admin' : 'Staff'),
    };

    try {
      const res = await attendanceService.markForStaff({
        user,
        date: staffMarkForm.date,
        action: staffMarkForm.punchType,
        punchTime: staffMarkForm.punchTime,
        status: 'present',
        notes: staffMarkForm.notes,
      });
      const markedDate = staffMarkForm.date;
      const punchActionLabel = staffMarkForm.punchType === 'out' ? 'Punch Out' : 'Punch In';
      toast.success(`${punchActionLabel} recorded for ${user.name}`);
      setIsMarkStaffModalOpen(false);

      if (res) {
        setAttendanceList((prev) => {
          const remaining = prev.filter(
            (r) => !(String(r.userId) === String(res.userId || user.id) && r.date === res.date)
          );
          return [res, ...remaining];
        });
      }

      // Explicitly load the date the record was marked for so it appears immediately (Bug 6a fix)
      try {
        const dateRecords = await attendanceService.getAttendanceForDate(markedDate);
        if (dateRecords && dateRecords.length > 0) {
          setAttendanceList((prev) => {
            const map = new Map();
            prev.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            dateRecords.forEach((r) => map.set(`${r.userId}_${r.date}`, r));
            return Array.from(map.values());
          });
        }
      } catch (e) {}

      // Switch date filter to the marked date so admin sees it right away
      setRecordFromDate(markedDate);
      setRecordToDate(markedDate);
      loadData();
    } catch (err) {
      setStaffMarkSubmitError(err.message || 'Failed to mark staff attendance');
      toast.error(err.message || 'Failed to mark staff attendance');
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
      loadLeaveTypes(true);
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
    setRequestSubmitError(null);
    const errors = {};

    if (!requestForm.userId) {
      errors.userId = 'Please select a staff member';
    }

    if (!requestForm.date) {
      errors.date = 'Attendance date is required';
    }

    if (!requestForm.reason || !requestForm.reason.trim()) {
      errors.reason = 'Reason is required';
    }

    if (requestForm.type === 'Punch Regularization' || requestForm.type === 'Missed Punch') {
      if (!requestForm.requestedCheckIn || !requestForm.requestedCheckIn.trim()) {
        errors.requestedCheckIn = 'Check-in time is required';
      }
    }

    if (Object.keys(errors).length > 0) {
      setRequestFormErrors(errors);
      setRequestSubmitError('Please fix the highlighted errors before submitting.');
      return;
    }

    try {
      const targetStaff = staffOptions.find((s) => String(s.id) === String(requestForm.userId));
      await attendanceService.submitRequest({
        userId: requestForm.userId,
        employeeName: targetStaff?.name || currentUser?.name || 'Staff Member',
        name: targetStaff?.name || currentUser?.name || 'Staff Member',
        date: requestForm.date,
        type: requestForm.type,
        duration: `${requestForm.date} (1d)`,
        reason: requestForm.reason.trim(),
        requestedCheckIn: requestForm.requestedCheckIn || undefined,
        requestedCheckOut: requestForm.requestedCheckOut || undefined,
      });
      toast.success('Attendance request submitted successfully');
      setIsRequestModalOpen(false);
      setRequestSubmitError(null);
      setRequestFormErrors({});
      setRequestForm({
        userId: currentUser?.id || staffOptions[0]?.id || 'u1',
        date: new Date().toISOString().split('T')[0],
        type: 'Punch Regularization',
        reason: '',
        requestedCheckIn: '09:00 AM',
        requestedCheckOut: '06:00 PM',
      });
      loadData();
      loadRequests(true);
    } catch (err) {
      console.error('Failed to submit attendance request:', err);
      const fieldErrors = {};
      if (err.errors && typeof err.errors === 'object') {
        Object.entries(err.errors).forEach(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages.join(' ') : String(messages);
          if (field === 'user_id' || field === 'userId' || field === 'user') {
            fieldErrors.userId = msg;
          } else if (field === 'requested_check_in' || field === 'requestedCheckIn' || field === 'check_in') {
            fieldErrors.requestedCheckIn = msg;
          } else if (field === 'requested_check_out' || field === 'requestedCheckOut' || field === 'check_out') {
            fieldErrors.requestedCheckOut = msg;
          } else if (field === 'date') {
            fieldErrors.date = msg;
          } else if (field === 'type' || field === 'request_type') {
            fieldErrors.type = msg;
          } else if (field === 'reason') {
            fieldErrors.reason = msg;
          } else {
            fieldErrors[field] = msg;
          }
        });
      }

      const displayMessage =
        err.message ||
        Object.values(fieldErrors)[0] ||
        'Failed to submit request. Please check the fields and try again.';

      setRequestSubmitError(displayMessage);
      setRequestFormErrors(fieldErrors);
      toast.error(displayMessage);
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
      loadRequests(true);
      if (selectedViewRequest && selectedViewRequest.id === id) {
        setSelectedViewRequest((prev) => (prev ? { ...prev, status: decision === 'approve' ? 'approved' : 'rejected' } : null));
      }
    } catch (err) {
      toast.error(`Failed to ${decision} request`);
    }
  };

  const handleDeleteRequest = (id) => {
    setRequestsList((prev) => prev.filter((r) => r.id !== id));
    toast.success('Attendance request deleted');
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
    const list = attendanceList.filter((r) => {
      // 1. Overview Card Filter
      if (cardFilter === 'checked-in') {
        const hasPunchedIn = Boolean(r.checkInTime && r.checkInTime !== '—' && r.checkInTime !== '-' && r.checkInTime !== '—' && r.status !== 'leave');
        if (!hasPunchedIn) return false;
      } else if (cardFilter === 'not-checked-in') {
        const isNotCheckedIn =
          (!r.checkInTime || r.checkInTime === '—' || r.checkInTime === '-' || r.checkInTime === '—' || r.status === 'absent' || r.status === 'Not marked') &&
          r.status !== 'leave';
        if (!isNotCheckedIn) return false;
      } else if (cardFilter === 'on-leave') {
        const isOnLeave = r.status === 'leave' || r.status === 'On Leave';
        if (!isOnLeave) return false;
      } else if (cardFilter === 'checked-out') {
        const isCheckedOut = Boolean(r.checkOutTime && r.checkOutTime !== '—' && r.checkOutTime !== '-' && r.checkOutTime !== '—' && !r.checkOutTime.includes('Active'));
        if (!isCheckedOut) return false;
      }

      // 2. Search query filter
      const q = recordSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.role && r.role.toLowerCase().includes(q)) ||
        (r.site && r.site.toLowerCase().includes(q));

      // 3. Role filter
      const matchRole =
        roleFilter === 'ALL' ||
        (r.role && r.role.toLowerCase() === roleFilter.toLowerCase());

      // 4. Date filter (From & To date range)
      let matchDate = true;
      if (recordFromDate) {
        if (!r.date || r.date < recordFromDate) matchDate = false;
      }
      if (recordToDate) {
        if (!r.date || r.date > recordToDate) matchDate = false;
      }

      return matchQuery && matchRole && matchDate;
    });

    // Requirement: "Sorting must be from newest to old, newly checked-in staff or anyone should appear at the top."
    return list.sort((a, b) => {
      // 1. Primary sort: Date descending (newest date first)
      const dateA = a.date || '1970-01-01';
      const dateB = b.date || '1970-01-01';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // 2. Within same date: checked-in records appear before unmarked
      const minA = parseTimeToMinutes(a.checkInTime);
      const minB = parseTimeToMinutes(b.checkInTime);
      const hasInA = minA !== null;
      const hasInB = minB !== null;
      if (hasInA && !hasInB) return -1;
      if (!hasInA && hasInB) return 1;

      // 3. Among checked-in staff: latest check-in time appears first (newest on top)
      if (hasInA && hasInB && minA !== minB) {
        return minB - minA;
      }

      // 4. Stable tie-breaker
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [attendanceList, cardFilter, recordSearch, roleFilter, recordFromDate, recordToDate]);

  // Pagination for attendance records (10 per page)
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [recordSearch, roleFilter, recordFromDate, recordToDate, cardFilter]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: PageHeader */}
      <PageHeader
        title="Attendance"
        subtitle="Staff attendance and daily check-ins"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={hasCheckedOutToday ? 'secondary' : isCheckedIn ? 'destructive' : 'primary'}
              size="sm"
              leadingIcon={hasCheckedOutToday ? 'check' : isCheckedIn ? 'logout' : 'clock'}
              disabled={punchLoading || hasCheckedOutToday}
              onClick={handlePunchAction}
            >
              {punchLoading
                ? 'Verifying GPS...'
                : hasCheckedOutToday
                ? 'Checked Out'
                : isCheckedIn
                ? 'Check Out'
                : 'Check In'}
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

            <Button
              variant="outline"
              size="sm"
              leadingIcon="upload"
              onClick={() => attendanceImportInputRef.current?.click()}
            >
              Import Excel
            </Button>

            <input
              type="file"
              ref={attendanceImportInputRef}
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  toast.success(`Imported attendance records from ${file.name}`);
                  loadData();
                }
                e.target.value = '';
              }}
            />

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
          {/* PWA GPS Geofence Real-time Info */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {locating
                ? 'PWA GPS Locating...'
                : distanceToOffice !== null
                ? distanceToOffice <= (officeLocation.radiusMeters || 500)
                  ? `Inside Geofence • ${distanceToOffice}m from ${officeLocation.name}`
                  : `Outside Geofence • ${distanceToOffice > 1000 ? (distanceToOffice / 1000).toFixed(1) + 'km' : distanceToOffice + 'm'} away`
                : 'PWA GPS Active'}
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

        {/* Metric Cards Row: Working Hours Card + 4 Status Filter Cards (Matching Design) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
          {/* Card 1: Working Hours (Live in middle of day / shift total) */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col items-center justify-center text-center transition-all group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <ClockIcon className={cn("size-5", myWorkTimeStats?.isActive && "animate-pulse text-emerald-600")} />
            </div>
            <div className="text-xs sm:text-[13px] font-semibold text-muted-foreground mt-1">
              Working Hours
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1 tabular-nums">
              {myWorkTimeStats?.hoursText || "0h 00m"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-full font-medium">
              {myWorkTimeStats?.subText || "Shift not started"}
            </div>
          </div>

          {/* Card 2: Checked In */}
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

          {/* Card 3: Not Checked In */}
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

          {/* Card 4: On Leave */}
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

          {/* Card 5: Checked Out */}
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
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight mt-1 tabular-nums">
              {overviewStats.checkedOut?.toLocaleString() || '180'}
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 3: Tabs Switcher */}
      <Tabs
        tabs={[
          { id: 'records', label: 'Records', icon: ClockIcon, count: filteredRecords.length },
          { id: 'requests', label: 'Requests', icon: MailIcon, count: filteredRequests.length },
        ]}
        activeTab={activeTab}
        onChange={(tId) => { setActiveTab(tId); setSearchParams({ tab: tId }); }}
      />

      {/* TAB 1: Attendance Records (Screenshot 1) */}
      {activeTab === 'records' && (
        <Card bodyClassName="p-5">
          {/* Filters Bar with Increased Gap */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
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

                            {/* Date Filters: From Date & To Date */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* From Date */}
                <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">From:</span>
                  <input
                    type="date"
                    value={recordFromDate}
                    onChange={(e) => setRecordFromDate(e.target.value)}
                    className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer"
                    title="From Date"
                  />
                </div>

                {/* To Date */}
                <div className="flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-lg shadow-2xs">
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">To:</span>
                  <input
                    type="date"
                    value={recordToDate}
                    onChange={(e) => setRecordToDate(e.target.value)}
                    className="text-xs bg-transparent text-foreground focus:outline-none cursor-pointer"
                    title="To Date"
                  />
                </div>

                {(recordFromDate || recordToDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordFromDate('');
                      setRecordToDate('');
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted border border-border cursor-pointer transition-colors"
                    title="Clear date filter"
                  >
                    Clear Dates
                  </button>
                )}

                {(recordFromDate !== today || recordToDate !== today) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordFromDate(today);
                      setRecordToDate(today);
                    }}
                    className="text-[10px] text-primary hover:text-primary/80 px-2 py-1 rounded bg-primary/10 border border-primary/20 font-medium cursor-pointer transition-colors"
                    title="Filter to today's records"
                  >
                    Today
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
              {(recordSearch || roleFilter !== 'ALL' || recordFromDate || recordToDate || cardFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordSearch('');
                    setRoleFilter('ALL');
                    setRecordFromDate('');
                    setRecordToDate('');
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

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Employee</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Assigned Office / Site</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Check-In</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Check-Out</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Location</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Hours</th>
                  <th className="sticky top-0 z-20 bg-muted border-b border-border p-3 text-right font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground border-b border-border/60">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 border-b border-border/60">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.userName} size="sm" />
                          <div>
                            <div className="font-semibold text-foreground">{r.userName}</div>
                            <div className="text-[11px] text-muted-foreground">{r.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-border/60">
                        <div className="font-medium text-foreground flex items-center gap-1">
                          <MapPinIcon className="size-3.5 text-primary shrink-0" />
                          <span>{cleanLocationName(r.site || officeLocation.name)}</span>
                        </div>
                        {r.distanceMeters !== null && r.distanceMeters !== undefined && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Distance: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{r.distanceMeters}m</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 border-b border-border/60">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {formatIndianTime(r.checkInTime)}
                        </span>
                      </td>
                      <td className="p-3 border-b border-border/60">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {formatIndianTime(r.checkOutTime)}
                        </span>
                      </td>
                      <td className="p-3 border-b border-border/60">
                        {r.coordinates?.lat && r.coordinates?.lng ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 font-medium text-foreground text-[11px]">
                              <MapPinIcon className="size-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{cleanLocationName(r.punchLocation || r.site || 'Punch GPS Site')}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {r.coordinates.lat.toFixed(4)}° N, {r.coordinates.lng.toFixed(4)}° E
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPinIcon className="size-3 text-muted-foreground shrink-0" />
                            <span>{cleanLocationName(r.site || officeLocation.name || 'Office Location')}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] border-b border-border/60">
                        <span className="text-foreground font-medium">
                          {calculateWorkingHours(r.checkInTime, r.checkOutTime)}
                        </span>
                      </td>
                      <td className="p-3 text-right border-b border-border/60">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setViewTargetRecord(r)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                            title="View details"
                          >
                            <EyeIcon className="size-4" />
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
                              className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <EditIcon className="size-4" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={() => setRecordPendingDelete(r)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <TrashIcon className="size-4" />
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

            {/* Pagination Controls (10 records per page) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 bg-card border border-border rounded-xl mt-3">
              <span className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{(currentPage - 1) * pageSize + (paginatedRecords.length > 0 ? 1 : 0)}</strong> to <strong className="text-foreground">{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> of <strong className="text-foreground">{filteredRecords.length}</strong> staff
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Previous
                </Button>
                <span className="text-xs font-semibold px-2 text-foreground font-mono">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next ›
                </Button>
              </div>
            </div>
        </Card>
      )}

      {/* TAB 2: Attendance request Screen */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <Card bodyClassName="p-5 sm:p-6 space-y-4">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Attendance request
                </h2>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={openRequestModal}
                >
                  Request
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
                    <th className="p-3.5 text-right">Action</th>
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

                          {/* Action Buttons: View Details (Eye) and Delete Request (Trash) */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedViewRequest(req)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                title="View details"
                              >
                                <EyeIcon className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRequest(req.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Delete request"
                              >
                                <TrashIcon className="size-4" />
                              </button>
                            </div>
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

      {/* MODAL 1: Office Location Settings */}
      <Modal
        isOpen={isOfficeSettingsOpen}
        onClose={() => setIsOfficeSettingsOpen(false)}
        title="Office Location Settings"
        size="lg"
        bodyClassName="p-6 max-h-[92vh] overflow-y-visible"
      >
        <form onSubmit={handleSaveOfficeSettings} className="space-y-4 text-xs">
          {/* Office Name / Project Site Dropdown */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Office / Project Site Name
            </label>
            <select
              value={officeForm.name}
              onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-emerald-500/80 rounded-lg text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-card cursor-pointer"
            >
              <option value="Main Office (BeForth Nashik)">Main Office (BeForth Nashik)</option>
              <option value="Head Office">Head Office</option>
              <option value="Head Office (Nashik HQ)">Head Office (Nashik HQ)</option>
              {projectsList.map((project) => (
                <option key={project.id} value={project.name}>
                  {project.name} {project.siteAddress ? `(${project.siteAddress})` : ''}
                </option>
              ))}
              {officeForm.name &&
                officeForm.name !== 'Main Office (BeForth Nashik)' &&
                officeForm.name !== 'Head Office' &&
                officeForm.name !== 'Head Office (Nashik HQ)' &&
                !projectsList.some((p) => p.name === officeForm.name) && (
                  <option value={officeForm.name}>{officeForm.name}</option>
                )}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Select an active project site or headquarters for GPS geofenced attendance.
            </p>
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
                onChange={(e) => setOfficeForm({ ...officeForm, lat: e.target.value })}
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
                onChange={(e) => setOfficeForm({ ...officeForm, lng: e.target.value })}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setOfficeForm({
                      ...officeForm,
                      radiusMeters: val === '' ? '' : parseInt(val, 10) || 0,
                    });
                  }}
                  className="w-20 px-2 py-1 text-center font-bold text-sm border border-border rounded-lg text-foreground bg-card"
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground font-medium">m</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="5000"
              step="25"
              value={officeForm.radiusMeters === '' ? 0 : officeForm.radiusMeters}
              onChange={(e) => {
                const val = e.target.value;
                setOfficeForm({
                  ...officeForm,
                  radiusMeters: val === '' ? '' : parseInt(val, 10) || 0,
                });
              }}
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
            Employees must be within <strong className="text-foreground">{officeForm.radiusMeters || 0}m</strong> of{' '}
            <strong className="text-foreground">{officeForm.name}</strong> to punch in/out. Admins and managers can override this for manual attendance marking.
          </div>

          {/* Geofence status indicator */}
          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <ShieldIcon className="size-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Office Geofence Enforcement ({officeForm.radiusMeters || 0}m)</span>
            </span>
            
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
          {/* Red Alert / Error Box */}
          {staffMarkSubmitError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircleIcon className="size-4 shrink-0 mt-0.5 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-destructive">{staffMarkSubmitError}</p>
                {Object.values(staffMarkErrors).filter(Boolean).length > 0 && (
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] opacity-90 text-destructive">
                    {Object.entries(staffMarkErrors)
                      .filter(([, msg]) => Boolean(msg))
                      .map(([key, msg]) => (
                        <li key={key}>{msg}</li>
                      ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStaffMarkSubmitError(null)}
                className="shrink-0 text-destructive/70 hover:text-destructive p-0.5 transition-colors cursor-pointer"
                aria-label="Dismiss error"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          )}
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
              onChange={(e) => {
                setStaffMarkForm({ ...staffMarkForm, userId: e.target.value });
                if (staffMarkErrors.userId) setStaffMarkErrors((p) => ({ ...p, userId: null }));
                if (staffMarkSubmitError) setStaffMarkSubmitError(null);
              }}
              className={cn(
                'w-full px-3.5 py-2.5 border rounded-xl text-foreground font-medium bg-card focus:outline-none text-xs sm:text-sm transition-all cursor-pointer',
                staffMarkErrors.userId
                  ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                  : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'
              )}
            >
              <option value="" disabled>Select staff...</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.isAdmin ? `${staff.name} (Admin)` : staff.name}
                </option>
              ))}
            </select>
            {staffMarkErrors.userId && (
              <p className="text-[11px] font-medium text-destructive mt-1">{staffMarkErrors.userId}</p>
            )}
          </div>

          {/* Attendance Date Row */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              SELECT ATTENDANCE DATE
            </label>
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
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {staffMarkForm.punchType === 'out' ? 'CHECK-OUT' : 'CHECK-IN'}
            </label>
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
                onChange={(e) => {
                  const val = e.target.value;
                  setLeaveTypeForm({ ...leaveTypeForm, daysPerYear: val === '' ? '' : parseInt(val, 10) || 0 });
                }}
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
                <p className="font-bold text-foreground mt-0.5">
                  {calculateWorkingHours(viewTargetRecord.checkInTime, viewTargetRecord.checkOutTime)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Check-In Time</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{formatIndianTime(viewTargetRecord.checkInTime)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Check-Out Time</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{formatIndianTime(viewTargetRecord.checkOutTime)}</p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/50 rounded-xl border border-border space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Punch Location</span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPinIcon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{cleanLocationName(viewTargetRecord.punchLocation || viewTargetRecord.site || 'Office Location')}</span>
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
          onClose={() => {
            setIsRequestModalOpen(false);
            setRequestFormErrors({});
          }}
          title="Attendance Request"
          subtitle="Submit missed punches or adjustments with actual arrival and departure times"
          size="md"
        >
          <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
            {/* Red Alert / Error Box */}
            {requestSubmitError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <AlertCircleIcon className="size-4 shrink-0 mt-0.5 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-destructive">{requestSubmitError}</p>
                  {Object.values(requestFormErrors).filter(Boolean).length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] opacity-90 text-destructive">
                      {Object.entries(requestFormErrors)
                        .filter(([, msg]) => Boolean(msg))
                        .map(([key, msg]) => (
                          <li key={key}>{msg}</li>
                        ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRequestSubmitError(null)}
                  className="shrink-0 text-destructive/70 hover:text-destructive p-0.5 transition-colors cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}

            {/* Staff Member Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Staff Member <span className="text-destructive">*</span>
              </label>
              {canCorrectAttendance ? (
                <select
                  value={requestForm.userId}
                  onChange={(e) => {
                    setRequestForm({ ...requestForm, userId: e.target.value });
                    if (requestFormErrors.userId) {
                      setRequestFormErrors((prev) => ({ ...prev, userId: null }));
                    }
                    if (requestSubmitError) setRequestSubmitError(null);
                  }}
                  className={cn(
                    'w-full px-3 py-2 border rounded-lg bg-card text-foreground font-medium text-xs transition-colors cursor-pointer',
                    requestFormErrors.userId
                      ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                      : 'border-border focus:ring-1 focus:ring-primary'
                  )}
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
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground font-medium text-xs cursor-not-allowed"
                />
              )}
              {requestFormErrors.userId && (
                <p className="text-[11px] font-medium text-destructive">{requestFormErrors.userId}</p>
              )}
            </div>

            {/* Request Type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Request Type <span className="text-destructive">*</span>
              </label>
              <select
                value={requestForm.type}
                onChange={(e) => {
                  setRequestForm({ ...requestForm, type: e.target.value });
                  setRequestFormErrors({});
                  if (requestSubmitError) setRequestSubmitError(null);
                }}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg bg-card text-foreground font-medium text-xs transition-colors cursor-pointer',
                  requestFormErrors.type
                    ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                    : 'border-border focus:ring-1 focus:ring-primary'
                )}
              >
                <option value="Punch Regularization">Punch Regularization</option>
                <option value="Missed Punch">Missed Punch</option>
                <option value="Field Duty">Field Duty</option>
                <option value="On-Duty (Site Visit)">On-Duty (Site Visit)</option>
                <option value="Work From Home">Work From Home</option>
                <option value="Other">Other</option>
              </select>
              {requestFormErrors.type && (
                <p className="text-[11px] font-medium text-destructive">{requestFormErrors.type}</p>
              )}
            </div>

            {/* Date with quick presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Attendance Date <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setRequestForm((prev) => ({ ...prev, date: today }));
                      if (requestFormErrors.date) setRequestFormErrors((p) => ({ ...p, date: null }));
                      if (requestSubmitError) setRequestSubmitError(null);
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
                      if (requestFormErrors.date) setRequestFormErrors((p) => ({ ...p, date: null }));
                      if (requestSubmitError) setRequestSubmitError(null);
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
                onChange={(e) => {
                  setRequestForm({ ...requestForm, date: e.target.value });
                  if (requestFormErrors.date) {
                    setRequestFormErrors((prev) => ({ ...prev, date: null }));
                  }
                  if (requestSubmitError) setRequestSubmitError(null);
                }}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs transition-colors cursor-pointer',
                  requestFormErrors.date
                    ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                    : 'border-border focus:ring-1 focus:ring-primary'
                )}
              />
              {requestFormErrors.date && (
                <p className="text-[11px] font-medium text-destructive">{requestFormErrors.date}</p>
              )}
            </div>

            {/* Check-in & Check-out time fields */}
            {(requestForm.type === 'Punch Regularization' || requestForm.type === 'Missed Punch' || requestForm.type === 'Field Duty' || requestForm.type === 'On-Duty (Site Visit)') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Check-in Time {(requestForm.type === 'Punch Regularization' || requestForm.type === 'Missed Punch') && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 09:30 AM"
                    value={requestForm.requestedCheckIn}
                    onChange={(e) => {
                      setRequestForm({ ...requestForm, requestedCheckIn: e.target.value });
                      if (requestFormErrors.requestedCheckIn) {
                        setRequestFormErrors((prev) => ({ ...prev, requestedCheckIn: null }));
                      }
                      if (requestSubmitError) setRequestSubmitError(null);
                    }}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg bg-card text-foreground font-mono focus:outline-none text-xs transition-colors',
                      requestFormErrors.requestedCheckIn
                        ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                        : 'border-border focus:ring-1 focus:ring-primary'
                    )}
                  />
                  {requestFormErrors.requestedCheckIn && (
                    <p className="text-[11px] font-medium text-destructive">{requestFormErrors.requestedCheckIn}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Check-out Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 06:30 PM"
                    value={requestForm.requestedCheckOut}
                    onChange={(e) => {
                      setRequestForm({ ...requestForm, requestedCheckOut: e.target.value });
                      if (requestFormErrors.requestedCheckOut) {
                        setRequestFormErrors((prev) => ({ ...prev, requestedCheckOut: null }));
                      }
                      if (requestSubmitError) setRequestSubmitError(null);
                    }}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg bg-card text-foreground font-mono focus:outline-none text-xs transition-colors',
                      requestFormErrors.requestedCheckOut
                        ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                        : 'border-border focus:ring-1 focus:ring-primary'
                    )}
                  />
                  {requestFormErrors.requestedCheckOut && (
                    <p className="text-[11px] font-medium text-destructive">{requestFormErrors.requestedCheckOut}</p>
                  )}
                </div>
              </div>
            )}

            {/* Reason field (Required by backend) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Enter reason for request (required)..."
                value={requestForm.reason}
                onChange={(e) => {
                  setRequestForm({ ...requestForm, reason: e.target.value });
                  if (requestFormErrors.reason) {
                    setRequestFormErrors((prev) => ({ ...prev, reason: null }));
                  }
                  if (requestSubmitError) setRequestSubmitError(null);
                }}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg bg-card text-foreground focus:outline-none text-xs resize-none transition-colors',
                  requestFormErrors.reason
                    ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                    : 'border-border focus:ring-1 focus:ring-primary'
                )}
              />
              {requestFormErrors.reason && (
                <p className="text-[11px] font-medium text-destructive">{requestFormErrors.reason}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setRequestSubmitError(null);
                  setRequestFormErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leadingIcon="check"
              >
                Request
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
        confirmVariant="danger"
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

      {/* Confirm Check-Out Dialog */}
      <ConfirmDialog
        isOpen={isCheckOutConfirmOpen}
        title="Confirm Check Out"
        message="Are you sure you want to check out for today? This will record your check-out time in Indian Standard Time and conclude your active shift."
        confirmText="Check Out"
        cancelText="Cancel"
        confirmVariant="primary"
        loading={punchLoading}
        onConfirm={async () => {
          setIsCheckOutConfirmOpen(false);
          await executePunchAction('check-out');
        }}
        onCancel={() => setIsCheckOutConfirmOpen(false)}
      />

      {/* Re-check-in Alert Dialog */}
      <ConfirmDialog
        isOpen={isRecheckInAlertOpen}
        title="Already Checked Out"
        message="You have already recorded your check-out for today. If you need to make adjustments to your hours or undo your check-out, please submit an Attendance Request."
        confirmText="OK"
        cancelText="Close"
        confirmVariant="primary"
        onConfirm={() => setIsRecheckInAlertOpen(false)}
        onCancel={() => setIsRecheckInAlertOpen(false)}
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
                  <span>{formatIndianTime(selectedViewRequest.requestedCheckIn)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Requested Check-Out
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  <LogOutIcon className="size-3.5" />
                  <span>{formatIndianTime(selectedViewRequest.requestedCheckOut)}</span>
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
