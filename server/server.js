const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration du serveur
const app = express();
const port = process.env.PORT || 3001;
const upload = multer();

const apiRoutes = require('./routes');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', apiRoutes);

// Dossier pour stocker temporairement les PDF
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Route pour générer un PDF à partir de HTML
app.post('/api/generate-pdf', upload.none(), async (req, res) => {
  try {
    const { html } = req.body;
    const options = JSON.parse(req.body.options || '{}');

    if (!html) {
      return res.status(400).json({ error: 'Le contenu HTML est requis' });
    }

    // Configuration des options par défaut si non fournies
    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margins || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      printBackground: true
    };

    // Nom du fichier
    const filename = options.filename || `document-${Date.now()}.pdf`;
    const outputPath = path.join(tempDir, filename);

    // Génération du PDF avec Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Configuration pour le support de l'arabe
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Génération du PDF
    await page.pdf({
      path: outputPath,
      ...pdfOptions
    });

    await browser.close();

    // Envoi du PDF au client
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Erreur lors de l\'envoi du fichier:', err);
        return res.status(500).json({ error: 'Erreur lors de l\'envoi du fichier' });
      }

      // Suppression du fichier temporaire après envoi
      fs.unlink(outputPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Erreur lors de la suppression du fichier temporaire:', unlinkErr);
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// Route de test
app.get('/api/status', (req, res) => {
  res.json({ status: 'Le serveur de génération de PDF est en ligne' });
});

// Démarrage du serveur
// Démarrage du serveur
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Serveur de génération de PDF démarré sur le port ${port}`);
  });
}

module.exports = app;
