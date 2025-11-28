# Djadwal - Documentation Technique pour Développeurs

**Version : 19.11.2025.Turso**

Cette documentation s'adresse aux développeurs externes qui prendront en charge le développement et la maintenance de l'application Djadwal.

## 🏗️ Architecture Globale

### Stack Technologique

- **Frontend** : React 18 + TypeScript + Vite
- **Desktop** : Electron 29.4.6
- **Base de données** :
  - **Production** : Turso (libSQL) avec drivers @libsql/client
  - **Backup** : SQLiteCloud
  - **Local** : Better SQLite3
- **Styling** : Tailwind CSS 3.4.17
- **Build** : Vite 5.0.12 + Electron Builder
- **Langues** : Français + Arabe (RTL support)

### Structure des Processus Electron

```text
Main Process (electron/main.js)
├── Database Connection (database.js)
├── Window Management
└── IPC Handlers

Renderer Process (React App)
├── Frontend Components
├── Context Providers
└── IPC Communication
```

## 📁 Architecture des Dossiers

```
suivie/
├── electron/                    # Main Process Electron
│   ├── main.js                 # Point d'entrée principal
│   ├── database.js             # Gestion Turso/SQLiteCloud + reconnexion auto
│   ├── database-sqlite.js      # Fallback SQLite local (non utilisé)
│   └── preload.js              # Bridge sécurisé IPC
├── src/                        # Renderer Process (React)
│   ├── components/             # Composants réutilisables
│   │   ├── Sidebar.tsx         # Navigation principale
│   │   └── ProtectedRoute.tsx  # Protection d'accès
│   ├── context/                # State Management Global
│   │   ├── AuthContext.tsx     # Authentification
│   │   ├── AcademicYearContext.tsx # Année/Semestre actuel
│   │   └── AssignmentContext.tsx   # Gestion des attributions
│   ├── hooks/                  # Custom Hooks
│   │   └── useKeyboardNavigation.ts # Navigation clavier
│   ├── pages/                  # Pages principales
│   │   ├── Dashboard.tsx       # Tableau de bord
│   │   ├── Professors.tsx      # CRUD Professeurs
│   │   ├── Courses.tsx         # CRUD Cours
│   │   ├── Rooms.tsx           # CRUD Salles
│   │   ├── Groups.tsx          # CRUD Groupes
│   │   ├── Schedule.tsx        # Planning visuel
│   │   ├── AvailableRooms.tsx  # Sessions supplémentaires
│   │   ├── CourseAssignments.tsx # Attributions cours-prof
│   │   ├── ProfessorWorkload.tsx # Charge de travail
│   │   └── AcademicYears.tsx   # Gestion années académiques
│   ├── services/               # API Services
│   │   └── academicYearService.ts # Service années académiques
│   ├── types/                  # Définitions TypeScript
│   │   └── academicYear.ts     # Types années/semestres
│   └── utils/                  # Utilitaires
├── public/                     # Assets statiques
│   ├── fonts/                  # Polices arabes
│   └── images/                 # Images/icônes
├── dist-electron/              # Build Electron
└── package.json               # Dépendances et scripts
```

## 🔧 Configuration et Installation

### Prérequis Développement

```bash
Node.js >= 18.0.0
npm >= 9.0.0
Python 3.x (pour modules natifs)
Visual Studio Build Tools (Windows)
```

### Installation Complète

```bash
# Clone et installation
git clone <repository>
cd "suivie online 130425/suivie"
npm install

# Rebuild modules natifs pour Electron
npm run rebuild

# Configuration base de données
cp .env.example .env
# Éditer .env avec vos credentials Turso / SQLiteCloud
```

### Variables d'Environnement (.env)
```env
# Turso (Production)
USE_TURSO=true
TURSO_URL=libsql://<instance>.turso.io
TURSO_AUTH_TOKEN=<token>

# SQLite Cloud (Backup/Development)
SQLITECLOUD_USERNAME=your_username
SQLITECLOUD_PASSWORD=your_password
SQLITECLOUD_HOST=your_host.sqlite.cloud
SQLITECLOUD_PORT=8860
SQLITECLOUD_DATABASE=Djadwal
```

## 🗄️ Architecture Base de Données

### Schéma Principal
```sql
-- Tables principales
academic_years (id, year_name, is_current, created_at)
semesters (id, academic_year_id, semester_name, start_date, end_date, is_current)
departments (id, name, code, created_at)
groups (id, name, specialization, parent_group_id, department_id, group_type, year)
professors (id, name, email, Title, Phone, "Academic Title", created_at)
courses (id, name, code, metadata, department_id, created_at)
rooms (id, name, capacity, created_at)

-- Tables de liaison
assignments (id, group_id, course_id, professor_id, room_id, day_of_week, 
            start_time, end_time, session_type, academic_year, semester, 
            specialization, created_at)
extra_sessions (id, group_id, course_id, professor_id, room_id, session_date,
               start_time, end_time, description, session_type, academic_year,
               semester, created_at)
```

### Connexion Turso (Production)

Le fichier `electron/database.js` gère prioritairement la connexion à **Turso** :

- **Edge database** : libSQL distribué, faible latence
- **Auto-reconnexion** : Système de retry (5 tentatives, 2s)
- **Health monitoring** : Ping périodique (30s) avec bascule automatique
- **Fallback** : Basculer sur SQLiteCloud ou BetterSQLite3 en cas d'indisponibilité
- **Prepared statements** : Sécurité contre l'injection SQL
- **Gestion des métadonnées** : colonnes dynamiques (`is_archived`, `exam_note`)

```javascript
// Fonctions principales
initDatabaseConnection()    // Connexion initiale Turso/SQLiteCloud
reconnectDatabase()         // Reconnexion automatique
executeQuery(query, params) // Requêtes avec retry + logs détaillés
ensureExamNoteColumn()      // Ajout dynamique de colonnes si nécessaire
```

### Nouvelles Fonctions Database (v26.10.2025)
```javascript
// Années académiques
addAcademicYear(yearName, setAsCurrent)
deleteAcademicYear(yearId)
setActiveAcademicYear(yearId)

// Semestres
addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent)
updateSemester(semesterId, semesterName, startDate, endDate)
deleteSemester(semesterId)
setActiveSemester(semesterId)
```

## ⚛️ Architecture React

### Contextes Globaux

#### AcademicYearContext
```typescript
interface AcademicYearContextType {
  currentYear: AcademicYear | null;
  currentSemester: Semester | null;
  setCurrentYear: (year: AcademicYear) => void;
  setCurrentSemester: (semester: Semester) => void;
  refreshCurrentSemester: () => Promise<void>;
}
```
- **Persistance localStorage** : Sauvegarde automatique des sélections
- **Auto-restore** : Restauration au démarrage
- **Validation** : Vérification cohérence année/semestre

#### AssignmentContext
```typescript
// Gestion centralisée des attributions cours-professeur
// Synchronisation temps réel avec base de données
// Cache local pour performances
```

### Hooks Personnalisés

#### useKeyboardNavigation
```typescript
interface UseKeyboardNavigationProps<T> {
  items: T[];
  isOpen: boolean;
  onSelect: (item: T) => void;
  getItemId?: (item: T, index: number) => string;
}
```
- **Navigation flèches** : ↑↓ pour naviguer
- **Sélection Enter** : Validation
- **Échappement Escape** : Fermeture
- **Scroll automatique** : Suivi élément sélectionné
- **Intégration souris** : Hover + click

### Patterns de Développement

#### State Management
```typescript
// Local state pour UI
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

// Global state via Context
const { currentYear, currentSemester } = useAcademicYear();

// Derived state avec useMemo
const filteredData = useMemo(() => 
  data.filter(item => item.year === currentYear?.year_name), 
  [data, currentYear]
);
```

#### Effect Patterns
```typescript
// Data fetching
useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const result = await api.getData();
      setData(result);
    } catch (error) {
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchData();
}, [dependency]);

// Cleanup
useEffect(() => {
  const interval = setInterval(checkHealth, 30000);
  return () => clearInterval(interval);
}, []);
```

## 🎨 Interface Utilisateur

### Système de Design
- **Tailwind CSS** : Utility-first CSS
- **Responsive** : Mobile-first approach
- **Dark mode** : Support thème sombre
- **RTL Support** : Interface arabe complète

### Composants Clés

#### Navigation (Sidebar.tsx)
```typescript
// Navigation principale avec état actif
// Gestion permissions par rôle
// Responsive collapse/expand
```

#### Dropdowns avec Recherche
```typescript
// Pattern standard pour tous les selects
// Recherche temps réel
// Navigation clavier intégrée
// Highlighting des résultats
```

#### Modals et Dialogs
```typescript
// Gestion état ouverture/fermeture
// Validation formulaires
// Gestion erreurs
// Actions async avec loading states
```

### Gestion des Conflits
Le système détecte automatiquement :
- **Conflits professeurs** : Double booking même créneau
- **Conflits groupes** : Cours simultanés
- **Conflits salles** : Occupation multiple
- **Validation temps réel** : Avant sauvegarde

## 🔄 Flux de Données

### Cycle de Vie Typique
```
1. User Action (click, type, select)
2. State Update (useState, Context)
3. Effect Trigger (useEffect)
4. API Call (database.js)
5. Database Operation (SQLiteCloud)
6. Response Processing
7. State Update
8. UI Re-render
```

### Gestion d'Erreurs
```typescript
// Pattern standard pour toutes les opérations
try {
  setIsLoading(true);
  setError(null);
  const result = await operation();
  setData(result);
} catch (error) {
  console.error('Operation failed:', error);
  setError(error instanceof Error ? error : new Error('Unknown error'));
} finally {
  setIsLoading(false);
}
```

## 🚀 Scripts de Développement

### Commandes Principales
```bash
# Développement
npm run dev              # Vite dev server (web)
npm run electron:dev     # Electron + React dev
npm run server          # API server séparé
npm run dev:all         # Tout en parallèle

# Build
npm run build           # Build React
npm run electron:build  # Build Electron complet
npm run rebuild         # Rebuild modules natifs

# Tests et Qualité
npm run lint            # ESLint
npm run type-check      # TypeScript check
npm run format          # Prettier
```

### Configuration Vite (vite.config.ts)
```typescript
// Configuration optimisée pour Electron
// Hot reload activé
// Proxy API configuré
// Build optimizations
```

### Configuration Electron Builder
```json
// package.json - build section
{
  "appId": "com.djadwal.app",
  "productName": "Djadwal",
  "directories": {
    "output": "dist-electron"
  },
  "files": ["dist/**/*", "electron/**/*"],
  "win": {
    "target": "nsis",
    "icon": "public/icon.ico"
  }
}
```

## 🐛 Débogage et Monitoring

### Logs et Debug
```javascript
// Database logs
console.log('[DEBUG] Query:', query);
console.log('[DEBUG] Params:', params);

// Connection monitoring
console.log('✅ Connexion SQLiteCloud en bonne santé');
console.log('❌ Problème de connexion détecté');

// React DevTools
// Electron DevTools
// Network monitoring
```

### Problèmes Courants

#### Connexion Base de Données
```bash
# Symptômes : Erreurs de connexion, timeouts
# Solutions :
1. Vérifier .env credentials
2. Tester connexion réseau
3. Vérifier logs auto-reconnexion
4. Redémarrer si nécessaire
```

#### Modules Natifs
```bash
# Symptômes : Erreurs de compilation, modules manquants
# Solutions :
npm run rebuild
npm install --force
# Vérifier Python/Visual Studio Build Tools
```

#### TypeScript Errors
```bash
# Symptômes : Erreurs de types, compilation
# Solutions :
npm run type-check
# Vérifier types dans /src/types/
# Mettre à jour @types/* si nécessaire
```

## 🔐 Sécurité

### Electron Security
- **Context Isolation** : Activé
- **Node Integration** : Désactivé dans renderer
- **Preload Script** : Bridge sécurisé IPC
- **CSP** : Content Security Policy configuré

### Base de Données
- **Prepared Statements** : Protection SQL injection
- **Connection Encryption** : SQLiteCloud TLS
- **Credentials** : Variables d'environnement uniquement

## 📦 Déploiement

### Build de Production
```bash
# Build complet
npm run electron:build

# Fichiers générés
dist-electron/
├── win-unpacked/                       # Application portable
├── Djadwal Setup 26.10.2025.Neon.exe  # Installateur Windows
└── latest.yml                         # Auto-updater metadata
```

### Configuration .env pour Production
```env
USE_NEON=true
NEON_CONNECTION_STRING=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Distribution Multi-Plateforme
```json
// Configuration pour macOS/Linux
"mac": {
  "target": "dmg",
  "icon": "public/icon.icns"
},
"linux": {
  "target": "AppImage",
  "icon": "public/icon.png"
}
```

## 🔄 Maintenance et Évolution

### Ajout de Nouvelles Fonctionnalités
1. **Créer types TypeScript** dans `/src/types/`
2. **Ajouter tables DB** si nécessaire dans `database.js`
3. **Créer service** dans `/src/services/`
4. **Développer composants** dans `/src/components/` ou `/src/pages/`
5. **Ajouter routes** dans `App.tsx`
6. **Tester et déboguer**

### Mise à Jour Dépendances
```bash
# Vérifier outdated
npm outdated

# Mise à jour sécurisée
npm update

# Rebuild après mise à jour majeure
npm run rebuild
```

### Monitoring Production
- **Logs Electron** : Console main process
- **Crash Reports** : Electron crash reporter
- **Performance** : React DevTools Profiler
- **Database** : SQLiteCloud dashboard

## 📞 Support Technique

### Contacts Clés
- **Développeur Principal** : Ali
- **Base de Données** : SQLiteCloud support
- **Electron** : Documentation officielle

### Ressources Utiles
- [Electron Documentation](https://electronjs.org/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [SQLiteCloud Documentation](https://sqlitecloud.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Note Importante** : Cette application utilise des patterns React modernes avec TypeScript strict. La gestion d'état est centralisée via des Contextes, et la navigation clavier est implémentée partout. Le système de reconnexion automatique SQLiteCloud est critique pour la stabilité en production.
