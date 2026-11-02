'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  mockProjectPaymentSchedules,
  mockLabourPayouts,
  mockAgencyPayouts,
} from '../data/payments';
import { mockAgencies } from '../data/agencies';
import { cn } from '../lib/utils';

// BefUI Components
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import Pagination from '../components/ui/Pagination';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/badge';
import { Tabs } from '../components/ui/Tabs';

// BefUI Icons strictly from '@/components/ui/icons'
import {
  WalletIcon,
  UsersIcon,
  Building2Icon,
  ReceiptIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  FileTextIcon,
  PrinterIcon,
  EyeIcon,
  ArrowLeftIcon,
  CameraIcon,
  ImageIcon,
  TrashIcon,
  UploadIcon,
  DownloadIcon,
  XIcon,
} from '../components/ui/icons';

const STORAGE_KEY_CLIENT_PAYMENTS = 'osm_client_payment_schedules_v3';
const STORAGE_KEY_LABOUR_PAYOUTS = 'osm_labour_payouts_v3';
const STORAGE_KEY_AGENCY_PAYOUTS = 'osm_agency_payouts_v2';

export function PaymentsPage({ mode }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const location = useLocation();

  // Determine view mode: 'received' (Client Payments) or 'pay' (Labour & Agency Payouts)
  const isPayRoute = mode === 'pay' || location.pathname.includes('/payments/pay');
  const currentView = isPayRoute ? 'pay' : 'received';

  // Sub-tab inside "Pay" mode: 'labours' | 'agencies'
  const [paySubTab, setPaySubTab] = useState('labours');

  const isManagerOrAdmin =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === ROLES.OWNER ||
    currentUser?.role === ROLES.PROJECT_MANAGER ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'project_manager';

  // ---------------------------------------------------------------------------
  // 1. DATA STATE & LOCAL STORAGE PERSISTENCE
  // ---------------------------------------------------------------------------
  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_PAYMENTS);
      return saved ? JSON.parse(saved) : mockProjectPaymentSchedules;
    } catch (e) {
      return mockProjectPaymentSchedules;
    }
  });

  const [labourPayouts, setLabourPayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LABOUR_PAYOUTS);
      return saved ? JSON.parse(saved) : mockLabourPayouts;
    } catch (e) {
      return mockLabourPayouts;
    }
  });

  const [agencyPayouts, setAgencyPayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AGENCY_PAYOUTS);
      return saved ? JSON.parse(saved) : mockAgencyPayouts;
    } catch (e) {
      return mockAgencyPayouts;
    }
  });

  const saveSchedules = (data) => {
    setSchedules(data);
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_PAYMENTS, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save schedules', e);
    }
  };

  const saveLabourPayouts = (data) => {
    setLabourPayouts(data);
    try {
      localStorage.setItem(STORAGE_KEY_LABOUR_PAYOUTS, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save labour payouts', e);
    }
  };

  const saveAgencyPayouts = (data) => {
    setAgencyPayouts(data);
    try {
      localStorage.setItem(STORAGE_KEY_AGENCY_PAYOUTS, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save agency payouts', e);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. SEARCH & FILTER STATE
  // ---------------------------------------------------------------------------
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qProj = params.get('project');
      return qProj || schedules[0]?.projectId || 'P1';
    } catch {
      return schedules[0]?.projectId || 'P1';
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qProj = params.get('project');
    if (qProj) {
      setSelectedProjectId(qProj);
    }
  }, [location.search]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid' | 'overdue'

  const [labourSearch, setLabourSearch] = useState('');
  const [labourProjectFilter, setLabourProjectFilter] = useState('all');
  const [labourTradeFilter, setLabourTradeFilter] = useState('all');
  const [labourStatusFilter, setLabourStatusFilter] = useState('all');

  const [agencySearch, setAgencySearch] = useState('');
  const [agencyProjectFilter, setAgencyProjectFilter] = useState('all');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState('all');

  // Sorting & Pagination for Labours
  const [labourSort, setLabourSort] = useState('newest');
  const [labourPage, setLabourPage] = useState(1);
  const [labourRowsPerPage, setLabourRowsPerPage] = useState(10);

  // Sorting & Pagination for Agencies
  const [agencySort, setAgencySort] = useState('newest');
  const [agencyPage, setAgencyPage] = useState(1);
  const [agencyRowsPerPage, setAgencyRowsPerPage] = useState(10);

  // Current active project schedule for client payments
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.projectId === selectedProjectId) || schedules[0] || null;
  }, [schedules, selectedProjectId]);

  // Current project schedule totals
  const currentProjectTotals = useMemo(() => {
    if (!currentSchedule) return { cost: 0, paid: 0, pending: 0, realization: 0 };
    const cost = currentSchedule.totalCost || 0;
    const paid = currentSchedule.totalPaid || 0;
    const pending = currentSchedule.totalPending || 0;
    const realization = cost > 0 ? Math.round((paid / cost) * 100) : 0;
    return { cost, paid, pending, realization };
  }, [currentSchedule]);

  // Filtered Client Installments
  const filteredInstallments = useMemo(() => {
    if (!currentSchedule?.installments) return [];
    return currentSchedule.installments.filter((inst) => {
      if (clientStatusFilter !== 'all' && inst.status !== clientStatusFilter) return false;
      if (clientSearch.trim()) {
        const q = clientSearch.toLowerCase();
        const matchesTitle = inst.title?.toLowerCase().includes(q);
        const matchesMode = inst.paymentMode?.toLowerCase().includes(q);
        const matchesReceipt = inst.receiptNumber?.toLowerCase().includes(q);
        const matchesProject = currentSchedule?.projectName?.toLowerCase().includes(q);
        const matchesClient = currentSchedule?.clientName?.toLowerCase().includes(q);
        const matchesAmount = String(inst.amount).includes(q);
        if (!matchesTitle && !matchesMode && !matchesReceipt && !matchesProject && !matchesClient && !matchesAmount) {
          return false;
        }
      }
      return true;
    });
  }, [currentSchedule, clientStatusFilter, clientSearch]);

  // Filtered Labour Payouts with Sorting
  const filteredLabourPayouts = useMemo(() => {
    const list = labourPayouts.filter((item) => {
      if (labourProjectFilter !== 'all' && item.projectId !== labourProjectFilter) return false;
      if (labourTradeFilter !== 'all' && item.trade !== labourTradeFilter) return false;
      if (labourStatusFilter !== 'all' && item.status !== labourStatusFilter) return false;
      if (labourSearch.trim()) {
        const q = labourSearch.toLowerCase();
        const matchesName = item.workerName.toLowerCase().includes(q);
        const matchesTrade = item.trade.toLowerCase().includes(q);
        const matchesVoucher = item.voucherNumber?.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        if (!matchesName && !matchesTrade && !matchesVoucher && !matchesProject) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (labourSort === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
      if (labourSort === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
      if (labourSort === 'name_asc') return (a.workerName || '').localeCompare(b.workerName || '');
      if (labourSort === 'oldest') return (a.paidDate || '').localeCompare(b.paidDate || '');
      return (b.paidDate || '').localeCompare(a.paidDate || '');
    });

    return list;
  }, [labourPayouts, labourProjectFilter, labourTradeFilter, labourStatusFilter, labourSearch, labourSort]);

  const labourTotals = useMemo(() => {
    const totalDisbursed = labourPayouts
      .filter((l) => l.status === 'paid')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPending = labourPayouts
      .filter((l) => l.status === 'pending')
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const uniqueWorkers = new Set(labourPayouts.map((l) => l.workerName)).size;
    return { totalDisbursed, totalPending, uniqueWorkers };
  }, [labourPayouts]);

  // Labour status counts
  const labourStatusCounts = useMemo(() => ({
    all: labourPayouts.length,
    paid: labourPayouts.filter((l) => l.status === 'paid').length,
    pending: labourPayouts.filter((l) => l.status === 'pending').length,
  }), [labourPayouts]);

  // Paginated Labours
  const paginatedLabourPayouts = useMemo(() => {
    const start = (labourPage - 1) * labourRowsPerPage;
    return filteredLabourPayouts.slice(start, start + labourRowsPerPage);
  }, [filteredLabourPayouts, labourPage, labourRowsPerPage]);

  const labourTotalPages = Math.ceil(filteredLabourPayouts.length / labourRowsPerPage) || 1;

  // Delete Labour Payout
  const handleDeleteLabourPayout = (id) => {
    const updated = labourPayouts.filter((l) => l.id !== id);
    saveLabourPayouts(updated);
    toast.success('Labour payout record removed');
  };

  // Export Labour CSV
  const handleExportLabourCSV = () => {
    const headers = ['Worker Name', 'Trade', 'Project Site', 'Wage Basis', 'Total Amount (INR)', 'Status', 'Date', 'Mode', 'Voucher No'];
    const rows = filteredLabourPayouts.map((l) => [
      `"${l.workerName}"`,
      `"${l.trade}"`,
      `"${l.projectName}"`,
      `"${l.units} ${l.unitLabel} @ ${l.rate}"`,
      `"${l.amount}"`,
      `"${l.status}"`,
      `"${l.paidDate || ''}"`,
      `"${l.paymentMode || ''}"`,
      `"${l.voucherNumber || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `labour_payouts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLabourPayouts.length} labour payout records`);
  };

  // Filtered Agency Payouts with Sorting
  const filteredAgencyPayouts = useMemo(() => {
    const list = agencyPayouts.filter((item) => {
      if (agencyProjectFilter !== 'all' && item.projectId !== agencyProjectFilter) return false;
      if (agencyStatusFilter !== 'all' && item.status !== agencyStatusFilter) return false;
      if (agencySearch.trim()) {
        const q = agencySearch.toLowerCase();
        const matchesAgency = item.agencyName.toLowerCase().includes(q);
        const matchesInvoice = item.invoiceNumber?.toLowerCase().includes(q);
        const matchesStage = item.workStage?.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        if (!matchesAgency && !matchesInvoice && !matchesStage && !matchesProject) return false;
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
  }, [agencyPayouts, agencyProjectFilter, agencyStatusFilter, agencySearch, agencySort]);

  const agencyTotals = useMemo(() => {
    const totalBilled = agencyPayouts.reduce((sum, item) => sum + (item.billAmount || 0), 0);
    const totalCleared = agencyPayouts.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
    const totalDue = agencyPayouts.reduce((sum, item) => sum + (item.pendingBalance || 0), 0);
    return { totalBilled, totalCleared, totalDue };
  }, [agencyPayouts]);

  // Agency status counts
  const agencyStatusCounts = useMemo(() => ({
    all: agencyPayouts.length,
    paid: agencyPayouts.filter((a) => a.status === 'paid').length,
    partially_paid: agencyPayouts.filter((a) => a.status === 'partially_paid').length,
    pending: agencyPayouts.filter((a) => a.status === 'pending').length,
  }), [agencyPayouts]);

  // Paginated Agencies
  const paginatedAgencyPayouts = useMemo(() => {
    const start = (agencyPage - 1) * agencyRowsPerPage;
    return filteredAgencyPayouts.slice(start, start + agencyRowsPerPage);
  }, [filteredAgencyPayouts, agencyPage, agencyRowsPerPage]);

  const agencyTotalPages = Math.ceil(filteredAgencyPayouts.length / agencyRowsPerPage) || 1;

  // Delete Agency Payout
  const handleDeleteAgencyPayout = (id) => {
    const updated = agencyPayouts.filter((a) => a.id !== id);
    saveAgencyPayouts(updated);
    toast.success('Agency payout record removed');
  };

  // Export Agency CSV
  const handleExportAgencyCSV = () => {
    const headers = ['Agency Name', 'Trade', 'Project Site', 'Invoice No', 'Bill Amount (INR)', 'Paid Amount (INR)', 'Balance Due (INR)', 'Status', 'Date', 'Transaction Ref'];
    const rows = filteredAgencyPayouts.map((a) => [
      `"${a.agencyName}"`,
      `"${a.trade}"`,
      `"${a.projectName}"`,
      `"${a.invoiceNumber}"`,
      `"${a.billAmount}"`,
      `"${a.paidAmount}"`,
      `"${a.pendingBalance}"`,
      `"${a.status}"`,
      `"${a.paymentDate || ''}"`,
      `"${a.transactionRef || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agency_payouts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredAgencyPayouts.length} agency payout records`);
  };

  // ---------------------------------------------------------------------------
  // 3. DETAILED PROJECT VIEW STATE (Triggered via Eye Icon)
  // ---------------------------------------------------------------------------
  const [viewingProjectDetails, setViewingProjectDetails] = useState(null);
  const [editProjectForm, setEditProjectForm] = useState(null);

  // Opens the full Project Payment Details Page
  const handleOpenProjectDetails = (schedule, targetInst = null) => {
    const cloned = JSON.parse(JSON.stringify(schedule));
    const totalCost = cloned.totalCost || 40000;
    const firstInst = cloned.installments?.[0];
    const isAdv = firstInst?.title?.toLowerCase().includes('advance');
    const advAmt = isAdv ? firstInst.amount : (cloned.advancePaid || 0);
    const advPct = totalCost > 0 ? Math.round((advAmt / totalCost) * 100) : 10;

    setViewingProjectDetails(cloned);
    setEditProjectForm({
      ...cloned,
      advancePercentage: advPct,
      installments: cloned.installments || [],
    });
  };

  // ---------------------------------------------------------------------------
  // 4. REDESIGNED RECORD PAYMENT MODAL (Merged with Installment Setup)
  // ---------------------------------------------------------------------------
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  const [recordPaymentForm, setRecordPaymentForm] = useState({
    projectId: 'P1',
    totalCost: 40000,
    advancePercentage: 10,
    installmentsCount: 2,
    installments: [
      { id: 'inst-1', title: '1st Installment', percentage: 50, amount: 18000, dueDate: '' },
      { id: 'inst-2', title: '2nd Installment', percentage: 50, amount: 18000, dueDate: '' },
    ],
    paymentMode: 'Bank Transfer',
    paidDate: new Date().toISOString().split('T')[0],
    paymentProof: null,
    paymentProofName: '',
    markAdvancePaid: true,
    notes: '',
  });

  // Open Record Payment Modal & prefill from current active project
  const handleOpenRecordPaymentModal = () => {
    const targetProj = currentSchedule || schedules[0];
    const cost = targetProj?.totalCost || 40000;
    const advPct = 10;
    const advAmt = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advAmt);

    const defaultDueDate1 = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const defaultDueDate2 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    setRecordPaymentForm({
      projectId: targetProj?.projectId || 'P1',
      totalCost: cost,
      advancePercentage: advPct,
      installmentsCount: 2,
      installments: [
        { id: 'inst-1', title: '1st Installment', percentage: 50, amount: Math.round(remaining * 0.5), dueDate: defaultDueDate1 },
        { id: 'inst-2', title: '2nd Installment', percentage: 50, amount: Math.round(remaining * 0.5), dueDate: defaultDueDate2 },
      ],
      paymentMode: 'Bank Transfer',
      paidDate: new Date().toISOString().split('T')[0],
      paymentProof: null,
      paymentProofName: '',
      markAdvancePaid: true,
      notes: '',
    });
    setIsRecordPaymentOpen(true);
  };

  // Handle number of installments change in Record Payment Modal
  const handleInstallmentsCountChange = (newCount) => {
    const count = Math.max(1, Math.min(12, parseInt(newCount, 10) || 1));
    const cost = parseFloat(String(recordPaymentForm.totalCost).replace(/,/g, '')) || 0;
    const advPct = parseFloat(recordPaymentForm.advancePercentage) || 0;
    const advVal = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advVal);

    const equalPct = Math.floor(100 / count);
    const remainder = 100 - (equalPct * count);

    const newInst = [];
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const pct = isLast ? equalPct + remainder : equalPct;
      const amt = Math.round((remaining * pct) / 100);
      const existing = recordPaymentForm.installments[i];
      const dueDate = existing?.dueDate || new Date(Date.now() + (i + 1) * 15 * 86400000).toISOString().split('T')[0];

      newInst.push({
        id: `inst-${i + 1}`,
        title: existing?.title || `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} Installment`,
        percentage: pct,
        amount: amt,
        dueDate,
      });
    }

    setRecordPaymentForm((prev) => ({
      ...prev,
      installmentsCount: count,
      installments: newInst,
    }));
  };

  // Handle total cost or advance % change in Record Payment Modal
  const handleRecalculateRecordPayment = (newTotalCost, newAdvPct) => {
    const cost = parseFloat(String(newTotalCost).replace(/,/g, '')) || 0;
    const advPct = parseFloat(newAdvPct) || 0;
    const advVal = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advVal);

    const updatedInst = recordPaymentForm.installments.map((inst) => {
      const amt = Math.round((remaining * (parseFloat(inst.percentage) || 0)) / 100);
      return { ...inst, amount: amt };
    });

    setRecordPaymentForm((prev) => ({
      ...prev,
      totalCost: newTotalCost,
      advancePercentage: newAdvPct,
      installments: updatedInst,
    }));
  };

  // Handle individual installment percentage change
  const handleInstallmentPercentChange = (index, newPct) => {
    const pct = parseFloat(newPct) || 0;
    const cost = parseFloat(String(recordPaymentForm.totalCost).replace(/,/g, '')) || 0;
    const advPct = parseFloat(recordPaymentForm.advancePercentage) || 0;
    const advVal = Math.round((cost * advPct) / 100);
    const remaining = Math.max(0, cost - advVal);
    const amt = Math.round((remaining * pct) / 100);

    const updated = [...recordPaymentForm.installments];
    updated[index] = {
      ...updated[index],
      percentage: newPct,
      amount: amt,
    };

    setRecordPaymentForm((prev) => ({
      ...prev,
      installments: updated,
    }));
  };

  // Submit Record Payment (creates / updates project schedule & installments)
  const handleSaveRecordPayment = (e) => {
    e.preventDefault();
    const cost = parseFloat(String(recordPaymentForm.totalCost).replace(/,/g, '')) || 0;
    if (cost <= 0) {
      toast.error('Please enter a valid total contract cost');
      return;
    }

    const advPct = parseFloat(recordPaymentForm.advancePercentage) || 0;
    const advVal = Math.round((cost * advPct) / 100);
    const targetProj = schedules.find((s) => s.projectId === recordPaymentForm.projectId);
    if (!targetProj) return;

    // Build installment list: Booking Advance + Scheduled Installments
    const newInstallments = [];

    // 1. Booking Advance
    newInstallments.push({
      id: `adv-${Date.now()}`,
      title: `Booking Advance (${advPct}%)`,
      amount: advVal,
      dueDate: recordPaymentForm.paidDate || new Date().toISOString().split('T')[0],
      status: recordPaymentForm.markAdvancePaid ? 'paid' : 'pending',
      paidAmount: recordPaymentForm.markAdvancePaid ? advVal : 0,
      paidDate: recordPaymentForm.markAdvancePaid ? recordPaymentForm.paidDate : null,
      paymentMode: recordPaymentForm.markAdvancePaid ? recordPaymentForm.paymentMode : null,
      paymentProof: recordPaymentForm.markAdvancePaid ? recordPaymentForm.paymentProof : null,
      notes: recordPaymentForm.notes,
      receiptNumber: recordPaymentForm.markAdvancePaid ? `REC-${Date.now().toString().slice(-4)}` : null,
    });

    // 2. Scheduled Installments
    recordPaymentForm.installments.forEach((inst, idx) => {
      newInstallments.push({
        id: `inst-${Date.now()}-${idx + 1}`,
        title: `${inst.title || `Installment ${idx + 1}`} (${inst.percentage}%)`,
        amount: Number(inst.amount) || 0,
        dueDate: inst.dueDate || new Date(Date.now() + (idx + 1) * 20 * 86400000).toISOString().split('T')[0],
        status: 'pending',
        paidAmount: 0,
        paidDate: null,
        paymentMode: null,
        paymentProof: null,
        notes: '',
        receiptNumber: null,
      });
    });

    const totalPaid = newInstallments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const totalPending = Math.max(0, cost - totalPaid);

    const updatedSchedule = {
      ...targetProj,
      totalCost: cost,
      advancePaid: recordPaymentForm.markAdvancePaid ? advVal : 0,
      totalPaid,
      totalPending,
      installments: newInstallments,
    };

    const updatedSchedules = schedules.map((s) =>
      s.projectId === updatedSchedule.projectId ? updatedSchedule : s
    );

    saveSchedules(updatedSchedules);
    setSelectedProjectId(updatedSchedule.projectId);
    toast.success(`Payment schedule and record saved for ${targetProj.projectName}`);
    setIsRecordPaymentOpen(false);
  };

  // Save changes from the Full Project Payment Details Page
  const handleSaveProjectDetails = () => {
    if (!editProjectForm) return;

    const cost = parseFloat(String(editProjectForm.totalCost).replace(/,/g, '')) || 0;
    const installments = editProjectForm.installments || [];
    const totalPaid = installments.reduce((sum, i) => {
      if (i.status === 'paid') {
        return sum + (Number(i.paidAmount || i.amount) || 0);
      }
      return sum;
    }, 0);
    const totalPending = Math.max(0, cost - totalPaid);

    const updatedSchedule = {
      ...editProjectForm,
      totalCost: cost,
      totalPaid,
      totalPending,
      installments,
    };

    const updatedSchedules = schedules.map((s) =>
      s.projectId === updatedSchedule.projectId ? updatedSchedule : s
    );

    saveSchedules(updatedSchedules);
    setViewingProjectDetails(updatedSchedule);
    toast.success(`Payment details saved for ${updatedSchedule.projectName}`);
    setViewingProjectDetails(null);
  };

  // ---------------------------------------------------------------------------
  // 5. OTHER ACTION HANDLERS (Receipt Viewer & Pay Mode)
  // ---------------------------------------------------------------------------
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const [isRecordLabourOpen, setIsRecordLabourOpen] = useState(false);
  const [labourForm, setLabourForm] = useState({
    workerName: '',
    trade: 'Carpenter',
    projectId: 'P1',
    wageType: 'Daily Wage',
    rate: 950,
    units: 6,
    unitLabel: 'Days',
    amount: 5700,
    paidDate: new Date().toISOString().split('T')[0],
    paymentMode: 'UPI',
    voucherNumber: '',
    status: 'paid',
    notes: '',
  });

  const [isRecordAgencyOpen, setIsRecordAgencyOpen] = useState(false);
  const [agencyForm, setAgencyForm] = useState({
    agencyId: 'a1',
    agencyName: 'Apex False Ceiling & Gypsum',
    trade: 'Ceiling',
    projectId: 'P1',
    workStage: '',
    invoiceNumber: '',
    billAmount: '',
    paidAmount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank Transfer',
    transactionRef: '',
    notes: '',
  });

  const handleSaveLabourPayout = (e) => {
    e.preventDefault();
    if (!labourForm.workerName.trim()) {
      toast.error('Worker name is required');
      return;
    }
    const amt = parseFloat(String(labourForm.amount).replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payout amount');
      return;
    }

    const targetProj = schedules.find((s) => s.projectId === labourForm.projectId);
    const newRecord = {
      id: `lab-${Date.now()}`,
      workerName: labourForm.workerName.trim(),
      trade: labourForm.trade,
      projectId: labourForm.projectId,
      projectName: targetProj?.projectName || 'Indiranagar 4BHK Luxury Villa',
      wageType: labourForm.wageType,
      rate: parseFloat(labourForm.rate) || 0,
      units: parseFloat(labourForm.units) || 1,
      unitLabel: labourForm.unitLabel,
      amount: amt,
      paidDate: labourForm.status === 'paid' ? labourForm.paidDate : null,
      paymentMode: labourForm.paymentMode,
      voucherNumber: labourForm.voucherNumber || `VCH-LAB-${Date.now().toString().slice(-4)}`,
      status: labourForm.status,
      notes: labourForm.notes,
    };

    const updated = [newRecord, ...labourPayouts];
    saveLabourPayouts(updated);
    toast.success(`Labour payout of ${formatCurrency(amt)} recorded for ${newRecord.workerName}`);
    setIsRecordLabourOpen(false);
  };

  const handleQuickPayLabour = (id) => {
    const updated = labourPayouts.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Cash',
        };
      }
      return l;
    });
    saveLabourPayouts(updated);
    toast.success('Labour payout marked as paid');
  };

  const handleSaveAgencyPayout = (e) => {
    e.preventDefault();
    const billAmt = parseFloat(String(agencyForm.billAmount).replace(/,/g, ''));
    const paidAmt = parseFloat(String(agencyForm.paidAmount).replace(/,/g, '')) || 0;

    if (isNaN(billAmt) || billAmt <= 0) {
      toast.error('Please enter a valid bill amount');
      return;
    }

    const targetProj = schedules.find((s) => s.projectId === agencyForm.projectId);
    const targetAg = mockAgencies.find((a) => a.id === agencyForm.agencyId);
    const pendingBal = Math.max(0, billAmt - paidAmt);
    const status = paidAmt === 0 ? 'pending' : pendingBal === 0 ? 'paid' : 'partially_paid';

    const newRecord = {
      id: `agp-${Date.now()}`,
      agencyId: agencyForm.agencyId,
      agencyName: targetAg?.name || agencyForm.agencyName,
      trade: targetAg?.trade || agencyForm.trade,
      projectId: agencyForm.projectId,
      projectName: targetProj?.projectName || 'Interior Fitout Project',
      workStage: agencyForm.workStage || 'Stage Clearance Bill',
      invoiceNumber: agencyForm.invoiceNumber || `INV-AGC-${Date.now().toString().slice(-4)}`,
      billAmount: billAmt,
      paidAmount: paidAmt,
      pendingBalance: pendingBal,
      status,
      paymentDate: paidAmt > 0 ? agencyForm.paymentDate : null,
      paymentMode: agencyForm.paymentMode,
      transactionRef: agencyForm.transactionRef,
      notes: agencyForm.notes,
    };

    const updated = [newRecord, ...agencyPayouts];
    saveAgencyPayouts(updated);
    toast.success(`Agency bill disbursement recorded for ${newRecord.agencyName}`);
    setIsRecordAgencyOpen(false);
  };

  // Page Heading & Subheading configuration based on mode
  const pageTitle =
    currentView === 'received'
      ? 'Client Payments'
      : 'Payments';

  const pageSubtitle =
    currentView === 'received'
      ? 'Track and record project payments and installments received from clients'
      : 'Manage disbursements, settlements, and invoices for site workforce and subcontractors';

  // Computed values for Record Payment modal real-time preview
  const recordModalCost = parseFloat(String(recordPaymentForm.totalCost).replace(/,/g, '')) || 0;
  const recordModalAdvPct = parseFloat(recordPaymentForm.advancePercentage) || 0;
  const recordModalAdvValue = Math.round((recordModalCost * recordModalAdvPct) / 100);
  const recordModalRemaining = Math.max(0, recordModalCost - recordModalAdvValue);

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* 1. Header with Clean Action Buttons */}
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              {currentView === 'received' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenRecordPaymentModal}
                  className="flex items-center gap-1.5"
                >
                  <PlusIcon className="size-4" />
                  <span>Record Payment</span>
                </Button>
              )}

              {currentView === 'pay' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={paySubTab === 'labours' ? handleExportLabourCSV : handleExportAgencyCSV}
                  className="flex items-center gap-1.5"
                  title="Export CSV"
                >
                  <DownloadIcon className="size-4" />
                  <span>Export</span>
                </Button>
              )}

              {currentView === 'pay' && paySubTab === 'labours' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setLabourForm({
                      workerName: '',
                      trade: 'Carpenter',
                      projectId: selectedProjectId,
                      wageType: 'Daily Wage',
                      rate: 950,
                      units: 6,
                      unitLabel: 'Days',
                      amount: 5700,
                      paidDate: new Date().toISOString().split('T')[0],
                      paymentMode: 'UPI',
                      voucherNumber: `VCH-LAB-${Date.now().toString().slice(-4)}`,
                      status: 'paid',
                      notes: '',
                    });
                    setIsRecordLabourOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <PlusIcon className="size-4" />
                  <span>Make Labour Payout</span>
                </Button>
              )}

              {currentView === 'pay' && paySubTab === 'agencies' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const firstAg = mockAgencies[0];
                    setAgencyForm({
                      agencyId: firstAg?.id || 'a1',
                      agencyName: firstAg?.name || 'Apex False Ceiling',
                      trade: firstAg?.trade || 'Ceiling',
                      projectId: selectedProjectId,
                      workStage: 'Framing & Boarding Stage Bill',
                      invoiceNumber: `INV-AGC-${Date.now().toString().slice(-4)}`,
                      billAmount: 120000,
                      paidAmount: 80000,
                      paymentDate: new Date().toISOString().split('T')[0],
                      paymentMode: 'Bank Transfer',
                      transactionRef: `BT-${Math.floor(1000 + Math.random() * 9000)}`,
                      notes: 'Stage completion clearance',
                    });
                    setIsRecordAgencyOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <PlusIcon className="size-4" />
                  <span>Record Agency Payment</span>
                </Button>
              )}
            </div>
          )
        }
      />

      {/* 2. In Pay Mode, show Tabs for Labour Payout & Agency Payout without icons */}
      {currentView === 'pay' && (
        <Tabs
          tabs={[
            {
              id: 'labours',
              label: 'Labour',
              count: labourPayouts.length,
            },
            {
              id: 'agencies',
              label: 'Agencies',
              count: agencyPayouts.length,
            },
          ]}
          activeTab={paySubTab}
          onChange={(tId) => setPaySubTab(tId)}
        />
      )}

      {/* ===================================================================== */}
      {/* VIEW: RECEIVED (CLIENT PAYMENTS)                                      */}
      {/* ===================================================================== */}
      {currentView === 'received' && (
        <>
          {/* DETAILED PROJECT PAYMENT VIEW (Opened via Eye Icon) */}
          {viewingProjectDetails && editProjectForm ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back to Payments Bar */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingProjectDetails(null)}
                    className="flex items-center gap-1.5"
                  >
                    <ArrowLeftIcon className="size-4" />
                    <span>Back to Payments</span>
                  </Button>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {viewingProjectDetails.projectName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Client: <span className="font-semibold text-foreground">{viewingProjectDetails.clientName}</span>
                      {viewingProjectDetails.clientPhone && ` • ${viewingProjectDetails.clientPhone}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingProjectDetails(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveProjectDetails}
                    className="flex items-center gap-1.5"
                  >
                    <CheckIcon className="size-4" />
                    <span>Save All Changes</span>
                  </Button>
                </div>
              </div>

              {/* KPI Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Total Contract Budget
                  </span>
                  <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                    {formatCurrency(editProjectForm.totalCost || 0)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Advance Percentage
                  </span>
                  <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                    {editProjectForm.advancePercentage || 10}%
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      ({formatCurrency(Math.round(((editProjectForm.totalCost || 0) * (editProjectForm.advancePercentage || 10)) / 100))})
                    </span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Total Collected
                  </span>
                  <span className="text-lg font-bold font-mono text-success mt-1 block">
                    {formatCurrency(
                      (editProjectForm.installments || []).reduce((sum, i) => (i.status === 'paid' ? sum + Number(i.paidAmount || i.amount || 0) : sum), 0)
                    )}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Balance Pending
                  </span>
                  <span className="text-lg font-bold font-mono text-warning mt-1 block">
                    {formatCurrency(
                      Math.max(
                        0,
                        (editProjectForm.totalCost || 0) -
                          (editProjectForm.installments || []).reduce((sum, i) => (i.status === 'paid' ? sum + Number(i.paidAmount || i.amount || 0) : sum), 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Editable Project Contract & Installments Settings */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-5">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Project Budget & Advance Allocation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adjust total budget and advance percentage. Installment values update dynamically.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Total Contract Budget (₹)"
                    type="number"
                    min="1"
                    value={editProjectForm.totalCost || ''}
                    onChange={(e) => {
                      const newCost = parseFloat(e.target.value) || 0;
                      setEditProjectForm({ ...editProjectForm, totalCost: newCost });
                    }}
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Advance Percentage (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-36">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editProjectForm.advancePercentage ?? 10}
                          onChange={(e) => {
                            const newPct = parseFloat(e.target.value) || 0;
                            setEditProjectForm({ ...editProjectForm, advancePercentage: newPct });
                          }}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">%</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Advance: {formatCurrency(Math.round(((editProjectForm.totalCost || 0) * (editProjectForm.advancePercentage || 10)) / 100))}
                        </span>
                        <span className="block text-[11px]">
                          Remaining for Installments: {formatCurrency(Math.max(0, (editProjectForm.totalCost || 0) - Math.round(((editProjectForm.totalCost || 0) * (editProjectForm.advancePercentage || 10)) / 100)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Installments Table */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Installment Breakdown & Payment Details
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Edit stage names, percentages, amounts, statuses, and attach payment method proofs.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        const cost = editProjectForm.totalCost || 0;
                        const advVal = Math.round((cost * (editProjectForm.advancePercentage || 10)) / 100);
                        const rem = Math.max(0, cost - advVal);
                        const nextIdx = (editProjectForm.installments || []).length + 1;
                        const newInst = {
                          id: `inst-${Date.now()}`,
                          title: `Installment ${nextIdx}`,
                          amount: Math.round(rem * 0.25),
                          percentage: 25,
                          dueDate: new Date(Date.now() + nextIdx * 20 * 86400000).toISOString().split('T')[0],
                          status: 'pending',
                          paymentMode: 'Bank Transfer',
                          paidDate: null,
                          paymentProof: null,
                          notes: '',
                        };
                        setEditProjectForm({
                          ...editProjectForm,
                          installments: [...(editProjectForm.installments || []), newInst],
                        });
                      }}
                      className="flex items-center gap-1"
                    >
                      <PlusIcon className="size-3.5" />
                      <span>Add Installment</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(editProjectForm.installments || []).map((inst, idx) => {
                      return (
                        <div
                          key={inst.id || idx}
                          className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <span className="font-mono text-muted-foreground font-bold">#{idx + 1}</span>
                              <input
                                type="text"
                                value={inst.title}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  updated[idx] = { ...updated[idx], title: e.target.value };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary focus:outline-none flex-1"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                value={inst.status}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  const newStatus = e.target.value;
                                  updated[idx] = {
                                    ...updated[idx],
                                    status: newStatus,
                                    paidAmount: newStatus === 'paid' ? (inst.paidAmount || inst.amount) : 0,
                                    paidDate: newStatus === 'paid' ? (inst.paidDate || new Date().toISOString().split('T')[0]) : null,
                                  };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none capitalize"
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="overdue">Overdue</option>
                              </select>

                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = editProjectForm.installments.filter((_, i) => i !== idx);
                                    setEditProjectForm({ ...editProjectForm, installments: updated });
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                  title="Remove Installment"
                                >
                                  <TrashIcon className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                Amount (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={inst.amount}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                Due Date
                              </label>
                              <input
                                type="date"
                                value={inst.dueDate ? inst.dueDate.split('T')[0] : ''}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  updated[idx] = { ...updated[idx], dueDate: e.target.value };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                Payment Mode
                              </label>
                              <select
                                value={inst.paymentMode || 'Bank Transfer'}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  updated[idx] = { ...updated[idx], paymentMode: e.target.value };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                              >
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="UPI">UPI</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Cash">Cash</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                Paid Date
                              </label>
                              <input
                                type="date"
                                value={inst.paidDate ? inst.paidDate.split('T')[0] : ''}
                                onChange={(e) => {
                                  const updated = [...editProjectForm.installments];
                                  updated[idx] = { ...updated[idx], paidDate: e.target.value };
                                  setEditProjectForm({ ...editProjectForm, installments: updated });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* Payment Proof / Picture Picker for this installment */}
                          <div className="pt-1 flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-bold text-muted-foreground">Payment Proof:</span>
                            {inst.paymentProof ? (
                              <div className="flex items-center gap-2 bg-card px-2.5 py-1 rounded-lg border border-border">
                                <img
                                  src={inst.paymentProof}
                                  alt="Proof Thumbnail"
                                  onClick={() => setPreviewImageModal(inst.paymentProof)}
                                  className="size-7 rounded object-cover cursor-pointer border border-border hover:opacity-90"
                                />
                                <span className="text-[11px] font-medium text-foreground">Attached Photo</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editProjectForm.installments];
                                    updated[idx] = { ...updated[idx], paymentProof: null };
                                    setEditProjectForm({ ...editProjectForm, installments: updated });
                                  }}
                                  className="text-muted-foreground hover:text-destructive p-1"
                                  title="Remove image"
                                >
                                  <TrashIcon className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-border hover:border-primary/50 bg-card hover:bg-muted text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                <CameraIcon className="size-3.5 text-primary" />
                                <span>Attach Picture / Receipt</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const updated = [...editProjectForm.installments];
                                        updated[idx] = { ...updated[idx], paymentProof: ev.target.result };
                                        setEditProjectForm({ ...editProjectForm, installments: updated });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Save Button */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => setViewingProjectDetails(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveProjectDetails}>
                    Save All Changes
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* MAIN RECEIVED TABLE VIEW */
            <div className="space-y-4">
              {/* Clean Top Toolbar with Inline Numbers Strip */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
                {/* Project Picker & Search */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span>Site:</span>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      {schedules.map((s) => (
                        <option key={s.projectId} value={s.projectId}>
                          {s.projectName} ({s.clientName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <SearchIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                    />
                  </div>

                  {/* Status Filter Chips */}
                  <div className="flex items-center gap-1">
                    {['all', 'pending', 'paid', 'overdue'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setClientStatusFilter(st)}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors cursor-pointer',
                          clientStatusFilter === st
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Numbers Strip */}
                <div className="flex items-center gap-3 text-xs divide-x divide-border">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Contract:</span>
                    <span className="font-bold text-foreground font-mono">
                      {formatCurrency(currentProjectTotals.cost)}
                    </span>
                  </div>
                  <div className="pl-3 flex items-center gap-1.5">
                    <span className="text-muted-foreground">Collected:</span>
                    <span className="font-bold text-success font-mono">
                      {formatCurrency(currentProjectTotals.paid)} ({currentProjectTotals.realization}%)
                    </span>
                  </div>
                  <div className="pl-3 flex items-center gap-1.5">
                    <span className="text-muted-foreground">Pending:</span>
                    <span className="font-bold text-foreground font-mono">
                      {formatCurrency(currentProjectTotals.pending)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Simple Clean Table: Column 1 renamed to Projects with Client Name */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-4">Projects</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Payment Details</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {filteredInstallments.length > 0 ? (
                        filteredInstallments.map((inst) => {
                          const isPaid = inst.status === 'paid';
                          const isOverdue = inst.status === 'overdue';

                          return (
                            <tr key={inst.id} className="hover:bg-muted/40 transition-colors">
                              {/* Projects & Client Name Column */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-foreground block">
                                    {currentSchedule.projectName}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span>Client:</span>
                                    <span className="font-medium text-foreground">
                                      {currentSchedule.clientName}
                                    </span>
                                    <span>•</span>
                                    <span className="text-muted-foreground">{inst.title}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono font-bold text-foreground text-sm">
                                {formatCurrency(inst.amount)}
                              </td>

                              <td className="py-3 px-4 text-muted-foreground">
                                {formatDate(inst.dueDate)}
                              </td>

                              <td className="py-3 px-4">
                                {isPaid && <Badge variant="success">Paid</Badge>}
                                {isOverdue && <Badge variant="danger">Overdue</Badge>}
                                {!isPaid && !isOverdue && <Badge variant="warning">Pending</Badge>}
                              </td>

                              <td className="py-3 px-4">
                                {isPaid ? (
                                  <div className="text-[11px] space-y-0.5">
                                    <span className="font-medium text-foreground">
                                      {inst.paymentMode || 'Bank Transfer'}
                                    </span>
                                    {inst.paymentProof && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImageModal(inst.paymentProof)}
                                        className="text-[10px] text-primary flex items-center gap-1 hover:underline cursor-pointer"
                                      >
                                        <CameraIcon className="size-3" />
                                        <span>View Photo</span>
                                      </button>
                                    )}
                                    {inst.receiptNumber && (
                                      <p className="font-mono text-muted-foreground text-[10px]">
                                        {inst.receiptNumber}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>

                              {/* Action Column: Eye Icon for opening detailed editable project view */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenProjectDetails(currentSchedule, inst)}
                                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    title="View & Edit Project Payment Details"
                                  >
                                    <EyeIcon className="size-4 text-primary" />
                                  </button>

                                  {isPaid && (
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        setViewingReceipt({
                                          type: 'client',
                                          title: inst.title,
                                          projectName: currentSchedule.projectName,
                                          clientName: currentSchedule.clientName,
                                          amount: inst.paidAmount || inst.amount,
                                          date: inst.paidDate || inst.dueDate,
                                          receiptNumber: inst.receiptNumber || 'REC-101',
                                          mode: inst.paymentMode || 'Bank Transfer',
                                          notes: inst.notes,
                                          paymentProof: inst.paymentProof,
                                        })
                                      }
                                      className="inline-flex items-center gap-1"
                                      title="View Receipt"
                                    >
                                      <ReceiptIcon className="size-3.5" />
                                      <span>Receipt</span>
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                            No payment installments found matching your filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* VIEW: PAY — LABOUR & AGENCY PAYOUT (DESIGNED LIKE CLIENT SCREEN)       */}
      {/* ===================================================================== */}
      {currentView === 'pay' && paySubTab === 'labours' && (
        <div className="space-y-4">
          {/* 1. Quick KPI Metric Stat Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Disbursed
              </span>
              <div className="text-xl font-bold font-mono text-success mt-1">
                {formatCurrency(labourTotals.totalDisbursed)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Cleared worker wages</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Pending
              </span>
              <div className="text-xl font-bold font-mono text-warning mt-1">
                {formatCurrency(labourTotals.totalPending)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Unsettled wages due</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Workers
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {labourTotals.uniqueWorkers}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Craftspersons on site</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Settlement Records
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {labourPayouts.length}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Wage payout vouchers</span>
            </div>
          </div>

          {/* 2. Modern Single-Line Filter Toolbar (Matching ClientsPage.jsx) */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={labourSearch}
                    onChange={(e) => {
                      setLabourSearch(e.target.value);
                      setLabourPage(1);
                    }}
                    placeholder="Search worker name, trade, voucher..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {labourSearch && (
                    <button
                      type="button"
                      onClick={() => setLabourSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>

                {/* Status Dropdown with counts */}
                <div className="relative">
                  <select
                    value={labourStatusFilter}
                    onChange={(e) => {
                      setLabourStatusFilter(e.target.value);
                      setLabourPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Workers ({labourStatusCounts.all})</option>
                    <option value="paid">Paid ({labourStatusCounts.paid})</option>
                    <option value="pending">Pending ({labourStatusCounts.pending})</option>
                  </select>
                </div>

                {/* Site/Project Dropdown */}
                <div className="relative">
                  <select
                    value={labourProjectFilter}
                    onChange={(e) => {
                      setLabourProjectFilter(e.target.value);
                      setLabourPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary max-w-[170px] truncate"
                  >
                    <option value="all">All Project Sites</option>
                    {schedules.map((s) => (
                      <option key={s.projectId} value={s.projectId}>
                        {s.projectName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trade Dropdown */}
                <div className="relative">
                  <select
                    value={labourTradeFilter}
                    onChange={(e) => {
                      setLabourTradeFilter(e.target.value);
                      setLabourPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Trades</option>
                    <option value="Carpenter">Carpentry</option>
                    <option value="Plumber">Plumbing</option>
                    <option value="Electrician">Electrical</option>
                    <option value="Tile Mason">Tile Masonry</option>
                    <option value="Painter">Painting</option>
                    <option value="False Ceiling">False Ceiling</option>
                  </select>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    value={labourSort}
                    onChange={(e) => setLabourSort(e.target.value)}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="amount_desc">Sort: Amount (High to Low)</option>
                    <option value="amount_asc">Sort: Amount (Low to High)</option>
                    <option value="name_asc">Sort: Worker Name (A to Z)</option>
                  </select>
                </div>

                {/* Rows Selector */}
                <div className="relative">
                  <select
                    value={labourRowsPerPage}
                    onChange={(e) => {
                      setLabourRowsPerPage(Number(e.target.value));
                      setLabourPage(1);
                    }}
                    className="h-8 px-2 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={10}>Rows: 10</option>
                    <option value={25}>Rows: 25</option>
                    <option value={50}>Rows: 50</option>
                  </select>
                </div>

                {/* Clear Filter button */}
                {(labourSearch || labourStatusFilter !== 'all' || labourProjectFilter !== 'all' || labourTradeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setLabourSearch('');
                      setLabourStatusFilter('all');
                      setLabourProjectFilter('all');
                      setLabourTradeFilter('all');
                      setLabourPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XIcon className="size-3" />
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. BefUI Data Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Worker & Trade</th>
                    <th className="py-3 px-4">Project Site</th>
                    <th className="py-3 px-4">Working Days</th>
                    <th className="py-3 px-4">Pay Per Day</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Date & Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedLabourPayouts.length > 0 ? (
                    paginatedLabourPayouts.map((item) => {
                      const isPaid = item.status === 'paid';

                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={item.workerName} size="sm" className="shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground block truncate">{item.workerName}</span>
                                <span className="text-[11px] text-muted-foreground">{item.trade}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-foreground font-medium">
                            <span className="truncate block max-w-[200px]" title={item.projectName}>
                              {item.projectName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-foreground">
                            {item.units || 1} {item.unitLabel === 'Days' || !item.unitLabel ? 'Days' : item.unitLabel}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {formatCurrency(item.rate)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <div className="space-y-0.5 text-[11px]">
                                <span className="text-foreground font-medium">{formatDate(item.paidDate)}</span>
                                <span className="block text-muted-foreground text-[10px] font-mono">{item.paymentMode}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Unsettled</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <Badge variant="success">Paid</Badge>
                            ) : (
                              <Badge variant="warning">Pending</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 w-[96px] ml-auto">
                              {/* Slot 1: View button (always present) */}
                              <button
                                type="button"
                                title="View Voucher"
                                data-tooltip="View Voucher"
                                onClick={() =>
                                  setViewingReceipt({
                                    type: 'labour',
                                    title: `Labour Settlement: ${item.workerName}`,
                                    projectName: item.projectName,
                                    clientName: `${item.trade} Craftsperson`,
                                    amount: item.amount,
                                    date: item.paidDate,
                                    receiptNumber: item.voucherNumber,
                                    mode: item.paymentMode,
                                    notes: `${item.units} ${item.unitLabel || 'Days'} @ ${formatCurrency(item.rate)}/day. ${item.notes || ''}`,
                                  })
                                }
                                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                              >
                                <EyeIcon className="size-3.5" />
                              </button>

                              {/* Slot 2: Pay button (if pending) or fixed-width placeholder to keep column aligned */}
                              {!isPaid && isManagerOrAdmin ? (
                                <button
                                  type="button"
                                  title="Pay"
                                  data-tooltip="Pay"
                                  onClick={() => handleQuickPayLabour(item.id)}
                                  className="size-7 rounded-md flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer shrink-0"
                                >
                                  <CheckIcon className="size-3.5" />
                                </button>
                              ) : (
                                <div className="size-7 shrink-0" />
                              )}

                              {/* Slot 3: Delete button */}
                              {isManagerOrAdmin ? (
                                <button
                                  type="button"
                                  title="Delete"
                                  data-tooltip="Delete"
                                  onClick={() => handleDeleteLabourPayout(item.id)}
                                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                >
                                  <TrashIcon className="size-3.5" />
                                </button>
                              ) : (
                                <div className="size-7 shrink-0" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                        No labour payouts found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {labourTotalPages > 1 && (
              <div className="p-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {(labourPage - 1) * labourRowsPerPage + 1} to{' '}
                  {Math.min(labourPage * labourRowsPerPage, filteredLabourPayouts.length)} of{' '}
                  {filteredLabourPayouts.length} entries
                </span>
                <Pagination
                  currentPage={labourPage}
                  totalPages={labourTotalPages}
                  onPageChange={(p) => setLabourPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: PAY — AGENCY PAYOUT (DESIGNED LIKE CLIENT SCREEN)               */}
      {/* ===================================================================== */}
      {currentView === 'pay' && paySubTab === 'agencies' && (
        <div className="space-y-4">
          {/* 1. Quick KPI Metric Stat Cards Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Invoiced
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(agencyTotals.totalBilled)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Total agency bill amount</span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Cleared
              </span>
              <div className="text-xl font-bold font-mono text-success mt-1">
                {formatCurrency(agencyTotals.totalCleared)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Disbursed to contractors</span>
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
                {agencyPayouts.length}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Partner contractor bills</span>
            </div>
          </div>

          {/* 2. Modern Single-Line Filter Toolbar (Matching ClientsPage.jsx) */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={agencySearch}
                    onChange={(e) => {
                      setAgencySearch(e.target.value);
                      setAgencyPage(1);
                    }}
                    placeholder="Search agency name, invoice, trade..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {agencySearch && (
                    <button
                      type="button"
                      onClick={() => setAgencySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>

                {/* Status Dropdown with counts */}
                <div className="relative">
                  <select
                    value={agencyStatusFilter}
                    onChange={(e) => {
                      setAgencyStatusFilter(e.target.value);
                      setAgencyPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Bills ({agencyStatusCounts.all})</option>
                    <option value="paid">Paid ({agencyStatusCounts.paid})</option>
                    <option value="partially_paid">Partially Paid ({agencyStatusCounts.partially_paid})</option>
                    <option value="pending">Pending ({agencyStatusCounts.pending})</option>
                  </select>
                </div>

                {/* Site/Project Dropdown */}
                <div className="relative">
                  <select
                    value={agencyProjectFilter}
                    onChange={(e) => {
                      setAgencyProjectFilter(e.target.value);
                      setAgencyPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary max-w-[170px] truncate"
                  >
                    <option value="all">All Project Sites</option>
                    {schedules.map((s) => (
                      <option key={s.projectId} value={s.projectId}>
                        {s.projectName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    value={agencySort}
                    onChange={(e) => setAgencySort(e.target.value)}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="bill_desc">Sort: Bill Amount (High to Low)</option>
                    <option value="due_desc">Sort: Balance Due (High to Low)</option>
                    <option value="name_asc">Sort: Agency Name (A to Z)</option>
                  </select>
                </div>

                {/* Rows Selector */}
                <div className="relative">
                  <select
                    value={agencyRowsPerPage}
                    onChange={(e) => {
                      setAgencyRowsPerPage(Number(e.target.value));
                      setAgencyPage(1);
                    }}
                    className="h-8 px-2 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={10}>Rows: 10</option>
                    <option value={25}>Rows: 25</option>
                    <option value={50}>Rows: 50</option>
                  </select>
                </div>

                {/* Clear Filter button */}
                {(agencySearch || agencyStatusFilter !== 'all' || agencyProjectFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgencySearch('');
                      setAgencyStatusFilter('all');
                      setAgencyProjectFilter('all');
                      setAgencyPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XIcon className="size-3" />
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. BefUI Data Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Agency & Trade</th>
                    <th className="py-3 px-4">Project Site</th>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Bill Amount</th>
                    <th className="py-3 px-4">Paid Amount</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedAgencyPayouts.length > 0 ? (
                    paginatedAgencyPayouts.map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={item.agencyName} size="sm" className="shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground block truncate">{item.agencyName}</span>
                                <span className="text-[11px] text-muted-foreground">{item.trade}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-foreground font-medium">
                            <span className="truncate block max-w-[200px]" title={item.projectName}>
                              {item.projectName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-xs">
                            {item.invoiceNumber}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {formatCurrency(item.billAmount)}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-success">
                            {formatCurrency(item.paidAmount)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {item.pendingBalance > 0 ? (
                              <span className="text-warning">{formatCurrency(item.pendingBalance)}</span>
                            ) : (
                              <span className="text-muted-foreground">₹0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {item.status === 'paid' ? (
                              <Badge variant="success">Paid</Badge>
                            ) : item.status === 'partially_paid' ? (
                              <Badge variant="neutral">Partially Paid</Badge>
                            ) : (
                              <Badge variant="warning">Pending</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 w-[96px] ml-auto">
                              {/* Slot 1: View button (always aligned in first column) */}
                              <button
                                type="button"
                                title="View Invoice"
                                data-tooltip="View Invoice"
                                onClick={() =>
                                  setViewingReceipt({
                                    type: 'agency',
                                    title: `Agency Clearance: ${item.agencyName}`,
                                    projectName: item.projectName,
                                    clientName: `Subcontractor - ${item.trade}`,
                                    amount: item.paidAmount || item.billAmount,
                                    date: item.paymentDate,
                                    receiptNumber: item.invoiceNumber,
                                    mode: item.paymentMode,
                                    notes: `Work Stage: ${item.workStage}. Bill: ${formatCurrency(item.billAmount)}, Paid: ${formatCurrency(item.paidAmount)}, Due: ${formatCurrency(item.pendingBalance)}. Ref: ${item.transactionRef || 'N/A'}`,
                                  })
                                }
                                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                              >
                                <EyeIcon className="size-3.5" />
                              </button>

                              {/* Slot 2: Pay button (if balance due) or fixed-width placeholder to keep column aligned */}
                              {item.pendingBalance > 0 && isManagerOrAdmin ? (
                                <button
                                  type="button"
                                  title="Pay"
                                  data-tooltip="Pay"
                                  onClick={() => {
                                    setAgencyForm({
                                      agencyId: item.agencyId,
                                      agencyName: item.agencyName,
                                      trade: item.trade,
                                      projectId: item.projectId,
                                      workStage: item.workStage,
                                      invoiceNumber: item.invoiceNumber,
                                      billAmount: item.billAmount,
                                      paidAmount: item.billAmount,
                                      paymentDate: new Date().toISOString().split('T')[0],
                                      paymentMode: 'Bank Transfer',
                                      transactionRef: `BT-${Math.floor(1000 + Math.random() * 9000)}`,
                                      notes: 'Balance clearance settlement',
                                    });
                                    setIsRecordAgencyOpen(true);
                                  }}
                                  className="size-7 rounded-md flex items-center justify-center text-primary hover:bg-primary/15 transition-colors cursor-pointer shrink-0"
                                >
                                  <PlusIcon className="size-3.5" />
                                </button>
                              ) : (
                                <div className="size-7 shrink-0" />
                              )}

                              {/* Slot 3: Delete button */}
                              {isManagerOrAdmin ? (
                                <button
                                  type="button"
                                  title="Delete"
                                  data-tooltip="Delete"
                                  onClick={() => handleDeleteAgencyPayout(item.id)}
                                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                >
                                  <TrashIcon className="size-3.5" />
                                </button>
                              ) : (
                                <div className="size-7 shrink-0" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                        No agency bills found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {agencyTotalPages > 1 && (
              <div className="p-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {(agencyPage - 1) * agencyRowsPerPage + 1} to{' '}
                  {Math.min(agencyPage * agencyRowsPerPage, filteredAgencyPayouts.length)} of{' '}
                  {filteredAgencyPayouts.length} entries
                </span>
                <Pagination
                  currentPage={agencyPage}
                  totalPages={agencyTotalPages}
                  onPageChange={(p) => setAgencyPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* REDESIGNED MODAL: RECORD PAYMENT & INSTALLMENTS POP-UP                */}
      {/* ===================================================================== */}
      {isRecordPaymentOpen && (
        <Modal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          title="Record Payment"
          description="Configure contract budget, advance percentage, installment schedule, and attach payment method proof."
        >
          <form onSubmit={handleSaveRecordPayment} className="space-y-4">
            {/* Project Site Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Project & Client <span className="text-destructive">*</span>
              </label>
              <select
                value={recordPaymentForm.projectId}
                onChange={(e) => {
                  const pid = e.target.value;
                  const prj = schedules.find((s) => s.projectId === pid);
                  const newCost = prj?.totalCost || 40000;
                  setRecordPaymentForm((prev) => ({
                    ...prev,
                    projectId: pid,
                    totalCost: newCost,
                  }));
                  handleRecalculateRecordPayment(newCost, recordPaymentForm.advancePercentage);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {schedules.map((s) => (
                  <option key={s.projectId} value={s.projectId}>
                    {s.projectName} (Client: {s.clientName})
                  </option>
                ))}
              </select>
            </div>

            {/* Total Contract Cost */}
            <Input
              label="Total Contract Budget / Total Cost (₹)"
              type="number"
              required
              min="1000"
              placeholder="e.g. 40,000"
              value={recordPaymentForm.totalCost}
              onChange={(e) => handleRecalculateRecordPayment(e.target.value, recordPaymentForm.advancePercentage)}
            />

            {/* Advance Percentage with Live Calculated Amount */}
            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Advance Percentage (%)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative w-full sm:w-40">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      placeholder="e.g. 10"
                      value={recordPaymentForm.advancePercentage}
                      onChange={(e) => handleRecalculateRecordPayment(recordPaymentForm.totalCost, e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">%</span>
                  </div>

                  {/* Calculated Value in front of Advance % */}
                  <div className="flex-1 bg-card px-3 py-2 rounded-lg border border-border text-xs">
                    <span className="text-muted-foreground block text-[10px]">Calculated Advance Amount:</span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {formatCurrency(recordModalAdvValue)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      ({recordPaymentForm.advancePercentage}% of {formatCurrency(recordModalCost)}) • Remaining: {formatCurrency(recordModalRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Number of Installments */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Number of Installments
                </label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Remaining to divide: <span className="font-mono font-bold text-foreground">{formatCurrency(recordModalRemaining)}</span>
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="12"
                required
                value={recordPaymentForm.installmentsCount}
                onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Dynamic Installments List with Live Calculation */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {recordPaymentForm.installments.map((inst, idx) => (
                <div
                  key={inst.id || idx}
                  className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      Installment #{idx + 1}
                    </span>
                    <span className="font-mono font-bold text-xs text-primary">
                      {formatCurrency(inst.amount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Title</label>
                      <input
                        type="text"
                        value={inst.title}
                        onChange={(e) => {
                          const updated = [...recordPaymentForm.installments];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setRecordPaymentForm({ ...recordPaymentForm, installments: updated });
                        }}
                        className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Installment % (of remaining)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inst.percentage}
                          onChange={(e) => handleInstallmentPercentChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Due Date</label>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => {
                          const updated = [...recordPaymentForm.installments];
                          updated[idx] = { ...updated[idx], dueDate: e.target.value };
                          setRecordPaymentForm({ ...recordPaymentForm, installments: updated });
                        }}
                        className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Mode & Payment Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Mode <span className="text-destructive">*</span>
                </label>
                <select
                  value={recordPaymentForm.paymentMode}
                  onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={recordPaymentForm.paidDate}
                  onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paidDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Picture / File Picker (Replaces Reference No.) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Payment Proof / Picture (Receipt / UPI / Cheque)
              </label>
              {recordPaymentForm.paymentProof ? (
                <div className="relative flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <img
                    src={recordPaymentForm.paymentProof}
                    alt="Payment Proof"
                    onClick={() => setPreviewImageModal(recordPaymentForm.paymentProof)}
                    className="size-14 rounded-lg object-cover border border-border cursor-pointer hover:opacity-90"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {recordPaymentForm.paymentProofName || 'Payment Proof Attachment'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Click thumbnail to view full image</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecordPaymentForm({ ...recordPaymentForm, paymentProof: null, paymentProofName: '' })}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-primary/50 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-center">
                  <CameraIcon className="size-6 text-muted-foreground mb-1" />
                  <span className="text-xs font-medium text-foreground">Click to upload payment picture or slip</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, JPEG, WEBP or PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setRecordPaymentForm({
                            ...recordPaymentForm,
                            paymentProof: ev.target.result,
                            paymentProofName: file.name,
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Checkbox to mark Booking Advance as Paid */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="markAdvancePaid"
                checked={recordPaymentForm.markAdvancePaid}
                onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, markAdvancePaid: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary cursor-pointer size-4"
              />
              <label htmlFor="markAdvancePaid" className="text-xs text-foreground cursor-pointer select-none">
                Mark Booking Advance ({formatCurrency(recordModalAdvValue)}) as Paid with this payment proof
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes or remarks..."
                value={recordPaymentForm.notes}
                onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs resize-none focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Payment Record
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL: IMAGE PREVIEW MODAL                                            */}
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
      {/* MODAL 3: RECORD LABOUR PAYOUT                                         */}
      {/* ===================================================================== */}
      {isRecordLabourOpen && (
        <Modal
          isOpen={isRecordLabourOpen}
          onClose={() => setIsRecordLabourOpen(false)}
          title="Make Labour Payout"
        >
          <form onSubmit={handleSaveLabourPayout} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Worker Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sutar"
                  value={labourForm.workerName}
                  onChange={(e) => setLabourForm({ ...labourForm, workerName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Trade <span className="text-destructive">*</span>
                </label>
                <select
                  value={labourForm.trade}
                  onChange={(e) => setLabourForm({ ...labourForm, trade: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="Carpenter">Carpenter</option>
                  <option value="Plumber">Plumber</option>
                  <option value="Electrician">Electrician</option>
                  <option value="Tile Mason">Tile Mason</option>
                  <option value="Painter">Painter</option>
                  <option value="False Ceiling">False Ceiling</option>
                  <option value="General Labour">General Labour</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Site / Project <span className="text-destructive">*</span>
              </label>
              <select
                value={labourForm.projectId}
                onChange={(e) => setLabourForm({ ...labourForm, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {schedules.map((s) => (
                  <option key={s.projectId} value={s.projectId}>
                    {s.projectName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Working Days
                </label>
                <input
                  type="number"
                  step="any"
                  value={labourForm.units}
                  onChange={(e) => {
                    const u = parseFloat(e.target.value) || 0;
                    const r = parseFloat(labourForm.rate) || 0;
                    setLabourForm({ ...labourForm, units: e.target.value, amount: Math.round(u * r) });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <Input
                label="Rate (₹)"
                type="number"
                placeholder="e.g. 1,200"
                value={labourForm.rate}
                onChange={(e) => {
                  const r = parseFloat(e.target.value) || 0;
                  const u = parseFloat(labourForm.units) || 0;
                  setLabourForm({ ...labourForm, rate: e.target.value, amount: Math.round(u * r) });
                }}
              />

              <Input
                label="Total (₹)"
                type="number"
                required
                placeholder="e.g. 14,400"
                value={labourForm.amount}
                onChange={(e) => setLabourForm({ ...labourForm, amount: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Mode
                </label>
                <select
                  value={labourForm.paymentMode}
                  onChange={(e) => setLabourForm({ ...labourForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={labourForm.status}
                  onChange={(e) => setLabourForm({ ...labourForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordLabourOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Payout
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: RECORD AGENCY PAYMENT                                        */}
      {/* ===================================================================== */}
      {isRecordAgencyOpen && (
        <Modal
          isOpen={isRecordAgencyOpen}
          onClose={() => setIsRecordAgencyOpen(false)}
          title="Record Agency / Contractor Bill"
        >
          <form onSubmit={handleSaveAgencyPayout} className="space-y-4">
            <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Site / Project <span className="text-destructive">*</span>
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

              <div className="space-y-1.5">
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
                label="Total Bill Amount (₹)"
                type="number"
                required
                min="1"
                placeholder="e.g. 2,50,000"
                value={agencyForm.billAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, billAmount: e.target.value })}
              />

              <Input
                label="Amount Paying Now (₹)"
                type="number"
                min="0"
                placeholder="e.g. 1,00,000"
                value={agencyForm.paidAmount}
                onChange={(e) => setAgencyForm({ ...agencyForm, paidAmount: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Work Stage / Description
              </label>
              <input
                type="text"
                placeholder="e.g. GI Channel Framing & Saint-Gobain Boarding"
                value={agencyForm.workStage}
                onChange={(e) => setAgencyForm({ ...agencyForm, workStage: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordAgencyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Record Agency Bill
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: RECEIPT / VOUCHER VIEWER                                     */}
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Beneficiary / Client</span>
                  <span className="font-semibold text-foreground">{viewingReceipt.clientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Date</span>
                  <span className="font-semibold text-foreground">{formatDate(viewingReceipt.date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Settled Amount</span>
                  <span className="font-mono font-bold text-sm text-success">
                    {formatCurrency(viewingReceipt.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Payment Mode</span>
                  <span className="font-semibold text-foreground">{viewingReceipt.mode || 'Bank Transfer'}</span>
                </div>
              </div>

              {viewingReceipt.paymentProof && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-muted-foreground block text-[10px] mb-1">Attached Payment Proof</span>
                  <img
                    src={viewingReceipt.paymentProof}
                    alt="Proof Preview"
                    onClick={() => setPreviewImageModal(viewingReceipt.paymentProof)}
                    className="h-24 w-auto rounded-lg object-contain border border-border cursor-pointer hover:opacity-90 bg-card p-1"
                  />
                </div>
              )}

              {viewingReceipt.notes && (
                <div className="pt-2 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground block text-[10px]">Notes</span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">{viewingReceipt.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5"
              >
                <PrinterIcon className="size-3.5" />
                <span>Print</span>
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
