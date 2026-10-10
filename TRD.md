# Document des Exigences Techniques (TRD) - Djadwal

**Nom du Projet :** Djadwal (نظام إدارة الجداول الأكاديمية)  
**Version Technique :** 28.11.25.Turso  
**Auteur / Responsable Technique :** Ali Hussain & Équipe Ingénierie Djadwal  
**Statut :** Spécification Technique de Référence  
**Date :** 10 Octobre 2026  
**Dépôt :** `djalle2004-eng/Djadwal`  
**Document Associé :** [PRD.md](file:///c:/perso/suivie%20online%20130425/suivie29092025/hyper-V/suivie/suivie/PRD.md)

---

## 1. Vue d'Ensemble & Objectifs Techniques

Le présent document (**Technical Requirements Document - TRD**) détaille les spécifications d'ingénierie, l'architecture logicielle, le schéma de données physique, les protocoles réseau, les algorithmes de résolution de conflits et les processus de build/déploiement de la solution **Djadwal**.

### 1.1 Objectifs Clés d'Ingénierie
- **Dualité Runtime (Desktop / Web)** : Codebase unifiée capable de fonctionner soit en application lourde Electron avec IPC, soit en application Web pure via API REST Express.
- **Résilience des Données (Hybrid Cloud)** : Connecteur distribué libSQL / Turso avec failover local et reconnexion automatique.
- **Rendu Arabe RTL Haute Définition** : Traitement typographique vectoriel des glyphes arabes dans les exports PDF administratifs sans altération du texte bidirectionnel.
- **Algorithme Déterministe de Détection des Conflits** : Évaluation synchrone des chevauchements d'horaires et des contraintes hiérarchiques de promotion (CM vs TD/TP).

---

## 2. Stack Technique & Dépendances

### 2.1 Environnement d'Exécution & Frontend
- **Runtime** : Node.js `>= 18.0.0` (LTS), Electron `29.4.6`
- **Frontend SPA** : React `18.3.1`, TypeScript `5.3.3`, Vite `5.0.12`
- **UI & Design System** :
  - Tailwind CSS `3.4.17` + PostCSS
  - Material UI (MUI) `@mui/material` `^6.5.0`, `@mui/icons-material`, Emotion
  - AG-Grid Community / React `^34.3.0`
- **Drag & Drop** : `@dnd-kit/core` `^6.3.1`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`
- **Moteur d'Impression & Documents** :
  - `jspdf` `^3.0.0`, `jspdf-autotable` `^5.0.2`
  - `@pdf-lib/fontkit` `^1.1.1`, `html2canvas` `^1.4.1`, `@react-pdf/renderer` `^4.2.2`
  - `exceljs` `^4.4.0`, `file-saver` `^2.0.5`

### 2.2 Backend API & Authentification
- **Serveur HTTP** : Express `5.1.0` avec middleware `cors`, `cookie-parser`, `dotenv`
- **Sécurité & Chiffrement** :
  - `bcrypt` `^6.0.0` (hachage des mots de passe salés à 10 tours)
  - `jose` `^6.1.3` (génération et vérification de tokens JWT HS256)
- **Pilotes Base de Données** :
  - Production / Cloud : `@libsql/client` `^0.14.0` (Turso DB over HTTPS/WSS)
  - Desktop Local : `better-sqlite3` `^11.9.1`

### 2.3 Écosystème Satellites
- **Portail Enseignant (`takleef/`)** : Next.js 14, React 18, Tailwind CSS, `next-intl` (i18n Arabe/Français).
- **Application Mobile (`mobile/`)** : React Native `0.74`, Expo SDK 51, Metro bundler.

---

## 3. Architecture Logicielle & Modèle de Conception

```
+───────────────────────────────────────────────────────────────────────────────+
|                           COUCHE DE PRÉSENTATION (UI)                         |
|  Composants React (Schedule, AvailableRooms, Professors, PrintSettings...)    |
+───────────────────────────────────────────────────────────────────────────────+
                                        │
                                        ▼
+───────────────────────────────────────────────────────────────────────────────+
|                          COUCHE D'ADAPTATION (DATABASE FACADE)                |
|           Djadwal Data Adapter Pattern : window.db || webClient               |
|                                                                               |
|   Si window.db défini (Mode Desktop Electron) :                               |
|       Renderer -> Preload contextBridge (IPC invoke) -> Electron Main Process|
|                                                                               |
|   Si window.db absent (Mode Web / Cloud) :                                    |
|       Renderer -> fetchApi() HTTP REST -> Serveur Express (/api/*)           |
+───────────────────────────────────────────────────────────────────────────────+
                                        │
                                        ▼
+───────────────────────────────────────────────────────────────────────────────+
|                      MOTEUR DE PERSISTANCE & CONNECTIVITÉ                     |
|                                                                               |
|   [ database.js (LibSQL Adapter) ]                                            |
|   - Création du client Turso via createClient({ url, authToken })             |
|   - Reconnexion automatique avec retry loop                                   |
|   - Migrations à chaud (ensureSandboxTable, ensureSemesterPublicColumn...)   |
|   - Requêtes paramétrées avec injection-safety ($1, $2, ...)                  |
+───────────────────────────────────────────────────────────────────────────────+
```

### 3.1 Pattern Facade & Double Exécution
L'application utilise un patron de conception en façade pour l'accès aux données :
1. **Mode Electron** : `electron/preload.js` expose un objet immuable `window.db` via `contextBridge.exposeInMainWorld('db', { ... })`. Le sandboxing est garanti avec `contextIsolation: true` et `nodeIntegration: false`.
2. **Mode Web** : `src/api/webClient.ts` implémente exactement la même interface que `window.db`, traduisant chaque appel en requête HTTP `fetch` vers l'API Express `/api/...`.
3. **Consommation transparente** : Les composants d'interface et services (`assignmentService.ts`, etc.) appellent l'API unifiée sans se soucier du runtime sous-jacent.

---

## 4. Schéma Physique de la Base de Données (DDL & Entités)

Le stockage repose sur un dialecte SQLite3 / libSQL compatible Turso.

### 4.1 Tables Pédagogiques Fondamentales

#### `departments` (Départements)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| `name` | TEXT | NOT NULL | Nom du département |
| `code` | TEXT | UNIQUE | Code mnémonique (ex: INFO, MATH) |

#### `specialties` (Spécialités / Filières)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| `name` | TEXT | NOT NULL | Nom de la spécialité |
| `department_id` | INTEGER | REFERENCES departments(id) | Département parent |
| `level` | TEXT | | Niveau (L1, L2, L3, M1, M2) |

#### `groups` (Sections et Groupes)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| `name` | TEXT | NOT NULL | Nom du groupe (ex: Groupe 1, Section A) |
| `specialization` | TEXT | | Libellé ou code de spécialité |
| `parent_group_id` | INTEGER | REFERENCES groups(id) NULL | Section parente (si sous-groupe TD/TP) |
| `department_id` | INTEGER | REFERENCES departments(id) | Département |
| `group_type` | TEXT | CHECK(group_type IN ('SECTION', 'GROUP')) | Type de division |
| `year` | INTEGER | | Année d'étude (1, 2, 3...) |

#### `rooms` (Salles de cours)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| `name` | TEXT | NOT NULL | Numéro ou nom de salle |
| `capacity` | INTEGER | DEFAULT 30 | Capacité maximale d'accueil |
| `type` | TEXT | DEFAULT 'CLASSROOM' | AMPHI, TD, LAB_TP, EXAM |
| `building` | TEXT | | Bâtiment ou aile |

#### `courses` (Matières / Modules)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant unique |
| `name` | TEXT | NOT NULL | Intitulé officiel |
| `code` | TEXT | | Code matière (ex: INF101) |
| `metadata` | TEXT | (JSON) | Volume horaire cours/TD/TP, crédits, coef |

---

### 4.2 Tables Enseignants, Authentification & Droits

#### `users` (Comptes Utilisateurs)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant utilisateur |
| `username` | TEXT | UNIQUE NOT NULL | Nom d'utilisateur ou login |
| `email` | TEXT | UNIQUE NOT NULL | Adresse mail institutionnelle |
| `password_hash` | TEXT | NOT NULL | Hash Bcrypt (10 rounds) |
| `role` | TEXT | DEFAULT 'PROFESSOR' | ADMIN, HOD, PROFESSOR, VIEWER |
| `is_active` | INTEGER | DEFAULT 1 | 1 = actif, 0 = suspendu |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Date de création |

#### `professors` (Dossier Enseignant)
| Colonne | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identifiant professeur |
| `user_id` | INTEGER | REFERENCES users(id) ON DELETE SET NULL | Compte lié |
| `name` | TEXT | NOT NULL | Nom usuel |
| `full_name_arabic` | TEXT | | Nom complet en caractères arabes |
| `full_name_latin` | TEXT | | Nom complet en caractères latins |
| `professional_email` | TEXT | | Email professionnel |
| `personal_email` | TEXT | | Email secondaire |
| `primary_phone` | TEXT | | Numéro de téléphone principal |
| `academic_rank` | TEXT | | Grade (Professeur, MCA, MCB, MAA, MAB, Vacataire) |
| `department` | TEXT | | Département d'affectation |
| `phd_specialization`| TEXT | | Spécialité doctorale |
| `field_of_research` | TEXT | | Axe de recherche |
| `profile_completed` | INTEGER | DEFAULT 0 | Indicateur profil complété |

---

### 4.3 Tables de Planification & Planning

#### `academic_years` & `semesters`
```sql
CREATE TABLE academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_name TEXT NOT NULL,
    is_current INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
    semester_name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 1
);
```

#### `course_assignments` & `sessions` (Affectations & Séances)
```sql
CREATE TABLE course_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES groups(id),
    course_id INTEGER REFERENCES courses(id),
    professor_id INTEGER REFERENCES professors(id),
    room_id INTEGER REFERENCES rooms(id),
    day_of_week INTEGER NOT NULL,      -- 1=Dimanche, 2=Lundi, ..., 7=Samedi
    start_time TEXT NOT NULL,          -- Format HH:MM (ex: '08:00')
    end_time TEXT NOT NULL,            -- Format HH:MM (ex: '09:30')
    academic_year TEXT,
    semester TEXT,
    specialization TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER REFERENCES course_assignments(id),
    session_type TEXT DEFAULT 'COURSE', -- COURSE, TD, TP, EXAM
    is_exam INTEGER DEFAULT 0,          -- 1 si "فرض محروس"
    ignore_conflicts INTEGER DEFAULT 0, -- 1 si forçage autorisé
    notes TEXT
);
```

#### `sandbox_snapshots` (Brouillons & Simulations)
```sql
CREATE TABLE sandbox_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,                 -- Payload JSON compressé de l'emploi du temps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `print_settings` (Paramétrage Identité & Impression)
```sql
CREATE TABLE print_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    republic_name_ar TEXT,
    ministry_name_ar TEXT,
    university_name_ar TEXT,
    faculty_name_ar TEXT,
    university_logo_url TEXT,
    faculty_logo_url TEXT,
    custom_footer_ar TEXT,
    exam_disclaimer_ar TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Spécifications des APIs & Protocoles

### 5.1 Matrice des Endpoints REST (Express Backend)

| Méthode | Endpoint | Authentification | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Inscription enseignant (`@univ-eloued.dz`) |
| `POST` | `/api/auth/signin` | Public | Authentification & délivrance cookie JWT |
| `POST` | `/api/auth/signout` | Requis | Révocation de session & suppression cookie |
| `GET` | `/api/auth/me` | Requis | Profil utilisateur connecté |
| `GET` | `/api/departments` | Public | Liste ordonnée des départements |
| `POST` | `/api/departments` | Admin | Ajout d'un département |
| `GET` | `/api/groups` | Public | Liste des groupes et hiérarchies |
| `GET` | `/api/courses` | Public | Répertoire des cours et volumes horaires |
| `GET` | `/api/professors` | Public | Liste des enseignants et charges |
| `GET` | `/api/rooms` | Public | Liste et capacités des salles |
| `GET` | `/api/assignments` | Requis | Liste filtrée des affectations d'horaires |
| `POST` | `/api/assignments` | HOD / Admin | Création d'affectation avec contrôle de conflits |
| `PUT` | `/api/assignments/:id`| HOD / Admin | Mise à jour d'horaire ou de salle |
| `DELETE`| `/api/assignments/:id`| HOD / Admin | Suppression d'une séance |
| `POST` | `/api/conflicts/check`| Requis | Vérification synchrone d'un créneau |
| `GET` | `/api/sandbox` | Admin | Liste des brouillons de plannings |
| `POST` | `/api/sandbox` | Admin | Sauvegarde d'un snapshot de planning |
| `POST` | `/api/sandbox/:id/restore` | Admin | Restauration d'un snapshot vers le planning officiel |
| `GET` | `/api/print-settings` | Public | Récupération des en-têtes et logos officiels |
| `POST` | `/api/print-settings` | Admin | Mise à jour des logos et libellés d'impression |
| `POST` | `/api/upload` | Admin | Upload multipart/form-data (logos/médias) |

---

### 5.2 Matrice des Canaux IPC Electron (Desktop)

| Canal IPC (`invoke`) | Arguments | Retour | Description |
| :--- | :--- | :--- | :--- |
| `get-departments` | Aucun | `Department[]` | Lecture de la table departments |
| `get-groups` | Aucun | `Group[]` | Lecture des groupes |
| `get-assignments` | `academicYear, semester, specialization` | `Assignment[]` | Chargement des créneaux planifiés |
| `add-assignment` | `AssignmentPayload` | `{ id: number }` | Insertion séance après contrôle |
| `check-conflicts` | `CandidateSession` | `ConflictResult` | Exécution locale du moteur de conflits |
| `get-print-settings`| Aucun | `PrintConfig` | Chargement de la config graphique |
| `save-sandbox` | `name, payload` | `{ success: boolean }` | Archivage d'un snapshot local |

---

## 6. Algorithmes Métiers & Moteur de Détection de Conflits

### 6.1 Algorithme de Détection de Chevauchement Temporel
Deux séances $A$ et $B$ sur le même jour de la semaine ($D_A = D_B$) sont en conflit temporel strict si et seulement si :
$$\text{Overlap}(A, B) \iff (Start_A < End_B) \land (End_A > Start_B)$$

### 6.2 Matrice des Règles de Conflits
Pour toute nouvelle séance candidate $C$, le moteur vérifie dans le semestre et l'année académique active :
1. **Conflit Salle** :
   $$\exists S \mid S.room\_id = C.room\_id \land \text{Overlap}(S, C) \implies \mathbf{REJET}$$
2. **Conflit Enseignant** :
   $$\exists S \mid S.professor\_id = C.professor\_id \land \text{Overlap}(S, C) \implies \mathbf{REJET}$$
3. **Conflit Groupe Direct** :
   $$\exists S \mid S.group\_id = C.group\_id \land \text{Overlap}(S, C) \implies \mathbf{REJET}$$
4. **Règle Pédagogique Majeure (Cours Magistral vs TD/TP)** :
   - Si $C$ est un Cours Magistral (CM) pour une spécialité donnée, tous les groupes $G_i \in \text{Specialty}(C)$ sont bloqués.
   - Si une séance $S$ de TD/TP existe pour l'un des groupes de la spécialité pendant $[Start_C, End_C]$, alors la création de $C$ est rejetée.
   - Réciproquement, un TD/TP ne peut être planifié s'il existe déjà un CM de la même spécialité à cet horaire.
5. **Gestion des Dérogations** :
   - Si le flag `ignore_conflicts = 1` est soumis par un profil disposant du droit `OVERRIDE_CONFLICTS`, l'insertion est exécutée avec inscription d'un avertissement dans la table d'audit.

---

## 7. Moteur Typographique Arabe & Génération PDF

### 7.1 Problématique de l'Écriture Bidirectionnelle (Bidi)
L'arabe est une langue cursive s'écrivant de droite à gauche (RTL) où la forme des lettres varie selon leur position (isolée, initiale, médiane, finale). Sans moteur de mise en forme dédié, les bibliothèques PDF standard produisent des lettres inversées et déconnectées.

### 7.2 Pipeline de Restitution Vectorielle
1. **Intégration Fontkit & Polices Spécifiques** :
   - Chargement dynamique des polices `Amiri-Regular.ttf` et `Cairo-Bold.ttf` via `@pdf-lib/fontkit`.
2. **Shaping & Bidi Engine** :
   - Conversion des chaînes arabes en glyphes composés connectés.
   - Inversion de l'ordre visuel des colonnes de l'emploi du temps (Dimanche à gauche, Jeudi/Samedi à droite selon la convention académique arabe).
3. **Assemblage Documentaire** :
   - En-tête officiel vectoriel intégrant les logos d'université et de faculté hébergés ou encodés en Base64.
   - Tableau principal structuré via `jspdf-autotable` avec dimensions fixes de cellules prévenant les chevauchements de texte (*Cell Overlap Fix*).
   - Pied de page contextuel : Mentions légales, code-barres/QR-code de vérification et mention spécifique pour les épreuves d'examen.

---

## 8. Sécurité & Conformité

### 8.1 Protection de la Base de Données
- **Immunité aux Injections SQL** : Interdiction totale de la concaténation de chaînes dans les requêtes SQL. Toutes les commandes utilisent des paramètres nommés ou indexés (`$1, $2, ...` avec `@libsql/client`).
- **Chiffrement au Repos et en Transit** : Connexions TLS 1.3 chiffrées vers Turso Cloud.

### 8.2 Sécurité Applicative
- **Cookies HTTP-Only** : Tokens de session transmis exclusivement via cookies `HttpOnly`, `SameSite: Lax` et `Secure` en environnement de production.
- **Principe de Moindre Privilège Electron** :
  - `nodeIntegration: false` dans tous les renderers.
  - `contextIsolation: true`.
  - Pas d'accès direct à l'API système depuis le code React.

---

## 9. Environnement de Développement, Build & Déploiement

### 9.1 Scripts NPM Clés
- `npm run dev` : Lance concurremment le serveur Vite (port 5173) et l'API Express (port 3001).
- `npm run electron:dev` : Lance Vite + Electron avec rechargement à chaud.
- `npm run build` : Compile le frontend TypeScript en bundle optimisé `dist/`.
- `npm run electron:build` : Génère l'installateur Windows `.exe` via Electron Builder.
- `npm run rebuild` : Recompile les modules natifs (`better-sqlite3`) pour l'ABI d'Electron.

### 9.2 Variables d'Environnement Obligatoires (`.env`)
```bash
# Configuration Base de Données Turso
TURSO_DATABASE_URL=libsql://votre-instance.turso.io
TURSO_AUTH_TOKEN=votre_token_secret_turso

# Configuration Authentification & Serveur
JWT_SECRET=cle_secrete_cryptographique_complexe
PORT=3001
NODE_ENV=production

# Service d'envoi d'e-mails (Optionnel)
EMAIL_HOST=smtp.univ-eloued.dz
EMAIL_PORT=587
EMAIL_USER=notifications@univ-eloued.dz
EMAIL_PASS=mot_de_passe_smtp
```
