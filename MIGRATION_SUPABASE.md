# 🚀 Guide de Migration vers Supabase

Ce guide vous accompagne dans la migration de votre application Djadwal de SQLite vers Supabase.

## 📋 Prérequis

- ✅ Projet Supabase configuré et accessible
- ✅ Node.js 18+ installé
- ✅ Base de données SQLite existante avec des données

## 🔧 Configuration

### 1. Variables d'Environnement

Créez un fichier `.env` à la racine du projet avec :

```env
VITE_SUPABASE_URL=https://kdqpnjeehzaffypahdbi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcXBuamVlaHphZmZ5cGFoZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzgzMTIsImV4cCI6MjA3MjQxNDMxMn0.EEuXzyM14E03TL70vgbAitYYtfitFPcHEN6UyodpwAo
```

### 2. Installation des Dépendances

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-react
```

## 🗄️ Structure de la Base de Données

### Tables Principales

- **professors** : Informations des professeurs
- **courses** : Cours et matières
- **rooms** : Salles de classe
- **groups** : Groupes d'étudiants
- **sessions** : Sessions planifiées
- **departments** : Départements académiques

### Schéma Supabase

```sql
-- Exemple de table professors
CREATE TABLE professors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_title TEXT NOT NULL,
    specialization TEXT NOT NULL,
    weekly_hours INTEGER NOT NULL CHECK (weekly_hours > 0),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔄 Processus de Migration

### 1. Migration Automatique

Exécutez le script de migration :

```bash
# Avec TypeScript
npm run migrate:supabase

# Avec JavaScript
npm run migrate:supabase:js
```

### 2. Vérification des Données

Le script affichera :
- ✅ Nombre d'éléments migrés par table
- ❌ Erreurs éventuelles
- 📊 Résumé de la migration

### 3. Test de Connexion

Accédez au Dashboard pour tester la connexion Supabase avec le composant de test intégré.

## 🧪 Test de la Migration

### Composant de Test

Le composant `SupabaseTest` permet de :
- Tester la connexion à Supabase
- Créer des données de test
- Vérifier le bon fonctionnement

### Vérifications

1. **Connexion** : Test de la connexion à la base
2. **Lecture** : Récupération des données existantes
3. **Écriture** : Création de nouvelles données
4. **Authentification** : Test du système d'auth

## 🚨 Résolution des Problèmes

### Erreurs Courantes

#### 1. Erreur de Connexion
```
❌ Erreur de connexion: Invalid API key
```
**Solution** : Vérifiez la clé API dans `.env`

#### 2. Table Non Trouvée
```
❌ Erreur lors de la création: relation "professors" does not exist
```
**Solution** : Exécutez d'abord le schéma SQL dans Supabase

#### 3. Contraintes Violées
```
❌ Erreur lors de la création: duplicate key value violates unique constraint
```
**Solution** : Vérifiez les contraintes UNIQUE dans vos données

### Logs de Débogage

Activez les logs détaillés dans le script de migration pour identifier les problèmes.

## 🔐 Authentification

### Configuration RLS

```sql
-- Exemple de politique RLS
CREATE POLICY "Users can view own data" ON professors
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

### Gestion des Sessions

L'application gère automatiquement :
- Connexion/déconnexion
- Persistance des sessions
- Changements d'état d'authentification

## 📱 Interface Utilisateur

### Composants Mise à Jour

- ✅ `AuthContext` : Authentification Supabase
- ✅ `SupabaseTest` : Test de connexion
- ✅ Services : API Supabase intégrée

### Navigation

L'interface s'adapte automatiquement :
- État de chargement pendant les requêtes
- Gestion des erreurs d'authentification
- Redirection automatique

## 🚀 Déploiement

### 1. Build de Production

```bash
npm run build
npm run electron:build
```

### 2. Variables d'Environnement

Assurez-vous que les variables Supabase sont configurées en production.

### 3. Vérification

Testez toutes les fonctionnalités après le déploiement.

## 📊 Monitoring

### Dashboard Supabase

Accédez au dashboard Supabase pour :
- Surveiller les performances
- Vérifier les logs
- Gérer les utilisateurs
- Configurer les politiques de sécurité

### Métriques

- Nombre de requêtes
- Temps de réponse
- Utilisation de la base
- Erreurs et exceptions

## 🔄 Rollback

En cas de problème, vous pouvez :

1. **Garder SQLite** : L'ancienne base reste intacte
2. **Restauration** : Utilisez les sauvegardes Supabase
3. **Migration partielle** : Migrez table par table

## 📞 Support

### Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Forum Communautaire](https://github.com/supabase/supabase/discussions)
- [Discord Supabase](https://discord.supabase.com)

### Contact

Pour toute question sur la migration :
1. Vérifiez les logs d'erreur
2. Consultez la documentation
3. Contactez l'équipe de développement

---

## 🎯 Prochaines Étapes

Après la migration réussie :

1. **Tests complets** de toutes les fonctionnalités
2. **Optimisation** des requêtes Supabase
3. **Mise en place** des politiques RLS avancées
4. **Configuration** des webhooks et Edge Functions
5. **Monitoring** et alertes de performance

**Bonne migration ! 🚀**
