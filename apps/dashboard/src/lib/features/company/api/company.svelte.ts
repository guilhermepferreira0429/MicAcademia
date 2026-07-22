import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  AddCompanyMemberRequest,
  AnnualTraining,
  AnnualTrainingRequest,
  BulkEnrollRequest,
  BulkEnrollResult,
  Companies,
  Company,
  CompanyDetail,
  CompanyDetailRequest,
  CompanyReport,
  CompanyReportRequest,
  CreateCompanyRequest,
  DeleteCompanyRequest,
  ListCompaniesRequest,
  RemoveCompanyMemberRequest,
  UpdateCompanyEnrollmentRequest,
  UpdateCompanyRequest
} from '../utils/types';
import {
  ZAddCompanyMember,
  ZCompanyBulkEnroll,
  ZCreateCompany,
  ZUpdateCompany,
  ZUpdateCompanyEnrollment,
  type TAddCompanyMember,
  type TCompanyBulkEnroll,
  type TCreateCompany,
  type TUpdateCompany,
  type TUpdateCompanyEnrollment
} from '@cio/utils/validation/company/company';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for B2B company accounts: the business customers the academy sells
 * training to. Org-admin only; the client automatically sends the `cio-org-id`
 * header.
 */
export class CompanyApi extends BaseApiWithErrors {
  companies = $state<Companies>([]);
  detail = $state<CompanyDetail | null>(null);
  report = $state<CompanyReport | null>(null);
  annualTraining = $state<AnnualTraining | null>(null);

  /** Result of the last bulk enrolment, so the screen can report the outcome. */
  lastEnrollResult = $state<BulkEnrollResult | null>(null);

  /** Fetches all companies for the current organization. */
  async list() {
    await this.execute<ListCompaniesRequest>({
      requestFn: () => classroomio.company.$get(),
      logContext: 'fetching companies',
      onSuccess: (response) => {
        if (response.data) {
          this.companies = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.list_failed');
        }
      }
    });
  }

  /** Creates a company after client-side validation. */
  async create(fields: TCreateCompany) {
    const result = ZCreateCompany.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<CreateCompanyRequest>({
      requestFn: () => classroomio.company.$post({ json: result.data }),
      logContext: 'creating company',
      onSuccess: async () => {
        snackbar.success('company.snackbar.created');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => this.handleFormError(result, 'company.snackbar.create_failed')
    });
  }

  /** Updates a company after client-side validation. */
  async update(companyId: string, fields: TUpdateCompany) {
    const result = ZUpdateCompany.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<UpdateCompanyRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].$put({
          param: { companyId },
          json: result.data
        }),
      logContext: 'updating company',
      onSuccess: async (response) => {
        snackbar.success('company.snackbar.updated');
        this.success = true;
        this.errors = {};

        if (this.detail?.company.id === companyId && response.data) {
          this.detail = { ...this.detail, company: response.data };
        }

        await this.list();
      },
      onError: (result) => this.handleFormError(result, 'company.snackbar.update_failed')
    });
  }

  /** Deletes a company and everything attached to it. */
  async remove(companyId: string) {
    await this.execute<DeleteCompanyRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].$delete({
          param: { companyId }
        }),
      logContext: 'deleting company',
      onSuccess: () => {
        this.companies = this.companies.filter((company) => company.id !== companyId);
        snackbar.success('company.snackbar.deleted');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.delete_failed');
        }
      }
    });
  }

  /** Loads one company with its staff and its orders. */
  async loadDetail(companyId: string) {
    await this.execute<CompanyDetailRequest>({
      requestFn: () => classroomio.company[':companyId'].$get({ param: { companyId } }),
      logContext: 'fetching company detail',
      onSuccess: (response) => {
        if (response.data) {
          this.detail = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.detail_failed');
        }
      }
    });
  }

  /** Attaches an existing person of the organization to the company's staff. */
  async addMember(companyId: string, fields: TAddCompanyMember) {
    const result = ZAddCompanyMember.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<AddCompanyMemberRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].members.$post({
          param: { companyId },
          json: result.data
        }),
      logContext: 'adding company member',
      onSuccess: (response) => {
        this.applyMembers(response.data);
        snackbar.success('company.snackbar.member_added');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => this.handleFormError(result, 'company.snackbar.member_add_failed')
    });
  }

  /** Removes a person from the company's staff. */
  async removeMember(companyId: string, profileId: string) {
    await this.execute<RemoveCompanyMemberRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].members[':profileId'].$delete({
          param: { companyId, profileId }
        }),
      logContext: 'removing company member',
      onSuccess: (response) => {
        this.applyMembers(response.data);
        snackbar.success('company.snackbar.member_removed');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.member_remove_failed');
        }
      }
    });
  }

  /**
   * Enrols a batch of the company's staff into a course. The API creates one
   * order for the whole batch, so the company is invoiced once.
   */
  async bulkEnroll(companyId: string, fields: TCompanyBulkEnroll) {
    const result = ZCompanyBulkEnroll.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    this.lastEnrollResult = null;

    await this.execute<BulkEnrollRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].enrollments.$post({
          param: { companyId },
          json: result.data
        }),
      logContext: 'enrolling company staff',
      onSuccess: async (response) => {
        if (response.data) {
          this.lastEnrollResult = response.data;
        }

        snackbar.success('company.snackbar.enrolled');
        this.success = true;
        this.errors = {};

        await this.loadDetail(companyId);
      },
      onError: (result) => this.handleFormError(result, 'company.snackbar.enroll_failed')
    });
  }

  /** Updates the billing status / invoice reference of one order. */
  async updateEnrollment(companyId: string, enrollmentId: string, fields: TUpdateCompanyEnrollment) {
    const result = ZUpdateCompanyEnrollment.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<UpdateCompanyEnrollmentRequest>({
      requestFn: () =>
        classroomio.company[':companyId'].enrollments[':enrollmentId'].$put({
          param: { companyId, enrollmentId },
          json: result.data
        }),
      logContext: 'updating company order',
      onSuccess: (response) => {
        if (this.detail && response.data) {
          this.detail = { ...this.detail, enrollments: response.data };
        }

        snackbar.success('company.snackbar.order_updated');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => this.handleFormError(result, 'company.snackbar.order_update_failed')
    });
  }

  /** Loads the HR training report: who has done what, and for how many hours. */
  async loadReport(companyId: string) {
    await this.execute<CompanyReportRequest>({
      requestFn: () => classroomio.company[':companyId'].report.$get({ param: { companyId } }),
      logContext: 'fetching company training report',
      onSuccess: (response) => {
        if (response.data) {
          this.report = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.report_failed');
        }
      }
    });
  }

  /**
   * Loads progress against the annual training obligation for one year: how
   * many of the legally required hours each employee has actually done.
   */
  async loadAnnualTraining(companyId: string, year: number) {
    // The route parses `year` itself instead of declaring a query validator, so
    // the argument is built here rather than inline in the request call.
    const request = { param: { companyId }, query: { year: String(year) } };

    await this.execute<AnnualTrainingRequest>({
      requestFn: () => classroomio.company[':companyId']['annual-training'].$get(request),
      logContext: 'fetching company annual training report',
      onSuccess: (response) => {
        if (response.data) {
          this.annualTraining = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('company.snackbar.annual_training_failed');
        }
      }
    });
  }

  /** Finds a loaded company by id (used by the edit modal after a list refresh). */
  findById(companyId: string): Company | undefined {
    return this.companies.find((company) => company.id === companyId);
  }

  /** Replaces the staff list of the loaded company with the API's fresh copy. */
  private applyMembers(members: CompanyDetail['members'] | undefined) {
    if (!this.detail || !members) return;

    this.detail = { ...this.detail, members };
  }

  /** Shared handling for the endpoints backed by a form. */
  private handleFormError(result: unknown, snackbarKey: string) {
    if (typeof result === 'string') {
      snackbar.error(snackbarKey);
      return;
    }

    if (result && typeof result === 'object') {
      const error = result as { field?: string; error?: string };

      if (error.field && error.error) {
        this.errors[error.field] = error.error;
      } else if (error.error) {
        this.errors.general = error.error;
      }
    }

    snackbar.error(snackbarKey);
  }
}

export const companyApi = /* @__PURE__ */ new CompanyApi();
