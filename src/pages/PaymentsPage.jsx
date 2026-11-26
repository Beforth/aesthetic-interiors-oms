'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { numericOnChange } from '../utils/numberInput';
import {
  mockProjectPaymentSchedules,
  mockAgencyPayouts,
} from '../data/payments';
import { mockAgencies } from '../data/agencies';
import paymentService, { initialPaymentSettings } from '../services/paymentService';
import { cn } from '../lib/utils';

// BefUI Components strictly adhering to design.md tokens
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataToolbar from '../components/ui/DataToolbar';
import StatCard from '../components/ui/StatCard';
import Table from '../components/ui/Table';
import Select from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';

// BefUI Icons strictly from '@/components/ui/icons'
import {
  Building2Icon,
  ReceiptIcon,
  SaveIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  EyeIcon,
  CameraIcon,
  TrashIcon,
  DownloadIcon,
  XIcon,
  ArrowLeftIcon,
  PrinterIcon,
  ShieldCheckIcon,
} from '../components/ui/icons';
import DateInput from '../components/ui/DateInput';
import MoneyInput from '../components/ui/MoneyInput';
import NumberInput from '../components/ui/NumberInput';
import SelectField from '../components/ui/SelectField';
import StepperInput from '../components/ui/StepperInput';
import FileDrop from '../components/ui/FileDrop';

export function PaymentsPage({ mode }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  const location = useLocation();
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Determine view mode directly from route & prop: 'received' | 'pay' | 'settings'
  const currentView = useMemo(() => {
    if (mode === 'settings' || location.pathname.includes('/payments/settings')) return 'settings';
    if (mode === 'pay' || location.pathname.includes('/payments/pay')) return 'pay';
    return 'received';
  }, [mode, location.pathname]);

  // Payment Configuration Settings State (the service owns the local fallback)
  const [paymentSettings, setPaymentSettings] = useState(initialPaymentSettings);

  const handleSavePaymentSettings = async (e) => {
    e.preventDefault();
    try {
      const saved = await paymentService.saveSettings(paymentSettings);
      if (saved) setPaymentSettings(saved);
      toast.success('Payment settings saved successfully!');
    } catch (err) {
      toast.error(err?.message || 'Failed to save payment settings');
    }
  };

  const isManagerOrAdmin =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';

  // ---------------------------------------------------------------------------
  // 1. CLIENT PAYMENT SCHEDULES STATE (Received Mode)
  // ---------------------------------------------------------------------------
  const [schedules, setSchedules] = useState(mockProjectPaymentSchedules);

  const refreshSchedules = async () => {
    const rows = await paymentService.getSchedules();
    setSchedules(Array.isArray(rows) ? rows : mockProjectPaymentSchedules);
    return rows;
  };

  // Selected site filter ('all' or specific projectId)
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  const currentSchedule = useMemo(() => {
    if (selectedProjectId === 'all') return schedules[0] || null;
    return schedules.find((s) => s.projectId === selectedProjectId) || schedules[0] || null;
  }, [schedules, selectedProjectId]);

  // Filters for Received Table
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('all');
  const [clientMethodFilter, setClientMethodFilter] = useState('all');
  const [clientSort, setClientSort] = useState('due_asc');
  const [clientPage, setClientPage] = useState(1);
  const [clientRowsPerPage, setClientRowsPerPage] = useState(10);

  // Flattened installments across all projects
  const allClientPayments = useMemo(() => {
    const list = [];
    schedules.forEach((s) => {
      (s.installments || []).forEach((inst, idx) => {
        list.push({
          ...inst,
          id: inst.id || `${s.projectId}-inst-${idx + 1}`,
          projectId: s.projectId,
          projectName: s.projectName,
          clientName: s.clientName,
          clientEmail: s.clientEmail,
          clientPhone: s.clientPhone,
          projectTotalCost: s.totalCost,
        });
      });
    });
    return list;
  }, [schedules]);

  // Overall statistics across all client projects
  const overallClientStats = useMemo(() => {
    let totalBudget = 0;
    let totalCollected = 0;
    schedules.forEach((s) => {
      totalBudget += s.totalCost || 0;
      (s.installments || []).forEach((inst) => {
        if (inst.status === 'paid') totalCollected += Number(inst.paidAmount || inst.amount || 0);
      });
    });
    return {
      totalBudget,
      totalCollected,
      totalPending: Math.max(0, totalBudget - totalCollected),
      projectsCount: schedules.length,
    };
  }, [schedules]);

  // Filtered client payments
  const filteredClientPayments = useMemo(() => {
    let list = allClientPayments.filter((item) => {
      if (selectedProjectId !== 'all' && item.projectId !== selectedProjectId) return false;
      if (clientStatusFilter !== 'all' && item.status !== clientStatusFilter) return false;
      if (clientMethodFilter !== 'all') {
        const mode = (item.paymentMode || '').toLowerCase();
        if (!mode.includes(clientMethodFilter.toLowerCase())) return false;
      }
      if (clientSearch.trim()) {
        const q = clientSearch.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchProj = (item.projectName || '').toLowerCase().includes(q);
        const matchClient = (item.clientName || '').toLowerCase().includes(q);
        const matchMode = (item.paymentMode || '').toLowerCase().includes(q);
        const matchReceipt = (item.receiptNumber || '').toLowerCase().includes(q);
        const matchAmount = String(item.amount || '').includes(q);
        if (!matchTitle && !matchProj && !matchClient && !matchMode && !matchReceipt && !matchAmount) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      if (clientSort === 'due_desc') return (b.dueDate || '').localeCompare(a.dueDate || '');
      if (clientSort === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
      if (clientSort === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
      if (clientSort === 'client_asc') return (a.clientName || '').localeCompare(b.clientName || '');
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });

    return list;
  }, [allClientPayments, selectedProjectId, clientStatusFilter, clientMethodFilter, clientSearch, clientSort]);

  // Counts for status tabs
  const clientStatusCounts = useMemo(() => {
    const base = selectedProjectId === 'all'
      ? allClientPayments
      : allClientPayments.filter((item) => item.projectId === selectedProjectId);
    return {
      all: base.length,
      paid: base.filter((i) => i.status === 'paid').length,
      pending: base.filter((i) => i.status === 'pending').length,
      overdue: base.filter((i) => i.status === 'overdue').length,
    };
  }, [allClientPayments, selectedProjectId]);

  // Paginated client payments
  const paginatedClientPayments = useMemo(() => {
    const start = (clientPage - 1) * clientRowsPerPage;
    return filteredClientPayments.slice(start, start + clientRowsPerPage);
  }, [filteredClientPayments, clientPage, clientRowsPerPage]);

  const clientTotalPages = Math.ceil(filteredClientPayments.length / clientRowsPerPage) || 1;

  const handleExportClientCSV = () => {
    const headers = ['Project Name', 'Client Name', 'Installment', 'Amount', 'Paid Amount', 'Due Date', 'Status', 'Payment Mode', 'Receipt No'];
    const rows = filteredClientPayments.map((item) => [
      `"${item.projectName}"`,
      `"${item.clientName}"`,
      `"${item.title || ''}"`,
      item.amount || 0,
      item.paidAmount || 0,
      item.dueDate || '',
      item.status || '',
      `"${item.paymentMode || ''}"`,
      `"${item.receiptNumber || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `client_payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredClientPayments.length} client payment records`);
  };

  // ---------------------------------------------------------------------------
  // 2. AGENCY PAYOUTS STATE (Pay Mode)
  // ---------------------------------------------------------------------------
  const [agencyPayouts, setAgencyPayouts] = useState(mockAgencyPayouts);

  const refreshAgencyPayouts = async () => {
    const rows = await paymentService.getAgencyPayouts();
    setAgencyPayouts(Array.isArray(rows) ? rows : mockAgencyPayouts);
    return rows;
  };

  // Load payment data once on mount; the service falls back to local sample data.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [settings, scheduleRows, payoutRows] = await Promise.all([
          paymentService.getSettings(),
          paymentService.getSchedules(),
          paymentService.getAgencyPayouts(),
        ]);
        if (!active) return;
        if (settings) setPaymentSettings(settings);
        if (Array.isArray(scheduleRows)) setSchedules(scheduleRows);
        if (Array.isArray(payoutRows)) setAgencyPayouts(payoutRows);
      } catch (err) {
        if (active) toastRef.current.error(err?.message || 'Failed to load payment data');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Agency Filters
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState('all');
  const [agencyProjectFilter, setAgencyProjectFilter] = useState('all');
  const [agencyMethodFilter, setAgencyMethodFilter] = useState('all');
  const [agencySort, setAgencySort] = useState('newest');
  const [agencyPage, setAgencyPage] = useState(1);
  const [agencyRowsPerPage, setAgencyRowsPerPage] = useState(10);

  const filteredAgencyPayouts = useMemo(() => {
    const list = agencyPayouts.filter((item) => {
      if (agencyProjectFilter !== 'all' && item.projectId !== agencyProjectFilter) return false;
      if (agencyStatusFilter !== 'all' && item.status !== agencyStatusFilter) return false;
      if (agencyMethodFilter !== 'all') {
        const mode = (item.paymentMode || '').toLowerCase();
        if (!mode.includes(agencyMethodFilter.toLowerCase())) return false;
      }
      if (agencySearch.trim()) {
        const q = agencySearch.toLowerCase();
        const matchName = (item.agencyName || '').toLowerCase().includes(q);
        const matchTrade = (item.trade || '').toLowerCase().includes(q);
        const matchInv = (item.invoiceNumber || '').toLowerCase().includes(q);
        const matchProj = (item.projectName || '').toLowerCase().includes(q);
        if (!matchName && !matchTrade && !matchInv && !matchProj) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (agencySort === 'bill_desc') return (b.billAmount || 0) - (a.billAmount || 0);
      if (agencySort === 'due_desc') return (b.pendingBalance || 0) - (a.pendingBalance || 0);
      if (agencySort === 'name_asc') return (a.agencyName || '').localeCompare(b.agencyName || '');
      if (agencySort === 'oldest') return (a.paymentDate || '').localeCompare(b.paymentDate || '');
      return (b.paymentDate || '').localeCompare(a.paymentDate || '');
    });

    return list;
  }, [agencyPayouts, agencyProjectFilter, agencyStatusFilter, agencyMethodFilter, agencySearch, agencySort]);

  const agencyTotals = useMemo(() => {
    const totalBilled = agencyPayouts.reduce((sum, item) => sum + (item.billAmount || 0), 0);
    const totalCleared = agencyPayouts.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
    const totalDue = Math.max(0, totalBilled - totalCleared);
    const activeAgencies = new Set(agencyPayouts.map((a) => a.agencyName)).size;
    return { totalBilled, totalCleared, totalDue, activeAgencies };
  }, [agencyPayouts]);

  const agencyStatusCounts = useMemo(() => ({
    all: agencyPayouts.length,
    paid: agencyPayouts.filter((a) => a.status === 'paid').length,
    partially_paid: agencyPayouts.filter((a) => a.status === 'partially_paid').length,
    pending: agencyPayouts.filter((a) => a.status === 'pending').length,
  }), [agencyPayouts]);

  const paginatedAgencyPayouts = useMemo(() => {
    const start = (agencyPage - 1) * agencyRowsPerPage;
    return filteredAgencyPayouts.slice(start, start + agencyRowsPerPage);
  }, [filteredAgencyPayouts, agencyPage, agencyRowsPerPage]);

  const agencyTotalPages = Math.ceil(filteredAgencyPayouts.length / agencyRowsPerPage) || 1;

  const handleDeleteAgencyPayout = (id) => setDeleteTarget({ id });

  const confirmDeleteAgencyPayout = async () => {
    if (!deleteTarget) return;
    try {
      await paymentService.deleteAgencyPayout(deleteTarget.id);
      await refreshAgencyPayouts();
      toast.success('Agency bill record deleted');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete agency bill record');
    }
    setDeleteTarget(null);
  };

  const handleOpenAgencyPayment = () => {
    const firstAg = mockAgencies[0];
    setAgencyForm({
      agencyId: firstAg?.id || 'a1',
      agencyName: firstAg?.name || 'Apex False Ceiling',
      trade: firstAg?.trade || 'Ceiling',
      projectId: schedules[0]?.projectId || 'P1',
      invoiceNumber: `INV-AGC-${Date.now().toString().slice(-4)}`,
      billAmount: 120000,
      paidAmount: 80000,
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'Bank Transfer',
      workStage: 'Framing & Boarding Stage Bill',
      proof: null,
    });
    setIsRecordAgencyOpen(true);
  };

  const handleExportAgencyCSV = () => {
    const headers = ['Agency Name', 'Trade', 'Project Site', 'Invoice No', 'Bill Amount', 'Paid Amount', 'Due Balance', 'Status', 'Date'];
    const rows = filteredAgencyPayouts.map((a) => [
      `"${a.agencyName}"`,
      `"${a.trade}"`,
      `"${a.projectName}"`,
      `"${a.invoiceNumber}"`,
      a.billAmount,
      a.paidAmount,
      a.pendingBalance,
      a.status,
      a.paymentDate,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agency_bills_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredAgencyPayouts.length} agency records`);
  };

  // 3. SIMPLIFIED PAYMENT FORM MODAL (Create & View/Edit in Received mode)
  // ---------------------------------------------------------------------------
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const [paymentForm, setPaymentForm] = useState({
    projectId: 'P1',
    projectName: '',
    clientName: '',
    totalCost: 40000,
    advancePercentage: 10,
    installmentsCount: 1,
    installments: [],
  });

  // Helper to open the simplified payment modal prefilled with target schedule
  const handleOpenPaymentModal = (targetSchedule = null) => {
    const schedule = targetSchedule || currentSchedule || schedules[0];
    const totalCost = schedule?.totalCost || 40000;
    const advPct = 10;
    const remaining = Math.max(0, totalCost - Math.round((totalCost * advPct) / 100));

    // Always start with a single installment; admin can add more if needed
    const instList = [
      {
        id: 'inst-1',
        title: 'Installment 1',
        percentage: 100,
        amount: remaining,
        status: 'pending',
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        paidDate: '',
        paymentMode: 'Bank Transfer',
        paymentProof: null,
        paymentProofName: '',
      },
    ];

    setPaymentForm({
      projectId: schedule?.projectId || 'P1',
      projectName: schedule?.projectName || '',
      clientName: schedule?.clientName || '',
      totalCost,
      advancePercentage: advPct,
      installmentsCount: 1,
      installments: instList,
    });
    setIsPaymentModalOpen(true);
  };

  // Recalculate installments when budget or advance % changes
  const handleRecalculateBudget = (newCost, newAdvPct) => {
    const cost = parseFloat(String(newCost).replace(/,/g, '')) || 0;
    const advPct = parseFloat(newAdvPct) || 0;
    const advAmt = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advAmt);

    const updatedInst = paymentForm.installments.map((inst) => {
      const pct = parseFloat(inst.percentage) || 0;
      return {
        ...inst,
        amount: Math.round((remaining * pct) / 100),
      };
    });

    setPaymentForm((prev) => ({
      ...prev,
      totalCost: newCost,
      advancePercentage: newAdvPct,
      installments: updatedInst,
    }));
  };

  // Recalculate installments when count changes
  const handleInstallmentsCountChange = (countVal) => {
    const count = Math.max(1, Math.min(12, parseInt(countVal, 10) || 1));
    const cost = parseFloat(paymentForm.totalCost) || 0;
    const advPct = parseFloat(paymentForm.advancePercentage) || 0;
    const advAmt = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advAmt);

    const equalPct = Math.floor(100 / count);
    const remainder = 100 - equalPct * count;

    const newInst = [];
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const pct = isLast ? equalPct + remainder : equalPct;
      const amt = Math.round((remaining * pct) / 100);
      const existing = paymentForm.installments[i];

      newInst.push({
        id: existing?.id || `inst-${i + 1}`,
        title: existing?.title || `Installment ${i + 1}`,
        percentage: pct,
        amount: amt,
        status: existing?.status || 'pending',
        dueDate: existing?.dueDate || new Date(Date.now() + (i + 1) * 15 * 86400000).toISOString().split('T')[0],
        paidDate: existing?.paidDate || '',
        paymentMode: existing?.paymentMode || 'Bank Transfer',
        paymentProof: existing?.paymentProof || null,
        paymentProofName: existing?.paymentProofName || '',
      });
    }

    setPaymentForm((prev) => ({
      ...prev,
      installmentsCount: count,
      installments: newInst,
    }));
  };

  const handleRemoveInstallment = (removeIdx) => {
    if (paymentForm.installments.length <= 1) return;

    const remaining = paymentForm.installments.filter((_, i) => i !== removeIdx);
    const count = remaining.length;
    const equalPct = Math.floor(100 / count);
    const remainder = 100 - equalPct * count;

    const rebalanced = remaining.map((inst, i) => {
      const pct = i === count - 1 ? equalPct + remainder : equalPct;
      const isAutoTitle = /^Installment \d+$/.test(inst.title || '');
      return {
        ...inst,
        title: isAutoTitle ? `Installment ${i + 1}` : inst.title,
        percentage: pct,
        amount: Math.round((modalRemVal * pct) / 100),
      };
    });

    setPaymentForm((prev) => ({
      ...prev,
      installmentsCount: count,
      installments: rebalanced,
    }));
  };

  // Save the simplified payment form through the payment service
  const handleSavePaymentForm = async (e) => {
    e.preventDefault();
    try {
      const rows = await paymentService.savePaymentPlan(paymentForm.projectId, {
        ...paymentForm,
        totalCost: parseFloat(String(paymentForm.totalCost).replace(/,/g, '')) || 0,
      });
      if (Array.isArray(rows)) {
        setSchedules(rows);
      } else {
        await refreshSchedules();
      }
      toast.success('Payment plan & installments updated successfully!');
      setIsPaymentModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to save payment plan');
    }
  };

  // ---------------------------------------------------------------------------
  // 4. AGENCY RECORD PAYMENT MODAL (Simplified)
  // ---------------------------------------------------------------------------
  const [isRecordAgencyOpen, setIsRecordAgencyOpen] = useState(false);
  const [agencyForm, setAgencyForm] = useState({
    agencyId: 'a1',
    agencyName: 'Apex False Ceiling',
    trade: 'Ceiling',
    projectId: 'P1',
    invoiceNumber: '',
    billAmount: '',
    paidAmount: '',
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank Transfer',
    workStage: '',
    proof: null,
  });

  const handleSaveAgencyPayout = async (e) => {
    e.preventDefault();
    if (!agencyForm.invoiceNumber.trim()) {
      toast.error('Please enter an invoice number');
      return;
    }
    const billed = parseFloat(agencyForm.billAmount) || 0;
    const paid = parseFloat(agencyForm.paidAmount) || 0;
    const targetProj = schedules.find((s) => s.projectId === agencyForm.projectId);

    try {
      await paymentService.createAgencyPayout({
        agencyId: agencyForm.agencyId,
        agencyName: agencyForm.agencyName,
        trade: agencyForm.trade,
        projectId: agencyForm.projectId,
        projectName: targetProj?.projectName || 'Indiranagar 4BHK Luxury Villa',
        invoiceNumber: agencyForm.invoiceNumber.trim(),
        billAmount: billed,
        paidAmount: paid,
        dueDate: agencyForm.dueDate,
        paymentDate: agencyForm.paymentDate,
        paymentMode: agencyForm.paymentMode,
        workStage: agencyForm.workStage || 'Site Trade Clearance',
        proof: agencyForm.proof,
      });
      await refreshAgencyPayouts();
      toast.success(`Agency bill ${agencyForm.invoiceNumber.trim()} recorded successfully!`);
      setIsRecordAgencyOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to record agency bill');
    }
  };

  // Calculated values for Payment Form modal
  const modalCost = parseFloat(paymentForm.totalCost) || 0;
  const modalAdvPct = parseFloat(paymentForm.advancePercentage) || 0;
  const modalAdvVal = Math.round((modalCost * modalAdvPct) / 100);
  const modalRemVal = Math.max(0, modalCost - modalAdvVal);

  // ---------------------------------------------------------------------------
  // FULL-SCREEN VIEW: RECORD / EDIT CLIENT PAYMENT PLAN (Received Mode)
  // ---------------------------------------------------------------------------
  if (currentView === 'received' && isPaymentModalOpen) {
    const plannedTotal = paymentForm.installments.reduce(
      (sum, inst) => sum + (Number(inst.amount) || 0),
      0
    );
    const paidTotal = paymentForm.installments
      .filter((inst) => inst.status === 'paid')
      .reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
    const pctTotal = paymentForm.installments.reduce(
      (sum, inst) => sum + (Number(inst.percentage) || 0),
      0
    );

    return (
      <div className="space-y-6 pb-24 animate-in fade-in duration-200">
        {/* Top Navigation & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Back to received payments"
              data-no-tooltip
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Record Client Payment
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the contract value, advance, and installment clearances for this project.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSavePaymentForm}
              className="flex items-center gap-1.5 font-semibold"
            >
              <SaveIcon className="size-4" />
              <span>Save Schedule</span>
            </Button>
          </div>
        </div>

        <form onSubmit={handleSavePaymentForm} className="space-y-6">
          {/* Step 1: Payment Plan */}
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted/10">
              <h2 className="text-sm font-semibold text-foreground">Payment Plan</h2>
              <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                {paymentForm.clientName || 'Select a project'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Project & Client *
                </label>
                <SelectField
                  value={paymentForm.projectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const prj = schedules.find((s) => s.projectId === pid);
                    handleOpenPaymentModal(prj);
                  }}
                  className="w-full"
                >
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName} (Client: {s.clientName})
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Contract Budget (₹) *
                </label>
                <MoneyInput
                 
                  required
                  min="1000"
                  value={paymentForm.totalCost}
                  onChange={(e) =>
                    handleRecalculateBudget(e.target.value, paymentForm.advancePercentage)
                  }
                  className="w-full"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Advance %
                  </label>
                  <div className="relative">
                    <NumberInput
                     
                      min="0"
                      max="100"
                      required
                      value={paymentForm.advancePercentage}
                      onChange={(e) =>
                        handleRecalculateBudget(paymentForm.totalCost, e.target.value)
                      }
                      placeholder="0"
                      className="w-full"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-semibold">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Count
                  </label>
                  <StepperInput
                   
                    min="1"
                    max="12"
                    required
                    value={paymentForm.installmentsCount}
                    onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                   
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border border-t border-border bg-muted/20">
              <div className="px-5 py-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Advance
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatCurrency(modalAdvVal)}
                </span>
              </div>
              <div className="px-5 py-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Remaining
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatCurrency(modalRemVal)}
                </span>
              </div>
              <div className="px-5 py-3 border-t lg:border-t-0 border-border">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Planned
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatCurrency(plannedTotal)}
                </span>
              </div>
              <div className="px-5 py-3 border-t lg:border-t-0 border-border">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Cleared
                </span>
                <span className="text-sm font-bold font-mono text-success">
                  {formatCurrency(paidTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: Installments */}
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-3.5 border-b border-border bg-muted/10">
              <h2 className="text-sm font-semibold text-foreground">Installments</h2>
              <span className="text-[11px] text-muted-foreground">
                Mark an installment paid to add paid date, mode and proof.
              </span>
            </div>

            <div className="divide-y divide-border">
              {paymentForm.installments.map((inst, idx) => (
                <div key={inst.id || idx} className="px-5 py-4 space-y-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                    <div className="flex items-center gap-2.5 min-w-[170px] flex-1">
                      <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={inst.title}
                          onChange={(e) => {
                            const updated = [...paymentForm.installments];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          onBlur={() => {
                            if (!inst.title.trim()) {
                              const updated = [...paymentForm.installments];
                              updated[idx] = { ...updated[idx], title: `Installment ${idx + 1}` };
                              setPaymentForm({ ...paymentForm, installments: updated });
                            }
                          }}
                          placeholder={`Installment ${idx + 1}`}
                          aria-label={`Installment ${idx + 1} name`}
                          className="w-full max-w-[170px] -ml-1 px-1 py-0.5 text-xs font-semibold text-foreground bg-transparent border border-transparent hover:border-border focus:border-border rounded transition-colors focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="relative w-24">
                            <NumberInput
                             
                              min="0"
                              max="100"
                              value={inst.percentage}
                              placeholder="0"
                              onChange={(e) => {
                                const raw = e.target.value;
                                const newPct = parseFloat(raw) || 0;
                                const updated = [...paymentForm.installments];
                                const amt = Math.round((modalRemVal * newPct) / 100);
                                updated[idx] = {
                                  ...updated[idx],
                                  percentage: raw === '' ? '' : newPct,
                                  amount: amt,
                                };
                                setPaymentForm({ ...paymentForm, installments: updated });
                              }}
                              className="w-full"
                              title="Percentage of remaining balance"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">of remaining</span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-xs text-foreground px-2.5 py-1 rounded-md bg-muted border border-border">
                      {formatCurrency(inst.amount)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Due
                        <DateInput
                         
                          value={inst.dueDate}
                          onChange={(e) => {
                            const updated = [...paymentForm.installments];
                            updated[idx] = { ...updated[idx], dueDate: e.target.value };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          className="w-auto min-w-[9.5rem]"
                        />
                      </label>

                      <SelectField
                        value={inst.status}
                        onChange={(e) => {
                          const updated = [...paymentForm.installments];
                          updated[idx] = {
                            ...updated[idx],
                            status: e.target.value,
                            paidDate:
                              e.target.value === 'paid'
                                ? inst.paidDate || new Date().toISOString().split('T')[0]
                                : '',
                          };
                          setPaymentForm({ ...paymentForm, installments: updated });
                        }}
                        className={cn(
                          'h-8 px-2 rounded-md border text-[11px] font-semibold focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer',
                          inst.status === 'paid'
                            ? 'bg-success/10 text-success border-success/30'
                            : inst.status === 'overdue'
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-background text-foreground border-border'
                        )}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </SelectField>

                      {paymentForm.installments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInstallment(idx)}
                          className="size-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                          aria-label="Remove installment"
                          data-no-tooltip
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {inst.status === 'paid' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/60 pt-3 pl-0 sm:pl-8">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                          Paid Date
                        </span>
                        <DateInput
                         
                          value={inst.paidDate}
                          onChange={(e) => {
                            const updated = [...paymentForm.installments];
                            updated[idx] = { ...updated[idx], paidDate: e.target.value };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          className="w-full"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                          Payment Mode
                        </span>
                        <SelectField
                          value={inst.paymentMode}
                          onChange={(e) => {
                            const updated = [...paymentForm.installments];
                            updated[idx] = { ...updated[idx], paymentMode: e.target.value };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          className="w-full"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="UPI">UPI</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </SelectField>
                      </label>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                          Payment Proof
                        </span>
                        {inst.paymentProof ? (
                          <div className="flex items-center gap-2 h-8 px-2 rounded-md bg-muted/40 border border-border">
                            <img
                              src={inst.paymentProof}
                              alt="Proof"
                              onClick={() => setPreviewImageModal(inst.paymentProof)}
                              className="size-5 rounded object-cover cursor-pointer border border-border hover:opacity-80"
                            />
                            <span className="text-[11px] font-medium text-foreground flex-1 min-w-0 truncate">
                              {inst.paymentProofName || 'Picture attached'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewImageModal(inst.paymentProof)}
                              className="p-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              title="View proof"
                            >
                              <EyeIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...paymentForm.installments];
                                updated[idx] = {
                                  ...updated[idx],
                                  paymentProof: null,
                                  paymentProofName: '',
                                };
                                setPaymentForm({ ...paymentForm, installments: updated });
                              }}
                              className="p-0.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Remove proof"
                            >
                              <TrashIcon className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-md border border-dashed border-border hover:border-primary/50 bg-background hover:bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                            <CameraIcon className="size-3.5 text-primary" />
                            <span>Attach slip</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const updated = [...paymentForm.installments];
                                    updated[idx] = {
                                      ...updated[idx],
                                      paymentProof: ev.target.result,
                                      paymentProofName: file.name,
                                    };
                                    setPaymentForm({ ...paymentForm, installments: updated });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={paymentForm.installments.length >= 12}
                onClick={() => handleInstallmentsCountChange(paymentForm.installments.length + 1)}
                className="flex items-center gap-1.5"
              >
                <PlusIcon className="size-3.5" />
                <span>Add installment</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {paymentForm.installments.length} of 12
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-border bg-muted/20 text-xs">
              <span className="text-muted-foreground">
                Allocation:{' '}
                <strong className="text-foreground font-mono">{pctTotal}%</strong>
                {pctTotal !== 100 && (
                  <span className="text-warning font-medium"> (should total 100%)</span>
                )}
              </span>
              <span className="text-muted-foreground">
                Planned{' '}
                <strong className="font-mono text-foreground">{formatCurrency(plannedTotal)}</strong>
                {' · '}Cleared{' '}
                <strong className="font-mono text-success">{formatCurrency(paidTotal)}</strong>
              </span>
            </div>
          </div>
        </form>

        {/* In-page proof preview */}
        {previewImageModal && (
          <Modal
            isOpen={!!previewImageModal}
            onClose={() => setPreviewImageModal(null)}
            title="Payment Proof"
            subtitle="Uploaded installment proof"
            size="lg"
            bodyClassName="p-0"
            footer={
              <Button variant="primary" size="sm" onClick={() => setPreviewImageModal(null)}>
                Close Preview
              </Button>
            }
          >
            <div className="flex items-center justify-center bg-muted/40 p-4 min-h-[30vh]">
              <img
                src={previewImageModal}
                alt="Payment proof"
                className="max-h-[70vh] w-auto max-w-full rounded-lg border border-border bg-card object-contain shadow-sm"
              />
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <PageHeader
        title={
          currentView === 'received'
            ? 'Client Payments'
            : currentView === 'pay'
            ? 'Agency Payments'
            : 'Payment Settings'
        }
        subtitle={
          currentView === 'received'
            ? 'Client installments, receipts and pending balances.'
            : currentView === 'pay'
            ? 'Agency bills, clearances and payment history.'
            : 'Bank accounts and invoice defaults.'
        }
        actions={
          isManagerOrAdmin && (
            <>
              {currentView === 'received' && (
                <>
                  <Button variant="outline" size="sm" onClick={handleExportClientCSV} leadingIcon="download">
                    Export
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleOpenPaymentModal()} leadingIcon="plus">
                    Record Payment
                  </Button>
                </>
              )}

              {currentView === 'pay' && (
                <>
                  <Button variant="outline" size="sm" onClick={handleExportAgencyCSV} leadingIcon="download">
                    Export
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleOpenAgencyPayment} leadingIcon="plus">
                    Record Payment
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {/* ===================================================================== */}
      {/* VIEW: RECEIVED (CLIENT PAYMENTS - REDESIGNED PER REFERENCE FINTECH UI) */}
      {/* ===================================================================== */}
      {currentView === 'received' && (
        <div className="space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              variant="inline"
              label="Total Contract Budget"
              value={formatCurrency(overallClientStats.totalBudget)}
            />
            <StatCard
              variant="inline"
              label="Total Collected"
              value={formatCurrency(overallClientStats.totalCollected)}
              valueClassName="text-success"
            />
            <StatCard
              variant="inline"
              label="Balance Pending"
              value={formatCurrency(overallClientStats.totalPending)}
              valueClassName="text-warning"
            />
            <StatCard
              variant="inline"
              label="Active Projects"
              value={overallClientStats.projectsCount}
            />
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            searchValue={clientSearch}
            onSearchChange={(value) => {
              setClientSearch(value);
              setClientPage(1);
            }}
            searchPlaceholder="Search project or client..."
            filters={
              <>
                <Select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setClientPage(1);
                  }}
                  placeholder=""
                  className="h-9 w-44 text-xs"
                  options={[
                    { value: 'all', label: 'All Project Sites' },
                    ...schedules.map((s) => ({
                      value: s.projectId,
                      label: `${s.projectName} (${s.clientName})`,
                    })),
                  ]}
                />
                <Select
                  value={clientStatusFilter}
                  onChange={(e) => {
                    setClientStatusFilter(e.target.value);
                    setClientPage(1);
                  }}
                  placeholder=""
                  className="h-9 w-32 text-xs"
                  options={[
                    { value: 'all', label: `All (${clientStatusCounts.all})` },
                    { value: 'paid', label: `Paid (${clientStatusCounts.paid})` },
                    { value: 'pending', label: `Pending (${clientStatusCounts.pending})` },
                    { value: 'overdue', label: `Overdue (${clientStatusCounts.overdue})` },
                  ]}
                />
              </>
            }
          />

          <Table
            variant="clean"
            columns={[
              {
                key: 'projectName',
                header: 'Project & Client',
                render: (item) => (
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate max-w-[260px]">
                      {item.projectName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[260px]">
                      {item.title}{item.percentage !== undefined ? ` (${item.percentage}%)` : ''}
                      {' · '}{item.clientName}
                    </div>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                cellClassName: 'font-mono font-medium text-foreground whitespace-nowrap',
                render: (item) => formatCurrency(item.amount),
              },
              {
                key: 'dueDate',
                header: 'Due Date',
                cellClassName: 'font-mono text-muted-foreground whitespace-nowrap',
                render: (item) => (item.dueDate ? formatDate(item.dueDate) : '-'),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => (
                  <Badge
                    variant={
                      item.status === 'paid'
                        ? 'success'
                        : item.status === 'overdue'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (item) => (
                  <div className="flex items-center justify-end gap-1">
                    {(item.status === 'paid' || item.receiptNumber || item.receiptUrl || item.paymentProof) && (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingReceipt({
                            ...item,
                            projectName: item.projectName,
                            clientName: item.clientName,
                            variant: 'receipt',
                          })
                        }
                        className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="View Receipt Voucher"
                      >
                        <EyeIcon className="size-4" />
                      </button>
                    )}
                    {isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetSchedule = schedules.find((s) => s.projectId === item.projectId);
                          handleOpenPaymentModal(targetSchedule);
                        }}
                        className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="Edit / Record Payment"
                      >
                        <ReceiptIcon className="size-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={paginatedClientPayments}
            keyField="id"
            emptyTitle="No payments found"
            emptyDescription="No client payment installments match the current filters."
            pagination={{
              currentPage: clientPage,
              totalPages: clientTotalPages,
              totalItems: filteredClientPayments.length,
              pageSize: clientRowsPerPage,
              onPageChange: setClientPage,
              onPageSizeChange: (size) => {
                setClientRowsPerPage(size);
                setClientPage(1);
              },
            }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: PAY (AGENCY PAYOUTS ONLY - REDESIGNED PER REFERENCE FINTECH UI)  */}
      {/* ===================================================================== */}
      {currentView === 'pay' && (
        <div className="space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              variant="inline"
              label="Total Invoiced"
              value={formatCurrency(agencyTotals.totalBilled)}
            />
            <StatCard
              variant="inline"
              label="Total Cleared"
              value={formatCurrency(agencyTotals.totalCleared)}
              valueClassName="text-success"
            />
            <StatCard
              variant="inline"
              label="Balance Due"
              value={formatCurrency(agencyTotals.totalDue)}
              valueClassName="text-warning"
            />
            <StatCard
              variant="inline"
              label="Active Agencies"
              value={agencyTotals.activeAgencies}
            />
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            searchValue={agencySearch}
            onSearchChange={(value) => {
              setAgencySearch(value);
              setAgencyPage(1);
            }}
            searchPlaceholder="Search agency or invoice..."
            filters={
              <>
                <Select
                  value={agencyProjectFilter}
                  onChange={(e) => {
                    setAgencyProjectFilter(e.target.value);
                    setAgencyPage(1);
                  }}
                  placeholder=""
                  className="h-9 w-44 text-xs"
                  options={[
                    { value: 'all', label: 'All Project Sites' },
                    ...schedules.map((s) => ({ value: s.projectId, label: s.projectName })),
                  ]}
                />
                <Select
                  value={agencyStatusFilter}
                  onChange={(e) => {
                    setAgencyStatusFilter(e.target.value);
                    setAgencyPage(1);
                  }}
                  placeholder=""
                  className="h-9 w-40 text-xs"
                  options={[
                    { value: 'all', label: `All (${agencyStatusCounts.all})` },
                    { value: 'paid', label: `Paid (${agencyStatusCounts.paid})` },
                    { value: 'partially_paid', label: `Partially Paid (${agencyStatusCounts.partially_paid})` },
                    { value: 'pending', label: `Pending (${agencyStatusCounts.pending})` },
                  ]}
                />
              </>
            }
          />

          <Table
            variant="clean"
            columns={[
              {
                key: 'agencyName',
                header: 'Agency & Project',
                render: (item) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={item.agencyName} size="sm" className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate max-w-[200px]">
                        {item.agencyName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[240px] mt-0.5">
                        {item.projectName}
                        {' · '}
                        <span className="font-mono">{item.invoiceNumber}</span>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'billAmount',
                header: 'Amount',
                cellClassName: 'font-mono font-medium text-foreground whitespace-nowrap',
                render: (item) => formatCurrency(item.billAmount),
              },
              {
                key: 'paymentDate',
                header: 'Date',
                render: (item) => (
                  <div className="text-muted-foreground whitespace-nowrap">
                    {item.paymentDate ? formatDate(item.paymentDate) : '-'}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => (
                  <Badge
                    variant={
                      item.status === 'paid'
                        ? 'success'
                        : item.status === 'partially_paid'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {item.status === 'partially_paid'
                      ? 'Partially Paid'
                      : item.status
                      ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
                      : 'Pending'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (item) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setViewingReceipt({
                          title: item.workStage || 'Agency Subcontractor Bill',
                          amount: item.billAmount,
                          paidAmount: item.paidAmount,
                          paymentMode: item.paymentMode,
                          receiptNumber: item.invoiceNumber,
                          dueDate: item.dueDate,
                          paidDate: item.paymentDate,
                          projectName: item.projectName,
                          clientName: item.agencyName,
                          trade: item.trade,
                          variant: 'bill',
                          paymentProof: item.proof,
                        })
                      }
                      className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      title="View receipt"
                    >
                      <EyeIcon className="size-4" />
                    </button>
                    {isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAgencyPayout(item.id)}
                        className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                        title="Delete bill"
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={paginatedAgencyPayouts}
            keyField="id"
            emptyTitle="No agency bills found"
            emptyDescription="No agency payout records match the current filters."
            pagination={{
              currentPage: agencyPage,
              totalPages: agencyTotalPages,
              totalItems: filteredAgencyPayouts.length,
              pageSize: agencyRowsPerPage,
              onPageChange: setAgencyPage,
              onPageSizeChange: (size) => {
                setAgencyRowsPerPage(size);
                setAgencyPage(1);
              },
            }}
          />
        </div>
      )}

      {currentView === 'settings' && (
        <form onSubmit={handleSavePaymentSettings} className="space-y-5">
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-muted/10">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2Icon className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Receiving Bank Account</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Printed on client invoices and receipts for NEFT, RTGS and UPI transfers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Bank name</label>
                <Input
                  type="text"
                  required
                  value={paymentSettings.bankName}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Account name</label>
                <Input
                  type="text"
                  required
                  value={paymentSettings.accountName}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, accountName: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Account number</label>
                <Input
                  type="text"
                  required
                  value={paymentSettings.accountNumber}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })}
                  className="w-full font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">IFSC code</label>
                <Input
                  type="text"
                  required
                  value={paymentSettings.ifscCode}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, ifscCode: e.target.value })}
                  className="w-full font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-medium text-foreground">UPI ID / VPA</label>
                <Input
                  type="text"
                  value={paymentSettings.upiId}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                  className="w-full font-mono"
                  placeholder="e.g. business@bank"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/10">
                <h2 className="text-sm font-semibold text-foreground">Contract Defaults</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Prefilled when creating a new client payment plan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Advance (%)</label>
                  <NumberInput
                   
                    value={paymentSettings.defaultAdvancePercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultAdvancePercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Installments</label>
                  <StepperInput
                   
                    value={paymentSettings.defaultInstallmentsCount}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultInstallmentsCount: numericOnChange(e.target.value, (v) => parseInt(v, 10)) })}
                   
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Grace period (days)</label>
                  <StepperInput
                   
                    value={paymentSettings.gracePeriodDays}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, gracePeriodDays: numericOnChange(e.target.value, (v) => parseInt(v, 10)) })}
                   
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">GST (%)</label>
                  <NumberInput
                   
                    value={paymentSettings.defaultGstPercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultGstPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/10">
                <h2 className="text-sm font-semibold text-foreground">Agency Payout Rules</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Applied when clearing subcontractor invoices.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">TDS on contracts (%)</label>
                  <NumberInput
                   
                    step="0.1"
                    value={paymentSettings.tdsRateOnContracts}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, tdsRateOnContracts: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground">Retention hold (%)</label>
                  <NumberInput
                   
                    value={paymentSettings.retentionHoldPercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, retentionHoldPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-2xs">
            <p className="text-[11px] text-muted-foreground">
              These defaults apply to new payment plans and invoices only. Existing records stay unchanged.
            </p>
            <Button type="submit" variant="primary" size="sm" className="flex items-center gap-1.5 self-end sm:self-auto">
              <SaveIcon className="size-4" />
              <span>Save Settings</span>
            </Button>
          </div>
        </form>
      )}

      {/* SIMPLIFIED RECORD AGENCY PAYMENT MODAL                                */}
      {/* ===================================================================== */}
      {isRecordAgencyOpen && (
        <Modal
          isOpen={isRecordAgencyOpen}
          onClose={() => setIsRecordAgencyOpen(false)}
          title="Record Agency Bill / Clearance"
          subtitle="Record and clear subcontractor contractor bills."
          size="md"
        >
          <form onSubmit={handleSaveAgencyPayout} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Subcontractor Agency <span className="text-destructive">*</span>
              </label>
              <SelectField
                value={agencyForm.agencyId}
                onChange={(e) => {
                  const ag = mockAgencies.find((a) => a.id === e.target.value);
                  setAgencyForm({
                    ...agencyForm,
                    agencyId: e.target.value,
                    agencyName: ag?.name || agencyForm.agencyName,
                    trade: ag?.trade || agencyForm.trade,
                  });
                }}
                className="w-full"
              >
                {mockAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.trade})
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Project Site <span className="text-destructive">*</span>
                </label>
                <SelectField
                  value={agencyForm.projectId}
                  onChange={(e) => setAgencyForm({ ...agencyForm, projectId: e.target.value })}
                  className="w-full"
                >
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Invoice Number <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. INV-APX-2026-089"
                  value={agencyForm.invoiceNumber}
                  onChange={(e) => setAgencyForm({ ...agencyForm, invoiceNumber: e.target.value })}
                  className="w-full font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MoneyInput
                label="Bill Amount (₹)"
               
                required
                min="1"
                placeholder="e.g. 1,20,000"
                value={agencyForm.billAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, billAmount: e.target.value })}
              />

              <MoneyInput
                label="Amount Paying Now (₹)"
               
                min="0"
                placeholder="e.g. 80,000"
                value={agencyForm.paidAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, paidAmount: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Bill Due Date
                </label>
                <DateInput
                 
                  value={agencyForm.dueDate}
                  onChange={(e) => setAgencyForm({ ...agencyForm, dueDate: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Date
                </label>
                <DateInput
                 
                  value={agencyForm.paymentDate}
                  onChange={(e) => setAgencyForm({ ...agencyForm, paymentDate: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Mode
                </label>
                <SelectField
                  value={agencyForm.paymentMode}
                  onChange={(e) => setAgencyForm({ ...agencyForm, paymentMode: e.target.value })}
                  className="w-full"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </SelectField>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Work Stage / Description
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Framing & Boarding Stage Bill"
                  value={agencyForm.workStage}
                  onChange={(e) => setAgencyForm({ ...agencyForm, workStage: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Bill / Slip File Picker */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Bill Proof / Slip (Optional)
              </label>
              {agencyForm.proof ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <img src={agencyForm.proof} alt="Bill Proof" className="size-8 rounded object-cover" />
                  <span className="text-xs text-foreground font-medium flex-1 truncate">Attached bill slip</span>
                  <button
                    type="button"
                    onClick={() => setAgencyForm({ ...agencyForm, proof: null })}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ) : (
                <FileDrop
                  accept="image/*,application/pdf"
                  hint="Drop the invoice or payment slip here, or click to choose"
                  onFile={([file]) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => setAgencyForm((prev) => ({ ...prev, proof: ev.target.result }));
                    reader.readAsDataURL(file);
                  }}
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordAgencyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Agency Bill
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* IMAGE PREVIEW MODAL                                                   */}
      {/* ===================================================================== */}
      {previewImageModal && (
        <Modal
          isOpen={!!previewImageModal}
          onClose={() => setPreviewImageModal(null)}
          title="Payment Attachment"
          subtitle="Uploaded payment proof"
          size="xl"
          bodyClassName="p-0"
          footer={
            <>
              <a
                href={previewImageModal}
                download="payment-proof"
                className="inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 select-none shadow-2xs whitespace-nowrap text-xs px-3 py-2 gap-1.5 bg-card hover:bg-muted text-foreground border border-border"
              >
                <DownloadIcon className="size-3.5" />
                Download
              </a>
              <Button variant="primary" size="sm" onClick={() => setPreviewImageModal(null)}>
                Close Preview
              </Button>
            </>
          }
        >
          <div className="flex items-center justify-center bg-muted/40 p-4 sm:p-6 min-h-[40vh]">
            <img
              src={previewImageModal}
              alt="Payment proof full view"
              className="max-h-[70vh] w-auto max-w-full rounded-lg border border-border bg-card object-contain shadow-sm"
            />
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* RECEIPT / VOUCHER VIEWER MODAL                                        */}
      {/* ===================================================================== */}
      {viewingReceipt && (() => {
        const receipt = viewingReceipt;
        const isBill = receipt.variant === 'bill';
        const paymentMode = receipt.paymentMode || receipt.mode;
        const paidOn = receipt.paidDate || receipt.date;
        const paidAmount = receipt.paidAmount ?? receipt.amount;
        const balanceDue =
          receipt.amount !== undefined && receipt.paidAmount !== undefined
            ? Math.max(0, receipt.amount - receipt.paidAmount)
            : 0;
        const isPaid = receipt.status === 'paid' || !!receipt.paidDate || !!receipt.paidAmount;

        const detailRows = [
          { label: isBill ? 'Invoice No.' : 'Receipt No.', value: receipt.receiptNumber || '-', mono: true },
          { label: 'Due Date', value: receipt.dueDate ? formatDate(receipt.dueDate) : '-' },
          { label: 'Paid Date', value: paidOn ? formatDate(paidOn) : '-' },
          { label: isBill ? 'Paid To' : 'Received From', value: receipt.clientName || '-' },
          { label: 'Project', value: receipt.projectName || '-' },
          ...(isBill && receipt.trade ? [{ label: 'Trade', value: receipt.trade }] : []),
          { label: 'Payment Mode', value: paymentMode || '-' },
          { label: isBill ? 'Work Stage' : 'Against', value: receipt.title || (isBill ? 'Subcontractor bill' : 'Payment installment') },
        ];

        return (
          <Modal
            isOpen={!!viewingReceipt}
            onClose={() => setViewingReceipt(null)}
            title={isBill ? 'Agency Payment Receipt' : 'Client Payment Receipt'}
            subtitle={isBill ? 'Subcontractor payment voucher' : 'Client payment voucher'}
            size="md"
            bodyClassName="p-0"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <PrinterIcon className="size-3.5" />
                  Print Receipt
                </Button>
                <Button variant="primary" size="sm" onClick={() => setViewingReceipt(null)}>
                  <CheckIcon className="size-3.5" />
                  Done
                </Button>
              </>
            }
          >
            <div className="bg-muted/30 px-4 py-5 sm:px-5">
              <div className="relative mx-auto max-w-md rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {isPaid && (
                  <span className="absolute top-4 right-4 rotate-6 rounded border-2 border-success/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-success/50 select-none">
                    Paid
                  </span>
                )}

                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="mx-auto mb-2.5 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2Icon className="size-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    Aesthetic Interiors
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Payment Receipt
                  </p>
                </div>

                <div className="mx-6 border-t border-dashed border-border" />

                <div className="px-6 py-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount Paid
                  </p>
                  <p className="text-2xl font-bold font-mono text-success leading-tight">
                    {formatCurrency(paidAmount)}
                  </p>
                  {balanceDue > 0 && (
                    <p className="mt-1 text-[10px] text-warning font-medium">
                      Balance due {formatCurrency(balanceDue)}
                    </p>
                  )}
                </div>

                <div className="mx-6 border-t border-dashed border-border" />

                <div className="px-6 py-2.5 text-xs">
                  {detailRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-4 py-2 border-b border-dashed border-border/60 last:border-0"
                    >
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {row.label}
                      </span>
                      <span
                        className={cn(
                          'font-semibold text-foreground text-right truncate',
                          row.mono && 'font-mono'
                        )}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {receipt.paymentProof && (
                  <div className="px-6 pb-4">
                    <button
                      type="button"
                      onClick={() => setPreviewImageModal(receipt.paymentProof)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left cursor-pointer"
                    >
                      <img
                        src={receipt.paymentProof}
                        alt="Payment proof"
                        className="size-9 rounded-md object-cover border border-border shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-semibold text-foreground">
                          Payment proof attached
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          Click to view the slip
                        </span>
                      </span>
                      <EyeIcon className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  </div>
                )}

                <div className="px-6 py-3 border-t border-dashed border-border bg-muted/20 text-center">
                  <p className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <ShieldCheckIcon className="size-3.5 shrink-0" />
                    Computer-generated receipt. No signature required.
                  </p>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteAgencyPayout}
        title="Delete agency bill?"
        message="Are you sure you want to delete this agency bill record? This action cannot be undone."
        confirmText="Delete"
      />
    </div>
  );
}

export default PaymentsPage;
