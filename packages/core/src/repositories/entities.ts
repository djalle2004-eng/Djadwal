import { BaseRepository, MutationContext } from './baseRepository.js';
import { UnitOfWorkContext } from '../unitOfWork.js';

// 1. Departments Repository
export class DepartmentsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'departments',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: false
    });
  }
}

// 2. Professors Repository
export class ProfessorsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'professors',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

// 3. Courses Repository
export class CoursesRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'courses',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

// 4. Rooms Repository
export class RoomsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'rooms',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

// 5. Groups Repository
export class GroupsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'groups',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

// 6. Extra Sessions Repository
export class ExtraSessionsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'extra_sessions',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }
}

// 7. Users Repository
export class UsersRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'users',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: false
    });
  }
}

// 8. Semesters Repository
export class SemestersRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'semesters',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }
}

// 9. Academic Years Repository
export class AcademicYearsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'academic_years',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: false
    });
  }
}

// 10. Assignments Repository (Atomic Swap & Move Support)
export class AssignmentsRepository extends BaseRepository<any> {
  constructor() {
    super({
      tableName: 'assignments',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }

  /**
   * Atomically swaps time/room slots between two assignments.
   */
  async swap(
    idA: number,
    idB: number,
    context: { uow: UnitOfWorkContext; userId?: number | null }
  ): Promise<{ assignmentA: any; assignmentB: any }> {
    const { uow, userId } = context;

    const [a] = await uow.query('SELECT * FROM assignments WHERE id = $1 FOR UPDATE', [idA]);
    const [b] = await uow.query('SELECT * FROM assignments WHERE id = $1 FOR UPDATE', [idB]);

    if (!a || !b) {
      throw new Error(`تعذر التبديل: أحد الحصص غير موجودة (الحصة 1: #${idA}, الحصة 2: #${idB})`);
    }

    const slotA = {
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      room_id: a.room_id
    };

    const slotB = {
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      room_id: b.room_id
    };

    const nextVerA = (a.version || 1) + 1;
    const nextVerB = (b.version || 1) + 1;

    // Apply slotB to assignment A
    const [updatedA] = await uow.query(
      `UPDATE assignments
       SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4, version = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [slotB.day_of_week, slotB.start_time, slotB.end_time, slotB.room_id, nextVerA, idA]
    );

    // Apply slotA to assignment B
    const [updatedB] = await uow.query(
      `UPDATE assignments
       SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4, version = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [slotA.day_of_week, slotA.start_time, slotA.end_time, slotA.room_id, nextVerB, idB]
    );

    // Audit changes
    await uow.recordChange({
      entity_type: 'assignments',
      entity_id: idA,
      action: 'swap',
      before_state: a,
      after_state: updatedA,
      changed_by: userId
    });

    await uow.recordChange({
      entity_type: 'assignments',
      entity_id: idB,
      action: 'swap',
      before_state: b,
      after_state: updatedB,
      changed_by: userId
    });

    return { assignmentA: updatedA, assignmentB: updatedB };
  }

  /**
   * Atomically moves an assignment to a new time or room with conflict detection.
   */
  async move(
    id: number,
    target: { day_of_week: number; start_time: string; end_time: string; room_id?: number },
    context: { uow: UnitOfWorkContext; userId?: number | null; expectedVersion?: number }
  ): Promise<any> {
    const { uow, userId, expectedVersion } = context;

    const [current] = await uow.query('SELECT * FROM assignments WHERE id = $1 FOR UPDATE', [id]);
    if (!current) {
      throw new Error(`الحصة الدراسية رقم #${id} غير موجودة`);
    }

    // Optimistic locking
    const mode = this.getOptimisticLockMode();
    if (expectedVersion !== undefined && mode !== 'off') {
      const currentVer = Number(current.version || 1);
      if (currentVer !== Number(expectedVersion)) {
        if (mode === 'enforce') {
          throw new (require('../unitOfWork.js').OptimisticLockError)('assignments', id, expectedVersion, currentVer);
        } else {
          console.warn(`⚠️ [OPTIMISTIC_LOCK_WARNING] Conflict moving assignment #${id}. Expected: ${expectedVersion}, Actual: ${currentVer}`);
        }
      }
    }

    const roomId = target.room_id || current.room_id;

    // Check room conflict
    const roomConflicts = await uow.query(
      `SELECT id FROM assignments
       WHERE id != $1 AND room_id = $2 AND day_of_week = $3
         AND NOT (end_time <= $4 OR start_time >= $5)`,
      [id, roomId, target.day_of_week, target.start_time, target.end_time]
    );

    if (roomConflicts.length > 0) {
      throw new Error(`تعارض مكاني: القاعة محجوزة بحصة أخرى (#${roomConflicts[0].id}) في هذا التوقيت.`);
    }

    // Check professor conflict
    const profConflicts = await uow.query(
      `SELECT id FROM assignments
       WHERE id != $1 AND professor_id = $2 AND day_of_week = $3
         AND NOT (end_time <= $4 OR start_time >= $5)`,
      [id, current.professor_id, target.day_of_week, target.start_time, target.end_time]
    );

    if (profConflicts.length > 0) {
      throw new Error(`تعارض زمني: الأستاذ مرتبط بحصة أخرى (#${profConflicts[0].id}) في هذا التوقيت.`);
    }

    const nextVer = (current.version || 1) + 1;
    const [updated] = await uow.query(
      `UPDATE assignments
       SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4, version = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [target.day_of_week, target.start_time, target.end_time, roomId, nextVer, id]
    );

    await uow.recordChange({
      entity_type: 'assignments',
      entity_id: id,
      action: 'move',
      before_state: current,
      after_state: updated,
      changed_by: userId
    });

    return updated;
  }
}

// Singletons for direct access
export const departmentsRepository = new DepartmentsRepository();
export const professorsRepository = new ProfessorsRepository();
export const coursesRepository = new CoursesRepository();
export const roomsRepository = new RoomsRepository();
export const groupsRepository = new GroupsRepository();
export const assignmentsRepository = new AssignmentsRepository();
export const extraSessionsRepository = new ExtraSessionsRepository();
export const usersRepository = new UsersRepository();
export const semestersRepository = new SemestersRepository();
export const academicYearsRepository = new AcademicYearsRepository();

