'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { mockPayslips } from '../data/leaves';
import { mockUsers } from '../data/users';
import { cn } from '../lib/utils';

// BefUI Components strictly conforming to design.md tokens
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { Badge } from '../components/ui/badge';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';

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
} from '../components/ui/icons';

const STORAGE_KEY_PAY_CYCLES = 'osm_payroll_cycles_v2';
const STORAGE_KEY_STRUCTURES = 'osm_payroll_structures_v3';
const STORAGE_KEY_PAYROLL_SETTINGS = 'osm_payroll_settings_v3';

const initialPayrollSettings = {
  companyName: 'Aesthetic Interiors',
  companyAddress: 'Surat, Gujarat, India',
  pfNumber: 'GJ/SRT/12345',
  esicNumber: '2400000000',
  panNumber: 'AAAAA0000A',

  pfPercent: 12,
  esicPercent: 0.75,
  esicCap: 21000,
  ptAmount: 200,
  defaultTds: 0,

  payDaysInMonth: 26,
  basicPercent: 60,
  hraPercent: 30,
  conveyancePercent: 20,
  pfEmployerPercent: 13,
  esicEmployerPercent: 3.25,
  pfWageCap: 15000,
  esicWages: 'Larger of basic and half of gross',
};

// Initial Salary Structures (Headings: Site Supervisor, Manager, Worker, Client)
const initialStructures = [
  {
    id: 'str-1',
    name: 'Site Supervisor',
    note: '',
    payModel: 'Monthly Salary',
    ctc: 50000,
    basic: 25000,
    hra: 12000,
    conveyance: 5000,
    specialAllowance: 8000,
    overtimeRate: 200,
    pfEnabled: true,
    pfRate: 12,
    esicEnabled: false,
    esicRate: 0.5,
    esicThreshold: 21000,
    ptEnabled: true,
    ptAmount: 200,
    tdsAmount: 1500,
    lwfEnabled: false,
  },
  {
    id: 'str-2',
    name: 'Manager',
    note: '',
    payModel: 'Monthly Salary',
    ctc: 90000,
    basic: 45000,
    hra: 22000,
    conveyance: 8000,
    specialAllowance: 15000,
    overtimeRate: 350,
    pfEnabled: true,
    pfRate: 12,
    esicEnabled: false,
    esicRate: 0.5,
    esicThreshold: 21000,
    ptEnabled: true,
    ptAmount: 200,
    tdsAmount: 5000,
    lwfEnabled: false,
  },
  {
    id: 'str-3',
    name: 'Worker',
    note: '',
    payModel: 'Monthly Salary',
    ctc: 25000,
    basic: 12500,
    hra: 6000,
    conveyance: 2500,
    specialAllowance: 4000,
    overtimeRate: 150,
    pfEnabled: true,
    pfRate: 12,
    esicEnabled: true,
    esicRate: 0.5,
    esicThreshold: 21000,
    ptEnabled: true,
    ptAmount: 200,
    tdsAmount: 0,
    lwfEnabled: true,
  },
  {
    id: 'str-4',
    name: 'Client',
    note: '',
    payModel: 'Monthly Retainer',
    ctc: 150000,
    basic: 75000,
    hra: 35000,
    conveyance: 10000,
    specialAllowance: 30000,
    overtimeRate: 0,
    pfEnabled: true,
    pfRate: 12,
    esicEnabled: false,
    esicRate: 0.5,
    esicThreshold: 21000,
    ptEnabled: true,
    ptAmount: 200,
    tdsAmount: 10000,
    lwfEnabled: false,
  },
];

// Initial Pay Cycles (matching Screenshot 1: October 2026, September 2026, July 2026, January 2026)
const initialCycles = [
  {
    id: 'cycle-2026-10',
    period: 'October 2026',
    createdDate: '15/10/2026',
    monthKey: '2026-10',
    totalDays: 31,
    sundaysCount: 4,
    employeesCount: 5,
    gross: 62676.53,
    deductions: 5441.53,
    netPay: 57235.0,
    status: 'Calculated', // Calculated, Draft, Approved, Paid
  },
  {
    id: 'cycle-2026-09',
    period: 'September 2026',
    createdDate: '11/09/2026',
    monthKey: '2026-09',
    totalDays: 30,
    sundaysCount: 4,
    employeesCount: 5,
    gross: 0,
    deductions: 0,
    netPay: 0,
    status: 'Draft',
  },
  {
    id: 'cycle-2026-07',
    period: 'July 2026',
    createdDate: '11/09/2026',
    monthKey: '2026-07',
    totalDays: 31,
    sundaysCount: 4,
    employeesCount: 5,
    gross: 177758.09,
    deductions: 10631.14,
    netPay: 167126.95,
    status: 'Calculated',
  },
  {
    id: 'cycle-2026-01',
    period: 'January 2026',
    createdDate: '11/09/2026',
    monthKey: '2026-01',
    totalDays: 31,
    sundaysCount: 4,
    employeesCount: 6,
    gross: 124150.0,
    deductions: 6210.38,
    netPay: 117939.62,
    status: 'Approved',
  },
];

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

  // Payroll Global Settings (Screenshots: Company, Default Deductions, Calculation Rules)
  const [payrollSettings, setPayrollSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAYROLL_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return initialPayrollSettings;
  });

  const handleSavePayrollSettings = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY_PAYROLL_SETTINGS, JSON.stringify(payrollSettings));
      toast.success('Payroll settings saved successfully!');
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  // Normalize period string for robust comparison (e.g. 'November, 2026' vs 'November 2026')
  const normalizePeriod = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const availablePeriods = [
    'November, 2026',
    'October, 2026',
    'September, 2026',
    'August, 2026',
    'July, 2026',
    'June, 2026',
    'May, 2026',
    'April, 2026',
    'March, 2026',
    'February, 2026',
    'January, 2026',
    'December, 2026',
    'January, 2027',
    'February, 2027',
  ];

  // State for Pay Cycles (with duplicate period prevention & deduplication)
  const [cycles, setCycles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAY_CYCLES);
      if (saved) {
        const parsed = JSON.parse(saved);
        const seen = new Set();
        const unique = [];
        for (const c of parsed) {
          const key = (c.period || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(c);
          }
        }
        return unique;
      }
    } catch (e) {}
    return initialCycles;
  });

  const saveCycles = (newCycles) => {
    setCycles(newCycles);
    try {
      localStorage.setItem(STORAGE_KEY_PAY_CYCLES, JSON.stringify(newCycles));
    } catch (e) {}
  };

  // State for Salary Structures (handles migration of old heading names to: Site Supervisor, Manager, Worker, Client)
  const [structures, setStructures] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STRUCTURES) || localStorage.getItem('osm_payroll_structures_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const legacyNameMap = {
            'Executive & Management': 'Site Supervisor',
            'Senior Operations & Design': 'Manager',
            'Site Supervisor & Civil': 'Worker',
            'Warehouse & Skilled Artisan': 'Client',
          };
          const migrated = parsed.map((item, idx) => {
            const mappedName = legacyNameMap[item.name];
            if (mappedName) {
              return { ...item, name: mappedName };
            }
            if (idx === 0 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) return { ...item, name: 'Site Supervisor' };
            if (idx === 1 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) return { ...item, name: 'Manager' };
            if (idx === 2 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) return { ...item, name: 'Worker' };
            if (idx === 3 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) return { ...item, name: 'Client' };
            return item;
          });
          localStorage.setItem(STORAGE_KEY_STRUCTURES, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) {}
    return initialStructures;
  });

  const saveStructures = (newStructures) => {
    setStructures(newStructures);
    try {
      localStorage.setItem(STORAGE_KEY_STRUCTURES, JSON.stringify(newStructures));
    } catch (e) {}
  };

  // Search & Filter in Pay Cycles
  const [searchMonth, setSearchMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Generate Run Modal State (Screenshot 2)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState('November, 2026');

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
  const [selectedStaffSlip, setSelectedStaffSlip] = useState(null);

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

  // ---------------------------------------------------------------------------
  // EXACT SALARY CALCULATION FORMULA (Specified by user)
  // Daily rate = monthly salary ÷ days in the month.
  // Pay = daily rate × (total days − unworked Sundays − unpaid leave days) + (1 paid leave encashed if unused) + (Sunday work)
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

  // Generate Run Handler (Screenshot 2 with duplicate prevention)
  const handleGenerateRun = (e) => {
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

    saveCycles([newCycle, ...cycles]);
    toast.success(`Created draft payroll run for ${generatePeriod}! Click Calculate (⚡) to process.`);
    setIsGenerateModalOpen(false);
  };

  // Run calculation on a cycle
  const handleExecuteCalculation = (cycleId) => {
    const updated = cycles.map((c) => {
      if (c.id === cycleId) {
        const res = calculateCycleForMonth(c);
        return {
          ...c,
          gross: res.totalGross,
          deductions: res.totalDeductions,
          netPay: res.totalNet,
          status: 'Calculated',
        };
      }
      return c;
    });
    saveCycles(updated);
    toast.success('Pay cycle calculated using daily rate & attendance rules!');
  };

  // Approve a cycle
  const handleApproveCycle = (cycleId) => {
    const updated = cycles.map((c) => (c.id === cycleId ? { ...c, status: 'Approved' } : c));
    saveCycles(updated);
    toast.success('Payroll run approved for disbursement!');
  };

  // Delete a cycle
  const handleDeleteCycle = (cycleId) => {
    if (!window.confirm('Delete this payroll cycle run?')) return;
    const updated = cycles.filter((c) => c.id !== cycleId);
    saveCycles(updated);
    toast.success('Payroll run removed');
  };

  // Create Salary Structure Template (Screenshot 3 & 4)
  const handleCreateTemplate = (e) => {
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

    saveStructures([...structures, newStruct]);
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
  };

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-200">
      {/* 1. Sub-Tabs Bar: Pay cycles, Structure, Settings (Requested by user) */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('cycles')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeSubTab === 'cycles'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          Pay cycles
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('structure')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeSubTab === 'structure'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          Structure
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeSubTab === 'settings'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          Settings
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: PAY CYCLES (Screenshot 1)                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'cycles' && (
        <div className="space-y-5">
          {/* Header with Title and '+ Generate' Button (Renamed from Generate monthly payslips) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Salary structures, pay cycles and payouts</p>
            </div>
            {isAdminOrManager && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsGenerateModalOpen(true)}
                className="flex items-center gap-1.5 shadow-2xs self-start sm:self-auto font-semibold"
              >
                <PlusIcon className="size-4" />
                <span>Generate</span>
              </Button>
            )}
          </div>

          {/* 4 KPI Metric Cards in a Grid (Screenshot 1) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileTextIcon className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground leading-none">
                  {stats.totalCycles}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                  Total Pay Cycles
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
              <div className="size-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
                <ClockIcon className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-warning leading-none">
                  {stats.inProgress}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                  In Progress
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
              <div className="size-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
                <CheckCircleIcon className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-success leading-none">
                  {stats.paidCount}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                  Paid
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3.5">
              <div className="size-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <IndianRupeeIcon className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground leading-none">
                  {formatCurrency(stats.netPayout)}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground mt-1 block">
                  Net Payout
                </span>
              </div>
            </div>
          </div>

          {/* Search by Month & Status Filter (Screenshot 1) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by month..."
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="ALL">All Status ⇅</option>
                <option value="Calculated">Calculated</option>
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Pay Cycles Data Table (Screenshot 1) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Period ⌵</th>
                    <th className="py-3 px-4">Employees</th>
                    <th className="py-3 px-4">Gross</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Net Pay ⇅</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredCycles.length > 0 ? (
                    filteredCycles.map((cycle) => (
                      <tr key={cycle.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground block">
                            {cycle.period}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Created {cycle.createdDate}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="size-7 rounded-full bg-muted/60 text-foreground font-semibold flex items-center justify-center text-xs">
                            {cycle.employeesCount}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {formatCurrency(cycle.gross)}
                        </td>

                        <td className="py-3 px-4 font-mono text-destructive">
                          {formatCurrency(cycle.deductions)}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-success text-sm">
                          {formatCurrency(cycle.netPay)}
                        </td>

                        <td className="py-3 px-4">
                          {cycle.status === 'Calculated' && <Badge variant="warning">Calculated</Badge>}
                          {cycle.status === 'Draft' && <Badge variant="neutral">Draft</Badge>}
                          {cycle.status === 'Approved' && <Badge variant="info">Approved</Badge>}
                          {cycle.status === 'Paid' && <Badge variant="success">Paid</Badge>}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Eye: View Slips */}
                            <button
                              type="button"
                              onClick={() => setViewingCycle(cycle)}
                              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                              title="view details"
                            >
                              <EyeIcon className="size-3.5" />
                            </button>

                            {/* Zap: Calculate run */}
                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => handleExecuteCalculation(cycle.id)}
                                className="size-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-500/15 transition-colors cursor-pointer"
                                title="recalculate"
                              >
                                <ZapIcon className="size-3.5" />
                              </button>
                            )}

                            {/* Approve */}
                            {isAdminOrManager && cycle.status !== 'Approved' && cycle.status !== 'Paid' && (
                              <button
                                type="button"
                                onClick={() => handleApproveCycle(cycle.id)}
                                className="size-7 rounded-lg flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                                title="approve"
                              >
                                <CheckCircleIcon className="size-3.5" />
                              </button>
                            )}

                            {/* Refresh */}
                            <button
                              type="button"
                              onClick={() => handleExecuteCalculation(cycle.id)}
                              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                              title="regenerate"
                            >
                              <RefreshIcon className="size-3.5" />
                            </button>

                            {/* Delete */}
                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCycle(cycle.id)}
                                className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="delete"
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
                        No pay cycle runs found. Click "+ Generate" to create one.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {structures.map((str) => (
              <div
                key={str.id}
                className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-4 text-xs flex flex-col justify-between min-h-[220px]"
              >
                <div className="border-b border-border pb-3">
                  <h3 className="font-bold text-sm text-foreground leading-snug">
                    {(str.name || '').replace(/,\s*[\d,]+$/, '')}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-muted/20 border border-border flex flex-col justify-between">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">
                      Basic Pay
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs mt-1.5">
                      {formatCurrency(str.basic)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border flex flex-col justify-between">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">
                      HRA
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs mt-1.5">
                      {formatCurrency(str.hra)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border flex flex-col justify-between">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">
                      Conveyance
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs mt-1.5">
                      {formatCurrency(str.conveyance)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border flex flex-col justify-between">
                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">
                      Special Allow.
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs mt-1.5">
                      {formatCurrency(str.specialAllowance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              <div className="relative">
                <select
                  value={generatePeriod}
                  onChange={(e) => setGeneratePeriod(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg bg-background text-foreground text-xs font-medium focus:ring-1 focus:outline-none cursor-pointer",
                    isPeriodAlreadyGenerated
                      ? "border-destructive focus:ring-destructive"
                      : "border-border focus:ring-primary"
                  )}
                >
                  {availablePeriods.map((p) => {
                    const exists = cycles.some((c) => normalizePeriod(c.period) === normalizePeriod(p));
                    return (
                      <option key={p} value={p}>
                        {p} {exists ? '• (Already generated)' : ''}
                      </option>
                    );
                  })}
                </select>
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

      {/* ===================================================================== */}
      {/* MODAL: VIEW EMPLOYEE SLIPS IN PAY CYCLE                               */}
      {/* ===================================================================== */}
      {viewingCycle && (
        <Modal
          isOpen={!!viewingCycle}
          onClose={() => setViewingCycle(null)}
          title={`Payroll Breakdown — ${viewingCycle.period}`}
          subtitle={`Status: ${viewingCycle.status} • Total Net: ${formatCurrency(viewingCycle.netPay)}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-muted/20 border border-border rounded-xl text-xs flex items-center justify-between">
              <span>Formula: <strong>Daily Rate = CTC ÷ {viewingCycle.totalDays} Days</strong></span>
              <span>1 Paid Leave Covered / Cash Encashed • Sundays Weekly Off</span>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Monthly CTC</th>
                      <th className="py-2.5 px-3">Daily Rate</th>
                      <th className="py-2.5 px-3">Worked Days</th>
                      <th className="py-2.5 px-3">Encashment</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">Deductions</th>
                      <th className="py-2.5 px-3">Net Pay</th>
                      <th className="py-2.5 px-3 text-right">Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {calculateCycleForMonth(viewingCycle).staffList.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-foreground block">{emp.employeeName}</span>
                          <span className="text-[10px] text-muted-foreground">{emp.role}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{formatCurrency(emp.monthlySalary)}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatCurrency(emp.dailyRate)}</td>
                        <td className="py-2.5 px-3">{emp.payableDays} Days</td>
                        <td className="py-2.5 px-3 text-success font-mono font-medium">
                          {emp.unusedPaidLeaveEncashed > 0 ? `+${formatCurrency(emp.leaveEncashment)}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                          {formatCurrency(emp.calculatedGross)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-destructive">
                          {formatCurrency(emp.calculatedDeductions)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-success text-sm">
                          {formatCurrency(emp.calculatedNetPay)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1"
                          >
                            <DownloadIcon className="size-3" />
                            <span>Slip</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewingCycle(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PayslipsPage;
