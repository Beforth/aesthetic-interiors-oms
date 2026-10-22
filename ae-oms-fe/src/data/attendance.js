/**
 * Aesthetic Interiors OMS - Attendance & HRMS Geofence Data
 * Configured according to the HRMS Attendance & Office Location specifications.
 */

export const mockOfficeLocation = {
  id: 'OFFICE_NEOMED',
  name: 'Neomed Head Office',
  address: 'Neomed Head Office, Main Ave',
  lat: 19.967048,
  lng: 73.754104,
  radiusMeters: 500,
  geofenceMode: 'office', // 'office' | 'anywhere'
};

export const mockGeofenceSites = [
  {
    id: 'OFFICE_NEOMED',
    name: 'Neomed Head Office',
    address: 'Neomed Head Office, Main Ave',
    lat: 19.967048,
    lng: 73.754104,
    radiusMeters: 500,
    type: 'office',
  },
  {
    id: 'P1',
    name: 'Indiranagar 4BHK Luxury Villa',
    address: 'Plot 42, 12th Main, HAL 2nd Stage, Indiranagar, Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
    radiusMeters: 150,
    type: 'site',
  },
  {
    id: 'P2',
    name: 'HSR Layout Contemporary 3BHK',
    address: 'B-304, Prestige Ferns, Sector 2, HSR Layout, Bengaluru',
    lat: 12.9121,
    lng: 77.6446,
    radiusMeters: 150,
    type: 'site',
  },
];

// Initial Attendance Records matching Screenshot 1: Total Staff: 1, Present Today: 0, Absent Today: 1
export const mockTodayAttendance = [
  {
    id: 'att-1',
    userId: 'u1',
    userName: 'Rohit Kumar',
    role: 'Owner',
    siteId: 'OFFICE_NEOMED',
    site: 'Neomed Head Office',
    date: new Date().toISOString().split('T')[0],
    checkInTime: null,
    checkOutTime: null,
    status: 'absent',
    verified: false,
    coordinates: null,
    distanceMeters: null,
    withinGeofence: false,
    correctionReason: null,
  },
];

// Leave Types from Screenshot 2
export const mockLeaveTypes = [
  {
    id: 'lt-1',
    name: 'Leave Without Pay',
    daysPerYear: 36,
    carryForward: 'No',
    description: '—',
    status: 'Active',
  },
  {
    id: 'lt-2',
    name: 'Medical Leave',
    daysPerYear: 12,
    carryForward: 'No',
    description: '—',
    status: 'Active',
  },
  {
    id: 'lt-3',
    name: 'Privileged Leave',
    daysPerYear: 10,
    carryForward: 'No',
    description: '—',
    status: 'Active',
  },
];

// Empty attendance regularization requests matching Screenshot 1
export const mockAttendanceRequests = [];

// Company-wide Attendance Overview Statistics from Screenshot 5
export const mockAttendanceOverviewStats = {
  totalEmployees: 5000,
  checkedIn: 4500,
  notCheckedIn: 500,
  onLeave: 456,
  weeklyOff: 145,
  holiday: 12,
  checkedOut: 250,
};

// Shift and Personal Attendance metrics from Screenshot 4
export const mockShiftStatus = {
  shiftTime: '09:00 AM - 06:00 PM',
  shiftDuration: '9h 0m ( 1h Break )',
  shiftStart: '9:00 AM',
  monthlyRate: 94.5,
  monthlyPresentDays: 22,
  monthlyTotalDays: 23,
  todayHoursWorked: '08h 28m',
  todayTargetHours: '9h 00m',
  todayWorkPercentage: 93,
  remainingLeaveDays: 12,
  totalLeaveDays: 20,
  leavePercentage: 60,
};

export const mockAttendance = mockTodayAttendance;
export default mockTodayAttendance;
