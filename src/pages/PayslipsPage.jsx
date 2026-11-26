'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { numericOnChange } from '../utils/numberInput';
import { mockPayslips } from '../data/leaves';
import { mockUsers } from '../data/users';
import { cn } from '../lib/utils';
import { usePagination } from '../hooks/usePagination';
import PayrollRunView from '../components/domain/PayrollRunView';
import payrollService, {
  initialCycles,
  initialStructures,
  initialPayrollSettings,
} from '../services/payrollService';

// BefUI Components strictly conforming to design.md tokens
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Badge } from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import Select from '../components/ui/Select';
import Tabs from '../components/ui/Tabs';
import DataToolbar from '../components/ui/DataToolbar';
import StatCard from '../components/ui/StatCard';
import Table from '../components/ui/Table';

// BefUI SVG Icons strictly from '@/components/ui/icons'
import {
  ReceiptIcon,
  XCircleIcon,
  DownloadIcon,
  UploadIcon,
  SearchIcon,
  CheckCircleIcon,
  PlusIcon,
  ZapIcon,
  RefreshIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  IndianRupeeIcon,
  ClockIcon,
  XIcon,
  FileTextIcon,
  SettingsIcon,
  CheckIcon,
  Building2Icon,
  SaveIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  WalletIcon,
  EditIcon,
  MoreIcon,
} from '../components/ui/icons';
import MoneyInput from '../components/ui/MoneyInput';
import NumberInput from '../components/ui/NumberInput';
import StepperInput from '../components/ui/StepperInput';
import Input from '../components/ui/Input';

export function PayslipsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();
  const isAdminOrManager =
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === 'owner' ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === 'admin';

  // Sub-tabs: 'cycles' (Pay cycles) | 'structure' (Structure) | 'settings' (Settings)
  const [activeSubTab, setActiveSubTab] = useState('cycles');

  // Payroll Global Settings (loaded through payrollService; the service owns the local fallback)
  const [payrollSettings, setPayrollSettings] = useState(initialPayrollSettings);
  const toastRef = useRef(toast);

  // Normalize period string for robust comparison (e.g. 'November, 2026' vs 'November 2026')
  const normalizePeriod = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const payrollMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const payrollYears = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i);

  // State for Pay Cycles (with duplicate period prevention & deduplication)
  const [cycles, setCycles] = useState(initialCycles);

  // State for Salary Structures (migration of old headings is handled in payrollService)
  const [structures, setStructures] = useState(initialStructures);

  const refreshCycles = async () => {
    const rows = await payrollService.getCycles();
    setCycles(rows);
    return rows;
  };

  const refreshStructures = async () => {
    const rows = await payrollService.getStructures();
    setStructures(rows);
    return rows;
  };

  // Keep a locally persisted mutation visible even if a backend read is still stale.
  const upsertById = (rows, row) => {
    if (!row) return rows;
    const exists = rows.some((item) => String(item.id) === String(row.id));
    return exists
      ? rows.map((item) => (String(item.id) === String(row.id) ? row : item))
      : [row, ...rows];
  };

  const handleSavePayrollSettings = async (e) => {
    e.preventDefault();
    try {
      const saved = await payrollService.saveSettings(payrollSettings);
      if (saved) setPayrollSettings(saved);
      toast.success('Payroll settings saved successfully!');
    } catch (err) {
      toast.error(err?.message || 'Failed to save settings');
    }
  };

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cycleRows, structureRows, settings] = await Promise.all([
          payrollService.getCycles(),
          payrollService.getStructures(),
          payrollService.getSettings(),
        ]);
        if (!active) return;
        setCycles(cycleRows);
        setStructures(structureRows);
        setPayrollSettings(settings);
      } catch (err) {
        if (active) toastRef.current.error(err?.message || 'Failed to load payroll data');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Search & Filter in Pay Cycles
  const [searchMonth, setSearchMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Generate Run Modal State (Screenshot 2)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState('November, 2026');
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
  const [periodPickerView, setPeriodPickerView] = useState('months');
  const [pickerYear, setPickerYear] = useState(() => Number(generatePeriod.match(/\d{4}/)?.[0]) || new Date().getFullYear());
  const periodPickerRef = useRef(null);

  useEffect(() => {
    if (!isPeriodPickerOpen) return;
    const handleOutsideClick = (event) => {
      if (periodPickerRef.current && !periodPickerRef.current.contains(event.target)) {
        setIsPeriodPickerOpen(false);
        setPeriodPickerView('months');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPeriodPickerOpen]);

  // New Structure / Template Modal State (Screenshot 3 & 4)
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    note: '',
    payModel: 'Monthly Salary',
    ctc: '',
    basic: '',
    hra: '',
    conveyance: '',
    specialAllowance: '',
    overtimeRate: '',
    pfEnabled: true,
    pfRate: 12,
    esicEnabled: true,
    esicRate: 0.5,
    esicThreshold: 21000,
    ptEnabled: true,
    ptAmount: 200,
    tdsAmount: 0,
    lwfEnabled: false,
  });

  // Cycle Details Modal (Staff Salary Slips breakdown)
  const [viewingCycle, setViewingCycle] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [selectedStaffSlip, setSelectedStaffSlip] = useState(null);

  // Shared delete confirmation target
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Cycle breakdown row-action state
  const [openMenuEmpId, setOpenMenuEmpId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const rowActionMenuRef = useRef(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [holdingEmployee, setHoldingEmployee] = useState(null);
  const [adjustingEmployee, setAdjustingEmployee] = useState(null);
  const [removingEmployee, setRemovingEmployee] = useState(null);

  const openEditEmployee   = (emp) => setEditingEmployee(emp);
  const openHoldEmployee   = (emp) => setHoldingEmployee(emp);
  const openAdjustEmployee = (emp) => setAdjustingEmployee(emp);

  // 4 Metric Card Stats (Matching Screenshot 1)
  const stats = useMemo(() => {
    const totalCycles = cycles.length;
    const inProgress = cycles.filter((c) => c.status === 'Calculated' || c.status === 'Draft').length;
    const paidCount = cycles.filter((c) => c.status === 'Paid').length;
    const netPayout = cycles.reduce((sum, c) => sum + (c.netPay || 0), 0);
    return { totalCycles, inProgress, paidCount, netPayout };
  }, [cycles]);

  // Filtered Cycles
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      if (statusFilter !== 'ALL' && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (searchMonth.trim()) {
        const q = searchMonth.toLowerCase();
        if (!c.period.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cycles, statusFilter, searchMonth]);

  const cyclePager = usePagination(filteredCycles);
  const structurePager = usePagination(structures);

  useEffect(() => {
    if (!openMenuEmpId) return undefined;
    const handleOutsideClick = (event) => {
      if (rowActionMenuRef.current && !rowActionMenuRef.current.contains(event.target)) {
        setOpenMenuEmpId(null);
      }
    };
    const close = () => setOpenMenuEmpId(null);
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenuEmpId]);

  // Check if the selected period has already been generated
  const isPeriodAlreadyGenerated = useMemo(() => {
    const norm = normalizePeriod(generatePeriod);
    return cycles.some((c) => normalizePeriod(c.period) === norm);
  }, [cycles, generatePeriod]);

  const selectedPeriodMonth = generatePeriod.split(',')[0].trim();
  const selectedPeriodYear = Number(generatePeriod.match(/\d{4}/)?.[0]);

  const togglePeriodPicker = () => {
    if (!isPeriodPickerOpen) {
      if (selectedPeriodYear) setPickerYear(selectedPeriodYear);
      setPeriodPickerView('months');
    }
    setIsPeriodPickerOpen((open) => !open);
  };

  const handlePickYear = (year) => {
    setPickerYear(year);
    setPeriodPickerView('months');
  };

  const handlePickMonth = (month) => {
    setGeneratePeriod(`${month}, ${pickerYear}`);
    setIsPeriodPickerOpen(false);
    setPeriodPickerView('months');
  };

  // Generate Run Handler (Screenshot 2 with duplicate prevention)
  const handleGenerateRun = async (e) => {
    e.preventDefault();

    if (isPeriodAlreadyGenerated) {
      toast.error(`Payroll run for ${generatePeriod} has already been generated!`);
      return;
    }

    try {
      const created = await payrollService.createCycle({ period: generatePeriod });
      if (!created) throw new Error('Failed to create payroll run');
      const rows = await refreshCycles();
      setCycles(upsertById(rows, created));
      toast.success(`Draft run created for ${created.period}. Open it, check the employees, then Calculate.`);
      setIsGenerateModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to create payroll run');
    }
  };

  /** Calculate or approve from the list; everything else happens inside the run. */
  const handleRunAction = async (cycleId, action, done) => {
    try {
      await payrollService.runAction(cycleId, action);
      await refreshCycles();
      toast.success(done);
    } catch (err) {
      toast.error(err?.message || 'That action could not be done');
    }
  };

  // Delete a cycle
  const handleDeleteCycle = (cycleId) => setDeleteTarget({ type: 'cycle', id: cycleId });

  // Delete a salary structure template
  const handleDeleteStructure = (structureId) =>
    setDeleteTarget({ type: 'structure', id: structureId });

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      if (target.type === 'cycle') {
        const removed = await payrollService.deleteCycle(target.id);
        if (!removed) throw new Error('Failed to delete payroll run');
        const rows = await refreshCycles();
        setCycles(rows.filter((row) => String(row.id) !== String(target.id)));
        if (viewingCycle && String(viewingCycle.id) === String(target.id)) {
          setViewingCycle(null);
          setSelectedEmployee(null);
          setShowPayslip(false);
          setSelectedStaffSlip(null);
        }
        toast.success('Payroll run removed');
      } else {
        const removed = await payrollService.deleteStructure(target.id);
        if (!removed) throw new Error('Failed to delete salary structure template');
        const rows = await refreshStructures();
        setStructures(rows.filter((row) => String(row.id) !== String(target.id)));
        toast.success('Salary structure template removed');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to delete record');
    }
    setDeleteTarget(null);
  };

  // Create Salary Structure Template (Screenshot 3 & 4)
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name.trim()) {
      toast.error('Please enter a structure template name');
      return;
    }
    const ctc = parseFloat(templateForm.ctc) || 0;
    const basic = templateForm.basic || Math.round(ctc * 0.5);
    const hra = templateForm.hra || Math.round(basic * 0.4);
    const conveyance = templateForm.conveyance || Math.round(ctc * 0.1);
    const specialAllowance = templateForm.specialAllowance || Math.max(0, ctc - basic - hra - conveyance);

    const newStruct = {
      id: `str-${Date.now()}`,
      name: templateForm.name.trim(),
      note: templateForm.note.trim() || 'Custom salary structure',
      payModel: templateForm.payModel,
      ctc,
      basic,
      hra,
      conveyance,
      specialAllowance,
      overtimeRate: parseFloat(templateForm.overtimeRate) || 0,
      pfEnabled: templateForm.pfEnabled,
      pfRate: templateForm.pfRate,
      esicEnabled: templateForm.esicEnabled,
      esicRate: templateForm.esicRate,
      esicThreshold: templateForm.esicThreshold,
      ptEnabled: templateForm.ptEnabled,
      ptAmount: templateForm.ptAmount,
      tdsAmount: parseFloat(templateForm.tdsAmount) || 0,
      lwfEnabled: templateForm.lwfEnabled,
    };

    try {
      const created = await payrollService.createStructure(newStruct);
      if (!created) throw new Error('Failed to create salary structure');
      const rows = await refreshStructures();
      setStructures(upsertById(rows, created));
      toast.success(`Salary structure "${newStruct.name}" created!`);
      setIsNewTemplateOpen(false);
      setTemplateForm({
        name: '',
        note: '',
        payModel: 'Monthly Salary',
        ctc: '',
        basic: '',
        hra: '',
        conveyance: '',
        specialAllowance: '',
        overtimeRate: '',
        pfEnabled: true,
        pfRate: 12,
        esicEnabled: true,
        esicRate: 0.5,
        esicThreshold: 21000,
        ptEnabled: true,
        ptAmount: 200,
        tdsAmount: 0,
        lwfEnabled: false,
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to create salary structure');
    }
  };

  // ===========================================================================
  // IN-PAGE VIEW: ONE PAYROLL RUN
  // ===========================================================================
  if (viewingCycle) {
    return (
      <PayrollRunView
        cycle={viewingCycle}
        company={payrollSettings}
        onBack={() => {
          setViewingCycle(null);
          refreshCycles().catch(() => {});
        }}
        onChanged={setViewingCycle}
      />
    );
  }

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-200">
      <Tabs
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        tabs={[
          { id: 'cycles', label: 'Pay cycles' },
          { id: 'structure', label: 'Structure' },
          { id: 'settings', label: 'Settings' },
        ]}
      />

      {/* ===================================================================== */}
      {/* SUB-TAB 1: PAY CYCLES (Screenshot 1)                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'cycles' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Salary structures, pay cycles and payouts</p>
            </div>
            {isAdminOrManager && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={() => setIsGenerateModalOpen(true)}
              >
                Generate
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard variant="inline" label="Total Pay Cycles" value={stats.totalCycles} icon={<FileTextIcon className="size-5" />} />
            <StatCard variant="inline" label="In Progress" value={stats.inProgress} tone="warning" icon={<ClockIcon className="size-5" />} />
            <StatCard variant="inline" label="Paid" value={stats.paidCount} tone="success" icon={<CheckCircleIcon className="size-5" />} />
            <StatCard variant="inline" label="Net Payout" value={formatCurrency(stats.netPayout)} tone="primary" icon={<IndianRupeeIcon className="size-5" />} />
          </div>

          <DataToolbar
            variant="clean"
            layout="inline"
            searchValue={searchMonth}
            onSearchChange={setSearchMonth}
            searchPlaceholder="Search by month..."
            filters={
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder=""
                className="h-9 w-36 text-xs"
                options={[
                  { value: 'ALL', label: 'All Status' },
                  { value: 'Calculated', label: 'Calculated' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Paid', label: 'Paid' },
                ]}
              />
            }
          />

          <Table
            variant="clean"
            columns={[
              {
                key: 'period',
                header: 'Period',
                width: '22%',
                render: (cycle) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(null);
                      setShowPayslip(false);
                      setSelectedStaffSlip(null);
                      setViewingCycle(cycle);
                    }}
                    className="text-left group cursor-pointer"
                  >
                    <span className="font-semibold text-foreground block group-hover:text-primary transition-colors">
                      {cycle.period}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{cycle.createdDate}</span>
                  </button>
                ),
              },
              {
                key: 'employeesCount',
                header: 'Employees',
                align: 'center',
                width: '11%',
                render: (cycle) => (
                  <span className="size-7 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center text-xs mx-auto">
                    {cycle.employeesCount}
                  </span>
                ),
              },
              {
                key: 'gross',
                header: 'Gross',
                align: 'right',
                width: '16%',
                render: (cycle) => (
                  <span className="font-mono font-medium text-foreground">{formatCurrency(cycle.gross)}</span>
                ),
              },
              {
                key: 'deductions',
                header: 'Deductions',
                align: 'right',
                width: '16%',
                render: (cycle) => (
                  <span className="font-mono text-destructive">{formatCurrency(cycle.deductions)}</span>
                ),
              },
              {
                key: 'netPay',
                header: 'Net Pay',
                align: 'right',
                width: '16%',
                render: (cycle) => (
                  <span className="font-mono font-bold text-success">{formatCurrency(cycle.netPay)}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                align: 'center',
                width: '10%',
                render: (cycle) => (
                  <Badge
                    variant={
                      cycle.status === 'Calculated'
                        ? 'warning'
                        : cycle.status === 'Draft'
                        ? 'neutral'
                        : cycle.status === 'Approved'
                        ? 'info'
                        : 'success'
                    }
                  >
                    {cycle.status}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                width: '9%',
                render: (cycle) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setShowPayslip(false);
                        setSelectedStaffSlip(null);
                        setViewingCycle(cycle);
                      }}
                      className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="View details"
                    >
                      <EyeIcon className="size-3.5" />
                    </button>
                    {isAdminOrManager && (cycle.status === 'Draft' || cycle.status === 'Calculated') && (
                      <button
                        type="button"
                        onClick={() => handleRunAction(cycle.id, 'calculate', 'Payroll run calculated')}
                        className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title={cycle.status === 'Draft' ? 'Calculate' : 'Recalculate'}
                      >
                        <ZapIcon className="size-3.5" />
                      </button>
                    )}
                    {isAdminOrManager && cycle.status === 'Calculated' && (
                      <button
                        type="button"
                        onClick={() => handleRunAction(cycle.id, 'approve', 'Payroll run approved. Payslips are now visible to staff.')}
                        className="size-7 rounded-lg flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircleIcon className="size-3.5" />
                      </button>
                    )}
                    {isAdminOrManager && cycle.status !== 'Paid' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCycle(cycle.id)}
                        className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={cyclePager.paginatedItems}
            pagination={cyclePager.pagination}
            keyField="id"
            emptyTitle="No pay cycles found"
            emptyDescription="Generate a pay cycle to get started."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: STRUCTURE (Salary Structure Templates)                     */}
      {/* ===================================================================== */}
      {activeSubTab === 'structure' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Salary Structures</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define earnings packages, daily rate models, and statutory deduction templates
              </p>
            </div>
            {isAdminOrManager && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewTemplateOpen(true)}
                className="flex items-center gap-1.5 shadow-2xs self-start sm:self-auto font-semibold"
              >
                <PlusIcon className="size-4" />
                <span>New template</span>
              </Button>
            )}
          </div>

          <Table
            variant="clean"
            columns={[
              {
                key: 'name',
                header: 'Template',
                render: (str) => (
                  <div>
                    <div className="font-semibold text-foreground">
                      {(str.name || '').replace(/,\s*[\d,]+$/, '')}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{str.payModel}</div>
                  </div>
                ),
              },
              {
                key: 'ctc',
                header: 'CTC',
                render: (str) => (
                  <span className="font-mono font-semibold text-foreground">{formatCurrency(str.ctc)}</span>
                ),
              },
              {
                key: 'basic',
                header: 'Basic Pay',
                render: (str) => (
                  <span className="font-mono text-foreground">{formatCurrency(str.basic)}</span>
                ),
              },
              {
                key: 'hra',
                header: 'HRA',
                render: (str) => (
                  <span className="font-mono text-foreground">{formatCurrency(str.hra)}</span>
                ),
              },
              {
                key: 'conveyance',
                header: 'Conveyance',
                render: (str) => (
                  <span className="font-mono text-foreground">{formatCurrency(str.conveyance)}</span>
                ),
              },
              {
                key: 'specialAllowance',
                header: 'Special Allowance',
                render: (str) => (
                  <span className="font-mono text-foreground">{formatCurrency(str.specialAllowance)}</span>
                ),
              },
              {
                key: 'statutory',
                header: 'Statutory',
                render: (str) => (
                  <div className="flex items-center gap-1 flex-wrap">
                    {str.pfEnabled && <Badge variant="neutral" size="sm">PF</Badge>}
                    {str.esicEnabled && <Badge variant="neutral" size="sm">ESIC</Badge>}
                    {str.ptEnabled && <Badge variant="neutral" size="sm">PT</Badge>}
                    {!str.pfEnabled && !str.esicEnabled && !str.ptEnabled && (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (str) =>
                  isAdminOrManager ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteStructure(str.id)}
                      className="size-7 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Delete template"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  ) : null,
              },
            ]}
            data={structurePager.paginatedItems}
            pagination={structurePager.pagination}
            keyField="id"
            emptyTitle="No salary structures"
            emptyDescription="Create a template to define earnings and deductions."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: SETTINGS (Policy & Rules)                                 */}
      {/* ===================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="space-y-5 w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Salary structures, pay cycles and payouts
            </p>
          </div>

          <form onSubmit={handleSavePayrollSettings} className="w-full rounded-xl border border-border bg-card p-6 shadow-2xs space-y-6">
            {/* 1. Company Section (Screenshot 1) */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2Icon className="size-4 text-foreground" />
                  <h3 className="text-sm font-bold text-foreground">Company</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown on payslips and payment records
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    COMPANY NAME
                  </label>
                  <Input
                    type="text"
                    required
                    value={payrollSettings.companyName}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, companyName: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    COMPANY ADDRESS
                  </label>
                  <Input
                    type="text"
                    required
                    value={payrollSettings.companyAddress}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, companyAddress: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF NUMBER
                  </label>
                  <Input
                    type="text"
                    value={payrollSettings.pfNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfNumber: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC NUMBER
                  </label>
                  <Input
                    type="text"
                    value={payrollSettings.esicNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicNumber: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PAN NUMBER
                  </label>
                  <Input
                    type="text"
                    value={payrollSettings.panNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, panNumber: e.target.value })}
                    className="w-full font-mono"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* 2. Default Deductions Section (Screenshot 1) */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Default Deductions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Used when creating new salary structures
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF %
                  </label>
                  <NumberInput
                   
                    value={payrollSettings.pfPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC %
                  </label>
                  <NumberInput
                   
                    step="0.01"
                    value={payrollSettings.esicPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC CAP (₹)
                  </label>
                  <MoneyInput
                   
                    value={payrollSettings.esicCap}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicCap: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PT (₹)
                  </label>
                  <MoneyInput
                   
                    value={payrollSettings.ptAmount}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, ptAmount: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    DEFAULT TDS (₹)
                  </label>
                  <MoneyInput
                   
                    value={payrollSettings.defaultTds}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, defaultTds: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* 3. Calculation Rules Section (Screenshot 2) */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Calculation Rules</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How a monthly salary is worked out from CTC. Applies the next time a run is calculated.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PAY DAYS IN A MONTH
                  </label>
                  <StepperInput
                   
                    value={payrollSettings.payDaysInMonth}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, payDaysInMonth: numericOnChange(e.target.value, parseFloat) })}
                   
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    BASIC % OF RATE
                  </label>
                  <NumberInput
                   
                    value={payrollSettings.basicPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, basicPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    HRA % OF BASIC
                  </label>
                  <NumberInput
                   
                    value={payrollSettings.hraPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, hraPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    CONVEYANCE % OF BASIC
                  </label>
                  <NumberInput
                   
                    value={payrollSettings.conveyancePercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, conveyancePercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF EMPLOYER %
                  </label>
                  <NumberInput
                   
                    step="0.01"
                    value={payrollSettings.pfEmployerPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfEmployerPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC EMPLOYER %
                  </label>
                  <NumberInput
                   
                    step="0.01"
                    value={payrollSettings.esicEmployerPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicEmployerPercent: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF WAGE CAP (₹)
                  </label>
                  <MoneyInput
                   
                    value={payrollSettings.pfWageCap}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfWageCap: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC WAGES
                  </label>
                  <Input
                    type="text"
                    value={payrollSettings.esicWages}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicWages: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Action Footer with Save Button (Screenshot 2) */}
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex items-center gap-2 shadow-2xs font-semibold px-5"
              >
                <SaveIcon className="size-4" />
                <span>Save Settings</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: GENERATE PAYROLL RUN (Screenshot 2)                            */}
      {/* ===================================================================== */}
      {isGenerateModalOpen && (
        <Modal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          title="Generate Payroll Run"
          size="sm"
        >
          <form onSubmit={handleGenerateRun} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pay Period
              </label>
              <div className="relative" ref={periodPickerRef}>
                <button
                  type="button"
                  onClick={togglePeriodPicker}
                  aria-haspopup="dialog"
                  aria-expanded={isPeriodPickerOpen}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg bg-background text-foreground text-xs font-medium focus:ring-1 focus:outline-none cursor-pointer text-left",
                    isPeriodAlreadyGenerated
                      ? "border-destructive focus:ring-destructive"
                      : "border-border focus:ring-primary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{generatePeriod}</span>
                  </span>
                  <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isPeriodPickerOpen && "rotate-180")} />
                </button>

                {isPeriodPickerOpen && (
                  <div className="mt-2 p-3 rounded-lg border border-border bg-popover shadow-lg animate-in fade-in duration-150">
                    {periodPickerView === 'months' ? (
                      <>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <button
                            type="button"
                            onClick={() => setPickerYear((year) => year - 1)}
                            aria-label="Previous year"
                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <ChevronLeftIcon className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPeriodPickerView('years')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                            title="Select year"
                          >
                            <span>{pickerYear}</span>
                            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPickerYear((year) => year + 1)}
                            aria-label="Next year"
                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <ChevronRightIcon className="size-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {payrollMonths.map((month) => {
                            const isSelected = month === selectedPeriodMonth && pickerYear === selectedPeriodYear;
                            const exists = cycles.some((c) => normalizePeriod(c.period) === normalizePeriod(`${month}, ${pickerYear}`));
                            return (
                              <button
                                key={month}
                                type="button"
                                onClick={() => handlePickMonth(month)}
                                className={cn(
                                  "relative px-1 py-2 rounded-md text-[11px] font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary",
                                  isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                                  exists && !isSelected && "text-destructive"
                                )}
                                title={exists ? `${month}, ${pickerYear} (Already generated)` : `${month}, ${pickerYear}`}
                              >
                                {month.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-xs font-bold text-foreground">Select Year</span>
                          <button
                            type="button"
                            onClick={() => setPeriodPickerView('months')}
                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label="Back to months"
                          >
                            <XIcon className="size-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {payrollYears.map((year) => (
                            <button
                              key={year}
                              type="button"
                              onClick={() => handlePickYear(year)}
                              className={cn(
                                "px-1 py-2 rounded-md text-[11px] font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary",
                                year === pickerYear && "bg-primary text-primary-foreground hover:bg-primary"
                              )}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error Message when period is already generated */}
            {isPeriodAlreadyGenerated ? (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1 animate-in fade-in duration-200">
                <div className="font-semibold flex items-center gap-1.5">
                  <XCircleIcon className="size-4 shrink-0 text-destructive" />
                  <span>Payroll run already generated</span>
                </div>
                <p className="text-[11px] text-destructive/90 leading-normal">
                  A payroll plan for <strong>{generatePeriod}</strong> has already been generated. You cannot create a duplicate run for the same month.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Creates a draft run listing every staff member who has a salary. Open it and click Calculate to work out pay from attendance, leave and salary advances.
              </p>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant={isPeriodAlreadyGenerated ? "outline" : "primary"}
                size="md"
                disabled={isPeriodAlreadyGenerated}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold shadow-xs",
                  isPeriodAlreadyGenerated && "opacity-60 cursor-not-allowed text-destructive border-destructive/30 hover:bg-transparent"
                )}
              >
                {isPeriodAlreadyGenerated ? (
                  <>
                    <XCircleIcon className="size-3.5" />
                    <span>Payroll Already Generated</span>
                  </>
                ) : (
                  <>
                    <ZapIcon className="size-3.5" />
                    <span>Generate Run</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NEW TEMPLATE / STRUCTURE (Screenshot 3 & 4)                    */}
      {/* ===================================================================== */}
      {isNewTemplateOpen && (
        <Modal
          isOpen={isNewTemplateOpen}
          onClose={() => setIsNewTemplateOpen(false)}
          title="New template"
          size="lg"
        >
          <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  type="text"
                  required
                  
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Note (Optional)
                </label>
                <Input
                  type="text"
                  
                  value={templateForm.note}
                  onChange={(e) => setTemplateForm({ ...templateForm, note: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Pay Model Segmented Switch */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Pay Model
              </label>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border w-fit">
                {['Monthly Salary', 'Shift / Daily'].map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setTemplateForm({ ...templateForm, payModel: pm })}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                      templateForm.payModel === pm
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            {/* CTC */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                CTC (Per Month)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                <MoneyInput
                 
                  required
                  min="1000"
                  
                  value={templateForm.ctc}
                  onChange={(e) => {
                    const ctcVal = numericOnChange(e.target.value, parseFloat);
                    setTemplateForm({
                      ...templateForm,
                      ctc: e.target.value,
                      basic: ctcVal === '' ? '' : Math.round(ctcVal * 0.5),
                      hra: ctcVal === '' ? '' : Math.round(ctcVal * 0.2),
                      conveyance: ctcVal === '' ? '' : Math.round(ctcVal * 0.1),
                      specialAllowance: ctcVal === '' ? '' : Math.round(ctcVal * 0.2),
                    });
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Monthly Earnings breakdown */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Monthly Earnings
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Leave all four at 0 and they are worked out from the CTC using the payroll rules. Type amounts to set them by hand.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Basic</label>
                  <MoneyInput
                   
                    value={templateForm.basic}
                    onChange={(e) => setTemplateForm({ ...templateForm, basic: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">HRA</label>
                  <MoneyInput
                   
                    value={templateForm.hra}
                    onChange={(e) => setTemplateForm({ ...templateForm, hra: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Conveyance</label>
                  <MoneyInput
                   
                    value={templateForm.conveyance}
                    onChange={(e) => setTemplateForm({ ...templateForm, conveyance: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Special Allowance</label>
                  <MoneyInput
                   
                    value={templateForm.specialAllowance}
                    onChange={(e) => setTemplateForm({ ...templateForm, specialAllowance: numericOnChange(e.target.value, parseFloat) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Overtime Rate */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Overtime Rate / HR
              </label>
              <MoneyInput
               
                min="0"
                value={templateForm.overtimeRate}
                onChange={(e) => setTemplateForm({ ...templateForm, overtimeRate: numericOnChange(e.target.value, parseFloat) })}
                className="w-full"
              />
            </div>

            {/* Deductions (Screenshot 4) */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Deductions
              </label>

              {/* PF */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, pfEnabled: !templateForm.pfEnabled })}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors',
                    templateForm.pfEnabled
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <CheckIcon className="size-3" />
                  <span>Provident Fund (PF)</span>
                </button>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">%</span>
                  <NumberInput
                   
                    value={templateForm.pfRate}
                    onChange={(e) => setTemplateForm({ ...templateForm, pfRate: numericOnChange(e.target.value, parseFloat) })}
                    className="w-24"
                  />
                </div>
              </div>

              {/* ESIC */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, esicEnabled: !templateForm.esicEnabled })}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors',
                    templateForm.esicEnabled
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <CheckIcon className="size-3" />
                  <span>ESIC</span>
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">%</span>
                  <NumberInput
                   
                    value={templateForm.esicRate}
                    onChange={(e) => setTemplateForm({ ...templateForm, esicRate: numericOnChange(e.target.value, parseFloat) })}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">₹</span>
                  <MoneyInput
                   
                    value={templateForm.esicThreshold}
                    onChange={(e) => setTemplateForm({ ...templateForm, esicThreshold: numericOnChange(e.target.value, parseFloat) })}
                    className="w-28"
                  />
                </div>
              </div>

              {/* PT */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, ptEnabled: !templateForm.ptEnabled })}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors',
                    templateForm.ptEnabled
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <CheckIcon className="size-3" />
                  <span>Professional Tax (PT)</span>
                </button>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">₹</span>
                  <MoneyInput
                   
                    value={templateForm.ptAmount}
                    onChange={(e) => setTemplateForm({ ...templateForm, ptAmount: numericOnChange(e.target.value, parseFloat) })}
                    className="w-24"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewTemplateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create template
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Confirm delete"
        message={`Are you sure you want to delete this ${
          deleteTarget?.type === 'cycle' ? 'payroll cycle run' : 'salary structure template'
        }? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

export default PayslipsPage;
