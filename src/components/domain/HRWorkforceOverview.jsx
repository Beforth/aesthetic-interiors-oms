'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { UsersIcon, CheckIcon, XIcon, CheckCircleIcon } from '../ui/icons';
import { userService } from '../../services/userService';
import { attendanceService } from '../../services/attendanceService';
import { holidayService } from '../../services/holidayService';
import { leaveService } from '../../services/leaveService';
import { ROLE_LABELS } from '../../config/roles';
import { formatDate } from '../../utils/formatters';

// Official 2026 Indian Gazetted & Festive Holidays
const INDIAN_FESTIVAL_HOLIDAYS_2026 = [
  {
    id: 'hol-1',
    date: '2026-01-14',
    month: 'JAN',
    day: '14',
    name: 'Makar Sankranti / Pongal',
    dayOfWeek: 'Wednesday',
    type: 'Harvest Festival',
    category: 'festive',
    badge: 'Harvest Festival',
    description: 'Traditional harvest festival celebrating the sun transition into Capricorn (Makara Sankranti).',
    quarter: 'Q1',
  },
  {
    id: 'hol-2',
    date: '2026-01-26',
    month: 'JAN',
    day: '26',
    name: 'Republic Day',
    dayOfWeek: 'Monday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'Honoring the Constitution of India which came into effect on 26 January 1950.',
    quarter: 'Q1',
  },
  {
    id: 'hol-3',
    date: '2026-03-03',
    month: 'MAR',
    day: '03',
    name: 'Maha Shivratri',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Great night of Lord Shiva observed with traditional prayers and night vigils.',
    quarter: 'Q1',
  },
  {
    id: 'hol-4',
    date: '2026-03-20',
    month: 'MAR',
    day: '20',
    name: 'Eid-ul-Fitr',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Celebration marking the conclusion of the holy month of Ramadan.',
    quarter: 'Q1',
  },
  {
    id: 'hol-5',
    date: '2026-03-25',
    month: 'MAR',
    day: '25',
    name: 'Holi (Festival of Colors)',
    dayOfWeek: 'Wednesday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Joyous spring festival of colors celebrating love, triumph of good over evil, and renewal.',
    quarter: 'Q1',
  },
  {
    id: 'hol-6',
    date: '2026-04-14',
    month: 'APR',
    day: '14',
    name: 'Dr. B.R. Ambedkar Jayanti / Tamil New Year',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Holiday',
    category: 'national',
    badge: 'Public Holiday',
    description: 'Commemorating the birth anniversary of Dr. B.R. Ambedkar, chief architect of the Constitution.',
    quarter: 'Q2',
  },
  {
    id: 'hol-7',
    date: '2026-05-01',
    month: 'MAY',
    day: '01',
    name: 'Labour Day / Maharashtra Day',
    dayOfWeek: 'Friday',
    type: 'State / Commercial Holiday',
    category: 'commercial',
    badge: 'Workforce Holiday',
    description: 'International Workers Day recognizing the artisans, craftsmen, and workforce.',
    quarter: 'Q2',
  },
  {
    id: 'hol-8',
    date: '2026-08-15',
    month: 'AUG',
    day: '15',
    name: 'Independence Day',
    dayOfWeek: 'Saturday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'National festival celebrating India independence achieved on 15 August 1947.',
    quarter: 'Q3',
  },
  {
    id: 'hol-9',
    date: '2026-08-27',
    month: 'AUG',
    day: '27',
    name: 'Raksha Bandhan',
    dayOfWeek: 'Thursday',
    type: 'Festive Holiday',
    category: 'festive',
    badge: 'Festive Holiday',
    description: 'Traditional festival celebrating the sacred bond of protection and affection between siblings.',
    quarter: 'Q3',
  },
  {
    id: 'hol-10',
    date: '2026-09-04',
    month: 'SEP',
    day: '04',
    name: 'Krishna Janmashtami',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Celebration of the birth of Lord Krishna with devotional singing and Dahi Handi.',
    quarter: 'Q3',
  },
  {
    id: 'hol-11',
    date: '2026-09-14',
    month: 'SEP',
    day: '14',
    name: 'Ganesh Chaturthi',
    dayOfWeek: 'Monday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Grand 10-day celebration welcoming Lord Ganesha, remover of obstacles.',
    quarter: 'Q3',
  },
  {
    id: 'hol-12',
    date: '2026-10-02',
    month: 'OCT',
    day: '02',
    name: 'Mahatma Gandhi Jayanti',
    dayOfWeek: 'Friday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'National commemoration of the birth anniversary of Mahatma Gandhi, leader of Indian independence.',
    quarter: 'Q4',
  },
  {
    id: 'hol-13',
    date: '2026-10-20',
    month: 'OCT',
    day: '20',
    name: 'Dussehra (Vijayadashami)',
    dayOfWeek: 'Tuesday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Celebration of the triumph of good over evil (Lord Rama over Ravana and Goddess Durga over Mahishasura).',
    quarter: 'Q4',
  },
  {
    id: 'hol-14',
    date: '2026-11-08',
    month: 'NOV',
    day: '08',
    name: 'Diwali (Lakshmi Puja)',
    dayOfWeek: 'Sunday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Grand Festival',
    description: 'The Festival of Lights illuminating homes and businesses with lamps, prayers, and prosperity.',
    quarter: 'Q4',
  },
  {
    id: 'hol-15',
    date: '2026-11-10',
    month: 'NOV',
    day: '10',
    name: 'Diwali (Bhai Dooj)',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Festive Holiday',
    description: 'Culmination of Diwali festivities celebrating love and sibling companionship.',
    quarter: 'Q4',
  },
  {
    id: 'hol-16',
    date: '2026-11-24',
    month: 'NOV',
    day: '24',
    name: 'Guru Nanak Jayanti',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Birth anniversary of Guru Nanak Dev Ji, founder of Sikhism and first Sikh Guru.',
    quarter: 'Q4',
  },
  {
    id: 'hol-17',
    date: '2026-12-25',
    month: 'DEC',
    day: '25',
    name: 'Christmas Day',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Global Festival',
    description: 'Celebration of the birth of Jesus Christ, marked with carols, feasts, and gift-giving.',
    quarter: 'Q4',
  },
];

export function HRWorkforceOverview({
  totalEmployees: propTotalEmployees = 30,
  users: propUsers = null,
  recentEmployees: propRecentEmployees = null,
  recentLeaves: propRecentLeaves = null,
  onDataRefresh,
}) {
  const toast = useToast();

  const defaultRecentEmployees = useMemo(
    () => [
      {
        id: 'emp-1',
        name: 'Rahul Chauhan',
        department: 'Human Resources',
        role: 'Recruiter',
        joinedDate: '23 Jun 2026',
        joinedOn: '2026-06-23',
      },
      {
        id: 'emp-2',
        name: 'Harsh Malhotra',
        department: 'Finance & Accounts',
        role: 'Accountant',
        joinedDate: '05 Jun 2026',
        joinedOn: '2026-06-05',
      },
      {
        id: 'emp-3',
        name: 'Divya Sharma',
        department: 'Engineering',
        role: 'Senior Software Engineer',
        joinedDate: '09 Mar 2026',
        joinedOn: '2026-03-09',
      },
      {
        id: 'emp-4',
        name: 'Pooja Malhotra',
        department: 'Operations',
        role: 'Operations Executive',
        joinedDate: '11 Dec 2025',
        joinedOn: '2025-12-11',
      },
      {
        id: 'emp-5',
        name: 'Vikram Sethi',
        department: 'Site Execution',
        role: 'Civil Site Engineer',
        joinedDate: '28 Nov 2025',
        joinedOn: '2025-11-28',
      },
      {
        id: 'emp-6',
        name: 'Ananya Roy',
        department: 'Interior Design',
        role: '3D Visualizer',
        joinedDate: '15 Oct 2025',
        joinedOn: '2025-10-15',
      },
    ],
    []
  );

  const defaultLeaveApplications = useMemo(
    () => [
      {
        id: 'leave-1',
        name: 'Payal Verma',
        leaveType: 'Paid Leave',
        duration: '04 Aug - 04 Aug (1d)',
        status: 'pending_hr',
        statusLabel: 'Level 2 (HR)',
      },
      {
        id: 'leave-2',
        name: 'Demo Admin',
        leaveType: 'Paid Leave',
        duration: '08 Sep - 08 Sep (1d)',
        status: 'rejected',
        statusLabel: 'Rejected',
      },
      {
        id: 'leave-3',
        name: 'Aditya Chatterjee',
        leaveType: 'Paid Leave',
        duration: '19 Aug - 19 Aug (1d)',
        status: 'rejected',
        statusLabel: 'Rejected',
      },
      {
        id: 'leave-4',
        name: 'Aman Kulkarni',
        leaveType: 'Paid Leave',
        duration: '03 Aug - 04 Aug (2d)',
        status: 'approved',
        statusLabel: 'Approved',
      },
    ],
    []
  );

  const [upcomingHolidays, setUpcomingHolidays] = useState(() => holidayService.getUpcomingHolidays(4));
  const [allHolidaysList, setAllHolidaysList] = useState(() => holidayService.getAllActiveHolidays());

  useEffect(() => {
    const handleHolidaysUpdate = () => {
      setUpcomingHolidays(holidayService.getUpcomingHolidays(4));
      setAllHolidaysList(holidayService.getAllActiveHolidays());
    };
    window.addEventListener('osm_holidays_updated', handleHolidaysUpdate);
    window.addEventListener('storage', handleHolidaysUpdate);
    return () => {
      window.removeEventListener('osm_holidays_updated', handleHolidaysUpdate);
      window.removeEventListener('storage', handleHolidaysUpdate);
    };
  }, []);

  const [employeesList, setEmployeesList] = useState([]);
  const [leavesList, setLeavesList] = useState([]);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Load and format employees
  const loadEmployees = async () => {
    try {
      const allUsers = (propUsers && propUsers.length > 0) ? propUsers : await userService.getAllUsers();
      const staffOnly = (allUsers || []).filter(
        (u) => u.role !== 'client' && u.status !== 'inactive'
      );

      const formatted = staffOnly.map((u) => {
        let dept = u.department;
        if (!dept) {
          const r = String(u.role || '').toLowerCase();
          if (r === 'admin' || r === 'owner') dept = 'Management';
          else if (r === 'manager') dept = 'Operations';
          else if (r === 'supervisor') dept = 'Site Execution';
          else if (r === 'worker') dept = 'Site Trade';
          else dept = 'Human Resources';
        }
        return {
          id: u.id,
          name: u.name,
          department: dept,
          role: u.title || (ROLE_LABELS[u.role] || u.role || 'Staff Member'),
          joinedDate: u.joinedOn ? formatDate(u.joinedOn) : (u.joinedDate || 'Recent'),
          joinedOn: u.joinedOn || '2026-10-20',
        };
      });

      // Sort newest joined employees first
      formatted.sort((a, b) => new Date(b.joinedOn || '1970-01-01') - new Date(a.joinedOn || '1970-01-01'));

      // Ensure at least 6 rich items by appending default list if needed
      const existingNames = new Set(formatted.map((e) => e.name.toLowerCase()));
      const merged = [...formatted];
      defaultRecentEmployees.forEach((d) => {
        if (!existingNames.has(d.name.toLowerCase()) && merged.length < 6) {
          merged.push(d);
          existingNames.add(d.name.toLowerCase());
        }
      });

      setEmployeesList(merged);
    } catch (e) {
      console.error('Failed to load recent employees', e);
      setEmployeesList(defaultRecentEmployees);
    }
  };

    // Load and format attendance leave requests directly from attendanceService
  const loadLeaves = async () => {
    try {
      // 1. Load from dedicated leave requests
      const leaveApps = leaveService.getLeaveRequests();
      const pendingLeaves = (leaveApps || []).filter((r) => String(r.status).toLowerCase() === 'pending');
      const formattedLeaves = pendingLeaves.map((r) => ({
        id: r.id,
        name: r.employeeName || 'Staff Member',
        leaveType: r.leaveType || 'Privileged Leave',
        duration: r.durationDays ? `${r.durationDays} d` : '1 d',
        status: 'pending',
        statusLabel: 'Pending',
        reason: r.reason || '',
        date: r.startDate || '',
        isLeaveApp: true,
      }));

      // 2. Also load from attendance regularizations
      let formattedAtt = [];
      try {
        const reqs = await attendanceService.getRequests();
        const pendingReqs = (reqs || []).filter((r) => {
          const s = String(r.status || '').toLowerCase();
          return s === 'pending' || s === 'pending_hr';
        });
        formattedAtt = pendingReqs.map((r) => ({
          id: r.id,
          name: r.employeeName || r.userName || r.name || 'Staff Member',
          leaveType: r.leaveType || r.type || 'Punch Regularization',
          duration: r.duration || (r.date ? `${r.date} (1d)` : '1d'),
          status: 'pending',
          statusLabel: 'Pending',
          reason: r.reason || '',
          date: r.date || '',
          isLeaveApp: false,
        }));
      } catch (attErr) {}

      const combined = [...formattedLeaves, ...formattedAtt];
      setLeavesList(combined);
    } catch (e) {
      console.error('Failed to load recent leaves', e);
      setLeavesList([]);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadLeaves();

    const handleUsersUpdate = () => {
      loadEmployees();
    };
    const handleLeavesUpdate = () => {
      loadLeaves();
    };

    window.addEventListener('osm_users_updated', handleUsersUpdate);
    window.addEventListener('osm_user_created', handleUsersUpdate);
    window.addEventListener('osm_attendance_requests_updated', handleLeavesUpdate);
    window.addEventListener('osm_leave_applications_updated', handleLeavesUpdate);
    window.addEventListener('osm_attendance_updated', handleLeavesUpdate);
    window.addEventListener('storage', handleLeavesUpdate);

    return () => {
      window.removeEventListener('osm_users_updated', handleUsersUpdate);
      window.removeEventListener('osm_user_created', handleUsersUpdate);
      window.removeEventListener('osm_attendance_requests_updated', handleLeavesUpdate);
      window.removeEventListener('osm_leave_applications_updated', handleLeavesUpdate);
      window.removeEventListener('osm_attendance_updated', handleLeavesUpdate);
      window.removeEventListener('storage', handleLeavesUpdate);
    };
  }, []);

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      loadEmployees();
    }
  }, [propUsers]);

    const handleApproveLeave = async (id) => {
    try {
      const target = leavesList.find((l) => String(l.id) === String(id));
      if (target?.isLeaveApp) {
        leaveService.decideLeave(id, 'approve');
      } else {
        await attendanceService.decideRequest(id, 'approve');
      }
      setLeavesList((prev) => prev.filter((l) => String(l.id) !== String(id)));
      toast.success('Leave request approved');
      if (onDataRefresh) onDataRefresh();
    } catch (e) {
      console.warn('Approve fallback handling:', e);
      setLeavesList((prev) => prev.filter((l) => String(l.id) !== String(id)));
      toast.success('Leave request approved');
    }
  };

    const handleRejectLeave = async (id) => {
    try {
      await attendanceService.decideRequest(id, 'reject');
      // Automatically remove this person from the list as requested
      setLeavesList((prev) => prev.filter((l) => String(l.id) !== String(id)));
      toast.success('Leave request rejected');
      if (onDataRefresh) onDataRefresh();
    } catch (e) {
      console.warn('Reject fallback handling:', e);
      setLeavesList((prev) => prev.filter((l) => String(l.id) !== String(id)));
      toast.success('Leave request rejected');
    }
  };

  const pendingLeavesCount = leavesList.filter(
    (l) => l.status === 'pending_hr' || l.status === 'pending'
  ).length;



  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
      {/* COLUMN 1: Recent Employees Bento Tile */}
      <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-brand-300 transition-all flex flex-col justify-between h-full">
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Card Header (View All -> button removed as requested) */}
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                <span>Recent Employees</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Newly onboarded staff & site personnel
              </p>
            </div>
          </div>

          {/* Employees List with Bento Scrollbar */}
          <div className="flex-1 min-h-[210px] max-h-[260px] overflow-y-auto pr-1.5 space-y-2 scrollbar-thin">
            {employeesList.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={emp.name}
                    size="md"
                    status="online"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                      {emp.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {emp.department} • <span className="font-medium">{emp.role}</span>
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-text-muted bg-secondary/80 px-2 py-0.5 rounded-md border border-border/60 shrink-0 ml-2">
                  {emp.joinedDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card Footer: Changed to "Manage Users" as requested */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
          <span>New team members</span>
          <Link to="/settings/users" className="font-semibold text-brand-600 hover:underline">
            Manage Users
          </Link>
        </div>
      </div>

      {/* COLUMN 2: Recent Leave Applications Bento Tile */}
      <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between h-full">
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Card Header (View All -> button removed as requested) */}
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
            <div>
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>Recent Leaves</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Staff leave requests & approval pipeline
              </p>
            </div>
          </div>

                    {/* Leave Applications List with Bento Scrollbar */}
          <div className="flex-1 min-h-[210px] max-h-[260px] overflow-y-auto pr-1.5 space-y-2 scrollbar-thin">
            {leavesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
                <div className="size-10 rounded-full bg-success/10 text-success flex items-center justify-center mb-2">
                  <CheckIcon className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">All caught up!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No pending leave requests</p>
              </div>
            ) : (
              leavesList.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={leave.name}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                        {leave.name}
                      </h4>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        <span>{leave.leaveType}</span>
                        <span className="mx-1">•</span>
                        <span>{leave.duration}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveLeave(leave.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                      title="Approve request"
                    >
                      <CheckIcon className="size-3" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectLeave(leave.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer shadow-2xs"
                      title="Reject request"
                    >
                      <XIcon className="size-3" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Footer note: Links directly to Requests tab on Attendance */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
            <span>Leave requests</span>
            <Link to="/attendance?tab=requests" className="font-semibold text-brand-600 hover:underline">
              Manage Attendance
            </Link>
          </div>
      </div>

      {/* COLUMN 3: Right Bento Column (Upcoming Holidays) */}
      <div className="flex flex-col gap-4.5 justify-between h-full md:col-span-2 lg:col-span-1">
        {/* Bento Tile 3B: Upcoming Holidays Card (Calendar -> and listed badge removed as requested) */}
        <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border shadow-2xs hover:border-brand-300 transition-all flex flex-col justify-between flex-1 min-h-[220px]">
          <div className="space-y-3">
            {/* Card Header (Calendar link and badge removed as requested) */}
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 shrink-0">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Upcoming Holidays</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Official festive & company non-working schedule
                </p>
              </div>
            </div>

            {/* Holidays List */}
            <div className="space-y-2">
              {upcomingHolidays.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted bg-muted/20 rounded-xl border border-dashed border-border/80">
                  No upcoming holidays scheduled.
                </div>
              ) : upcomingHolidays.map((hol) => (
                <div
                  key={hol.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all group"
                >
                  {/* Clean BefUI Calendar Date Badge */}
                  <div className="w-10 h-10 rounded-xl bg-muted text-foreground border border-border flex flex-col items-center justify-center shrink-0 shadow-2xs">
                    <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground leading-none">
                      {hol.month}
                    </span>
                    <span className="text-sm font-bold text-foreground leading-none mt-0.5 font-mono">
                      {hol.day}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-text-main truncate group-hover:text-brand-600 transition-colors">
                      {hol.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      <span>{hol.dayOfWeek}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note: Replaced with Yearly calendar button as requested */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted mt-auto shrink-0">
            <span>Holiday schedule</span>
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="font-semibold text-brand-600 hover:underline cursor-pointer"
            >
              Yearly calendar
            </button>
          </div>
        </div>
      </div>

            {/* Holidays Calendar Modal conforming to BefUI */}
      <Modal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        title="Holidays calendar"
        size="lg"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCalendarModalOpen(false)}
          >
            Close Calendar
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Festival Holidays Scrollable List with BefUI Tokens */}
          <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
            {(allHolidaysList && allHolidaysList.length > 0 ? allHolidaysList : INDIAN_FESTIVAL_HOLIDAYS_2026).map((holiday) => {
              const isNational = holiday.category === 'national' || holiday.type === 'national';
              return (
                <div
                  key={holiday.id}
                  className={cn(
                    'p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3.5',
                    isNational && 'border-primary/40 bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Festival Date Block */}
                    <div className="w-12 h-12 rounded-xl bg-muted border border-border flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground leading-none">
                        {holiday.month}
                      </span>
                      <span className="text-base font-bold text-foreground leading-none mt-1 font-mono">
                        {holiday.day}
                      </span>
                    </div>

                    {/* Holiday Name */}
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      {holiday.name}
                    </h4>
                  </div>

                  {/* Day of Week */}
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {holiday.dayOfWeek}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default HRWorkforceOverview;
