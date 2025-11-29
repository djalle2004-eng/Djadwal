import ExcelJS from 'exceljs';
import type { PrintSettings } from '../types/shared';

/**
 * أدوات إنشاء ملفات Excel مع تنسيق كامل
 */

// الألوان المستخدمة
const COLORS = {
    headerBg: 'FF4472C4',
    headerText: 'FFFFFFFF',
    tableBorder: 'FF000000',
    alternateRow: 'FFF2F2F2',
};

/**
 * تحويل Data URI إلى Uint8Array (متوافق مع المتصفح)
 */
function dataURItoBuffer(dataURI: string): Uint8Array {
    try {
        const base64Data = dataURI.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        console.error('Error converting Data URI to buffer:', error);
        return new Uint8Array(0);
    }
}

/**
 * إضافة شعارات الجامعة والكلية إلى الورقة
 */
async function addLogosToWorksheet(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    settings: PrintSettings
): Promise<void> {
    try {
        let logoCol = 0; // البدء من العمود الأول

        // إضافة شعار الجامعة (يمين)
        if (settings.universityLogoUrl && settings.universityLogoUrl.startsWith('data:image')) {
            try {
                const universityLogoBuffer = dataURItoBuffer(settings.universityLogoUrl);
                if (universityLogoBuffer.length > 0) {
                    const extension = settings.universityLogoUrl.includes('png') ? 'png' : 'jpeg';
                    const universityLogoId = workbook.addImage({
                        buffer: universityLogoBuffer,
                        extension: extension,
                    });

                    worksheet.addImage(universityLogoId, {
                        tl: { col: 0.2, row: 0.2 }, // إزاحة طفيفة
                        ext: { width: 80, height: 80 },
                    });
                }
            } catch (err) {
                console.warn('Failed to add university logo:', err);
            }
        }

        // إضافة شعار الكلية (يسار)
        // نحتاج لمعرفة عرض الصفحة لوضعه في اليسار، لكن ExcelJS لا يدعم ذلك بسهولة في العرض المباشر
        // سنضعه في العمود الثالث مؤقتاً أو نتركه بجانب الأول إذا لم نتمكن من تحديد النهاية
        if (settings.facultyLogoUrl && settings.facultyLogoUrl.startsWith('data:image')) {
            try {
                const facultyLogoBuffer = dataURItoBuffer(settings.facultyLogoUrl);
                if (facultyLogoBuffer.length > 0) {
                    const extension = settings.facultyLogoUrl.includes('png') ? 'png' : 'jpeg';
                    const facultyLogoId = workbook.addImage({
                        buffer: facultyLogoBuffer,
                        extension: extension,
                    });

                    // وضعه في العمود C تقريباً
                    worksheet.addImage(facultyLogoId, {
                        tl: { col: 2.2, row: 0.2 },
                        ext: { width: 80, height: 80 },
                    });
                }
            } catch (err) {
                console.warn('Failed to add faculty logo:', err);
            }
        }
    } catch (error) {
        console.error('Error adding logos:', error);
    }
}

/**
 * تطبيق تنسيق الرأس
 */
function applyHeaderFormatting(
    worksheet: ExcelJS.Worksheet,
    row: ExcelJS.Row,
    settings: PrintSettings
): void {
    row.height = 30;
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.headerBg },
        };
        cell.font = {
            name: 'Arial',
            size: settings.headerFontSize || 14,
            bold: true,
            color: { argb: COLORS.headerText },
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
        };
    });
}

/**
 * تطبيق تنسيق الخلية العادية
 */
function applyCellFormatting(
    cell: ExcelJS.Cell,
    settings: PrintSettings,
    isAlternate: boolean = false
): void {
    if (isAlternate) {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.alternateRow },
        };
    }

    cell.font = {
        name: 'Arial',
        size: settings.cellContentFontSize || 11,
    };

    cell.alignment = {
        vertical: 'middle', // توسيط عمودي أفضل للقراءة
        horizontal: 'center', // توسيط أفقي
        wrapText: true,
    };

    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
    };
}

/**
 * حماية الخلايا (جعلها غير قابلة للتعديل)
 */
async function protectWorksheet(
    worksheet: ExcelJS.Worksheet,
    dataStartRow: number
): Promise<void> {
    // تأمين جميع الخلايا افتراضياً
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.protection = { locked: true };
        });
    });

    // إلغاء تأمين خلايا البيانات فقط
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= dataStartRow) {
            row.eachCell((cell, colNumber) => {
                // إلغاء تأمين خلايا البيانات (العمود الأول هو الوقت، نتركه مؤمناً)
                if (colNumber > 1) {
                    cell.protection = { locked: false };
                }
            });
        }
    });

    // تفعيل حماية الورقة
    await worksheet.protect('djadwal2025', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        insertColumns: false,
        deleteRows: false,
        deleteColumns: false,
    });
}

/**
 * تصدير جدول المحاضرات إلى Excel
 */
export async function exportScheduleToExcel(
    scheduleData: any[][],
    days: string[],
    timeSlots: { start: string; end: string }[],
    title: string,
    subtitle: string,
    settings: PrintSettings
): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('الجدول', {
        views: [{ rightToLeft: true }],
        properties: { defaultRowHeight: 30 },
    });

    let currentRow = 1;

    // إضافة الشعارات
    await addLogosToWorksheet(worksheet, workbook, settings);
    currentRow += 5; // مساحة للشعارات

    // العنوان الرئيسي
    worksheet.mergeCells(currentRow, 1, currentRow, days.length + 1);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = settings.universityName || 'الجامعة';
    titleCell.font = { name: 'Arial', size: settings.titleFontSize || 18, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // اسم الكلية
    worksheet.mergeCells(currentRow, 1, currentRow, days.length + 1);
    const facultyCell = worksheet.getCell(currentRow, 1);
    facultyCell.value = settings.facultyName || 'الكلية';
    facultyCell.font = { name: 'Arial', size: settings.subtitleFontSize || 16 };
    facultyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // عنوان الجدول
    worksheet.mergeCells(currentRow, 1, currentRow, days.length + 1);
    const scheduleTitle = worksheet.getCell(currentRow, 1);
    scheduleTitle.value = title;
    scheduleTitle.font = { name: 'Arial', size: settings.titleFontSize || 16, bold: true };
    scheduleTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // العنوان الفرعي
    worksheet.mergeCells(currentRow, 1, currentRow, days.length + 1);
    const scheduleSubtitle = worksheet.getCell(currentRow, 1);
    scheduleSubtitle.value = subtitle;
    scheduleSubtitle.font = { name: 'Arial', size: settings.subtitleFontSize || 12 };
    scheduleSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow += 2;

    // صف رأس الجدول
    const headerRow = worksheet.getRow(currentRow);
    const dataStartRow = currentRow + 1;
    headerRow.values = ['الوقت', ...days];
    applyHeaderFormatting(worksheet, headerRow, settings);
    currentRow++;

    // بيانات الجدول
    scheduleData.forEach((rowData, index) => {
        const row = worksheet.getRow(currentRow);
        const timeSlot = timeSlots[index];

        // تحضير القيم للصف
        const values = [`${timeSlot.start} - ${timeSlot.end}`, ...rowData.map((cell: any) => {
            if (!cell || (Array.isArray(cell) && cell.length === 0)) return '';

            // إذا كانت الخلية مصفوفة (كما في Schedule.tsx)
            if (Array.isArray(cell)) {
                return cell.map((assignment: any) => {
                    // محاولة الحصول على البيانات بأسماء مختلفة للحقول لضمان عدم فقدان البيانات
                    const course = assignment.course_name || assignment.subject_name || assignment.module_name || '';
                    const group = assignment.group_name || assignment.group || '';
                    const professor = assignment.professor_name || assignment.teacher_name || '';
                    const room = assignment.room_name || assignment.classroom_name || assignment.location || '';

                    // تنسيق النص داخل الخلية
                    return `${course}\n${group}\n${professor} (${room})`;
                }).join('\n-------------------\n'); // فاصل بين الحصص المتعددة في نفس الوقت
            }

            return String(cell);
        })];

        row.values = values;
        row.height = 80; // زيادة الارتفاع لاستيعاب الأسطر المتعددة

        row.eachCell((cell) => {
            applyCellFormatting(cell, settings, index % 2 === 1);
        });

        currentRow++;
    });

    // ضبط عرض الأعمدة
    worksheet.getColumn(1).width = 20; // عمود الوقت
    for (let i = 2; i <= days.length + 1; i++) {
        worksheet.getColumn(i).width = 30; // أعمدة الأيام
    }

    // إضافة فلاتر تلقائية
    worksheet.autoFilter = {
        from: { row: dataStartRow - 1, column: 1 },
        to: { row: currentRow - 1, column: days.length + 1 },
    };

    // حماية الورقة
    await protectWorksheet(worksheet, dataStartRow);

    // تنزيل الملف
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * تصدير قائمة بسيطة إلى Excel (للحصص الإضافية، عبء الأساتذة، إلخ)
 */
export async function exportTableToExcel(
    headers: string[],
    data: any[][],
    title: string,
    subtitle: string,
    settings: PrintSettings,
    filename: string
): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('البيانات', {
        views: [{ rightToLeft: true }],
    });

    let currentRow = 1;

    // إضافة الشعارات
    await addLogosToWorksheet(worksheet, workbook, settings);
    currentRow += 5;

    // العنوان الرئيسي
    worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = settings.universityName || 'الجامعة';
    titleCell.font = { name: 'Arial', size: settings.titleFontSize || 18, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // اسم الكلية
    worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
    const facultyCell = worksheet.getCell(currentRow, 1);
    facultyCell.value = settings.facultyName || 'الكلية';
    facultyCell.font = { name: 'Arial', size: settings.subtitleFontSize || 16 };
    facultyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // عنوان الجدول
    worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
    const tableTitle = worksheet.getCell(currentRow, 1);
    tableTitle.value = title;
    tableTitle.font = { name: 'Arial', size: settings.titleFontSize || 16, bold: true };
    tableTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;

    // العنوان الفرعي
    if (subtitle) {
        worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
        const tableSubtitle = worksheet.getCell(currentRow, 1);
        tableSubtitle.value = subtitle;
        tableSubtitle.font = { name: 'Arial', size: settings.subtitleFontSize || 12 };
        tableSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
        currentRow++;
    }
    currentRow++;

    // صف رأس الجدول
    const headerRow = worksheet.getRow(currentRow);
    const dataStartRow = currentRow + 1;
    headerRow.values = headers;
    applyHeaderFormatting(worksheet, headerRow, settings);
    currentRow++;

    // بيانات الجدول
    data.forEach((rowData, index) => {
        const row = worksheet.getRow(currentRow);
        row.values = rowData;
        row.eachCell((cell) => {
            applyCellFormatting(cell, settings, index % 2 === 1);
        });
        currentRow++;
    });

    // ضبط عرض الأعمدة تلقائيًا
    worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
            const cellLength = cell.value ? cell.value.toString().length : 10;
            if (cellLength > maxLength) {
                maxLength = cellLength;
            }
        });
        column.width = Math.min(maxLength + 2, 50);
    });

    // إضافة فلاتر تلقائية
    worksheet.autoFilter = {
        from: { row: dataStartRow - 1, column: 1 },
        to: { row: currentRow - 1, column: headers.length },
    };

    // حماية الورقة
    await protectWorksheet(worksheet, dataStartRow);

    // تنزيل الملف
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
