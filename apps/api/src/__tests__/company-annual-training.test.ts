import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCompanyById, listCompanyMembers, sumAttendanceByProfileForPeriod } from '@cio/db/queries/company';

import { LEGAL_ANNUAL_TRAINING_HOURS, getCompanyAnnualTraining } from '@api/services/company/company';

/**
 * The 40h/year obligation report. An HR contact acts on these numbers — "João
 * still needs 18 hours before December" — so the arithmetic and the year
 * boundaries have to be right.
 */

vi.mock('@cio/db/queries/company', () => ({
  addCompanyMember: vi.fn(),
  createCompany: vi.fn(),
  createCompanyEnrollment: vi.fn(),
  deleteCompany: vi.fn(),
  getCompanyById: vi.fn(),
  listCompanies: vi.fn(),
  listCompanyEnrollments: vi.fn(),
  listCompanyMembers: vi.fn(),
  listCompanyTraining: vi.fn(),
  removeCompanyMember: vi.fn(),
  sumAttendanceByProfileAndCourse: vi.fn(),
  sumAttendanceByProfileForPeriod: vi.fn(),
  updateCompany: vi.fn(),
  updateCompanyEnrollment: vi.fn()
}));

vi.mock('@cio/db/queries/course', () => ({ getCourseWithRelations: vi.fn() }));
vi.mock('@api/services/course/invite', () => ({ grantCourseAccessForPayment: vi.fn() }));

const mockedCompany = vi.mocked(getCompanyById);
const mockedMembers = vi.mocked(listCompanyMembers);
const mockedAttendance = vi.mocked(sumAttendanceByProfileForPeriod);

const ORG_ID = 'org-1';
const COMPANY_ID = 'company-1';

const HOURS = 3600;

describe('getCompanyAnnualTraining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCompany.mockResolvedValue({
      id: COMPANY_ID,
      orgId: ORG_ID,
      name: 'Cliente',
      annualTrainingHours: null
    } as never);
    mockedMembers.mockResolvedValue([
      { profileId: 'p1', fullname: 'João', email: 'joao@x.pt', role: 'employee', jobTitle: 'Técnico' },
      { profileId: 'p2', fullname: 'Maria', email: 'maria@x.pt', role: 'employee', jobTitle: null }
    ] as never);
    mockedAttendance.mockResolvedValue([]);
  });

  it('falls back to the legal 40 hours when the company sets no target', async () => {
    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(LEGAL_ANNUAL_TRAINING_HOURS).toBe(40);
    expect(report.requiredHours).toBe(40);
  });

  it('honours a company that agreed a higher target', async () => {
    mockedCompany.mockResolvedValue({ id: COMPANY_ID, orgId: ORG_ID, annualTrainingHours: 60 } as never);

    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(report.requiredHours).toBe(60);
  });

  it('reports hours done, hours left and whether the obligation is met', async () => {
    mockedAttendance.mockResolvedValue([
      { profileId: 'p1', seconds: 22 * HOURS },
      { profileId: 'p2', seconds: 40 * HOURS }
    ]);

    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);
    const joao = report.employees.find((employee) => employee.profileId === 'p1');
    const maria = report.employees.find((employee) => employee.profileId === 'p2');

    expect(joao).toMatchObject({ hours: 22, remainingHours: 18, percent: 55, met: false });
    // Exactly the required hours counts as met — the law says "at least".
    expect(maria).toMatchObject({ hours: 40, remainingHours: 0, percent: 100, met: true });
  });

  it('never reports negative hours left for someone over the target', async () => {
    mockedAttendance.mockResolvedValue([{ profileId: 'p1', seconds: 55 * HOURS }]);

    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(report.employees[0]).toMatchObject({ hours: 55, remainingHours: 0, percent: 100, met: true });
  });

  it('counts an employee with no training at all as zero, not as missing', async () => {
    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(report.employees).toHaveLength(2);
    expect(report.employees.every((employee) => employee.hours === 0)).toBe(true);
    expect(report.summary).toMatchObject({ employees: 2, met: 0, totalHours: 0 });
  });

  it('asks for exactly the requested calendar year, in UTC', async () => {
    await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(mockedAttendance).toHaveBeenCalledWith(['p1', 'p2'], '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
  });

  it('rounds hours to one decimal so a half hour is not lost', async () => {
    mockedAttendance.mockResolvedValue([{ profileId: 'p1', seconds: 5.5 * HOURS }]);

    const report = await getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026);

    expect(report.employees[0]?.hours).toBe(5.5);
    expect(report.employees[0]?.remainingHours).toBe(34.5);
  });

  it('refuses a company from another organization', async () => {
    mockedCompany.mockResolvedValue(null as never);

    await expect(getCompanyAnnualTraining(ORG_ID, COMPANY_ID, 2026)).rejects.toThrow(/not found/i);
  });
});
