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
import { compressImage } from '../utils/dsr';

import PageHeader from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';

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
  SaveIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CreditCardIcon,
} from '../components/ui/icons';

const STORAGE_KEY_SALARY_ADVANCES = 'osm_salary_advances_v2';

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

  // Dedicated Add Expense Full Form View (Screenshots 3 & 4)
  const [isAddExpenseView, setIsAddExpenseView] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    employee: 'Myself',
    date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'draft',
    projectId: '',
  });

  const [paymentsList, setPaymentsList] = useState([
    {
      title: '',
      paymentMethod: 'Cash',
      category: 'Software',
      amount: '',
      tax: '',
      time: new Date().toTimeString().slice(0, 5),
      receiptName: '',
      receiptUrl: '',
    },
  ]);

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
    const totalCount = expenses.length;
    const pendingCount = expenses.filter((e) => e.status === 'pending').length;
    const approvedCount = expenses.filter((e) => e.status === 'approved' || e.status === 'reimbursed').length;
    const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { totalCount, pendingCount, approvedCount, totalAmount };
  }, [expenses]);

  // Handle Multi-payment Item changes in Add Expense
  const handleUpdatePaymentItem = (index, field, value) => {
    setPaymentsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddAnotherPaymentItem = () => {
    setPaymentsList((prev) => [
      ...prev,
      {
        title: '',
        paymentMethod: 'Cash',
        category: 'Software',
        amount: '',
        tax: '',
        time: new Date().toTimeString().slice(0, 5),
        receiptName: '',
        receiptUrl: '',
      },
    ]);
  };

  const handleRemovePaymentItem = (index) => {
    setPaymentsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePaymentReceiptFile = async (index, files) => {
    if (!files || files.length === 0) return;
    try {
      const processed = await compressImage(files[0], 1200, 0.85);
      setPaymentsList((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          receiptName: processed.name,
          receiptUrl: processed.url,
        };
        return next;
      });
      toast.success(`Attached receipt: ${processed.name}`);
    } catch {
      toast.error('Could not process receipt file');
    }
  };

  const totalFormAmount = useMemo(() => {
    return paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [paymentsList]);

  const handleSaveExpenseForm = async (e) => {
    e.preventDefault();
    if (paymentsList.length === 0 || !paymentsList.some((p) => Number(p.amount) > 0)) {
      toast.error('Please enter at least one valid payment amount');
      return;
    }

    try {
      const staffName =
        expenseForm.employee === 'Myself' ? currentUser?.name || 'Staff Member' : expenseForm.employee;

      for (const p of paymentsList) {
        if (!p.title.trim() && !expenseForm.description.trim()) {
          toast.error('Please provide a title for each payment');
          return;
        }

        const payload = {
          title: p.title || expenseForm.description || 'General Business Claim',
          category: p.category || 'Office',
          amount: Number(p.amount) || 0,
          date: expenseForm.date,
          spentBy: staffName,
          paymentMethod: p.paymentMethod || 'Cash',
          status: expenseForm.status === 'draft' ? 'pending' : expenseForm.status,
          notes: expenseForm.description || '',
          receiptName: p.receiptName || '',
          receiptUrl: p.receiptUrl || '',
          projectId: expenseForm.projectId || projects[0]?.id || '',
          projectName: projects.find((pr) => pr.id === expenseForm.projectId)?.name || 'General Overhead',
        };

        await expenseService.createExpense(payload);
      }

      toast.success('Expense claim saved successfully!');
      setIsAddExpenseView(false);
      fetchExpenses();
    } catch (err) {
      console.error('Failed to save expense', err);
      toast.error('Failed to save expense claim');
    }
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

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await expenseService.deleteExpense(id);
      toast.success('Expense record deleted');
      fetchExpenses();
    } catch {
      toast.error('Failed to delete expense record');
    }
  };

  // ---------------------------------------------------------------------------
  // 2. SALARY ADVANCES STATE (Screenshots 1 & 2)
  // ---------------------------------------------------------------------------
  const [advances, setAdvances] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SALARY_ADVANCES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialSalaryAdvances;
  });

  const saveAdvances = (newAdvances) => {
    setAdvances(newAdvances);
    try {
      localStorage.setItem(STORAGE_KEY_SALARY_ADVANCES, JSON.stringify(newAdvances));
    } catch {}
  };

  // Salary Advances Filters
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('All');

  // Request Salary Advance Modal (Screenshot 1)
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    title: '',
    amount: '',
    dateRequired: new Date().toISOString().split('T')[0],
    reason: '',
  });

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

  // Salary Advances Statistics (3 Stat Cards from Screenshot 2)
  const advanceStats = useMemo(() => {
    const totalApproved = advances
      .filter((a) => a.status === 'approved')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const pendingCount = advances.filter((a) => a.status === 'pending').length;
    const totalSubmitted = advances.length;
    return { totalApproved, pendingCount, totalSubmitted };
  }, [advances]);

  const handleSaveAdvanceRequest = (e) => {
    e.preventDefault();
    if (!advanceForm.title.trim()) {
      toast.error('Please enter a title or purpose');
      return;
    }
    const amt = Number(advanceForm.amount);
    if (!advanceForm.amount || Number.isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid advance amount');
      return;
    }

    const newAdvance = {
      id: `adv-${Date.now()}`,
      employee: currentUser?.name || 'Amit Deshmukh',
      title: advanceForm.title.trim(),
      amount: amt,
      dateRequired: advanceForm.dateRequired,
      reason: advanceForm.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
    };

    saveAdvances([newAdvance, ...advances]);
    toast.success('Salary advance request submitted successfully!');
    setIsAdvanceModalOpen(false);
    setAdvanceForm({
      title: '',
      amount: '',
      dateRequired: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  const handleAdvanceStatusUpdate = (id, newStatus) => {
    const updated = advances.map((a) => (a.id === id ? { ...a, status: newStatus } : a));
    saveAdvances(updated);
    toast.success(`Salary advance marked as ${newStatus}`);
  };

  const handleDeleteAdvance = (id) => {
    if (!window.confirm('Are you sure you want to delete this salary advance request?')) return;
    const updated = advances.filter((a) => a.id !== id);
    saveAdvances(updated);
    toast.success('Salary advance record deleted');
  };

  // Helper for category badge color (Screenshot 5 style)
  const getCategoryBadgeClass = (category = '') => {
    const c = category.toLowerCase();
    if (c.includes('software')) return 'bg-blue-50 text-blue-600 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400';
    if (c.includes('office')) return 'bg-purple-50 text-purple-600 border border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400';
    if (c.includes('travel')) return 'bg-sky-50 text-sky-600 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-400';
    if (c.includes('subscription')) return 'bg-teal-50 text-teal-600 border border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-400';
    return 'bg-indigo-50 text-indigo-600 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400';
  };

  // Helper for payment chip (Screenshot 5 style)
  const renderPaymentChip = (method = '') => {
    const m = method.toLowerCase();
    if (m.includes('cash')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-600 border border-emerald-200/80 bg-emerald-50/60 dark:bg-emerald-950/30">
          <span>💵</span>
          <span>Cash</span>
        </span>
      );
    }
    if (m.includes('upi') || m.includes('phonepe') || m.includes('gpay')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-purple-600 border border-purple-200/80 bg-purple-50/60 dark:bg-purple-950/30">
          <span>📱</span>
          <span>UPI</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-foreground/80 border border-border bg-muted/40">
        <CreditCardIcon className="size-3 text-muted-foreground" />
        <span>{method || 'Direct'}</span>
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // FULL PAGE VIEW: ADD EXPENSE (Screenshots 3 & 4)
  // ---------------------------------------------------------------------------
  if (isAddExpenseView) {
    return (
      <div className="space-y-4 pb-16 animate-in fade-in duration-200">
        {/* Back navigation header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddExpenseView(false)}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Back to Expenses"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Expense</h1>
            <p className="text-xs text-muted-foreground">Log a new team expense</p>
          </div>
        </div>

        <form onSubmit={handleSaveExpenseForm} className="space-y-4">
          {/* Card 1: EXPENSE DETAILS (Screenshot 4) */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Expense Details
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Employee</label>
                <select
                  value={expenseForm.employee}
                  onChange={(e) => setExpenseForm({ ...expenseForm, employee: e.target.value })}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="Myself">Myself ({currentUser?.name || 'Admin'})</option>
                  <option value="Amit Deshmukh">Amit Deshmukh</option>
                  <option value="nilesh">nilesh</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Vikas Jadhav">Vikas Jadhav</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="What was this expense for?"
                  className="w-full p-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Status *</label>
                <select
                  value={expenseForm.status}
                  onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value })}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: AMOUNT & PAYMENT (Screenshot 3) */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Amount & Payment
              </span>
              <span className="text-base font-mono font-bold text-foreground">
                {formatCurrency(totalFormAmount)}
              </span>
            </div>

            <div className="space-y-4">
              {paymentsList.map((p, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Payment {idx + 1}</span>
                    {paymentsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentItem(idx)}
                        className="text-xs text-destructive hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Client dinner"
                        value={p.title}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'title', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Payment Method *
                      </label>
                      <select
                        value={p.paymentMethod}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'paymentMethod', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Company Card">Company Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Category *</label>
                      <select
                        value={p.category}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'category', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="Software">Software</option>
                        <option value="Office">Office</option>
                        <option value="Travel">Travel</option>
                        <option value="Subscriptions">Subscriptions</option>
                        <option value="Site Materials">Site Materials</option>
                        <option value="Food & Welfare">Food & Welfare</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Amount (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={p.amount}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'amount', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Tax (₹)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={p.tax}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'tax', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Time *</label>
                      <input
                        type="time"
                        value={p.time}
                        onChange={(e) => handleUpdatePaymentItem(idx, 'time', e.target.value)}
                        className="w-full h-8.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Receipt / Proof</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handlePaymentReceiptFile(idx, e.target.files)}
                      className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-background file:text-foreground hover:file:bg-muted cursor-pointer"
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddAnotherPaymentItem}
                className="w-full border-dashed flex items-center justify-center gap-1.5 text-xs py-2"
              >
                <PlusIcon className="size-3.5" />
                <span>Add Another Payment</span>
              </Button>
            </div>
          </div>

          {/* Full-width brand theme Save Expense button (NOT black!) */}
          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs"
          >
            <SaveIcon className="size-4" />
            <span>Save Expense</span>
          </Button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN EXPENSES PAGE (Business Claims or Salary Advances)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      {/* 1. Sub-tabs Strip: Business Claims | Salary Advances (Theme Color, NOT black!) */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleTabChange('claims')}
          className={cn(
            'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
            currentTab === 'claims'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          Business Claims
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('advances')}
          className={cn(
            'px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
            currentTab === 'advances'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          Salary Advances
        </button>
      </div>

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

          {/* 4 Stat Cards from Screenshot 5 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Total Expenses */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <ReceiptIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {claimStats.totalCount}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Total Expenses
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Pending */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                  <ClockIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {claimStats.pendingCount}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Pending
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Approved */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {claimStats.approvedCount}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Amount */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                  <IndianRupeeIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {formatCurrency(claimStats.totalAmount)}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Total Amount
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar (Screenshot 5: Search, All Status, All Categories, All Payments) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            {/* Search */}
            <div className="relative w-full md:w-72">
              <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                className="w-full h-8.5 pl-8.5 pr-8 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
              {claimSearch && (
                <button
                  type="button"
                  onClick={() => setClaimSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className="h-8.5 px-3 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
              >
                <option value="ALL">All Status ⇅</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={claimCategoryFilter}
                onChange={(e) => setClaimCategoryFilter(e.target.value)}
                className="h-8.5 px-3 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
              >
                <option value="ALL">All Categories ⇅</option>
                <option value="Software">Software</option>
                <option value="Office">Office</option>
                <option value="Travel">Travel</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Site Materials">Site Materials</option>
              </select>

              <select
                value={claimPaymentFilter}
                onChange={(e) => setClaimPaymentFilter(e.target.value)}
                className="h-8.5 px-3 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
              >
                <option value="ALL">All Payments ⇅</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Company Card">Company Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Table from Screenshot 5 (EMPLOYEE, CATEGORY, DATE, AMOUNT, PAYMENT, STATUS, ACTIONS) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">EMPLOYEE</th>
                    <th className="py-3 px-4">CATEGORY</th>
                    <th className="py-3 px-4">DATE ⇅</th>
                    <th className="py-3 px-4">AMOUNT ⇅</th>
                    <th className="py-3 px-4">PAYMENT</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filteredClaims.length > 0 ? (
                    filteredClaims.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        {/* Employee */}
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {item.spentBy}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              'inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                              getCategoryBadgeClass(item.category)
                            )}
                          >
                            {item.category || 'Office'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                          <div>{item.date || '—'}</div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground text-xs">
                          {formatCurrency(item.amount)}
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-4">
                          {renderPaymentChip(item.paymentMethod)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 font-semibold text-xs capitalize">
                          {item.status === 'approved' || item.status === 'reimbursed' ? (
                            <span className="text-emerald-600">Approved</span>
                          ) : item.status === 'rejected' ? (
                            <span className="text-rose-600">Rejected</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-muted-foreground">
                            {/* View */}
                            <button
                              type="button"
                              onClick={() => setViewingClaim(item)}
                              className="p-1 hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <EyeIcon className="size-4" />
                            </button>

                            {/* Quick Approve / Reject for managers */}
                            {isAdminOrManager && item.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusUpdate(item.id, 'approved')}
                                  className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title="Approve Claim"
                                >
                                  <CheckCircleIcon className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusUpdate(item.id, 'rejected')}
                                  className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Reject Claim"
                                >
                                  <XCircleIcon className="size-4" />
                                </button>
                              </>
                            )}

                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(item.id)}
                                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <TrashIcon className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                        No expenses found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

          {/* 3 Stat Cards from Screenshot 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Total Approved Advances */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <IndianRupeeIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {formatCurrency(advanceStats.totalApproved)}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Total Approved Advances
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Pending Requests */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                  <ClockIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {advanceStats.pendingCount}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Pending Requests
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Requests Submitted */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-foreground leading-none">
                    {advanceStats.totalSubmitted}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                    Total Requests Submitted
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar (Screenshot 2: Search + Status Chips) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search advances by title, employee, or reason..."
                value={advanceSearch}
                onChange={(e) => setAdvanceSearch(e.target.value)}
                className="w-full h-8.5 pl-8.5 pr-8 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
              {advanceSearch && (
                <button
                  type="button"
                  onClick={() => setAdvanceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            {/* Status chips (Screenshot 2: All, Pending, Approved, Rejected - Theme Color, NOT black!) */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['All', 'Pending', 'Approved', 'Rejected'].map((st) => {
                const active = advanceStatusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAdvanceStatusFilter(st)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                      active
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table or Empty State (from Screenshot 2) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            {filteredAdvances.length === 0 ? (
              /* Empty state from Screenshot 2 */
              <div className="py-16 px-4 text-center space-y-3">
                <div className="size-12 rounded-full border-2 border-muted-foreground/30 text-muted-foreground flex items-center justify-center mx-auto text-lg font-bold">
                  !
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    No salary advance requests found
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No employees have submitted salary advance requests yet.
                  </p>
                </div>
                <div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAdvanceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <PlusIcon className="size-4" />
                    <span>Submit New Request</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Salary Advances Data Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-4">EMPLOYEE</th>
                      <th className="py-3 px-4">TITLE / PURPOSE</th>
                      <th className="py-3 px-4">AMOUNT</th>
                      <th className="py-3 px-4">DATE REQUIRED</th>
                      <th className="py-3 px-4">REASON</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {filteredAdvances.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {item.employee}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          {item.title}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground text-xs">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          {item.dateRequired ? formatDate(item.dateRequired) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground max-w-[200px] truncate" title={item.reason}>
                          {item.reason || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-xs capitalize">
                          {item.status === 'approved' ? (
                            <span className="text-emerald-600">Approved</span>
                          ) : item.status === 'rejected' ? (
                            <span className="text-rose-600">Rejected</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-muted-foreground">
                            {isAdminOrManager && item.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatusUpdate(item.id, 'approved')}
                                  className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title="Approve Advance"
                                >
                                  <CheckCircleIcon className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStatusUpdate(item.id, 'rejected')}
                                  className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Reject Advance"
                                >
                                  <XCircleIcon className="size-4" />
                                </button>
                              </>
                            )}

                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAdvance(item.id)}
                                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                title="Delete Request"
                              >
                                <TrashIcon className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: REQUEST SALARY ADVANCE (Screenshot 1)                          */}
      {/* ===================================================================== */}
      {isAdvanceModalOpen && (
        <Modal
          isOpen={isAdvanceModalOpen}
          onClose={() => setIsAdvanceModalOpen(false)}
          title="Request Salary Advance"
        >
          <form onSubmit={handleSaveAdvanceRequest} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Title / Purpose *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Medical Emergency Loan, Festival Advance"
                value={advanceForm.title}
                onChange={(e) => setAdvanceForm({ ...advanceForm, title: e.target.value })}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Advance Amount (₹) *
              </label>
              <input
                type="number"
                required
                min="100"
                placeholder="e.g. 10000"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Date Required *
              </label>
              <input
                type="date"
                required
                value={advanceForm.dateRequired}
                onChange={(e) => setAdvanceForm({ ...advanceForm, dateRequired: e.target.value })}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Reason / Explanation
              </label>
              <textarea
                rows={3}
                placeholder="Explain why you need this advance..."
                value={advanceForm.reason}
                onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                className="w-full p-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Action buttons (Screenshot 1: Cancel and Submit Request - Theme Color, NOT black!) */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="px-4 shadow-2xs font-semibold"
              >
                Submit Request
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
    </div>
  );
}

export default ExpensesPage;
