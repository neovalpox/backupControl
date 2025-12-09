# BackupControl 🛡️

> Interface web de gestion et supervision des sauvegardes pour entreprises de services informatiques

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)

## 📋 Description

BackupControl est une application web complète pour superviser et gérer les sauvegardes de multiples clients. Elle analyse automatiquement les emails de notification des NAS (Synology, QNAP, etc.) grâce à l'IA (Claude/GPT) et fournit un tableau de bord centralisé avec alertes et statistiques.

## 🚀 Fonctionnalités

- 📧 **Lecture automatique des emails** - Support IMAP, Office 365 et Gmail
- 🤖 **Analyse IA des emails** - Extraction automatique du statut, client et type de sauvegarde
- 📊 **Dashboard interactif** - Vue d'ensemble des sauvegardes avec graphiques
- 🔔 **Système d'alertes** - Notifications par email et Telegram
- 👥 **Multi-clients** - Gestion de plusieurs clients avec SLA personnalisés
- 🌐 **Multi-langues** - Interface en français et anglais
- 🌙 **Thème sombre/clair** - Personnalisation de l'interface
- 🔐 **Multi-utilisateurs** - Rôles admin, technicien et lecture seule
- 🐳 **Docker ready** - Déploiement facile sur Synology NAS

## 📦 Types de sauvegardes supportés

- Synology Hyper Backup
- Synology Active Backup for Business
- RSync
- Veeam
- Acronis
- Windows Server Backup

## 🐳 Installation rapide (Docker)

### Prérequis

- Docker & Docker Compose
- Un nom de domaine (pour SSL Let's Encrypt)
- Clé API Claude (Anthropic) ou OpenAI

### Étapes

1. **Cloner et configurer**
```bash
git clone https://github.com/votre-repo/backupcontrol.git
cd backupcontrol
cp .env.example .env
nano .env  # Éditez avec vos paramètres
```

2. **Configuration minimale (.env)**
```env
DB_PASSWORD=votre_mot_de_passe_securise
SECRET_KEY=votre_cle_secrete_32_caracteres
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
EMAIL_HOST=imap.votre-serveur.com
EMAIL_USERNAME=backups@votre-domaine.com
EMAIL_PASSWORD=mot_de_passe_email
DOMAIN=backup.votre-domaine.com
LETSENCRYPT_EMAIL=admin@votre-domaine.com
```

3. **Lancer l'application**
```bash
# Mode production (avec SSL)
./scripts/init-ssl.sh
docker-compose up -d

# Mode développement (sans SSL)
docker-compose -f docker-compose.dev.yml up -d
```

4. **Accéder à l'interface**
- HTTP : http://localhost
- HTTPS : https://votre-domaine.com (si configuré)

### Premier démarrage

1. Connectez-vous avec les identifiants par défaut :
   - **Email** : admin@backupcontrol.local
   - **Mot de passe** : admin123

2. ⚠️ **Changez immédiatement le mot de passe admin !**

3. Configurez votre compte e-mail dans les paramètres

4. Ajoutez votre clé API IA (Claude ou OpenAI)

5. Lancez la première analyse

## 🔧 Configuration

### Variables d'environnement principales

| Variable | Description | Exemple |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | `MonMotDePasse123` |
| `SECRET_KEY` | Clé JWT (32+ caractères) | `abc123...` |
| `AI_PROVIDER` | Provider IA | `claude` ou `openai` |
| `CLAUDE_API_KEY` | Clé API Anthropic | `sk-ant-...` |
| `EMAIL_TYPE` | Type de compte mail | `imap`, `office365`, `gmail` |
| `DOMAIN` | Domaine pour SSL | `backup.example.com` |

### Configuration HTTPS (Let's Encrypt)

1. Définissez votre domaine dans `.env` :
```env
DOMAIN=backup.votredomaine.com
LETSENCRYPT_EMAIL=admin@votredomaine.com
```

2. Lancez le script d'initialisation SSL :
```bash
./scripts/init-ssl.sh
```

## 📊 Architecture

```
backupcontrol/
├── backend/           # API FastAPI (Python)
├── frontend/          # Interface React + Vite
├── nginx/             # Configuration reverse proxy
├── scripts/           # Scripts utilitaires
├── docker-compose.yml
└── .env.example
```

## 🔒 Sécurité

- Authentification JWT
- Mots de passe hashés (bcrypt)
- HTTPS avec Let's Encrypt
- Variables sensibles isolées dans `.env`
- Pas d'exposition directe de la base de données

## 📱 API REST

Documentation Swagger disponible sur `/api/docs`

## 🆘 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.

## 📄 Licence

MIT License - Libre d'utilisation et de modification.
