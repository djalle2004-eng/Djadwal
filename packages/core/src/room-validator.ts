export interface Room {
  id: number | string;
  name: string;
  capacity: number;
  type?: 'amphi' | 'td' | 'tp' | 'hall' | 'other';
  is_active?: boolean;
}

export interface SessionRequirement {
  studentCount: number;
  sessionType: 'lecture' | 'td' | 'tp' | 'exam' | string;
  requiredFeatures?: string[];
}

export interface RoomValidationResult {
  valid: boolean;
  code: 'OK' | 'CAPACITY_EXCEEDED' | 'INACTIVE_ROOM' | 'TYPE_MISMATCH' | 'INVALID_INPUT';
  message: string;
  details?: {
    capacity?: number;
    requiredCount?: number;
    roomType?: string;
    sessionType?: string;
  };
}

/**
 * Validates whether a room is suitable for a scheduled session.
 * Used across the timetable planner and room allocation workflows.
 */
export function validateRoomSuitability(
  room: Room,
  requirement: SessionRequirement
): RoomValidationResult {
  if (!room || !requirement) {
    return {
      valid: false,
      code: 'INVALID_INPUT',
      message: 'Room and requirement specifications must be provided.'
    };
  }

  if (room.is_active === false) {
    return {
      valid: false,
      code: 'INACTIVE_ROOM',
      message: `La salle ${room.name} est actuellement désactivée.`
    };
  }

  if (requirement.studentCount > room.capacity) {
    return {
      valid: false,
      code: 'CAPACITY_EXCEEDED',
      message: `Capacité insuffisante: ${requirement.studentCount} étudiants pour une capacité de ${room.capacity}.`,
      details: {
        capacity: room.capacity,
        requiredCount: requirement.studentCount
      }
    };
  }

  // Session type matching rules
  if (requirement.sessionType === 'lecture' && room.type && !['amphi', 'hall'].includes(room.type) && requirement.studentCount > 60) {
    return {
      valid: false,
      code: 'TYPE_MISMATCH',
      message: `Un cours magistral avec plus de 60 étudiants nécessite un amphithéâtre.`,
      details: {
        roomType: room.type,
        sessionType: requirement.sessionType
      }
    };
  }

  if (requirement.sessionType === 'tp' && room.type && room.type !== 'tp') {
    return {
      valid: false,
      code: 'TYPE_MISMATCH',
      message: `Une séance de TP doit obligatoirement avoir lieu dans une salle de TP équipée.`,
      details: {
        roomType: room.type,
        sessionType: requirement.sessionType
      }
    };
  }

  return {
    valid: true,
    code: 'OK',
    message: 'Salle valide pour la séance.'
  };
}
