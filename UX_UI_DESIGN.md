# Guide de Conception UX/UI (UX/UI Design) - Djadwal

**Nom du Produit :** Djadwal (نظام إدارة الجداول الأكاديمية)  
**Version :** 28.11.25.Turso  
**Auteur / Lead Design :** Ali Hussain & Équipe Djadwal  
**Statut :** Spécification UX/UI de Référence  
**Date :** 10 Octobre 2026  
**Dépôt :** `djalle2004-eng/Djadwal`  
**Documents Liés :** [PRD.md](file:///c:/perso/suivie%20online%20130425/suivie29092025/hyper-V/suivie/suivie/PRD.md) | [TRD.md](file:///c:/perso/suivie%20online%20130425/suivie29092025/hyper-V/suivie/suivie/TRD.md) | [APPFLOW.md](file:///c:/perso/suivie%20online%20130425/suivie29092025/hyper-V/suivie/suivie/APPFLOW.md)

---

## 1. Philosophie & Principes Directeurs de Conception

L'interface de **Djadwal** est conçue pour répondre aux contraintes ergonomiques strictes d'une application académique à haute densité d'informations.

### 1.1 Principes Fondamentaux
1. **RTL-First & Typographie Arabe Native** :  
   L'expérience utilisateur est pensée de droite à gauche (Right-To-Left) dès la base. Les libellés arabes bénéficient d'un interlettrage soigné et d'un interlignage adapté prévenant tout chevauchement des diacritiques.
2. **Clarté Cognitive & Densité Contrôlée** :  
   Un emploi du temps universitaire comporte des centaines de variables. L'interface hiérarchise visuellement l'information grâce à un code couleur rigoureux (CM vs TD/TP vs Examens) pour une identification en moins d'une seconde.
3. **Feedback Immédiat & Prévention des Erreurs** :  
   Toute action de planification (glisser-déposer, permutation) déclenche une validation visuelle en temps réel (bordure verte = valide, pulsation rouge = collision/conflit).
4. **Continuité d'Usage (Thème Sombre / Clair)** :  
   Le système bascule en un clic entre un mode clair lumineux et un mode sombre à faible contraste agressif, indispensable lors des longues sessions de confection des plannings.

---

## 2. Système de Design (Design Tokens)

### 2.1 Palette de Couleurs & Tokens Sémantiques

#### Couleurs Principales (Brand & UI)
| Nom du Token | Hex (Light) | Hex (Dark) | Rôle dans l'Interface |
| :--- | :--- | :--- | :--- |
| **Primary (Indigo)** | `#4F46E5` (`indigo-600`) | `#6366F1` (`indigo-500`) | Actions principales, onglet actif, boutons CTA |
| **Primary Hover** | `#4338CA` (`indigo-700`) | `#4F46E5` (`indigo-600`) | État au survol des éléments interactifs |
| **Primary Subtle** | `#EEF2FF` (`indigo-50`) | `#312E81` (`indigo-900`) | Fond de sélection, badge actif dans la barre latérale |
| **Surface Background** | `#F9FAFB` (`gray-50`) | `#111827` (`gray-900`) | Fond d'écran global de l'application |
| **Card / Canvas** | `#FFFFFF` | `#1F2937` (`gray-800`) | Conteneurs, cartes, panneaux de la grille |
| **Border Neutral** | `#E5E7EB` (`gray-200`) | `#374151` (`gray-700`) | Lignes de tableau, séparateurs, bordures de cartes |

#### Couleurs de Statut & Pédagogiques
| Rôle Métier | Hex / Classe | Exemple d'Usage |
| :--- | :--- | :--- |
| **Cours Magistral (CM)** | `#3B82F6` (`blue-500`) | Carte de cours bloquant toute la promotion |
| **Travaux Dirigés (TD)** | `#10B981` (`emerald-500`) | Séance en groupe restreint |
| **Travaux Pratiques (TP)** | `#8B5CF6` (`purple-500`) | Séances en laboratoires ou salles machines |
| **Examen Surveillé (فرض محروس)** | `#F59E0B` (`amber-500`) | Épreuve d'évaluation avec note légale |
| **Conflit / Erreur Critique** | `#EF4444` (`rose-500`) | Alerte de chevauchement d'enseignant ou de salle |
| **Enseignant Vacataire / Temporaire** | `#D97706` (`amber-600`) | Badge distinctif pour le suivi de la charge |
| **Mode Bac à Sable (Sandbox)** | `#F59E0B` (`amber-500`) | Bannière d'avertissement de mode brouillon |

---

### 2.2 Typographie & Polices

- **Police Primaire :** `Cairo` (Google Fonts)  
  *Justification :* Excellente lisibilité des glyphes arabes sur écran, proportions géométriques modernes, support complet des chiffres arabes et occidentaux.
- **Police de Repli :** `Amiri`, `Tahoma`, `sans-serif`.
- **Police PDF Vectorielle :** `Amiri-Regular.ttf` & `Cairo-Bold.ttf` embarquées localement.

#### Échelle Typographique (Type Scale)
| Rôle | Taille | Poids (Weight) | Hauteur de ligne | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | `24px` (`1.5rem`) | Bold (700) | `1.3` | Titres des pages principales (Dashboard, Emploi du Temps) |
| **H2 / Section** | `18px` (`1.125rem`)| SemiBold (600) | `1.4` | En-têtes de modules, titres de modales |
| **Body Standard** | `14px` (`0.875rem`)| Regular (400) | `1.5` | Textes courants, lignes de tableaux AG-Grid |
| **Label / Bouton** | `14px` (`0.875rem`)| Medium (500) | `1.2` | Boutons d'action, onglets, en-têtes de colonnes |
| **Caption / Badge**| `12px` (`0.75rem`) | Medium (500) | `1.2` | Codes matières, numéros de salles, statut enseignant |

---

### 2.3 Grille, Élévation & Espacements

- **Grille de Base :** Système à pas de `4px` et `8px` (`p-2`, `p-4`, `p-6`, `p-8`).
- **Arrondis (Border Radius) :**
  - Boutons & Badges : `rounded-md` (`6px`)
  - Cartes & Modales : `rounded-lg` (`8px`) à `rounded-xl` (`12px`)
  - Badges d'état pilules : `rounded-full` (`9999px`)
- **Élévations & Ombres :**
  - `shadow-sm` : Cartes de séances au repos dans la grille
  - `shadow-md` : Carte en cours de survol ou de drag-and-drop
  - `shadow-2xl` : Fenêtres modales et menus déroulants contextuels

---

## 3. Architecture des Gabarits (Layout Architecture)

### 3.1 Anatomie du Shell Applicatif

```
+───────────────────────────────────────────────────────────────────────────────────+
| [Header] Logo Djadwal │ Année: 2025-2026 (S1) │ [Thème ☀️/🌙] │ User: Ali H. [Déconnexion] |
+───────────────────────────────────────────────────┬───────────────────────────────+
|                                                   │ [Barre Latérale RTL - Droite] |
|                                                   │ • لوحة التحكم (Dashboard)      |
|                                                   │ • السنوات الدراسية (Années)    |
|               CANVAS DE CONTENU                   │ • الأساتذة (Enseignants)      |
|             (Largeur dynamique 100%)              │ • المقاييس (Matières)         |
|                                                   │ • التكاليف (Attributions)     |
|   [Bannière Sandbox si activée]                   │ • القاعات (Salles)            |
|   ┌───────────────────────────────────────────┐   │ • الأفواج (Groupes)           |
|   │ ⚠️ وضع التجربة نشط: التغييرات غير محفوظة  │   │ • الحصص (Sessions)            |
|   └───────────────────────────────────────────┘   │ • الجدول الزمني (Schedule)    |
|                                                   │ • القاعات المتاحة (Salles Lib)|
|   [Zone de travail principale : Table / Grille]   │ • عبء العمل (Workload)        |
|                                                   │ • إعدادات الطباعة (Print)     |
|                                                   │ • إدارة المستخدمين (Users)    |
+───────────────────────────────────────────────────┴───────────────────────────────+
```

---

## 4. Spécifications des Composants Clés

### 4.1 La Grille d'Emploi du Temps Interactive (`Schedule`)
La grille temporelle est la vue maîtresse de l'application.

```
+───────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────+
|  اليوم / التوقيت | 08:00-09:30 | 09:30-11:00 | 11:00-12:30 | 14:00-15:30 | 15:30-17:00 |
+───────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────+
| السبت (Samedi) | [Carte CM]  |             | [Carte TD]  |             |             |
| الأحد (Dimanche)|             | [Carte TP]  |             | [Carte CM]  |             |
| الاثنين (Lundi)| [Carte Exam]|             |             |             |             |
| الثلاثاء(Mardi)|             |             |             |             |             |
| الأربعاء (Merc)|             |             |             |             |             |
| الخميس (Jeudi)|             |             |             |             |             |
+───────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────+
```

#### Anatomie d'une Carte de Séance (Session Card)
1. **Bordure Latérale de Type (4px gauche/droite)** :  
   - Bleu = Cours Magistral (CM)
   - Vert = Travaux Dirigés (TD)
   - Violet = Travaux Pratiques (TP)
   - Ambre = Examen Surveillé (فرض محروس)
2. **Titre du Module** : Texte gras 13px en Arabe avec code module en indice.
3. **Badge Enseignant** : Nom de l'enseignant + icône utilisateur (`User`).
4. **Badge Salle** : Numéro ou code salle + capacité affichée.
5. **Indicateurs d'Alerte** :
   - Icône bouclier/warning si le créneau a fait l'objet d'un forçage (`ignore_conflicts`).
   - Mention "فرض محروس" soulignée si examen.

---

### 4.2 Les Tableaux de Données Métier (`AG-Grid Alpine Theme`)
Utilisés pour les listes de professeurs, salles, matières et utilisateurs :
- **Hauteur de ligne :** `44px` pour un confort de lecture optimal.
- **En-têtes :** Fond gris clair (`#F8FAFC`) en mode clair, gris foncé (`#262E3B`) en mode sombre, texte centré-droit.
- **Actions rapides en bout de ligne :** Boutons iconiques groupés (Modifier, Supprimer, Voir l'historique) avec infobulles explicatives.
- **Barre de filtre rapide :** Recherche instantanée multi-champs en temps réel au-dessus du tableau.

---

### 4.3 Les Modales de Confirmation & Gestion des Conflits
Lorsqu'un conflit est détecté lors d'une planification :
- **En-tête de la modale :** Icône d'alerte rouge clignotante avec le titre : *« تعارض في الجدولة »* (Conflit de planification).
- **Corps de texte :** Explication explicite de la ressource en collision :
  - *« الأستاذ [Nom] مبرمج بالفعل في هذا التوقيت في قاعة [Salle]. »*
  - *« القاعة [Salle] محجوزة للفوج [Groupe] في هذه الحصة. »*
- **Actions proposées :**
  - Bouton secondaire : *« إلغاء »* (Annuler - Focus par défaut).
  - Bouton primaire d'exception (soumis à droit) : *« فرض الجدولة وتجاهل التعارض »* (Forcer la planification).

---

## 5. Mode Sombre (Dark Mode Implementation)

Le basculement de thème est géré via `ThemeContext` et injecte la classe `.dark` sur la balise racine HTML.

```css
/* Transition fluide lors du basculement */
body {
  transition: background-color 0.25s ease, color 0.25s ease;
}

/* Contraste ajusté de la grille temporelle en mode sombre */
.dark .schedule-slot {
  background-color: #1F2937;
  border-color: #374151;
}

.dark .schedule-slot:hover {
  background-color: #2D3748;
}
```

---

## 6. Accessibilité (a11y) & Ergonomie Clavier

1. **Raccourcis Clavier Globaux :**
   - `Échap` : Fermeture des modales et annulation du glisser-déposer en cours.
   - `Entrée` : Validation des formulaires.
   - `Ctrl + F` : Focus instantané sur le champ de recherche de la page active.
2. **Navigation au Clavier (Focus Visible) :**
   - Anneau de focus bleu accessible (`focus:ring-2 focus:ring-indigo-500 focus:outline-none`) sur tous les éléments interactifs.
3. **Contrastes Visuels :**
   - Respect strict du ratio de contraste `4.5:1` (WCAG 2.1 AA) pour tous les textes sur fond coloré.

---

## 7. Rendu d'Impression & Fidélité Graphique (Print Styles)

L'écran `/print-settings` permet de configurer l'export officiel :
- **En-tête Institutionnel Symétrique :**
  - Logo Université à droite (vue RTL).
  - Logo Faculté à gauche.
  - Libellés officiels centrés (République Algérienne Démocratique et Populaire, Ministère de l'Enseignement Supérieur, etc.).
- **Garantie Zéro Chevauchement (*Cell Overlap Fix*) :**
  - Dimensions de cellules fixes en millimètres dans `jspdf-autotable`.
  - Césure intelligente des noms d'enseignants longs.
  - Cartouche de signature en bas de page pour le Chef de Département et le Doyen.
