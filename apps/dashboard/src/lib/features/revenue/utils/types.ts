import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// Revenue-share report types
export type RevenueReportRequest = (typeof classroomio)['revenue-share']['report']['$get'];
export type RevenueReportResponse = InferResponseType<RevenueReportRequest> | null;
export type RevenueReportSuccess = Extract<InferResponseType<RevenueReportRequest>, { success: true }>;
export type RevenueReport = RevenueReportSuccess['data'];

/** Aggregate entitlement for a single party across the period. */
export type RevenueReportParty = RevenueReport['parties'][number];

/** Per-course revenue breakdown row. */
export type RevenueReportCourse = RevenueReport['courses'][number];

/** A single share line within a course breakdown. */
export type RevenueReportCourseShare = RevenueReportCourse['shares'][number];
