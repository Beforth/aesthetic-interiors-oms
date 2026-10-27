import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { validatePositiveNumber, validateRequired } from '../utils/validators';
import { mockProjectPaymentSchedules } from '../data/payments';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Icon from '../components/ui/Icon';

export function PaymentsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();
  const isManagerOrAdmin =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';

  const [schedules, setSchedules] = useState(mockProjectPaymentSchedules);
  const [selectedProjectId, setSelectedProjectId] = useState('P1');
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'receipts' | 'client-view'

  // Modal 1: Record Payment Received (FR-PAY-03 & FR-PAY-07)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordTargetInstallment, setRecordTargetInstallment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 1300000,
    paidDate: new Date().toISOString().split('T')[0],
    mode: 'RTGS / Bank Transfer',
    receiptNumber: `REC-${Date.now().toString().slice(-4)}`,
    notes: 'Client confirmed transfer from HDFC Corporate Account',
  });

  // Modal 2: Set Total Project Cost & Milestones (FR-PAY-01 & FR-PAY-02)
  const [isSetCostOpen, setIsSetCostOpen] = useState(false);
  const [costForm, setCostForm] = useState({
    projectId: 'P1',
    totalCost: 6500000,
    advancePercentage: 10,
    milestoneCount: 4,
  });

  // Active Project Data
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.projectId === selectedProjectId) || schedules[0];
  }, [schedules, selectedProjectId]);

  // Overall Portfolio Financial Stats (FR-PAY-04)
  const portfolioStats = useMemo(() => {
    let totalCost = 0;
    let totalPaid = 0;
    let totalAdvance = 0;
    let totalPending = 0;
    let overdueCount = 0;

    schedules.forEach((s) => {
      totalCost += s.totalCost;
      totalPaid += s.totalPaid;
      totalAdvance += s.advancePaid;
      totalPending += s.totalPending;

      (s.installments || []).forEach((inst) => {
        if (inst.status === 'overdue') overdueCount++;
      });
    });

    return { totalCost, totalPaid, totalAdvance, totalPending, overdueCount };
  }, [schedules]);

  // Record Payment Submit (FR-PAY-03)
  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    if (!recordTargetInstallment) return;

    const amtErr = validatePositiveNumber(paymentForm.amount, 'Payment amount', { min: 100 });
    if (amtErr) {
      toast.error(amtErr);
      return;
    }
    if (!paymentForm.paidDate) {
      toast.error('Payment receipt date is required');
      return;
    }
    const receiptErr = validateRequired(paymentForm.receiptNumber, 'Transaction / Receipt reference', 3);
    if (receiptErr) {
      toast.error(receiptErr);
      return;
    }

    const amt = Number(paymentForm.amount);
    const updatedSchedules = schedules.map((proj) => {
      if (proj.projectId !== selectedProjectId) return proj;

      const updatedInstallments = proj.installments.map((inst) => {
        if (inst.id === recordTargetInstallment.id) {
          return {
            ...inst,
            status: 'paid',
            paidDate: paymentForm.paidDate,
            paidAmount: amt,
            paymentMode: paymentForm.mode,
            receiptNumber: paymentForm.receiptNumber,
            receiptUrl: '/receipts/sample-receipt.pdf',
          };
        }
        return inst;
      });

      const newTotalPaid = proj.totalPaid + amt;
      const newPending = Math.max(0, proj.totalCost - newTotalPaid);

      return {
        ...proj,
        totalPaid: newTotalPaid,
        totalPending: newPending,
        installments: updatedInstallments,
      };
    });

    setSchedules(updatedSchedules);
    toast.success(`Recorded ₹ ${amt.toLocaleString('en-IN')} payment against "${recordTargetInstallment.title}"`);
    setIsRecordPaymentOpen(false);
    setRecordTargetInstallment(null);
  };

  // Set Project Cost & Split Installments (FR-PAY-01 & FR-PAY-02)
  const handleSetCostSubmit = (e) => {
    e.preventDefault();
    const costErr = validatePositiveNumber(costForm.totalCost, 'Total project contract budget', { min: 50000 });
    if (costErr) {
      toast.error(costErr);
      return;
    }
    const adv = Number(costForm.advancePercentage);
    if (isNaN(adv) || adv < 5 || adv > 60) {
      toast.error('Booking advance percentage must be between 5% and 60%');
      return;
    }
    const mCount = Number(costForm.milestoneCount);
    if (isNaN(mCount) || mCount < 2 || mCount > 10) {
      toast.error('Installment count must be between 2 and 10 milestones');
      return;
    }

    const cost = Number(costForm.totalCost);

    const updatedSchedules = schedules.map((proj) => {
      if (proj.projectId !== costForm.projectId) return proj;

      const advAmt = Math.round(cost * (costForm.advancePercentage / 100));
      const remainingCost = cost - advAmt;
      const partCount = costForm.milestoneCount;
      const perPart = Math.round(remainingCost / partCount);

      const generated = [
        {
          id: `inst-${Date.now()}-adv`,
          title: `Project Sign-off Advance (${costForm.advancePercentage}%)`,
          amount: advAmt,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
          paidAmount: advAmt,
          paymentMode: 'Bank Transfer (NEFT)',
          receiptNumber: 'REC-ADV-01',
          receiptUrl: '/receipts/sample-receipt.pdf',
        },
      ];

      for (let i = 1; i <= partCount; i++) {
        const due = new Date();
        due.setDate(due.getDate() + i * 30);
        generated.push({
          id: `inst-${Date.now()}-${i}`,
          title: `Milestone Stage ${i} (${Math.round((perPart / cost) * 100)}%)`,
          amount: perPart,
          dueDate: due.toISOString().split('T')[0],
          status: 'pending',
          paidDate: null,
          paidAmount: 0,
          paymentMode: null,
          receiptNumber: null,
          receiptUrl: null,
        });
      }

      return {
        ...proj,
        totalCost: cost,
        advancePaid: advAmt,
        totalPaid: advAmt,
        totalPending: remainingCost,
        installments: generated,
      };
    });

    setSchedules(updatedSchedules);
    toast.success(`Project contract set to ₹ ${cost.toLocaleString('en-IN')} with ${costForm.milestoneCount + 1} structured installments!`);
    setIsSetCostOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Payments & Milestone Billing"
        subtitle="SRS Section 3.9: Set project contract budgets, split milestone installments, track advance & pending payments, and flag overdue payments"
        actions={
          isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leadingIcon="settings"
                onClick={() => setIsSetCostOpen(true)}
              >
                Set Project Cost & Milestones
              </Button>
            </div>
          )
        }
      />

      {/* TOP SUMMARY STATS CARDS (FR-PAY-04: advance, paid and pending amounts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <Card className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Total Contract Cost</span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="payments" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {formatCurrency(portfolioStats.totalCost)}
          </div>
          <p className="text-[11px] text-muted-foreground">Across active fit-out projects (FR-PAY-01)</p>
        </Card>

        {/* Total Paid */}
        <Card className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Total Paid / Received</span>
            <div className="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <Icon name="check" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-success">
            {formatCurrency(portfolioStats.totalPaid)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {Math.round((portfolioStats.totalPaid / portfolioStats.totalCost) * 100)}% realization rate
          </p>
        </Card>

        {/* Total Advance */}
        <Card className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Advance Collected</span>
            <div className="w-7 h-7 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <Icon name="receipt" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-info">
            {formatCurrency(portfolioStats.totalAdvance)}
          </div>
          <p className="text-[11px] text-muted-foreground">Booking advances received</p>
        </Card>

        {/* Pending & Overdue */}
        <Card className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Pending Balance</span>
            <div className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <Icon name="clock" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-destructive">
            {formatCurrency(portfolioStats.totalPending)}
          </div>
          <p className="text-[11px] text-destructive font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span>{portfolioStats.overdueCount} installment overdue (FR-PAY-06)</span>
          </p>
        </Card>
      </div>

      {/* Project Selector Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase">Select Fit-Out Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground font-bold focus:outline-none"
          >
            {schedules.map((s) => (
              <option key={s.projectId} value={s.projectId}>
                {s.projectName} ({s.clientName})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-bold text-foreground">{formatCurrency(currentSchedule.totalCost)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Paid: </span>
            <span className="font-bold text-success">{formatCurrency(currentSchedule.totalPaid)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pending: </span>
            <span className="font-bold text-destructive">{formatCurrency(currentSchedule.totalPending)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'schedule'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="payments" size={14} />
          <span>Milestone Payment Schedule (FR-PAY-02)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('client-view')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'client-view'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="users" size={14} />
          <span>Client View & Receipts (FR-PAY-05 / 07)</span>
        </button>
      </div>

      {/* TAB 1: Milestone Installments Table (FR-PAY-02, 03, 06) */}
      {activeTab === 'schedule' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">
                Milestone Installments for {currentSchedule.projectName}
              </h3>
              <p className="text-xs text-text-muted">
                Installment breakdown tied to trade milestones with automated overdue flags
              </p>
            </div>
            {isManagerOrAdmin && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="receipt"
                onClick={() => {
                  const pending = currentSchedule.installments.find(
                    (i) => i.status === 'overdue' || i.status === 'pending'
                  );
                  if (pending) {
                    setRecordTargetInstallment(pending);
                    setPaymentForm((prev) => ({ ...prev, amount: pending.amount }));
                    setIsRecordPaymentOpen(true);
                  } else {
                    toast.info('All installments for this project are already paid in full!');
                  }
                }}
              >
                Record Payment
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border/80 uppercase font-semibold text-[10px] text-text-muted tracking-wider">
                <tr>
                  <th className="p-3">Installment Milestone</th>
                  <th className="p-3">Amount (₹)</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Payment Mode / Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentSchedule.installments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-text-main">{inst.title}</div>
                      {inst.receiptNumber && (
                        <div className="text-[10px] text-text-muted mt-0.5">
                          Receipt: <span className="font-mono">{inst.receiptNumber}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-text-main text-sm">
                      {formatCurrency(inst.amount)}
                    </td>
                    <td className="p-3 font-mono">
                      <div>{formatDate(inst.dueDate)}</div>
                    </td>
                    <td className="p-3">
                      {inst.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Icon name="check" size={12} />
                          <span>Paid</span>
                        </span>
                      )}
                      {inst.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          <span>Upcoming</span>
                        </span>
                      )}
                      {/* FR-PAY-06: Flagged as overdue when due date passes unpaid */}
                      {inst.status === 'overdue' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                          <span>Overdue (FR-PAY-06)</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {inst.status === 'paid' ? (
                        <div className="text-xs">
                          <span className="font-semibold text-emerald-700">{inst.paymentMode}</span>
                          <div className="text-[10px] text-text-muted">Cleared: {formatDate(inst.paidDate)}</div>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {inst.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => toast.info(`Viewing receipt ${inst.receiptNumber}...`)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border text-primary hover:bg-muted transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                      ) : (
                        isManagerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setRecordTargetInstallment(inst);
                              setPaymentForm((prev) => ({ ...prev, amount: inst.amount }));
                              setIsRecordPaymentOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-success hover:bg-success/90 text-white transition-colors cursor-pointer"
                          >
                            Record Payment
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: Client View Preview (FR-PAY-05 & FR-PAY-07) */}
      {activeTab === 'client-view' && (
        <Card className="space-y-4 max-w-3xl mx-auto p-6 bg-muted/30">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase">Client Payment Portal</div>
              <h3 className="text-base font-bold text-foreground mt-0.5">
                {currentSchedule.projectName} • {currentSchedule.clientName}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              Client View
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center bg-white p-4 rounded-xl border border-border shadow-2xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-text-muted">Contract Value</div>
              <div className="text-base font-extrabold text-text-main mt-0.5">
                {formatCurrency(currentSchedule.totalCost)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-700">Total Paid</div>
              <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                {formatCurrency(currentSchedule.totalPaid)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-rose-600">Balance Pending</div>
              <div className="text-base font-extrabold text-rose-600 mt-0.5">
                {formatCurrency(currentSchedule.totalPending)}
              </div>
            </div>
          </div>

          {/* Schedule list */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-text-main">Payment Milestones</div>
            {currentSchedule.installments.map((inst) => (
              <div
                key={inst.id}
                className="p-3.5 rounded-xl bg-white border border-border flex items-center justify-between shadow-2xs"
              >
                <div>
                  <div className="font-bold text-xs text-text-main">{inst.title}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Due: {formatDate(inst.dueDate)} {inst.paidDate && `• Paid on ${formatDate(inst.paidDate)}`}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-text-main text-xs">
                    {formatCurrency(inst.amount)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inst.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inst.status === 'overdue'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {inst.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL 1: Record Payment Received (FR-PAY-03 & FR-PAY-07) */}
      {recordTargetInstallment && (
        <Modal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          title={`Record Payment • ${recordTargetInstallment.title}`}
        >
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-border">
              <div className="text-[11px] text-text-muted">Target Installment Amount:</div>
              <div className="text-lg font-extrabold text-text-main font-mono">
                {formatCurrency(recordTargetInstallment.amount)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Amount Received (₹)</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-muted uppercase">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.paidDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Payment Mode (FR-PAY-03)</label>
              <select
                value={paymentForm.mode}
                onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
              >
                <option value="RTGS / Bank Transfer">RTGS / Bank Transfer (Direct)</option>
                <option value="NEFT">NEFT Transfer</option>
                <option value="UPI / QR Code">UPI / QR Payment</option>
                <option value="Cheque Clearance">Cheque Clearance</option>
                <option value="Cash Deposit">Direct Cash Deposit</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">
                Attach Receipt / Proof (FR-PAY-07)
              </label>
              <input
                type="text"
                value={paymentForm.receiptNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })}
                placeholder="Transaction ID / Receipt Reference"
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Save Payment Receipt
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Set Project Cost & Split Milestones (FR-PAY-01 & FR-PAY-02) */}
      <Modal
        isOpen={isSetCostOpen}
        onClose={() => setIsSetCostOpen(false)}
        title="Set Total Project Budget & Milestones (FR-PAY-01/02)"
      >
        <form onSubmit={handleSetCostSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Select Project</label>
            <select
              value={costForm.projectId}
              onChange={(e) => setCostForm({ ...costForm, projectId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
            >
              {schedules.map((s) => (
                <option key={s.projectId} value={s.projectId}>
                  {s.projectName} ({s.clientName})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">
              Total Contract Cost (₹) • FR-PAY-01
            </label>
            <input
              type="number"
              min="10000"
              required
              value={costForm.totalCost}
              onChange={(e) => setCostForm({ ...costForm, totalCost: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Booking Advance (%)</label>
              <input
                type="number"
                min="5"
                max="50"
                value={costForm.advancePercentage}
                onChange={(e) => setCostForm({ ...costForm, advancePercentage: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">
                Installment Splits (FR-PAY-02)
              </label>
              <input
                type="number"
                min="2"
                max="8"
                value={costForm.milestoneCount}
                onChange={(e) => setCostForm({ ...costForm, milestoneCount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-border rounded-lg text-[11px] text-text-muted">
            The system will automatically allocate due dates at 30-day milestone intervals and monitor for overdue payments.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsSetCostOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Generate Payment Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PaymentsPage;
