import { apiClient } from './apiClient';

/**
 * Payments, live (backend) only: /api/v1/payments/. The Payments page keeps its own local data in the standalone
 * mock mode (VITE_DEBUG=true) and calls this service when there is a backend.
 */
const BASE = '/payments';

/** Empty values are left out, so the server's own defaults (receipt, voucher and invoice numbers) apply. */
function clean(body) {
  const result = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') result[key] = value;
  });
  return result;
}

const num = (value) => (value === '' || value === undefined || value === null ? undefined : Number(value));

export const paymentService = {
  // ---- client payment schedules ----------------------------------------------------------------------------------
  /** One row per project: totals plus its installments (paid, pending or overdue). */
  getSchedules() {
    return apiClient.getAll(`${BASE}/schedules/`);
  },

  /** Sets the contract value and rebuilds the schedule: an advance plus equal milestones. */
  setBudget(projectId, { totalCost, advancePercentage, milestoneCount }) {
    return apiClient.post(`${BASE}/schedules/${projectId}/budget/`, {
      totalCost: Number(totalCost),
      advancePercentage: Number(advancePercentage),
      milestoneCount: Number(milestoneCount),
    });
  },

  recordPayment(installmentId, form) {
    return apiClient.post(
      `${BASE}/installments/${installmentId}/payment/`,
      clean({
        amount: Number(form.amount),
        paidDate: form.paidDate,
        paymentMode: form.paymentMode,
        receiptNumber: (form.receiptNumber || '').trim(),
        notes: form.notes,
      })
    );
  },

  // ---- labour -----------------------------------------------------------------------------------------------------
  getLabour() {
    return apiClient.getAll(`${BASE}/labour/`);
  },

  createLabour(form) {
    return apiClient.post(
      `${BASE}/labour/`,
      clean({
        workerName: (form.workerName || '').trim(),
        trade: form.trade,
        projectId: num(form.projectId),
        wageType: form.wageType,
        rate: num(form.rate),
        units: num(form.units),
        unitLabel: form.unitLabel,
        amount: num(form.amount),
        status: form.status,
        paidDate: form.status === 'paid' ? form.paidDate : undefined,
        paymentMode: form.paymentMode,
        voucherNumber: (form.voucherNumber || '').trim(),
        notes: form.notes,
      })
    );
  },

  payLabour(id, paymentMode) {
    return apiClient.post(`${BASE}/labour/${id}/pay/`, clean({ paymentMode }));
  },

  // ---- agency bills -----------------------------------------------------------------------------------------------
  getAgencyPayouts() {
    return apiClient.getAll(`${BASE}/agency-payouts/`);
  },

  createAgencyPayout(form) {
    const paid = num(form.paidAmount) || 0;
    return apiClient.post(
      `${BASE}/agency-payouts/`,
      clean({
        agencyId: num(form.agencyId),
        projectId: num(form.projectId),
        workStage: form.workStage,
        invoiceNumber: (form.invoiceNumber || '').trim(),
        billAmount: num(form.billAmount),
        paidAmount: paid,
        paymentDate: paid > 0 ? form.paymentDate : undefined,
        paymentMode: form.paymentMode,
        transactionRef: form.transactionRef,
        notes: form.notes,
      })
    );
  },

  /** Adds a payment against a bill; the server refuses more than what is still owed. */
  payAgency(id, { amount, paymentDate, paymentMode, transactionRef }) {
    return apiClient.post(
      `${BASE}/agency-payouts/${id}/payment/`,
      clean({ amount: Number(amount), paymentDate, paymentMode, transactionRef })
    );
  },
};

export default paymentService;
