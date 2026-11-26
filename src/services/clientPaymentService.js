import { apiClient } from './apiClient';
import { withBackend } from './serviceMode';

/**
 * A signed-in client's own payments: what they owe the company per project, what they have paid (how and when),
 * and where to send the money. The server returns only the projects that belong to the client.
 * Live only; the standalone mock mode has no payment schedules for a client, so the screen shows its empty state.
 */
const mockClientPaymentService = {
  async getSchedules() {
    return [];
  },
  async getPayTo() {
    return null;
  },
};

const liveClientPaymentService = {
  getSchedules: () => apiClient.getAll('/payments/schedules/'),
  getPayTo: () => apiClient.get('/payments/pay-to/'),
};

export const clientPaymentService = withBackend(mockClientPaymentService, liveClientPaymentService);

export default clientPaymentService;
