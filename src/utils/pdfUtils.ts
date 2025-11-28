import html2canvas from 'html2canvas';

/**
 * Ce fichier contient des utilitaires pour la génération de PDF
 * avec support pour l'arabe via une API backend
 */

/**
 * Génère un PDF à partir de contenu HTML en utilisant Electron IPC
 * @param htmlContent Le contenu HTML à convertir en PDF
 * @param options Options pour la génération du PDF
 */
export const generatePDFFromHTML = async (htmlContent: string, options: any) => {
  try {
    // Configurer les options par défaut pour les horaires
    let pdfOptions = options;
    if (typeof options === 'string') {
      // Si options est une chaîne, c'est le nom du fichier
      pdfOptions = { 
        filename: options,
        format: 'A4',
        landscape: true,
        margins: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm'
        },
        printBackground: true
      };
    }
    
    // Utiliser la fonction IPC exposée par Electron
    const result = await window.dataUtils.generatePDF(htmlContent, pdfOptions);
    
    if (!result.success) {
      throw new Error(`Erreur lors de la génération du PDF: ${result.error}`);
    }
    
    // Convertir le buffer en blob
    const buffer = result.buffer;
    let blob;
    
    if (buffer) {
      blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    } else {
      throw new Error('Le buffer PDF est vide');
    }
    
    // Créer un URL pour le blob
    const url = window.URL.createObjectURL(blob);
    
    // Créer un lien pour télécharger le PDF
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfOptions.filename || result.filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
};

/**
 * Solution de secours pour générer un PDF à partir de contenu HTML en utilisant html2canvas
 * @param htmlContent Le contenu HTML à convertir en image
 * @param options Options pour la génération de l'image
 */
export const generatePDFFromHTMLFallback = async (htmlContent: string, options: any) => {
  try {
    // Création d'un élément div temporaire pour contenir le HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    // Utilisation de html2canvas pour capturer le contenu HTML
    const canvas = await html2canvas(tempDiv, {
      scale: 2, // Meilleure qualité
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    // Nettoyage du div temporaire
    document.body.removeChild(tempDiv);

    // Création d'un lien pour télécharger l'image
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = (options.filename || 'document').replace('.pdf', '.png');
    document.body.appendChild(a);
    a.click();

    // Nettoyage
    document.body.removeChild(a);
  } catch (error) {
    console.error('Erreur lors de la génération de l\'image:', error);
    throw error;
  }
};

/**
 * Crée un template HTML pour une table avec en-tête institutionnel
 * @param title Titre du document
 * @param subtitle Sous-titre du document
 * @param headers En-têtes de la table
 * @param data Données de la table
 * @returns Le contenu HTML
 */
export const createTableTemplate = async (title: string, subtitle: string, headers: string[], data: string[][]) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 5mm;
          size: A4;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .header {
          text-align: center;
          margin-bottom: 2mm;
          position: relative;
          min-height: 120px;
        }
        .logo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 120px;
          height: auto;
          opacity: 0.2;
          z-index: 1;
        }
        .header-content {
          position: relative;
          z-index: 2;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          margin: 1mm 0;
        }
        .subtitle {
          font-size: 12px;
          margin-bottom: 1mm;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1mm;
        }
        th, td {
          border: 1px solid black;
          padding: 1mm;
          text-align: center;
          font-size: 10px;
        }
        th {
          background-color: #f0f0f0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/images/university-logo.svg" alt="Logo" class="logo">
        <div class="header-content">
          <div class="title">${title}</div>
          <div class="subtitle">${subtitle}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

/**
 * Crée un template HTML pour une image
 * @param title Titre du document
 * @param subtitle Sous-titre du document
 * @param imageDataUrl URL de l'image (data URL)
 * @param additionalText Texte supplémentaire
 * @returns Le contenu HTML
 */
export const createImageTemplate = (title: string, subtitle: string, imageDataUrl: string, additionalText?: string) => {
  return `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 20px;
      direction: rtl;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 18px;
      color: #666;
      margin-bottom: 20px;
    }
    .image-container {
      text-align: center;
      margin-bottom: 20px;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
    }
    .additional-text {
      font-size: 16px;
      margin-top: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
  </div>
  
  <div class="image-container">
    <img src="${imageDataUrl}" alt="Image">
  </div>
  
  ${additionalText ? `<div class="additional-text">${additionalText}</div>` : ''}
</body>
</html>`;
};

/**
 * Crée un template HTML pour un tableau d'emploi du temps
 * @param title Titre du document
 * @param data Données du tableau (jours, heures, cours, etc.)
 * @returns Le contenu HTML
 */
export const createScheduleTemplate = async (title: string, subtitle: string, data: any[][], days: string[], timeSlots: {start: string, end: string}[]) => {
  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 5mm;
          size: A4;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          direction: rtl;
        }
        .header {
          text-align: center;
          margin-bottom: 2mm;
          position: relative;
          min-height: 120px;
        }
        .logo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          max-width: 120px;
          height: auto;
          opacity: 0.2;
          z-index: 1;
        }
        .header-content {
          position: relative;
          z-index: 2;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          margin: 1mm 0;
        }
        .subtitle {
          font-size: 12px;
          margin-bottom: 1mm;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1mm;
        }
        th, td {
          border: 1px solid black;
          padding: 1mm;
          text-align: center;
          font-size: 10px;
          vertical-align: top;
        }
        th {
          background-color: #f0f0f0;
        }
        .time-slot {
          font-weight: bold;
        }
        .course-info {
          margin-bottom: 2px;
        }
        .professor-info {
          font-size: 9px;
          color: #666;
        }
        .separator {
          border-top: 1px dashed #ccc;
          margin: 2px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/images/university-logo.svg" alt="Logo" class="logo">
        <div class="header-content">
          <div class="title">${title}</div>
          <div class="subtitle">${subtitle}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>التوقيت</th>
            ${days.map(day => `<th>${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${timeSlots.map((timeSlot, timeIndex) => `
            <tr>
              <td class="time-slot">${timeSlot.start} - ${timeSlot.end}</td>
              ${days.map((day, dayIndex) => {
                const cellData = data[dayIndex][timeIndex];
                if (!cellData || cellData.length === 0) {
                  return '<td></td>';
                }
                return `<td>
                  ${cellData.map((assignment: any, index: number) => `
                    <div class="course-info">${assignment.course_name} (${assignment.group_name})</div>
                    <div class="professor-info">${assignment.professor_name} (${assignment.room_name})</div>
                    ${index < cellData.length - 1 ? '<div class="separator"></div>' : ''}
                  `).join('')}
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
};

/**
 * Génère un PDF combiné à partir de plusieurs contenus HTML
 * @param htmlContents Tableau de contenus HTML à combiner dans un seul PDF
 * @param filename Nom du fichier PDF à générer
 */
export const generateCombinedPDFFromHTML = async (htmlContents: string[], filename: string) => {
  try {
    // Si aucun contenu, sortir immédiatement
    if (!htmlContents || htmlContents.length === 0) {
      throw new Error('Aucun contenu HTML fourni pour la génération du PDF');
    }
    
    // Créer un contenu HTML combiné avec des sauts de page entre chaque document
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        </style>
      </head>
      <body>
        ${htmlContents.map((content, index) => `
          <div class="pdf-page">
            ${content}
            ${index < htmlContents.length - 1 ? '<div class="page-break"></div>' : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    // Configurer les options du PDF
    const pdfOptions = { 
      filename: filename,
      format: 'A4',
      landscape: false,
      margins: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      printBackground: true
    };
    
    // Générer le PDF combiné
    const result = await window.dataUtils.generatePDF(combinedHTML, pdfOptions);
    
    if (!result.success) {
      throw new Error(`Erreur lors de la génération du PDF combiné: ${result.error}`);
    }
    
    // Convertir le buffer en blob
    const buffer = result.buffer;
    let blob;
    
    if (buffer) {
      blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    } else {
      throw new Error('Le buffer PDF est vide');
    }
    
    // Créer un URL pour le blob
    const url = window.URL.createObjectURL(blob);
    
    // Créer un lien pour télécharger le PDF
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfOptions.filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF combiné:', error);
    throw error;
  }
};
