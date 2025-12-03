/**
 * Utilitaires pour l'impression des documents
 */
import html2pdf from 'html2pdf.js';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import type { PrintOptions, PageOrientation, PageSize, TextAlignment } from '../types/shared';

// إعادة تصدير الأنواع للتوافق مع الإصدارات القديمة
export type { PrintOptions, PageOrientation, PageSize, TextAlignment };

/**
 * Imprime le contenu HTML fourni
 * @param content Contenu HTML à imprimer
 * @param options Options d'impression
 */
export const printContent = (content: string, options: PrintOptions): void => {
  // ✅ إذا كان asPDF = true، استخدم html2pdf.js
  if (options.asPDF) {
    generatePDFFromHTML(content, options);
    return;
  }

  // استخدام window.print() العادي
  // Créer un iframe pour l'impression
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';

  // Ajouter à la page
  document.body.appendChild(printFrame);

  // Obtenir le document de l'iframe
  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    console.error("Erreur lors de la création du document d'impression");
    return;
  }

  // Écrire le contenu HTML dans l'iframe
  frameDoc.open();

  // تحديد حجم الصفحة
  const pageSize = options.pageSize || 'A4';
  const orientation = options.orientation || 'portrait';

  // CSS محسّن مع دعم كامل للإعدادات
  const printCSS = `
    @page {
      size: ${pageSize} ${orientation};
      margin: ${options.pageMarginTop || 5}mm ${options.pageMarginRight || 5}mm ${options.pageMarginBottom || 5}mm ${options.pageMarginLeft || 5}mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: ${options.fontSize || '12pt'};
      direction: rtl;
      line-height: ${options.lineHeight || 1.4};
      margin: 0;
      padding: 0;
      position: relative;
      ${options.watermark ? `background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><text x="50%" y="50%" font-size="72" fill="rgba(0,0,0,${options.watermarkOpacity || 0.1})" text-anchor="middle" transform="rotate(-45 50 50)">${options.watermark}</text></svg>');
      background-repeat: no-repeat;
      background-position: center;` : ''}
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${options.marginBottom || '20px'};
      page-break-inside: avoid;
    }
    
    th, td {
      border: ${options.tableBorderWidth || 1}px solid ${options.tableBorderColor || '#ddd'};
      padding: ${typeof options.cellPadding === 'number' ? options.cellPadding + 'px' : (options.cellPadding || '8px')};
      text-align: ${options.tableCellAlignment || 'center'};
      line-height: ${options.lineHeight || 1.4};
      vertical-align: middle;
      font-size: ${options.cellContentFontSize ? options.cellContentFontSize + 'pt' : 'inherit'};
    }
    
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    
    .print-header {
      text-align: center;
      margin-bottom: 20px;
      ${options.showHeader === false ? 'display: none;' : ''}
    }
    
    .print-footer {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${options.footerFontSize ? options.footerFontSize + 'pt' : '10pt'};
      ${options.showFooter === false ? 'display: none;' : ''}
    }
    
    .page-number::after {
      content: counter(page);
    }
    
    .signature-line {
      border-top: 1px solid #000;
      width: 200px;
      margin-top: 10px;
      text-align: center;
    }
    
    .no-print {
      display: none !important;
    }
    
    @media print {
      .no-print, .print-button {
        display: none !important;
      }
      
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      tr, td, th {
        page-break-inside: avoid;
      }
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    
    .print-button:hover {
      background: #0056b3;
    }
    
    ${options.customCSS || ''}
  `;

  // إضافة header إذا كان موجوداً
  const headerHTML = options.showHeader !== false && options.headerContent
    ? `<div class="print-header">${options.headerContent}</div>`
    : '';

  // إضافة footer إذا كان موجوداً
  const footerHTML = options.showFooter !== false && (options.footerContent || options.showPageNumbers)
    ? `<div class="print-footer">
        <div>${options.footerContent || ''}</div>
        ${options.showPageNumbers ? '<div class="page-number">صفحة </div>' : ''}
      </div>`
    : '';

  frameDoc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${options.title}</title>
        <style>${printCSS}</style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print(); ${options.hideAfterPrint ? 'window.close();' : ''}">
          🖨️ طباعة
        </button>
        ${headerHTML}
        <div class="print-content">
          ${content}
        </div>
        ${footerHTML}
      </body>
    </html>
  `);
  frameDoc.close();

  // Lancer l'impression après chargement de l'iframe
  printFrame.onload = () => {
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    }, 500);
  };
};

/**
 * توليد PDF حقيقي من HTML باستخدام html2pdf.js
 * @param content Contenu HTML
 * @param options Options d'impression
 */
export const generatePDFFromHTML = (content: string, options: PrintOptions): void => {
  // إنشاء عنصر مؤقت
  const element = document.createElement('div');

  // حساب scale بناءً على حجم الصفحة والهوامش
  const pageSize = options.pageSize || 'A4';
  const isLandscape = options.orientation === 'landscape';

  // حساب الهوامش
  const marginTop = options.pageMarginTop || 5;
  const marginBottom = options.pageMarginBottom || 5;
  const marginLeft = options.pageMarginLeft || 5;
  const marginRight = options.pageMarginRight || 5;

  // إضافة header و footer إذا كانا موجودين
  const headerHTML = options.showHeader !== false && options.headerContent
    ? `<div style="text-align: center; margin-bottom: 15px; font-size: 12pt;">${options.headerContent}</div>`
    : '';

  const footerHTML = options.showFooter !== false && options.footerContent
    ? `<div style="text-align: center; margin-top: 15px; font-size: 10pt; border-top: 1px solid #ddd; padding-top: 10px;">${options.footerContent}</div>`
    : '';

  element.innerHTML = `
    <div style="
      direction: rtl; 
      font-family: 'Arial', 'Helvetica', sans-serif; 
      font-size: ${options.fontSize || '10pt'};
      padding: ${typeof options.cellPadding === 'number' ? options.cellPadding + 'px' : (options.cellPadding || '5px')};
      background: white;
      color: #000;
      box-sizing: border-box;
      width: 100%;
      line-height: ${options.lineHeight || 1.4};
      ${options.watermark ? `position: relative;` : ''}
    ">
      ${options.watermark ? `
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72pt;
          color: rgba(0, 0, 0, ${options.watermarkOpacity || 0.1});
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        ">${options.watermark}</div>
      ` : ''}
      <div style="position: relative; z-index: 1;">
        ${headerHTML}
        ${content}
        ${footerHTML}
      </div>
    </div>
  `;

  // ✅ إعدادات محسّنة مع هوامش ديناميكية
  const opt = {
    margin: [marginTop, marginRight, marginBottom, marginLeft],
    filename: `${options.title}.pdf`,
    image: {
      type: 'jpeg',
      quality: 0.95
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      allowTaint: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: isLandscape ? 4000 : 2800,
      windowHeight: isLandscape ? 2800 : 4000,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: pageSize.toLowerCase(),
      orientation: options.orientation || 'portrait',
      compress: true,
      putOnlyUsedFonts: true
    },
    pagebreak: {
      mode: 'avoid-all',
      avoid: ['tr', 'td', 'th', 'table', 'div', 'thead', 'tbody']
    },
    enableLinks: false
  };

  // عرض رسالة تحميل
  const loadingDiv = document.createElement('div');
  loadingDiv.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: white;
      font-family: Arial;
      font-size: 18pt;
      direction: rtl;
    ">
      <div style="text-align: center;">
        <div style="margin-bottom: 20px;">⏳</div>
        <div>جاري إنشاء ملف PDF...</div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingDiv);

  // توليد وحفظ PDF
  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      // إزالة رسالة التحميل عند الانتهاء
      document.body.removeChild(loadingDiv);
    })
    .catch((err: Error) => {
      console.error('خطأ في توليد PDF:', err);
      document.body.removeChild(loadingDiv);
      alert('حدث خطأ أثناء توليد ملف PDF');
    });
};

/**
 * توليد PDF Blob من HTML
 * @param content Contenu HTML
 * @param options Options d'impression
 * @returns Promise<Blob>
 */
export const getPDFBlobFromHTML = async (content: string, options: PrintOptions): Promise<Blob> => {
  // إنشاء عنصر مؤقت
  const element = document.createElement('div');

  // حساب scale بناءً على حجم الصفحة والهوامش
  const pageSize = options.pageSize || 'A4';
  const isLandscape = options.orientation === 'landscape';

  // حساب الهوامش
  const marginTop = options.pageMarginTop || 5;
  const marginBottom = options.pageMarginBottom || 5;
  const marginLeft = options.pageMarginLeft || 5;
  const marginRight = options.pageMarginRight || 5;

  // إضافة header و footer إذا كانا موجودين
  const headerHTML = options.showHeader !== false && options.headerContent
    ? `<div style="text-align: center; margin-bottom: 15px; font-size: 12pt;">${options.headerContent}</div>`
    : '';

  const footerHTML = options.showFooter !== false && options.footerContent
    ? `<div style="text-align: center; margin-top: 15px; font-size: 10pt; border-top: 1px solid #ddd; padding-top: 10px;">${options.footerContent}</div>`
    : '';

  element.innerHTML = `
    <div style="
      direction: rtl; 
      font-family: 'Arial', 'Helvetica', sans-serif; 
      font-size: ${options.fontSize || '10pt'};
      padding: ${typeof options.cellPadding === 'number' ? options.cellPadding + 'px' : (options.cellPadding || '5px')};
      background: white;
      color: #000;
      box-sizing: border-box;
      width: 100%;
      line-height: ${options.lineHeight || 1.4};
      ${options.watermark ? `position: relative;` : ''}
    ">
      ${options.watermark ? `
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72pt;
          color: rgba(0, 0, 0, ${options.watermarkOpacity || 0.1});
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        ">${options.watermark}</div>
      ` : ''}
      <div style="position: relative; z-index: 1;">
        ${headerHTML}
        ${content}
        ${footerHTML}
      </div>
    </div>
  `;

  // إعدادات html2pdf
  const opt = {
    margin: [marginTop, marginRight, marginBottom, marginLeft],
    filename: `${options.title}.pdf`,
    image: {
      type: 'jpeg',
      quality: 0.95
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      allowTaint: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: isLandscape ? 4000 : 2800,
      windowHeight: isLandscape ? 2800 : 4000,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: pageSize.toLowerCase(),
      orientation: options.orientation || 'portrait',
      compress: true,
      putOnlyUsedFonts: true
    },
    pagebreak: {
      mode: 'avoid-all',
      avoid: ['tr', 'td', 'th', 'table', 'div', 'thead', 'tbody']
    },
    enableLinks: false
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
    return pdfBlob;
  } catch (err) {
    console.error('خطأ في توليد PDF Blob:', err);
    throw new Error('حدث خطأ أثناء توليد ملف PDF');
  }
};

/**
 * Génère le contenu HTML pour l'impression de la liste des séances
 * @param sessions Liste des séances à imprimer
 * @param filterType Type de filtre (extra, makeup ou all)
 * @returns Contenu HTML formaté
 */
export const generateSessionsListContent = (
  sessions: any[],
  filterType: 'extra' | 'makeup' | 'exam' | 'all' = 'all'
): string => {
  const filteredSessions = filterType === 'all'
    ? sessions
    : sessions.filter(s => s.session_type === filterType);

  const title = filterType === 'extra'
    ? 'قائمة الحصص الإضافية'
    : filterType === 'makeup'
      ? 'قائمة حصص التعويض'
      : filterType === 'exam'
        ? 'قائمة الفروض المحروسة'
        : 'قائمة الحصص الإضافية وحصص التعويض والفروض المحروسة';

  const today = new Date();
  const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return `
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 20pt; font-weight: bold; margin-bottom: 10px;">${title}</h1>
      <p style="font-size: 11pt;">تاريخ الطباعة: ${formattedDate}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">نوع الحصة</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">التاريخ</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">التوقيت</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">الأستاذ</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">المقرر</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">المجموعة</th>
          <th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold;">القاعة</th>
        </tr>
      </thead>
      <tbody>
        ${filteredSessions.map(session => `
          <tr>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.session_type === 'extra' ? 'حصة إضافية' : 'حصة تعويض'}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${formatDate(session.session_date)}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.start_time} - ${session.end_time}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.professor_name}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.course_name}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.group_name}</td>
            <td style="border: 1px solid #666; padding: 6px; text-align: center;">${session.room_name}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div style="margin-top: 30px; font-size: 11pt;">
      <p><strong>إجمالي الحصص:</strong> ${filteredSessions.length}</p>
    </div>
  `;
};

/**
 * Génère le contenu HTML pour l'impression d'une attestation individuelle
 * @param session Données de la séance
 * @param departmentHead Nom du chef de département
 * @returns Contenu HTML formaté
 */
export const generateIndividualSessionContent = (
  session: any,
  departmentHead: string = 'رئيس القسم'
): string => {
  const today = new Date();
  const formattedToday = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const sessionType = session.session_type === 'extra' ? 'حصة إضافية' : 'حصة تعويض';

  return `
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #333; padding-bottom: 15px;">
      <h1 style="font-size: 24pt; font-weight: bold; color: #2c3e50;">شهادة ${sessionType}</h1>
    </div>
    
    <div style="margin: 50px 20px; padding: 30px; border: 2px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <p style="font-size: 14pt; line-height: 2.2; text-align: justify;">
        أشهد أنا الموقع أدناه، <strong style="font-size: 15pt;">${departmentHead}</strong>، أن الأستاذ(ة) <strong style="font-size: 15pt; color: #2980b9;">${session.professor_name}</strong> 
        قد قام بإجراء <strong style="color: #e74c3c;">${sessionType}</strong> للمقرر <strong style="color: #27ae60;">${session.course_name}</strong> للمجموعة <strong>${session.group_name}</strong>
        بتاريخ <strong style="color: #8e44ad;">${formatDate(session.session_date)}</strong> من الساعة <strong>${session.start_time}</strong> إلى الساعة <strong>${session.end_time}</strong>
        في القاعة <strong>${session.room_name}</strong>.
      </p>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-top: 60px; padding: 0 30px;">
      <div style="text-align: left;">
        <p style="font-size: 12pt; color: #666;">حرر في: <strong>${formattedToday}</strong></p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 13pt; font-weight: bold; margin-bottom: 50px;">${departmentHead}</p>
        <div style="border-top: 2px solid #000; width: 200px; padding-top: 5px; text-align: center;">
          <span style="font-size: 10pt; color: #999;">التوقيع والختم</span>
        </div>
      </div>
    </div>
  `;
};

/**
 * Formate une date au format YYYY-MM-DD en format lisible
 * @param dateStr Date au format YYYY-MM-DD
 * @returns Date formatée
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * توليد إعلان للطلبة يحتوي على جدول الحصص التعويضية/الإضافية
 * @param sessions قائمة الحصص المفلترة حسب التخصص والفوج
 * @param departmentName اسم القسم
 * @param specializationName اسم التخصص
 * @param sessionType نوع الحصة (extra أو makeup)
 * @param printSettings إعدادات الطباعة من PrintSettings
 * @returns محتوى HTML للإعلان
 */
export const generateStudentAnnouncementContent = (
  sessions: any[],
  departmentName: string,
  specializationName: string,
  sessionType: 'extra' | 'makeup' | 'exam' | 'all',
  printSettings?: {
    universityName?: string;
    facultyName?: string;
    universityLogoUrl?: string;
    facultyLogoUrl?: string;
  }
): string => {
  const today = new Date();
  const formattedToday = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  // تحديد نوع الحصة للعنوان
  let sessionTypeText = '';
  if (sessionType === 'extra') {
    sessionTypeText = 'حصة إضافية';
  } else if (sessionType === 'makeup') {
    sessionTypeText = 'حصة تعويضية';
  } else if (sessionType === 'exam') {
    sessionTypeText = 'إمتحان الأعمال الموجهة';
  } else {
    sessionTypeText = 'حصص تعويضية وإضافية وإمتحان الأعمال الموجهة';
  }

  // إنشاء رأس المستند
  const header = generateDocumentHeader(sessionTypeText, {
    universityName: printSettings?.universityName,
    facultyName: printSettings?.facultyName,
    universityLogoUrl: printSettings?.universityLogoUrl,
    facultyLogoUrl: printSettings?.facultyLogoUrl,
    logoSize: 80,
    headerFontSize: 14,
    titleFontSize: 18
  });

  // إنشاء جدول الحصص
  const tableHeaders = ['اليوم والتاريخ', 'التوقيت', 'المقرر', 'الأستاذ', 'المجموعة', 'القاعة', 'نوع الحصة'];
  const tableRows = sessions.map(session => [
    `<div style="text-align: center;">${format(new Date(session.session_date), 'EEEE', { locale: arSA })}<br/>${format(new Date(session.session_date), 'dd/MM/yyyy')}</div>`,
    `${session.start_time} - ${session.end_time}`,
    session.course_name || '',
    session.professor_name || '',
    session.group_name || '',
    session.room_name || '',
    session.session_type === 'extra' ? 'إضافية' : session.session_type === 'makeup' ? 'تعويضية' : 'إمتحان الأعمال الموجهة'
  ]);

  const table = generateStyledTable(tableHeaders, tableRows);

  // النص الرئيسي
  const mainText = `
    <div style="margin: 30px 20px; text-align: justify; line-height: 2;">
      <p style="font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 20px;">
        قسم: ${departmentName}
      </p>
      <p style="font-size: 13pt; margin-bottom: 25px; text-indent: 30px;">
        ليكن في علم طلبة <strong>قسم ${departmentName}</strong> ${specializationName ? `<strong>تخصص ${specializationName}</strong>` : ''} 
        أنه تقرر برمجة <strong style="color: #e74c3c;">${sessionTypeText}</strong> وذلك حسب الجدول الموالي:
      </p>
    </div>
  `;

  // التحقق من وجود فروض محروسة
  const hasExamSessions = sessions.some(s => s.session_type === 'exam');

  // ملاحظة هامة
  const importantNote = `
    <div style="margin: 30px 20px; padding: 15px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 5px;">
      <p style="font-size: 12pt; font-weight: bold; color: #856404; margin: 0;">
        ⚠️ ملاحظة هامة:
      </p>
      <p style="font-size: 11pt; color: #856404; margin: 10px 0 0 0; line-height: 1.8;">
        يعتبر الحضور للحصة المشار إليها <strong>إجباريًا</strong> (بالنسبة للأعمال الموجهة)، 
        ويتحمل الطالب مسؤولية أي غياب يترتب عنه.
      </p>
    </div>
  `;

  // ملاحظة هامة ثانية للفروض المحروسة
  const examNote = hasExamSessions ? `
    <div style="margin: 30px 20px; padding: 15px; background-color: #ffe6e6; border: 2px solid #dc3545; border-radius: 5px;">
      <p style="font-size: 12pt; font-weight: bold; color: #721c24; margin: 0;">
        ⚠️ ملاحظة هامة ثانية:
      </p>
      <p style="font-size: 11pt; color: #721c24; margin: 10px 0 0 0; line-height: 1.8;">
        أي <strong>غياب غير مبرر</strong> للإمتحان المشار إليه <strong style="color: #dc3545;">يعرض الطالب إلى علامة صفر في نقطة إمتحان الأعمال الموجهة</strong>.
      </p>
    </div>
  ` : '';

  // التوقيع والتاريخ
  const signature = `
    <div style="display: flex; justify-content: space-between; margin-top: 60px; padding: 0 30px;">
      <div style="text-align: left;">
        <p style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">التاريخ:</p>
        <p style="font-size: 12pt;">${formattedToday}</p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 13pt; font-weight: bold; margin-bottom: 60px;">إمضاء رئيس القسم</p>
        <div style="border-top: 2px solid #000; width: 200px; padding-top: 5px; text-align: center;">
          <span style="font-size: 10pt; color: #999;">التوقيع والختم</span>
        </div>
      </div>
    </div>
  `;

  // دمج كل العناصر
  return `
    ${header}
    ${mainText}
    ${table}
    ${importantNote}
    ${examNote}
    ${signature}
  `;
};

/**
 * دالة مساعدة لإنشاء HTML لجدول بـ inline styles
 * @param headers أسماء الأعمدة
 * @param rows صفوف البيانات
 * @param title عنوان الجدول (اختياري)
 * @returns HTML string
 */
export const generateStyledTable = (
  headers: string[],
  rows: string[][],
  title?: string
): string => {
  const tableHeader = headers.map(h =>
    `<th style="border: 2px solid #333; padding: 8px; text-align: center; font-weight: bold; background-color: #f0f0f0;">${h}</th>`
  ).join('');

  const tableRows = rows.map(row => `
    <tr>
      ${row.map(cell =>
    `<td style="border: 1px solid #666; padding: 6px; text-align: center;">${cell}</td>`
  ).join('')}
    </tr>
  `).join('');

  return `
    ${title ? `<h2 style="text-align: center; margin: 20px 0; font-size: 18pt;">${title}</h2>` : ''}
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          ${tableHeader}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
};

/**
 * دالة لإنشاء header للمستندات مع شعار الجامعة
 */
export const generateDocumentHeader = (
  title: string,
  options?: {
    universityName?: string;
    facultyName?: string;
    universityLogoUrl?: string;
    facultyLogoUrl?: string;
    logoSize?: number;
    headerFontSize?: number;
    titleFontSize?: number;
  }
): string => {
  const logoSize = options?.logoSize || 80;
  const headerFontSize = options?.headerFontSize || 16;
  const titleFontSize = options?.titleFontSize || 16;

  return `
    <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; width: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; min-height: ${logoSize}px;">
        ${options?.universityLogoUrl ? `<img src="${options.universityLogoUrl}" style="max-width: ${logoSize}px; max-height: ${logoSize}px; object-fit: contain; flex-shrink: 0;" alt="شعار الجامعة">` : '<div style="width: ${logoSize}px;"></div>'}
        <div style="flex: 1; text-align: center; padding: 0 15px;">
          ${options?.universityName ? `<h3 style="font-size: ${headerFontSize}pt; margin: 3px 0; font-weight: bold;">${options.universityName}</h3>` : ''}
          ${options?.facultyName ? `<h3 style="font-size: ${headerFontSize}pt; margin: 3px 0; font-weight: bold;">${options.facultyName}</h3>` : ''}
          <h1 style="font-size: ${titleFontSize}pt; font-weight: bold; margin: 8px 0; color: #2c3e50;">${title}</h1>
        </div>
        ${options?.facultyLogoUrl ? `<img src="${options.facultyLogoUrl}" style="max-width: ${logoSize}px; max-height: ${logoSize}px; object-fit: contain; flex-shrink: 0;" alt="شعار الكلية">` : '<div style="width: ${logoSize}px;"></div>'}
      </div>
    </div>
  `;
};

/**
 * دالة لإنشاء footer للمستندات
 */
export const generateDocumentFooter = (
  leftText?: string,
  rightText?: string,
  centerText?: string
): string => {
  return `
    <div style="
      margin-top: 20px; 
      padding-top: 10px; 
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
    ">
      <div style="text-align: left;">${leftText || ''}</div>
      <div style="text-align: center;">${centerText || ''}</div>
      <div style="text-align: right;">${rightText || ''}</div>
    </div>
  `;
};

/**
 * دالة لإنشاء مستند كامل بتنسيق موحد
 */
export const generateFullDocument = (
  title: string,
  content: string,
  options?: {
    universityName?: string;
    facultyName?: string;
    universityLogoUrl?: string;
    facultyLogoUrl?: string;
    logoSize?: number;
    headerFontSize?: number;
    titleFontSize?: number;
    subtitleFontSize?: number;
    cellContentFontSize?: number;
    tableCellAlignment?: string;
    cellPadding?: number;
    lineHeight?: number;
    tableBorderWidth?: number;
    tableBorderColor?: string;
    footerLeft?: string;
    footerRight?: string;
    footerCenter?: string;
  }
): string => {
  const today = new Date();
  const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return `
    <style>
      /* ✅ تحجيم تلقائي للجداول الكبيرة */
      * {
        box-sizing: border-box;
      }
      body, html {
        margin: 0;
        padding: 0;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed;
        font-size: ${options?.cellContentFontSize || 7}pt !important;
        border-collapse: collapse;
        margin: 0 auto !important;
      }
      td, th {
        word-wrap: break-word;
        overflow-wrap: break-word;
        padding: ${options?.cellPadding || 2}px !important;
        line-height: ${options?.lineHeight || 1.2};
        font-size: ${options?.cellContentFontSize || 7}pt !important;
        text-align: ${options?.tableCellAlignment || 'center'};
        border: ${options?.tableBorderWidth || 1}px solid ${options?.tableBorderColor || '#000'};
      }
      /* ✅ منع تقسيم العناصر عبر الصفحات */
      tr, td, th, div, table, thead, tbody {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      /* ✅ تقليل الهوامش بشكل أكبر */
      h1, h2, h3, p {
        margin: 3px 0 !important;
        padding: 0 !important;
        text-align: ${options?.tableCellAlignment || 'center'};
      }
      h1 {
        font-size: 12pt !important;
      }
      h2 {
        font-size: 11pt !important;
      }
      h3 {
        font-size: 10pt !important;
      }
      p, div {
        font-size: 8pt !important;
      }
    </style>
    
    ${generateDocumentHeader(
    title,
    {
      universityName: options?.universityName,
      facultyName: options?.facultyName,
      universityLogoUrl: options?.universityLogoUrl,
      facultyLogoUrl: options?.facultyLogoUrl,
      logoSize: options?.logoSize,
      headerFontSize: options?.headerFontSize,
      titleFontSize: options?.titleFontSize
    }
  )}
    
    <div style="margin: 10px 0; width: 100%; overflow: hidden;">
      ${content}
    </div>
    
    ${generateDocumentFooter(
    options?.footerLeft || `تاريخ الطباعة: ${formattedDate}`,
    options?.footerRight || 'رئيس القسم',
    options?.footerCenter
  )}
  `;
};
