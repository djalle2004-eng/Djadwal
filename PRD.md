# Document des Exigences Produit (PRD) - Djadwal

**Nom du Produit :** Djadwal (نظام إدارة الجداول الأكاديمية)  
**Version :** 28.11.25.Turso  
**Auteur :** Ali Hussain & Équipe Djadwal  
**Statut :** Validé / En Production  
**Date :** 10 Octobre 2026  
**Dépôt :** `djalle2004-eng/Djadwal`  

---

## 1. Vision et Objectifs du Produit

### 1.1 Contexte & Problématique
Dans les universités et établissements d'enseignement supérieur, la confection et le suivi des emplois du temps constituent un défi logistique complexe :
- Multiplicité des contraintes (disponibilité des enseignants, capacité et type de salles, regroupements d'étudiants, types de séances CM/TD/TP/Examens).
- Risques fréquents de double réservation (enseignant, salle ou groupe planifiés simultanément).
- Difficulté de suivi en temps réel de la charge statutaire et des heures complémentaires des enseignants.
- Besoin d'une édition bilingue (Arabe RTL et Français) et de sorties d'impression officielles conformes aux exigences administratives (logos, en-têtes officiels, mentions légales).

### 1.2 Mission du Produit
**Djadwal** est une suite logicielle intégrée (Desktop Electron, Serveur API Cloud/Hybride, Portail Enseignant Web et Application Mobile) conçue pour automatiser, fiabiliser et simplifier la planification académique, l'affectation des charges pédagogiques et la diffusion des emplois du temps.

### 1.3 Objectifs Stratégiques (KPIs)
- **Taux de conflits zéro** : Détection et blocage proactif de 100 % des conflits stricts (sauf dérogation explicite de forçage).
- **Gain de temps** : Réduction de plus de 70 % du temps nécessaire à l'élaboration de la grille horaire semestrielle.
- **Transparence** : Visibilité immédiate sur les charges horaires des enseignants (permanents et vacataires/temporaires).
- **Accessibilité universelle** : Consultation fluide multi-plateforme (Desktop pour la gestion, Web et Mobile pour la consultation).

---

## 2. Profils Utilisateurs (Personas) & Rôles

| Rôle | Description & Besoins | Permissions Clés |
| :--- | :--- | :--- |
| **Super Administrateur / Doyen / Chef de Scolarité** | Responsable global du système, de la configuration et de la validation finale des plannings. | Accès total : gestion des utilisateurs, permissions, paramètres d'impression/logos, sauvegardes, validation des plannings. |
| **Responsable Pédagogique / Chef de Département** | En charge de l'affectation des cours, de la saisie des maquettes pédagogiques et de la grille horaire de son département. | Gestion des enseignants, cours, groupes, affectations de charges, sessions et plannings de son périmètre. |
| **Enseignant (Permanent / Vacataire)** | Soumet ses vœux et disponibilités, consulte son emploi du temps individuel et son décompte d'heures. | Accès au Portail Web/Mobile : profil, matrice de préférences/disponibilités, consultation de son planning. |
| **Délégué / Étudiant** | Consulte les emplois du temps de sa promotion/groupe et les annonces de rattrapage ou d'examen. | Consultation via l'application mobile ou exports PDF/Web des plannings de groupes. |
| **Administrateur Système (IT)** | Maintenance de l'infrastructure, connectivité base de données, migration et synchronisation. | Paramètres de base de données (Turso, SQLiteCloud), audit logs, sauvegardes et restaurations. |

---

## 3. Architecture Globale du Système

### 3.1 Stack Technologique

```
+-----------------------------------------------------------------------------------+
|                                 ÉCOSYSTÈME DJADWAL                                |
+-----------------------------------------------------------------------------------+
|  [ Electron Desktop ]          [ Web Portal / Takleef ]        [ Mobile Companion ]
|  React 18 + TS + Vite         Next.js 14 + TailwindCSS        React Native / Expo 
|  TailwindCSS + Material-UI    i18n (Arabe / Français)         iOS / Android       
+-----------------------------------------------------------------------------------+
                                         │ (HTTP / REST / IPC)
                                         ▼
+-----------------------------------------------------------------------------------+
|                             SERVEUR API CENTRAL (Node.js / Express)               |
|  - Authentification JWT & Sécurité RBAC                                           |
|  - Moteur de Détection de Conflits                                                |
|  - Génération de Documents PDF & Exports Excel                                    |
|  - Gestion des Médias (Logos Université / Faculté)                                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                             COUCHE DE DONNÉES HYBRIDE                             |
|  - Production : Turso DB (libSQL Serverless / Haute Disponibilité)                |
|  - Secours / Synchronisation : SQLiteCloud                                        |
|  - Local Déconnecté : Better-SQLite3 (Mode embarqué Electron)                     |
+-----------------------------------------------------------------------------------+
```

---

## 4. Exigences Fonctionnelles Détaillées

### 4.1 Authentification, Utilisateurs & Gestion des Droits (RBAC)
- **Authentification sécurisée** : Connexion par identifiant/email et mot de passe chiffré (Bcrypt / Jose JWT).
- **Rôles & Permissions granulaires** : Attribution de droits fins (Lecture seule, Écriture, Forçage de conflits, Administration).
- **Journal d'Audit (Audit Log)** : Traçabilité des actions sensibles (création/suppression de sessions, modifications des affectations, forçages de conflits).

### 4.2 Données Référentielles & Structure Pédagogique
- **Années Académiques & Semestres** :
  - Définition des années académiques (ex: 2025/2026) et semestres (S1, S2, Annuel).
  - Statut actif/archivé avec filtre contextuel global dans toute l'application.
- **Arborescence Pédagogique** :
  - Hiérarchie à 4 niveaux : **Faculté → Département → Spécialité / Filière → Groupes & Sections**.
  - Gestion des promotions et effectifs par groupe.
- **Gestion des Salles & Espaces** :
  - Typologie (Amphithéâtre, Salle de TD, Laboratoire TP, Salle d'examen).
  - Capacité d'accueil et inventaire d'équipements (projecteur, visioconférence, postes PC).
  - Disponibilité en temps réel.
- **Gestion des Matières / Modules** :
  - Code module, intitulé en arabe et français, crédits, coefficient.
  - Découpage par type de volume horaire requis (Cours Magistral, TD, TP).
- **Gestion des Enseignants** :
  - Statut de l'enseignant (Permanent, Associé, Temporaire / Vacataire).
  - Département de rattachement, grade académique, coordonnées.
  - Plafond horaire hebdomadaire et semestriel.

### 4.3 Moteur d'Attribution des Charges (Takleef / تكليف التدريس)
- **Matrice des Vœux & Préférences** :
  - Saisie par l'enseignant de ses souhaits de matières et plages de disponibilité via le portail dédié.
- **Affectation Enseignant-Matière-Groupe** :
  - Interface intuitive de couplage avec validation des quotas d'heures.
  - Suivi en temps réel de la charge couverte par rapport à la maquette pédagogique.
- **Calcul Automatique de la Charge de Travail (Workload)** :
  - Somme des heures planifiées par enseignant.
  - Identification des sous-charges et des heures supplémentaires (heures complémentaires).

### 4.4 Planification des Emplois du Temps (Schedule Engine)
- **Grille Calendaire Interactive** :
  - Affichage ergonomique bilingue avec support complet de la direction RTL (droite à gauche) pour la langue arabe.
  - Navigation dynamique par Département, Spécialité, Groupe, Enseignant ou Salle.
- **Planification par Glisser-Déposer (Drag and Drop)** :
  - Manipulation fluide via `@dnd-kit`.
- **Règles Strictes de Validation des Conflits** :
  1. *Conflit Enseignant* : Un professeur ne peut assurer deux séances au même créneau.
  2. *Conflit Salle* : Une salle ne peut accueillir deux séances distinctes au même créneau (sauf fusion explicite).
  3. *Conflit Groupe* : Un groupe d'étudiants ne peut assister à deux séances simultanées.
  4. *Règle Pédagogique CM vs TD/TP* : Un Cours Magistral (Lecture) pour une promotion bloque l'ensemble des groupes de la spécialité ; aucun TD/TP de la même promotion ne peut être planifié en parallèle.
- **Gestion des Séances d'Examen ("فرض محروس")** :
  - Type de séance dédié aux contrôles et examens surveillés.
  - Règles de surveillance et mentions légales automatiques.
- **Forçage Contrôlé des Conflits** :
  - Option "Ignorer les conflits" (soumise à permission) permettant aux administrateurs de surcharger les règles pour des événements exceptionnels.
- **Mode Bac à Sable (Sandbox / Brouillons)** :
  - Création de versions de travail préliminaires sans impacter le planning officiel publié.
  - Fonctionnalité de comparaison et de publication en un clic.
- **Outils Avancés de Réorganisation** :
  - *Session Move* : Déplacement guidé d'une séance avec suggestion de créneaux libres.
  - *Session Swap* : Échange sécurisé de deux créneaux horaires entre cours ou enseignants.

### 4.5 Système d'Édition, Exportation et Impression
- **Moteur PDF Vectoriel & Typographie Arabe** :
  - Utilisation de polices arabes intégrées (Amiri, Cairo, etc.) garantissant un rendu RTL fidèle sans inversion de lettres.
- **Gestion Centralisée de l'Identité Visuelle** :
  - Téléversement et hébergement des logos (Université, Faculté, Institut).
  - En-tête officiel paramétrable (République, Ministère, Université, Faculté, Année).
- **Types de Documents Générés** :
  - Emploi du temps par Groupe / Promotion.
  - Emploi du temps individuel par Enseignant.
  - Planning d'occupation des Salles.
  - Avis d'examens aux étudiants avec mentions obligatoires (ex: *L'absence à l'examen entraîne la note zéro*).
- **Export Données** :
  - Export tabulaire Excel (.xlsx) pour le traitement administratif et comptable des vacations.

### 4.6 Applications Satellites
- **Portail Enseignant (Web - Takleef)** : Interface autonome Next.js permettant à chaque enseignant de gérer son profil et renseigner ses disponibilités.
- **Application Mobile (React Native / Expo)** : Consultation nomade en temps réel des horaires pour enseignants et étudiants.

---

## 5. Exigences Non-Fonctionnelles (NFR)

### 5.1 Performance & Réactivité
- Temps de rendu de la grille d'emploi du temps complète inférieur à **500 ms**.
- Vérification instantanée des conflits en local lors d'un glisser-déposer (< **50 ms**).
- Temps de génération d'un emploi du temps en PDF vectoriel inférieur à **2 secondes**.

### 5.2 Fiabilité & Résilience des Données
- Reconnexion automatique avec backoff exponentiel vers la base de données distante (Turso/libSQL).
- Sauvegarde locale automatique (cache Better-SQLite3) en cas de coupure réseau pour éviter toute perte de saisie en cours.
- Sauvegardes automatisées de la base de données et procédure de restauration à chaud testée.

### 5.3 Sécurité & Confidentialité
- Chiffrement fort des mots de passe utilisateur via **Bcrypt**.
- Échanges réseau sécurisés en HTTPS / TLS 1.3.
- Protection contre les injections SQL via requêtes préparées systématiques (libSQL/SQLite paramétré).
- Protection des routes API via tokens signés et validation de payload.

### 5.4 Internationalisation (i18n) & Localisation
- Support natif et complet de la langue **Arabe** avec mise en page RTL (Right-to-Left) sans altération visuelle.
- Support natif du **Français** (LTR).
- Formatage localisé des dates, créneaux horaires et libellés administratifs.

---

## 6. Modèle de Données Conceptuel (Entités Majeures)

```text
+---------------------+         +---------------------+         +---------------------+
|    academic_years   | 1     N |      semesters      |         |     departments     |
+---------------------+─────────+---------------------+         +---------------------+
| id (PK)             |         | id (PK)             |                    │ 1
| year_name           |         | academic_year_id(FK)|                    │
| is_current          |         | semester_name (S1/2)|                    ▼ N
+---------------------+         +---------------------+         +---------------------+
                                                                |     specialties     |
                                                                +---------------------+
                                                                           │ 1
                                                                           ▼ N
+---------------------+         +---------------------+         +---------------------+
|     professors      |         |       courses       |         |       groups        |
+---------------------+         +---------------------+         +---------------------+
| id (PK)             |         | id (PK)             |         | id (PK)             |
| name_ar / name_fr   |         | code, name          |         | name                |
| type (perm/temp)    |         | department_id (FK)  |         | specialty_id (FK)   |
| department_id (FK)  |         | credits, hours      |         | capacity            |
+---------------------+         +---------------------+         +---------------------+
           │                               │                               │
           └───────────────────────┬───────┴───────────────────────────────┘
                                   ▼
                        +---------------------+
                        |  course_assignments |
                        +---------------------+
                        | id (PK)             |
                        | professor_id (FK)   |
                        | course_id (FK)      |
                        | group_id (FK)       |
                        | semester_id (FK)    |
                        +---------------------+
                                   │ 1
                                   ▼ N
                        +---------------------+         +---------------------+
                        |      sessions       | N     1 |        rooms        |
                        +---------------------+─────────+---------------------+
                        | id (PK)             |         | id (PK)             |
                        | assignment_id (FK)  |         | name, code          |
                        | day_of_week         |         | capacity, type      |
                        | start_time, end_time|         | building            |
                        | session_type        |         +---------------------+
                        | room_id (FK)        |
                        | is_exam, is_draft   |
                        +---------------------+
```

---

## 7. Cycle de Vie, Déploiement et Roadmap

### 7.1 Environnements Actuels
- **Desktop** : Electron Builder distribuant des binaires Windows (.exe portable / installateur NSIS).
- **Backend API & Web** : Déploiement Render / Vercel relié au cluster Turso (libSQL).
- **Bases de Données** : Turso Database Cloud avec chiffrement au repos.

### 7.2 Prochaines Évolutions Prévues
1. **Algorithme d'Optimisation Automatique (IA / CSP)** : Génération automatique d'un emploi du temps optimal respectant les contraintes lourdes et minimisant les trous dans l'emploi du temps.
2. **Synchronisation Calendrier Étudiant & Enseignant** : Export iCal / Google Calendar synchronisé automatiquement lors de tout changement de salle ou de créneau.
3. **Système de Notification Push & Email** : Alertes automatiques transmises aux professeurs et délégués de groupe lors des reports ou annulations de cours.
4. **Validation Hiérarchique Numérique** : Signature électronique des états d'heures et des plannings par les chefs de département et le doyen.
