import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expenseService } from '../services/expenseService';
import { projectService } from '../services/projectService';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, EXPENSE_STATUSES } from '../data/expenses';
import { formatCurrency, formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';
import { compressImage, formatFileSize } from '../utils/dsr';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/badge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { StatCard } from '../components/ui/StatCard';

import {
  PlusIcon,
  SearchIcon,
  DownloadIcon,
  FilterIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  FileIcon,
  CameraIcon,
  UploadIcon,
  AlertCircleIcon,
  IndianRupeeIcon,
  ReceiptIcon,
  WalletIcon,
  ClockIcon,
  CheckCircleIcon,
  Building2Icon,
} from '../components/ui/icons';

export function ExpensesPage() {
  const { currentUser, role } = useAuth();
  const toast = useToast();
  const isAdminOrManager = role === 'admin' || role === 'owner' || role === 'manager';

  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalAmount: 0,
    approvedAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    reimbursedAmount: 0,
    topCategory: 'None',
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    projectId: '',
    projectName: '',
    spentBy: currentUser?.name || 'You',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: PAYMENT_METHODS[0],
    notes: '',
    status: 'pending',
    receiptName: '',
    receiptUrl: '',
    receiptType: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const fileInputRef = useRef(null);

  // View Modal State
  const [viewingExpense, setViewingExpense] = useState(null);

  // Delete Confirm Dialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchExpensesAndProjects = async () => {
    try {
      setLoading(true);
      const [expList, projList, expStats] = await Promise.all([
        expenseService.getAllExpenses(),
        projectService.getAllProjects(),
        expenseService.getExpenseStats(),
      ]);
      setExpenses(expList);
      setProjects(projList || []);
      setStats(expStats);
    } catch (err) {
      console.error('Failed to load expenses', err);
      toast.error('Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesAndProjects();
  }, []);

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.projectName && e.projectName.toLowerCase().includes(q)) ||
        (e.spentBy && e.spentBy.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'ALL' || e.category === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
      const matchesProject =
        projectFilter === 'ALL' ||
        (projectFilter === 'overhead' ? !e.projectId : String(e.projectId) === String(projectFilter));

      return matchesSearch && matchesCategory && matchesStatus && matchesProject;
    });
  }, [expenses, search, categoryFilter, statusFilter, projectFilter]);

  // Tab counts for quick status filtering
  const statusCounts = useMemo(() => {
    const counts = { ALL: expenses.length, pending: 0, approved: 0, reimbursed: 0, rejected: 0 };
    expenses.forEach((e) => {
      if (counts[e.status] !== undefined) counts[e.status]++;
    });
    return counts;
  }, [expenses]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      title: '',
      category: EXPENSE_CATEGORIES[0],
      amount: '',
      projectId: '',
      projectName: '',
      spentBy: currentUser?.name || 'Staff Member',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: PAYMENT_METHODS[0],
      notes: '',
      status: isAdminOrManager ? 'approved' : 'pending',
      receiptName: '',
      receiptUrl: '',
      receiptType: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setFormData({
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      projectId: exp.projectId || '',
      projectName: exp.projectName || 'General Studio / Overhead',
      spentBy: exp.spentBy,
      date: exp.date,
      paymentMethod: exp.paymentMethod,
      notes: exp.notes || '',
      status: exp.status,
      receiptName: exp.receiptName || '',
      receiptUrl: exp.receiptUrl || '',
      receiptType: exp.receiptType || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleReceiptUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    try {
      const processed = await compressImage(file, 1400, 0.85);
      setFormData((prev) => ({
        ...prev,
        receiptName: processed.name,
        receiptUrl: processed.url,
        receiptType: processed.type,
      }));
      toast.success(`Attached receipt: ${processed.name}`);
    } catch (err) {
      console.error('Failed to attach receipt', err);
      toast.error('Could not process receipt file');
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.title?.trim()) {
      errs.title = 'Expense title or description is required';
    }
    const amt = Number(formData.amount);
    if (!formData.amount || Number.isNaN(amt) || amt <= 0) {
      errs.amount = 'Please enter a valid expense amount';
    }
    if (!formData.date) {
      errs.date = 'Date incurred is required';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      let selectedProjName = 'General Studio / Overhead';
      if (formData.projectId) {
        const found = projects.find((p) => String(p.id) === String(formData.projectId));
        if (found) selectedProjName = found.name;
      }

      const payload = {
        ...formData,
        amount: Number(formData.amount),
        projectName: selectedProjName,
      };

      if (editingExpense) {
        await expenseService.updateExpense(editingExpense.id, payload);
        toast.success('Expense record updated successfully');
      } else {
        await expenseService.createExpense(payload);
        toast.success('Expense recorded successfully');
      }

      setIsModalOpen(false);
      fetchExpensesAndProjects();
    } catch (err) {
      console.error('Failed to save expense', err);
      toast.error(err.message || 'Failed to save expense');
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await expenseService.updateExpenseStatus(id, newStatus, currentUser?.name || 'Admin');
      toast.success(`Expense marked as ${newStatus}`);
      fetchExpensesAndProjects();
      if (viewingExpense && viewingExpense.id === id) {
        const updated = await expenseService.getExpenseById(id);
        setViewingExpense(updated);
      }
    } catch (err) {
      toast.error('Failed to update expense status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await expenseService.deleteExpense(deleteTarget.id);
      toast.success('Expense deleted successfully');
      setDeleteTarget(null);
      fetchExpensesAndProjects();
    } catch (err) {
      toast.error('Failed to delete expense');
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportToCsv = () => {
    if (filteredExpenses.length === 0) {
      toast.error('No expenses to export');
      return;
    }

    const headers = [
      'Expense ID',
      'Title / Description',
      'Category',
      'Project Site',
      'Amount (INR)',
      'Date Incurred',
      'Spent By',
      'Payment Method',
      'Status',
      'Approved By',
      'Receipt File',
      'Notes',
    ];

    const rows = filteredExpenses.map((e) => [
      `"${e.id}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${e.projectName || 'General Overhead'}"`,
      `"${e.amount}"`,
      `"${e.date}"`,
      `"${(e.spentBy || '').replace(/"/g, '""')}"`,
      `"${e.paymentMethod}"`,
      `"${e.status.toUpperCase()}"`,
      `"${e.approvedBy || 'Pending'}"`,
      `"${e.receiptName || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute(
      'download',
      `aesthetic_expenses_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    toast.success(`Exported ${filteredExpenses.length} expenses to CSV`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30">
            <CheckIcon className="size-3" />
            <span>Approved</span>
          </span>
        );
      case 'reimbursed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/30">
            <WalletIcon className="size-3" />
            <span>Reimbursed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/30">
            <XIcon className="size-3" />
            <span>Rejected</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
            <ClockIcon className="size-3" />
            <span>Pending Review</span>
          </span>
        );
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Expense Item & Bill',
      className: 'min-w-[240px]',
      render: (e) => (
        <div className="space-y-1 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              onClick={() => setViewingExpense(e)}
              className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-xs sm:text-sm leading-tight hover:underline line-clamp-1"
              title={e.title}
            >
              {e.title}
            </span>
            {e.receiptName && (
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setViewingExpense(e);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20 shrink-0"
                title={`View attached bill: ${e.receiptName}`}
              >
                <ReceiptIcon className="size-3" />
                <span>Bill</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <Building2Icon className="size-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{e.projectName || 'General Overhead'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'whitespace-nowrap',
      render: (e) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border/80">
          {e.category}
        </span>
      ),
    },
    {
      key: 'spentBy',
      header: 'Spent By & Date',
      className: 'whitespace-nowrap',
      render: (e) => (
        <div className="flex items-center gap-2.5 py-1">
          <Avatar
            name={e.spentBy}
            size="sm"
            className="bg-primary/10 text-primary font-bold shrink-0 border border-primary/20"
          />
          <div className="text-xs space-y-0.5 min-w-0">
            <span className="font-semibold text-foreground block truncate max-w-[130px]">
              {e.spentBy}
            </span>
            <span className="text-[11px] text-muted-foreground block font-mono">
              {formatDate(e.date)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Payment Mode',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      render: (e) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/60">
          {e.paymentMethod}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount (₹)',
      className: 'whitespace-nowrap text-right',
      align: 'right',
      render: (e) => (
        <span className="font-mono font-bold text-sm text-foreground">
          {formatCurrency(e.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'whitespace-nowrap text-center',
      align: 'center',
      render: (e) => getStatusBadge(e.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap text-right w-28',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          {/* 1. View Voucher */}
          <button
            type="button"
            onClick={() => setViewingExpense(e)}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="View Details & Receipt"
            aria-label="View Details"
          >
            <EyeIcon className="size-3.5" />
          </button>

          {/* 2. Edit Expense */}
          <button
            type="button"
            onClick={() => handleOpenEdit(e)}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title="Edit Expense"
            aria-label="Edit Expense"
          >
            <EditIcon className="size-3.5" />
          </button>

          {isAdminOrManager && (
            <>
              {/* Quick Approve (for Pending) */}
              {e.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(e.id, 'approved')}
                    className="size-7 rounded-md flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                    title="Approve Claim"
                    aria-label="Approve"
                  >
                    <CheckIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(e.id, 'rejected')}
                    className="size-7 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
                    title="Reject Claim"
                    aria-label="Reject"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </>
              )}

              {/* Quick Reimburse (for Approved) */}
              {e.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate(e.id, 'reimbursed')}
                  className="size-7 rounded-md flex items-center justify-center text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                  title="Mark as Reimbursed"
                  aria-label="Mark Reimbursed"
                >
                  <WalletIcon className="size-3.5" />
                </button>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={() => setDeleteTarget(e)}
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
                title="Delete Expense"
                aria-label="Delete Expense"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Expenses"
        description="Track and approve site petty cash, materials procurement, fuel, and operational spends"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              className="gap-1.5"
            >
              <DownloadIcon className="size-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5"
            >
              <PlusIcon className="size-3.5" />
              <span>Record Expense</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Recorded Spends"
          value={formatCurrency(stats.totalAmount)}
          subtext={`${expenses.length} claims across all sites`}
          tone="primary"
          icon={<IndianRupeeIcon className="size-4.5 text-primary" />}
        />
        <StatCard
          title="Pending Approvals"
          value={formatCurrency(stats.pendingAmount)}
          subtext={`${stats.pendingCount} claims awaiting admin review`}
          tone={stats.pendingCount > 0 ? 'warning' : 'neutral'}
          icon={<ClockIcon className="size-4.5 text-warning" />}
        />
        <StatCard
          title="Total Reimbursed"
          value={formatCurrency(stats.reimbursedAmount)}
          subtext="Settled with staff & site leads"
          tone="success"
          icon={<CheckCircleIcon className="size-4.5 text-success" />}
        />
        <StatCard
          title="Top Category"
          value={stats.topCategory || 'Site Materials'}
          subtext="Highest spend category"
          tone="primary"
          icon={<ReceiptIcon className="size-4.5 text-primary" />}
        />
      </div>

      {/* 3. Filter & Quick Navigation Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick View Filter Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                statusFilter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Expenses ({statusCounts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                statusFilter === 'pending'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Pending Review</span>
              {statusCounts.pending > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning/20 text-warning font-bold">
                  {statusCounts.pending}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                statusFilter === 'approved'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Approved ({statusCounts.approved})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('reimbursed')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                statusFilter === 'reimbursed'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Reimbursed ({statusCounts.reimbursed})
            </button>
          </div>

          {/* Search & Select dropdowns */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-0">
            {/* Search */}
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search description, site, staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8.5 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8.5 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Sites</option>
              <option value="overhead">General Overhead</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {(search || categoryFilter !== 'ALL' || projectFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('ALL');
                  setProjectFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Expenses Table */}
      <Table
        columns={columns}
        data={filteredExpenses}
        loading={loading}
        emptyTitle="No expenses found"
        emptyDescription={
          search || categoryFilter !== 'ALL' || projectFilter !== 'ALL' || statusFilter !== 'ALL'
            ? 'Try clearing active filters or search terms to see all records.'
            : 'Click "Record Expense" to add a new site expense or petty cash voucher.'
        }
      />

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
        description="Submit site petty cash, materials procurement bill, or operational expense claim"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" size="sm">
              {editingExpense ? 'Save Changes' : 'Record Expense'}
            </Button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4 py-1">
          <Input
            label="Expense Title / Description"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Fastener Screws & Anchor Bolts for Gypsum Ceiling"
            error={formErrors.title}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Expense Category"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />

            <Input
              label="Amount (₹)"
              required
              type="number"
              min={1}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="e.g. 4500"
              error={formErrors.amount}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Project Site"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              options={[
                { value: '', label: 'General Studio / Overhead' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />

            <Input
              label="Date Incurred"
              required
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              error={formErrors.date}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Payment Method"
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
            />

            <Input
              label="Spent By / Claimed By"
              value={formData.spentBy}
              onChange={(e) => setFormData({ ...formData, spentBy: e.target.value })}
              placeholder="e.g. Rohit Kumar (Site Supervisor)"
            />
          </div>

          {/* Receipt Upload Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Receipt Bill / Voucher (Optional)</span>
              <span className="text-[10px] text-muted-foreground">PDF or JPG/PNG image</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={(e) => handleReceiptUpload(e.target.files)}
            />

            {formData.receiptName ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="size-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate max-w-[240px]">
                    {formData.receiptName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      receiptName: '',
                      receiptUrl: '',
                      receiptType: '',
                    }))
                  }
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                  title="Remove receipt"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:bg-muted/40 transition-colors cursor-pointer text-center"
              >
                <UploadIcon className="size-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-primary font-semibold">Click to upload</strong> bill photo or PDF invoice
                </span>
              </div>
            )}
          </div>

          <Textarea
            label="Additional Notes / Purpose"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Reason for expense, vendor name, or procurement details..."
          />
        </form>
      </Modal>

      {/* Expense Detail View Modal */}
      <Modal
        isOpen={Boolean(viewingExpense)}
        onClose={() => setViewingExpense(null)}
        title="Expense Voucher Details"
        description={`Voucher ID: ${viewingExpense?.id}`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isAdminOrManager && viewingExpense && viewingExpense.status === 'pending' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleStatusUpdate(viewingExpense.id, 'approved')}
                >
                  Approve Claim
                </Button>
              )}
              {isAdminOrManager && viewingExpense && viewingExpense.status === 'approved' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-primary border-primary/30"
                  onClick={() => handleStatusUpdate(viewingExpense.id, 'reimbursed')}
                >
                  Mark Reimbursed
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewingExpense(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewingExpense && (
          <div className="space-y-4 py-1 text-xs">
            {/* Header Card */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {viewingExpense.category}
                </span>
                <h3 className="text-sm font-bold text-foreground leading-snug mt-0.5">
                  {viewingExpense.title}
                </h3>
                <span className="text-xs text-muted-foreground block mt-1">
                  Site: <strong className="text-foreground">{viewingExpense.projectName}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-foreground block">
                  {formatCurrency(viewingExpense.amount)}
                </span>
                <div className="mt-1">{getStatusBadge(viewingExpense.status)}</div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-card">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Spent By
                </span>
                <span className="font-semibold text-foreground block mt-0.5">
                  {viewingExpense.spentBy}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Date Incurred
                </span>
                <span className="font-mono text-foreground block mt-0.5">
                  {formatDate(viewingExpense.date)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Payment Mode
                </span>
                <span className="text-foreground block mt-0.5">
                  {viewingExpense.paymentMethod}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Approval Audit
                </span>
                <span className="text-foreground block mt-0.5">
                  {viewingExpense.approvedBy
                    ? `Approved by ${viewingExpense.approvedBy}`
                    : 'Awaiting Manager Review'}
                </span>
              </div>
            </div>

            {/* Notes */}
            {viewingExpense.notes && (
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Procurement Notes
                </span>
                <p className="text-foreground leading-relaxed">{viewingExpense.notes}</p>
              </div>
            )}

            {/* Receipt Preview */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-foreground block">Attached Bill Receipt</span>
              {viewingExpense.receiptName ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <ReceiptIcon className="size-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block truncate max-w-[200px]">
                        {viewingExpense.receiptName}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">Verified bill voucher</span>
                    </div>
                  </div>
                  {viewingExpense.receiptUrl && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => window.open(viewingExpense.receiptUrl, '_blank')}
                      className="gap-1 text-primary"
                    >
                      <EyeIcon className="size-3" />
                      <span>View Receipt</span>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border text-center text-muted-foreground text-xs">
                  No bill receipt image uploaded for this expense.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Expense Record?"
        message={`Are you sure you want to delete "${deleteTarget?.title}" (${formatCurrency(
          deleteTarget?.amount || 0
        )})? This action cannot be undone.`}
        confirmText="Delete Expense"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default ExpensesPage;
