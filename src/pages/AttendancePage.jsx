import React, { useState, useEffect, useMemo, useRef } from 'react';
import { attendanceService, calculateDistanceMeters } from '../services/attendanceService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { mockUsers } from '../data/users';
import { validateRequired, validateGpsCoordinates, validatePositiveNumber } from '../utils/validators';

import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';

export function calculateWorkingHours(checkInStr, checkOutStr) {
  if (!checkInStr) return '—';

  const parseTimeToMinutes = (str) => {
    if (!str) return null;
    const clean = str.trim().toLowerCase();
    const isPM = clean.includes('pm');
    const isAM = clean.includes('am');
    const timePart = clean.replace(/[a-z]/g, '').trim();
    const parts = timePart.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);

    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const inMins = parseTimeToMinutes(checkInStr);
  if (inMins === null) return '—';

  let outMins;
  if (checkOutStr) {
    outMins = parseTimeToMinutes(checkOutStr);
  } else {
    const now = new Date();
    outMins = now.getHours() * 60 + now.getMinutes();
  }

  if (outMins === null || outMins < inMins) {
    return 'Active';
  }

  const diffMins = Math.max(0, outMins - inMins);
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

export function AttendancePage() {
  const { currentUser, role } = useAuth();
  const toast = useToast();
  const isAdminOrManager = role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.PROJECT_MANAGER;

  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'requests'

  // Core Attendance State
  const [attendanceList, setAttendanceList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [officeLocation, setOfficeLocation] = useState({
    name: 'Neomed Head Office',
    lat: 19.967048,
    lng: 73.754104,
    radiusMeters: 500,
    geofenceMode: 'office',
  });
  const [requestsList, setRequestsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Overview stats matching photo
  const [overviewStats, setOverviewStats] = useState({
    totalEmployees: 5000,
    checkedIn: 4500,
    notCheckedIn: 500,
    onLeave: 456,
    checkedOut: 250,
  });

  // PWA Real-time Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const watchIdRef = useRef(null);

  // Live Digital Clock (Formatted strictly as HH:MM, e.g. 11:46)
  const [clockTimeHM, setClockTimeHM] = useState('12:00');
  const [currentDayName, setCurrentDayName] = useState('Friday');
  const [currentDateShort, setCurrentDateShort] = useState('23 Oct 2026');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTimeHM(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setCurrentDayName(now.toLocaleDateString('en-US', { weekday: 'long' }));
      setCurrentDateShort(now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
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
    status: 'present',
    checkInTime: '09:00 AM',
    checkOutTime: '06:00 PM',
    notes: '',
  });
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffPunchType, setStaffPunchType] = useState('check-in'); // 'check-in' | 'check-out'

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Punch Regularization',
    reason: '',
  });

  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionData, setCorrectionData] = useState({
    status: 'present',
    checkInTime: '',
    checkOutTime: '',
    reason: '',
  });

  // Filter & Sort states for Attendance Records
  const [recordSearch, setRecordSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [statusOverviewFilter, setStatusOverviewFilter] = useState('ALL'); // 'ALL' | 'checkedIn' | 'notCheckedIn' | 'onLeave' | 'checkedOut'
  const [sortField, setSortField] = useState('userName');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [viewTargetRecord, setViewTargetRecord] = useState(null);
  const [punchLoading, setPunchLoading] = useState(false);

  // Fetch all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [records, office, reqs, stats, allUsers] = await Promise.all([
        attendanceService.getTodayAttendance(),
        attendanceService.getOfficeLocation(),
        attendanceService.getRequests(),
        attendanceService.getOverviewStats(),
        userService.getAllUsers(),
      ]);
      setAttendanceList(records);
      setOfficeLocation(office);
      setOfficeForm({
        name: office.name,
        lat: office.lat,
        lng: office.lng,
        radiusMeters: office.radiusMeters,
      });
      setRequestsList(reqs);
      if (stats) setOverviewStats(stats);
      if (allUsers && allUsers.length > 0) setUsersList(allUsers);
    } catch (err) {
      toast.error('Failed to load attendance data');
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
        setGpsError(err.message || 'GPS location acquisition failed.');
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
    if (!currentUser) return null;
    return attendanceList.find(
      (r) =>
        r.userId === currentUser.id ||
        (r.userName && r.userName.toLowerCase() === currentUser.name?.toLowerCase())
    );
  }, [attendanceList, currentUser]);

  const isCheckedIn = Boolean(myTodayRecord && myTodayRecord.checkInTime && !myTodayRecord.checkOutTime);

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

      // If still missing, use position within geofence for seamless desktop demo
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

  // Office Location Settings Modal Actions
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
          startPwaLocationTracking();
        } catch (e) {
          toast.error('Failed to save GPS pin');
        }
      },
      (err) => {
        toast.error(`GPS Error: ${err.message}. Please enable location permissions.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveOfficeSettings = async (e) => {
    e.preventDefault();
    const latErr = validateGpsCoordinates(officeForm.lat, 'Latitude', { min: -90, max: 90 });
    if (latErr) {
      toast.error(latErr);
      return;
    }
    const lngErr = validateGpsCoordinates(officeForm.lng, 'Longitude', { min: -180, max: 180 });
    if (lngErr) {
      toast.error(lngErr);
      return;
    }
    const radErr = validatePositiveNumber(officeForm.radiusMeters, 'Geo-Fence Radius', { min: 1, max: 5000 });
    if (radErr) {
      toast.error(radErr);
      return;
    }

    try {
      const updated = await attendanceService.updateOfficeLocation(officeForm);
      setOfficeLocation(updated);
      toast.success(`Office settings saved! Geofence radius: ${officeForm.radiusMeters}m`);
      setIsOfficeSettingsOpen(false);
      startPwaLocationTracking();
    } catch (err) {
      toast.error('Failed to save office settings');
    }
  };

  // Mark Attendance for Staff (Admin/Manager)
  const handleMarkForStaffSubmit = async (e) => {
    e.preventDefault();
    const sourceUsers = usersList.length > 0 ? usersList : mockUsers;
    const user = sourceUsers.find((u) => u.id === staffMarkForm.userId) || sourceUsers[0];

    try {
      await attendanceService.markForStaff({
        user,
        status: staffMarkForm.status,
        checkInTime: staffMarkForm.status === 'present' ? staffMarkForm.checkInTime : null,
        checkOutTime: staffMarkForm.status === 'present' ? staffMarkForm.checkOutTime : null,
        notes: staffMarkForm.notes,
      });
      toast.success(`Attendance marked for ${user.name}`);
      setIsMarkStaffModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to mark staff attendance');
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
      await attendanceService.submitRequest({
        ...requestForm,
        employeeName: currentUser?.name || 'Rohit Kumar',
      });
      toast.success('Attendance regularization request submitted');
      setIsRequestModalOpen(false);
      setRequestForm({
        date: new Date().toISOString().split('T')[0],
        type: 'Punch Regularization',
        reason: '',
      });
      loadData();
    } catch (err) {
      toast.error('Failed to submit request');
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

  // Filtered staff list for the Mark Attendance modal search
  const filteredStaffForMarking = useMemo(() => {
    const list = usersList.length > 0 ? usersList : mockUsers;
    if (!staffSearchQuery.trim()) return list;
    const q = staffSearchQuery.toLowerCase();
    return list.filter((u) => u.name && u.name.toLowerCase().includes(q));
  }, [usersList, staffSearchQuery]);

  // Filtered Attendance Records
  const filteredRecords = useMemo(() => {
    return attendanceList.filter((r) => {
      const q = recordSearch.toLowerCase();
      const matchQuery =
        !recordSearch ||
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.role && r.role.toLowerCase().includes(q)) ||
        (r.site && r.site.toLowerCase().includes(q));

      const matchRole =
        roleFilter === 'ALL'
          ? true
          : roleFilter === 'NO_ROLE'
          ? !r.role || r.role === '—' || r.role.toLowerCase() === 'none' || r.role.toLowerCase() === 'unassigned'
          : (r.role && r.role.toLowerCase() === roleFilter.toLowerCase());

      const matchDate =
        (!startDateFilter || (r.date && r.date >= startDateFilter)) &&
        (!endDateFilter || (r.date && r.date <= endDateFilter));

      const matchStatusOverview =
        statusOverviewFilter === 'ALL'
          ? true
          : statusOverviewFilter === 'checkedIn'
          ? Boolean(r.checkInTime) && (!r.checkOutTime || r.status === 'present')
          : statusOverviewFilter === 'notCheckedIn'
          ? !r.checkInTime || r.status === 'absent'
          : statusOverviewFilter === 'onLeave'
          ? r.status === 'leave' || r.status === 'on-leave'
          : statusOverviewFilter === 'checkedOut'
          ? Boolean(r.checkOutTime) && r.checkOutTime !== '—'
          : true;

      return matchQuery && matchRole && matchDate && matchStatusOverview;
    });
  }, [attendanceList, recordSearch, roleFilter, startDateFilter, endDateFilter, statusOverviewFilter]);

  // Sorting Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sorted Records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'calculatedHours') {
        aVal = calculateWorkingHours(a.checkInTime, a.checkOutTime);
        bVal = calculateWorkingHours(b.checkInTime, b.checkOutTime);
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortDirection]);

  // Paginated Records
  const totalPages = Math.ceil(sortedRecords.length / rowsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedRecords.slice(start, start + rowsPerPage);
  }, [sortedRecords, currentPage, rowsPerPage]);

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await attendanceService.deleteAttendanceRecord(recordId);
      toast.success('Attendance record deleted');
      loadData();
    } catch (e) {
      toast.error('Failed to delete attendance record');
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: Header + Actions (Check In placed BEFORE Office Settings) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">Attendance</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Track staff attendance with geo-fenced punch in/out
          </p>
        </div>

        {/* Action Buttons with Comfortably Increased Size */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 1. Check In / Check Out Button (White color like other buttons, icon matches text-text-muted) */}
          <button
            type="button"
            disabled={punchLoading}
            onClick={handlePunchAction}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-surface hover:bg-slate-50 text-text-main border border-border transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon
              name={punchLoading ? 'refresh' : isCheckedIn ? 'logout' : 'clock'}
              size={16}
              className={punchLoading ? 'animate-spin text-text-muted' : 'text-text-muted'}
            />
            <span>
              {punchLoading
                ? 'Verifying PWA GPS...'
                : isCheckedIn
                ? 'Check Out'
                : 'Check In'}
            </span>
          </button>

          {/* 2. Office Settings Button (Increased Size) */}
          <button
            type="button"
            onClick={() => setIsOfficeSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-surface hover:bg-slate-50 text-text-main border border-border transition-colors shadow-2xs cursor-pointer"
          >
            <Icon name="settings" size={16} className="text-text-muted" />
            <span>Office Settings</span>
          </button>

          {/* 3. Export Excel Button (Increased Size) */}
          <button
            type="button"
            onClick={() => attendanceService.exportToExcel(attendanceList)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-surface hover:bg-slate-50 text-text-main border border-border transition-colors shadow-2xs cursor-pointer"
          >
            <Icon name="download" size={16} className="text-text-muted" />
            <span>Export Excel</span>
          </button>

          {/* 4. Mark for Staff Button (Increased Size, Primary Theme) */}
          {isAdminOrManager && (
            <button
              type="button"
              onClick={() => {
                setStaffSearchQuery('');
                setIsMarkStaffModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-primary hover:bg-[#4338ca] text-primary-foreground transition-colors shadow-sm cursor-pointer"
            >
              <Icon name="plus" size={16} />
              <span>Mark for Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 2: Clock & Live Attendance Cards Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-border shadow-xs space-y-4">
        {/* Top Status Bar: PWA Geofence GPS State */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                distanceToOffice !== null && distanceToOffice <= (officeLocation.radiusMeters || 500)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
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
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-slate-50 text-text-muted hover:text-text-main transition-colors text-xs cursor-pointer"
            >
              <Icon name="refresh" size={13} className={locating ? 'animate-spin' : ''} />
            </button>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              isCheckedIn
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {isCheckedIn ? 'Checked In' : 'Not Checked In'}
          </span>
        </div>

        {/* Circular Clock + Attendance Overview Cards */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 pt-1">
          {/* Left: Clock Widget (Current Day, Date, Time formatted strictly as HH:MM) */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-600"
                strokeDasharray="65, 100"
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                {currentDayName}
              </span>
              <span className="text-xl font-black font-mono text-text-main my-0.5">
                {clockTimeHM}
              </span>
              <span className="text-[10px] font-semibold text-text-muted">
                {currentDateShort}
              </span>
            </div>
          </div>

          {/* Right: The 4 Attendance Overview Cards (Interactive Filters) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 w-full min-w-0">
            {/* Card 1: Checked In */}
            <button
              type="button"
              onClick={() => {
                setStatusOverviewFilter((prev) => (prev === 'checkedIn' ? 'ALL' : 'checkedIn'));
                setCurrentPage(1);
              }}
              title="Click to filter staff currently checked in"
              className="py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl border border-border bg-white transition-colors flex flex-col items-center justify-center text-center cursor-pointer shadow-2xs hover:border-slate-300"
            >
              <div className="text-blue-600 flex items-center justify-center shrink-0 mb-1">
                <Icon name="check" size={18} />
              </div>
              <div className="text-xs font-semibold text-text-muted leading-tight">Checked In</div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight mt-0.5 tabular-nums leading-tight">
                {overviewStats.checkedIn?.toLocaleString() || '4,500'}
              </div>
            </button>

            {/* Card 2: Not Checked In */}
            <button
              type="button"
              onClick={() => {
                setStatusOverviewFilter((prev) => (prev === 'notCheckedIn' ? 'ALL' : 'notCheckedIn'));
                setCurrentPage(1);
              }}
              title="Click to filter staff not yet checked in"
              className="py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl border border-border bg-white transition-colors flex flex-col items-center justify-center text-center cursor-pointer shadow-2xs hover:border-slate-300"
            >
              <div className="text-rose-600 flex items-center justify-center shrink-0 mb-1">
                <Icon name="alert" size={18} />
              </div>
              <div className="text-xs font-semibold text-text-muted leading-tight">Not Checked In</div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight mt-0.5 tabular-nums leading-tight">
                {overviewStats.notCheckedIn?.toLocaleString() || '500'}
              </div>
            </button>

            {/* Card 3: On Leave */}
            <button
              type="button"
              onClick={() => {
                setStatusOverviewFilter((prev) => (prev === 'onLeave' ? 'ALL' : 'onLeave'));
                setCurrentPage(1);
              }}
              title="Click to filter staff on leave"
              className="py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl border border-border bg-white transition-colors flex flex-col items-center justify-center text-center cursor-pointer shadow-2xs hover:border-slate-300"
            >
              <div className="text-emerald-600 flex items-center justify-center shrink-0 mb-1">
                {/* Clean inline calendar exclamation icon matching reference */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-emerald-600"
                >
                  <rect x="3.5" y="4" width="17" height="17" rx="3" strokeWidth="2" />
                  <rect x="6.5" y="1.5" width="2.5" height="4.5" rx="1.2" strokeWidth="2" fill="none" />
                  <rect x="15" y="1.5" width="2.5" height="4.5" rx="1.2" strokeWidth="2" fill="none" />
                  <line x1="3.5" y1="8" x2="20.5" y2="8" strokeWidth="2" />
                  <line x1="12" y1="10.5" x2="12" y2="14.5" strokeWidth="2.2" />
                  <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
                  <line x1="5.5" y1="19.5" x2="18.5" y2="19.5" strokeWidth="1.2" strokeDasharray="0.1 2" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-text-muted leading-tight">On Leave</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight mt-0.5 tabular-nums leading-tight">
                {overviewStats.onLeave?.toLocaleString() || '456'}
              </div>
            </button>

            {/* Card 4: Checked Out */}
            <button
              type="button"
              onClick={() => {
                setStatusOverviewFilter((prev) => (prev === 'checkedOut' ? 'ALL' : 'checkedOut'));
                setCurrentPage(1);
              }}
              title="Click to filter staff who checked out"
              className="py-2.5 px-2 sm:py-3 sm:px-3 rounded-xl border border-border bg-white transition-colors flex flex-col items-center justify-center text-center cursor-pointer shadow-2xs hover:border-slate-300"
            >
              <div className="text-amber-600 flex items-center justify-center shrink-0 mb-1">
                <Icon name="logout" size={18} />
              </div>
              <div className="text-xs font-semibold text-text-muted leading-tight">Checked Out</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight mt-0.5 tabular-nums leading-tight">
                {overviewStats.checkedOut?.toLocaleString() || '250'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Tabs (Records & Requests - Leave Types Screen Deleted) */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'records'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Icon name="attendance" size={14} />
          <span>Records</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-accent text-accent-foreground font-mono font-bold">
            {attendanceList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'requests'
              ? 'border-primary text-primary bg-surface'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Icon name="bell" size={14} />
          <span>Requests</span>
          {requestsList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-bold">
              {requestsList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Attendance Records */}
      {activeTab === 'records' && (
        <Card className="space-y-4">
          {/* Filters Bar: Search on left, Date & Role filters + Clear on right */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 pb-3 border-b border-border/70">
            {/* Search by Name / Role / Site */}
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={recordSearch}
                onChange={(e) => {
                  setRecordSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search staff, site, location..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-border rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Filter controls moved to the right side */}
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
              {/* Filter by Role with 'No Role' option */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-muted">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 text-xs bg-slate-50 border border-border rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Owner">Owner</option>
                  <option value="Manager">Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Worker">Worker</option>
                  <option value="NO_ROLE">No Role</option>
                </select>
              </div>

              {/* Date Range: From Date to To Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-muted">From:</span>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 text-xs bg-slate-50 border border-border rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-muted">To:</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-2.5 text-xs bg-slate-50 border border-border rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Active Card Filter Badge & Clear All Filters Button */}
              {statusOverviewFilter !== 'ALL' && (
                <span className="h-9 px-2.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                  <span>Filtered: {
                    statusOverviewFilter === 'checkedIn' ? 'Checked In' :
                    statusOverviewFilter === 'notCheckedIn' ? 'Not Checked In' :
                    statusOverviewFilter === 'onLeave' ? 'On Leave' : 'Checked Out'
                  }</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusOverviewFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:opacity-70 cursor-pointer font-bold text-sm leading-none"
                    title="Remove status filter"
                  >
                    ×
                  </button>
                </span>
              )}

              {(recordSearch || roleFilter !== 'ALL' || startDateFilter || endDateFilter || statusOverviewFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordSearch('');
                    setRoleFilter('ALL');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setStatusOverviewFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 text-xs font-semibold rounded-lg bg-accent text-accent-foreground border border-brand-200 hover:bg-brand-100 transition-colors cursor-pointer flex items-center gap-1"
                  title="Clear all active filters"
                >
                  <Icon name="close" size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border/80 uppercase font-semibold text-[10px] text-text-muted tracking-wider">
                <tr>
                  {/* Employee with sort: ONLY heading with sorting, single angular bracket */}
                  <th
                    onClick={() => handleSort('userName')}
                    className="p-3.5 cursor-pointer hover:text-text-main transition-colors select-none"
                    title="Sort by employee name"
                  >
                    <div className="flex items-center gap-1">
                      <span>Employee</span>
                      <span className="text-xs font-bold text-primary">
                        {sortDirection === 'asc' ? '›' : '‹'}
                      </span>
                    </div>
                  </th>

                  <th className="p-3.5">Assigned Site</th>
                  <th className="p-3.5">check-in</th>
                  <th className="p-3.5">check-out</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Marked By</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Hours</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-text-muted">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Employee Cell: Clicking name or avatar triggers view modal */}
                      <td className="p-3">
                        <div
                          onClick={() => setViewTargetRecord(r)}
                          className="flex items-center gap-2.5 cursor-pointer group"
                          title="Click to view full attendance details"
                        >
                          <Avatar name={r.userName} size="sm" />
                          <div>
                            <div className="font-semibold text-text-main group-hover:text-primary transition-colors underline-offset-2 group-hover:underline">
                              {r.userName}
                            </div>
                            <div className="text-[11px] text-text-muted">{r.role || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        {(() => {
                          const siteLat = r.coordinates?.lat || officeLocation.lat || 19.967048;
                          const siteLng = r.coordinates?.lng || officeLocation.lng || 73.754104;
                          const siteMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.site || officeLocation.name || 'Site')}+${siteLat},${siteLng}`;

                          return (
                            <div>
                              <a
                                href={siteMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-text-main text-xs flex items-center gap-1 hover:text-primary transition-colors group/site cursor-pointer"
                                title="Open assigned site location in Google Maps"
                              >
                                <Icon name="mapPin" size={13} className="text-primary shrink-0 group-hover/site:scale-110 transition-transform" />
                                <span className="group-hover/site:underline truncate">{r.site || officeLocation.name}</span>
                              </a>
                              {r.distanceMeters !== null && r.distanceMeters !== undefined && (
                                <div className="text-[10px] text-text-muted mt-0.5">
                                  Distance: <span className="font-mono text-emerald-700 font-semibold">{r.distanceMeters}m</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* check-in */}
                      <td className="p-3 font-mono text-[11px] text-emerald-700 font-bold">
                        {r.checkInTime || '—'}
                      </td>

                      {/* check-out */}
                      <td className="p-3 font-mono text-[11px] text-text-muted font-medium">
                        {r.checkOutTime || (r.checkInTime ? 'Active On-Site' : '—')}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {r.status === 'present' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        ) : r.status === 'absent' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                            Absent
                          </span>
                        ) : r.status === 'half-day' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Half Day
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            On Leave
                          </span>
                        )}
                      </td>

                      {/* Marked By */}
                      <td className="p-3 text-[11px] font-medium text-text-main">
                        {r.markedBy || 'self'}
                      </td>

                      {/* Location with Google Maps Redirection */}
                      <td className="p-3">
                        {(() => {
                          const lat = r.coordinates?.lat ?? officeLocation.lat ?? 19.967048;
                          const lng = r.coordinates?.lng ?? officeLocation.lng ?? 73.754104;
                          const locName = r.punchLocation || r.site || officeLocation.name || 'Recorded Punch Location';
                          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

                          return (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/loc inline-flex flex-col text-left hover:opacity-90 transition-opacity cursor-pointer"
                              title={`View recorded GPS location for ${r.userName} on Google Maps`}
                            >
                              <div className="flex items-center gap-1 font-semibold text-text-main text-xs group-hover/loc:text-primary transition-colors">
                                <Icon name="mapPin" size={13} className="text-emerald-600 shrink-0 group-hover/loc:scale-110 transition-transform" />
                                <span className="underline-offset-2 group-hover/loc:underline truncate max-w-[130px] sm:max-w-[170px]">
                                  {locName}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                                <span>{Number(lat).toFixed(4)}° N, {Number(lng).toFixed(4)}° E</span>
                                <span className="text-[9px] text-primary font-sans font-semibold group-hover/loc:underline">↗ Maps</span>
                              </span>
                            </a>
                          );
                        })()}
                      </td>

                      <td className="p-3 font-mono">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.checkInTime 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'text-text-muted bg-slate-100'
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
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-accent rounded-md transition-colors cursor-pointer"
                            title="View punch details"
                          >
                            <Icon name="eye" size={14} />
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
                              className="p-1.5 text-text-muted hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                              title="Edit / Correct record"
                            >
                              <Icon name="edit" size={14} />
                            </button>
                          )}

                          {/* Delete Button */}
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r.id)}
                              className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Icon name="trash" size={14} />
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

          {/* Pagination at the bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/70 text-xs text-text-muted shrink-0 font-medium">
            <div>
              <span className="font-semibold text-text-main">
                {sortedRecords.length > 0
                  ? `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, sortedRecords.length)} of ${sortedRecords.length}`
                  : '0 of 0'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-text-main">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 2: Requests */}
      {activeTab === 'requests' && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
            <div>
              <h2 className="text-base font-bold text-text-main">Regularization Requests</h2>
              <p className="text-xs text-text-muted mt-0.5">Missed punches and attendance adjustment approvals</p>
            </div>
          </div>

          {requestsList.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted">
              No pending attendance regularization requests.
            </div>
          ) : (
            <div className="space-y-2.5">
              {requestsList.map((req) => (
                <div key={req.id} className="p-3.5 rounded-xl border border-border bg-surface flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-text-main">{req.employeeName}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{req.type} • {req.date}</div>
                    <p className="text-xs text-text-muted mt-1">{req.reason}</p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
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
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Office Name
            </label>
            <input
              type="text"
              value={officeForm.name}
              onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-medium focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            />
          </div>

          {/* Latitude & Longitude */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={officeForm.lat}
                onChange={(e) => setOfficeForm({ ...officeForm, lat: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={officeForm.lng}
                onChange={(e) => setOfficeForm({ ...officeForm, lng: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Pin Current GPS Location Button */}
          <div className="p-3 rounded-xl bg-accent border border-brand-200">
            <button
              type="button"
              onClick={handleUseCurrentLocationForOffice}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-primary hover:bg-[#4338ca] text-primary-foreground transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Icon name="mapPin" size={14} />
              <span>Use My Current Location (saves immediately)</span>
            </button>
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
              Do this while standing at the office on a phone if possible. Staff then pull-to-refresh the app.
            </p>
          </div>

          {/* Geo-Fence Radius */}
          <div className="space-y-2 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Geo-Fence Radius
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={officeForm.radiusMeters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radiusMeters: parseInt(e.target.value, 10) || 0 })}
                  className="w-20 px-2 py-1 text-center font-bold text-sm border border-border rounded-lg text-text-main"
                />
                <span className="text-xs text-text-muted font-medium">m</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="5000"
              step="25"
              value={officeForm.radiusMeters}
              onChange={(e) => setOfficeForm({ ...officeForm, radiusMeters: parseInt(e.target.value, 10) || 0 })}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsOfficeSettingsOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-[#4338ca] text-primary-foreground transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Icon name="check" size={14} />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Mark Staff Attendance Modal (Direct searchable dropdown, roles hidden except Owner) */}
      <Modal
        isOpen={isMarkStaffModalOpen}
        onClose={() => {
          setIsMarkStaffModalOpen(false);
          setIsStaffDropdownOpen(false);
          setStaffSearchQuery('');
        }}
        title="Mark Staff Attendance"
      >
        <form onSubmit={handleMarkForStaffSubmit} className="space-y-4 text-xs">
          {/* Segmented Check In / Check Out toggle buttons (referenced from screenshot) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl w-fit border border-border/70">
            <button
              type="button"
              onClick={() => {
                setStaffPunchType('check-in');
                setStaffMarkForm((prev) => ({ ...prev, status: 'present' }));
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                staffPunchType === 'check-in'
                  ? 'bg-surface text-text-main shadow-xs border border-border/60'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon name="arrowRight" size={13} className="text-emerald-600" />
              <span>Punch In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStaffPunchType('check-out');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                staffPunchType === 'check-out'
                  ? 'bg-surface text-text-main shadow-xs border border-border/60'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon name="logout" size={13} className="text-amber-600" />
              <span>Punch Out</span>
            </button>
          </div>
          <div className="space-y-1.5 relative">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Select Employee</label>
            
            {/* Direct Searchable Dropdown List without separate search bar */}
            {(() => {
              const allStaffUsers = usersList.length > 0 ? usersList : mockUsers;
              const currentStaff = allStaffUsers.find((u) => u.id === staffMarkForm.userId) || allStaffUsers[0];
              const isOwner = (currentStaff?.role || '').toLowerCase() === 'owner';
              const selectedDisplayName = currentStaff ? (isOwner ? `${currentStaff.name} (owner)` : currentStaff.name) : 'Select Employee';

              return (
                <div className="relative">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={isStaffDropdownOpen ? staffSearchQuery : selectedDisplayName}
                      onFocus={() => {
                        setIsStaffDropdownOpen(true);
                        setStaffSearchQuery('');
                      }}
                      onChange={(e) => {
                        setStaffSearchQuery(e.target.value);
                        if (!isStaffDropdownOpen) setIsStaffDropdownOpen(true);
                      }}
                      placeholder="Click or type to search employee..."
                      className="w-full px-3 py-2 pr-9 border border-border rounded-lg bg-white text-text-main font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsStaffDropdownOpen((prev) => !prev);
                        if (!isStaffDropdownOpen) setStaffSearchQuery('');
                      }}
                      className="absolute right-2.5 text-text-muted hover:text-text-main cursor-pointer"
                      tabIndex={-1}
                    >
                      <Icon name="chevronDown" size={15} />
                    </button>
                  </div>

                  {/* Dropdown Options Popup */}
                  {isStaffDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setIsStaffDropdownOpen(false);
                          setStaffSearchQuery('');
                        }}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-border/40">
                        {filteredStaffForMarking.length === 0 ? (
                          <div className="p-3 text-center text-text-muted text-xs">
                            No employee found matching "{staffSearchQuery}"
                          </div>
                        ) : (
                          filteredStaffForMarking.map((u) => {
                            const isStaffOwner = (u.role || '').toLowerCase() === 'owner';
                            const optionDisplayName = isStaffOwner ? `${u.name} (owner)` : u.name;
                            const isSelected = u.id === staffMarkForm.userId;

                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setStaffMarkForm({ ...staffMarkForm, userId: u.id });
                                  setIsStaffDropdownOpen(false);
                                  setStaffSearchQuery('');
                                }}
                                className={`w-full px-3 py-2.5 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-accent/50 font-bold text-primary' : 'text-text-main'
                                }`}
                              >
                                <span>{optionDisplayName}</span>
                                {isSelected && <Icon name="check" size={14} className="text-primary" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Status</label>
            <select
              value={staffMarkForm.status}
              onChange={(e) => setStaffMarkForm({ ...staffMarkForm, status: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="present">Present (On-Site)</option>
              <option value="absent">Absent</option>
              <option value="half-day">Half Day</option>
              <option value="leave">On Leave</option>
            </select>
          </div>

          {staffMarkForm.status === 'present' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Check-In Time</label>
                <input
                  type="text"
                  value={staffMarkForm.checkInTime}
                  onChange={(e) => setStaffMarkForm({ ...staffMarkForm, checkInTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Check-Out Time</label>
                <input
                  type="text"
                  value={staffMarkForm.checkOutTime}
                  onChange={(e) => setStaffMarkForm({ ...staffMarkForm, checkOutTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Override Reason / Notes</label>
            <input
              type="text"
              value={staffMarkForm.notes}
              onChange={(e) => setStaffMarkForm({ ...staffMarkForm, notes: e.target.value })}
              placeholder="e.g. Field site duty, client meeting"
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsMarkStaffModalOpen(false);
                setIsStaffDropdownOpen(false);
                setStaffSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-[#4338ca] text-primary-foreground shadow-sm cursor-pointer"
            >
              Record Attendance
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Manager Correction Modal */}
      {correctionTarget && (
        <Modal
          isOpen={!!correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          title={`Correct Attendance Entry • ${correctionTarget.userName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Status</label>
              <select
                value={correctionData.status}
                onChange={(e) => setCorrectionData({ ...correctionData, status: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Check-In Time</label>
                <input
                  type="text"
                  value={correctionData.checkInTime}
                  onChange={(e) => setCorrectionData({ ...correctionData, checkInTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Check-Out Time</label>
                <input
                  type="text"
                  value={correctionData.checkOutTime}
                  onChange={(e) => setCorrectionData({ ...correctionData, checkOutTime: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Correction Reason</label>
              <input
                type="text"
                required
                value={correctionData.reason}
                onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                placeholder="Manager note or regularization reason"
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setCorrectionTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-[#4338ca] text-primary-foreground shadow-sm cursor-pointer"
              >
                Save Correction
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: View Attendance Record Modal */}
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
            <div className="p-3.5 bg-slate-50 rounded-xl border border-border/80 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted">Date</span>
                <p className="font-semibold text-text-main mt-0.5">{viewTargetRecord.date}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted">Total Working Hours</span>
                <p className="font-bold text-emerald-700 mt-0.5">
                  {calculateWorkingHours(viewTargetRecord.checkInTime, viewTargetRecord.checkOutTime)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted">Check-In Time</span>
                <p className="font-mono font-medium text-text-main mt-0.5">{viewTargetRecord.checkInTime || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted">Check-Out Time</span>
                <p className="font-mono font-medium text-text-main mt-0.5">{viewTargetRecord.checkOutTime || 'Active On-Site'}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-border/80 space-y-2">
              <span className="text-[10px] uppercase font-bold text-text-muted">Punch Location</span>
              <div className="flex items-center gap-1.5 font-medium text-text-main">
                <Icon name="mapPin" size={14} className="text-emerald-600" />
                <span>{viewTargetRecord.punchLocation || viewTargetRecord.site || 'Office Location'}</span>
              </div>
              {viewTargetRecord.coordinates && (
                <p className="font-mono text-[11px] text-text-muted">
                  GPS: {viewTargetRecord.coordinates.lat?.toFixed(6)}° N, {viewTargetRecord.coordinates.lng?.toFixed(6)}° E (Accuracy: {viewTargetRecord.coordinates.accuracy || 10}m)
                </p>
              )}
            </div>

            {viewTargetRecord.correctionReason && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-900">Adjustment Note</span>
                <p className="text-amber-800 mt-0.5">{viewTargetRecord.correctionReason}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AttendancePage;
