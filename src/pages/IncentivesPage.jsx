'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { incentiveService } from '../services/incentiveService';
import { INCENTIVE_CATEGORIES } from '../data/incentives';
import { mockProjects } from '../data/projects';
import { mockUsers } from '../data/users';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

// BefUI Components strictly adhering to design.md tokens
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

// BefUI SVG Icons strictly from '@/components/ui/icons'
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
  XIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CameraIcon,
  FileTextIcon,
  SortIcon,
  SaveIcon,
} from '../components/ui/icons';

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDateTimeDisplay(dateStr, timeStr = '12:00') {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const datePart = d.toISOString().split('T')[0];
    return `${datePart} ${timeStr || '12:00'}`;
  } catch {
    return dateStr;
  }
}

export function IncentivesPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  // State
  const [incentives, setIncentives] = useState(() => incentiveService.getIncentives());
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'add'
  const [activeTab, setActiveTab] = useState('project'); // 'project' | 'performance'

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Modals
  const [viewIncentive, setViewIncentive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewProof, setPreviewProof] = useState(null);

  // Add Incentive Form State (Matching Screenshot 2 & 3)
  const [formEmployee, setFormEmployee] = useState(currentUser?.name || 'Ramesh Shinde');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('Approved'); // 'Draft' | 'Pending' | 'Approved'

  // Nested Payments / Allocations (Screenshot 3)
  const [paymentsList, setPaymentsList] = useState([
    {
      id: 'p-1',
      title: 'Indiranagar Wardrobes Early Delivery',
      paymentMethod: 'Bank Transfer',
      category: INCENTIVE_CATEGORIES[0] || 'On-Time Completion',
      amount: '4500',
      tax: '0',
      time: '11:05',
      proof: null,
      proofName: '',
    },
  ]);

  const reloadData = () => {
    const list = incentiveService.getIncentives();
    setIncentives(list);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = incentives.length;
    const pendingCount = incentives.filter((i) => i.status === 'PENDING').length;
    const approvedCount = incentives.filter((i) => i.status === 'APPROVED' || i.status === 'PAID').length;
    const totalAmount = incentives.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    return {
      totalCount,
      pendingCount,
      approvedCount,
      totalAmount,
    };
  }, [incentives]);

  // Filtered List
  const filteredIncentives = useMemo(() => {
    return incentives.filter((inc) => {
      // Tab filter
      if (activeTab === 'performance' && !inc.category.toLowerCase().includes('bonus')) {
        // Show all or performance category
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        const s = (inc.status || '').toUpperCase();
        if (s !== statusFilter.toUpperCase()) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        if (inc.category !== categoryFilter) return false;
      }

      // Payment Method filter
      if (paymentFilter !== 'ALL') {
        const pm = (inc.paymentMethod || 'Bank Transfer').toLowerCase();
        if (!pm.includes(paymentFilter.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (inc.recipientName || '').toLowerCase().includes(q);
        const matchTitle = (inc.title || '').toLowerCase().includes(q);
        const matchCategory = (inc.category || '').toLowerCase().includes(q);
        const matchProj = (inc.projectName || '').toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchCategory && !matchProj) return false;
      }

      return true;
    });
  }, [incentives, activeTab, statusFilter, categoryFilter, paymentFilter, searchQuery]);

  // Handle Approve action
  const handleApprove = (inc) => {
    try {
      incentiveService.updateIncentiveStatus(inc.id, 'APPROVED');
      toast.success(`Incentive for ${inc.recipientName} marked as Approved!`);
      reloadData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Handle Delete action
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    try {
      incentiveService.deleteIncentive(deleteTarget.id);
      toast.success('Incentive award deleted');
      setDeleteTarget(null);
      reloadData();
    } catch {
      toast.error('Failed to delete incentive');
    }
  };

  // Add Another Payment row in Form (Screenshot 3)
  const handleAddPaymentRow = () => {
    const nextIdx = paymentsList.length + 1;
    setPaymentsList((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        title: `Site Milestone Clearance ${nextIdx}`,
        paymentMethod: 'UPI',
        category: INCENTIVE_CATEGORIES[1] || 'Quality Excellence',
        amount: '2500',
        tax: '0',
        time: '12:00',
        proof: null,
        proofName: '',
      },
    ]);
  };

  const handleRemovePaymentRow = (idx) => {
    if (paymentsList.length <= 1) return;
    setPaymentsList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculate live total amount in Add Form
  const formTotalAmount = useMemo(() => {
    return paymentsList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [paymentsList]);

  // Handle Submit Form
  const handleSaveIncentive = (e) => {
    e.preventDefault();
    if (paymentsList.length === 0) {
      toast.error('Please add at least one payment allocation');
      return;
    }

    try {
      const selectedUserObj = mockUsers.find((u) => u.name === formEmployee) || mockUsers[0];

      // Create an incentive record for each allocation
      paymentsList.forEach((pay) => {
        const amt = parseFloat(pay.amount) || 0;
        const newRecord = {
          recipientId: selectedUserObj?.id || 'u4',
          recipientName: formEmployee,
          recipientRole: selectedUserObj?.role || 'Artisan',
          trade: selectedUserObj?.department || 'Carpentry',
          projectId: 'P1',
          projectName: 'Indiranagar 4BHK Luxury Villa',
          category: pay.category || 'Special Achievement',
          title: pay.title || 'Performance Award',
          description: formDescription || 'Site performance allocation',
          amount: amt,
          status: formStatus.toUpperCase(),
          paymentMethod: pay.paymentMethod || 'Bank Transfer',
          awardedDate: formDate,
          proof: pay.proof,
        };
        incentiveService.createIncentive(newRecord);
      });

      toast.success(`Incentive award logged successfully (Total: ${formatCurrency(formTotalAmount)})!`);
      reloadData();
      setViewMode('list');
      setFormDescription('');
      setPaymentsList([
        {
          id: 'p-1',
          title: 'Indiranagar Wardrobes Early Delivery',
          paymentMethod: 'Bank Transfer',
          category: INCENTIVE_CATEGORIES[0],
          amount: '4500',
          tax: '0',
          time: '11:05',
          proof: null,
          proofName: '',
        },
      ]);
    } catch {
      toast.error('Failed to save incentive');
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER VIEW: ADD INCENTIVE FORM (Matching Screenshot 2 & 3)
  // ---------------------------------------------------------------------------
  if (viewMode === 'add') {
    return (
      <div className="space-y-5 pb-16 animate-in fade-in duration-200">
        {/* Back Navigation Bar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
            title="Go back"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Add Expense / Incentive</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Log a new team incentive award or bonus</p>
          </div>
        </div>

        <form onSubmit={handleSaveIncentive} className="space-y-5">
          {/* Section 1 Card: INCENTIVE DETAILS (Screenshot 2) */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Expense / Incentive Details
            </h3>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Employee</label>
              <select
                value={formEmployee}
                onChange={(e) => setFormEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Date <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Description</label>
              <textarea
                rows={3}
                placeholder="What was this expense or incentive award for?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs resize-none focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Status <span className="text-destructive">*</span>
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Section 2 Card: AMOUNT & PAYMENT (Screenshot 2 & 3) */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Amount & Payment
              </h3>
              <div className="text-sm font-mono font-bold text-foreground">
                Total: {formatCurrency(formTotalAmount)}
              </div>
            </div>

            {/* Nested Payment Cards */}
            <div className="space-y-3">
              {paymentsList.map((pay, idx) => (
                <div
                  key={pay.id}
                  className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Payment {idx + 1}
                    </span>
                    {paymentsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove Payment"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Title <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Client dinner or Bonus"
                        value={pay.title}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Payment Method <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={pay.paymentMethod}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], paymentMethod: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Category <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={pay.category}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], category: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      >
                        {INCENTIVE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Amount (₹) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="0"
                        value={pay.amount}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], amount: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Tax (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={pay.tax}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], tax: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-foreground">
                        Time <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="time"
                        value={pay.time}
                        onChange={(e) => {
                          const updated = [...paymentsList];
                          updated[idx] = { ...updated[idx], time: e.target.value };
                          setPaymentsList(updated);
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Receipt / File Picker (Screenshot 3) */}
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-medium text-muted-foreground">Receipt / Proof</label>
                    <div className="flex items-center gap-3">
                      <label className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-2xs">
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
                                const updated = [...paymentsList];
                                updated[idx] = {
                                  ...updated[idx],
                                  proof: ev.target.result,
                                  proofName: file.name,
                                };
                                setPaymentsList(updated);
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
              ))}
            </div>

            {/* + Add Another Payment Button (Screenshot 3) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPaymentRow}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
            >
              <PlusIcon className="size-3.5" />
              <span>Add Another Payment</span>
            </Button>
          </div>

          {/* Bottom Sticky Action: Save Expense / Incentive (Screenshot 3) */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold shadow-xs"
            >
              <SaveIcon className="size-4" />
              <span>Save Expense</span>
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER VIEW: MAIN INCENTIVES LIST (Matching Screenshot 1)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-200">
      {/* 1. Pill Tabs at Top Left (Screenshot 1: Business Claims / Salary Advances) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('project')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'project'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          Project Incentives
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'performance'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          Performance Bonuses
        </button>
      </div>

      {/* 2. Page Title & + Add Incentive Button (Screenshot 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Incentives</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Company performance awards and milestone claims</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setViewMode('add')}
          className="flex items-center gap-1.5 shadow-2xs self-start sm:self-auto font-semibold"
        >
          <PlusIcon className="size-4" />
          <span>Add Expense</span>
        </Button>
      </div>

      {/* 3. 4 Metric Cards in a Grid (Screenshot 1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Blue Icon Box -> Total */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrophyIcon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground leading-none">
              {stats.totalCount}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
              Total Expenses
            </span>
          </div>
        </div>

        {/* Card 2: Amber Icon Box -> Pending */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <ClockIcon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-warning leading-none">
              {stats.pendingCount}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
              Pending
            </span>
          </div>
        </div>

        {/* Card 3: Green Icon Box -> Approved */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
            <CheckCircleIcon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-success leading-none">
              {stats.approvedCount}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
              Approved
            </span>
          </div>
        </div>

        {/* Card 4: Purple Icon Box -> Total Amount */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <IndianRupeeIcon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-foreground leading-none">
              {formatCurrency(stats.totalAmount)}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
              Total Amount
            </span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar with Search & 3 Dropdowns (Screenshot 1) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>

        {/* 3 Dropdown Pills with ⇅ Arrows (Screenshot 1) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            >
              <option value="ALL">All Status ⇅</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          {/* Categories */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs max-w-[180px] truncate"
            >
              <option value="ALL">All Categories ⇅</option>
              {INCENTIVE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Payments */}
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-8.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            >
              <option value="ALL">All Payments ⇅</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Data Table inside Card (Screenshot 1) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date ⇅</th>
                <th className="py-3 px-4">Amount ⇅</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredIncentives.length > 0 ? (
                filteredIncentives.map((inc) => {
                  const isPaid = (inc.status || '').toUpperCase() === 'PAID';
                  const isApproved = (inc.status || '').toUpperCase() === 'APPROVED';
                  const isPending = (inc.status || '').toUpperCase() === 'PENDING';

                  return (
                    <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                      {/* Employee Name with Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={inc.recipientName} size="sm" className="shrink-0" />
                          <span className="font-semibold text-foreground truncate max-w-[160px]">
                            {inc.recipientName}
                          </span>
                        </div>
                      </td>

                      {/* Category Pill Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                          {inc.category || 'Special Award'}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        {formatDateTimeDisplay(inc.awardedDate, '14:30')}
                      </td>

                      {/* Amount in Monospace Bold */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground text-sm">
                        {formatCurrency(inc.amount)}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-border bg-muted/40 text-foreground">
                          {inc.paymentMethod || 'Bank Transfer'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {isPaid && <Badge variant="success">Paid</Badge>}
                        {isApproved && <Badge variant="neutral">Approved</Badge>}
                        {isPending && <Badge variant="warning">Pending</Badge>}
                      </td>

                      {/* Actions Icons (Screenshot 1: Eye, Check, Trash) */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewIncentive(inc)}
                            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <EyeIcon className="size-3.5" />
                          </button>

                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleApprove(inc)}
                              className="size-7 rounded-lg flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                              title="Approve Incentive"
                            >
                              <CheckCircleIcon className="size-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(inc)}
                            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                    No expense or incentive records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewIncentive && (
        <Modal
          isOpen={!!viewIncentive}
          onClose={() => setViewIncentive(null)}
          title="Incentive Award Details"
          subtitle={`Award for ${viewIncentive.recipientName}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-foreground">{viewIncentive.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{viewIncentive.projectName}</p>
                </div>
                <Badge variant={viewIncentive.status === 'PAID' ? 'success' : viewIncentive.status === 'APPROVED' ? 'neutral' : 'warning'}>
                  {viewIncentive.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Recipient</span>
                  <span className="font-semibold text-foreground">{viewIncentive.recipientName} ({viewIncentive.recipientRole})</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Category</span>
                  <span className="font-semibold text-foreground">{viewIncentive.category}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Amount</span>
                  <span className="font-mono font-bold text-base text-foreground">{formatCurrency(viewIncentive.amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Payment Method</span>
                  <span className="font-semibold text-foreground">{viewIncentive.paymentMethod || 'Bank Transfer'}</span>
                </div>
              </div>

              {viewIncentive.description && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Description</span>
                  <p className="text-muted-foreground text-xs mt-0.5">{viewIncentive.description}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewIncentive(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Incentive Award"
          message={`Are you sure you want to delete the incentive "${deleteTarget.title}" for ${deleteTarget.recipientName}?`}
          confirmText="Delete Award"
          variant="danger"
        />
      )}
    </div>
  );
}

export default IncentivesPage;
