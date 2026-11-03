/**
 * Aesthetic Interiors Operations Management System (OMS)
 * Incentive & Performance Bonus Service
 */

import { mockIncentives } from '../data/incentives';

const STORAGE_KEY = 'osm_incentives_store_v1';

function getStoredIncentives() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockIncentives));
      return [...mockIncentives];
    }
    return JSON.parse(raw);
  } catch {
    return [...mockIncentives];
  }
}

function saveIncentives(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save incentives:', err);
  }
}

export const incentiveService = {
  getIncentives() {
    return getStoredIncentives();
  },

  getIncentiveById(id) {
    const list = getStoredIncentives();
    return list.find((i) => i.id === id) || null;
  },

  createIncentive(data) {
    const list = getStoredIncentives();
    const newRecord = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipientId: data.recipientId || 'custom',
      recipientName: data.recipientName || 'Unassigned Worker',
      recipientRole: data.recipientRole || 'Artisan',
      trade: data.trade || 'General Execution',
      projectId: data.projectId || 'P1',
      projectName: data.projectName || 'Indiranagar 4BHK Luxury Villa',
      category: data.category || 'Special Achievement',
      title: data.title || 'Performance Bonus',
      description: data.description || '',
      amount: Number(data.amount) || 0,
      status: data.status || 'PENDING',
      awardedDate: data.awardedDate || new Date().toISOString().split('T')[0],
      paidDate: data.status === 'PAID' ? new Date().toISOString().split('T')[0] : null,
      paymentMethod: data.paymentMethod || null,
      referenceNo: data.status === 'PAID' ? `TXN-INC-${Math.floor(10000 + Math.random() * 90000)}` : null,
      approvedBy: data.status !== 'PENDING' ? (data.approvedBy || 'Rohit Kumar (Owner)') : null,
    };

    const updated = [newRecord, ...list];
    saveIncentives(updated);
    return newRecord;
  },

  updateIncentive(id, updates) {
    const list = getStoredIncentives();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const updatedRecord = {
      ...list[idx],
      ...updates,
      amount: updates.amount !== undefined ? Number(updates.amount) : list[idx].amount,
    };
    list[idx] = updatedRecord;
    saveIncentives(list);
    return updatedRecord;
  },

  approveIncentive(id, approvedBy = 'Rohit Kumar (Owner)') {
    const list = getStoredIncentives();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      status: 'APPROVED',
      approvedBy,
    };
    saveIncentives(list);
    return list[idx];
  },

  markAsPaid(id, { paymentMethod = 'Bank Transfer (IMPS)', referenceNo = null } = {}) {
    const list = getStoredIncentives();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const generatedRef = referenceNo || `TXN-INC-${Math.floor(10000 + Math.random() * 90000)}`;

    list[idx] = {
      ...list[idx],
      status: 'PAID',
      paidDate: todayStr,
      paymentMethod,
      referenceNo: generatedRef,
    };
    saveIncentives(list);
    return list[idx];
  },

  deleteIncentive(id) {
    const list = getStoredIncentives();
    const filtered = list.filter((i) => i.id !== id);
    saveIncentives(filtered);
    return true;
  },

  getStats() {
    const list = getStoredIncentives();
    const totalDisbursed = list
      .filter((i) => i.status === 'PAID')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const pendingPayout = list
      .filter((i) => i.status === 'APPROVED' || i.status === 'PENDING')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const uniqueEarners = new Set(list.map((i) => i.recipientName)).size;

    const highestIncentive = list.reduce(
      (max, curr) => (curr.amount > max ? curr.amount : max),
      0
    );

    return {
      totalDisbursed,
      pendingPayout,
      totalCount: list.length,
      paidCount: list.filter((i) => i.status === 'PAID').length,
      pendingCount: list.filter((i) => i.status === 'PENDING').length,
      approvedCount: list.filter((i) => i.status === 'APPROVED').length,
      uniqueEarners,
      highestIncentive,
    };
  },

  exportCSV(listToExport) {
    const items = listToExport || getStoredIncentives();
    const headers = [
      'Incentive ID',
      'Recipient Name',
      'Role',
      'Trade',
      'Project Site',
      'Scheme / Category',
      'Milestone Title',
      'Amount (INR)',
      'Status',
      'Awarded Date',
      'Paid Date',
      'Payment Reference',
      'Approved By',
    ];

    const rows = items.map((i) => [
      i.id,
      `"${i.recipientName || ''}"`,
      `"${i.recipientRole || ''}"`,
      `"${i.trade || ''}"`,
      `"${i.projectName || ''}"`,
      `"${i.category || ''}"`,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.amount || 0,
      i.status || '',
      i.awardedDate || '',
      i.paidDate || '',
      i.referenceNo || '',
      `"${i.approvedBy || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `incentives_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default incentiveService;
