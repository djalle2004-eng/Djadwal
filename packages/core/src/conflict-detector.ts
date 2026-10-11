/**
 * Djadwal Core: Conflict Detector
 * Detects scheduling collisions across rooms, professors, and student groups.
 */

export interface SessionSchedule {
  id?: number | string;
  room_id: number | string;
  professor_id: number | string;
  group_id: number | string;
  day_of_week: number | string; // e.g. 0 to 6 or string day
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
}

export interface ConflictResult {
  hasConflict: boolean;
  type?: 'room' | 'professor' | 'group';
  reason?: string;
  conflictingSession?: SessionSchedule;
}

/**
 * Checks whether two time intervals on the same day overlap.
 * Intervals are inclusive of start, exclusive of end (standard timetable behavior: 08:00-09:30 does NOT conflict with 09:30-11:00).
 */
export function isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

/**
 * Validates a candidate session against a list of existing sessions.
 */
export function checkSessionConflicts(
  candidate: SessionSchedule,
  existingSessions: SessionSchedule[]
): ConflictResult {
  for (const existing of existingSessions) {
    // Skip if comparing against the same session (during edit)
    if (candidate.id && existing.id && String(candidate.id) === String(existing.id)) {
      continue;
    }

    // Must be on the same day to conflict
    if (String(candidate.day_of_week) !== String(existing.day_of_week)) {
      continue;
    }

    // Must have overlapping time
    if (!isTimeOverlapping(candidate.start_time, candidate.end_time, existing.start_time, existing.end_time)) {
      continue;
    }

    // 1. Room Conflict
    if (String(candidate.room_id) === String(existing.room_id)) {
      return {
        hasConflict: true,
        type: 'room',
        reason: `تعارض في القاعة: القاعة مشغولة بالفعل في هذا التوقيت (${existing.start_time} - ${existing.end_time})`,
        conflictingSession: existing
      };
    }

    // 2. Professor Conflict
    if (String(candidate.professor_id) === String(existing.professor_id)) {
      return {
        hasConflict: true,
        type: 'professor',
        reason: `تعارض للأستاذ: الأستاذ مرتبط بحصة أخرى في نفس التوقيت (${existing.start_time} - ${existing.end_time})`,
        conflictingSession: existing
      };
    }

    // 3. Group Conflict
    if (String(candidate.group_id) === String(existing.group_id)) {
      return {
        hasConflict: true,
        type: 'group',
        reason: `تعارض للفوج: الفوج الطلابي لديه حصة أخرى في نفس التوقيت (${existing.start_time} - ${existing.end_time})`,
        conflictingSession: existing
      };
    }
  }

  return { hasConflict: false };
}
