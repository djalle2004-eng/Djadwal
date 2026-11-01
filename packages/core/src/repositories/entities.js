const { BaseRepository } = require('./baseRepository.js');
const { OptimisticLockError } = require('../unitOfWork.js');

class DepartmentsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'departments',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: false
    });
  }
}

class ProfessorsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'professors',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

class CoursesRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'courses',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

class RoomsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'rooms',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

class GroupsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'groups',
      primaryKey: 'id',
      supportsSoftDelete: true,
      supportsOptimisticLock: true
    });
  }
}

class ExtraSessionsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'extra_sessions',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }
}

class UsersRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'users',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: false
    });
  }
}

class SemestersRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'semesters',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }
}

class AcademicYearsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'academic_years',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: false
    });
  }
}

class AssignmentsRepository extends BaseRepository {
  constructor() {
    super({
      tableName: 'assignments',
      primaryKey: 'id',
      supportsSoftDelete: false,
      supportsOptimisticLock: true
    });
  }

  async swap(idA, idB, context) {
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

    const [updatedA] = await uow.query(
      `UPDATE assignments
       SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4, version = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [slotB.day_of_week, slotB.start_time, slotB.end_time, slotB.room_id, nextVerA, idA]
    );

    const [updatedB] = await uow.query(
      `UPDATE assignments
       SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4, version = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [slotA.day_of_week, slotA.start_time, slotA.end_time, slotA.room_id, nextVerB, idB]
    );

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

  async move(id, target, context) {
    const { uow, userId, expectedVersion } = context;

    const [current] = await uow.query('SELECT * FROM assignments WHERE id = $1 FOR UPDATE', [id]);
    if (!current) {
      throw new Error(`الحصة الدراسية رقم #${id} غير موجودة`);
    }

    const mode = this.getOptimisticLockMode();
    if (expectedVersion !== undefined && mode !== 'off') {
      const currentVer = Number(current.version || 1);
      if (currentVer !== Number(expectedVersion)) {
        if (mode === 'enforce') {
          throw new OptimisticLockError('assignments', id, expectedVersion, currentVer);
        } else {
          console.warn(`⚠️ [OPTIMISTIC_LOCK_WARNING] Conflict moving assignment #${id}. Expected: ${expectedVersion}, Actual: ${currentVer}`);
        }
      }
    }

    const roomId = target.room_id || current.room_id;

    const roomConflicts = await uow.query(
      `SELECT id FROM assignments
       WHERE id != $1 AND room_id = $2 AND day_of_week = $3
         AND NOT (end_time <= $4 OR start_time >= $5)`,
      [id, roomId, target.day_of_week, target.start_time, target.end_time]
    );

    if (roomConflicts.length > 0) {
      throw new Error(`تعارض مكاني: القاعة محجوزة بحصة أخرى (#${roomConflicts[0].id}) في هذا التوقيت.`);
    }

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

const departmentsRepository = new DepartmentsRepository();
const professorsRepository = new ProfessorsRepository();
const coursesRepository = new CoursesRepository();
const roomsRepository = new RoomsRepository();
const groupsRepository = new GroupsRepository();
const assignmentsRepository = new AssignmentsRepository();
const extraSessionsRepository = new ExtraSessionsRepository();
const usersRepository = new UsersRepository();
const semestersRepository = new SemestersRepository();
const academicYearsRepository = new AcademicYearsRepository();

module.exports = {
  DepartmentsRepository,
  ProfessorsRepository,
  CoursesRepository,
  RoomsRepository,
  GroupsRepository,
  ExtraSessionsRepository,
  UsersRepository,
  SemestersRepository,
  AcademicYearsRepository,
  AssignmentsRepository,
  departmentsRepository,
  professorsRepository,
  coursesRepository,
  roomsRepository,
  groupsRepository,
  assignmentsRepository,
  extraSessionsRepository,
  usersRepository,
  semestersRepository,
  academicYearsRepository
};

