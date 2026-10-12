const { z } = require('zod');

/**
 * Djadwal Signed Templates Engine
 * Secure, pre-vetted HTML templates populated with strongly-typed, Zod-validated data.
 * Replaces risky raw client-submitted HTML.
 */

// 1. Timetable Template Schema
const TimetableSchema = z.object({
  title: z.string().min(1).default('جدول التوقيت الأسبوعي'),
  universityName: z.string().default('جامعة الشهيد حمه لخضر - الوادي'),
  facultyName: z.string().default('كلية العلوم الاقتصادية والتجارية وعلوم التسيير'),
  department: z.string().min(1),
  academicYear: z.string().min(1),
  semester: z.string().min(1),
  sessions: z.array(z.object({
    day: z.string(),
    time: z.string(),
    module: z.string(),
    type: z.string().optional(), // TD, Cours, TP
    professor: z.string(),
    room: z.string(),
    group: z.string().optional()
  })).default([])
});

// 2. Certificate / Teaching Attestation Schema
const CertificateSchema = z.object({
  universityName: z.string().default('جامعة الشهيد حمه لخضر - الوادي'),
  facultyName: z.string().default('كلية العلوم الاقتصادية والتجارية وعلوم التسيير'),
  teacherName: z.string().min(1),
  rank: z.string().default('أستاذ محاضر'),
  department: z.string().min(1),
  academicYear: z.string().min(1),
  totalHours: z.coerce.number().min(0),
  issueDate: z.string().default(() => new Date().toLocaleDateString('ar-DZ')),
  deanName: z.string().default('عميد الكلية')
});

// 3. Official Announcement Schema
const AnnouncementSchema = z.object({
  universityName: z.string().default('جامعة الشهيد حمه لخضر - الوادي'),
  facultyName: z.string().default('كلية العلوم الاقتصادية والتجارية وعلوم التسيير'),
  department: z.string().default('إدارة الكلية'),
  title: z.string().min(1),
  content: z.string().min(1),
  date: z.string().default(() => new Date().toLocaleDateString('ar-DZ')),
  author: z.string().default('مصلحة التدريس')
});

const TEMPLATE_REGISTRY = {
  timetable: {
    id: 'timetable',
    name: 'جدول التوقيت الأسبوعي',
    schema: TimetableSchema,
    generateHtml: (data) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 10px; color: #1e293b; direction: rtl; }
    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    .univ-name { font-size: 16px; font-weight: bold; color: #0f172a; margin: 0; }
    .fac-name { font-size: 14px; color: #334155; margin: 2px 0; }
    .title { font-size: 18px; font-weight: bold; color: #0369a1; margin: 6px 0 2px 0; }
    .meta { font-size: 12px; color: #64748b; margin-top: 4px; display: flex; justify-content: space-around; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; }
    td { border: 1px solid #cbd5e1; padding: 5px; text-align: center; }
    .empty { color: #94a3b8; font-style: italic; }
    .footer { margin-top: 15px; text-align: left; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="univ-name">${escapeHtml(data.universityName)}</div>
    <div class="fac-name">${escapeHtml(data.facultyName)}</div>
    <div class="title">${escapeHtml(data.title)} - قسم ${escapeHtml(data.department)}</div>
    <div class="meta">
      <span>السنة الجامعية: ${escapeHtml(data.academicYear)}</span>
      <span>السداسي: ${escapeHtml(data.semester)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>اليوم</th>
        <th>التوقيت</th>
        <th>المقياس</th>
        <th>النوع</th>
        <th>الأستاذ</th>
        <th>القاعة / المدرج</th>
        <th>الفوج</th>
      </tr>
    </thead>
    <tbody>
      ${data.sessions.length === 0 ? '<tr><td colspan="7" class="empty">لا توجد حصص مسجلة</td></tr>' : data.sessions.map(s => `
        <tr>
          <td>${escapeHtml(s.day)}</td>
          <td>${escapeHtml(s.time)}</td>
          <td><strong>${escapeHtml(s.module)}</strong></td>
          <td>${escapeHtml(s.type || '-')}</td>
          <td>${escapeHtml(s.professor)}</td>
          <td>${escapeHtml(s.room)}</td>
          <td>${escapeHtml(s.group || '-')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    تم استخراج الوثيقة آلياً من منصة Djadwal المعتمدة بتاريخ ${new Date().toLocaleDateString('ar-DZ')}
  </div>
</body>
</html>`
  },

  certificate: {
    id: 'certificate',
    name: 'شهادة إثبات ساعات التدريس',
    schema: CertificateSchema,
    generateHtml: (data) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; direction: rtl; line-height: 1.8; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
    .univ { font-size: 18px; font-weight: bold; }
    .fac { font-size: 15px; margin-top: 5px; }
    .doc-title { text-align: center; font-size: 24px; font-weight: bold; margin: 40px 0; color: #0369a1; text-decoration: underline; }
    .content { font-size: 16px; text-align: justify; margin: 30px 10px; }
    .highlight { font-weight: bold; color: #0f172a; }
    .signature-box { margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; }
    .signature-title { font-weight: bold; font-size: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="univ">${escapeHtml(data.universityName)}</div>
    <div class="fac">${escapeHtml(data.facultyName)}</div>
  </div>

  <div class="doc-title">شـــهـــادة عـــمـــل وتــدريــس</div>

  <div class="content">
    يشهد عميد كلية العلوم الاقتصادية والتجارية وعلوم التسيير بجامعة الشهيد حمه لخضر - الوادي، أن السيد(ة):
    <span class="highlight">${escapeHtml(data.teacherName)}</span>،
    برتبة <span class="highlight">${escapeHtml(data.rank)}</span>،
    قد قام(ت) بالتدريس الفعلي بقسم <span class="highlight">${escapeHtml(data.department)}</span>
    خلال السنة الجامعية <span class="highlight">${escapeHtml(data.academicYear)}</span>،
    بحجم ساعي إجمالي مقداره: <span class="highlight">${data.totalHours} ساعة</span>.
    <br><br>
    سُلمت هذه الشهادة للمعني بناءً على طلبه لاستعمالها في حدود ما يسمح به القانون.
  </div>

  <div class="signature-box">
    <div>
      <div class="signature-title">حرر بالوادي في: ${escapeHtml(data.issueDate)}</div>
    </div>
    <div style="text-align: center;">
      <div class="signature-title">${escapeHtml(data.deanName)}</div>
      <div style="margin-top: 50px; font-size: 13px; color: #64748b;">(الختم والإمضاء)</div>
    </div>
  </div>
</body>
</html>`
  },

  announcement: {
    id: 'announcement',
    name: 'إعلان رسمي',
    schema: AnnouncementSchema,
    generateHtml: (data) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 15px; color: #1e293b; direction: rtl; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: bold; color: #047857; text-align: center; margin: 25px 0; }
    .content { font-size: 15px; line-height: 1.8; text-align: justify; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .footer { margin-top: 30px; text-align: left; font-size: 13px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-weight: bold; font-size: 16px;">${escapeHtml(data.universityName)}</div>
    <div style="font-size: 14px;">${escapeHtml(data.facultyName)} - ${escapeHtml(data.department)}</div>
  </div>
  <div class="title">${escapeHtml(data.title)}</div>
  <div class="content">
    ${escapeHtml(data.content).replace(/\n/g, '<br>')}
  </div>
  <div class="footer">
    <div>${escapeHtml(data.author)}</div>
    <div style="font-size: 11px; color: #64748b;">التاريخ: ${escapeHtml(data.date)}</div>
  </div>
</body>
</html>`
  }
};

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTemplate(templateId, rawData) {
  const template = TEMPLATE_REGISTRY[templateId];
  if (!template) {
    const available = Object.keys(TEMPLATE_REGISTRY).join(', ');
    throw new Error(`القالب '${templateId}' غير مسجل. القوالب المتاحة: ${available}`);
  }

  const validatedData = template.schema.parse(rawData);
  return template.generateHtml(validatedData);
}

function listTemplates() {
  return Object.values(TEMPLATE_REGISTRY).map(t => ({
    id: t.id,
    name: t.name
  }));
}

module.exports = {
  renderTemplate,
  listTemplates,
  escapeHtml
};
