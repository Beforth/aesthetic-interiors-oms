import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { validateDateRange, validateRequired } from '../utils/validators';
import { mockLeaveBalances, mockLeaveApplications, mockPayslips } from '../data/leaves';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Icon from '../components/ui/Icon';
import { CalendarDaysIcon, ClockIcon, CheckCircleIcon, ReceiptIcon } from '../components/ui/icons';

export function LeavePayslipsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();
  const isAdminOrManager =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'balances' | 'payslips'

  // Data states
  const [applications, setApplications] = useState(mockLeaveApplications);
  const [payslips, setPayslips] = useState(mockPayslips);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveType: 'Privileged Leave',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState('October 2026');

  // Submit Leave Application (FR-HR-01)
  const handleApplyLeave = (e) => {
    e.preventDefault();

    const dateErr = validateDateRange(applyForm.startDate, applyForm.endDate, {
      startLabel: 'From date',
      endLabel: 'To date',
    });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }

    const reasonErr = validateRequired(applyForm.reason, 'Reason for leave', 5);
    if (reasonErr) {
      toast.error(reasonErr);
      return;
    }

    const start = new Date(applyForm.startDate);
    const end = new Date(applyForm.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newApp = {
      id: `la-${Date.now()}`,
      employeeId: currentUser?.id || 'u1',
      employeeName: currentUser?.name || 'Rohit Kumar',
      role: currentUser?.role || 'Staff',
      leaveType: applyForm.leaveType,
      startDate: applyForm.startDate,
      endDate: applyForm.endDate,
      daysCount: diffDays,
      reason: applyForm.reason,
      status: 'pending',
      appliedOn: new Date().toISOString().split('T')[0],
      approvedBy: null,
    };

    setApplications([newApp, ...applications]);
    toast.success(`Leave application for ${diffDays} day(s) submitted for manager approval`);
    setIsApplyModalOpen(false);
    setApplyForm({
      leaveType: 'Privileged Leave',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  // Manager Approve or Reject (FR-HR-02)
  const handleUpdateStatus = (id, newStatus) => {
    setApplications(
      applications.map((app) =>
        app.id === id
          ? {
              ...app,
              status: newStatus,
              approvedBy: currentUser?.name || 'Manager Neha Kulkarni',
            }
          : app
      )
    );
    toast.success(`Leave request ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`);
  };

  // Generate Monthly Payslips (FR-HR-04 & FR-HR-05)
  const handleGeneratePayslips = () => {
    toast.success(`Generated monthly payslips for all staff for ${generateMonth} factoring attendance & approved leaves!`);
    setIsGenerateModalOpen(false);
  };

  // Download / Print Payslip PDF (FR-HR-06)
  const handleDownloadPayslipPdf = (ps) => {
    toast.info(`Downloading official salary slip PDF for ${ps.employeeName} (${ps.month})...`);
    window.print();
  };

  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave & Monthly Payslips"
        subtitle="SRS Section 3.11: Worker leave applications, manager approvals, leave quotas, and automated attendance-linked payroll"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leadingIcon="file-text"
              onClick={() => setIsGenerateModalOpen(true)}
            >
              Generate Monthly Payslips
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={() => setIsApplyModalOpen(true)}
            >
              Apply for Leave
            </Button>
          </div>
        }
      />

      {/* Top Summary Cards (FR-HR-03) - Small, Sleek UI Optimized for Android App */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Leave Balance */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border shadow-2xs hover:border-foreground/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] text-muted-foreground truncate">
              Leave Balance
            </span>
            <div className="size-6 sm:size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarDaysIcon className="size-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-xl font-bold tracking-tight text-foreground">
              {mockLeaveBalances.balance} <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Days</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {mockLeaveBalances.used} used of {mockLeaveBalances.totalAllotted} allotted
            </p>
          </div>
        </div>

        {/* Card 2: Pending Approvals */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border shadow-2xs hover:border-foreground/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] text-muted-foreground truncate">
              Pending
            </span>
            <div className="size-6 sm:size-7 rounded-lg bg-warning/15 text-warning flex items-center justify-center shrink-0">
              <ClockIcon className="size-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-xl font-bold tracking-tight text-warning">
              {pendingCount} <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Requests</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {isAdminOrManager ? 'Needs review' : 'Awaiting review'}
            </p>
          </div>
        </div>

        {/* Card 3: Approved (This Month) */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border shadow-2xs hover:border-foreground/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] text-muted-foreground truncate">
              Approved
            </span>
            <div className="size-6 sm:size-7 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
              <CheckCircleIcon className="size-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-xl font-bold tracking-tight text-success">
              {applications.filter((a) => a.status === 'approved').length} <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Approved</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              Factored into payroll
            </p>
          </div>
        </div>

        {/* Card 4: Active Payslips */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border shadow-2xs hover:border-foreground/20 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] text-muted-foreground truncate">
              Active Payslips
            </span>
            <div className="size-6 sm:size-7 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0">
              <ReceiptIcon className="size-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-xl font-bold tracking-tight text-foreground">
              {payslips.length} <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Slips</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              Ready for PDF download
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'applications'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="attendance" size={14} />
          <span>Leave Requests & Approvals</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning/15 text-warning font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'balances'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="calendar" size={14} />
          <span>Leave Quotas & Balances (FR-HR-03)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payslips')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'payslips'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="receipt" size={14} />
          <span>Monthly Payslips & Payroll (FR-HR-04/06)</span>
        </button>
      </div>

      {/* TAB 1: Leave Applications & Approvals */}
      {activeTab === 'applications' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">Leave Applications</h3>
              <p className="text-xs text-text-muted">
                SRS FR-HR-01 & FR-HR-02: Employee leave submissions and manager decision workflows
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={() => setIsApplyModalOpen(true)}
            >
              Apply Leave
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border/80 uppercase font-semibold text-[10px] text-text-muted tracking-wider">
                <tr>
                  <th className="p-3">Applicant</th>
                  <th className="p-3">Leave Category</th>
                  <th className="p-3">Dates & Duration</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={app.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-text-main">{app.employeeName}</div>
                          <div className="text-[11px] text-text-muted">{app.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-text-main">{app.leaveType}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-text-main">
                        {formatDate(app.startDate)} → {formatDate(app.endDate)}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {app.daysCount} day{app.daysCount > 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="text-text-main truncate" title={app.reason}>
                        {app.reason}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">Applied: {app.appliedOn}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="p-3 text-right">
                      {isAdminOrManager && app.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(app.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                          >
                            Approve ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                          >
                            Reject ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-muted">
                          {app.approvedBy ? `By ${app.approvedBy}` : 'Processed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: Leave Balances & Quotas (FR-HR-03) */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockLeaveBalances.categories.map((cat) => (
              <Card key={cat.type} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-text-main">{cat.type}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {cat.balance} Left
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border/70">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Allotted</div>
                    <div className="text-base font-bold text-text-main">{cat.allotted}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Used</div>
                    <div className="text-base font-bold text-rose-600">{cat.used}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Remaining</div>
                    <div className="text-base font-bold text-emerald-600">{cat.balance}</div>
                  </div>
                </div>

                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mt-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(cat.balance / cat.allotted) * 100}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Monthly Payslips (FR-HR-04 & FR-HR-06) */}
      {activeTab === 'payslips' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">Employee Monthly Salary Slips</h3>
              <p className="text-xs text-text-muted">
                Calculated dynamically from attendance biometric punches and approved leave credits
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leadingIcon="download"
              onClick={() => toast.success('Batch payslip ZIP export initiated')}
            >
              Export Batch
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border/80 uppercase font-semibold text-[10px] text-text-muted tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Salary Month</th>
                  <th className="p-3">Attendance & Leaves</th>
                  <th className="p-3">Gross Earnings</th>
                  <th className="p-3">Deductions</th>
                  <th className="p-3">Net Take-Home</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payslips.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={ps.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-text-main">{ps.employeeName}</div>
                          <div className="text-[11px] text-text-muted">{ps.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-text-main">{ps.month}</td>
                    <td className="p-3">
                      <div className="font-medium text-emerald-700">
                        {ps.presentDays} / {ps.workingDays} Days Worked
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {ps.paidLeaves} Paid Leave • {ps.unpaidLeaves} LWP
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-text-main">
                      {formatCurrency(ps.grossSalary)}
                    </td>
                    <td className="p-3 font-mono text-rose-600">
                      -{formatCurrency(ps.totalDeductions)}
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-700">
                      {formatCurrency(ps.netPayable)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ps.payoutStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ps.payoutStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPayslip(ps)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors cursor-pointer"
                        >
                          View Slip →
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPayslipPdf(ps)}
                          className="p-1 rounded text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <Icon name="download" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: Apply Leave (FR-HR-01) */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply for Employee Leave (FR-HR-01)"
      >
        <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Leave Type</label>
            <select
              value={applyForm.leaveType}
              onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main"
            >
              <option value="Privileged Leave">Privileged Leave (7 days remaining)</option>
              <option value="Medical Leave">Medical Leave (10 days remaining)</option>
              <option value="Leave Without Pay">Leave Without Pay (33 days remaining)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">From Date</label>
              <input
                type="date"
                required
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">To Date</label>
              <input
                type="date"
                required
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Reason for Leave</label>
            <textarea
              rows={3}
              required
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              placeholder="Provide reason and site handover arrangement..."
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Submit Application
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: View Payslip Details & PDF (FR-HR-06) */}
      {selectedPayslip && (
        <Modal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          title={`Payslip for ${selectedPayslip.employeeName} • ${selectedPayslip.month}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-border/80 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-text-main">{selectedPayslip.employeeName}</div>
                <div className="text-xs text-text-muted">{selectedPayslip.role}</div>
                <div className="text-[11px] text-text-muted mt-1 font-mono">
                  Attendance: {selectedPayslip.presentDays} Present • {selectedPayslip.paidLeaves} Paid Leaves
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-muted uppercase font-bold">Net Salary Payable</div>
                <div className="text-xl font-extrabold text-emerald-700">
                  {formatCurrency(selectedPayslip.netPayable)}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedPayslip.payoutStatus}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-lg border border-border">
                <div className="font-bold text-text-main text-[11px] uppercase border-b pb-1">Earnings</div>
                <div className="flex justify-between">
                  <span>Basic Pay</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.basicPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span>House Rent Allowance (HRA)</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.hra)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Special Allowance</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.specialAllowance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Site Execution Bonus</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.siteExecutionBonus)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 text-text-main">
                  <span>Gross Earnings</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.grossSalary)}</span>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg border border-border">
                <div className="font-bold text-text-main text-[11px] uppercase border-b pb-1">Deductions</div>
                <div className="flex justify-between">
                  <span>Provident Fund (PF)</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.pfDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Professional Tax</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.professionalTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Income Tax (TDS)</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.tdsTax)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 text-rose-700">
                  <span>Total Deductions</span>
                  <span className="font-mono">-{formatCurrency(selectedPayslip.totalDeductions)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-[11px] text-text-muted">
                Transfer: {selectedPayslip.paymentMode}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-surface text-text-main hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPayslipPdf(selectedPayslip)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 font-semibold"
                >
                  <Icon name="download" size={13} />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Generate Monthly Payslips (FR-HR-04) */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Staff Payslips (FR-HR-04 / FR-HR-05)"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">
            The automated payroll calculator pulls daily GPS attendance records, verified punch-hours, and approved leave requests to calculate precise compensation for all personnel.
          </p>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Salary Month</label>
            <select
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
            >
              <option value="October 2026">October 2026 (Current Cycle)</option>
              <option value="September 2026">September 2026</option>
              <option value="November 2026">November 2026</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-border text-[11px] text-text-muted space-y-1">
            <div className="font-semibold text-text-main">Calculation Rules Applied:</div>
            <div>• Days worked = GPS verified biometric punches</div>
            <div>• Approved leave days counted as fully paid</div>
            <div>• Unpaid leaves subtracted from base pay</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGeneratePayslips}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              Execute Salary Calculations
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default LeavePayslipsPage;
