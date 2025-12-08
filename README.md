# Djadwal - نظام إدارة الجداول الأكاديمية

**Djadwal** est une application de bureau complète pour la gestion des emplois du temps académiques, développée avec Electron, React, TypeScript et SQLite Cloud. L'application permet aux établissements d'enseignement de gérer efficacement leurs professeurs, cours, salles, groupes d'étudiants et planifications.

## Version actuelle

28.11.25.Turso

## 🚀 Fonctionnalités Principales

### 📊 Tableau de Bord

- Vue d'ensemble des statistiques académiques
- Filtrage par année académique et semestre
- Indicateurs clés de performance

### 👨‍🏫 Gestion des Professeurs (Interface)

- CRUD complet des professeurs avec nettoyages automatiques des données
- **AMÉLIORÉ** : Distinction visuelle des professeurs temporaires + validations renforcées
- Gestion des spécialisations et départements
- Suivi de la charge de travail

### 📚 Gestion des Cours

- Création et modification des matières
- Attribution des cours aux professeurs
- Gestion des codes et crédits

### 🏢 Gestion des Salles

- Inventaire des salles disponibles
- Vérification de disponibilité en temps réel
- **AMÉLIORÉ** : Détection de conflits renforcée pour les salles
- Gestion des capacités et équipements

### 👥 Gestion des Groupes

- Organisation par départements et spécialisations
- Hiérarchie complète : Département → Spécialisation → Groupe
- Filtrage intelligent et recherche

### 📅 Planification des Sessions

- Interface de calendrier intuitive avec localisation arabe
- **NOUVEAU** : Type de session "فرض محروس" (exam) avec règles de conflit dédiées
- **NOUVEAU** : Option "Ignorer les conflits" pour forcer la planification des sessions supplémentaires
- Recherche avancée avec navigation clavier
- **AMÉLIORÉ** : Gestion des conflits automatique renforcée
- Emploi du temps visuel interactif
- **AMÉLIORÉ** : Impression personnalisée avec notes spécifiques aux examens

### 📋 Attribution des Cours

- Attribution professeur-cours-groupe
- Filtrage multicritères
- Validation des contraintes

### 📊 Charge de Travail des Professeurs

- Calcul automatique des heures
- Répartition par type de cours
- Rapports détaillés

### 🖨️ Exportation et Impression

- Export PDF des emplois du temps et annonces aux étudiants
- **NOUVEAU** : Gestion centralisée des logos et paramètres d'impression
- **NOUVEAU** : Notes automatiques pour les séances d'examen (absence = note zéro)
- Export Excel des données
- Paramètres d'impression personnalisables

## 🆕 Nouveautés Version 28.11.25.Turso

### 🚀 Infrastructure & Base de Données

- **Auto-Migration** : Création automatique des tables et colonnes manquantes (`print_settings`, `permissions`) au démarrage
- **Stabilité** : Correction des problèmes de connexion et de requêtes SQL sur Render

### 🎨 Personnalisation & Impression

- **Gestion Centralisée des Logos** : Upload et stockage des logos (Université/Faculté) sur le serveur
- **Paramètres d'Impression** : Configuration globale des noms et logos pour tous les documents PDF

### 🛡️ Sécurité & Permissions

- **Gestion des Permissions** : Système de permissions par utilisateur (lecture/écriture)
- **API Sécurisée** : Nouveaux endpoints pour la gestion des utilisateurs et leurs droits

### 📅 Planification Avancée

- **Forçage de Planification** : Nouvelle option pour ignorer les conflits lors de la création de sessions supplémentaires (utile pour les examens ou cas exceptionnels)
- **Gestion Stricte des Conflits de Cours** : 
    - Un cours de type "Cours Magistral" (Lecture) bloque tous les groupes de la même spécialité.
    - Un cours de type "TD/TP" ne peut pas être placé en même temps qu'un Cours Magistral de la même spécialité.
    - Cette logique est appliquée lors du glisser-déposer (DnD) et de la création de sessions supplémentaires.

### 🧪 Mode Sandbox (Brouillons)

- **Sauvegarde de brouillons** : Possibilité de sauvegarder l'état actuel de l'emploi du temps comme un "brouillon" (Sandbox).
- **Chargement/Restauration** : Basculer entre différents scénarios de planification sans affecter la base de données principale jusqu'à validation.
- **Gestion des snapshots** : Créer, charger et supprimer des snapshots de l'emploi du temps.

### 📧 Récupération de Mot de Passe

- **Integration Gmail** : Système d'envoi d'emails sécurisé pour la réinitialisation de mot de passe.
- **Support SMTP** : Configuration flexible via variables d'environnement.

## 🏗️ Architecture Technique

### Frontend

- **React 18** avec TypeScript
- **Vite** pour le build et développement
- **Tailwind CSS** pour le styling
- **React Router** pour la navigation
- **Lucide React** pour les icônes

### Backend

- **Electron** pour l'application desktop
- **Turso (libSQL)** comme source de vérité cloud
- **SQLite Cloud** pour le backup et développement
- **Better SQLite3** pour les opérations locales
- **Express** pour le serveur API

### Base de Données

- **Turso (libSQL)** (production) - Base de données edge distribuée
- **SQLite Cloud** (backup) - Hébergée
- Tables principales :
  - `professors` - Professeurs
  - `courses` - Cours/Matières
  - `rooms` - Salles
  - `groups` - Groupes d'étudiants
  - `departments` - Départements
  - `specializations` - Spécialisations
  - `academic_years` - Années académiques
  - `semesters` - Semestres
  - `extra_sessions` - Sessions supplémentaires (extra/makeup/exam)
  - `course_assignments` - Attributions cours-professeur

### Fonctionnalités Avancées

- **Navigation Clavier** : Support complet arrow keys + Enter + Escape
- **Recherche en Temps Réel** : Filtrage instantané avec highlighting
- **Contextes React** : Gestion d'état centralisée
- **Hooks Personnalisés** : `useKeyboardNavigation` pour l'interaction clavier
- **Validation TypeScript** : Types stricts pour toutes les entités

## 📁 Structure du Projet

```text
suivie/
├── electron/                    # Code Electron (main process)
│   ├── main.js                 # Point d'entrée principal
│   ├── database.js             # Connexion SQLite Cloud
│   └── preload.js              # Script de préchargement
├── src/
│   ├── components/             # Composants réutilisables
│   │   ├── Sidebar.tsx         # Navigation latérale
│   │   └── ProtectedRoute.tsx  # Protection des routes
│   ├── context/                # Contextes React
│   │   ├── AuthContext.tsx     # Authentification
│   │   ├── AcademicYearContext.tsx # Année académique
│   │   └── AssignmentContext.tsx   # Attributions
│   ├── hooks/                  # Hooks personnalisés
│   │   └── useKeyboardNavigation.ts # Navigation clavier
│   ├── pages/                  # Pages principales
│   │   ├── Dashboard.tsx       # Tableau de bord
│   │   ├── Professors.tsx      # Gestion professeurs
│   │   ├── Courses.tsx         # Gestion cours
│   │   ├── Rooms.tsx           # Gestion salles
│   │   ├── Groups.tsx          # Gestion groupes
│   │   ├── Sessions.tsx        # Planification sessions
│   │   ├── Schedule.tsx        # Emploi du temps visuel
│   │   ├── CourseAssignments.tsx # Attributions
│   │   ├── ProfessorWorkload.tsx # Charge travail
│   │   └── AcademicYears.tsx   # Années académiques
│   ├── services/               # Services API
│   ├── types/                  # Définitions TypeScript
│   └── utils/                  # Utilitaires
├── public/                     # Assets statiques
├── dist-electron/              # Build Electron
└── package.json               # Dépendances
```

## 🛠️ Installation et Configuration

### Prérequis

- **Node.js** 18+
- **npm** ou **yarn**
- **Git**
- **Visual Studio Build Tools** (modules natifs)

### Installation

1. **Cloner le repository**

   ```bash
   git clone <repository-url>
   cd "suivie online 130425/suivie"
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Configurer la base de données**

   Créer un fichier `.env` à la racine :

   ```env
   # Turso (Production)
   USE_TURSO=true
   TURSO_URL=libsql://<instance>.turso.io
   TURSO_AUTH_TOKEN=<token>

   # SQLite Cloud (Backup)
   SQLITECLOUD_USERNAME=your_username
   SQLITECLOUD_PASSWORD=your_password
   SQLITECLOUD_HOST=your_host.sqlite.cloud
   SQLITECLOUD_PORT=8860
   SQLITECLOUD_DATABASE=Djadwal
   ```

4. **Rebuild des modules natifs (bcrypt, better-sqlite3, canvas)**

   ```bash
   npm run rebuild
   ```

### Développement

#### Mode développement web

```bash
npm run dev
```

#### Mode développement Electron

```bash
npm run electron:dev
```

#### Serveur API séparé

```bash
npm run server
```

#### Développement complet

```bash
npm run dev:all
```

### Production

#### Build web

```bash
npm run build
```

#### Build Electron

```bash
npm run electron:build
```

#### Preview production

```bash
npm run electron:preview
```

## 🎯 Utilisation

### Première Configuration

1. Lancer l'application
2. Se connecter avec les identifiants admin
3. Configurer l'année académique courante
4. Ajouter les départements et spécialisations
5. Créer les groupes d'étudiants
6. Ajouter les professeurs et cours
7. Commencer la planification

### Workflow Typique

1. **Configuration initiale** : Années → Départements → Spécialisations → Groupes
2. **Ressources** : Professeurs → Cours → Salles
3. **Attribution** : Cours-Professeur via CourseAssignments
4. **Planification** : Sessions via Schedule avec recherche avancée
5. **Suivi** : Charge de travail et rapports

### Navigation Clavier

- **↑↓** : Navigation dans les listes déroulantes
- **Enter** : Sélection d'un élément
- **Escape** : Fermeture des dropdowns
- **Tab** : Navigation entre champs

## 🔧 Développement Avancé

### Hooks Personnalisés

- `useKeyboardNavigation` : Gestion complète navigation clavier
- Intégration souris + clavier seamless
- Scroll automatique des éléments sélectionnés

### Contextes Globaux

- `AcademicYearContext` : Année et semestre courants
- `AssignmentContext` : Attributions cours-professeur
- `AuthContext` : Authentification utilisateur

### Patterns de Code

- Composants fonctionnels avec hooks
- TypeScript strict pour la sécurité des types
- Filtrage réactif avec useMemo
- Gestion d'état locale avec useState

### Base de Données

- Connexion Turso centralisée avec fallback SQLite Cloud
- Requêtes préparées pour la sécurité
- Gestion d'erreurs robuste et retry automatique
- Cache local pour les performances

## 🐛 Débogage

### Logs

- Console Electron pour les erreurs backend
- DevTools React pour le frontend
- Logs de base de données dans la console

### Problèmes Courants

- **Connexion Turso** : Vérifier `TURSO_URL` + `TURSO_AUTH_TOKEN`
- **Modules natifs** : Exécuter `npm run rebuild`
- **TypeScript** : Vérifier les types dans `/src/types/`
- **Données manquantes** : Utiliser Debug Panel (Dashboard → 🔍 Debug)
- **Notes examens** : Confirmer que le type de session est bien "exam"

## 📦 Déploiement

### Build de Production

```bash
npm run electron:build
```

### Fichiers Générés

- `dist-electron/win-unpacked/` : Application Windows portable
- `dist-electron/Djadwal Setup 19.11.25.Turso.exe` : Installateur Windows

- Support Windows, macOS, Linux
- Auto-updater intégré
- Signature de code configurable

## 🤝 Contribution

### Standards de Code

- **TypeScript** strict
- **ESLint** pour la qualité
- **Prettier** pour le formatage
- **Conventional Commits**

### Types de Tests

- Tests unitaires avec Jest
- Tests d'intégration Electron
- Tests E2E avec Playwright

## 📄 Licence

Propriétaire - Tous droits réservés

## 👨‍💻 Auteur

**Ali** - Développeur principal

---

## 🆘 Support

Pour toute question ou problème :

1. Consulter cette documentation
2. Vérifier les logs d'erreur
3. Contacter l'équipe de développement

**Note pour Windsurf/Cursor** : Cette application utilise des patterns React modernes avec TypeScript strict. Les contextes globaux gèrent l'état partagé, et la navigation clavier est implémentée via des hooks personnalisés. La base de données SQLite Cloud nécessite une configuration `.env` appropriée.
