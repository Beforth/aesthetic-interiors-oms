import { apiClient } from './apiClient';
import { isDebug } from '../config/env';

/**
 * The dashboard's own numbers from the backend. In debug mode (no backend) there is nothing to fetch, so the page
 * keeps using the mock lists it already has.
 */
export const dashboardService = {
  /** Birthdays this month and the newest joiners, or null in debug mode. */
  async getSummary() {
    if (isDebug()) return null;
    return apiClient.get('/dashboard/summary/');
  },
};

export default dashboardService;
