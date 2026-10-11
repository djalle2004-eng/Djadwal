export interface PrintHeaderConfig {
  institutionNameAr: string;
  institutionNameFr?: string;
  facultyNameAr?: string;
  departmentNameAr?: string;
  academicYear: string;
  semesterTitle: string; // e.g. "السداسي الأول" / "Semestre 1"
  timetableType: 'professor' | 'group' | 'room' | 'department';
  targetEntityName: string; // e.g. "الأستاذ: د. محمد بن علي" or "الفوج: 2 LMD Informatique G1"
  generatedDate?: Date;
  logoUrl?: string;
}

export interface FormattedPrintHeader {
  topLineAr: string;
  topLineFr?: string;
  facultyAr?: string;
  departmentAr?: string;
  title: string;
  subtitle: string;
  metadataBadge: string;
  formattedDateAr: string;
  hasLogo: boolean;
}

/**
 * Generates standardized, bi-lingual and RTL-ready print headers for timetable exports (PDF / Print layout).
 */
export function generatePrintHeader(config: PrintHeaderConfig): FormattedPrintHeader {
  const date = config.generatedDate || new Date();
  const dateFormatted = new Intl.DateTimeFormat('ar-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);

  let typePrefix = '';
  switch (config.timetableType) {
    case 'professor':
      typePrefix = 'جدول توقيت الأستاذ: ';
      break;
    case 'group':
      typePrefix = 'جدول توقيت الفوج الدراسي: ';
      break;
    case 'room':
      typePrefix = 'جدول إشغال القاعة: ';
      break;
    case 'department':
      typePrefix = 'الجدول العام للقسم: ';
      break;
  }

  const title = `${typePrefix}${config.targetEntityName}`.trim();
  const subtitle = `السنة الجامعية: ${config.academicYear} | ${config.semesterTitle}`;

  return {
    topLineAr: config.institutionNameAr,
    topLineFr: config.institutionNameFr,
    facultyAr: config.facultyNameAr,
    departmentAr: config.departmentNameAr,
    title,
    subtitle,
    metadataBadge: `${config.academicYear} - ${config.semesterTitle}`,
    formattedDateAr: `حرر بتاريخ: ${dateFormatted}`,
    hasLogo: Boolean(config.logoUrl && config.logoUrl.trim().length > 0)
  };
}
