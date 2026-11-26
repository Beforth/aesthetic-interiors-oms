import { apiClient, USER_KEY } from './apiClient';
import { withBackend } from './serviceMode';

/**
 * A staff member's own money requests (expense claims and salary advances) and their own payslips.
 *
 * The live methods talk to the API only and never fall back to sample rows: the server already returns just the
 * signed-in person's records, so an empty list must stay empty. The mock methods (standalone mode) keep a small
 * local copy so the screens can be tried without a backend.
 */
const CLAIMS_URL = '/expenses/claims/';
const ADVANCES_URL = '/expenses/advances/';
const PAYSLIPS_URL = '/payroll/my-payslips/';
const MOCK_KEY = 'osm_my_finance_v1';

function signedInUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function readMock() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MOCK_KEY) || '{}');
    return { claims: parsed.claims || [], advances: parsed.advances || [] };
  } catch {
    return { claims: [], advances: [] };
  }
}

function writeMock(data) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(data));
  } catch {
    // the demo copy just is not kept
  }
}

function mineOnly(rows) {
  const me = String(signedInUser().id ?? '');
  return rows.filter((row) => String(row.ownerId) === me);
}

const mockMyFinanceService = {
  async listClaims() {
    return mineOnly(readMock().claims);
  },
  async createClaim(data) {
    const me = signedInUser();
    const store = readMock();
    const row = {
      id: `mc_${Date.now()}`,
      ownerId: String(me.id ?? ''),
      spentBy: me.name || 'Me',
      title: data.title,
      category: data.category,
      amount: Number(data.amount) || 0,
      date: data.date,
      paymentMethod: data.paymentMethod,
      notes: data.notes || '',
      receiptName: data.receiptName || '',
      receiptUrl: data.receiptUrl || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    writeMock({ ...store, claims: [row, ...store.claims] });
    return row;
  },
  async withdrawClaim(id) {
    const store = readMock();
    writeMock({ ...store, claims: store.claims.map((r) => (String(r.id) === String(id) && r.status === 'pending' ? { ...r, status: 'withdrawn' } : r)) });
    return true;
  },
  async listAdvances() {
    return mineOnly(readMock().advances);
  },
  async createAdvance(data) {
    const me = signedInUser();
    const store = readMock();
    const row = {
      id: `ma_${Date.now()}`,
      ownerId: String(me.id ?? ''),
      employee: me.name || 'Me',
      title: data.title,
      amount: Number(data.amount) || 0,
      dateRequired: data.dateRequired,
      reason: data.reason || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    writeMock({ ...store, advances: [row, ...store.advances] });
    return row;
  },
  async withdrawAdvance(id) {
    const store = readMock();
    writeMock({ ...store, advances: store.advances.map((r) => (String(r.id) === String(id) && r.status === 'pending' ? { ...r, status: 'withdrawn' } : r)) });
    return true;
  },
  async listPayslips() {
    return [];
  },
  async getCompany() {
    return { companyName: 'Aesthetic Interiors', companyAddress: '', pfNumber: '', panNumber: '' };
  },
};

const liveMyFinanceService = {
  listClaims: () => apiClient.get(CLAIMS_URL),
  createClaim: (data) =>
    apiClient.post(CLAIMS_URL, {
      title: data.title,
      category: data.category,
      amount: Number(data.amount) || 0,
      date: data.date,
      paymentMethod: data.paymentMethod,
      notes: data.notes || '',
      receiptName: data.receiptName || '',
      receiptUrl: data.receiptUrl || '',
      receiptType: data.receiptUrl ? 'image/jpeg' : '',
    }),
  async withdrawClaim(id) {
    await apiClient.post(`${CLAIMS_URL}${id}/withdraw/`, {});
    return true;
  },
  listAdvances: () => apiClient.get(ADVANCES_URL),
  createAdvance: (data) =>
    apiClient.post(ADVANCES_URL, {
      title: data.title,
      amount: Number(data.amount) || 0,
      dateRequired: data.dateRequired,
      reason: data.reason || '',
    }),
  async withdrawAdvance(id) {
    await apiClient.post(`${ADVANCES_URL}${id}/withdraw/`, {});
    return true;
  },
  listPayslips: () => apiClient.get(PAYSLIPS_URL),
  getCompany: () => apiClient.get('/payroll/settings/'),
};

export const myFinanceService = withBackend(mockMyFinanceService, liveMyFinanceService);

export default myFinanceService;
