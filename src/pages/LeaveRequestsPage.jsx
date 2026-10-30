'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { leaveService } from '../services/leaveService';
import { formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

// BefUI Components
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/badge';

// BefUI Icons strictly from '@/components/ui/icons'
import {
  SearchIcon,
  PlusIcon,
  CalendarIcon,
  ArrowUpDownIcon,
  CheckIcon,
  XIcon,
  TrashIcon,
  MoreIcon,
  EyeIcon,
} from '../components/ui/icons';

export function LeaveRequestsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState(() => leaveService.getLeaveRequests());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortField, setSortField] = useState('appliedOn');
  const [sortAsc, setSortAsc] = useState(false);

  // Active action menu row ID
  const [openActionId, setOpenActionId] = useState(null);
  const actionMenuRef = useRef(null);

  // View Details Modal State
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState(null);

  // Apply Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    employeeName: 'Amit Deshmukh',
    department: 'Interior Design',
    leaveType: 'Privileged Leave',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    durationDays: 1,
    paidDays: 1,
    lwpDays: 0,
    reason: '',
  });

  // Load and subscribe to updates
  useEffect(() => {
    const handleUpdate = () => {
      setRequests(leaveService.getLeaveRequests());
    };
    window.addEventListener('osm_leave_applications_updated', handleUpdate);
    return () => {
      window.removeEventListener('osm_leave_applications_updated', handleUpdate);
    };
  }, []);

  // Close action menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered & Sorted Requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter((req) => {
        if (statusFilter !== 'ALL' && req.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
        if (typeFilter !== 'ALL' && req.leaveType !== typeFilter) {
          return false;
        }
        if (fromDate && req.startDate < fromDate) {
          return false;
        }
        if (toDate && req.endDate > toDate) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchEmp = req.employeeName?.toLowerCase().includes(q);
          const matchReason = req.reason?.toLowerCase().includes(q);
          const matchDept = req.department?.toLowerCase().includes(q);
          const matchType = req.leaveType?.toLowerCase().includes(q);
          if (!matchEmp && !matchReason && !matchDept && !matchType) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'employee') {
          valA = a.employeeName.toLowerCase();
          valB = b.employeeName.toLowerCase();
        } else if (sortField === 'duration') {
          valA = a.durationDays;
          valB = b.durationDays;
        } else if (sortField === 'dates') {
          valA = a.startDate;
          valB = b.startDate;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [requests, search, statusFilter, typeFilter, fromDate, toDate, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleApprove = (id, name) => {
    leaveService.decideLeave(id, 'approve');
    toast.success(`Leave request for ${name} approved`);
    setOpenActionId(null);
  };

  const handleReject = (id, name) => {
    leaveService.decideLeave(id, 'reject');
    toast.success(`Leave request for ${name} rejected`);
    setOpenActionId(null);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete leave application for ${name}?`)) {
      leaveService.deleteLeave(id);
      toast.success(`Leave application deleted`);
      setOpenActionId(null);
    }
  };

  const handleApplySubmit = (e) => {
    e.preventDefault();
    if (!applyForm.startDate) {
      toast.error('Start date is required');
      return;
    }

    const start = new Date(applyForm.startDate);
    const end = new Date(applyForm.endDate || applyForm.startDate);

    if (end < start) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    const diffDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const paid = Number(applyForm.paidDays) || 0;
    const lwp = Number(applyForm.lwpDays) || 0;

    leaveService.applyLeave({
      ...applyForm,
      durationDays: diffDays,
      paidDays: paid,
      lwpDays: lwp,
    });

    toast.success(`Leave application submitted successfully for ${applyForm.employeeName}`);
    setIsApplyModalOpen(false);
    setApplyForm({
      employeeName: 'Amit Deshmukh',
      department: 'Interior Design',
      leaveType: 'Privileged Leave',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      durationDays: 1,
      paidDays: 1,
      lwpDays: 0,
      reason: '',
    });
  };

  const calculateDays = (startStr, endStr) => {
    if (!startStr) return 1;
    const start = new Date(startStr);
    const end = new Date(endStr || startStr);
    if (end < start) return 1;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Header with Apply Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Leave Requests
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            View and manage leave requests from your team
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsApplyModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <PlusIcon className="size-3.5" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* 2. Top Filter Bar (Directly matching UI screenshot) */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee, reason, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>

        {/* All Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-card border border-border text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs appearance-none"
          >
            <option value="ALL">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ArrowUpDownIcon className="size-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* All Types Dropdown */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-3 pr-8 py-2 text-xs font-medium rounded-xl bg-card border border-border text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs appearance-none"
          >
            <option value="ALL">All Types</option>
            <option value="Privileged Leave">Privileged Leave</option>
            <option value="Medical Leave">Medical Leave</option>
            <option value="Casual Leave">Casual Leave</option>
            <option value="Leave Without Pay">Leave Without Pay</option>
          </select>
          <ArrowUpDownIcon className="size-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* From Date */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground shadow-2xs">
          <span className="uppercase text-[10px] font-bold tracking-wider">FROM</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
          />
        </div>

        {/* To Date */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground shadow-2xs">
          <span className="uppercase text-[10px] font-bold tracking-wider">TO</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
          />
        </div>

        {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setTypeFilter('ALL');
              setFromDate('');
              setToDate('');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* 3. Leave Requests Table (Reason column removed as requested) */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('employee')}
                >
                  <div className="flex items-center gap-1">
                    <span>EMPLOYEE</span>
                    <ArrowUpDownIcon className="size-3" />
                  </div>
                </th>
                <th className="py-3 px-4">LEAVE TYPE</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('dates')}
                >
                  <div className="flex items-center gap-1">
                    <span>DATES</span>
                    <span className="text-[10px]">∨</span>
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center gap-1">
                    <span>DURATION</span>
                    <ArrowUpDownIcon className="size-3" />
                  </div>
                </th>
                <th className="py-3 px-4">STATUS</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('appliedOn')}
                >
                  <span>APPLIED ON</span>
                </th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((item) => {
                  const status = item.status?.toLowerCase();
                  const isPending = status === 'pending';
                  const isApproved = status === 'approved';
                  const isRejected = status === 'rejected';

                  // Format date range display
                  let datesText = formatDate(item.startDate);
                  if (item.endDate && item.endDate !== item.startDate) {
                    datesText = `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
                  }

                  // Duration breakdown
                  const paid = item.paidDays || 0;
                  const lwp = item.lwpDays || 0;
                  let breakdown = '';
                  if (paid > 0 && lwp > 0) {
                    breakdown = `${paid} Paid • ${lwp} LWP`;
                  } else if (paid > 0) {
                    breakdown = `${paid} Paid`;
                  } else if (lwp > 0) {
                    breakdown = `${lwp} LWP`;
                  }

                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      {/* Employee */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground text-xs block">
                          {item.employeeName}
                        </span>
                      </td>

                      {/* Leave Type */}
                      <td className="py-3 px-4 text-foreground font-medium">
                        {item.leaveType}
                      </td>

                      {/* Dates */}
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {datesText}
                      </td>

                      {/* Duration with Pill + Breakdown */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="inline-block px-3 py-0.5 rounded-full bg-muted/60 text-foreground font-bold text-xs">
                            {item.durationDays} d
                          </span>
                          {breakdown && (
                            <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {breakdown}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isPending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Applied On */}
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(item.appliedOn)}
                      </td>

                      {/* Actions with Direct View Action Button & Popover */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1 relative">
                          {/* Direct View Action Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedLeaveDetails(item)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="View Leave Request Details"
                          >
                            <EyeIcon className="size-4" />
                          </button>

                          {/* More Options Menu */}
                          <button
                            type="button"
                            onClick={() => setOpenActionId(openActionId === item.id ? null : item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Actions"
                          >
                            <MoreIcon className="size-4" />
                          </button>

                          {/* Action Popover Menu */}
                          {openActionId === item.id && (
                            <div
                              ref={actionMenuRef}
                              className="absolute right-0 top-9 w-32 py-1.5 bg-card border border-border rounded-xl shadow-lg z-30 text-xs text-left animate-in fade-in zoom-in-95 duration-150"
                            >
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(item.id, item.employeeName)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-success hover:bg-success/10 transition-colors cursor-pointer font-medium"
                                  >
                                    <CheckIcon className="size-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(item.id, item.employeeName)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer font-medium"
                                  >
                                    <XIcon className="size-3.5" />
                                    <span>Reject</span>
                                  </button>
                                  <div className="my-1 border-t border-border" />
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id, item.employeeName)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                              >
                                <TrashIcon className="size-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                    No leave requests found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Apply For Leave Modal */}
      {isApplyModalOpen && (
        <Modal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          title="Apply for Leave"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {/* Employee Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Employee Name <span className="text-destructive">*</span>
              </label>
              <select
                value={applyForm.employeeName}
                onChange={(e) => {
                  const val = e.target.value;
                  let dept = 'Operations';
                  if (val === 'Amit Deshmukh') dept = 'Interior Design';
                  if (val === 'nilesh') dept = 'Execution';
                  if (val === 'Vikas Jadhav') dept = 'Site Supervision';
                  if (val === 'Rohit Kumar') dept = 'Management';
                  if (val === 'Neha Kulkarni') dept = 'Operations';
                  setApplyForm({ ...applyForm, employeeName: val, department: dept });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="Amit Deshmukh">Amit Deshmukh (Interior Design)</option>
                <option value="nilesh">nilesh (Execution)</option>
                <option value="Vikas Jadhav">Vikas Jadhav (Site Supervision)</option>
                <option value="Rohit Kumar">Rohit Kumar (Owner)</option>
                <option value="Neha Kulkarni">Neha Kulkarni (Operations)</option>
                <option value="Suresh Gaikwad">Suresh Gaikwad (Site Worker)</option>
              </select>
            </div>

            {/* Leave Type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Leave Type <span className="text-destructive">*</span>
              </label>
              <select
                value={applyForm.leaveType}
                onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="Privileged Leave">Privileged Leave</option>
                <option value="Medical Leave">Medical Leave</option>
                <option value="Casual Leave">Casual Leave</option>
                <option value="Leave Without Pay">Leave Without Pay (LWP)</option>
              </select>
            </div>

            {/* Start & End Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  From Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={applyForm.startDate}
                  onChange={(e) => {
                    const s = e.target.value;
                    const d = calculateDays(s, applyForm.endDate);
                    setApplyForm({
                      ...applyForm,
                      startDate: s,
                      durationDays: d,
                      paidDays: d,
                      lwpDays: 0,
                    });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  To Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={applyForm.endDate}
                  onChange={(e) => {
                    const ed = e.target.value;
                    const d = calculateDays(applyForm.startDate, ed);
                    setApplyForm({
                      ...applyForm,
                      endDate: ed,
                      durationDays: d,
                      paidDays: d,
                      lwpDays: 0,
                    });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Duration & Breakdown */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Days</span>
                <span className="font-bold text-foreground text-sm font-mono">
                  {applyForm.durationDays || 1} d
                </span>
              </div>
              <div>
                <label className="text-muted-foreground block text-[10px] uppercase font-bold">Paid Days</label>
                <input
                  type="number"
                  min="0"
                  max={applyForm.durationDays}
                  value={applyForm.paidDays}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 0;
                    setApplyForm({
                      ...applyForm,
                      paidDays: p,
                      lwpDays: Math.max(0, applyForm.durationDays - p),
                    });
                  }}
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono text-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground block text-[10px] uppercase font-bold">LWP Days</label>
                <input
                  type="number"
                  min="0"
                  max={applyForm.durationDays}
                  value={applyForm.lwpDays}
                  onChange={(e) => {
                    const l = Number(e.target.value) || 0;
                    setApplyForm({
                      ...applyForm,
                      lwpDays: l,
                      paidDays: Math.max(0, applyForm.durationDays - l),
                    });
                  }}
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Reason
              </label>
              <textarea
                rows={2}
                placeholder="Reason for leave request..."
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs resize-none focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Apply Leave
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Leave Request Details Modal (Matches user's screenshot exactly) */}
      {selectedLeaveDetails && (
        <Modal
          isOpen={!!selectedLeaveDetails}
          onClose={() => setSelectedLeaveDetails(null)}
          title="Leave Request Details"
        >
          <div className="space-y-4 pt-1">
            {/* Subtitle with employee & leave type */}
            <p className="-mt-3 text-xs text-muted-foreground font-medium">
              {selectedLeaveDetails.employeeName} · {selectedLeaveDetails.leaveType}
            </p>

            {/* Box 1: Dates & Total Duration */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  DATES
                </span>
                <span className="text-sm font-bold text-foreground block mt-1.5">
                  {selectedLeaveDetails.endDate && selectedLeaveDetails.endDate !== selectedLeaveDetails.startDate
                    ? `${formatDate(selectedLeaveDetails.startDate)} – ${formatDate(selectedLeaveDetails.endDate)}`
                    : formatDate(selectedLeaveDetails.startDate)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  TOTAL DURATION
                </span>
                <span className="text-sm font-bold text-foreground block mt-1.5">
                  {selectedLeaveDetails.durationDays} Day(s)
                </span>
              </div>
            </div>

            {/* Box 2: Application Timing & Calculated Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Application Timing:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckIcon className="size-3" />
                  <span>On-Time Application (Informed in advance)</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Calculated Breakdown:</span>
                <span className="font-bold text-foreground text-xs">
                  {selectedLeaveDetails.paidDays > 0 && selectedLeaveDetails.lwpDays > 0
                    ? `${selectedLeaveDetails.paidDays} Paid • ${selectedLeaveDetails.lwpDays} LWP`
                    : selectedLeaveDetails.paidDays > 0
                    ? `${selectedLeaveDetails.paidDays} Paid`
                    : selectedLeaveDetails.lwpDays > 0
                    ? `${selectedLeaveDetails.lwpDays} LWP`
                    : `${selectedLeaveDetails.durationDays} Day(s)`}
                </span>
              </div>
            </div>

            {/* REASON */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                REASON
              </label>
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 text-xs text-foreground min-h-[44px] flex items-center">
                {selectedLeaveDetails.reason ? (
                  <span>{selectedLeaveDetails.reason}</span>
                ) : (
                  <span className="text-muted-foreground">No reason provided</span>
                )}
              </div>
            </div>

            {/* STATUS */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-foreground">Status:</span>
              <div>
                {selectedLeaveDetails.status?.toLowerCase() === 'approved' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Approved
                  </span>
                )}
                {selectedLeaveDetails.status?.toLowerCase() === 'rejected' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Rejected
                  </span>
                )}
                {selectedLeaveDetails.status?.toLowerCase() === 'pending' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Pending
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedLeaveDetails(null)}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default LeaveRequestsPage;
