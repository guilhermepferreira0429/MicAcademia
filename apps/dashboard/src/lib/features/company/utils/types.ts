import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// List companies types
export type ListCompaniesRequest = typeof classroomio.company.$get;
export type ListCompaniesResponse = InferResponseType<ListCompaniesRequest> | null;
export type ListCompaniesSuccess = Extract<InferResponseType<ListCompaniesRequest>, { success: true }>;
export type Companies = ListCompaniesSuccess['data'];

/** A single B2B company account (array element of the list response). */
export type Company = Companies[number];

// Create company types
export type CreateCompanyRequest = typeof classroomio.company.$post;
export type CreateCompanyResponse = InferResponseType<CreateCompanyRequest>;
export type CreateCompanySuccess = Extract<CreateCompanyResponse, { success: true }>;
export type CreateCompanyData = CreateCompanySuccess['data'];

// Update / delete company types
export type UpdateCompanyRequest = (typeof classroomio.company)[':companyId']['$put'];
export type DeleteCompanyRequest = (typeof classroomio.company)[':companyId']['$delete'];

// Company detail types
export type CompanyDetailRequest = (typeof classroomio.company)[':companyId']['$get'];
export type CompanyDetailResponse = InferResponseType<CompanyDetailRequest> | null;
export type CompanyDetailSuccess = Extract<InferResponseType<CompanyDetailRequest>, { success: true }>;
export type CompanyDetail = CompanyDetailSuccess['data'];

/** The company record itself, without the list-only `memberCount`. */
export type CompanyRecord = CompanyDetail['company'];

/** A member of the company's staff, as returned inside the detail payload. */
export type CompanyMember = CompanyDetail['members'][number];

/** One bulk-enrolment order: a batch of seats invoiced to the company once. */
export type CompanyEnrollment = CompanyDetail['enrollments'][number];

// Member types
export type AddCompanyMemberRequest = (typeof classroomio.company)[':companyId']['members']['$post'];
export type RemoveCompanyMemberRequest = (typeof classroomio.company)[':companyId']['members'][':profileId']['$delete'];

// Bulk enrolment types
export type BulkEnrollRequest = (typeof classroomio.company)[':companyId']['enrollments']['$post'];
export type BulkEnrollResponse = InferResponseType<BulkEnrollRequest>;
export type BulkEnrollSuccess = Extract<BulkEnrollResponse, { success: true }>;
export type BulkEnrollResult = BulkEnrollSuccess['data'];

// Order (enrolment) update types
export type UpdateCompanyEnrollmentRequest =
  (typeof classroomio.company)[':companyId']['enrollments'][':enrollmentId']['$put'];

// Training report types
export type CompanyReportRequest = (typeof classroomio.company)[':companyId']['report']['$get'];
export type CompanyReportResponse = InferResponseType<CompanyReportRequest> | null;
export type CompanyReportSuccess = Extract<InferResponseType<CompanyReportRequest>, { success: true }>;
export type CompanyReport = CompanyReportSuccess['data'];

/** One employee row of the HR training report. */
export type CompanyReportEmployee = CompanyReport['employees'][number];

/** A course an employee is enrolled in, with the hours actually attended. */
export type CompanyReportCourse = CompanyReportEmployee['courses'][number];

// Annual training obligation types (40h/worker/year in Portugal)
export type AnnualTrainingRequest = (typeof classroomio.company)[':companyId']['annual-training']['$get'];
export type AnnualTrainingResponse = InferResponseType<AnnualTrainingRequest> | null;
export type AnnualTrainingSuccess = Extract<InferResponseType<AnnualTrainingRequest>, { success: true }>;
export type AnnualTraining = AnnualTrainingSuccess['data'];

/** One employee row of the annual obligation report. */
export type AnnualTrainingEmployee = AnnualTraining['employees'][number];
