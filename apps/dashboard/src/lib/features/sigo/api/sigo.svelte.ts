import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  CreateSigoSubmissionRequest,
  DeleteSigoSubmissionRequest,
  ListSigoSubmissionsRequest,
  SigoSubmission,
  SigoSubmissions,
  UpdateSigoSubmissionRequest
} from '../utils/types';
import {
  ZCreateSigoSubmission,
  ZUpdateSigoSubmission,
  type TCreateSigoSubmission,
  type TUpdateSigoSubmission
} from '@cio/utils/validation/sigo/sigo';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for the SIGO submission tracker. IEFP has no public API, so this is
 * the internal record of where each training-action submission stands.
 */
export class SigoApi extends BaseApiWithErrors {
  submissions = $state<SigoSubmissions>([]);

  /** Fetches all SIGO submissions for the current organization. */
  async list() {
    await this.execute<ListSigoSubmissionsRequest>({
      requestFn: () => classroomio.sigo.$get(),
      logContext: 'fetching SIGO submissions',
      onSuccess: (response) => {
        if (response.data) {
          this.submissions = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('sigo.snackbar.list_failed');
        }
      }
    });
  }

  /** Creates a new submission after client-side validation. */
  async create(fields: TCreateSigoSubmission) {
    const result = ZCreateSigoSubmission.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<CreateSigoSubmissionRequest>({
      requestFn: () => classroomio.sigo.$post({ json: result.data }),
      logContext: 'creating SIGO submission',
      onSuccess: async () => {
        snackbar.success('sigo.snackbar.created');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('sigo.snackbar.create_failed');
          return;
        }
        if ('field' in result && result.field) {
          this.errors[result.field] = result.error;
        } else if ('error' in result) {
          this.errors.general = result.error;
        }
        snackbar.error('sigo.snackbar.create_failed');
      }
    });
  }

  /** Updates an existing submission after client-side validation. */
  async update(submissionId: string, fields: TUpdateSigoSubmission) {
    const result = ZUpdateSigoSubmission.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<UpdateSigoSubmissionRequest>({
      requestFn: () =>
        classroomio.sigo[':submissionId'].$put({
          param: { submissionId },
          json: result.data
        }),
      logContext: 'updating SIGO submission',
      onSuccess: async () => {
        snackbar.success('sigo.snackbar.updated');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('sigo.snackbar.update_failed');
          return;
        }
        if ('field' in result && result.field) {
          this.errors[result.field] = result.error;
        } else if ('error' in result) {
          this.errors.general = result.error;
        }
        snackbar.error('sigo.snackbar.update_failed');
      }
    });
  }

  /** Deletes a submission. */
  async remove(submissionId: string) {
    await this.execute<DeleteSigoSubmissionRequest>({
      requestFn: () =>
        classroomio.sigo[':submissionId'].$delete({
          param: { submissionId }
        }),
      logContext: 'deleting SIGO submission',
      onSuccess: () => {
        this.submissions = this.submissions.filter((submission) => submission.id !== submissionId);
        snackbar.success('sigo.snackbar.deleted');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('sigo.snackbar.delete_failed');
        }
      }
    });
  }

  /** Finds a loaded submission by id. */
  findById(submissionId: string): SigoSubmission | undefined {
    return this.submissions.find((submission) => submission.id === submissionId);
  }
}

export const sigoApi = /* @__PURE__ */ new SigoApi();
