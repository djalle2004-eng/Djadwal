import { describe, it, expect } from 'vitest';
import {
  checkSessionConflicts,
  type SessionSchedule
} from '../src/conflict-detector.js';
import {
  calculateProfessorWorkload,
  type ProfessorAssignment
} from '../src/workload-calculator.js';
import {
  validateRoomSuitability,
  type Room,
  type SessionRequirement
} from '../src/room-validator.js';
import {
  generatePrintHeader,
  type PrintHeaderConfig
} from '../src/print-header-generator.js';

describe('Critical Business Logic Suite - Djadwal Engine', () => {

  // --- SECTION 1: CONFLICT DETECTOR (Tests 1-4) ---
  describe('1. Conflict Detector (كاشف تعارض الحصص)', () => {
    const baseSession: SessionSchedule = {
      id: 1,
      day_of_week: 1, // Dimanche
      start_time: '08:00',
      end_time: '09:30',
      professor_id: 'P100',
      room_id: 'R201',
      group_id: 'G1'
    };

    it('Test 1: Detects professor collision in overlapping time slot', () => {
      const candidate: SessionSchedule = {
        id: 2,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:30',
        professor_id: 'P100', // Same professor
        room_id: 'R202',
        group_id: 'G2'
      };
      const result = checkSessionConflicts(candidate, [baseSession]);
      expect(result.hasConflict).toBe(true);
      expect(result.type).toBe('professor');
      expect(result.reason).toContain('الأستاذ');
    });

    it('Test 2: Detects room collision in overlapping time slot', () => {
      const candidate: SessionSchedule = {
        id: 3,
        day_of_week: 1,
        start_time: '08:30',
        end_time: '10:00',
        professor_id: 'P101',
        room_id: 'R201', // Same room
        group_id: 'G2'
      };
      const result = checkSessionConflicts(candidate, [baseSession]);
      expect(result.hasConflict).toBe(true);
      expect(result.type).toBe('room');
      expect(result.reason).toContain('القاعة');
    });

    it('Test 3: Detects group collision in overlapping time slot', () => {
      const candidate: SessionSchedule = {
        id: 4,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:30',
        professor_id: 'P102',
        room_id: 'R202',
        group_id: 'G1' // Same group
      };
      const result = checkSessionConflicts(candidate, [baseSession]);
      expect(result.hasConflict).toBe(true);
      expect(result.type).toBe('group');
      expect(result.reason).toContain('الفوج');
    });

    it('Test 4: Allows non-overlapping sessions on the same day without false positive', () => {
      const candidate: SessionSchedule = {
        id: 5,
        day_of_week: 1,
        start_time: '09:30', // Starts right as baseSession ends
        end_time: '11:00',
        professor_id: 'P100',
        room_id: 'R201',
        group_id: 'G1'
      };
      const result = checkSessionConflicts(candidate, [baseSession]);
      expect(result.hasConflict).toBe(false);
    });
  });

  // --- SECTION 2: WORKLOAD CALCULATOR (Tests 5-8) ---
  describe('2. Workload Calculator (حساب عبء الأستاذ)', () => {
    it('Test 5: Correctly calculates total weekly hours from weekly sessions', () => {
      const assignments: ProfessorAssignment[] = [
        { start_time: '08:00', end_time: '09:30', session_type: 'cours' },
        { start_time: '09:30', end_time: '11:00', session_type: 'td' }
      ];
      const summary = calculateProfessorWorkload(assignments, 'Professeur');
      expect(summary.totalHours).toBe(3); // 1.5 + 1.5 = 3.0
      expect(summary.lectureHours).toBe(1.5);
      expect(summary.tutorialHours).toBe(1.5);
    });

    it('Test 6: Correctly accounts for extra sessions (heures supplémentaires)', () => {
      const assignments: ProfessorAssignment[] = [
        { start_time: '08:00', end_time: '09:30', session_type: 'cours' },
        { start_time: '11:00', end_time: '12:30', session_type: 'td', is_extra: true }
      ];
      const summary = calculateProfessorWorkload(assignments, 'Professeur');
      expect(summary.totalHours).toBe(3);
      expect(summary.extraHours).toBe(1.5);
    });

    it('Test 7: Flags status as overload when total hours exceed statutory quota', () => {
      // Professeur quota is 6.0h
      const assignments: ProfessorAssignment[] = [
        { start_time: '08:00', end_time: '11:00', session_type: 'cours' }, // 3h
        { start_time: '11:00', end_time: '13:00', session_type: 'cours' }, // 2h
        { start_time: '13:00', end_time: '15:00', session_type: 'td' }    // 2h => Total 7h
      ];
      const summary = calculateProfessorWorkload(assignments, 'Professeur');
      expect(summary.totalHours).toBe(7);
      expect(summary.statutoryQuota).toBe(6);
      expect(summary.status).toBe('overload');
      expect(summary.differenceHours).toBe(1);
    });

    it('Test 8: Flags status as underload when total hours fall below statutory quota', () => {
      // MCA quota is 9.0h
      const assignments: ProfessorAssignment[] = [
        { start_time: '08:00', end_time: '09:30', session_type: 'cours' } // 1.5h
      ];
      const summary = calculateProfessorWorkload(assignments, 'MCA');
      expect(summary.totalHours).toBe(1.5);
      expect(summary.statutoryQuota).toBe(9);
      expect(summary.status).toBe('underload');
      expect(summary.differenceHours).toBe(-7.5);
    });
  });

  // --- SECTION 3: ROOM VALIDATOR (Tests 9-11) ---
  describe('3. Room Validator (تحقق صلاحية القاعة)', () => {
    const standardRoom: Room = {
      id: 'R10',
      name: 'Salle B12',
      capacity: 35,
      type: 'td',
      is_active: true
    };

    it('Test 9: Rejects room assignment when student count exceeds room capacity', () => {
      const req: SessionRequirement = {
        studentCount: 45,
        sessionType: 'td'
      };
      const result = validateRoomSuitability(standardRoom, req);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('CAPACITY_EXCEEDED');
    });

    it('Test 10: Rejects scheduling inside an inactive or decommissioned room', () => {
      const inactiveRoom: Room = {
        ...standardRoom,
        is_active: false
      };
      const req: SessionRequirement = {
        studentCount: 25,
        sessionType: 'td'
      };
      const result = validateRoomSuitability(inactiveRoom, req);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INACTIVE_ROOM');
    });

    it('Test 11: Rejects TP lab session assigned to a regular non-TP room', () => {
      const req: SessionRequirement = {
        studentCount: 20,
        sessionType: 'tp'
      };
      const result = validateRoomSuitability(standardRoom, req); // standardRoom is type 'td'
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TYPE_MISMATCH');
    });
  });

  // --- SECTION 4: PRINT HEADER GENERATOR (Test 12) ---
  describe('4. Print Header Generator (توليد رأس جدول الطباعة)', () => {
    it('Test 12: Generates compliant RTL Arabic title, dates, and badges for timetable printouts', () => {
      const config: PrintHeaderConfig = {
        institutionNameAr: 'جامعة قسنطينة 2',
        facultyNameAr: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
        departmentNameAr: 'قسم علوم التسيير',
        academicYear: '2025/2026',
        semesterTitle: 'السداسي الأول',
        timetableType: 'professor',
        targetEntityName: 'د. لخضر بوزيد',
        generatedDate: new Date('2026-10-15T10:00:00Z'),
        logoUrl: '/assets/logo-univ.png'
      };

      const header = generatePrintHeader(config);
      expect(header.topLineAr).toBe('جامعة قسنطينة 2');
      expect(header.title).toContain('جدول توقيت الأستاذ: د. لخضر بوزيد');
      expect(header.subtitle).toBe('السنة الجامعية: 2025/2026 | السداسي الأول');
      expect(header.metadataBadge).toBe('2025/2026 - السداسي الأول');
      expect(header.hasLogo).toBe(true);
      expect(header.formattedDateAr).toContain('حرر بتاريخ:');
    });
  });

});
