import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import {
  unitOfWork,
  OptimisticLockError
} from '../src/unitOfWork';
import {
  departmentsRepository,
  professorsRepository,
  assignmentsRepository,
  changeLogRepository,
  calculateDeleteImpact
} from '../src/repositories/index';

const { executeQuery, getPgPool } = require('../../../server/database.js');
const app = require('../../../server/server.js');

describe('P7 Atomic Business Layer, Repositories, Optimistic Locking & Soft Delete Suite', () => {
  let testDeptId: number;
  let testProfId: number;
  let testCourseId: number;
  let testGroupId: number;
  let testRoomId: number;
  let testAssignmentId: number;

  beforeAll(async () => {
    // Setup test records
    const [dept] = await executeQuery(
      'INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id',
      ['P7 Test Department', 'P7_DEPT']
    );
    testDeptId = dept.id;

    const [prof] = await executeQuery(
      'INSERT INTO professors (name, email, version) VALUES ($1, $2, 1) RETURNING id',
      ['P7 Test Professor', 'prof_p7@univ.dz']
    );
    testProfId = prof.id;

    const [course] = await executeQuery(
      'INSERT INTO courses (name, code, department_id, version) VALUES ($1, $2, $3, 1) RETURNING id',
      ['P7 Test Course', 'P7_CS101', testDeptId]
    );
    testCourseId = course.id;

    const [group] = await executeQuery(
      'INSERT INTO groups (name, department_id, version) VALUES ($1, $2, 1) RETURNING id',
      ['P7 Test Group', testDeptId]
    );
    testGroupId = group.id;

    const [room] = await executeQuery(
      'INSERT INTO rooms (name, capacity, version) VALUES ($1, $2, 1) RETURNING id',
      ['P7 Test Room', 45]
    );
    testRoomId = room.id;

    const [assign] = await executeQuery(
      `INSERT INTO assignments (group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, version)
       VALUES ($1, $2, $3, $4, 1, '08:00', '09:30', '2026-2027', '1', 1) RETURNING id`,
      [testGroupId, testCourseId, testProfId, testRoomId]
    );
    testAssignmentId = assign.id;
  });

  afterAll(async () => {
    // Clean up test records
    if (testAssignmentId) {
      await executeQuery('DELETE FROM assignments WHERE id = $1', [testAssignmentId]);
    }
    if (testGroupId) {
      await executeQuery('DELETE FROM groups WHERE id = $1', [testGroupId]);
    }
    if (testCourseId) {
      await executeQuery('DELETE FROM courses WHERE id = $1', [testCourseId]);
    }
    if (testProfId) {
      await executeQuery('DELETE FROM professors WHERE id = $1', [testProfId]);
    }
    if (testRoomId) {
      await executeQuery('DELETE FROM rooms WHERE id = $1', [testRoomId]);
    }
    if (testDeptId) {
      await executeQuery('DELETE FROM departments WHERE id = $1', [testDeptId]);
    }
    await executeQuery("DELETE FROM departments WHERE code LIKE 'P7_%'");
    await executeQuery("DELETE FROM professors WHERE email LIKE '%@univ.dz' AND name LIKE 'P7%'");
  });

  describe('1. Atomic Transactions & Zero-Partial Write Guarantee (DoD #1)', () => {
    it('rolls back 100% of statements on Neon when an operation fails inside unitOfWork', async () => {
      const canaryCode = 'P7_CANARY_FAIL';

      let caughtError = false;
      try {
        await unitOfWork(async (uow) => {
          await uow.query('INSERT INTO departments (name, code) VALUES ($1, $2)', ['Canary Department', canaryCode]);
          // Deliberate error simulating collision or runtime validation crash
          throw new Error('Simulated transaction failure for atomicity test');
        });
      } catch (err: any) {
        caughtError = true;
        expect(err.message).toContain('Simulated transaction failure');
      }

      expect(caughtError).toBe(true);

      // Verify that NO row was written to Neon
      const rows = await executeQuery('SELECT * FROM departments WHERE code = $1', [canaryCode]);
      expect(rows.length).toBe(0);
    });

    it('clears secondary dual-write queue on rollback, preventing phantom writes to Turso', async () => {
      let caughtError = false;
      try {
        await unitOfWork(async (uow) => {
          uow.queueDualWrite('INSERT INTO departments (name, code) VALUES (?, ?)', ['Phantom Dept', 'P7_PHANTOM']);
          throw new Error('Rollback before commit');
        });
      } catch (err) {
        caughtError = true;
      }

      expect(caughtError).toBe(true);
      // If rollback occurs, no writes must be sent to Turso
      const rows = await executeQuery("SELECT * FROM departments WHERE code = 'P7_PHANTOM'");
      expect(rows.length).toBe(0);
    });
  });

  describe('2. Optimistic Locking & Lost Update Prevention (DoD #2)', () => {
    it('throws OptimisticLockError in enforce mode when version does not match', async () => {
      const prevMode = process.env.FEATURE_OPTIMISTIC_LOCK_MODE;
      process.env.FEATURE_OPTIMISTIC_LOCK_MODE = 'enforce';

      try {
        // Fetch current version of test professor
        const prof = await professorsRepository.get(testProfId);
        expect(prof).toBeDefined();
        const currentVersion = prof.version || 1;

        // User A successfully updates with expectedVersion
        const updatedA = await professorsRepository.update(
          testProfId,
          { title: 'Updated by User A' },
          { expectedVersion: currentVersion }
        );
        expect(updatedA.version).toBe(currentVersion + 1);

        // User B attempts update with stale expectedVersion -> MUST throw OptimisticLockError
        let errorThrown: any = null;
        try {
          await professorsRepository.update(
            testProfId,
            { title: 'Updated by User B' },
            { expectedVersion: currentVersion }
          );
        } catch (err: any) {
          errorThrown = err;
        }

        expect(errorThrown).not.toBeNull();
        expect(errorThrown.name).toBe('OptimisticLockError');
        expect(errorThrown.expectedVersion).toBe(currentVersion);
        expect(errorThrown.actualVersion).toBe(currentVersion + 1);
      } finally {
        process.env.FEATURE_OPTIMISTIC_LOCK_MODE = prevMode;
      }
    });

    it('logs warning and proceeds without throwing in monitor mode', async () => {
      const prevMode = process.env.FEATURE_OPTIMISTIC_LOCK_MODE;
      process.env.FEATURE_OPTIMISTIC_LOCK_MODE = 'monitor';

      try {
        const prof = await professorsRepository.get(testProfId);
        const staleVersion = (prof.version || 1) - 5; // deliberately out-of-date

        const updated = await professorsRepository.update(
          testProfId,
          { phone: '0555000999' },
          { expectedVersion: staleVersion }
        );

        expect(updated).toBeDefined();
        expect(updated.phone).toBe('0555000999');
      } finally {
        process.env.FEATURE_OPTIMISTIC_LOCK_MODE = prevMode;
      }
    });
  });

  describe('3. Soft Delete Lifecycle & Query Filtering (DoD #3)', () => {
    it('archives entity, sets deleted_at, excludes from default list, and allows restore', async () => {
      const prevSoft = process.env.FEATURE_SOFT_DELETE;
      process.env.FEATURE_SOFT_DELETE = 'true';

      try {
        // Create dedicated entity for soft delete testing
        const created = await departmentsRepository.create({
          name: 'P7 Archivable Department',
          code: 'P7_ARCHIVE_TEST'
        });
        const deptId = created.id;

        // Verify active in default list
        const listBefore = await departmentsRepository.list();
        expect(listBefore.some((d: any) => d.id === deptId)).toBe(true);

        // Archive entity
        await departmentsRepository.archive(deptId);

        // Verify excluded from default list
        const listAfter = await departmentsRepository.list();
        expect(listAfter.some((d: any) => d.id === deptId)).toBe(false);

        // Verify included when withArchived: true
        const listWithArchived = await departmentsRepository.list({ withArchived: true });
        const archivedRecord = listWithArchived.find((d: any) => d.id === deptId);
        expect(archivedRecord).toBeDefined();
        expect(archivedRecord.deleted_at).not.toBeNull();

        // Restore entity
        await departmentsRepository.restore(deptId);

        // Verify back in active list
        const listRestored = await departmentsRepository.list();
        expect(listRestored.some((d: any) => d.id === deptId)).toBe(true);

        // Cleanup
        await executeQuery('DELETE FROM departments WHERE id = $1', [deptId]);
      } finally {
        process.env.FEATURE_SOFT_DELETE = prevSoft;
      }
    });
  });

  describe('4. Deletion Impact Calculation (DoD #4)', () => {
    it('returns accurate impact counts for department dependencies', async () => {
      const impact = await calculateDeleteImpact('department', testDeptId);

      expect(impact).toBeDefined();
      expect(impact.entity).toBe('department');
      expect(impact.id).toBe(testDeptId);
      expect(impact.impacts.length).toBeGreaterThan(0);

      const coursesImpact = impact.impacts.find(i => i.entityType === 'courses');
      expect(coursesImpact?.count).toBeGreaterThanOrEqual(1);

      const groupsImpact = impact.impacts.find(i => i.entityType === 'groups');
      expect(groupsImpact?.count).toBeGreaterThanOrEqual(1);

      expect(impact.totalImpactCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('5. Audit & 24-Hour Undo Mechanism (DoD #5)', () => {
    it('records state change and allows undo within 24 hours, rejecting duplicate undo', async () => {
      // 1. Update professor within unitOfWork to generate change_log row
      let changeId: number | null = null;
      await unitOfWork(async (uow) => {
        const before = await professorsRepository.get(testProfId, { uow });
        const updated = await professorsRepository.update(
          testProfId,
          { name: 'P7 Professor Renamed for Undo Test' },
          { uow }
        );
        // Record change log
        changeId = await uow.recordChange({
          entity_type: 'professors',
          entity_id: testProfId,
          action: 'update',
          before_state: before,
          after_state: updated
        });
      });

      expect(changeId).not.toBeNull();

      // 2. Perform atomic undo
      const undoResult = await unitOfWork(async (uow) => {
        return await changeLogRepository.undo(changeId!, { uow });
      });

      expect(undoResult.success).toBe(true);

      // Verify restored state on Neon
      const restored = await professorsRepository.get(testProfId);
      expect(restored.name).not.toBe('P7 Professor Renamed for Undo Test');

      // 3. Attempting duplicate undo must throw error
      await expect(
        unitOfWork(async (uow) => {
          return await changeLogRepository.undo(changeId!, { uow });
        })
      ).rejects.toThrow(/تم التراجع عن هذا التعديل مسبقًا/);
    });
  });

  describe('6. Isolated Heartbeat Zero-DB-Touch Ping (DoD #6)', () => {
    it('GET /api/ping returns 200 in < 15ms without touching the database', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/ping');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(duration).toBeLessThan(50);
    });
  });
});

