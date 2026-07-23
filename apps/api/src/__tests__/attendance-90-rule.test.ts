import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAttendanceForLesson } from '@cio/db/queries/attendance';

import { computeLessonAttendance, parseLessonIdFromRoom } from '@api/services/livekit/attendance';

/**
 * The 90% rule decides who gets a certificate, so it is the single most
 * consequential calculation in the platform: getting it wrong either hands a
 * certificate to someone who did not attend or denies one to someone who did.
 */

vi.mock('@cio/db/queries/attendance', () => ({
  listAttendanceForLesson: vi.fn(),
  closeAttendanceEntry: vi.fn(),
  closeOpenAttendanceEntriesForLesson: vi.fn(),
  createAttendanceEntry: vi.fn(),
  getOpenAttendanceEntry: vi.fn(),
  upsertAttendance: vi.fn()
}));

vi.mock('@cio/db/queries/course', () => ({ getCourseWithRelations: vi.fn() }));
vi.mock('@cio/db/queries/group', () => ({ getGroupMemberIdByGroupAndProfile: vi.fn() }));
vi.mock('@cio/db/queries/lesson', () => ({ getLessonById: vi.fn() }));

const mockedList = vi.mocked(listAttendanceForLesson);

const LESSON_ID = '11111111-1111-4111-8111-111111111111';

/** Builds one presence interval, in minutes from an arbitrary session start. */
function interval(profileId: string, fromMinute: number, toMinute: number) {
  const base = Date.parse('2026-01-12T19:00:00.000Z');

  return {
    id: `${profileId}-${fromMinute}`,
    courseId: 'course-1',
    lessonId: LESSON_ID,
    profileId,
    source: 'livekit',
    roomName: `mica-lesson-${LESSON_ID}`,
    joinedAt: new Date(base + fromMinute * 60_000).toISOString(),
    leftAt: new Date(base + toMinute * 60_000).toISOString(),
    durationSeconds: (toMinute - fromMinute) * 60,
    recordedBy: null,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base).toISOString()
  };
}

describe('computeLessonAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no participants and no session when nobody attended', async () => {
    mockedList.mockResolvedValue([]);

    const summary = await computeLessonAttendance(LESSON_ID);

    expect(summary.sessionSeconds).toBe(0);
    expect(summary.participants).toEqual([]);
  });

  it('marks a student who stayed the whole class present at 100%', async () => {
    mockedList.mockResolvedValue([interval('alice', 0, 180)] as never);

    const summary = await computeLessonAttendance(LESSON_ID);

    expect(summary.sessionSeconds).toBe(180 * 60);
    expect(summary.participants[0]).toMatchObject({ profileId: 'alice', percent: 100, present: true });
  });

  it('sums the intervals of a student who reconnected', async () => {
    // Bob drops at minute 40 and comes back at 45: 175 of the 180 minutes.
    mockedList.mockResolvedValue([
      interval('alice', 0, 180),
      interval('bob', 0, 40),
      interval('bob', 45, 180)
    ] as never);

    const summary = await computeLessonAttendance(LESSON_ID);
    const bob = summary.participants.find((participant) => participant.profileId === 'bob');

    expect(bob?.attendedSeconds).toBe(175 * 60);
    expect(bob?.percent).toBe(97);
    expect(bob?.present).toBe(true);
  });

  it('fails a student below the threshold', async () => {
    // 150 of 180 minutes is 83% — short of the 90% the law requires.
    mockedList.mockResolvedValue([interval('alice', 0, 180), interval('carol', 30, 180)] as never);

    const summary = await computeLessonAttendance(LESSON_ID);
    const carol = summary.participants.find((participant) => participant.profileId === 'carol');

    expect(carol?.percent).toBe(83);
    expect(carol?.present).toBe(false);
  });

  it('measures the class by the longest attendance, not by the span of all of them', async () => {
    // The regression this guards: manual in-person entries are anchored to the
    // scheduled time while live check-ins use the wall clock. Taking the span
    // from the first join to the last leave would stretch the class to 240
    // minutes and drop everyone below the threshold.
    mockedList.mockResolvedValue([interval('alice', 0, 180), interval('bob', 60, 240)] as never);

    const summary = await computeLessonAttendance(LESSON_ID);

    expect(summary.sessionSeconds).toBe(180 * 60);
    expect(summary.participants.every((participant) => participant.present)).toBe(true);
  });

  it('counts a student who never left as still attending', async () => {
    const base = Date.parse('2026-01-12T19:00:00.000Z');
    vi.setSystemTime(new Date(base + 120 * 60_000));

    mockedList.mockResolvedValue([{ ...interval('alice', 0, 120), leftAt: null, durationSeconds: null }] as never);

    const summary = await computeLessonAttendance(LESSON_ID);

    expect(summary.participants[0]?.attendedSeconds).toBe(120 * 60);
    vi.useRealTimers();
  });

  it('honours a custom threshold', async () => {
    mockedList.mockResolvedValue([interval('alice', 0, 180), interval('carol', 30, 180)] as never);

    const summary = await computeLessonAttendance(LESSON_ID, 80);
    const carol = summary.participants.find((participant) => participant.profileId === 'carol');

    expect(carol?.present).toBe(true);
  });
});

describe('parseLessonIdFromRoom', () => {
  it('reads the lesson id out of our room names', () => {
    expect(parseLessonIdFromRoom(`mica-lesson-${LESSON_ID}`)).toBe(LESSON_ID);
  });

  it('ignores rooms that are not ours or carry a bogus id', () => {
    expect(parseLessonIdFromRoom('some-other-room')).toBeNull();
    expect(parseLessonIdFromRoom('mica-lesson-not-a-uuid')).toBeNull();
    expect(parseLessonIdFromRoom(undefined)).toBeNull();
  });
});
