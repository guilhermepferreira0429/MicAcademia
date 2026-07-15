import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type { RevenueReport, RevenueReportRequest } from '../utils/types';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for the revenue-share reporting screen. Org-admin only; the client
 * automatically sends the `cio-org-id` header.
 */
export class RevenueApi extends BaseApiWithErrors {
  report = $state<RevenueReport | null>(null);

  /** Loads the revenue-share report for an optional ISO date range. */
  async loadReport(from?: string, to?: string) {
    const query: { from?: string; to?: string } = {};
    if (from) query.from = from;
    if (to) query.to = to;

    await this.execute<RevenueReportRequest>({
      requestFn: () => classroomio['revenue-share'].report.$get({ query }),
      logContext: 'fetching revenue-share report',
      onSuccess: (response) => {
        if (response.data) {
          this.report = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('revenue_share.snackbar.load_failed');
        }
      }
    });
  }
}

export const revenueApi = /* @__PURE__ */ new RevenueApi();
