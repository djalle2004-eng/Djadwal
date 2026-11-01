function getDatabaseModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../../server/database.js');
}

export interface DeleteImpactResult {
  entity: string;
  id: number | string;
  name?: string;
  canDelete: boolean;
  blockReason?: string;
  impacts: {
    labelArabic: string;
    count: number;
    entityType: string;
  }[];
  totalImpactCount: number;
}

export async function calculateDeleteImpact(entity: string, id: number | string): Promise<DeleteImpactResult> {
  const db = getDatabaseModule();
  const normalizedEntity = entity.toLowerCase().replace(/s$/, ''); // e.g. 'professors' -> 'professor'

  const impacts: DeleteImpactResult['impacts'] = [];
  let name = '';
  let canDelete = true;
  let blockReason: string | undefined;

  switch (normalizedEntity) {
    case 'department': {
      const [dept] = await db.executeQuery('SELECT name FROM departments WHERE id = $1', [id]);
      name = dept?.name || `القسم #${id}`;

      // 1. Courses
      const [coursesCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM courses WHERE department_id = $1 AND deleted_at IS NULL',
        [id]
      );
      impacts.push({
        labelArabic: 'المقاييس والمواد التابعة',
        count: Number(coursesCount?.count || 0),
        entityType: 'courses'
      });

      // 2. Groups
      const [groupsCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM groups WHERE department_id = $1 AND deleted_at IS NULL',
        [id]
      );
      impacts.push({
        labelArabic: 'الأفواج والفرق التابعة',
        count: Number(groupsCount?.count || 0),
        entityType: 'groups'
      });

      // 3. Assignments via courses or groups
      const [assignmentsCount] = await db.executeQuery(
        `SELECT COUNT(*) as count FROM assignments a
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN groups g ON a.group_id = g.id
         WHERE c.department_id = $1 OR g.department_id = $1`,
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص الدراسية المجدولة المرتبطة بالقسم',
        count: Number(assignmentsCount?.count || 0),
        entityType: 'assignments'
      });
      break;
    }

    case 'professor': {
      const [prof] = await db.executeQuery('SELECT name FROM professors WHERE id = $1', [id]);
      name = prof?.name || `الأستاذ #${id}`;

      // 1. Active assignments
      const [assignCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM assignments WHERE professor_id = $1',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص الدراسية المجدولة',
        count: Number(assignCount?.count || 0),
        entityType: 'assignments'
      });

      // 2. Extra sessions
      const [extraCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM extra_sessions WHERE professor_id = $1 AND is_archived = 0',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص الإضافية والتعويضية',
        count: Number(extraCount?.count || 0),
        entityType: 'extra_sessions'
      });
      break;
    }

    case 'course': {
      const [c] = await db.executeQuery('SELECT name FROM courses WHERE id = $1', [id]);
      name = c?.name || `المقياس #${id}`;

      const [assignCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM assignments WHERE course_id = $1',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص الدراسية المجدولة',
        count: Number(assignCount?.count || 0),
        entityType: 'assignments'
      });

      const [extraCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM extra_sessions WHERE course_id = $1 AND is_archived = 0',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص الإضافية',
        count: Number(extraCount?.count || 0),
        entityType: 'extra_sessions'
      });
      break;
    }

    case 'room': {
      const [r] = await db.executeQuery('SELECT name FROM rooms WHERE id = $1', [id]);
      name = r?.name || `القاعة #${id}`;

      const [assignCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM assignments WHERE room_id = $1',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص المجدولة داخل هذه القاعة',
        count: Number(assignCount?.count || 0),
        entityType: 'assignments'
      });
      break;
    }

    case 'group': {
      const [g] = await db.executeQuery('SELECT name FROM groups WHERE id = $1', [id]);
      name = g?.name || `الفوج #${id}`;

      const [subGroups] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM groups WHERE parent_group_id = $1 AND deleted_at IS NULL',
        [id]
      );
      impacts.push({
        labelArabic: 'الأفواج الفرعية التابعة',
        count: Number(subGroups?.count || 0),
        entityType: 'groups'
      });

      const [assignCount] = await db.executeQuery(
        'SELECT COUNT(*) as count FROM assignments WHERE group_id = $1',
        [id]
      );
      impacts.push({
        labelArabic: 'الحصص المجدولة لهذا الفوج',
        count: Number(assignCount?.count || 0),
        entityType: 'assignments'
      });
      break;
    }

    default:
      throw new Error(`حساب أثر الحذف غير مدعوم للكيان: ${entity}`);
  }

  const totalImpactCount = impacts.reduce((acc, curr) => acc + curr.count, 0);

  return {
    entity,
    id,
    name,
    canDelete,
    blockReason,
    impacts,
    totalImpactCount
  };
}

