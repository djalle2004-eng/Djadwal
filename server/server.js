require('dotenv').config();
const { validateEnvironment } = require('../packages/core/src/config/env.js');

// Enforce strict environment validation
validateEnvironment(process.env, {
  exitOnError: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
});

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const {
  isHardeningEnabled,
  corsMiddleware,
  helmetMiddleware,
  permissionsPolicyMiddleware,
  generalLimiter,
  sensitiveLimiter,
  csrfProtectionMiddleware,
  securityErrorHandler
} = require('./middleware/security');

// Configuration du serveur
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3001;
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

const apiRoutes = require('./routes');

// 1. Cookie Parser (Must be loaded first to provide req.cookies to security middlewares)
app.use(cookieParser());

// 2. HTTP Security Perimeter
if (isHardeningEnabled) {
  app.use(helmetMiddleware);
  app.use(permissionsPolicyMiddleware);
  app.use(corsMiddleware);
  app.use(generalLimiter);
  app.use('/api/auth', sensitiveLimiter);
  app.use('/api/generate-pdf', sensitiveLimiter);
  app.use(csrfProtectionMiddleware);
} else {
  app.use(cors());
}

// 3. Lowered Request Body Limits (256KB)
const jsonLimit = isHardeningEnabled ? '256kb' : '50mb';
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonLimit }));

// API Routes
app.use('/api', apiRoutes);

// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../dist')));

// Anything that doesn't match the above, send back index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling
app.use(securityErrorHandler);

// Démarrage du serveur
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Serveur de génération de PDF démarré sur le port ${port}`);
  });
}

module.exports = app;
