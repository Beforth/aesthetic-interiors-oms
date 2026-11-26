'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { projectService } from '../services/projectService';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../data/expenses';
import { formatCurrency, formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';
import { usePagination } from '../hooks/usePagination';

import PageHeader from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Avatar from '../components/ui/Avatar';
import Tabs from '../components/ui/Tabs';
import DataToolbar from '../components/ui/DataToolbar';
import StatCard from '../components/ui/StatCard';
import Table from '../components/ui/Table';
import Select from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import AddExpenseView, { PAYMENT_OPTIONS } from '../components/domain/AddExpenseView';
import AdvanceRequestModal from '../components/domain/AdvanceRequestModal';

import {
  PlusIcon,
  SearchIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  CameraIcon,
  IndianRupeeIcon,
  ReceiptIcon,
  WalletIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  Building2Icon,
  CalendarIcon,
  CreditCardIcon,
  PhoneIcon,
  LandmarkIcon,
  BanknoteIcon,
} from '../components/ui/icons';
import MoneyInput from '../components/ui/MoneyInput';
import Textarea from '../components/ui/Textarea';

// ---------------------------------------------------------------------------
// Payment chip renderer — 5 options, pill style, icon + label
// ---------------------------------------------------------------------------

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
  if (m === 'net banking' || m === 'net banking / neft') return (
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

const initialSalaryAdvances = [
  {
    id: 'adv-1',
    employee: 'Amit Deshmukh',
    title: 'Medical Emergency Loan',
    amount: 15000,
    dateRequired: '2026-11-10',
    reason: 'Urgent hospitalisation advance and medication expenses for family member.',
    status: 'approved',
    createdAt: '2026-11-01',
  },
  {
    id: 'adv-2',
    employee: 'nilesh',
    title: 'Festival Advance',
    amount: 10000,
    dateRequired: '2026-11-12',
    reason: 'Festival expenses, travel tickets and family commitments.',
    status: 'pending',
    createdAt: '2026-11-04',
  },
  {
    id: 'adv-3',
    employee: 'Vikas Jadhav',
    title: 'House Relocation Advance',
    amount: 8000,
    dateRequired: '2026-11-15',
    reason: 'Apartment shifting transport and security deposit advance.',
    status: 'approved',
    createdAt: '2026-10-28',
  },
];

export function ExpensesPage({ mode }) {
  const { currentUser, role } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Shared delete confirmation target
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Tab State: 'claims' (Business Claims) or 'advances' (Salary Advances)
  const currentTab = useMemo(() => {
    if (mode === 'advances' || location.pathname.includes('/expenses/advances')) return 'advances';
    return 'claims';
  }, [mode, location.pathname]);

  const handleTabChange = (tabKey) => {
    navigate(tabKey === 'advances' ? '/expenses/advances' : '/expenses/claims');
  };

  const isAdminOrManager =
    role === 'admin' || role === 'owner' || role === 'manager';

  // ---------------------------------------------------------------------------
  // 1. BUSINESS CLAIMS (EXPENSES) STATE
  // ---------------------------------------------------------------------------
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Business Claims Filters
  const [claimSearch, setClaimSearch] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL');
  const [claimCategoryFilter, setClaimCategoryFilter] = useState('ALL');
  const [claimPaymentFilter, setClaimPaymentFilter] = useState('ALL');

  // The full-screen Add Expense form (shared component)
  const [isAddExpenseView, setIsAddExpenseView] = useState(false);

  // View Voucher Modal
  const [viewingClaim, setViewingClaim] = useState(null);

  // Load Expenses Data
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const [expList, projList] = await Promise.all([
        expenseService.getAllExpenses(),
        projectService.getAllProjects(),
      ]);
      setExpenses(expList || []);
      setProjects(projList || []);
    } catch (err) {
      console.error('Failed to load expenses', err);
      toast.error('Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Filtered Business Claims
  const filteredClaims = useMemo(() => {
    return expenses.filter((e) => {
      const q = claimSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (e.spentBy && e.spentBy.toLowerCase().includes(q)) ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        String(e.amount || '').includes(q);

      const matchesStatus =
        claimStatusFilter === 'ALL' || e.status?.toLowerCase() === claimStatusFilter.toLowerCase();

      const matchesCategory =
        claimCategoryFilter === 'ALL' ||
        (e.category && e.category.toLowerCase().includes(claimCategoryFilter.toLowerCase()));

      const matchesPayment =
        claimPaymentFilter === 'ALL' ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(claimPaymentFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesCategory && matchesPayment;
    });
  }, [expenses, claimSearch, claimStatusFilter, claimCategoryFilter, claimPaymentFilter]);

  // Business Claims Statistics (4 Stat Cards from Screenshot 5)
  const claimStats = useMemo(() => {
    const live = expenses.filter((e) => e.status !== 'withdrawn'); // a withdrawn claim is not counted
    const totalCount = live.length;
    const pendingCount = live.filter((e) => e.status === 'pending').length;
    const approvedCount = live.filter((e) => e.status === 'approved' || e.status === 'reimbursed').length;
    const totalAmount = live.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { totalCount, pendingCount, approvedCount, totalAmount };
  }, [expenses]);

  /** Saves what the shared Add Expense form collected: one claim per payment row. */
  const handleCreateClaims = async ({ employee, date, description, status, payments }) => {
    const staffName = employee === 'Myself' ? currentUser?.name || 'Staff Member' : employee;
    for (const p of payments) {
      if (!Number(p.amount) > 0) continue;
      await expenseService.createExpense({
        title: p.title || description || 'General Business Claim',
        category: p.category || 'Office',
        amount: Number(p.amount) || 0,
        date,
        spentBy: staffName,
        paymentMethod: p.paymentMethod || 'Cash',
        status: status === 'draft' ? 'pending' : status,
        notes: description || '',
        receiptName: p.receiptName || '',
        receiptUrl: p.receiptUrl || '',
        projectId: projects[0]?.id || '',
        projectName: 'General Overhead',
      });
    }
    toast.success('Expense claim saved successfully!');
    setIsAddExpenseView(false);
    fetchExpenses();
  };

  const handleQuickStatusUpdate = async (id, newStatus) => {
    try {
      await expenseService.updateExpenseStatus(id, newStatus, currentUser?.name || 'Admin');
      toast.success(`Expense marked as ${newStatus}`);
      fetchExpenses();
      if (viewingClaim && viewingClaim.id === id) {
        const updated = await expenseService.getExpenseById(id);
        setViewingClaim(updated);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteExpense = (id) => setDeleteTarget({ type: 'expense', id });

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      if (target.type === 'expense') {
        await expenseService.deleteExpense(target.id);
        toast.success('Expense record deleted');
        fetchExpenses();
      } else {
        await expenseService.deleteSalaryAdvance(target.id, advances);
        await fetchAdvances();
        toast.success('Salary advance record deleted');
      }
    } catch {
      toast.error(target.type === 'expense' ? 'Failed to delete expense record' : 'Failed to delete salary advance');
    }
    setDeleteTarget(null);
  };

  // ---------------------------------------------------------------------------
  // 2. SALARY ADVANCES STATE (Screenshots 1 & 2)
  // ---------------------------------------------------------------------------
  const [advances, setAdvances] = useState([]);

  const fetchAdvances = async () => {
    try {
      const rows = await expenseService.getAllSalaryAdvances(initialSalaryAdvances);
      setAdvances(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Failed to load salary advances', error);
      toast.error('Failed to load salary advances');
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  // Salary Advances Filters
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('All');

  // Request Salary Advance window (shared component)
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

  // Filtered Advances List
  const filteredAdvances = useMemo(() => {
    return advances.filter((item) => {
      if (advanceStatusFilter !== 'All' && item.status.toLowerCase() !== advanceStatusFilter.toLowerCase()) {
        return false;
      }
      if (advanceSearch.trim()) {
        const q = advanceSearch.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchEmp = (item.employee || '').toLowerCase().includes(q);
        const matchReason = (item.reason || '').toLowerCase().includes(q);
        const matchAmt = String(item.amount || '').includes(q);
        if (!matchTitle && !matchEmp && !matchReason && !matchAmt) return false;
      }
      return true;
    });
  }, [advances, advanceStatusFilter, advanceSearch]);

  const claimPager = usePagination(filteredClaims);
  const advancePager = usePagination(filteredAdvances);

  // Salary Advances Statistics (3 Stat Cards from Screenshot 2)
  const advanceStats = useMemo(() => {
    const totalApproved = advances
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const pendingCount = advances.filter((a) => a.status === 'pending').length;
    const totalSubmitted = advances.length;
    return { totalApproved, pendingCount, totalSubmitted };
  }, [advances]);

  const handleRequestAdvance = async ({ title, amount, dateRequired, reason }) => {
    await expenseService.createSalaryAdvance(
      {
        employee: currentUser?.name || 'Amit Deshmukh',
        employeeId: currentUser?.id || '',
        title,
        amount,
        dateRequired,
        reason,
      },
      initialSalaryAdvances
    );
    await fetchAdvances();
    toast.success('Salary advance request submitted successfully!');
    setIsAdvanceModalOpen(false);
  };

  const handleAdvanceStatusUpdate = async (id, newStatus) => {
    try {
      await expenseService.updateSalaryAdvanceStatus(id, newStatus, {}, advances);
      await fetchAdvances();
      toast.success(`Salary advance marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update salary advance');
    }
  };

  const handleDeleteAdvance = (id) => setDeleteTarget({ type: 'advance', id });

  // ---------------------------------------------------------------------------
  // 3. SALARY ADVANCES VIEW MODAL STATE
  // ---------------------------------------------------------------------------
  const [viewingAdvance, setViewingAdvance] = useState(null);

  // ---------------------------------------------------------------------------
  // 4. PARTIAL APPROVAL MODAL STATE (admin can enter approved amount + reason)
  // ---------------------------------------------------------------------------
  const [approvalModal, setApprovalModal] = useState(null); // { advance } or null
  const [approvalForm, setApprovalForm] = useState({ approvedAmount: '', approvalNote: '' });

  const openApprovalModal = (advance) => {
    setApprovalForm({
      approvedAmount: String(advance.amount),
      approvalNote: '',
    });
    setApprovalModal({ advance });
  };

  const handlePartialApprove = async (e) => {
    e.preventDefault();
    const amt = Number(approvalForm.approvedAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid approved amount');
      return;
    }

    try {
      const refreshed = await expenseService.updateSalaryAdvanceStatus(
        approvalModal.advance.id,
        'approved',
        {
          approvedAmount: amt,
          approvalNote: approvalForm.approvalNote.trim(),
          reviewerName: currentUser?.name || 'Admin',
        },
        advances
      );
      await fetchAdvances();
      toast.success(`Advance approved for ${formatCurrency(amt)}`);
      setApprovalModal(null);
      // keep view modal in sync if open
      if (viewingAdvance && String(viewingAdvance.id) === String(approvalModal.advance.id)) {
        setViewingAdvance(refreshed || null);
      }
    } catch {
      toast.error('Failed to approve salary advance');
    }
  };

  // (payment chip and category helpers defined at module level above)

  // ---------------------------------------------------------------------------
  // FULL PAGE VIEW: ADD EXPENSE (shared with the worker's Expenses tab)
  // ---------------------------------------------------------------------------
  if (isAddExpenseView) {
    return (
      <AddExpenseView
        employeeOptions={[
          { value: 'Myself', label: `Myself (${currentUser?.name || 'Admin'})` },
          { value: 'Amit Deshmukh', label: 'Amit Deshmukh' },
          { value: 'nilesh', label: 'nilesh' },
          { value: 'Super Admin', label: 'Super Admin' },
          { value: 'Vikas Jadhav', label: 'Vikas Jadhav' },
        ]}
        onBack={() => setIsAddExpenseView(false)}
        onSubmit={handleCreateClaims}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN EXPENSES PAGE (Business Claims or Salary Advances)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      <Tabs
        activeTab={currentTab}
        onChange={handleTabChange}
        tabs={[
          { id: 'claims', label: 'Business Claims' },
          { id: 'advances', label: 'Salary Advances' },
        ]}
      />

      {/* ===================================================================== */}
      {/* VIEW: BUSINESS CLAIMS (Screenshot 5)                                  */}
      {/* ===================================================================== */}
      {currentTab === 'claims' && (
        <div className="space-y-4">
          {/* Header */}
          <PageHeader
            title="Expenses"
            subtitle="Company expense reimbursement claims"
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddExpenseView(true)}
                className="flex items-center gap-1.5 shadow-2xs"
              >
                <PlusIcon className="size-4" />
                <span>Add Expense</span>
              </Button>
            }
          />

          {/* Summary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard variant="inline" label="Total Expenses" value={claimStats.totalCount} icon={<ReceiptIcon className="size-5" />} />
            <StatCard variant="inline" label="Pending" value={claimStats.pendingCount} tone="warning" icon={<ClockIcon className="size-5" />} />
            <StatCard variant="inline" label="Approved" value={claimStats.approvedCount} tone="success" icon={<CheckCircleIcon className="size-5" />} />
            <StatCard variant="inline" label="Total Amount" value={formatCurrency(claimStats.totalAmount)} tone="primary" icon={<IndianRupeeIcon className="size-5" />} />
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            searchValue={claimSearch}
            onSearchChange={setClaimSearch}
            searchPlaceholder="Search expenses..."
            filters={[
              <Select
                key="status"
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                placeholder=""
                className="h-9 w-32 text-xs"
                options={[
                  { value: 'ALL', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'withdrawn', label: 'Withdrawn' },
                ]}
              />,
              <Select
                key="category"
                value={claimCategoryFilter}
                onChange={(e) => setClaimCategoryFilter(e.target.value)}
                placeholder=""
                className="h-9 w-36 text-xs"
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  { value: 'Software', label: 'Software' },
                  { value: 'Office', label: 'Office' },
                  { value: 'Travel', label: 'Travel' },
                  { value: 'Subscriptions', label: 'Subscriptions' },
                  { value: 'Site Materials', label: 'Site Materials' },
                ]}
              />,
              <Select
                key="payment"
                value={claimPaymentFilter}
                onChange={(e) => setClaimPaymentFilter(e.target.value)}
                placeholder=""
                className="h-9 w-32 text-xs"
                options={[
                  { value: 'ALL', label: 'All Payments' },
                  ...PAYMENT_OPTIONS.map((opt) => ({ value: opt, label: opt })),
                ]}
              />,
            ]}
          />

          <Table
            variant="clean"
            loading={loading}
            columns={[
              {
                key: 'spentBy',
                header: 'Employee',
                render: (item) => (
                  <span className={cn('font-semibold text-foreground', item.status === 'withdrawn' && 'opacity-50')}>{item.spentBy}</span>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (item) => <span className="text-xs font-medium text-primary">{item.category || 'Office'}</span>,
              },
              {
                key: 'date',
                header: 'Date',
                render: (item) => <span className="font-mono text-muted-foreground">{item.date || '—'}</span>,
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (item) => (
                  <span className={cn('font-mono font-semibold text-foreground', item.status === 'withdrawn' && 'opacity-50')}>{formatCurrency(item.amount)}</span>
                ),
              },
              {
                key: 'paymentMethod',
                header: 'Payment',
                render: (item) => renderPaymentChip(item.paymentMethod),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => (
                  <Badge
                    variant={
                      item.status === 'approved' || item.status === 'reimbursed'
                        ? 'success'
                        : item.status === 'rejected'
                        ? 'danger'
                        : item.status === 'withdrawn'
                        ? 'neutral'
                        : 'warning'
                    }
                    dot
                  >
                    {item.status === 'approved' || item.status === 'reimbursed'
                      ? 'Approved'
                      : item.status === 'rejected'
                      ? 'Rejected'
                      : item.status === 'withdrawn'
                      ? 'Withdrawn'
                      : 'Pending'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (item) => (
                  <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setViewingClaim(item)}
                      className="p-1.5 hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                      title="View expense"
                    >
                      <EyeIcon className="size-3.5" />
                    </button>
                    {isAdminOrManager && item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(item.id, 'approved')}
                          className="p-1.5 hover:text-success hover:bg-success/10 rounded transition-colors cursor-pointer"
                          title="Approve"
                        >
                          <CheckCircleIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(item.id, 'rejected')}
                          className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                          title="Reject"
                        >
                          <XCircleIcon className="size-3.5" />
                        </button>
                      </>
                    )}
                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={claimPager.paginatedItems}
            pagination={claimPager.pagination}
            keyField="id"
            emptyTitle="No expenses found"
            emptyDescription="No expense claims match the current filters."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: SALARY ADVANCES (Screenshot 2)                                  */}
      {/* ===================================================================== */}
      {currentTab === 'advances' && (
        <div className="space-y-4">
          {/* Header */}
          <PageHeader
            title="Salary Advances"
            subtitle="Manage employee salary advances & emergency cash loans"
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAdvanceModalOpen(true)}
                className="flex items-center gap-1.5 shadow-2xs"
              >
                <PlusIcon className="size-4" />
                <span>Request Salary Advance</span>
              </Button>
            }
          />

          {/* Summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard variant="inline" label="Total Approved Advances" value={formatCurrency(advanceStats.totalApproved)} tone="success" icon={<IndianRupeeIcon className="size-5" />} />
            <StatCard variant="inline" label="Pending Requests" value={advanceStats.pendingCount} tone="warning" icon={<ClockIcon className="size-5" />} />
            <StatCard variant="inline" label="Total Requests Submitted" value={advanceStats.totalSubmitted} tone="primary" icon={<CheckCircleIcon className="size-5" />} />
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            searchValue={advanceSearch}
            onSearchChange={setAdvanceSearch}
            searchPlaceholder="Search advances..."
            filters={
              <Select
                value={advanceStatusFilter}
                onChange={(e) => setAdvanceStatusFilter(e.target.value)}
                placeholder=""
                className="h-9 w-32 text-xs"
                options={[
                  { value: 'All', label: 'All' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                  { value: 'Withdrawn', label: 'Withdrawn' },
                ]}
              />
            }
          />

          <Table
            variant="clean"
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (item) => (
                  <span className={cn('font-semibold text-foreground', item.status === 'withdrawn' && 'opacity-50')}>{item.employee}</span>
                ),
              },
              {
                key: 'title',
                header: 'Title / Purpose',
                render: (item) => (
                  <span className={cn('font-medium text-foreground', item.status === 'withdrawn' && 'opacity-50')}>{item.title}</span>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (item) => (
                  <div className="font-mono font-semibold text-foreground">
                    {item.status === 'approved' && item.approvedAmount != null ? (
                      <span className="text-success">{formatCurrency(item.approvedAmount)}</span>
                    ) : (
                      formatCurrency(item.amount)
                    )}
                    {item.status === 'approved' &&
                      item.approvedAmount != null &&
                      item.approvedAmount !== item.amount && (
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          req. {formatCurrency(item.amount)}
                        </span>
                      )}
                  </div>
                ),
              },
              {
                key: 'dateRequired',
                header: 'Date Required',
                render: (item) => (
                  <span className="text-muted-foreground">
                    {item.dateRequired ? formatDate(item.dateRequired) : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => (
                  <Badge
                    variant={
                      item.status === 'approved'
                        ? 'success'
                        : item.status === 'rejected'
                        ? 'danger'
                        : item.status === 'withdrawn'
                        ? 'neutral'
                        : 'warning'
                    }
                    dot
                  >
                    {item.status === 'approved'
                      ? 'Approved'
                      : item.status === 'rejected'
                      ? 'Rejected'
                      : item.status === 'withdrawn'
                      ? 'Withdrawn'
                      : 'Pending'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (item) => (
                  <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setViewingAdvance(item)}
                      className="p-1.5 hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                      title="View details"
                    >
                      <EyeIcon className="size-3.5" />
                    </button>
                    {isAdminOrManager && item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openApprovalModal(item)}
                          className="p-1.5 hover:text-success hover:bg-success/10 rounded transition-colors cursor-pointer"
                          title="Approve advance"
                        >
                          <CheckCircleIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatusUpdate(item.id, 'rejected')}
                          className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                          title="Reject advance"
                        >
                          <XCircleIcon className="size-3.5" />
                        </button>
                      </>
                    )}
                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAdvance(item.id)}
                        className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={advancePager.paginatedItems}
            pagination={advancePager.pagination}
            keyField="id"
            emptyTitle="No salary advance requests found"
            emptyDescription="No employees have submitted salary advance requests yet."
          />
        </div>
      )}

      <AdvanceRequestModal isOpen={isAdvanceModalOpen} onClose={() => setIsAdvanceModalOpen(false)} onSubmit={handleRequestAdvance} />

      {/* ===================================================================== */}
      {/* MODAL: VIEW ADVANCE DETAILS (reason + approval info)                 */}
      {/* ===================================================================== */}
      {viewingAdvance && (
        <Modal
          isOpen={Boolean(viewingAdvance)}
          onClose={() => setViewingAdvance(null)}
          title="Salary Advance Details"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Employee:</span>
                <span className="text-xs font-bold text-foreground">{viewingAdvance.employee}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Title / Purpose:</span>
                <span className="text-xs font-semibold text-foreground">{viewingAdvance.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Requested Amount:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {formatCurrency(viewingAdvance.amount)}
                </span>
              </div>
              {viewingAdvance.status === 'approved' && viewingAdvance.approvedAmount != null && (
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-xs text-muted-foreground">Approved Amount:</span>
                  <span className="text-sm font-mono font-bold text-emerald-600">
                    {formatCurrency(viewingAdvance.approvedAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Date Required:</span>
                <span className="text-xs font-mono text-foreground">
                  {viewingAdvance.dateRequired ? formatDate(viewingAdvance.dateRequired) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status:</span>
                <span
                  className={cn(
                    'text-xs font-bold capitalize',
                    viewingAdvance.status === 'approved'
                      ? 'text-emerald-600'
                      : viewingAdvance.status === 'rejected'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  )}
                >
                  {viewingAdvance.status}
                </span>
              </div>
              {viewingAdvance.approvedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Approved By:</span>
                  <span className="text-xs text-foreground">{viewingAdvance.approvedBy}</span>
                </div>
              )}
            </div>

            {viewingAdvance.reason ? (
              <div>
                <span className="text-xs font-bold text-muted-foreground block mb-1">
                  Reason / Explanation
                </span>
                <p className="text-xs text-foreground bg-card p-3 rounded-lg border border-border leading-relaxed">
                  {viewingAdvance.reason}
                </p>
              </div>
            ) : null}

            {viewingAdvance.approvalNote ? (
              <div>
                <span className="text-xs font-bold text-muted-foreground block mb-1">
                  Admin Note (Approval)
                </span>
                <p className="text-xs text-foreground bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 leading-relaxed">
                  {viewingAdvance.approvalNote}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              {isAdminOrManager && viewingAdvance.status === 'pending' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleAdvanceStatusUpdate(viewingAdvance.id, 'rejected');
                      setViewingAdvance(null);
                    }}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setViewingAdvance(null);
                      openApprovalModal(viewingAdvance);
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingAdvance(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL: PARTIAL / CUSTOM APPROVAL (admin sets approved amount + note)  */}
      {/* ===================================================================== */}
      {approvalModal && (
        <Modal
          isOpen={Boolean(approvalModal)}
          onClose={() => setApprovalModal(null)}
          title="Approve Salary Advance"
        >
          <form onSubmit={handlePartialApprove} className="space-y-4 pt-1">
            {/* Summary of the request */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee:</span>
                <span className="font-semibold text-foreground">{approvalModal.advance.employee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requested Amount:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(approvalModal.advance.amount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Approved Amount (₹) *
              </label>
              <MoneyInput
               
                required
                min="1"
                value={approvalForm.approvedAmount}
                onChange={(e) =>
                  setApprovalForm({ ...approvalForm, approvedAmount: e.target.value })
                }
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                You can approve less or more than the requested amount.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Reason / Note for Staff
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. Approved partial amount due to policy limit…"
                value={approvalForm.approvalNote}
                onChange={(e) =>
                  setApprovalForm({ ...approvalForm, approvalNote: e.target.value })
                }
                className="w-full resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setApprovalModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="px-4 shadow-2xs font-semibold"
              >
                Confirm Approval
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL: VIEW EXPENSE CLAIM DETAILS                                     */}
      {/* ===================================================================== */}
      {viewingClaim && (
        <Modal
          isOpen={Boolean(viewingClaim)}
          onClose={() => setViewingClaim(null)}
          title="Expense Claim Details"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Employee:</span>
                <span className="text-xs font-bold text-foreground">{viewingClaim.spentBy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Category:</span>
                <span className="text-xs font-semibold text-primary">{viewingClaim.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Date:</span>
                <span className="text-xs font-mono text-foreground">{viewingClaim.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Payment Mode:</span>
                <span className="text-xs font-medium text-foreground">{viewingClaim.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="text-xs font-bold text-foreground">Claim Amount:</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {formatCurrency(viewingClaim.amount)}
                </span>
              </div>
            </div>

            {viewingClaim.notes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground block mb-1">
                  Description / Purpose
                </span>
                <p className="text-xs text-foreground bg-card p-3 rounded-lg border border-border">
                  {viewingClaim.notes}
                </p>
              </div>
            )}

            {viewingClaim.receiptUrl && (
              <div>
                <span className="text-xs font-bold text-muted-foreground block mb-1">
                  Attached Receipt
                </span>
                <img
                  src={viewingClaim.receiptUrl}
                  alt="Receipt"
                  className="max-h-56 rounded-lg border border-border object-contain mx-auto"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              {isAdminOrManager && viewingClaim.status === 'pending' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleQuickStatusUpdate(viewingClaim.id, 'rejected');
                    }}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleQuickStatusUpdate(viewingClaim.id, 'approved');
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingClaim(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Confirm delete"
        message={`Are you sure you want to delete this ${
          deleteTarget?.type === 'expense' ? 'expense record' : 'salary advance request'
        }? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

export default ExpensesPage;
