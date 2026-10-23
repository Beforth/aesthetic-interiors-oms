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

// Attendance Records matching User Screenshots & Flows:
export const mockTodayAttendance = [
  {
    id: 'att-1',
    userId: 'u1',
    userName: 'Rohit Kumar',
    role: 'Owner',
    siteId: 'OFFICE_NEOMED',
    site: 'BeForth Nashik',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '11:59',
    checkOutTime: null,
    status: 'present',
    verified: true,
    coordinates: { lat: 19.9910, lng: 73.7601 },
    distanceMeters: 16,
    withinGeofence: true,
    markedBy: 'self',
    punchLocation: 'BeForth Nashik',
  },
  {
    id: 'att-2',
    userId: 'u2',
    userName: 'Neha Kulkarni',
    role: 'Manager',
    siteId: 'OFFICE_NEOMED',
    site: 'BeForth Nashik',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '10:00 AM',
    checkOutTime: '12:00 PM',
    status: 'present',
    verified: true,
    coordinates: { lat: 19.9910, lng: 73.7603 },
    distanceMeters: 0,
    withinGeofence: true,
    markedBy: 'self',
    punchLocation: 'BeForth Nashik',
  },
  {
    id: 'att-3',
    userId: 'u3',
    userName: 'Amit Sharma',
    role: 'Supervisor',
    siteId: 'P1',
    site: 'Indiranagar 4BHK Villa',
    date: new Date().toISOString().split('T')[0],
    checkInTime: null,
    checkOutTime: null,
    status: 'absent',
    verified: false,
    coordinates: { lat: 12.9716, lng: 77.5946 },
    distanceMeters: null,
    withinGeofence: false,
    markedBy: 'self',
    punchLocation: 'Indiranagar Site',
  },
  {
    id: 'att-4',
    userId: 'u4',
    userName: 'Priya Deshmukh',
    role: 'Worker',
    siteId: 'P2',
    site: 'HSR Layout Contemporary',
    date: new Date().toISOString().split('T')[0],
    checkInTime: null,
    checkOutTime: null,
    status: 'leave',
    verified: true,
    coordinates: { lat: 12.9121, lng: 77.6446 },
    distanceMeters: null,
    withinGeofence: false,
    markedBy: 'Admin',
    punchLocation: 'HSR Site',
  },
];

// Leave Types
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

export const mockAttendanceRequests = [];

// Company-wide Attendance Overview Statistics
export const mockAttendanceOverviewStats = {
  totalEmployees: 5000,
  checkedIn: 4500,
  notCheckedIn: 500,
  onLeave: 456,
  weeklyOff: 145,
  holiday: 12,
  checkedOut: 250,
};

export const mockShiftStatus = {
  shiftTime: '09:00 AM - 06:00 PM',
  shiftDuration: '9h 0m ( 1h Break )',
  shiftStart: '9:00 AM',
  monthlyRate: 94.5,
  monthlyPresentDays: 22,
};
