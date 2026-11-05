'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  mockProjectPaymentSchedules,
  mockAgencyPayouts,
} from '../data/payments';
import { mockAgencies } from '../data/agencies';
import { cn } from '../lib/utils';

// BefUI Components strictly adhering to design.md tokens
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import Pagination from '../components/ui/Pagination';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/badge';

// BefUI Icons strictly from '@/components/ui/icons'
import {
  WalletIcon,
  Building2Icon,
  ReceiptIcon,
  SaveIcon,
  SettingsIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  EyeIcon,
  CameraIcon,
  TrashIcon,
  DownloadIcon,
  XIcon,
  CalendarIcon,
  CreditCardIcon,
  FilterIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from '../components/ui/icons';

const STORAGE_KEY_CLIENT_PAYMENTS = 'osm_client_payment_schedules_v3';
const STORAGE_KEY_AGENCY_PAYOUTS = 'osm_agency_payouts_v2';
const STORAGE_KEY_PAYMENT_SETTINGS = 'osm_payment_settings_v2';

const initialPaymentSettings = {
  bankName: 'HDFC Bank Ltd',
  accountName: 'Aesthetic Interiors OMS Pvt Ltd',
  accountNumber: '50200088991122',
  ifscCode: 'HDFC0001234',
  upiId: 'aestheticinteriors@hdfcbank',
  defaultAdvancePercent: 30,
  defaultInstallmentsCount: 3,
  gracePeriodDays: 7,
  defaultGstPercent: 18,
  tdsRateOnContracts: 2.0,
  retentionHoldPercent: 5,
};

export function PaymentsPage({ mode }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const location = useLocation();

  // Determine view mode directly from route & prop: 'received' | 'pay' | 'settings'
  const currentView = useMemo(() => {
    if (mode === 'settings' || location.pathname.includes('/payments/settings')) return 'settings';
    if (mode === 'pay' || location.pathname.includes('/payments/pay')) return 'pay';
    return 'received';
  }, [mode, location.pathname]);

  // Payment Configuration Settings State
  const [paymentSettings, setPaymentSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAYMENT_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return initialPaymentSettings;
  });

  const handleSavePaymentSettings = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY_PAYMENT_SETTINGS, JSON.stringify(paymentSettings));
      toast.success('Payment settings saved successfully!');
    } catch (e) {
      toast.error('Failed to save payment settings');
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
  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_PAYMENTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load client payment schedules', e);
    }
    return mockProjectPaymentSchedules;
  });

  const saveSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_PAYMENTS, JSON.stringify(newSchedules));
    } catch (e) {
      console.error('Failed to save client payment schedules', e);
    }
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
  const [clientRowsPerPage, setClientRowsPerPage] = useState(8);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

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

  const handleToggleClientSelect = (id) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllClients = () => {
    if (selectedClientIds.length === paginatedClientPayments.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(paginatedClientPayments.map((item) => item.id));
    }
  };

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
  const [agencyPayouts, setAgencyPayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AGENCY_PAYOUTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load agency payouts', e);
    }
    return mockAgencyPayouts;
  });

  const saveAgencyPayouts = (newPayouts) => {
    setAgencyPayouts(newPayouts);
    try {
      localStorage.setItem(STORAGE_KEY_AGENCY_PAYOUTS, JSON.stringify(newPayouts));
    } catch (e) {
      console.error('Failed to save agency payouts', e);
    }
  };

  // Agency Filters
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState('all');
  const [agencyProjectFilter, setAgencyProjectFilter] = useState('all');
  const [agencyMethodFilter, setAgencyMethodFilter] = useState('all');
  const [agencySort, setAgencySort] = useState('newest');
  const [agencyPage, setAgencyPage] = useState(1);
  const [agencyRowsPerPage, setAgencyRowsPerPage] = useState(8);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState([]);

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

  const handleToggleAgencySelect = (id) => {
    setSelectedAgencyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllAgencies = () => {
    if (selectedAgencyIds.length === paginatedAgencyPayouts.length) {
      setSelectedAgencyIds([]);
    } else {
      setSelectedAgencyIds(paginatedAgencyPayouts.map((item) => item.id));
    }
  };

  const handleDeleteAgencyPayout = (id) => {
    if (!window.confirm('Are you sure you want to delete this agency bill record?')) return;
    const updated = agencyPayouts.filter((a) => a.id !== id);
    saveAgencyPayouts(updated);
    toast.success('Agency bill record deleted');
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
    installmentsCount: 2,
    installments: [],
  });

  // Helper to open the simplified payment modal prefilled with target schedule
  const handleOpenPaymentModal = (targetSchedule = null) => {
    const schedule = targetSchedule || currentSchedule || schedules[0];
    const totalCost = schedule?.totalCost || 40000;
    const existingInst = schedule?.installments || [];

    // Calculate advance % from first installment or default 10%
    let advPct = 10;
    let instList = [];

    if (existingInst.length > 0) {
      instList = existingInst.map((inst, idx) => ({
        id: inst.id || `inst-${idx + 1}`,
        title: inst.title || `Installment ${idx + 1}`,
        percentage: inst.percentage !== undefined ? Number(inst.percentage) : Math.round(100 / Math.max(1, existingInst.length)),
        amount: Number(inst.amount) || 0,
        status: inst.status || 'pending',
        dueDate: inst.dueDate ? inst.dueDate.split('T')[0] : '',
        paidDate: inst.paidDate ? inst.paidDate.split('T')[0] : '',
        paymentMode: inst.paymentMode || 'Bank Transfer',
        paymentProof: inst.paymentProof || null,
        paymentProofName: inst.paymentProofName || '',
      }));
    } else {
      const advAmt = Math.round((totalCost * advPct) / 100);
      const remaining = Math.max(0, totalCost - advAmt);
      instList = [
        {
          id: 'inst-1',
          title: 'Installment 1',
          percentage: 50,
          amount: Math.round(remaining * 0.5),
          status: 'pending',
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          paidDate: '',
          paymentMode: 'Bank Transfer',
          paymentProof: null,
          paymentProofName: '',
        },
        {
          id: 'inst-2',
          title: 'Installment 2',
          percentage: 50,
          amount: Math.round(remaining * 0.5),
          status: 'pending',
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          paidDate: '',
          paymentMode: 'Bank Transfer',
          paymentProof: null,
          paymentProofName: '',
        },
      ];
    }

    setPaymentForm({
      projectId: schedule?.projectId || 'P1',
      projectName: schedule?.projectName || '',
      clientName: schedule?.clientName || '',
      totalCost,
      advancePercentage: advPct,
      installmentsCount: instList.length || 2,
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
      totalCost: cost,
      advancePercentage: advPct,
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

  // Save the simplified payment form
  const handleSavePaymentForm = (e) => {
    e.preventDefault();
    const updatedSchedules = schedules.map((s) => {
      if (s.projectId === paymentForm.projectId) {
        return {
          ...s,
          totalCost: paymentForm.totalCost,
          installments: paymentForm.installments,
        };
      }
      return s;
    });

    saveSchedules(updatedSchedules);
    toast.success('Payment plan & installments updated successfully!');
    setIsPaymentModalOpen(false);
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
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank Transfer',
    workStage: '',
    proof: null,
  });

  const handleSaveAgencyPayout = (e) => {
    e.preventDefault();
    if (!agencyForm.invoiceNumber.trim()) {
      toast.error('Please enter an invoice number');
      return;
    }
    const billed = parseFloat(agencyForm.billAmount) || 0;
    const paid = parseFloat(agencyForm.paidAmount) || 0;
    const due = Math.max(0, billed - paid);
    const targetProj = schedules.find((s) => s.projectId === agencyForm.projectId);

    const newRecord = {
      id: `apx-${Date.now()}`,
      agencyId: agencyForm.agencyId,
      agencyName: agencyForm.agencyName,
      trade: agencyForm.trade,
      projectId: agencyForm.projectId,
      projectName: targetProj?.projectName || 'Indiranagar 4BHK Luxury Villa',
      invoiceNumber: agencyForm.invoiceNumber.trim(),
      billAmount: billed,
      paidAmount: paid,
      pendingBalance: due,
      status: due === 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'pending',
      paymentDate: agencyForm.paymentDate,
      paymentMode: agencyForm.paymentMode,
      workStage: agencyForm.workStage || 'Site Trade Clearance',
      proof: agencyForm.proof,
    };

    saveAgencyPayouts([newRecord, ...agencyPayouts]);
    toast.success(`Agency bill ${newRecord.invoiceNumber} recorded successfully!`);
    setIsRecordAgencyOpen(false);
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
    return (
      <div className="space-y-6 pb-20 animate-in fade-in duration-200">
        {/* Full Screen Top Navigation & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Back to Received Payments"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Record Client Payment
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                  Full Screen Form
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure contract budget, advance percentage, installment milestones, and attach payment proofs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
              <span>Save Payment Schedule</span>
            </Button>
          </div>
        </div>

        <form onSubmit={handleSavePaymentForm} className="space-y-6">
          {/* Card 1: Project & Client Selection */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Project & Client Selection
              </span>
              <span className="text-xs text-muted-foreground">
                Select project to configure payment schedule
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Project & Client *
                </label>
                <select
                  value={paymentForm.projectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const prj = schedules.find((s) => s.projectId === pid);
                    handleOpenPaymentModal(prj);
                  }}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName} (Client: {s.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Client Name
                </label>
                <div className="w-full h-10 px-3 flex items-center border border-border rounded-lg bg-muted/20 text-foreground text-xs font-semibold">
                  {paymentForm.clientName || 'Select a project'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Total Contract Budget & Advance % (with Live Value in Front of It) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Contract Budget & Advance Allocation
              </span>
              <span className="text-xs text-muted-foreground">
                Advance value is calculated live
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Contract Budget */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Total Contract Budget (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={paymentForm.totalCost}
                  onChange={(e) => handleRecalculateBudget(e.target.value, paymentForm.advancePercentage)}
                  className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. 1500000"
                />
              </div>

              {/* Advance Percentage (%) */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Advance Percentage (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={paymentForm.advancePercentage}
                    onChange={(e) => handleRecalculateBudget(paymentForm.totalCost, e.target.value)}
                    className="w-full h-10 px-3 pr-8 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="e.g. 30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    %
                  </span>
                </div>
              </div>

              {/* Advance Value Directly in Front of It */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Advance Value (Live)
                </label>
                <div className="w-full h-10 px-3 flex items-center justify-between border border-border rounded-lg bg-primary/5 text-primary">
                  <span className="text-xs text-muted-foreground">Calculated:</span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {formatCurrency(modalAdvVal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Budget Balance Banner */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Advance Amount: <strong className="text-foreground">{paymentForm.advancePercentage}%</strong> of {formatCurrency(modalCost)}
              </span>
              <span className="text-muted-foreground">
                Remaining Balance for Installments: <strong className="font-mono font-bold text-foreground text-sm">{formatCurrency(modalRemVal)}</strong>
              </span>
            </div>
          </div>

          {/* Card 3: Installments & Payment Details */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  3. Installment Milestones & Clearances
                </span>
                <span className="text-xs text-muted-foreground">
                  Percentage, status, dates, payment mode and proof for each installment
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  No. of Installments:
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={paymentForm.installmentsCount}
                  onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                  className="w-20 h-9 px-2.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Installments List */}
            <div className="space-y-4">
              {paymentForm.installments.map((inst, idx) => (
                <div
                  key={inst.id || idx}
                  className="p-4 rounded-xl border border-border bg-muted/10 space-y-3.5 text-xs shadow-2xs hover:border-primary/30 transition-colors"
                >
                  {/* Header: Title, Percentage & Calculated Value */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {inst.title || `Installment #${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Percentage:</span>
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inst.percentage}
                          onChange={(e) => {
                            const newPct = parseFloat(e.target.value) || 0;
                            const updated = [...paymentForm.installments];
                            const amt = Math.round((modalRemVal * newPct) / 100);
                            updated[idx] = { ...updated[idx], percentage: newPct, amount: amt };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          className="w-full h-8 px-2.5 pr-6 border border-border rounded-md bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">
                          %
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs text-foreground px-2.5 py-1 rounded bg-muted border border-border">
                        {formatCurrency(inst.amount)}
                      </span>
                    </div>
                  </div>

                  {/* 4 Fields Grid: Status, Due Date, Paid Date, Payment Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Status
                      </label>
                      <select
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
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => {
                          const updated = [...paymentForm.installments];
                          updated[idx] = { ...updated[idx], dueDate: e.target.value };
                          setPaymentForm({ ...paymentForm, installments: updated });
                        }}
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Paid Date
                      </label>
                      <input
                        type="date"
                        value={inst.paidDate}
                        onChange={(e) => {
                          const updated = [...paymentForm.installments];
                          updated[idx] = { ...updated[idx], paidDate: e.target.value };
                          setPaymentForm({ ...paymentForm, installments: updated });
                        }}
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={inst.paymentMode}
                        onChange={(e) => {
                          const updated = [...paymentForm.installments];
                          updated[idx] = { ...updated[idx], paymentMode: e.target.value };
                          setPaymentForm({ ...paymentForm, installments: updated });
                        }}
                        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Proof (Pic Option) */}
                  <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Payment Proof:
                    </span>
                    {inst.paymentProof ? (
                      <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
                        <img
                          src={inst.paymentProof}
                          alt="Proof"
                          onClick={() => setPreviewImageModal(inst.paymentProof)}
                          className="size-7 rounded object-cover cursor-pointer border border-border hover:opacity-80"
                        />
                        <span className="text-xs font-medium text-foreground max-w-[200px] truncate">
                          {inst.paymentProofName || 'Picture Attached'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewImageModal(inst.paymentProof)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="View Preview"
                        >
                          <EyeIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...paymentForm.installments];
                            updated[idx] = { ...updated[idx], paymentProof: null, paymentProofName: '' };
                            setPaymentForm({ ...paymentForm, installments: updated });
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Remove picture"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 bg-background hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                        <CameraIcon className="size-3.5 text-primary" />
                        <span>Attach Picture / Slip</span>
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
              ))}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="flex items-center gap-1.5 font-semibold"
            >
              <SaveIcon className="size-4" />
              <span>Save Payment Schedule</span>
            </Button>
          </div>
        </form>

        {/* Modal preview image if opened while in full-screen */}
        {previewImageModal && (
          <Modal
            isOpen={!!previewImageModal}
            onClose={() => setPreviewImageModal(null)}
            title="Payment Proof Preview"
            size="lg"
          >
            <div className="space-y-3">
              <img
                src={previewImageModal}
                alt="Payment Proof"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-border"
              />
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setPreviewImageModal(null)}>
                  Close Preview
                </Button>
              </div>
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
            ? 'Track contract budgets, advance allocations, installments & payment proofs.'
            : currentView === 'pay'
            ? 'Manage subcontractor contractor bills, clearances, and payment history.'
            : 'Configure receiving bank accounts, contract milestones, and invoice defaults.'
        }
        actions={
          isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              {currentView === 'received' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportClientCSV}
                    className="flex items-center gap-1.5"
                    title="Export CSV"
                  >
                    <DownloadIcon className="size-4" />
                    <span>Export</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenPaymentModal()}
                    className="flex items-center gap-1.5"
                  >
                    <PlusIcon className="size-4" />
                    <span>Record Payment</span>
                  </Button>
                </>
              )}

              {currentView === 'pay' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAgencyCSV}
                    className="flex items-center gap-1.5"
                    title="Export CSV"
                  >
                    <DownloadIcon className="size-4" />
                    <span>Export</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const firstAg = mockAgencies[0];
                      setAgencyForm({
                        agencyId: firstAg?.id || 'a1',
                        agencyName: firstAg?.name || 'Apex False Ceiling',
                        trade: firstAg?.trade || 'Ceiling',
                        projectId: schedules[0]?.projectId || 'P1',
                        invoiceNumber: `INV-AGC-${Date.now().toString().slice(-4)}`,
                        billAmount: 120000,
                        paidAmount: 80000,
                        paymentDate: new Date().toISOString().split('T')[0],
                        paymentMode: 'Bank Transfer',
                        workStage: 'Framing & Boarding Stage Bill',
                        proof: null,
                      });
                      setIsRecordAgencyOpen(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <PlusIcon className="size-4" />
                    <span>Record Agency Payment</span>
                  </Button>
                </>
              )}
            </div>
          )
        }
      />

      {/* ===================================================================== */}
      {/* VIEW: RECEIVED (CLIENT PAYMENTS - REDESIGNED PER REFERENCE FINTECH UI) */}
      {/* ===================================================================== */}
      {currentView === 'received' && (
        <div className="space-y-4">
          {/* 4 Clean Metric KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Contract Budget
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(overallClientStats.totalBudget)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Across all client projects</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Collected
              </span>
              <div className="text-xl font-bold font-mono text-success mt-1">
                {formatCurrency(overallClientStats.totalCollected)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Cleared client funds</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Balance Pending
              </span>
              <div className="text-xl font-bold font-mono text-warning mt-1">
                {formatCurrency(overallClientStats.totalPending)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Awaiting payment milestone</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Projects
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {overallClientStats.projectsCount}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Ongoing client fit-outs</span>
            </div>
          </div>

          {/* Horizontal Status Segment Tabs (Reference Image Match) */}
          <div className="flex items-center gap-6 border-b border-border overflow-x-auto scrollbar-none pt-1">
            {[
              { id: 'all', label: 'All payments', count: clientStatusCounts.all },
              { id: 'paid', label: 'Paid', count: clientStatusCounts.paid },
              { id: 'pending', label: 'Pending', count: clientStatusCounts.pending },
              { id: 'overdue', label: 'Overdue', count: clientStatusCounts.overdue },
            ].map((tab) => {
              const active = clientStatusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setClientStatusFilter(tab.id);
                    setClientPage(1);
                  }}
                  className={cn(
                    'pb-3 pt-1 text-xs font-semibold whitespace-nowrap transition-colors relative cursor-pointer flex items-center gap-2 border-b-2 -mb-px',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded-full font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Toolbar (Site Filter, Method Filter, Sort, Search) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Site selector dropdown */}
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setClientPage(1);
                  }}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="all">All Project Sites</option>
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName} ({s.clientName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method filter dropdown */}
              <div className="relative">
                <select
                  value={clientMethodFilter}
                  onChange={(e) => {
                    setClientMethodFilter(e.target.value);
                    setClientPage(1);
                  }}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cheque">Cheque Clearance</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={clientSort}
                  onChange={(e) => setClientSort(e.target.value)}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="due_asc">Sort: Due Date (Earliest)</option>
                  <option value="due_desc">Sort: Due Date (Latest)</option>
                  <option value="amount_desc">Sort: Amount (High to Low)</option>
                  <option value="amount_asc">Sort: Amount (Low to High)</option>
                  <option value="client_asc">Sort: Client Name (A to Z)</option>
                </select>
              </div>
            </div>

            {/* Search Input on the right (Increased height and non-overlapping placeholder) */}
            <div className="relative w-full md:w-64">
              <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientPage(1);
                }}
                className="w-full h-10 pl-9.5 pr-8 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-colors"
              />
              {clientSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setClientSearch('');
                    setClientPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Clean Fintech Table (Columns: Project & Client, Installment, Amount, Due Date, Status, Payment Details, Action) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="w-10 py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedClientPayments.length > 0 &&
                          selectedClientIds.length === paginatedClientPayments.length
                        }
                        onChange={handleSelectAllClients}
                        className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                        title="Select All Rows"
                      />
                    </th>
                    <th className="py-3 px-4">Project & Client</th>
                    <th className="py-3 px-4">Installment</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 min-w-[190px] text-left whitespace-nowrap">Payment Details</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedClientPayments.length > 0 ? (
                    paginatedClientPayments.map((item) => {
                      const isSelected = selectedClientIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            'hover:bg-muted/40 transition-colors',
                            isSelected && 'bg-primary/5'
                          )}
                        >
                          {/* Row Checkbox */}
                          <td className="w-10 py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleClientSelect(item.id)}
                              className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                            />
                          </td>

                          {/* Column 1: Project & Client */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground truncate max-w-[220px]" title={item.projectName}>
                              {item.projectName}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Client: <span className="text-foreground/80 font-medium">{item.clientName}</span>
                            </div>
                          </td>

                          {/* Column 2: Installment */}
                          <td className="py-3.5 px-4 font-medium text-foreground">
                            <span>{item.title}</span>
                            {item.percentage !== undefined && (
                              <span className="inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-muted text-muted-foreground">
                                {item.percentage}%
                              </span>
                            )}
                          </td>

                          {/* Column 3: Amount */}
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground text-xs">
                            {formatCurrency(item.amount)}
                          </td>

                          {/* Column 4: Due Date */}
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                              <span>{item.dueDate ? formatDate(item.dueDate) : '—'}</span>
                            </div>
                            {item.status === 'paid' && item.paidDate && (
                              <span className="text-[10px] text-success block mt-0.5 font-medium">
                                Paid {formatDate(item.paidDate)}
                              </span>
                            )}
                          </td>

                          {/* Column 5: Status (Dot Badge) */}
                          <td className="py-3.5 px-4">
                            {item.status === 'paid' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span>Paid</span>
                              </span>
                            )}
                            {item.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                            {item.status === 'overdue' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                                <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                                <span>Overdue</span>
                              </span>
                            )}
                          </td>

                          {/* Column 6: Payment Details (Aligned with clean badges & nowrap) */}
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {item.paymentMode ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-foreground">
                                  <CreditCardIcon className="size-3 text-muted-foreground shrink-0" />
                                  <span>{item.paymentMode}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-muted-foreground bg-muted/40 font-mono">
                                  —
                                </span>
                              )}

                              {(item.paymentProof || item.receiptUrl) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.paymentProof) {
                                      setPreviewImageModal(item.paymentProof);
                                    } else {
                                      setViewingReceipt({
                                        ...item,
                                        projectName: item.projectName,
                                        clientName: item.clientName,
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
                                  title="View Proof / Receipt Slip"
                                >
                                  <CameraIcon className="size-3" />
                                  <span>Slip</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Column 7: Action */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(item.status === 'paid' || item.receiptNumber || item.receiptUrl) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingReceipt({
                                      ...item,
                                      projectName: item.projectName,
                                      clientName: item.clientName,
                                    })
                                  }
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
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
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                                  title="Edit / Record Payment"
                                >
                                  <ReceiptIcon className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                        No client payment installments found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
              <div>
                Showing <span className="font-semibold text-foreground">{filteredClientPayments.length === 0 ? 0 : (clientPage - 1) * clientRowsPerPage + 1}</span> to{' '}
                <span className="font-semibold text-foreground">{Math.min(clientPage * clientRowsPerPage, filteredClientPayments.length)}</span> of{' '}
                <span className="font-semibold text-foreground">{filteredClientPayments.length}</span> results
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clientPage <= 1}
                  onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {clientPage} of {clientTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clientPage >= clientTotalPages}
                  onClick={() => setClientPage((p) => p + 1)}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: PAY (AGENCY PAYOUTS ONLY - REDESIGNED PER REFERENCE FINTECH UI)  */}
      {/* ===================================================================== */}
      {currentView === 'pay' && (
        <div className="space-y-4">
          {/* Quick KPI Metric Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Invoiced
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(agencyTotals.totalBilled)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Subcontractor agency billings</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Cleared
              </span>
              <div className="text-xl font-bold font-mono text-success mt-1">
                {formatCurrency(agencyTotals.totalCleared)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Cleared payments</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Balance Due
              </span>
              <div className="text-xl font-bold font-mono text-warning mt-1">
                {formatCurrency(agencyTotals.totalDue)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Pending invoice clearance</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Agencies
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {agencyTotals.activeAgencies}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Trade partner agencies</span>
            </div>
          </div>

          {/* Horizontal Status Segment Tabs (Reference Image Match) */}
          <div className="flex items-center gap-6 border-b border-border overflow-x-auto scrollbar-none pt-1">
            {[
              { id: 'all', label: 'All bills', count: agencyStatusCounts.all },
              { id: 'paid', label: 'Paid', count: agencyStatusCounts.paid },
              { id: 'partially_paid', label: 'Partially Paid', count: agencyStatusCounts.partially_paid },
              { id: 'pending', label: 'Pending', count: agencyStatusCounts.pending },
            ].map((tab) => {
              const active = agencyStatusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAgencyStatusFilter(tab.id);
                    setAgencyPage(1);
                  }}
                  className={cn(
                    'pb-3 pt-1 text-xs font-semibold whitespace-nowrap transition-colors relative cursor-pointer flex items-center gap-2 border-b-2 -mb-px',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded-full font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Toolbar (Site Filter, Method Filter, Sort, Search) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Site filter dropdown */}
              <div className="relative">
                <select
                  value={agencyProjectFilter}
                  onChange={(e) => {
                    setAgencyProjectFilter(e.target.value);
                    setAgencyPage(1);
                  }}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="all">All Project Sites</option>
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method filter dropdown */}
              <div className="relative">
                <select
                  value={agencyMethodFilter}
                  onChange={(e) => {
                    setAgencyMethodFilter(e.target.value);
                    setAgencyPage(1);
                  }}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque Clearance</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                </select>
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={agencySort}
                  onChange={(e) => setAgencySort(e.target.value)}
                  className="h-10 px-3.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs hover:bg-muted/40 transition-colors"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="bill_desc">Sort: Bill Amount (High to Low)</option>
                  <option value="due_desc">Sort: Balance Due (High to Low)</option>
                  <option value="name_asc">Sort: Agency Name (A to Z)</option>
                </select>
              </div>
            </div>

            {/* Search Input on the right (Increased height and non-overlapping placeholder) */}
            <div className="relative w-full md:w-64">
              <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={agencySearch}
                onChange={(e) => {
                  setAgencySearch(e.target.value);
                  setAgencyPage(1);
                }}
                placeholder="Search..."
                className="w-full h-10 pl-9.5 pr-8 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-colors"
              />
              {agencySearch && (
                <button
                  type="button"
                  onClick={() => {
                    setAgencySearch('');
                    setAgencyPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Clean Fintech Table (Columns: Agency & Project, Invoice & Stage, Amount, Date, Status, Payment Details, Action) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="w-10 py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedAgencyPayouts.length > 0 &&
                          selectedAgencyIds.length === paginatedAgencyPayouts.length
                        }
                        onChange={handleSelectAllAgencies}
                        className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                        title="Select All Rows"
                      />
                    </th>
                    <th className="py-3 px-4">Agency & Project</th>
                    <th className="py-3 px-4">Invoice & Stage</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 min-w-[190px] text-left whitespace-nowrap">Payment Details</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedAgencyPayouts.length > 0 ? (
                    paginatedAgencyPayouts.map((item) => {
                      const isSelected = selectedAgencyIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            'hover:bg-muted/40 transition-colors',
                            isSelected && 'bg-primary/5'
                          )}
                        >
                          {/* Row Checkbox */}
                          <td className="w-10 py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleAgencySelect(item.id)}
                              className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                            />
                          </td>

                          {/* Column 1: Agency & Project */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={item.agencyName} size="sm" className="shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate max-w-[200px]">
                                  {item.agencyName}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                  <span className="inline-block px-1.5 py-0.2 rounded bg-muted text-[10px] font-medium text-foreground/80">
                                    {item.trade}
                                  </span>
                                  <span className="truncate max-w-[140px]" title={item.projectName}>
                                    {item.projectName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Invoice & Stage */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-foreground font-semibold text-xs">
                              {item.invoiceNumber}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[180px] mt-0.5" title={item.workStage}>
                              {item.workStage || 'Subcontractor clearance'}
                            </div>
                          </td>

                          {/* Column 3: Amount (Only total amount shown) */}
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground text-xs">
                            {formatCurrency(item.billAmount)}
                          </td>

                          {/* Column 4: Date */}
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                              <span>{item.paymentDate ? formatDate(item.paymentDate) : '—'}</span>
                            </div>
                          </td>

                          {/* Column 5: Status (Dot Badge) */}
                          <td className="py-3.5 px-4">
                            {item.status === 'paid' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span>Paid</span>
                              </span>
                            )}
                            {item.status === 'partially_paid' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                                <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                                <span>Partially Paid</span>
                              </span>
                            )}
                            {item.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Column 6: Payment Details (Aligned with clean badges & nowrap) */}
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {item.paymentMode ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-foreground">
                                  <CreditCardIcon className="size-3 text-muted-foreground shrink-0" />
                                  <span>{item.paymentMode}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-muted-foreground bg-muted/40 font-mono">
                                  —
                                </span>
                              )}

                              {item.proof && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImageModal(item.proof)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
                                  title="View Attachment Slip"
                                >
                                  <CameraIcon className="size-3" />
                                  <span>Proof</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Column 7: Action (Uniformly aligned with small tooltips 'view', 'delete') */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceipt({
                                    title: item.workStage || 'Agency Subcontractor Bill',
                                    amount: item.billAmount,
                                    paidAmount: item.paidAmount,
                                    paymentMode: item.paymentMode,
                                    receiptNumber: item.invoiceNumber,
                                    paidDate: item.paymentDate,
                                    projectName: item.projectName,
                                    clientName: item.agencyName,
                                    paymentProof: item.proof,
                                  })
                                }
                                className="size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                                title="view"
                              >
                                <EyeIcon className="size-4" />
                              </button>

                              {isManagerOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAgencyPayout(item.id)}
                                  className="size-7 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                                  title="delete"
                                >
                                  <TrashIcon className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                        No agency payout records found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
              <div>
                Showing <span className="font-semibold text-foreground">{filteredAgencyPayouts.length === 0 ? 0 : (agencyPage - 1) * agencyRowsPerPage + 1}</span> to{' '}
                <span className="font-semibold text-foreground">{Math.min(agencyPage * agencyRowsPerPage, filteredAgencyPayouts.length)}</span> of{' '}
                <span className="font-semibold text-foreground">{filteredAgencyPayouts.length}</span> results
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={agencyPage <= 1}
                  onClick={() => setAgencyPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {agencyPage} of {agencyTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={agencyPage >= agencyTotalPages}
                  onClick={() => setAgencyPage((p) => p + 1)}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'settings' && (
        <div className="space-y-4">
          <form onSubmit={handleSavePaymentSettings} className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-6">
            {/* 1. Receiving Bank Account */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2Icon className="size-4 text-foreground" />
                  <h3 className="text-sm font-bold text-foreground">Receiving Bank Account</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown to clients for direct transfers, RTGS/NEFT and UPI deposits
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    BANK NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSettings.bankName}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ACCOUNT BENEFICIARY NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSettings.accountName}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, accountName: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ACCOUNT NUMBER
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSettings.accountNumber}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    IFSC CODE
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentSettings.ifscCode}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, ifscCode: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.upiId}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* 2. Client Milestone & Advance Defaults */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Contract & Milestone Rules</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Default values prefilled when onboarding new project budgets
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    DEFAULT ADVANCE %
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.defaultAdvancePercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultAdvancePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    DEFAULT INSTALLMENTS
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.defaultInstallmentsCount}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultInstallmentsCount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    GRACE PERIOD (DAYS)
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.gracePeriodDays}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, gracePeriodDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    DEFAULT GST %
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.defaultGstPercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, defaultGstPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* 3. Agency Payout Policies */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Agency Payout Policies</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clearance rules for contractor agency invoices and billing approvals
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    TDS RATE ON CONTRACTS (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={paymentSettings.tdsRateOnContracts}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, tdsRateOnContracts: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    RETENTION MONEY HOLD (%)
                  </label>
                  <input
                    type="number"
                    value={paymentSettings.retentionHoldPercent}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, retentionHoldPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex items-center gap-2 shadow-2xs font-semibold px-5"
              >
                <SaveIcon className="size-4" />
                <span>Save Payment Settings</span>
              </Button>
            </div>
          </form>
        </div>
      )}

{/* ===================================================================== */}
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
              <select
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
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {mockAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.trade})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Project Site <span className="text-destructive">*</span>
                </label>
                <select
                  value={agencyForm.projectId}
                  onChange={(e) => setAgencyForm({ ...agencyForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  {schedules.map((s) => (
                    <option key={s.projectId} value={s.projectId}>
                      {s.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Invoice Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-APX-2026-089"
                  value={agencyForm.invoiceNumber}
                  onChange={(e) => setAgencyForm({ ...agencyForm, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bill Amount (₹)"
                type="number"
                required
                min="1"
                placeholder="e.g. 1,20,000"
                value={agencyForm.billAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, billAmount: e.target.value })}
              />

              <Input
                label="Amount Paying Now (₹)"
                type="number"
                min="0"
                placeholder="e.g. 80,000"
                value={agencyForm.paidAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, paidAmount: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={agencyForm.paymentDate}
                  onChange={(e) => setAgencyForm({ ...agencyForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Mode
                </label>
                <select
                  value={agencyForm.paymentMode}
                  onChange={(e) => setAgencyForm({ ...agencyForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Work Stage / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Framing & Boarding Stage Bill"
                value={agencyForm.workStage}
                onChange={(e) => setAgencyForm({ ...agencyForm, workStage: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
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
                <label className="flex items-center justify-center p-3 border border-dashed border-border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-xs text-muted-foreground gap-1.5">
                  <CameraIcon className="size-3.5 text-primary" />
                  <span>Attach invoice copy or payment slip</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setAgencyForm({ ...agencyForm, proof: ev.target.result });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
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
          title="Payment Proof Attachment"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center p-2 rounded-xl bg-muted/40 border border-border overflow-hidden">
              <img
                src={previewImageModal}
                alt="Payment Proof Full"
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setPreviewImageModal(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* RECEIPT / VOUCHER VIEWER MODAL                                        */}
      {/* ===================================================================== */}
      {viewingReceipt && (
        <Modal
          isOpen={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          title="Payment Voucher / Receipt"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-foreground">{viewingReceipt.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{viewingReceipt.projectName}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    {viewingReceipt.receiptNumber}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">{formatDate(viewingReceipt.date)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Client / Party</span>
                  <span className="font-semibold text-foreground">{viewingReceipt.clientName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Payment Mode</span>
                  <span className="font-semibold text-foreground">{viewingReceipt.mode}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Amount Cleared:</span>
                <span className="text-base font-bold font-mono text-success">{formatCurrency(viewingReceipt.amount)}</span>
              </div>

              {viewingReceipt.paymentProof && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Attached Proof</span>
                  <img
                    src={viewingReceipt.paymentProof}
                    alt="Proof"
                    onClick={() => setPreviewImageModal(viewingReceipt.paymentProof)}
                    className="max-h-36 rounded-lg border border-border cursor-pointer hover:opacity-90 object-contain"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Print Receipt
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingReceipt(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PaymentsPage;
