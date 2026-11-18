'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { mockPayslips } from '../data/leaves';
import { mockUsers } from '../data/users';
import { cn } from '../lib/utils';
import { usePagination } from '../hooks/usePagination';
import payrollService, {
  initialCycles,
  initialStructures,
  initialPayrollSettings,
} from '../services/payrollService';

// BefUI Components strictly conforming to design.md tokens
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
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
    basic: 0,
    hra: 0,
    conveyance: 0,
    specialAllowance: 0,
    overtimeRate: 0,
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

  // Cycle breakdown row-action state
  const [openMenuEmpId, setOpenMenuEmpId] = useState(null);
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

  // ---------------------------------------------------------------------------
  // EXACT SALARY CALCULATION FORMULA (Specified by user)
  // Daily rate = monthly salary / days in the month.
  // Pay = daily rate x (total days - unworked Sundays - unpaid leave days) + (1 paid leave encashed if unused) + (Sunday work)
  // ---------------------------------------------------------------------------
  const calculateCycleForMonth = (cycle) => {
    const daysInMonth = cycle.totalDays || 30;
    const sundays = cycle.sundaysCount || 4;

    // Active employees to calculate
    const staffList = mockPayslips.slice(0, cycle.employeesCount || 5).map((ps, idx) => {
      const monthlySalary = ps.basicPay + ps.hra + ps.specialAllowance + (ps.siteExecutionBonus || 0);
      const dailyRate = Math.round((monthlySalary / daysInMonth) * 100) / 100;

      // Sundays are weekly off (unpaid by default unless worked)
      const unworkedSundays = sundays;
      const sundayWorkDays = idx === 1 ? 1 : 0; // manager assigned Sunday work if any

      // 1 paid leave rule: covered if taken, encashed as cash if not taken
      const leavesTaken = ps.unpaidLeaves || 0;
      const unpaidLeaveDays = Math.max(0, leavesTaken - 1);
      const unusedPaidLeaveEncashed = leavesTaken === 0 ? 1 : 0; // encashed 1 day if 0 leaves taken

      const payableDays = daysInMonth - unworkedSundays - unpaidLeaveDays + sundayWorkDays;
      const basePay = Math.round(dailyRate * payableDays * 100) / 100;
      const leaveEncashment = Math.round(unusedPaidLeaveEncashed * dailyRate * 100) / 100;
      const gross = Math.round((basePay + leaveEncashment) * 100) / 100;

      const pf = Math.round((gross * 0.12) > 1800 ? 1800 : (gross * 0.12));
      const pt = 200;
      const tds = ps.tdsTax || 0;
      const deductions = pf + pt + tds;
      const netPay = Math.round((gross - deductions) * 100) / 100;

      return {
        ...ps,
        monthlySalary,
        daysInMonth,
        dailyRate,
        payableDays,
        unworkedSundays,
        sundayWorkDays,
        leavesTaken,
        unpaidLeaveDays,
        unusedPaidLeaveEncashed,
        leaveEncashment,
        calculatedGross: gross,
        calculatedDeductions: deductions,
        calculatedNetPay: netPay,
      };
    });

    const totalGross = staffList.reduce((sum, s) => sum + s.calculatedGross, 0);
    const totalDeductions = staffList.reduce((sum, s) => sum + s.calculatedDeductions, 0);
    const totalNet = staffList.reduce((sum, s) => sum + s.calculatedNetPay, 0);

    return {
      staffList,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
    };
  };

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

    const periodName = generatePeriod.replace(',', '');
    const is31 = periodName.includes('October') || periodName.includes('December') || periodName.includes('January');
    const totalDays = is31 ? 31 : 30;

    const newCycle = {
      id: `cycle-${Date.now()}`,
      period: generatePeriod,
      createdDate: new Date().toLocaleDateString('en-GB'),
      monthKey: new Date().toISOString().slice(0, 7),
      totalDays,
      sundaysCount: 4,
      employeesCount: 5,
      gross: 0,
      deductions: 0,
      netPay: 0,
      status: 'Draft',
    };

    try {
      const created = await payrollService.createCycle(newCycle);
      if (!created) throw new Error('Failed to create payroll run');
      const rows = await refreshCycles();
      setCycles(upsertById(rows, created));
      toast.success(`Created draft payroll run for ${generatePeriod}! Click Calculate  to process.`);
      setIsGenerateModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Failed to create payroll run');
    }
  };

  // Run calculation on a cycle
  const handleExecuteCalculation = async (cycleId) => {
    const cycle = cycles.find((c) => String(c.id) === String(cycleId));
    if (!cycle) return;
    const res = calculateCycleForMonth(cycle);

    try {
      const updated = await payrollService.calculateCycle(cycleId, {
        gross: res.totalGross,
        deductions: res.totalDeductions,
        netPay: res.totalNet,
      });
      if (!updated) throw new Error('Failed to calculate pay cycle');

      const rows = await refreshCycles();
      const merged = upsertById(rows, updated);
      setCycles(merged);
      const fresh = merged.find((row) => String(row.id) === String(cycleId));
      setViewingCycle((prev) =>
        prev && String(prev.id) === String(cycleId) ? fresh || updated : prev
      );
      toast.success('Pay cycle calculated using daily rate & attendance rules!');
    } catch (err) {
      toast.error(err?.message || 'Failed to calculate pay cycle');
    }
  };

  // Approve a cycle
  const handleApproveCycle = async (cycleId) => {
    try {
      const updated = await payrollService.approveCycle(cycleId);
      if (!updated) throw new Error('Failed to approve pay cycle');

      const rows = await refreshCycles();
      const merged = upsertById(rows, updated);
      setCycles(merged);
      const fresh = merged.find((row) => String(row.id) === String(cycleId));
      setViewingCycle((prev) =>
        prev && String(prev.id) === String(cycleId) ? fresh || updated : prev
      );
      toast.success('Payroll run approved for disbursement!');
    } catch (err) {
      toast.error(err?.message || 'Failed to approve pay cycle');
    }
  };

  // Mark an approved cycle as paid
  const handlePayCycle = async (cycleId) => {
    try {
      const updated = await payrollService.payCycle(cycleId);
      if (!updated) throw new Error('Failed to mark payroll run as paid');

      const rows = await refreshCycles();
      const merged = upsertById(rows, updated);
      setCycles(merged);
      const fresh = merged.find((row) => String(row.id) === String(cycleId));
      setViewingCycle((prev) =>
        prev && String(prev.id) === String(cycleId) ? fresh || updated : prev
      );
      toast.success('Payroll run marked as paid!');
    } catch (err) {
      toast.error(err?.message || 'Failed to mark payroll run as paid');
    }
  };

  // Delete a cycle
  const handleDeleteCycle = async (cycleId) => {
    if (!window.confirm('Delete this payroll cycle run?')) return;
    try {
      const removed = await payrollService.deleteCycle(cycleId);
      if (!removed) throw new Error('Failed to delete payroll run');
      const rows = await refreshCycles();
      setCycles(rows.filter((row) => String(row.id) !== String(cycleId)));
      if (viewingCycle && String(viewingCycle.id) === String(cycleId)) {
        setViewingCycle(null);
        setSelectedEmployee(null);
        setShowPayslip(false);
        setSelectedStaffSlip(null);
      }
      toast.success('Payroll run removed');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete payroll run');
    }
  };

  // Delete a salary structure template
  const handleDeleteStructure = async (structureId) => {
    if (!window.confirm('Delete this salary structure template?')) return;
    try {
      const removed = await payrollService.deleteStructure(structureId);
      if (!removed) throw new Error('Failed to delete salary structure template');
      const rows = await refreshStructures();
      setStructures(rows.filter((row) => String(row.id) !== String(structureId)));
      toast.success('Salary structure template removed');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete salary structure template');
    }
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
        basic: 0,
        hra: 0,
        conveyance: 0,
        specialAllowance: 0,
        overtimeRate: 0,
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
  // IN-PAGE VIEW: PAYSLIP PREVIEW (print only this sheet)
  // ===========================================================================
  if (showPayslip && selectedStaffSlip) {
    const slip = selectedStaffSlip;
    const pt = 200;
    const tds = slip.tdsTax || 0;
    const pf = Math.max(0, Math.round(((slip.calculatedDeductions || 0) - pt - tds) * 100) / 100);
    const slipPeriod = viewingCycle?.period || slip.month || '';

    return (
      <div className="space-y-4 pb-16 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => { setShowPayslip(false); setSelectedStaffSlip(null); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="size-4" />
            Back to {slip.employeeName}
          </button>
          <Button variant="primary" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 font-semibold">
            <DownloadIcon className="size-4" />
            <span>Download / Print</span>
          </Button>
        </div>

        <div className="print-payslip mx-auto max-w-3xl rounded-xl border border-border bg-card shadow-2xs p-6 sm:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">{payrollSettings.companyName}</h2>
              <p className="text-[11px] text-muted-foreground">{payrollSettings.companyAddress}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">PF: {payrollSettings.pfNumber} - PAN: {payrollSettings.panNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payslip</span>
              <p className="text-xs font-semibold text-foreground">{slipPeriod}</p>
              <p className="text-[11px] text-muted-foreground">{viewingCycle?.status || slip.payoutStatus || 'Draft'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Employee</span>
              <span className="font-semibold text-foreground">{slip.employeeName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Role</span>
              <span className="font-semibold text-foreground">{slip.role}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Payable Days</span>
              <span className="font-semibold text-foreground">{slip.payableDays} / {slip.daysInMonth}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Payment Mode</span>
              <span className="font-semibold text-foreground">{slip.paymentMode || 'Bank Transfer'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Earnings</div>
              <div className="divide-y divide-border text-xs">
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Basic Pay</span><span className="font-mono text-foreground">{formatCurrency(slip.basicPay)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">HRA</span><span className="font-mono text-foreground">{formatCurrency(slip.hra)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Special Allowance</span><span className="font-mono text-foreground">{formatCurrency(slip.specialAllowance)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Site Execution Bonus</span><span className="font-mono text-foreground">{formatCurrency(slip.siteExecutionBonus || 0)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Leave Encashment</span><span className="font-mono text-success">{formatCurrency(slip.leaveEncashment)}</span></div>
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 font-semibold"><span className="text-foreground">Gross</span><span className="font-mono text-foreground">{formatCurrency(slip.calculatedGross)}</span></div>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deductions</div>
              <div className="divide-y divide-border text-xs">
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Provident Fund (12%)</span><span className="font-mono text-foreground">{formatCurrency(pf)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">Professional Tax</span><span className="font-mono text-foreground">{formatCurrency(pt)}</span></div>
                <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">TDS</span><span className="font-mono text-foreground">{formatCurrency(tds)}</span></div>
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 font-semibold"><span className="text-foreground">Total Deductions</span><span className="font-mono text-destructive">{formatCurrency(slip.calculatedDeductions)}</span></div>
              </div>

              <div className="px-3 py-3 bg-success/10 border-t border-border flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Net Pay</span>
                <span className="text-sm font-bold font-mono text-success">{formatCurrency(slip.calculatedNetPay)}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
            Daily Rate = CTC / {slip.daysInMonth} days - Sundays weekly off - 1 paid leave covered or encashed
          </p>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // IN-PAGE VIEW: EMPLOYEE SALARY BREAKDOWN
  // ===========================================================================
  if (selectedEmployee) {
    const emp = selectedEmployee;
    const pt = 200;
    const tds = emp.tdsTax || 0;
    const pf = Math.max(0, Math.round(((emp.calculatedDeductions || 0) - pt - tds) * 100) / 100);
    const basePay = Math.round(emp.dailyRate * emp.payableDays * 100) / 100;

    return (
      <div className="space-y-5 pb-16 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedEmployee(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="size-4" />
            Back to {viewingCycle?.period || 'pay cycles'}
          </button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setSelectedStaffSlip(emp); setShowPayslip(true); }}
            className="flex items-center gap-1.5 font-semibold"
          >
            <FileTextIcon className="size-4" />
            <span>View Payslip</span>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar name={emp.employeeName} size="lg" className="shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{emp.employeeName}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{emp.role}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Payroll period: {viewingCycle?.period}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={viewingCycle?.status === 'Paid' ? 'success' : viewingCycle?.status === 'Approved' ? 'info' : 'warning'}>
                {viewingCycle?.status}
              </Badge>
              <span className="text-[11px] text-muted-foreground">Employee ID: {emp.employeeId}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border-t border-border">
            <div className="relative bg-card p-4 pr-11">
              <span className="text-[11px] text-muted-foreground block">Monthly CTC</span>
              <span className="mt-1 block text-base font-bold font-mono text-foreground">{formatCurrency(emp.monthlySalary)}</span>
              <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-3.5">
                <IndianRupeeIcon />
              </div>
            </div>
            <div className="relative bg-card p-4 pr-11">
              <span className="text-[11px] text-muted-foreground block">Daily Rate</span>
              <span className="mt-1 block text-base font-bold font-mono text-foreground">{formatCurrency(emp.dailyRate)}</span>
              <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-info/10 text-info [&>svg]:size-3.5">
                <CalendarIcon />
              </div>
            </div>
            <div className="relative bg-card p-4 pr-11">
              <span className="text-[11px] text-muted-foreground block">Payable Days</span>
              <span className="mt-1 block text-base font-bold text-foreground">{emp.payableDays} <span className="text-[11px] font-medium text-muted-foreground">of {emp.daysInMonth}</span></span>
              <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-success/10 text-success [&>svg]:size-3.5">
                <CheckCircleIcon />
              </div>
            </div>
            <div className="relative bg-primary/5 p-4 pr-11">
              <span className="text-[11px] text-muted-foreground block">Net Pay</span>
              <span className="mt-1 block text-base font-bold font-mono text-success">{formatCurrency(emp.calculatedNetPay)}</span>
              <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-3.5">
                <ReceiptIcon />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
              <ClockIcon className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Attendance and Days</span>
            </div>
            <div className="divide-y divide-border text-xs">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Total days in month</span>
                <span className="font-semibold text-foreground">{emp.daysInMonth}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Sundays (weekly off)</span>
                <span className="font-semibold text-foreground">-{emp.unworkedSundays}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Sunday work</span>
                <span className="font-semibold text-success">+{emp.sundayWorkDays}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Leaves taken</span>
                <span className="font-semibold text-foreground">{emp.leavesTaken}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Unpaid leave days</span>
                <span className="font-semibold text-destructive">-{emp.unpaidLeaveDays}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                <span className="font-semibold text-foreground">Payable days</span>
                <span className="font-bold text-foreground">{emp.payableDays}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
              <IndianRupeeIcon className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Earnings and Deductions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border text-xs">
              <div>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/10">Earnings</div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Base pay (daily rate x payable days)</span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(basePay)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Paid leave encashment</span>
                    <span className="font-mono font-semibold text-success">{formatCurrency(emp.leaveEncashment)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                    <span className="font-semibold text-foreground">Gross earnings</span>
                    <span className="font-mono font-bold text-foreground">{formatCurrency(emp.calculatedGross)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/10">Deductions</div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Provident Fund (12% capped)</span>
                    <span className="font-mono font-semibold text-destructive">-{formatCurrency(pf)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Professional Tax</span>
                    <span className="font-mono font-semibold text-destructive">-{formatCurrency(pt)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">TDS</span>
                    <span className="font-mono font-semibold text-destructive">-{formatCurrency(tds)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                    <span className="font-semibold text-foreground">Total deductions</span>
                    <span className="font-mono font-bold text-destructive">{formatCurrency(emp.calculatedDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3.5 bg-success/10 border-t border-border">
              <span className="text-sm font-bold text-foreground">Net Pay</span>
              <span className="text-base font-bold font-mono text-success">{formatCurrency(emp.calculatedNetPay)}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Calculation: (Monthly CTC / {emp.daysInMonth} days) x payable days + paid leave encashment - statutory deductions. Sundays are weekly off.
        </p>
      </div>
    );
  }

  // ===========================================================================
  // IN-PAGE VIEW: PAY CYCLE BREAKDOWN (whole page)
  // ===========================================================================
  if (viewingCycle) {
    const calc = calculateCycleForMonth(viewingCycle);

    return (
      <div className="space-y-5 pb-16 animate-in fade-in duration-200">

        {/* ── Header Row: Title + Status + Action Buttons ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left: title + badge */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {viewingCycle.period}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => { setViewingCycle(null); setSelectedEmployee(null); setShowPayslip(false); setSelectedStaffSlip(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium"
              >
                ← Payroll run
              </button>
              <Badge
                variant={
                  viewingCycle.status === 'Calculated'
                    ? 'warning'
                    : viewingCycle.status === 'Draft'
                    ? 'neutral'
                    : viewingCycle.status === 'Approved'
                    ? 'info'
                    : 'success'
                }
              >
                {viewingCycle.status}
              </Badge>
            </div>
          </div>

          {/* Right: action buttons — no Register, no Reports */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toast.info('Sync employees coming soon')}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RefreshIcon className="size-3.5 text-muted-foreground" />
              Sync employees
            </button>
            <button
              type="button"
              onClick={() => handleExecuteCalculation(viewingCycle.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ZapIcon className="size-3.5 text-amber-500" />
              Recalculate
            </button>
            <button
              type="button"
              onClick={() => handleApproveCycle(viewingCycle.id)}
              disabled={viewingCycle.status === 'Approved' || viewingCycle.status === 'Paid'}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                viewingCycle.status === 'Approved' || viewingCycle.status === 'Paid'
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60 border border-border'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent'
              )}
            >
              <CheckCircleIcon className="size-3.5" />
              Approve Run
            </button>
            {viewingCycle.status === 'Approved' && (
              <button
                type="button"
                onClick={() => handlePayCycle(viewingCycle.id)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <WalletIcon className="size-3.5 text-success" />
                Mark Paid
              </button>
            )}
            <button
              type="button"
              onClick={() => handleExecuteCalculation(viewingCycle.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RefreshIcon className="size-3.5 text-muted-foreground" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => { handleDeleteCycle(viewingCycle.id); setViewingCycle(null); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <TrashIcon className="size-3.5" />
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard variant="inline" label="Employees" value={viewingCycle.employeesCount} icon={<FileTextIcon className="size-5" />} />
          <StatCard variant="inline" label="Gross" value={formatCurrency(calc.totalGross)} tone="primary" icon={<IndianRupeeIcon className="size-5" />} />
          <StatCard variant="inline" label="Deductions" value={formatCurrency(calc.totalDeductions)} tone="danger" icon={<XCircleIcon className="size-5" />} />
          <StatCard variant="inline" label="Net Pay" value={formatCurrency(calc.totalNet)} tone="success" icon={<IndianRupeeIcon className="size-5" />} />
        </div>

        {/* ── Employee Breakdown Table ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">Employee <span className="text-muted-foreground/60">↑</span></span>
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Attendance</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Gross</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Deductions</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">
                    <span className="inline-flex items-center gap-1">Net <span className="text-muted-foreground/60">↕</span></span>
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {calc.staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                      No employees in this payroll run. Click Recalculate to populate.
                    </td>
                  </tr>
                ) : (
                  calc.staffList.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      {/* Employee name + role */}
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-semibold text-foreground block leading-tight">{emp.employeeName}</span>
                        <span className="text-[11px] text-muted-foreground">{emp.role}</span>
                      </td>

                      {/* Type — purple text, no badge background */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Monthly</span>
                      </td>

                      {/* Attendance — P · H · LOP format */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-foreground font-mono">
                          P {emp.payableDays} · H {emp.unusedPaidLeaveEncashed} · LOP {emp.unpaidLeaveDays}
                        </span>
                        {emp.sundayWorkDays > 0 && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                            +{formatCurrency(emp.leaveEncashment)} OT
                          </span>
                        )}
                      </td>

                      {/* Gross */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-semibold font-mono text-foreground">{formatCurrency(emp.calculatedGross)}</span>
                      </td>

                      {/* Deductions */}
                      <td className="py-3.5 px-4 text-right">
                        <span className={cn(
                          'text-sm font-semibold font-mono',
                          emp.calculatedDeductions > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-muted-foreground'
                        )}>
                          {formatCurrency(emp.calculatedDeductions)}
                        </span>
                      </td>

                      {/* Net */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(emp.calculatedNetPay)}
                        </span>
                        {emp.holdAmount > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
                            Hold {formatCurrency(emp.holdAmount)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            viewingCycle.status === 'Calculated'
                              ? 'warning'
                              : viewingCycle.status === 'Draft'
                              ? 'neutral'
                              : viewingCycle.status === 'Approved'
                              ? 'info'
                              : 'success'
                          }
                        >
                          {viewingCycle.status}
                        </Badge>
                      </td>

                      {/* Actions — ··· dots menu */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuEmpId(openMenuEmpId === emp.id ? null : emp.id); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          >
                            <MoreIcon className="size-4" />
                          </button>
                          {openMenuEmpId === emp.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-border bg-card shadow-lg py-1 animate-in fade-in duration-100">
                              <button onClick={() => { setSelectedStaffSlip(emp); setShowPayslip(true); setOpenMenuEmpId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer">
                                <FileTextIcon className="size-3.5 text-muted-foreground" /> Payslip
                              </button>
                              <button onClick={() => { openEditEmployee(emp); setOpenMenuEmpId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer">
                                <EditIcon className="size-3.5 text-muted-foreground" /> Edit
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button onClick={() => { openHoldEmployee(emp); setOpenMenuEmpId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer">
                                <LockIcon className="size-3.5 text-muted-foreground" /> Hold amount
                              </button>
                              <button onClick={() => { openAdjustEmployee(emp); setOpenMenuEmpId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer">
                                <WalletIcon className="size-3.5 text-muted-foreground" /> Adjust amount paid
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button onClick={() => { setRemovingEmployee(emp); setOpenMenuEmpId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer">
                                <TrashIcon className="size-3.5" /> Remove from run
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">Click any row to open the full salary breakdown.</p>
      </div>
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
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
                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => handleExecuteCalculation(cycle.id)}
                        className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Recalculate"
                      >
                        <ZapIcon className="size-3.5" />
                      </button>
                    )}
                    {isAdminOrManager && cycle.status !== 'Approved' && cycle.status !== 'Paid' && (
                      <button
                        type="button"
                        onClick={() => handleApproveCycle(cycle.id)}
                        className="size-7 rounded-lg flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircleIcon className="size-3.5" />
                      </button>
                    )}
                    {isAdminOrManager && (
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Salary Structures</h1>
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
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
                  <input
                    type="text"
                    required
                    value={payrollSettings.companyName}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, companyName: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    COMPANY ADDRESS
                  </label>
                  <input
                    type="text"
                    required
                    value={payrollSettings.companyAddress}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, companyAddress: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF NUMBER
                  </label>
                  <input
                    type="text"
                    value={payrollSettings.pfNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfNumber: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC NUMBER
                  </label>
                  <input
                    type="text"
                    value={payrollSettings.esicNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicNumber: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PAN NUMBER
                  </label>
                  <input
                    type="text"
                    value={payrollSettings.panNumber}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, panNumber: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
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
                  <input
                    type="number"
                    value={payrollSettings.pfPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={payrollSettings.esicPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC CAP (₹)
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.esicCap}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicCap: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PT (₹)
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.ptAmount}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, ptAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    DEFAULT TDS (₹)
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.defaultTds}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, defaultTds: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
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
                  <input
                    type="number"
                    value={payrollSettings.payDaysInMonth}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, payDaysInMonth: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    BASIC % OF RATE
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.basicPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, basicPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    HRA % OF BASIC
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.hraPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, hraPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    CONVEYANCE % OF BASIC
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.conveyancePercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, conveyancePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF EMPLOYER %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={payrollSettings.pfEmployerPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfEmployerPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC EMPLOYER %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={payrollSettings.esicEmployerPercent}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicEmployerPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PF WAGE CAP (₹)
                  </label>
                  <input
                    type="number"
                    value={payrollSettings.pfWageCap}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, pfWageCap: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ESIC WAGES
                  </label>
                  <input
                    type="text"
                    value={payrollSettings.esicWages}
                    onChange={(e) => setPayrollSettings({ ...payrollSettings, esicWages: e.target.value })}
                    className="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                Creates a draft run for 7 active employee(s). Click Calculate to pull attendance days, late penalties, and overtime.
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
                <input
                  type="text"
                  required
                  
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  
                  value={templateForm.note}
                  onChange={(e) => setTemplateForm({ ...templateForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                <input
                  type="number"
                  required
                  min="1000"
                  
                  value={templateForm.ctc}
                  onChange={(e) => {
                    const ctcVal = parseFloat(e.target.value) || 0;
                    setTemplateForm({
                      ...templateForm,
                      ctc: e.target.value,
                      basic: Math.round(ctcVal * 0.5),
                      hra: Math.round(ctcVal * 0.2),
                      conveyance: Math.round(ctcVal * 0.1),
                      specialAllowance: Math.round(ctcVal * 0.2),
                    });
                  }}
                  className="w-full pl-7 pr-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                  <input
                    type="number"
                    value={templateForm.basic}
                    onChange={(e) => setTemplateForm({ ...templateForm, basic: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">HRA</label>
                  <input
                    type="number"
                    value={templateForm.hra}
                    onChange={(e) => setTemplateForm({ ...templateForm, hra: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Conveyance</label>
                  <input
                    type="number"
                    value={templateForm.conveyance}
                    onChange={(e) => setTemplateForm({ ...templateForm, conveyance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Special Allowance</label>
                  <input
                    type="number"
                    value={templateForm.specialAllowance}
                    onChange={(e) => setTemplateForm({ ...templateForm, specialAllowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Overtime Rate */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Overtime Rate / HR
              </label>
              <input
                type="number"
                min="0"
                value={templateForm.overtimeRate}
                onChange={(e) => setTemplateForm({ ...templateForm, overtimeRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                  <input
                    type="number"
                    value={templateForm.pfRate}
                    onChange={(e) => setTemplateForm({ ...templateForm, pfRate: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 border border-border rounded bg-background font-mono text-xs text-right"
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
                  <input
                    type="number"
                    value={templateForm.esicRate}
                    onChange={(e) => setTemplateForm({ ...templateForm, esicRate: parseFloat(e.target.value) || 0 })}
                    className="w-14 px-2 py-1 border border-border rounded bg-background font-mono text-xs text-right"
                  />
                  <span className="text-muted-foreground">₹</span>
                  <input
                    type="number"
                    value={templateForm.esicThreshold}
                    onChange={(e) => setTemplateForm({ ...templateForm, esicThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 border border-border rounded bg-background font-mono text-xs text-right"
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
                  <input
                    type="number"
                    value={templateForm.ptAmount}
                    onChange={(e) => setTemplateForm({ ...templateForm, ptAmount: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 border border-border rounded bg-background font-mono text-xs text-right"
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

    </div>
  );
}

export default PayslipsPage;
