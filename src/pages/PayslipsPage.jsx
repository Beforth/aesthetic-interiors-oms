'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency } from '../utils/formatters';
import { mockPayslips } from '../data/leaves';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import {
  ReceiptIcon,
  DownloadIcon,
  UploadIcon,
  SearchIcon,
  CheckCircleIcon,
  UsersIcon,
  ArrowRightIcon,
} from '../components/ui/icons';

/**
 * Dedicated Monthly Payslips & Payroll Page
 * Conforming strictly to BefUI & design.md tokens.
 */
export function PayslipsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();
  const isAdminOrManager =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';

  // Everyone but an admin or manager sees only their own payslips (the sample data uses ids like 'u4', so match
  // the number or the name)
  const isMine = (ps) => {
    const norm = (v) => String(v ?? '').replace(/^u/i, '');
    return (
      norm(ps.employeeId) === norm(currentUser?.id) ||
      String(ps.employeeName || '').toLowerCase() === String(currentUser?.name || '').toLowerCase()
    );
  };
  const [payslips, setPayslips] = useState(() => (isAdminOrManager ? mockPayslips : mockPayslips.filter(isMine)));
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState('October 2026');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // KPI Calculations
  const totalPayroll = useMemo(
    () => payslips.reduce((sum, p) => sum + (p.netPayable || 0), 0),
    [payslips]
  );
  const avgNet = useMemo(
    () => (payslips.length ? Math.round(totalPayroll / payslips.length) : 0),
    [totalPayroll, payslips]
  );

  // Filtered Payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter((ps) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        ps.employeeName.toLowerCase().includes(q) ||
        (ps.role && ps.role.toLowerCase().includes(q)) ||
        (ps.month && ps.month.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' || ps.payoutStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [payslips, search, statusFilter]);

  // Generate Monthly Payslips Action
  const handleGeneratePayslips = () => {
    toast.success(
      `Generated monthly payslips for all staff for ${generateMonth} factoring attendance & approved leaves!`
    );
    setIsGenerateModalOpen(false);
  };

  // Download PDF Action
  const handleDownloadPayslipPdf = (ps) => {
    toast.info(`Downloading official salary slip PDF for ${ps.employeeName} (${ps.month})...`);
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payslips</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Employee monthly salary slips and disbursement records
          </p>
        </div>

        {isAdminOrManager && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.xlsx,.xls,.zip';
                input.onchange = (e) => {
                  const file = e.target.files?.[0];
                  if (file) toast.success(`Imported salary batch: ${file.name}`);
                };
                input.click();
              }}
              className="flex items-center gap-1.5"
            >
              <UploadIcon className="size-3.5" />
              <span>Import Batch</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsGenerateModalOpen(true)}
              className="flex items-center gap-1.5 shadow-2xs font-semibold"
            >
              <ReceiptIcon className="size-3.5" />
              <span>Generate Monthly Payslips</span>
            </Button>
          </div>
        )}
      </div>

      {/* KPI Summary Cards (company payroll totals: admin and manager only) */}
      {isAdminOrManager && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Payroll
          </span>
          <div className="text-xl font-bold font-mono text-foreground">
            {formatCurrency(totalPayroll)}
          </div>
          <span className="text-[10px] text-muted-foreground block">Current billing cycle</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Payslips
          </span>
          <div className="text-xl font-bold font-mono text-foreground">
            {payslips.length}{' '}
            <span className="text-xs font-normal text-muted-foreground">Slips</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-medium block">All staff calculated</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Avg Net Pay
          </span>
          <div className="text-xl font-bold font-mono text-foreground">
            {formatCurrency(avgNet)}
          </div>
          <span className="text-[10px] text-muted-foreground block">Per employee</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Payroll Status
          </span>
          <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircleIcon className="size-5" />
            <span>Disbursed</span>
          </div>
          <span className="text-[10px] text-muted-foreground block">Bank transfers approved</span>
        </div>
      </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by staff name, role, or month..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 min-w-[130px] text-xs"
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'Paid', label: 'Paid' },
              { value: 'Pending', label: 'Pending' },
            ]}
          />
          {isAdminOrManager && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success('Batch payslip ZIP export initiated')}
            className="h-9 flex items-center gap-1 text-xs"
          >
            <DownloadIcon className="size-3.5" />
            <span>Export Batch</span>
          </Button>
          )}
        </div>
      </div>

      {/* Payslips Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Attendance & Leaves</th>
                <th className="px-4 py-3">Gross Earnings</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net Take-Home</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayslips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No payslips match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredPayslips.map((ps) => (
                  <tr key={ps.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={ps.employeeName} size="sm" />
                        <div>
                          <div className="font-bold text-foreground">{ps.employeeName}</div>
                          <div className="text-[11px] text-muted-foreground">{ps.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-foreground">{ps.month}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">
                        {ps.presentDays} / {ps.workingDays} Days Worked
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ps.paidLeaves} Paid Leave • {ps.unpaidLeaves} LWP
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-foreground">
                      {formatCurrency(ps.grossSalary)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-destructive">
                      -{formatCurrency(ps.totalDeductions)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600">
                      {formatCurrency(ps.netPayable)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          ps.payoutStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ps.payoutStatus === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{ps.payoutStatus}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
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
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <DownloadIcon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
          <span>Showing {filteredPayslips.length} payslips</span>
        </div>
      </div>

      {/* MODAL 1: View Payslip Details */}
      {selectedPayslip && (
        <Modal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          title={`Payslip: ${selectedPayslip.employeeName}`}
          subtitle={`Salary period: ${selectedPayslip.month}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                Transfer: {selectedPayslip.paymentMode || 'NEFT / Direct Bank Transfer'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPayslip(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownloadPayslipPdf(selectedPayslip)}
                  className="flex items-center gap-1.5"
                >
                  <DownloadIcon className="size-3.5" />
                  <span>Download PDF</span>
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">
                  {selectedPayslip.employeeName}
                </div>
                <div className="text-xs text-muted-foreground">{selectedPayslip.role}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Attendance: {selectedPayslip.presentDays} Present • {selectedPayslip.paidLeaves}{' '}
                  Paid Leaves
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Net Take-Home</div>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {formatCurrency(selectedPayslip.netPayable)}
                </div>
                <span className="text-[10px] font-bold text-emerald-600">
                  {selectedPayslip.payoutStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earnings Breakdown */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                <div className="font-bold text-foreground border-b border-border pb-1.5 text-xs">
                  Earnings Breakdown
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Basic Salary</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.basicPay)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>House Rent Allowance (HRA)</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.hra)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Special Allowance</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.specialAllowance)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Site Execution Bonus</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.siteExecutionBonus)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 font-bold text-foreground">
                  <span>Gross Salary</span>
                  <span className="font-mono">{formatCurrency(selectedPayslip.grossSalary)}</span>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                <div className="font-bold text-foreground border-b border-border pb-1.5 text-xs">
                  Deductions & Taxes
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Provident Fund (PF Employee)</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.pfDeduction)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Professional Tax (PT)</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.professionalTax)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>TDS / Income Tax</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(selectedPayslip.tdsTax)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 font-bold text-destructive">
                  <span>Total Deductions</span>
                  <span className="font-mono">
                    -{formatCurrency(selectedPayslip.totalDeductions)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Generate Monthly Payslips */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Staff Payslips"
        subtitle="Automatic salary calculation based on attendance and approved leave balances"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePayslips}
              className="font-semibold shadow-2xs"
            >
              Generate All Payslips
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs py-1">
          <Select
            label="Payroll Month"
            value={generateMonth}
            onChange={(e) => setGenerateMonth(e.target.value)}
            options={[
              { value: 'October 2026', label: 'October 2026' },
              { value: 'September 2026', label: 'September 2026' },
              { value: 'August 2026', label: 'August 2026' },
            ]}
          />

          <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5 text-muted-foreground">
            <div className="font-bold text-foreground text-xs">Payroll Rules Applied:</div>
            <div>• Biometric check-in and check-out logs dictate present days</div>
            <div>• Approved paid leaves counted as present working days</div>
            <div>• Unpaid leaves deducted proportionally from basic pay</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PayslipsPage;
