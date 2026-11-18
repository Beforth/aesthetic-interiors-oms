/**
 * Single source of truth for the Payments page (client schedules, agency bills,
 * labour payouts and receiving-bank settings).
 *
 * Mock mode keeps the original PaymentsPage localStorage data (same keys and seed rows).
 * Live mode calls the /payments endpoints and falls back to that local data whenever the
 * backend is unreachable, returns an empty collection, or rejects a write.
 */

import {
  mockProjectPaymentSchedules,
  mockAgencyPayouts,
  mockLabourPayouts,
} from '../data/payments';
import { apiClient } from './apiClient';
import { withBackend, pick } from './serviceMode';

const STORAGE_KEY_CLIENT_PAYMENTS = 'osm_client_payment_schedules_v3';
const STORAGE_KEY_AGENCY_PAYOUTS = 'osm_agency_payouts_v2';
const STORAGE_KEY_PAYMENT_SETTINGS = 'osm_payment_settings_v2';
const STORAGE_KEY_LABOUR_PAYOUTS = 'osm_labour_payouts_v1';

const SETTINGS_URL = '/payments/settings/';
const SCHEDULES_URL = '/payments/schedules/';
const INSTALLMENTS_URL = '/payments/installments/';
const LABOUR_URL = '/payments/labour/';
const AGENCY_URL = '/payments/agency-payouts/';

export const initialPaymentSettings = {
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

const SETTINGS_FIELDS = [
  'bankName', 'accountName', 'accountNumber', 'ifscCode', 'upiId',
  'defaultAdvancePercent', 'defaultInstallmentsCount', 'gracePeriodDays',
  'defaultGstPercent', 'tdsRateOnContracts', 'retentionHoldPercent',
];
const SETTINGS_NUMBER_FIELDS = [
  'defaultAdvancePercent', 'defaultInstallmentsCount', 'gracePeriodDays',
  'defaultGstPercent', 'tdsRateOnContracts', 'retentionHoldPercent',
];

const SCHEDULE_WRITE_FIELDS = ['totalCost', 'advancePercentage', 'milestoneCount'];
const INSTALLMENT_WRITE_FIELDS = ['title', 'amount', 'dueDate'];
const PAYMENT_WRITE_FIELDS = ['amount', 'paidDate', 'paymentMode', 'receiptNumber', 'notes'];
const AGENCY_WRITE_FIELDS = [
  'agencyId', 'projectId', 'workStage', 'invoiceNumber', 'billAmount', 'paidAmount',
  'paymentDate', 'paymentMode', 'transactionRef', 'notes',
];
const AGENCY_PAYMENT_FIELDS = ['amount', 'paymentDate', 'paymentMode', 'transactionRef'];
const LABOUR_WRITE_FIELDS = [
  'workerName', 'workerUserId', 'trade', 'projectId', 'wageType', 'rate', 'units',
  'unitLabel', 'amount', 'status', 'paidDate', 'paymentMode', 'voucherNumber', 'notes',
];

function toId(value) {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function asNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value);
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return ddmmyyyy ? `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}` : raw;
}

function sameId(left, right) {
  return toId(left) !== '' && toId(left) === toId(right);
}

/** 'P1' -> 1; the backend uses numeric project ids. */
function toApiProjectId(value) {
  const raw = String(value ?? '').trim();
  const prefixed = raw.match(/^P(\d+)$/i);
  if (prefixed) return Number(prefixed[1]);
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** 1 -> 'P1', while already-frontend ids such as 'P1' pass through. */
function fromApiProjectId(value) {
  const raw = toId(value);
  return /^\d+$/.test(raw) ? `P${Number(raw)}` : raw;
}

/** 'a1' -> 1; the seeded backend agencies share the mock directory order. */
function toApiAgencyId(value) {
  const raw = String(value ?? '').trim();
  const prefixed = raw.match(/^a(\d+)$/i);
  if (prefixed) return Number(prefixed[1]);
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function fromApiAgencyId(value) {
  const raw = toId(value);
  return /^\d+$/.test(raw) ? `a${Number(raw)}` : raw;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
  }
  return [];
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

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage`, err);
  }
}

function normalizeSettings(row) {
  const source = row && typeof row === 'object' ? row : {};
  const result = {};
  SETTINGS_FIELDS.forEach((key) => {
    const value = source[key] !== undefined ? source[key] : initialPaymentSettings[key];
    result[key] = SETTINGS_NUMBER_FIELDS.includes(key)
      ? asNumber(value, initialPaymentSettings[key])
      : value ?? '';
  });
  const id = toId(source.id);
  if (id) result.id = id;
  return result;
}

function normalizeInstallment(row, index) {
  const source = row && typeof row === 'object' ? row : {};
  return {
    ...source,
    id: toId(source.id) || `inst-${index + 1}`,
    amount: asNumber(source.amount),
    dueDate: asDate(source.dueDate ?? source.due_date),
    paidAmount: asNumber(source.paidAmount ?? source.paid_amount, 0),
    paidDate: asDate(source.paidDate ?? source.paid_date),
    paymentMode: source.paymentMode ?? source.payment_mode ?? null,
    receiptNumber: source.receiptNumber ?? source.receipt_number ?? null,
    receiptUrl: source.receiptUrl ?? source.receipt_url ?? null,
    status: source.status || 'pending',
  };
}

function normalizeSchedule(row) {
  const source = row && typeof row === 'object' ? row : {};
  return {
    ...source,
    projectId: fromApiProjectId(source.projectId ?? source.project_id),
    projectName: source.projectName ?? '',
    clientName: source.clientName ?? '',
    clientEmail: source.clientEmail ?? '',
    clientPhone: source.clientPhone ?? '',
    totalCost: asNumber(source.totalCost ?? source.total_cost),
    advancePaid: asNumber(source.advancePaid ?? source.advance_paid, 0),
    totalPaid: asNumber(source.totalPaid ?? source.total_paid, 0),
    totalPending: asNumber(source.totalPending ?? source.total_pending, 0),
    installments: Array.isArray(source.installments)
      ? source.installments.map(normalizeInstallment)
      : [],
  };
}

function normalizeAgencyPayout(row) {
  const source = row && typeof row === 'object' ? row : {};
  const id = toId(source.id);
  const seed = mockAgencyPayouts.find(
    (item) => item.id === id || (item.invoiceNumber && item.invoiceNumber === source.invoiceNumber)
  );
  return {
    ...source,
    id,
    agencyId: fromApiAgencyId(source.agencyId ?? source.agency_id),
    projectId: fromApiProjectId(source.projectId ?? source.project_id),
    billAmount: asNumber(source.billAmount ?? source.bill_amount),
    paidAmount: asNumber(source.paidAmount ?? source.paid_amount, 0),
    pendingBalance: asNumber(source.pendingBalance ?? source.pending_balance, 0),
    dueDate: source.dueDate || seed?.dueDate || '',
    paymentDate: asDate(source.paymentDate ?? source.payment_date),
    paymentMode: source.paymentMode ?? source.payment_mode ?? '',
    transactionRef: source.transactionRef ?? source.transaction_ref ?? '',
    proof: source.proof ?? null,
    status: source.status || 'pending',
  };
}

function normalizeLabourPayout(row) {
  const source = row && typeof row === 'object' ? row : {};
  return {
    ...source,
    id: toId(source.id),
    projectId: fromApiProjectId(source.projectId ?? source.project_id),
    workerUserId: source.workerUserId ?? source.worker_user_id ?? null,
    rate: asNumber(source.rate, 0),
    units: asNumber(source.units, 0),
    amount: asNumber(source.amount, 0),
    paidDate: asDate(source.paidDate ?? source.paid_date),
    status: source.status || 'pending',
  };
}

function getStoredSettings() {
  const saved = readJson(STORAGE_KEY_PAYMENT_SETTINGS);
  return normalizeSettings(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : initialPaymentSettings);
}

function saveStoredSettings(settings) {
  writeJson(STORAGE_KEY_PAYMENT_SETTINGS, settings);
  return settings;
}

function getStoredSchedules() {
  const saved = readJson(STORAGE_KEY_CLIENT_PAYMENTS);
  return Array.isArray(saved) ? saved.map(normalizeSchedule) : mockProjectPaymentSchedules.map(normalizeSchedule);
}

function saveStoredSchedules(rows) {
  writeJson(STORAGE_KEY_CLIENT_PAYMENTS, rows);
  return rows;
}

function getStoredAgencyPayouts() {
  const saved = readJson(STORAGE_KEY_AGENCY_PAYOUTS);
  if (!Array.isArray(saved)) return mockAgencyPayouts.map(normalizeAgencyPayout);
  // Fill in bill due dates for records saved before the field existed.
  return saved.map((item) => {
    const normalized = normalizeAgencyPayout(item);
    if (normalized.dueDate) return normalized;
    const seed = mockAgencyPayouts.find((m) => m.id === normalized.id);
    return { ...normalized, dueDate: seed?.dueDate || '' };
  });
}

function saveStoredAgencyPayouts(rows) {
  writeJson(STORAGE_KEY_AGENCY_PAYOUTS, rows);
  return rows;
}

function getStoredLabourPayouts() {
  const saved = readJson(STORAGE_KEY_LABOUR_PAYOUTS);
  return Array.isArray(saved) && saved.length > 0
    ? saved.map(normalizeLabourPayout)
    : mockLabourPayouts.map(normalizeLabourPayout);
}

function saveStoredLabourPayouts(rows) {
  writeJson(STORAGE_KEY_LABOUR_PAYOUTS, rows);
  return rows;
}

function makeMockBudgetInstallments(totalCost, advancePercentage, count) {
  const cost = asNumber(totalCost, 0);
  const advancePercent = Math.max(0, Math.min(100, asNumber(advancePercentage, 10)));
  const total = Math.max(1, Math.min(12, asNumber(count, 1)));
  const advance = Math.round((cost * advancePercent) / 100);
  const remaining = Math.max(0, cost - advance);
  const rows = [];
  if (advancePercent > 0 && total > 1) {
    rows.push({
      id: 'inst-1',
      title: `Booking Advance (${advancePercent}%)`,
      amount: advance,
      dueDate: '',
      status: 'pending',
      paidAmount: 0,
      paidDate: '',
      paymentMode: null,
      receiptNumber: null,
      receiptUrl: null,
    });
  }
  const milestones = advancePercent > 0 && total > 1 ? total - 1 : total;
  const each = milestones > 0 ? Math.round(remaining / milestones) : 0;
  for (let index = 0; index < milestones; index += 1) {
    const amount = index === milestones - 1 ? Math.max(0, remaining - each * index) : each;
    rows.push({
      id: `inst-${rows.length + 1}`,
      title: `Installment ${index + 1}`,
      amount,
      dueDate: '',
      status: 'pending',
      paidAmount: 0,
      paidDate: '',
      paymentMode: null,
      receiptNumber: null,
      receiptUrl: null,
    });
  }
  return rows;
}

const mockPaymentService = {
  async getSettings() {
    return getStoredSettings();
  },

  async saveSettings(data) {
    return saveStoredSettings(normalizeSettings({ ...getStoredSettings(), ...(data || {}) }));
  },

  async getSchedules() {
    return getStoredSchedules();
  },

  async getSchedule(projectId) {
    return getStoredSchedules().find((row) => sameId(row.projectId, projectId)) || null;
  },

  async createBudget(projectId, data) {
    const cost = asNumber(data?.totalCost, 0);
    const advancePercent = asNumber(data?.advancePercentage, 10);
    const count = asNumber(data?.milestoneCount, 1);
    const rows = getStoredSchedules().map((row) => (
      sameId(row.projectId, projectId)
        ? { ...row, totalCost: cost, installments: makeMockBudgetInstallments(cost, advancePercent, count) }
        : row
    ));
    saveStoredSchedules(rows);
    return rows.find((row) => sameId(row.projectId, projectId)) || null;
  },

  async addInstallment(projectId, data) {
    const source = data || {};
    let added = null;
    const rows = getStoredSchedules().map((row) => {
      if (!sameId(row.projectId, projectId)) return row;
      const installment = normalizeInstallment({
        ...source,
        id: toId(source.id) || `inst-${Date.now()}`,
        status: source.status || 'pending',
        paidAmount: 0,
        paidDate: '',
      }, (row.installments || []).length);
      added = installment;
      return { ...row, installments: [...(row.installments || []), installment] };
    });
    saveStoredSchedules(rows);
    return added;
  },

  async updateInstallment(id, data) {
    let updated = null;
    const rows = getStoredSchedules().map((row) => ({
      ...row,
      installments: (row.installments || []).map((item) => {
        if (!sameId(item.id, id)) return item;
        updated = normalizeInstallment({ ...item, ...(data || {}) }, 0);
        return updated;
      }),
    }));
    saveStoredSchedules(rows);
    return updated;
  },

  async deleteInstallment(id) {
    const rows = getStoredSchedules().map((row) => ({
      ...row,
      installments: (row.installments || []).filter((item) => !sameId(item.id, id)),
    }));
    saveStoredSchedules(rows);
    return true;
  },

  async recordInstallmentPayment(id, data) {
    let updated = null;
    const paidDate = asDate(data?.paidDate) || new Date().toISOString().split('T')[0];
    const rows = getStoredSchedules().map((row) => ({
      ...row,
      installments: (row.installments || []).map((item) => {
        if (!sameId(item.id, id)) return item;
        updated = normalizeInstallment({
          ...item,
          ...(data || {}),
          paidAmount: asNumber(data?.amount, item.amount),
          paidDate,
          status: 'paid',
          receiptNumber: data?.receiptNumber || item.receiptNumber || `REC-${new Date().getFullYear()}-${id}`,
        }, 0);
        return updated;
      }),
    }));
    saveStoredSchedules(rows);
    return updated;
  },

  /** Mirrors the Payments page's "Save Schedule" action against the local rows. */
  async savePaymentPlan(projectId, plan) {
    const source = plan || {};
    const installments = Array.isArray(source.installments)
      ? source.installments.map((item, index) => normalizeInstallment(item, index))
      : [];
    const rows = getStoredSchedules().map((row) => (
      sameId(row.projectId, projectId)
        ? { ...row, totalCost: asNumber(source.totalCost, row.totalCost), installments }
        : row
    ));
    saveStoredSchedules(rows);
    return rows;
  },

  async getAgencyPayouts() {
    return getStoredAgencyPayouts();
  },

  async getAgencyPayout(id) {
    return getStoredAgencyPayouts().find((row) => sameId(row.id, id)) || null;
  },

  async createAgencyPayout(data) {
    const source = data || {};
    const billed = asNumber(source.billAmount, 0);
    const paid = Math.min(billed, Math.max(0, asNumber(source.paidAmount, 0)));
    const record = normalizeAgencyPayout({
      ...source,
      id: toId(source.id) || `apx-${Date.now()}`,
      billAmount: billed,
      paidAmount: paid,
      pendingBalance: Math.max(0, billed - paid),
      status: paid >= billed && billed > 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'pending',
    });
    saveStoredAgencyPayouts([record, ...getStoredAgencyPayouts()]);
    return record;
  },

  async updateAgencyPayout(id, data) {
    let updated = null;
    const rows = getStoredAgencyPayouts().map((row) => {
      if (!sameId(row.id, id)) return row;
      updated = normalizeAgencyPayout({ ...row, ...(data || {}) });
      return updated;
    });
    saveStoredAgencyPayouts(rows);
    return updated;
  },

  async deleteAgencyPayout(id) {
    saveStoredAgencyPayouts(getStoredAgencyPayouts().filter((row) => !sameId(row.id, id)));
    return true;
  },

  async payAgencyPayout(id, data) {
    let updated = null;
    const rows = getStoredAgencyPayouts().map((row) => {
      if (!sameId(row.id, id)) return row;
      const paid = row.paidAmount + asNumber(data?.amount, 0);
      updated = normalizeAgencyPayout({
        ...row,
        ...(data || {}),
        paidAmount: paid,
        pendingBalance: Math.max(0, row.billAmount - paid),
        status: paid >= row.billAmount ? 'paid' : 'partially_paid',
      });
      return updated;
    });
    saveStoredAgencyPayouts(rows);
    return updated;
  },

  async getLabourPayouts(filters = {}) {
    const rows = getStoredLabourPayouts();
    const query = String(filters.search || '').trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.project && !sameId(row.projectId, filters.project)) return false;
      if (filters.trade && String(row.trade || '').toLowerCase() !== String(filters.trade).toLowerCase()) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (!query) return true;
      return [row.workerName, row.trade, row.voucherNumber, row.projectName]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  },

  async getLabourSummary() {
    const rows = getStoredLabourPayouts();
    return {
      totalDisbursed: rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0),
      totalPending: rows.filter((row) => !['paid', 'rejected'].includes(row.status)).reduce((sum, row) => sum + row.amount, 0),
      workers: new Set(rows.map((row) => row.workerName)).size,
    };
  },

  async getLabourPayout(id) {
    return getStoredLabourPayouts().find((row) => sameId(row.id, id)) || null;
  },

  async createLabourPayout(data) {
    const record = normalizeLabourPayout({
      ...(data || {}),
      id: toId(data?.id) || `lab-${Date.now()}`,
    });
    saveStoredLabourPayouts([record, ...getStoredLabourPayouts()]);
    return record;
  },

  async updateLabourPayout(id, data) {
    let updated = null;
    const rows = getStoredLabourPayouts().map((row) => {
      if (!sameId(row.id, id)) return row;
      updated = normalizeLabourPayout({ ...row, ...(data || {}) });
      return updated;
    });
    saveStoredLabourPayouts(rows);
    return updated;
  },

  async deleteLabourPayout(id) {
    saveStoredLabourPayouts(getStoredLabourPayouts().filter((row) => !sameId(row.id, id)));
    return true;
  },

  async payLabourPayout(id, data) {
    let updated = null;
    const rows = getStoredLabourPayouts().map((row) => {
      if (!sameId(row.id, id)) return row;
      updated = normalizeLabourPayout({
        ...row,
        ...(data || {}),
        status: 'paid',
        paidDate: asDate(data?.paidDate) || new Date().toISOString().split('T')[0],
      });
      return updated;
    });
    saveStoredLabourPayouts(rows);
    return updated;
  },
};

function toApiSettings(data) {
  const body = pick(data || {}, SETTINGS_FIELDS);
  SETTINGS_NUMBER_FIELDS.forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  return body;
}

function toApiBudget(data) {
  const body = pick(data || {}, SCHEDULE_WRITE_FIELDS);
  ['totalCost', 'advancePercentage', 'milestoneCount'].forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  return body;
}

function toApiInstallment(data) {
  const body = pick(data || {}, INSTALLMENT_WRITE_FIELDS);
  if ('amount' in body) body.amount = asNumber(body.amount);
  if ('dueDate' in body) body.dueDate = asDate(body.dueDate);
  return body;
}

function toApiPayment(data) {
  const body = pick(data || {}, PAYMENT_WRITE_FIELDS);
  if ('amount' in body) body.amount = asNumber(body.amount);
  if ('paidDate' in body) body.paidDate = asDate(body.paidDate);
  return body;
}

function toApiAgencyPayout(data) {
  const source = data || {};
  const body = pick(source, AGENCY_WRITE_FIELDS);
  if ('agencyId' in body) {
    const agencyId = toApiAgencyId(body.agencyId);
    if (agencyId === null) throw new Error('Select a valid agency');
    body.agencyId = agencyId;
  }
  if ('projectId' in body) {
    const projectId = toApiProjectId(body.projectId);
    if (projectId === null) throw new Error('Select a valid project');
    body.projectId = projectId;
  }
  ['billAmount', 'paidAmount'].forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  if ('paymentDate' in body) body.paymentDate = asDate(body.paymentDate);
  return body;
}

function toApiAgencyPayment(data) {
  const body = pick(data || {}, AGENCY_PAYMENT_FIELDS);
  if ('amount' in body) body.amount = asNumber(body.amount);
  if ('paymentDate' in body) body.paymentDate = asDate(body.paymentDate);
  return body;
}

function toApiLabourPayout(data) {
  const source = data || {};
  const body = pick(source, LABOUR_WRITE_FIELDS);
  if ('projectId' in body) {
    const projectId = toApiProjectId(body.projectId);
    if (projectId === null) throw new Error('Select a valid project');
    body.projectId = projectId;
  }
  if ('workerUserId' in body && (body.workerUserId === '' || body.workerUserId === null)) {
    delete body.workerUserId;
  }
  ['rate', 'units', 'amount'].forEach((key) => {
    if (key in body) body[key] = asNumber(body[key]);
  });
  if ('paidDate' in body) body.paidDate = asDate(body.paidDate);
  return body;
}

function requireObject(row, message) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(message);
  return row;
}

const livePaymentService = {
  async getSettings() {
    try {
      const row = await apiClient.get(SETTINGS_URL);
      return row && typeof row === 'object' && Object.keys(row).length > 0
        ? normalizeSettings(row)
        : mockPaymentService.getSettings();
    } catch {
      return mockPaymentService.getSettings();
    }
  },

  async saveSettings(data) {
    try {
      const row = await apiClient.patch(SETTINGS_URL, toApiSettings(data));
      const settings = normalizeSettings(requireObject(row, 'Payments API returned invalid settings'));
      saveStoredSettings(settings);
      return settings;
    } catch {
      return mockPaymentService.saveSettings(data);
    }
  },

  async getSchedules() {
    try {
      const rows = extractRows(await apiClient.getAll(SCHEDULES_URL));
      return rows.length > 0
        ? rows.map(normalizeSchedule)
        : mockPaymentService.getSchedules();
    } catch {
      return mockPaymentService.getSchedules();
    }
  },

  async getSchedule(projectId) {
    const id = toApiProjectId(projectId);
    if (id === null) return mockPaymentService.getSchedule(projectId);
    try {
      const row = await apiClient.get(`${SCHEDULES_URL}${id}/`);
      return normalizeSchedule(requireObject(row, 'Payments API returned an invalid schedule'));
    } catch {
      return mockPaymentService.getSchedule(projectId);
    }
  },

  async createBudget(projectId, data) {
    const id = toApiProjectId(projectId);
    if (id === null) return mockPaymentService.createBudget(projectId, data);
    try {
      const row = await apiClient.post(`${SCHEDULES_URL}${id}/budget/`, toApiBudget(data));
      requireObject(row, 'Payments API returned an invalid schedule');
      return livePaymentService.getSchedules();
    } catch {
      return mockPaymentService.createBudget(projectId, data);
    }
  },

  async addInstallment(projectId, data) {
    const id = toApiProjectId(projectId);
    if (id === null) return mockPaymentService.addInstallment(projectId, data);
    try {
      const row = await apiClient.post(`${SCHEDULES_URL}${id}/installments/`, toApiInstallment(data));
      return normalizeInstallment(requireObject(row, 'Payments API returned an invalid installment'), 0);
    } catch {
      return mockPaymentService.addInstallment(projectId, data);
    }
  },

  async updateInstallment(id, data) {
    try {
      const row = await apiClient.patch(`${INSTALLMENTS_URL}${id}/`, toApiInstallment(data));
      return normalizeInstallment(requireObject(row, 'Payments API returned an invalid installment'), 0);
    } catch {
      return mockPaymentService.updateInstallment(id, data);
    }
  },

  async deleteInstallment(id) {
    try {
      await apiClient.delete(`${INSTALLMENTS_URL}${id}/`);
      return true;
    } catch {
      return mockPaymentService.deleteInstallment(id);
    }
  },

  async recordInstallmentPayment(id, data) {
    try {
      const row = await apiClient.post(`${INSTALLMENTS_URL}${id}/payment/`, toApiPayment(data));
      return normalizeInstallment(requireObject(row, 'Payments API returned an invalid installment'), 0);
    } catch {
      return mockPaymentService.recordInstallmentPayment(id, data);
    }
  },

  /**
   * The "Save Schedule" button edits the whole plan at once. The backend exposes smaller
   * operations, so rebuild the budget first, then apply titles/dates and paid statuses.
   */
  async savePaymentPlan(projectId, plan) {
    const id = toApiProjectId(projectId);
    const source = plan || {};
    if (id === null) return mockPaymentService.savePaymentPlan(projectId, plan);

    try {
      const formInstallments = Array.isArray(source.installments) ? source.installments : [];
      const advancePercent = asNumber(source.advancePercentage, 10);
      const budget = await apiClient.post(`${SCHEDULES_URL}${id}/budget/`, {
        totalCost: asNumber(source.totalCost, 0),
        advancePercentage: advancePercent,
        milestoneCount: Math.max(1, formInstallments.length + (advancePercent > 0 ? 1 : 0)),
      });
      const schedule = normalizeSchedule(requireObject(budget, 'Payments API returned an invalid schedule'));
      const backendRows = schedule.installments || [];
      const offset = advancePercent > 0 && backendRows.length === formInstallments.length + 1 ? 1 : 0;

      for (let index = 0; index < formInstallments.length; index += 1) {
        const formInstallment = formInstallments[index] || {};
        const backendInstallment = backendRows[index + offset];
        if (!backendInstallment) break;
        const patch = pick(formInstallment, ['title', 'dueDate']);
        if ('amount' in formInstallment) patch.amount = asNumber(formInstallment.amount);
        if ('dueDate' in patch) patch.dueDate = asDate(patch.dueDate);
        if (Object.keys(patch).length > 0 && backendInstallment.status !== 'paid') {
          try {
            await apiClient.patch(`${INSTALLMENTS_URL}${backendInstallment.id}/`, patch);
          } catch {
            // Keep going: a rejected edit must not block the rest of the plan.
          }
        }
        if (formInstallment.status === 'paid' && backendInstallment.status !== 'paid') {
          const amount = asNumber(formInstallment.paidAmount ?? formInstallment.amount, 0);
          if (amount <= 0) continue;
          try {
            await apiClient.post(
              `${INSTALLMENTS_URL}${backendInstallment.id}/payment/`,
              toApiPayment({
                amount,
                paidDate: formInstallment.paidDate,
                paymentMode: formInstallment.paymentMode,
                receiptNumber: formInstallment.receiptNumber,
                notes: formInstallment.notes,
              })
            );
          } catch {
            // The refreshed rows below show whatever the backend accepted.
          }
        }
      }
      return livePaymentService.getSchedules();
    } catch {
      return mockPaymentService.savePaymentPlan(projectId, plan);
    }
  },

  async getAgencyPayouts(filters = {}) {
    const query = pick(filters, ['project', 'agency', 'status', 'search']);
    const params = {
      project: query.project ? toApiProjectId(query.project) : undefined,
      agency: query.agency ? toApiAgencyId(query.agency) : undefined,
      status: query.status === 'all' ? undefined : query.status,
      search: query.search,
    };
    try {
      const rows = extractRows(await apiClient.getAll(AGENCY_URL, params));
      return rows.length > 0
        ? rows.map(normalizeAgencyPayout)
        : mockPaymentService.getAgencyPayouts();
    } catch {
      return mockPaymentService.getAgencyPayouts();
    }
  },

  async getAgencyPayout(id) {
    try {
      const row = await apiClient.get(`${AGENCY_URL}${id}/`);
      return normalizeAgencyPayout(requireObject(row, 'Payments API returned an invalid agency bill'));
    } catch {
      return mockPaymentService.getAgencyPayout(id);
    }
  },

  async createAgencyPayout(data) {
    try {
      const body = toApiAgencyPayout(data);
      const row = await apiClient.post(AGENCY_URL, body);
      return normalizeAgencyPayout(requireObject(row, 'Payments API returned an invalid agency bill'));
    } catch {
      return mockPaymentService.createAgencyPayout(data);
    }
  },

  async updateAgencyPayout(id, data) {
    try {
      const row = await apiClient.patch(`${AGENCY_URL}${id}/`, toApiAgencyPayout(data));
      return normalizeAgencyPayout(requireObject(row, 'Payments API returned an invalid agency bill'));
    } catch {
      return mockPaymentService.updateAgencyPayout(id, data);
    }
  },

  async deleteAgencyPayout(id) {
    try {
      await apiClient.delete(`${AGENCY_URL}${id}/`);
      return true;
    } catch {
      return mockPaymentService.deleteAgencyPayout(id);
    }
  },

  async payAgencyPayout(id, data) {
    try {
      const row = await apiClient.post(`${AGENCY_URL}${id}/payment/`, toApiAgencyPayment(data));
      return normalizeAgencyPayout(requireObject(row, 'Payments API returned an invalid agency bill'));
    } catch {
      return mockPaymentService.payAgencyPayout(id, data);
    }
  },

  async getLabourPayouts(filters = {}) {
    const params = pick(filters, ['project', 'trade', 'status', 'search']);
    if (params.project) params.project = toApiProjectId(params.project);
    try {
      const rows = extractRows(await apiClient.getAll(LABOUR_URL, params));
      return rows.length > 0
        ? rows.map(normalizeLabourPayout)
        : mockPaymentService.getLabourPayouts(filters);
    } catch {
      return mockPaymentService.getLabourPayouts(filters);
    }
  },

  async getLabourSummary() {
    try {
      const row = await apiClient.get(`${LABOUR_URL}summary/`);
      return row && typeof row === 'object'
        ? {
            totalDisbursed: asNumber(row.totalDisbursed, 0),
            totalPending: asNumber(row.totalPending, 0),
            workers: asNumber(row.workers, 0),
          }
        : mockPaymentService.getLabourSummary();
    } catch {
      return mockPaymentService.getLabourSummary();
    }
  },

  async getLabourPayout(id) {
    try {
      const row = await apiClient.get(`${LABOUR_URL}${id}/`);
      return normalizeLabourPayout(requireObject(row, 'Payments API returned an invalid labour payout'));
    } catch {
      return mockPaymentService.getLabourPayout(id);
    }
  },

  async createLabourPayout(data) {
    try {
      const row = await apiClient.post(LABOUR_URL, toApiLabourPayout(data));
      return normalizeLabourPayout(requireObject(row, 'Payments API returned an invalid labour payout'));
    } catch {
      return mockPaymentService.createLabourPayout(data);
    }
  },

  async updateLabourPayout(id, data) {
    try {
      const row = await apiClient.patch(`${LABOUR_URL}${id}/`, toApiLabourPayout(data));
      return normalizeLabourPayout(requireObject(row, 'Payments API returned an invalid labour payout'));
    } catch {
      return mockPaymentService.updateLabourPayout(id, data);
    }
  },

  async deleteLabourPayout(id) {
    try {
      await apiClient.delete(`${LABOUR_URL}${id}/`);
      return true;
    } catch {
      return mockPaymentService.deleteLabourPayout(id);
    }
  },

  async payLabourPayout(id, data) {
    try {
      const row = await apiClient.post(`${LABOUR_URL}${id}/pay/`, pick(data || {}, ['paidDate', 'paymentMode']));
      return normalizeLabourPayout(requireObject(row, 'Payments API returned an invalid labour payout'));
    } catch {
      return mockPaymentService.payLabourPayout(id, data);
    }
  },
};

export const paymentService = withBackend(mockPaymentService, livePaymentService);

export { mockPaymentService, livePaymentService };

export default paymentService;
