/**
 * Djadwal Core: Professor Workload Calculator
 * Computes weekly/semester teaching loads and verifies against academic rank statutory quotas.
 */

export interface ProfessorAssignment {
  professor_id: number | string;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  session_type?: 'cours' | 'td' | 'tp' | string;
  is_extra?: boolean;
}

export interface WorkloadSummary {
  totalHours: number;
  lectureHours: number; // Cours
  tutorialHours: number; // TD / TP
  extraHours: number;
  statutoryQuota: number;
  status: 'underload' | 'normal' | 'overload';
  differenceHours: number;
}

/**
 * Parses "HH:MM" to decimal hours (e.g. "09:30" => 9.5).
 */
export function timeToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) + (minutes || 0) / 60;
}

/**
 * Returns duration of session in hours (e.g. "08:00" to "09:30" => 1.5).
 */
export function getSessionDuration(start: string, end: string): number {
  const duration = timeToDecimal(end) - timeToDecimal(start);
  return duration > 0 ? duration : 0;
}

/**
 * Returns official statutory weekly hours based on academic rank (Algerian higher ed model).
 * Professeur / MCA: ~6 to 9h TD equiv
 * MCB / MAA / MAB: ~9 to 12h
 * Default fallback: 9.0h
 */
export function getStatutoryQuota(rank?: string): number {
  if (!rank) return 9.0;
  const normalized = rank.toLowerCase().trim();
  if (normalized.includes('prof') || normalized.includes('أستاذ تعليم عالي')) return 6.0;
  if (normalized.includes('mca') || normalized.includes('أستاذ محاضر أ')) return 9.0;
  if (normalized.includes('mcb') || normalized.includes('أستاذ محاضر ب')) return 9.0;
  if (normalized.includes('assistant') || normalized.includes('مساعد')) return 12.0;
  return 9.0;
}

/**
 * Computes the total workload for a given professor from assignments.
 */
export function calculateProfessorWorkload(
  assignments: ProfessorAssignment[],
  academicRank?: string
): WorkloadSummary {
  let lectureHours = 0;
  let tutorialHours = 0;
  let extraHours = 0;

  for (const a of assignments) {
    const duration = getSessionDuration(a.start_time, a.end_time);
    if (a.is_extra) {
      extraHours += duration;
    } else if (a.session_type?.toLowerCase() === 'cours') {
      lectureHours += duration;
    } else {
      tutorialHours += duration;
    }
  }

  const totalHours = lectureHours + tutorialHours + extraHours;
  const statutoryQuota = getStatutoryQuota(academicRank);
  const diff = Number((totalHours - statutoryQuota).toFixed(2));

  let status: 'underload' | 'normal' | 'overload' = 'normal';
  if (totalHours < statutoryQuota) {
    status = 'underload';
  } else if (totalHours > statutoryQuota) {
    status = 'overload';
  }

  return {
    totalHours: Number(totalHours.toFixed(2)),
    lectureHours: Number(lectureHours.toFixed(2)),
    tutorialHours: Number(tutorialHours.toFixed(2)),
    extraHours: Number(extraHours.toFixed(2)),
    statutoryQuota,
    status,
    differenceHours: diff
  };
}
