import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type { Dossier, DossierRequest } from '../utils/types';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for the audit dossier of a training action: everything a DGERT /
 * IEFP auditor asks for about one course, plus the gaps still to be fixed.
 * Course team only; the client sends the `cio-org-id` header automatically.
 */
export class DossierApi extends BaseApiWithErrors {
  dossier = $state<Dossier | null>(null);

  /** Loads (or reloads) the dossier of one course. */
  async load(courseId: string) {
    await this.execute<DossierRequest>({
      requestFn: () => classroomio.course[':courseId'].dossier.$get({ param: { courseId } }),
      logContext: 'fetching course audit dossier',
      onSuccess: (response) => {
        if (response.data) {
          this.dossier = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('dossier.snackbar.load_failed');
        }
      }
    });
  }

  override reset() {
    super.reset();
    this.dossier = null;
  }
}

export const dossierApi = /* @__PURE__ */ new DossierApi();
