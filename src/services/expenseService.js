import { mockExpenses } from '../data/expenses';
import { apiClient } from './apiClient';
import { withBackend, pick } from './serviceMode';

const STORAGE_KEY = 'osm_expenses_v1';
const ADVANCES_STORAGE_KEY = 'osm_salary_advances_v2';
const CLAIMS_URL = '/expenses/claims/';
const ADVANCES_URL = '/expenses/advances/';

function getStoredExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read expenses from localStorage', e);
  }
  if (mockExpenses && mockExpenses.length > 0) {
    saveExpenses(mockExpenses);
    return mockExpenses;
  }
  return [];
}

function saveExpenses(expenses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('osm_expenses_updated', { detail: expenses }));
    }
  } catch (e) {
    console.error('Failed to save expenses to localStorage', e);
  }
}

async function fetchRows(endpoint, fallback) {
  try {
    const rows = await apiClient.get(endpoint);
    return Array.isArray(rows) && rows.length > 0 ? rows : fallback();
  } catch {
    return fallback();
  }
}

// Salary advances used to live in ExpensesPage localStorage. Keep that data as the offline fallback.
function getStoredAdvances(fallback = []) {
  try {
    const raw = localStorage.getItem(ADVANCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to read salary advances from localStorage', e);
  }
  if (Array.isArray(fallback) && fallback.length > 0) {
    saveStoredAdvances(fallback);
    return [...fallback];
  }
  return [];
}

function saveStoredAdvances(list) {
  try {
    localStorage.setItem(ADVANCES_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save salary advances to localStorage', e);
  }
}

const mockExpenseService = {
  async getAllExpenses() {
    return [...getStoredExpenses()];
  },

  async getExpenseById(id) {
    const list = getStoredExpenses();
    return list.find((e) => e.id === id) || null;
  },

  async createExpense(expenseData) {
    const list = getStoredExpenses();
    const newExpense = {
      id: `exp_${Date.now()}`,
      title: expenseData.title?.trim() || 'Untitled Expense',
      category: expenseData.category || 'Site Materials & Hardware',
      amount: Number(expenseData.amount) || 0,
      projectId: expenseData.projectId || null,
      projectName: expenseData.projectName || 'General Studio / Overhead',
      spentBy: expenseData.spentBy || 'Admin',
      spentById: expenseData.spentById || 'u1',
      date: expenseData.date || new Date().toISOString().split('T')[0],
      paymentMethod: expenseData.paymentMethod || 'UPI / PhonePe / GPay',
      status: expenseData.status || 'pending',
      receiptName: expenseData.receiptName || '',
      receiptUrl: expenseData.receiptUrl || '',
      receiptType: expenseData.receiptType || '',
      notes: expenseData.notes || '',
      createdAt: new Date().toISOString(),
      ...(expenseData.status === 'approved'
        ? { approvedBy: 'Admin', approvedAt: new Date().toISOString() }
        : {}),
    };

    const updated = [newExpense, ...list];
    saveExpenses(updated);
    return newExpense;
  },

  async updateExpense(id, updateData) {
    const list = getStoredExpenses();
    const updated = list.map((item) =>
      item.id === id ? { ...item, ...updateData, updatedAt: new Date().toISOString() } : item
    );
    saveExpenses(updated);
    return updated.find((e) => e.id === id) || null;
  },

  async updateExpenseStatus(id, newStatus, reviewerName = 'Admin') {
    const list = getStoredExpenses();
    const updated = list.map((item) => {
      if (item.id === id) {
        const patch = { status: newStatus };
        if (newStatus === 'approved') {
          patch.approvedBy = reviewerName;
          patch.approvedAt = new Date().toISOString();
        } else if (newStatus === 'reimbursed') {
          patch.reimbursedAt = new Date().toISOString();
        } else if (newStatus === 'rejected') {
          patch.rejectedBy = reviewerName;
          patch.rejectedAt = new Date().toISOString();
        }
        return { ...item, ...patch };
      }
      return item;
    });
    saveExpenses(updated);
    return updated.find((e) => e.id === id) || null;
  },

  async deleteExpense(id) {
    const list = getStoredExpenses();
    const updated = list.filter((item) => item.id !== id);
    saveExpenses(updated);
    return true;
  },

  async getExpenseStats() {
    const list = getStoredExpenses();
    const totalAmount = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const approvedAmount = list
      .filter((e) => e.status === 'approved' || e.status === 'reimbursed')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pendingList = list.filter((e) => e.status === 'pending');
    const pendingAmount = pendingList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const reimbursedAmount = list
      .filter((e) => e.status === 'reimbursed')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const catMap = {};
    list.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + (Number(e.amount) || 0);
    });
    let topCat = 'None';
    let topCatAmount = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > topCatAmount) {
        topCat = cat;
        topCatAmount = amt;
      }
    });

    return {
      totalAmount,
      approvedAmount,
      pendingCount: pendingList.length,
      pendingAmount,
      reimbursedAmount,
      topCategory: topCat,
      topCategoryAmount: topCatAmount,
      totalCount: list.length,
    };
  },

  // Salary advances were kept in the page's localStorage before the backend existed.
  async getAllSalaryAdvances(fallback = []) {
    return getStoredAdvances(fallback);
  },

  async createSalaryAdvance(data, fallback = []) {
    const rows = getStoredAdvances(fallback);
    const row = {
      id: `adv-${Date.now()}`,
      employee: data.employee || '',
      employeeId: data.employeeId || '',
      title: data.title || 'Salary Advance',
      amount: Number(data.amount) || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      dateRequired: data.dateRequired || '',
      reason: data.reason || '',
      emiMonths: Number(data.emiMonths) || 0,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
    };
    saveStoredAdvances([row, ...rows]);
    return row;
  },

  async updateSalaryAdvanceStatus(id, newStatus, details = {}, fallback = []) {
    const rows = getStoredAdvances(fallback).map((row) =>
      String(row.id) === String(id)
        ? {
            ...row,
            status: newStatus,
            ...(newStatus === 'approved'
              ? {
                  approvedAmount: details.approvedAmount,
                  approvalNote: details.approvalNote || '',
                  approvedBy: details.reviewerName || 'Admin',
                  approvedAt: new Date().toISOString().split('T')[0],
                }
              : {}),
          }
        : row
    );
    saveStoredAdvances(rows);
    return rows.find((row) => String(row.id) === String(id)) || null;
  },

  async deleteSalaryAdvance(id, fallback = []) {
    saveStoredAdvances(getStoredAdvances(fallback).filter((row) => String(row.id) !== String(id)));
    return true;
  },
};

const ADVANCE_FIELDS = [
  'employee', 'employeeId', 'employeeRef', 'employeeCode', 'title', 'amount', 'date',
  'dateRequired', 'reason', 'emiMonths',
];

function toApiExpense(data) {
  const body = pick(data, [
    'title', 'category', 'amount', 'projectId', 'projectName', 'spentBy',
    'spentById', 'date', 'paymentMethod', 'receiptName', 'receiptUrl',
    'receiptType', 'notes',
  ]);
  if (body.amount !== undefined) body.amount = Number(body.amount) || 0;
  return body;
}

function toApiAdvance(data) {
  const body = pick(data, ADVANCE_FIELDS);
  if (body.employeeRef === undefined && data.employeeId) body.employeeRef = data.employeeId;
  delete body.employeeId;
  ['amount', 'emiMonths'].forEach((key) => {
    if (key in body) body[key] = Number(body[key]) || 0;
  });
  return body;
}

const liveExpenseService = {
  async getAllExpenses() {
    return fetchRows(CLAIMS_URL, () => mockExpenseService.getAllExpenses());
  },

  async getExpenseById(id) {
    try {
      return await apiClient.get(`${CLAIMS_URL}${id}/`);
    } catch {
      return mockExpenseService.getExpenseById(id);
    }
  },

  async createExpense(data) {
    try {
      return await apiClient.post(CLAIMS_URL, toApiExpense(data));
    } catch {
      return mockExpenseService.createExpense(data);
    }
  },

  async updateExpense(id, data) {
    try {
      return await apiClient.patch(`${CLAIMS_URL}${id}/`, toApiExpense(data));
    } catch {
      return mockExpenseService.updateExpense(id, data);
    }
  },

  async updateExpenseStatus(id, newStatus, reviewerName = 'Admin') {
    try {
      return await apiClient.post(`${CLAIMS_URL}${id}/status/`, { status: newStatus, reviewerName });
    } catch {
      return mockExpenseService.updateExpenseStatus(id, newStatus, reviewerName);
    }
  },

  async deleteExpense(id) {
    try {
      await apiClient.delete(`${CLAIMS_URL}${id}/`);
      return true;
    } catch {
      return mockExpenseService.deleteExpense(id);
    }
  },

  async getExpenseStats() {
    try {
      const summary = await apiClient.get(`${CLAIMS_URL}summary/`);
      if (summary && typeof summary === 'object') return summary;
      return mockExpenseService.getExpenseStats();
    } catch {
      return mockExpenseService.getExpenseStats();
    }
  },

  async getAllSalaryAdvances(fallback = []) {
    try {
      const rows = await apiClient.get(ADVANCES_URL);
      return Array.isArray(rows) && rows.length > 0 ? rows : getStoredAdvances(fallback);
    } catch {
      return getStoredAdvances(fallback);
    }
  },

  async createSalaryAdvance(data, fallback = []) {
    try {
      return await apiClient.post(ADVANCES_URL, toApiAdvance(data));
    } catch {
      return mockExpenseService.createSalaryAdvance(data, fallback);
    }
  },

  async updateSalaryAdvanceStatus(id, newStatus, details = {}, fallback = []) {
    try {
      return await apiClient.post(`${ADVANCES_URL}${id}/status/`, {
        status: newStatus,
        reviewerName: details.reviewerName,
        approvedAmount: details.approvedAmount,
        approvalNote: details.approvalNote,
      });
    } catch {
      return mockExpenseService.updateSalaryAdvanceStatus(id, newStatus, details, fallback);
    }
  },

  async deleteSalaryAdvance(id, fallback = []) {
    try {
      await apiClient.delete(`${ADVANCES_URL}${id}/`);
      return true;
    } catch {
      return mockExpenseService.deleteSalaryAdvance(id, fallback);
    }
  },
};

export const expenseService = withBackend(mockExpenseService, liveExpenseService);

export default expenseService;
