import React, { useState, useMemo, useEffect } from 'react';
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
import { isDebug } from '../config/env';
import { agencyService } from '../services/agencyService';
import { paymentService } from '../services/paymentService';
import { cn } from '../lib/utils';

// BefUI Components
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/badge';
import { Tabs } from '../components/ui/Tabs';

// BefUI Icons strictly from '@/components/ui/icons'
import {
  WalletIcon,
  UsersIcon,
  Building2Icon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  ReceiptIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  FileTextIcon,
  PrinterIcon,
} from '../components/ui/icons';

const STORAGE_KEY_CLIENT_PAYMENTS = 'osm_client_payment_schedules_v2';
const STORAGE_KEY_LABOUR_PAYOUTS = 'osm_labour_payouts_v2';
const STORAGE_KEY_AGENCY_PAYOUTS = 'osm_agency_payouts_v2';

export function PaymentsPage() {
  const { currentUser } = useAuth();
  const toast = useToast();

  const isManagerOrAdmin =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === ROLES.OWNER ||
    currentUser?.role === ROLES.PROJECT_MANAGER ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'owner' ||
    currentUser?.role === 'project_manager';

  // Active top-level Tab: 'clients' | 'labours' | 'agencies'
  const [mainTab, setMainTab] = useState('clients');

  // ---------------------------------------------------------------------------
  // 1. DATA STATE & LOCAL STORAGE PERSISTENCE
  // ---------------------------------------------------------------------------
  const [schedules, setSchedules] = useState(() => {
    if (!isDebug()) return []; // with a backend the data is loaded from the API
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_PAYMENTS);
      return saved ? JSON.parse(saved) : mockProjectPaymentSchedules;
    } catch (e) {
      return mockProjectPaymentSchedules;
    }
  });

  const [labourPayouts, setLabourPayouts] = useState(() => {
    if (!isDebug()) return []; // with a backend the data is loaded from the API
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LABOUR_PAYOUTS);
      return saved ? JSON.parse(saved) : mockLabourPayouts;
    } catch (e) {
      return mockLabourPayouts;
    }
  });

  const [agencyPayouts, setAgencyPayouts] = useState(() => {
    if (!isDebug()) return []; // with a backend the data is loaded from the API
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

  // With a backend: load everything from the API. A section the person may not see (403) is simply empty.
  const [agencyList, setAgencyList] = useState(isDebug() ? mockAgencies : []);

  const reloadLive = async () => {
    const [sch, lab, bills, agencies] = await Promise.all([
      paymentService.getSchedules().catch(() => []),
      paymentService.getLabour().catch(() => []),
      paymentService.getAgencyPayouts().catch(() => []),
      agencyService.getAllAgencies().catch(() => []),
    ]);
    setSchedules(sch);
    setLabourPayouts(lab);
    setAgencyPayouts(bills);
    setAgencyList(agencies);
    setSelectedProjectId((current) =>
      sch.some((x) => String(x.projectId) === String(current)) ? current : sch[0]?.projectId || ''
    );
  };

  useEffect(() => {
    if (!isDebug()) reloadLive();
  }, []);

  // ---------------------------------------------------------------------------
  // 2. SEARCH & FILTER STATE
  // ---------------------------------------------------------------------------
  const [selectedProjectId, setSelectedProjectId] = useState(() => schedules[0]?.projectId || 'P1');
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid' | 'overdue'

  const [labourSearch, setLabourSearch] = useState('');
  const [labourProjectFilter, setLabourProjectFilter] = useState('all');
  const [labourTradeFilter, setLabourTradeFilter] = useState('all');
  const [labourStatusFilter, setLabourStatusFilter] = useState('all'); // 'all' | 'paid' | 'pending'

  const [agencySearch, setAgencySearch] = useState('');
  const [agencyProjectFilter, setAgencyProjectFilter] = useState('all');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState('all'); // 'all' | 'paid' | 'partially_paid' | 'pending'

  // Current active project schedule for client payments
  const currentSchedule = useMemo(() => {
    return schedules.find((s) => s.projectId === selectedProjectId) || schedules[0] || null;
  }, [schedules, selectedProjectId]);

  // Overall totals across client projects
  const clientTotals = useMemo(() => {
    let totalCost = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let overdueCount = 0;

    schedules.forEach((s) => {
      totalCost += s.totalCost || 0;
      totalPaid += s.totalPaid || 0;
      totalPending += s.totalPending || 0;
      (s.installments || []).forEach((inst) => {
        if (inst.status === 'overdue') overdueCount++;
      });
    });

    return { totalCost, totalPaid, totalPending, overdueCount };
  }, [schedules]);

  // Current project schedule totals
  const currentProjectTotals = useMemo(() => {
    if (!currentSchedule) return { totalCost: 0, totalPaid: 0, totalPending: 0, realization: 0 };
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
        const matchesTitle = inst.title.toLowerCase().includes(q);
        const matchesMode = inst.paymentMode?.toLowerCase().includes(q);
        const matchesReceipt = inst.receiptNumber?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMode && !matchesReceipt) return false;
      }
      return true;
    });
  }, [currentSchedule, clientStatusFilter, clientSearch]);

  // Filtered Labour Payouts
  const filteredLabourPayouts = useMemo(() => {
    return labourPayouts.filter((item) => {
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
  }, [labourPayouts, labourProjectFilter, labourTradeFilter, labourStatusFilter, labourSearch]);

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

  // Filtered Agency Payouts
  const filteredAgencyPayouts = useMemo(() => {
    return agencyPayouts.filter((item) => {
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
  }, [agencyPayouts, agencyProjectFilter, agencyStatusFilter, agencySearch]);

  const agencyTotals = useMemo(() => {
    const totalBilled = agencyPayouts.reduce((sum, item) => sum + (item.billAmount || 0), 0);
    const totalCleared = agencyPayouts.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
    const totalDue = agencyPayouts.reduce((sum, item) => sum + (item.pendingBalance || 0), 0);
    return { totalBilled, totalCleared, totalDue };
  }, [agencyPayouts]);

  // ---------------------------------------------------------------------------
  // 3. MODALS STATE
  // ---------------------------------------------------------------------------
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordTargetInstallment, setRecordTargetInstallment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMode: 'Bank Transfer (NEFT)',
    paidDate: new Date().toISOString().split('T')[0],
    receiptNumber: '',
    notes: '',
  });

  const [isSetCostOpen, setIsSetCostOpen] = useState(false);
  const [costForm, setCostForm] = useState({
    projectId: '',
    totalCost: '',
    advancePercentage: 10,
    milestoneCount: 4,
  });

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
    paymentMode: 'UPI (PhonePe)',
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
    paymentMode: 'Corporate RTGS',
    transactionRef: '',
    notes: '',
  });

  const [viewingReceipt, setViewingReceipt] = useState(null);

  // ---------------------------------------------------------------------------
  // 4. ACTION HANDLERS
  // ---------------------------------------------------------------------------
  // Record Client Payment
  const handleRecordClientPayment = async (e) => {
    e.preventDefault();
    if (!recordTargetInstallment || !currentSchedule) return;

    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid received amount');
      return;
    }

    if (!isDebug()) {
      try {
        await paymentService.recordPayment(recordTargetInstallment.id, paymentForm);
        await reloadLive();
        toast.success(`Payment of ${formatCurrency(amt)} recorded for ${recordTargetInstallment.title}`);
        setIsRecordPaymentOpen(false);
      } catch (err) {
        toast.error(err.message || 'Failed to record the payment');
      }
      return;
    }

    const updatedInstallments = currentSchedule.installments.map((inst) => {
      if (inst.id === recordTargetInstallment.id) {
        return {
          ...inst,
          status: 'paid',
          paidAmount: amt,
          paidDate: paymentForm.paidDate,
          paymentMode: paymentForm.paymentMode,
          receiptNumber: paymentForm.receiptNumber || `REC-${Date.now().toString().slice(-5)}`,
          notes: paymentForm.notes,
        };
      }
      return inst;
    });

    const newTotalPaid = updatedInstallments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    const newTotalPending = Math.max(0, currentSchedule.totalCost - newTotalPaid);

    const updatedSchedule = {
      ...currentSchedule,
      totalPaid: newTotalPaid,
      totalPending: newTotalPending,
      installments: updatedInstallments,
    };

    const updatedSchedules = schedules.map((s) =>
      s.projectId === currentSchedule.projectId ? updatedSchedule : s
    );

    saveSchedules(updatedSchedules);
    toast.success(`Payment of ${formatCurrency(amt)} recorded for ${recordTargetInstallment.title}`);
    setIsRecordPaymentOpen(false);
  };

  // Set Budget & Milestones
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const cost = parseFloat(costForm.totalCost);
    if (isNaN(cost) || cost <= 0) {
      toast.error('Please enter a valid project contract budget');
      return;
    }

    if (!isDebug()) {
      try {
        await paymentService.setBudget(costForm.projectId, costForm);
        await reloadLive();
        toast.success(`Contract budget set to ${formatCurrency(cost)} with ${costForm.milestoneCount} installments`);
        setIsSetCostOpen(false);
      } catch (err) {
        toast.error(err.message || 'Failed to set the budget');
      }
      return;
    }

    const target = schedules.find((s) => s.projectId === costForm.projectId);
    if (!target) return;

    const count = parseInt(costForm.milestoneCount, 10) || 4;
    const advPercent = parseInt(costForm.advancePercentage, 10) || 10;
    const remainingPercent = 100 - advPercent;
    const stagePercent = Math.round(remainingPercent / (count - 1));

    const newInstallments = [];
    newInstallments.push({
      id: `inst-1`,
      title: `Booking Advance (${advPercent}%)`,
      amount: Math.round((cost * advPercent) / 100),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    });

    const defaultStages = [
      'Carpentry & Framework (30%)',
      'Electrical, Plumbing & False Ceiling (30%)',
      'Painting, Polishing & Final Handover (30%)',
      'Finishing & Snag Clearance',
    ];

    for (let i = 1; i < count; i++) {
      const isLast = i === count - 1;
      const pct = isLast ? 100 - advPercent - stagePercent * (count - 2) : stagePercent;
      newInstallments.push({
        id: `inst-${i + 1}`,
        title: defaultStages[i - 1] || `Milestone ${i + 1} (${pct}%)`,
        amount: Math.round((cost * pct) / 100),
        dueDate: new Date(Date.now() + (i + 1) * 20 * 86400000).toISOString().split('T')[0],
        status: 'pending',
      });
    }

    const updated = schedules.map((s) => {
      if (s.projectId === costForm.projectId) {
        return {
          ...s,
          totalCost: cost,
          totalPaid: 0,
          totalPending: cost,
          installments: newInstallments,
        };
      }
      return s;
    });

    saveSchedules(updated);
    toast.success(`Contract budget set to ${formatCurrency(cost)} with ${count} installments`);
    setIsSetCostOpen(false);
  };

  // Record Labour Payout
  const handleSaveLabourPayout = async (e) => {
    e.preventDefault();
    if (!labourForm.workerName.trim()) {
      toast.error('Artisan/worker name is required');
      return;
    }
    const amt = parseFloat(labourForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payout amount');
      return;
    }

    if (!isDebug()) {
      try {
        await paymentService.createLabour(labourForm);
        await reloadLive();
        toast.success(`Labour payout of ${formatCurrency(amt)} recorded for ${labourForm.workerName.trim()}`);
        setIsRecordLabourOpen(false);
      } catch (err) {
        toast.error(err.message || 'Failed to record the payout');
      }
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

  // Quick Pay Labour Payout
  const handleQuickPayLabour = async (id) => {
    if (!isDebug()) {
      try {
        await paymentService.payLabour(id, 'Direct Cash');
        await reloadLive();
        toast.success('Labour payout marked as paid');
      } catch (err) {
        toast.error(err.message || 'Failed to mark the payout as paid');
      }
      return;
    }
    const updated = labourPayouts.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Direct Cash',
        };
      }
      return l;
    });
    saveLabourPayouts(updated);
    toast.success('Labour payout marked as paid');
  };

  // Record Agency Payout
  const handleSaveAgencyPayout = async (e) => {
    e.preventDefault();
    const billAmt = parseFloat(agencyForm.billAmount);
    const paidAmt = parseFloat(agencyForm.paidAmount) || 0;

    if (isNaN(billAmt) || billAmt <= 0) {
      toast.error('Please enter a valid bill amount');
      return;
    }

    if (!isDebug()) {
      try {
        await paymentService.createAgencyPayout(agencyForm);
        await reloadLive();
        toast.success('Agency bill recorded');
        setIsRecordAgencyOpen(false);
      } catch (err) {
        toast.error(err.message || 'Failed to record the agency bill');
      }
      return;
    }

    const targetProj = schedules.find((s) => s.projectId === agencyForm.projectId);
    const targetAg = agencyList.find((a) => a.id === agencyForm.agencyId);
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

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* 1. Header with Direct Action Trigger */}
      <PageHeader
        title="Payments & Disbursements"
        subtitle="Manage client milestone collections, trade artisan payouts, and subcontractor bills"
        actions={
          isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              {mainTab === 'clients' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCostForm({
                        projectId: currentSchedule?.projectId || schedules[0]?.projectId,
                        totalCost: currentSchedule?.totalCost || 650000,
                        advancePercentage: 10,
                        milestoneCount: 4,
                      });
                      setIsSetCostOpen(true);
                    }}
                  >
                    Setup Milestones
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const pending = currentSchedule?.installments?.find(
                        (i) => i.status === 'overdue' || i.status === 'pending'
                      );
                      if (pending) {
                        setRecordTargetInstallment(pending);
                        setPaymentForm({
                          amount: pending.amount,
                          paymentMode: 'Bank Transfer (NEFT)',
                          paidDate: new Date().toISOString().split('T')[0],
                          receiptNumber: isDebug() ? `REC-${Date.now().toString().slice(-4)}` : '',
                          notes: '',
                        });
                        setIsRecordPaymentOpen(true);
                      } else {
                        toast.info('All installments for this project are currently paid in full.');
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <PlusIcon className="size-4" />
                    <span>Record Payment</span>
                  </Button>
                </>
              )}

              {mainTab === 'labours' && (
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
                      paymentMode: 'UPI (PhonePe)',
                      voucherNumber: isDebug() ? `VCH-LAB-${Date.now().toString().slice(-4)}` : '',
                      status: 'paid',
                      notes: '',
                    });
                    setIsRecordLabourOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <PlusIcon className="size-4" />
                  <span>Record Labour Payout</span>
                </Button>
              )}

              {mainTab === 'agencies' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const firstAg = agencyList[0];
                    setAgencyForm({
                      agencyId: firstAg?.id || 'a1',
                      agencyName: firstAg?.name || 'Apex False Ceiling',
                      trade: firstAg?.trade || 'Ceiling',
                      projectId: selectedProjectId,
                      workStage: 'Framing & Boarding Stage Bill',
                      invoiceNumber: isDebug() ? `INV-AGC-${Date.now().toString().slice(-4)}` : '',
                      billAmount: 120000,
                      paidAmount: 80000,
                      paymentDate: new Date().toISOString().split('T')[0],
                      paymentMode: 'Corporate RTGS',
                      transactionRef: isDebug() ? `UTR-HDFC-${Math.floor(10000000 + Math.random() * 90000000)}` : '',
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

      {/* 2. Clean BefUI Tabs Navigation */}
      <Tabs
        tabs={[
          {
            id: 'clients',
            label: 'Client Milestone Payments',
            icon: WalletIcon,
            count: currentSchedule?.installments?.length || 0,
          },
          {
            id: 'labours',
            label: 'Labour / Artisan Payouts',
            icon: UsersIcon,
            count: labourPayouts.length,
          },
          {
            id: 'agencies',
            label: 'Agency / Contractor Payouts',
            icon: Building2Icon,
            count: agencyPayouts.length,
          },
        ]}
        activeTab={mainTab}
        onChange={(tId) => setMainTab(tId)}
      />

      {/* ===================================================================== */}
      {/* TAB 1: CLIENT PAYMENTS (SIMPLE & CLEAR, NO CARDS)                    */}
      {/* ===================================================================== */}
      {mainTab === 'clients' && (
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
                  placeholder="Search milestone..."
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

            {/* Compact Numbers Strip (Replaces Bulky KPI Cards) */}
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

          {/* Simple Clean Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Milestone</th>
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
                          <td className="py-3 px-4">
                            <span className="font-semibold text-foreground">{inst.title}</span>
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
                                <span className="font-medium text-foreground">{inst.paymentMode || 'NEFT'}</span>
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
                          <td className="py-3 px-4 text-right">
                            {isPaid ? (
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
                                    receiptNumber: inst.receiptNumber || 'REC-AUTO-101',
                                    mode: inst.paymentMode || 'Direct NEFT',
                                    notes: inst.notes,
                                  })
                                }
                                className="inline-flex items-center gap-1"
                              >
                                <ReceiptIcon className="size-3.5" />
                                <span>Receipt</span>
                              </Button>
                            ) : (
                              isManagerOrAdmin && (
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={() => {
                                    setRecordTargetInstallment(inst);
                                    setPaymentForm({
                                      amount: inst.amount,
                                      paymentMode: 'Bank Transfer (NEFT)',
                                      paidDate: new Date().toISOString().split('T')[0],
                                      receiptNumber: isDebug() ? `REC-${Date.now().toString().slice(-4)}` : '',
                                      notes: '',
                                    });
                                    setIsRecordPaymentOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1"
                                >
                                  <CheckIcon className="size-3.5" />
                                  <span>Record Payment</span>
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        No installments found matching your filter criteria.
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
      {/* TAB 2: LABOUR / ARTISAN PAYOUTS (SIMPLE & CLEAR, NO CARDS)            */}
      {/* ===================================================================== */}
      {mainTab === 'labours' && (
        <div className="space-y-4">
          {/* Clean Top Toolbar with Inline Numbers Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <SearchIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search artisan or trade..."
                  value={labourSearch}
                  onChange={(e) => setLabourSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>

              <select
                value={labourProjectFilter}
                onChange={(e) => setLabourProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="all">All Sites</option>
                {schedules.map((s) => (
                  <option key={s.projectId} value={s.projectId}>
                    {s.projectName}
                  </option>
                ))}
              </select>

              <select
                value={labourTradeFilter}
                onChange={(e) => setLabourTradeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="all">All Trades</option>
                <option value="Carpenter">Carpentry</option>
                <option value="Plumber">Plumbing</option>
                <option value="Electrician">Electrical</option>
                <option value="Tile Mason">Tile Masonry</option>
                <option value="Painter">Painting</option>
                <option value="False Ceiling">False Ceiling</option>
              </select>

              <div className="flex items-center gap-1">
                {['all', 'paid', 'pending'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLabourStatusFilter(st)}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors cursor-pointer',
                      labourStatusFilter === st
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Numbers Strip (Replaces Bulky KPI Cards) */}
            <div className="flex items-center gap-3 text-xs divide-x divide-border">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Disbursed:</span>
                <span className="font-bold text-success font-mono">
                  {formatCurrency(labourTotals.totalDisbursed)}
                </span>
              </div>
              <div className="pl-3 flex items-center gap-1.5">
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-bold text-warning font-mono">
                  {formatCurrency(labourTotals.totalPending)}
                </span>
              </div>
              <div className="pl-3 flex items-center gap-1.5">
                <span className="text-muted-foreground">Artisans:</span>
                <span className="font-bold text-foreground font-mono">
                  {labourTotals.uniqueWorkers}
                </span>
              </div>
            </div>
          </div>

          {/* Simple Clean Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Artisan & Trade</th>
                    <th className="py-3 px-4">Project Site</th>
                    <th className="py-3 px-4">Wage Basis</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Date & Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredLabourPayouts.length > 0 ? (
                    filteredLabourPayouts.map((item) => {
                      const isPaid = item.status === 'paid';

                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-foreground">{item.workerName}</span>
                              <span className="block text-[11px] text-muted-foreground font-medium">
                                {item.trade}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                            {item.projectName}
                          </td>
                          <td className="py-3 px-4 text-foreground font-medium">
                            {item.units} {item.unitLabel || 'Days'} @ {formatCurrency(item.rate)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground text-sm">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <div className="text-[11px]">
                                <span className="font-medium text-foreground">{formatDate(item.paidDate)}</span>
                                <p className="text-muted-foreground text-[10px]">{item.paymentMode}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
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
                            {isPaid ? (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  setViewingReceipt({
                                    type: 'labour',
                                    title: `Wage Settlement: ${item.workerName}`,
                                    projectName: item.projectName,
                                    clientName: item.trade,
                                    amount: item.amount,
                                    date: item.paidDate,
                                    receiptNumber: item.voucherNumber || 'VCH-001',
                                    mode: item.paymentMode,
                                    notes: `${item.units} ${item.unitLabel} @ ${formatCurrency(item.rate)}. ${item.notes || ''}`,
                                  })
                                }
                                className="inline-flex items-center gap-1"
                              >
                                <ReceiptIcon className="size-3.5" />
                                <span>Voucher</span>
                              </Button>
                            ) : (
                              isManagerOrAdmin && (
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={() => handleQuickPayLabour(item.id)}
                                  className="inline-flex items-center gap-1"
                                >
                                  <CheckIcon className="size-3.5" />
                                  <span>Pay Now</span>
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                        No labour payouts found matching your filter criteria.
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
      {/* TAB 3: AGENCY / CONTRACTOR BILLS (SIMPLE & CLEAR, NO CARDS)           */}
      {/* ===================================================================== */}
      {mainTab === 'agencies' && (
        <div className="space-y-4">
          {/* Clean Top Toolbar with Inline Numbers Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <SearchIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search agency, invoice..."
                  value={agencySearch}
                  onChange={(e) => setAgencySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>

              <select
                value={agencyProjectFilter}
                onChange={(e) => setAgencyProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="all">All Sites</option>
                {schedules.map((s) => (
                  <option key={s.projectId} value={s.projectId}>
                    {s.projectName}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {['all', 'paid', 'partially_paid', 'pending'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAgencyStatusFilter(st)}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors cursor-pointer',
                      agencyStatusFilter === st
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Numbers Strip (Replaces Bulky KPI Cards) */}
            <div className="flex items-center gap-3 text-xs divide-x divide-border">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Billed:</span>
                <span className="font-bold text-foreground font-mono">
                  {formatCurrency(agencyTotals.totalBilled)}
                </span>
              </div>
              <div className="pl-3 flex items-center gap-1.5">
                <span className="text-muted-foreground">Cleared:</span>
                <span className="font-bold text-success font-mono">
                  {formatCurrency(agencyTotals.totalCleared)}
                </span>
              </div>
              <div className="pl-3 flex items-center gap-1.5">
                <span className="text-muted-foreground">Due:</span>
                <span className="font-bold text-warning font-mono">
                  {formatCurrency(agencyTotals.totalDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Simple Clean Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Subcontractor Agency</th>
                    <th className="py-3 px-4">Project & Stage</th>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Total Bill</th>
                    <th className="py-3 px-4">Cleared</th>
                    <th className="py-3 px-4">Pending Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredAgencyPayouts.length > 0 ? (
                    filteredAgencyPayouts.map((item) => {
                      const isPaid = item.status === 'paid';
                      const isPartial = item.status === 'partially_paid';

                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-foreground">{item.agencyName}</span>
                              <span className="block text-[11px] text-muted-foreground font-medium">
                                {item.trade}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-foreground font-medium block truncate max-w-[180px]">
                              {item.projectName}
                            </span>
                            <span className="text-muted-foreground text-[11px] truncate block max-w-[180px]">
                              {item.workStage}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                            {item.invoiceNumber}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {formatCurrency(item.billAmount)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-success">
                            {formatCurrency(item.paidAmount)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-warning">
                            {formatCurrency(item.pendingBalance)}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid && <Badge variant="success">Paid</Badge>}
                            {isPartial && <Badge variant="info">Partially Paid</Badge>}
                            {!isPaid && !isPartial && <Badge variant="warning">Pending</Badge>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                setViewingReceipt({
                                  type: 'agency',
                                  title: `Subcontractor Settlement: ${item.agencyName}`,
                                  projectName: item.projectName,
                                  clientName: `${item.trade} Contractor`,
                                  amount: item.paidAmount,
                                  date: item.paymentDate || 'Pending Final',
                                  receiptNumber: item.invoiceNumber,
                                  mode: item.paymentMode,
                                  notes: `Total Bill: ${formatCurrency(item.billAmount)} | Balance Due: ${formatCurrency(item.pendingBalance)}. Stage: ${item.workStage}. ${item.notes || ''}`,
                                })
                              }
                              className="inline-flex items-center gap-1"
                            >
                              <FileTextIcon className="size-3.5" />
                              <span>Details</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                        No agency bills found matching your filter criteria.
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
      {/* MODAL 1: RECORD CLIENT PAYMENT                                        */}
      {/* ===================================================================== */}
      {isRecordPaymentOpen && (
        <Modal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          title={`Record Payment — ${recordTargetInstallment?.title}`}
        >
          <form onSubmit={handleRecordClientPayment} className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs flex items-center justify-between">
              <div>
                <p className="text-muted-foreground">Project Site</p>
                <p className="font-semibold text-foreground">{currentSchedule?.projectName}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Milestone Amount</p>
                <p className="font-mono font-bold text-foreground text-sm">
                  {formatCurrency(recordTargetInstallment?.amount)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Amount Received (₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentForm.paidDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Mode <span className="text-destructive">*</span>
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value="Bank Transfer (NEFT)">Bank Transfer (NEFT)</option>
                  <option value="Corporate RTGS">Corporate RTGS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Receipt / Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. REC-2026-089 or UTR-128912"
                value={paymentForm.receiptNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Notes / Reference
              </label>
              <textarea
                rows={2}
                placeholder="Optional payment notes..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs resize-none focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Confirm & Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SETUP PROJECT BUDGET & MILESTONES                            */}
      {/* ===================================================================== */}
      {isSetCostOpen && (
        <Modal
          isOpen={isSetCostOpen}
          onClose={() => setIsSetCostOpen(false)}
          title="Setup Project Budget & Milestones"
        >
          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Project Site <span className="text-destructive">*</span>
              </label>
              <select
                value={costForm.projectId}
                onChange={(e) => setCostForm({ ...costForm, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {schedules.map((s) => (
                  <option key={s.projectId} value={s.projectId}>
                    {s.projectName} ({s.clientName})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Contract Budget (₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                required
                min="10000"
                value={costForm.totalCost}
                onChange={(e) => setCostForm({ ...costForm, totalCost: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Booking Advance (%)
                </label>
                <select
                  value={costForm.advancePercentage}
                  onChange={(e) => setCostForm({ ...costForm, advancePercentage: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value={10}>10% Advance</option>
                  <option value={15}>15% Advance</option>
                  <option value={20}>20% Advance</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Number of Installments
                </label>
                <select
                  value={costForm.milestoneCount}
                  onChange={(e) => setCostForm({ ...costForm, milestoneCount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                >
                  <option value={3}>3 Installments</option>
                  <option value={4}>4 Installments</option>
                  <option value={5}>5 Installments</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsSetCostOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Generate Milestones
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: RECORD LABOUR PAYOUT                                         */}
      {/* ===================================================================== */}
      {isRecordLabourOpen && (
        <Modal
          isOpen={isRecordLabourOpen}
          onClose={() => setIsRecordLabourOpen(false)}
          title="Record Labour / Artisan Payout"
        >
          <form onSubmit={handleSaveLabourPayout} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Worker / Artisan Name <span className="text-destructive">*</span>
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
                  Units / Days
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

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Rate (₹)
                </label>
                <input
                  type="number"
                  value={labourForm.rate}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value) || 0;
                    const u = parseFloat(labourForm.units) || 0;
                    setLabourForm({ ...labourForm, rate: e.target.value, amount: Math.round(u * r) });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total (₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={labourForm.amount}
                  onChange={(e) => setLabourForm({ ...labourForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
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
                  <option value="UPI (PhonePe)">UPI (PhonePe / GPay)</option>
                  <option value="Direct Cash">Direct Cash</option>
                  <option value="Bank Transfer">Bank Transfer (IMPS)</option>
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
                  const ag = agencyList.find((a) => String(a.id) === e.target.value);
                  setAgencyForm({
                    ...agencyForm,
                    agencyId: e.target.value,
                    agencyName: ag?.name || agencyForm.agencyName,
                    trade: ag?.trade || agencyForm.trade,
                  });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                {agencyList.map((a) => (
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
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Bill Amount (₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={agencyForm.billAmount}
                  onChange={(e) => setAgencyForm({ ...agencyForm, billAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Amount Paying Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={agencyForm.paidAmount}
                  onChange={(e) => setAgencyForm({ ...agencyForm, paidAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
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
                  <span className="font-semibold text-foreground">{viewingReceipt.mode || 'Direct Settlement'}</span>
                </div>
              </div>

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
