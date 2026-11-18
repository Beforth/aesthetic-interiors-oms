'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { incentiveService } from '../services/incentiveService';
import { INCENTIVE_CATEGORIES } from '../data/incentives';
import { mockProjects } from '../data/projects';
import { mockUsers } from '../data/users';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

import {
  TrophyIcon,
  AwardIcon,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  EyeIcon,
  TrashIcon,
  IndianRupeeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  XIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  FileTextIcon,
  SortIcon,
  SaveIcon,
  CreditCardIcon,
  PhoneIcon,
  LandmarkIcon,
  BanknoteIcon,
  ReceiptIcon,
} from '../components/ui/icons';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const PAYMENT_OPTIONS = ['Cash', 'Card', 'UPI', 'Net Banking', 'Cheque'];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// Date column: date on line 1, time on line 2
function DateTimeCell({ dateStr, timeStr }) {
  if (!dateStr) return <span className="text-muted-foreground">-</span>;
  try {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = timeStr || '12:00';
    return (
      <div className="space-y-0.5">
        <div className="font-mono text-[11px] text-foreground">{datePart}</div>
        <div className="text-[10px] text-muted-foreground">{timePart}</div>
      </div>
    );
  } catch {
    return <span className="font-mono text-[11px] text-muted-foreground">{dateStr}</span>;
  }
}

// Reason cell: truncated with native tooltip
function ReasonCell({ text }) {
  if (!text) return <span className="text-muted-foreground text-[11px]">-</span>;
  const truncated = text.length > 48 ? text.slice(0, 48) + '...' : text;
  return (
    <span
      className="text-[11px] text-muted-foreground cursor-default"
      title={text}
    >
      {truncated}
    </span>
  );
}

// Payment chip - same style as ExpensesPage
const renderPaymentChip = (method = '') => {
  const m = (method || '').toLowerCase().trim();
  if (m === 'cash') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400">
      <BanknoteIcon className="size-2.5 shrink-0" />Cash
    </span>
  );
  if (m === 'card') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/30 dark:text-blue-400">
      <CreditCardIcon className="size-2.5 shrink-0" />Card
    </span>
  );
  if (m === 'upi') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/30 dark:text-purple-400">
      <PhoneIcon className="size-2.5 shrink-0" />UPI
    </span>
  );
  if (m === 'net banking' || m === 'bank transfer' || m === 'net banking / neft') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-400">
      <LandmarkIcon className="size-2.5 shrink-0" />Net Banking
    </span>
  );
  if (m === 'cheque' || m === 'check') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400">
      <ReceiptIcon className="size-2.5 shrink-0" />Cheque
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
      <CreditCardIcon className="size-2.5 shrink-0" />{method || 'Other'}
    </span>
  );
};

// Status - plain colored text, no box
function StatusPill({ status, onClick }) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'PAID') return (
    <button type="button" onClick={onClick} className="text-[11px] font-semibold text-emerald-600 cursor-pointer hover:opacity-70 transition-opacity">
      {s === 'PAID' ? 'Paid' : 'Approved'}
    </button>
  );
  if (s === 'PENDING') return (
    <button type="button" onClick={onClick} className="text-[11px] font-semibold text-amber-600 cursor-pointer hover:opacity-70 transition-opacity">
      Pending
    </button>
  );
  if (s === 'REJECTED') return (
    <button type="button" onClick={onClick} className="text-[11px] font-semibold text-rose-600 cursor-pointer hover:opacity-70 transition-opacity">
      Rejected
    </button>
  );
  return (
    <span className="text-[11px] font-semibold text-muted-foreground">{status}</span>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PERFORMANCE BONUSES tab
// ---------------------------------------------------------------------------
function PerformanceLeaderboard({ incentives, onView }) {
  const leaderboard = useMemo(() => {
    const map = {};
    incentives.forEach((inc) => {
      const id = inc.recipientId || inc.recipientName;
      if (!map[id]) {
        map[id] = {
          recipientId: id,
          recipientName: inc.recipientName,
          recipientRole: inc.recipientRole,
          trade: inc.trade,
          totalAmount: 0,
          bonusCount: 0,
          approvedCount: 0,
          pendingCount: 0,
          paidCount: 0,
          lastDate: '',
          records: [],
        };
      }
      map[id].totalAmount += Number(inc.amount) || 0;
      map[id].bonusCount += 1;
      const s = (inc.status || '').toUpperCase();
      if (s === 'PAID') map[id].paidCount += 1;
      else if (s === 'APPROVED') map[id].approvedCount += 1;
      else if (s === 'PENDING') map[id].pendingCount += 1;
      if (!map[id].lastDate || inc.awardedDate > map[id].lastDate) map[id].lastDate = inc.awardedDate;
      map[id].records.push(inc);
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [incentives]);

  // Client-side pagination (10 / 25 / 30 rows per page, default 10)
  const pager = usePagination(leaderboard);

  const totalAmount = leaderboard.reduce((s, e) => s + e.totalAmount, 0);
  const totalAwards = leaderboard.reduce((s, e) => s + e.bonusCount, 0);
  const topAmount = leaderboard[0]?.totalAmount || 1;

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground text-xs shadow-2xs">
        No performance bonus records found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative rounded-xl border border-border bg-card p-4 pr-11 shadow-2xs">
          <div className="text-lg font-bold text-foreground leading-none">{leaderboard.length}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">Recipients</span>
          <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-3.5">
            <TrophyIcon />
          </div>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 pr-11 shadow-2xs">
          <div className="text-lg font-bold text-foreground leading-none">{totalAwards}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">Total Awards</span>
          <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-success/10 text-success [&>svg]:size-3.5">
            <GiftIcon />
          </div>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-4 pr-11 shadow-2xs">
          <div className="text-lg font-bold font-mono text-foreground leading-none">{formatCurrency(totalAmount)}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">Total Bonus Value</span>
          <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-warning/10 text-warning [&>svg]:size-3.5">
            <IndianRupeeIcon />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Performance Leaderboard</span>
          <span className="text-[11px] text-muted-foreground">Ranked by total bonus amount</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Awards</th>
                <th className="py-3 px-4">Status Mix</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {pager.paginatedItems.map((entry, i) => (
                <tr key={entry.recipientId} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg text-[11px] font-bold',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      i === 1 ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                      i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-muted text-muted-foreground'
                    )}>
                      #{i + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={entry.recipientName} size="sm" className="shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{entry.recipientName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[entry.recipientRole, entry.trade].filter(Boolean).join(' \u00B7 ') || '\u2014'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1.5 min-w-[140px]">
                      <span className="font-medium text-foreground">{entry.bonusCount} award{entry.bonusCount !== 1 ? 's' : ''}</span>
                      <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-500' : 'bg-primary/70'
                          )}
                          style={{ width: `${Math.round((entry.totalAmount / topAmount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {entry.paidCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <CheckCircleIcon className="size-2.5" />{entry.paidCount} Paid
                        </span>
                      )}
                      {entry.approvedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                          <CheckIcon className="size-2.5" />{entry.approvedCount} Approved
                        </span>
                      )}
                      {entry.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                          <ClockIcon className="size-2.5" />{entry.pendingCount} Pending
                        </span>
                      )}
                      {entry.paidCount === 0 && entry.approvedCount === 0 && entry.pendingCount === 0 && (
                        <span className="text-[11px] text-muted-foreground">\u2014</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {formatCurrency(entry.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onView(entry.records[0])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <EyeIcon className="size-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination {...pager.pagination} />
          </div>
        )}
      </div>
    </div>
  );
}
export function IncentivesPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  const [incentives, setIncentives] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('project');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // Modals
  const [viewIncentive, setViewIncentive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Add Incentive Form
  const [formEmployee, setFormEmployee] = useState(currentUser?.name || 'Ramesh Shinde');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('Approved');

  const [paymentsList, setPaymentsList] = useState([
    {
      id: 'p-1',
      title: '',
      paymentMethod: 'Cash',
      category: INCENTIVE_CATEGORIES[0] || 'On-Time Completion',
      amount: '',
      tax: '0',
      time: new Date().toTimeString().slice(0, 5),
      proof: null,
      proofName: '',
    },
  ]);

  const reloadData = async () => {
    try {
      const rows = await incentiveService.getIncentives();
      setIncentives(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(error?.message || 'Failed to load incentives');
      setIncentives([]);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // KPI stats
  const stats = useMemo(() => {
    const totalCount = incentives.length;
    const pendingCount = incentives.filter((i) => i.status === 'PENDING').length;
    const approvedCount = incentives.filter((i) => i.status === 'APPROVED' || i.status === 'PAID').length;
    const totalAmount = incentives.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    return { totalCount, pendingCount, approvedCount, totalAmount };
  }, [incentives]);

  // Filtered list - all filters actually working
  const filteredIncentives = useMemo(() => {
    return incentives.filter((inc) => {
      if (statusFilter !== 'ALL') {
        if ((inc.status || '').toUpperCase() !== statusFilter.toUpperCase()) return false;
      }
      if (categoryFilter !== 'ALL') {
        if (inc.category !== categoryFilter) return false;
      }
      if (paymentFilter !== 'ALL') {
        const pm = (inc.paymentMethod || '').toLowerCase();
        if (!pm.includes(paymentFilter.toLowerCase())) return false;
      }
      if (dateFrom) {
        if (!inc.awardedDate || inc.awardedDate < dateFrom) return false;
      }
      if (dateTo) {
        if (!inc.awardedDate || inc.awardedDate > dateTo) return false;
      }
      if (amountMin !== '') {
        if ((Number(inc.amount) || 0) < Number(amountMin)) return false;
      }
      if (amountMax !== '') {
        if ((Number(inc.amount) || 0) > Number(amountMax)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (inc.recipientName || '').toLowerCase().includes(q) ||
          (inc.title || '').toLowerCase().includes(q) ||
          (inc.category || '').toLowerCase().includes(q) ||
          (inc.projectName || '').toLowerCase().includes(q) ||
          (inc.description || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [incentives, statusFilter, categoryFilter, paymentFilter, dateFrom, dateTo, amountMin, amountMax, searchQuery]);

  const handleApprove = async (inc) => {
    try {
      await incentiveService.updateIncentiveStatus(inc.id, 'APPROVED');
      toast.success(`Incentive for ${inc.recipientName} approved`);
      await reloadData();
    } catch { toast.error('Failed to update status'); }
  };

  const handleReject = async (inc) => {
    try {
      await incentiveService.updateIncentiveStatus(inc.id, 'REJECTED');
      toast.success(`Incentive for ${inc.recipientName} rejected`);
      await reloadData();
    } catch { toast.error('Failed to update status'); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await incentiveService.deleteIncentive(deleteTarget.id);
      toast.success('Incentive deleted');
      setDeleteTarget(null);
      await reloadData();
    } catch { toast.error('Failed to delete incentive'); }
  };

  const handleAddPaymentRow = () => {
    setPaymentsList((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        title: '',
        paymentMethod: 'Cash',
        category: INCENTIVE_CATEGORIES[1] || 'Quality Excellence',
        amount: '',
        tax: '0',
        time: new Date().toTimeString().slice(0, 5),
        proof: null,
        proofName: '',
      },
    ]);
  };

  const handleRemovePaymentRow = (idx) => {
    if (paymentsList.length <= 1) return;
    setPaymentsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const formTotalAmount = useMemo(() =>
    paymentsList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [paymentsList]
  );

  const handleSaveIncentive = async (e) => {
    e.preventDefault();
    if (!paymentsList.some((p) => Number(p.amount) > 0)) {
      toast.error('Please enter at least one valid amount');
      return;
    }
    try {
      const selectedUserObj = mockUsers.find((u) => u.name === formEmployee) || mockUsers[0];
      await Promise.all(paymentsList.map((pay) => {
        return incentiveService.createIncentive({
          recipientId: selectedUserObj?.id || 'u4',
          recipientName: formEmployee,
          recipientRole: selectedUserObj?.role || 'Artisan',
          trade: selectedUserObj?.department || 'Carpentry',
          projectId: 'P1',
          projectName: 'Indiranagar 4BHK Luxury Villa',
          category: pay.category || 'Special Achievement',
          title: pay.title || 'Incentive Award',
          description: formDescription || '',
          amount: parseFloat(pay.amount) || 0,
          status: formStatus.toUpperCase(),
          paymentMethod: pay.paymentMethod || 'Cash',
          awardedDate: formDate,
          proof: pay.proof,
        });
      }));
      toast.success(`Incentive saved - Total: ${formatCurrency(formTotalAmount)}`);
      await reloadData();
      setViewMode('list');
      setFormDescription('');
      setPaymentsList([{
        id: 'p-1', title: '', paymentMethod: 'Cash',
        category: INCENTIVE_CATEGORIES[0], amount: '', tax: '0',
        time: new Date().toTimeString().slice(0, 5), proof: null, proofName: '',
      }]);
    } catch { toast.error('Failed to save incentive'); }
  };

  // ---------------------------------------------------------------------------
  // ADD INCENTIVE FORM VIEW
  // ---------------------------------------------------------------------------
  if (viewMode === 'add') {
    return (
      <div className="space-y-5 pb-16 animate-in fade-in duration-200">
        {/* Back Navigation - no title tooltip */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Add Incentive</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Log a new team incentive award or bonus</p>
          </div>
        </div>

        <form onSubmit={handleSaveIncentive} className="space-y-5">
          {/* Section 1: INCENTIVE DETAILS */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-5 py-3.5 border-b border-border">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Incentive Details
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Employee</label>
                <select
                  value={formEmployee}
                  onChange={(e) => setFormEmployee(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {mockUsers.map((u) => (
                    <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Description</label>
                <textarea
                  rows={3}
                  placeholder="What was this incentive award for?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Status <span className="text-destructive">*</span>
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: AMOUNT & PAYMENT */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Amount & Payment
              </span>
              <span className="text-sm font-bold font-mono text-foreground">
                {formatCurrency(formTotalAmount)}
              </span>
            </div>

            <div className="px-5 py-4 space-y-4">
              {paymentsList.map((pay, idx) => (
                <div key={pay.id} className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
                    <span className="text-xs font-semibold text-foreground">Payment {idx + 1}</span>
                    {paymentsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(idx)}
                        className="text-xs text-destructive hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          Title <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Early delivery bonus"
                          value={pay.title}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], title: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          Payment Method <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={pay.paymentMethod}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], paymentMethod: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          {PAYMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          Category <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={pay.category}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], category: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          {INCENTIVE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          Amount (₹) <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="0"
                          value={pay.amount}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], amount: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">Tax (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={pay.tax}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], tax: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-muted-foreground">
                          Time <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="time"
                          value={pay.time}
                          onChange={(e) => {
                            const u = [...paymentsList]; u[idx] = { ...u[idx], time: e.target.value }; setPaymentsList(u);
                          }}
                          className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-muted-foreground">Receipt / Proof</label>
                      <div className="flex items-center gap-3">
                        <label className="h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors inline-flex items-center gap-1.5">
                          <CameraIcon className="size-3.5 text-primary" />
                          <span>Choose file</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const u = [...paymentsList];
                                  u[idx] = { ...u[idx], proof: ev.target.result, proofName: file.name };
                                  setPaymentsList(u);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <span className="text-xs text-muted-foreground truncate">
                          {pay.proofName || 'No file chosen'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPaymentRow}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-dashed"
              >
                <PlusIcon className="size-3.5" />
                <span>Add Another Payment</span>
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-xs"
          >
            <SaveIcon className="size-4" />
            <span>Save Incentive</span>
          </Button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN VIEW - kept as placeholder while Incentives workflow is in development
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center animate-in fade-in duration-200">
      <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
        &lt;in development&gt;
      </span>
      <p className="text-xs text-muted-foreground">
        This page is currently under development and will be available soon.
      </p>
    </div>
  );
}
export default IncentivesPage;
