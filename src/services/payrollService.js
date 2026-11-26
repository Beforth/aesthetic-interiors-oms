/**
 * Single source of truth for payroll cycles, salary structures and payroll settings.
 *
 * Mock mode keeps the original PayslipsPage localStorage data (same keys and seed rows).
 * Live mode calls the /payroll endpoints and falls back to that local data whenever the
 * backend is unreachable or returns an empty collection.
 */

import { mockPayslips } from '../data/leaves';
import { apiClient } from './apiClient';
import { withBackend, pick } from './serviceMode';

const STORAGE_KEY_PAY_CYCLES = 'osm_payroll_cycles_v2';
const STORAGE_KEY_STRUCTURES = 'osm_payroll_structures_v3';
const LEGACY_STORAGE_KEY_STRUCTURES = 'osm_payroll_structures_v2';
const STORAGE_KEY_PAYROLL_SETTINGS = 'osm_payroll_settings_v3';

const CYCLES_URL = '/payroll/cycles/';
const STRUCTURES_URL = '/payroll/structures/';
const SETTINGS_URL = '/payroll/settings/';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_LABELS = {
  draft: 'Draft',
  calculated: 'Calculated',
  approved: 'Approved',
  paid: 'Paid',
};

const CYCLE_NUMBER_FIELDS = [
  'totalDays', 'sundaysCount', 'employeesCount', 'gross', 'deductions', 'netPay',
];

const STRUCTURE_NUMBER_FIELDS = [
  'ctc', 'basic', 'hra', 'conveyance', 'specialAllowance', 'overtimeRate',
  'pfRate', 'esicRate', 'esicThreshold', 'ptAmount', 'tdsAmount',
];

const SETTINGS_NUMBER_FIELDS = [
  'pfPercent', 'esicPercent', 'esicCap', 'ptAmount', 'defaultTds',
  'payDaysInMonth', 'basicPercent', 'hraPercent', 'conveyancePercent',
  'pfEmployerPercent', 'esicEmployerPercent', 'pfWageCap',
];

export const initialPayrollSettings = {
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
export const initialStructures = [
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

// Initial Pay Cycles (matching the original Screenshot 1 rows)
export const initialCycles = [
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
    status: 'Calculated',
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

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toId(value) {
  return value !== undefined && value !== null && value !== '' ? String(value) : '';
}

function normalizePeriodKey(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function monthKeyFromPeriod(period) {
  const match = String(period || '').match(/([A-Za-z]+)[,\s]+(\d{4})/);
  if (!match) return '';
  const monthIndex = MONTHS.findIndex(
    (name) =>
      name.toLowerCase() === match[1].toLowerCase() ||
      name.toLowerCase().startsWith(match[1].toLowerCase())
  );
  if (monthIndex === -1) return '';
  return `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function periodFromMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-');
  const monthIndex = Number(month) - 1;
  return MONTHS[monthIndex] && year ? `${MONTHS[monthIndex]} ${year}` : '';
}

function normalizeDisplayDate(value) {
  const raw =
    value === undefined || value === null || value === ''
      ? new Date().toLocaleDateString('en-GB')
      : String(value);

  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return raw;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('en-GB');
  return new Date().toLocaleDateString('en-GB');
}

function normalizeStatus(value) {
  const key = String(value || '').toLowerCase();
  return STATUS_LABELS[key] || (value || 'Draft');
}

function normalizeCycle(row) {
  const source = row && typeof row === 'object' ? row : {};
  const monthKey =
    source.monthKey || source.month_key || monthKeyFromPeriod(source.period) || '';

  return {
    id: toId(source.id) || `cycle-${Date.now()}`,
    period: source.period || periodFromMonthKey(monthKey) || 'Untitled Period',
    createdDate: normalizeDisplayDate(source.createdDate || source.created_date),
    monthKey,
    totalDays: asNumber(source.totalDays ?? source.total_days, 30),
    sundaysCount: asNumber(source.sundaysCount ?? source.sundays_count, 4),
    employeesCount: asNumber(source.employeesCount ?? source.employees_count, 5),
    gross: asNumber(source.gross),
    deductions: asNumber(source.deductions),
    netPay: asNumber(source.netPay ?? source.net_pay),
    status: normalizeStatus(source.status),
  };
}

function normalizeStructure(row) {
  const source = row && typeof row === 'object' ? row : {};
  const defaults = initialStructures[0];

  return {
    id: toId(source.id) || `str-${Date.now()}`,
    name: source.name ?? '',
    note: source.note ?? '',
    payModel: source.payModel ?? source.pay_model ?? defaults.payModel,
    ctc: asNumber(source.ctc, defaults.ctc),
    basic: asNumber(source.basic, defaults.basic),
    hra: asNumber(source.hra, defaults.hra),
    conveyance: asNumber(source.conveyance, defaults.conveyance),
    specialAllowance: asNumber(
      source.specialAllowance ?? source.special_allowance,
      defaults.specialAllowance
    ),
    overtimeRate: asNumber(source.overtimeRate ?? source.overtime_rate, defaults.overtimeRate),
    pfEnabled: asBoolean(source.pfEnabled ?? source.pf_enabled ?? defaults.pfEnabled),
    pfRate: asNumber(source.pfRate ?? source.pf_rate, defaults.pfRate),
    esicEnabled: asBoolean(source.esicEnabled ?? source.esic_enabled ?? defaults.esicEnabled),
    esicRate: asNumber(source.esicRate ?? source.esic_rate, defaults.esicRate),
    esicThreshold: asNumber(
      source.esicThreshold ?? source.esic_threshold,
      defaults.esicThreshold
    ),
    ptEnabled: asBoolean(source.ptEnabled ?? source.pt_enabled ?? defaults.ptEnabled),
    ptAmount: asNumber(source.ptAmount ?? source.pt_amount, defaults.ptAmount),
    tdsAmount: asNumber(source.tdsAmount ?? source.tds_amount, defaults.tdsAmount),
    lwfEnabled: asBoolean(source.lwfEnabled ?? source.lwf_enabled ?? defaults.lwfEnabled),
  };
}

function normalizeSettings(row) {
  const source = row && typeof row === 'object' ? row : {};
  const result = {
    companyName: source.companyName ?? initialPayrollSettings.companyName,
    companyAddress: source.companyAddress ?? initialPayrollSettings.companyAddress,
    pfNumber: source.pfNumber ?? initialPayrollSettings.pfNumber,
    esicNumber: source.esicNumber ?? initialPayrollSettings.esicNumber,
    panNumber: source.panNumber ?? initialPayrollSettings.panNumber,
    esicWages: source.esicWages ?? initialPayrollSettings.esicWages,
  };

  SETTINGS_NUMBER_FIELDS.forEach((key) => {
    result[key] = asNumber(source[key], initialPayrollSettings[key]);
  });

  const id = toId(source.id);
  if (id) result.id = id;
  return result;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage`, err);
    return null;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage`, err);
  }
}

function getStoredCycles() {
  const saved = readJson(STORAGE_KEY_PAY_CYCLES);
  if (Array.isArray(saved)) {
    const seen = new Set();
    const unique = [];
    saved.forEach((cycle) => {
      const key = normalizePeriodKey(cycle && cycle.period);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(normalizeCycle(cycle));
      }
    });
    return unique;
  }
  return initialCycles.map(normalizeCycle);
}

function saveStoredCycles(cycles) {
  saveJson(STORAGE_KEY_PAY_CYCLES, cycles);
}

function migrateStructures(parsed) {
  const legacyNameMap = {
    'Executive & Management': 'Site Supervisor',
    'Senior Operations & Design': 'Manager',
    'Site Supervisor & Civil': 'Worker',
    'Warehouse & Skilled Artisan': 'Client',
  };

  return parsed.map((item, idx) => {
    const mappedName = legacyNameMap[item.name];
    if (mappedName) return { ...item, name: mappedName };
    if (idx === 0 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) {
      return { ...item, name: 'Site Supervisor' };
    }
    if (idx === 1 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) {
      return { ...item, name: 'Manager' };
    }
    if (idx === 2 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) {
      return { ...item, name: 'Worker' };
    }
    if (idx === 3 && !['Site Supervisor', 'Manager', 'Worker', 'Client'].includes(item.name)) {
      return { ...item, name: 'Client' };
    }
    return item;
  });
}

function getStoredStructures() {
  const saved =
    readJson(STORAGE_KEY_STRUCTURES) || readJson(LEGACY_STORAGE_KEY_STRUCTURES);
  if (Array.isArray(saved) && saved.length > 0) {
    const migrated = migrateStructures(saved);
    saveJson(STORAGE_KEY_STRUCTURES, migrated);
    return migrated.map(normalizeStructure);
  }
  return initialStructures.map(normalizeStructure);
}

function saveStoredStructures(structures) {
  saveJson(STORAGE_KEY_STRUCTURES, structures);
}

function getStoredSettings() {
  const saved = readJson(STORAGE_KEY_PAYROLL_SETTINGS);
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    return normalizeSettings(saved);
  }
  return normalizeSettings(initialPayrollSettings);
}

function saveStoredSettings(settings) {
  saveJson(STORAGE_KEY_PAYROLL_SETTINGS, settings);
}

// Exact salary calculation rules used by the Payslips page breakdown.
function calculateTotals(cycle) {
  const daysInMonth = cycle.totalDays || 30;
  const sundays = cycle.sundaysCount || 4;

  const staffList = (mockPayslips || []).slice(0, cycle.employeesCount || 5).map((ps, idx) => {
    const monthlySalary = ps.basicPay + ps.hra + ps.specialAllowance + (ps.siteExecutionBonus || 0);
    const dailyRate = Math.round((monthlySalary / daysInMonth) * 100) / 100;
    const unworkedSundays = sundays;
    const sundayWorkDays = idx === 1 ? 1 : 0;
    const leavesTaken = ps.unpaidLeaves || 0;
    const unpaidLeaveDays = Math.max(0, leavesTaken - 1);
    const unusedPaidLeaveEncashed = leavesTaken === 0 ? 1 : 0;
    const payableDays = daysInMonth - unworkedSundays - unpaidLeaveDays + sundayWorkDays;
    const basePay = Math.round(dailyRate * payableDays * 100) / 100;
    const leaveEncashment = Math.round(unusedPaidLeaveEncashed * dailyRate * 100) / 100;
    const gross = Math.round((basePay + leaveEncashment) * 100) / 100;
    const pf = Math.round((gross * 0.12) > 1800 ? 1800 : (gross * 0.12));
    const pt = 200;
    const tds = ps.tdsTax || 0;
    const deductions = pf + pt + tds;
    const netPay = Math.round((gross - deductions) * 100) / 100;

    return { gross, deductions, netPay };
  });

  const totalGross = staffList.reduce((sum, item) => sum + item.gross, 0);
  const totalDeductions = staffList.reduce((sum, item) => sum + item.deductions, 0);
  const totalNet = staffList.reduce((sum, item) => sum + item.netPay, 0);

  return {
    totalGross: Math.round(totalGross * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
  };
}

function sameId(left, right) {
  return toId(left) !== '' && toId(left) === toId(right);
}

const mockPayrollService = {
  async getCycles() {
    return getStoredCycles();
  },

  async createCycle(data) {
    const cycle = normalizeCycle({
      ...data,
      id: toId(data && data.id) || `cycle-${Date.now()}`,
    });
    saveStoredCycles([cycle, ...getStoredCycles()]);
    return cycle;
  },

  async deleteCycle(id) {
    saveStoredCycles(getStoredCycles().filter((cycle) => !sameId(cycle.id, id)));
    return true;
  },

  async setCycleStatus(id, action, values = {}) {
    const statusByAction = {
      calculate: 'Calculated',
      approve: 'Approved',
      pay: 'Paid',
    };
    let updated = null;

    const cycles = getStoredCycles().map((cycle) => {
      if (!sameId(cycle.id, id)) return cycle;

      const patch = {};
      if (statusByAction[action]) patch.status = statusByAction[action];

      if (action === 'calculate') {
        const totals =
          values && (values.gross !== undefined || values.deductions !== undefined || values.netPay !== undefined)
            ? values
            : calculateTotals(cycle);
        patch.gross = asNumber(totals.gross, cycle.gross);
        patch.deductions = asNumber(totals.deductions, cycle.deductions);
        patch.netPay = asNumber(totals.netPay, cycle.netPay);
      }

      updated = normalizeCycle({ ...cycle, ...patch });
      return updated;
    });

    saveStoredCycles(cycles);
    return updated;
  },

  async calculateCycle(id, values) {
    return mockPayrollService.setCycleStatus(id, 'calculate', values);
  },

  async approveCycle(id) {
    return mockPayrollService.setCycleStatus(id, 'approve');
  },

  async payCycle(id) {
    return mockPayrollService.setCycleStatus(id, 'pay');
  },

  async runAction(id, action) {
    return mockPayrollService.setCycleStatus(id, action === 'regenerate' ? 'calculate' : action);
  },

  async syncEmployees(id) {
    return { added: [], removed: [], cycle: await mockPayrollService.getCycle(id) };
  },

  async getCycle(id) {
    return getStoredCycles().find((cycle) => sameId(cycle.id, id)) || null;
  },

  async getLines() {
    return [];
  },

  async editLine() {
    throw new Error('Employee changes need the backend.');
  },

  async removeLine() {
    throw new Error('Employee changes need the backend.');
  },

  async getSalaries() {
    return [];
  },

  async setSalary() {
    throw new Error('Salaries need the backend.');
  },

  async getStructures() {
    return getStoredStructures();
  },

  async createStructure(data) {
    const structure = normalizeStructure({
      ...data,
      id: toId(data && data.id) || `str-${Date.now()}`,
    });
    saveStoredStructures([...getStoredStructures(), structure]);
    return structure;
  },

  async deleteStructure(id) {
    saveStoredStructures(
      getStoredStructures().filter((structure) => !sameId(structure.id, id))
    );
    return true;
  },

  async getSettings() {
    return getStoredSettings();
  },

  async saveSettings(data) {
    const settings = normalizeSettings({ ...getStoredSettings(), ...(data || {}) });
    saveStoredSettings(settings);
    return settings;
  },
};

function toApiCycle(data) {
  const body = pick(data || {}, [
    'period', 'createdDate', 'monthKey', 'totalDays', 'sundaysCount',
    'employeesCount', 'gross', 'deductions', 'netPay', 'status',
  ]);
  CYCLE_NUMBER_FIELDS.forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  return body;
}

function toApiStructure(data) {
  const body = pick(data || {}, [
    'name', 'note', 'payModel', 'ctc', 'basic', 'hra', 'conveyance',
    'specialAllowance', 'overtimeRate', 'pfEnabled', 'pfRate', 'esicEnabled',
    'esicRate', 'esicThreshold', 'ptEnabled', 'ptAmount', 'tdsAmount', 'lwfEnabled',
  ]);
  STRUCTURE_NUMBER_FIELDS.forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  ['pfEnabled', 'esicEnabled', 'ptEnabled', 'lwfEnabled'].forEach((key) => {
    if (key in body) body[key] = asBoolean(body[key]);
  });
  return body;
}

function toApiSettings(data) {
  const body = pick(data || {}, [
    'companyName', 'companyAddress', 'pfNumber', 'esicNumber', 'panNumber',
    'pfPercent', 'esicPercent', 'esicCap', 'ptAmount', 'defaultTds',
    'payDaysInMonth', 'basicPercent', 'hraPercent', 'conveyancePercent',
    'pfEmployerPercent', 'esicEmployerPercent', 'pfWageCap', 'esicWages',
  ]);
  SETTINGS_NUMBER_FIELDS.forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  return body;
}

/**
 * Live (backend) payroll. Errors are passed to the screen: nothing is quietly kept in the browser instead, and an
 * empty list stays empty. The server does all the salary calculation and enforces what each status allows.
 */
const lineUrl = (cycleId, lineId) => `${CYCLES_URL}${cycleId}/lines/${lineId}/`;

const livePayrollService = {
  async getCycles() {
    return (await apiClient.get(CYCLES_URL)).map(normalizeCycle);
  },

  async createCycle(data) {
    return normalizeCycle(await apiClient.post(CYCLES_URL, { period: data.period }));
  },

  async deleteCycle(id) {
    await apiClient.delete(`${CYCLES_URL}${id}/`);
    return true;
  },

  /** `action`: calculate, regenerate, approve or pay. */
  async runAction(id, action) {
    return normalizeCycle(await apiClient.post(`${CYCLES_URL}${id}/status/`, { action }));
  },

  async syncEmployees(id) {
    const result = await apiClient.post(`${CYCLES_URL}${id}/sync/`, {});
    return { ...result, cycle: normalizeCycle(result.cycle) };
  },

  async getCycle(id) {
    return normalizeCycle(await apiClient.get(`${CYCLES_URL}${id}/`));
  },

  getLines: (cycleId) => apiClient.get(`${CYCLES_URL}${cycleId}/lines/`),
  editLine: (cycleId, lineId, changes) => apiClient.patch(lineUrl(cycleId, lineId), changes),

  async removeLine(cycleId, lineId) {
    await apiClient.delete(lineUrl(cycleId, lineId));
    return true;
  },

  getSalaries: () => apiClient.get('/payroll/salaries/'),
  setSalary: (userId, monthlySalary, structureId) =>
    apiClient.put(`/payroll/salaries/${userId}/`, {
      monthlySalary,
      structureId: structureId ? Number(structureId) : null,
    }),

  async getStructures() {
    return (await apiClient.get(STRUCTURES_URL)).map(normalizeStructure);
  },

  async createStructure(data) {
    return normalizeStructure(await apiClient.post(STRUCTURES_URL, toApiStructure(data)));
  },

  async deleteStructure(id) {
    await apiClient.delete(`${STRUCTURES_URL}${id}/`);
    return true;
  },

  async getSettings() {
    return normalizeSettings(await apiClient.get(SETTINGS_URL));
  },

  async saveSettings(data) {
    return normalizeSettings(await apiClient.patch(SETTINGS_URL, toApiSettings(data)));
  },
};

export const payrollService = withBackend(mockPayrollService, livePayrollService);

export { mockPayrollService, livePayrollService };

export default payrollService;
