import * as schema from '@db/schema';

import { TLessonRecording, TNewLessonRecording } from '@db/types';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@db/drizzle';

/** Recordings of a live lesson, newest first. */
export async function listLessonRecordings(lessonId: string): Promise<TLessonRecording[]> {
  try {
    return await db
      .select()
      .from(schema.lessonRecording)
      .where(eq(schema.lessonRecording.lessonId, lessonId))
      .orderBy(desc(schema.lessonRecording.createdAt));
  } catch (error) {
    console.error('listLessonRecordings error:', error);
    throw new Error('Failed to list lesson recordings');
  }
}

export async function getLessonRecordingById(id: string): Promise<TLessonRecording | null> {
  try {
    const [row] = await db.select().from(schema.lessonRecording).where(eq(schema.lessonRecording.id, id)).limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getLessonRecordingById error:', error);
    throw new Error('Failed to fetch lesson recording');
  }
}

export async function getLessonRecordingByEgressId(egressId: string): Promise<TLessonRecording | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.lessonRecording)
      .where(eq(schema.lessonRecording.egressId, egressId))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getLessonRecordingByEgressId error:', error);
    throw new Error('Failed to fetch lesson recording');
  }
}

/**
 * Records what an egress webhook told us. Keyed on the egress id because the
 * same job reports several times (started → updated → ended) and LiveKit may
 * redeliver an event, so this has to converge on the same row.
 */
export async function upsertLessonRecording(data: TNewLessonRecording): Promise<TLessonRecording> {
  try {
    const [row] = await db
      .insert(schema.lessonRecording)
      .values(data)
      .onConflictDoUpdate({
        target: schema.lessonRecording.egressId,
        set: {
          status: data.status ?? 'starting',
          storageKey: data.storageKey ?? null,
          location: data.location ?? null,
          durationSeconds: data.durationSeconds ?? null,
          sizeBytes: data.sizeBytes ?? null,
          endedAt: data.endedAt ?? null,
          error: data.error ?? null,
          payload: data.payload ?? null,
          updatedAt: new Date().toISOString()
        }
      })
      .returning();

    if (!row) {
      throw new Error('Upsert returned no row');
    }

    return row;
  } catch (error) {
    console.error('upsertLessonRecording error:', error);
    throw new Error('Failed to save lesson recording');
  }
}

export async function updateLessonRecording(
  id: string,
  patch: Partial<TNewLessonRecording>
): Promise<TLessonRecording | null> {
  try {
    const [row] = await db
      .update(schema.lessonRecording)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(schema.lessonRecording.id, id))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateLessonRecording error:', error);
    throw new Error('Failed to update lesson recording');
  }
}

/** The recording still running for a lesson, if any — what "stop" acts on. */
export async function getActiveLessonRecording(lessonId: string): Promise<TLessonRecording | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.lessonRecording)
      .where(and(eq(schema.lessonRecording.lessonId, lessonId), eq(schema.lessonRecording.status, 'active')))
      .orderBy(desc(schema.lessonRecording.createdAt))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getActiveLessonRecording error:', error);
    throw new Error('Failed to fetch active lesson recording');
  }
}
