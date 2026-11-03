import { mockExpenses } from '../data/expenses';

const STORAGE_KEY = 'osm_expenses_v1';

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

export const expenseService = {
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

    // Group by category to find top spending category
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
};

export default expenseService;
