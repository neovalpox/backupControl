# Questions pour le projet BackupControl

Merci pour ce brief détaillé ! Avant de commencer le développement, j'ai quelques questions pour m'assurer de bien répondre à vos besoins.

---

## 1. Authentification et Utilisateurs

- [oui] **Multi-utilisateurs** : L'application doit-elle gérer plusieurs utilisateurs avec des rôles différents (admin, technicien, lecture seule) ?
- [locale] **Authentification** : Souhaitez-vous une authentification locale (username/password) ou une intégration SSO (Azure AD, Google) ?
- [un docker par client] **Multi-tenant** : Si vous vendez le logiciel, chaque client aura-t-il sa propre instance Docker, ou souhaitez-vous une architecture multi-tenant (une seule instance pour plusieurs clients) ?

**Vos réponses :**
```
Répondez ici...
```

---

## 2. Configuration des E-mails

- [boite de reception] **Dossiers e-mail** : Faut-il analyser uniquement la boîte de réception ou aussi d'autres dossiers (ex: un dossier "Sauvegardes") ?
- [non] **Filtrage** : Y a-t-il des expéditeurs spécifiques à surveiller (ex: notifications@synology.com) ou on analyse tout ?
- [conserver les e-mails] **Historique** : Après l'analyse initiale des 500 derniers e-mails, souhaitez-vous conserver les e-mails analysés dans la base ou juste les résultats extraits ?

**Vos réponses :**
```
Répondez ici...
```

---

## 3. Gestion des Clients

- [il faut analyser les e-mails] **Identification client** : Comment identifiez-vous un client dans vos e-mails ? (nom dans le sujet, adresse e-mail spécifique, nom du NAS, autre ?)
- [Oui, on doit pouvoir les pré enregistrer, et leur attribuer un nom court] **Pré-configuration** : Souhaitez-vous pouvoir pré-enregistrer la liste des clients et leurs sauvegardes attendues, ou l'IA doit-elle les découvrir automatiquement ?
- [toutes les infos possible] **Informations client** : Quelles informations stocker par client ? (nom, contact, contrat, SLA, notes...)

**Vos réponses :**
```
Répondez ici...
```

---

## 4. Types de Sauvegardes

Listez les types de sauvegardes que vous gérez (cochez et complétez) :

- [X] Synology Hyper Backup
- [X] Synology Active Backup for Business
- [X] RSync
- [X] Veeam
- [X] Acronis
- [X] Windows Server Backup
- [ ] Autres : _______________

**Question** : Avez-vous des exemples d'e-mails de notification pour chaque type ? (vous pourrez me les fournir plus tard, anonymisés)

**Vos réponses :**
```
Répondez ici...
```

---

## 5. Alertes et Notifications

- [ ] **Canaux d'alerte** : Par quels moyens souhaitez-vous être alerté ? 
  - [X] E-mail
  - [ ] SMS
  - [X] Webhook (Teams, Slack, Discord)
  - [X] Notification push navigateur
  - [X] Autre : Une application flutter qu'on va développer par la suite

- [ ] **Niveaux d'alerte** : Proposition de seuils par défaut, à valider :
  - 🟢 **OK** : Sauvegarde réussie dans les dernières 24h
  - 🟡 **Attention** : Pas de sauvegarde depuis 24-48h
  - 🟠 **Alerte** : Pas de sauvegarde depuis 48-72h
  - 🔴 **Critique** : Pas de sauvegarde depuis +72h

  Ces seuils vous conviennent-ils ? Doivent-ils être configurables par client/sauvegarde ?

  C'est parfait

- [Non] **Rapport automatique** : Souhaitez-vous un rapport quotidien/hebdomadaire envoyé par e-mail ?

**Vos réponses :**
```
Répondez ici...
```

---

## 6. Interface et Dashboard

- [Français / englais] **Langue** : Interface en français uniquement ou multilingue (FR/EN) ?
- [les deux avec toggle] **Thème** : Mode sombre, mode clair, ou les deux avec toggle ?
- [Oui] **Mobile** : L'interface doit-elle être utilisable sur mobile/tablette ?
- [Oui] **Export** : Besoin d'exporter des rapports (PDF, CSV, Excel) ?

**Vos réponses :**
```
Répondez ici...
```

---

## 7. Technique et Déploiement

- [PostgreSQL] **Base de données** : Préférence pour SQLite (simple, fichier unique) ou PostgreSQL (plus robuste, recommandé pour multi-utilisateurs) ?
- [non] **Reverse proxy** : Utiliserez-vous un reverse proxy (Nginx, Traefik) devant l'application ?
- [géréer par l'application en letsencrypt] **HTTPS** : L'application doit-elle gérer ses propres certificats SSL ou ce sera géré en amont ?
- [a toi de me proposer] **Sauvegarde des données** : Comment souhaitez-vous sauvegarder les données de l'application elle-même ?

**Vos réponses :**
```
Répondez ici...
```

---

## 8. IA et Analyse

- [1x par jour] **Fréquence d'analyse** : Une fois par jour suffit-il ? À quelle heure préférez-vous l'exécution ?
- [non] **Coût IA** : Avez-vous une limite de budget pour les appels API IA ? (pour optimiser les requêtes)
- [L'une ou l'autre] **Préférence IA** : Claude ou ChatGPT en priorité ? Ou les deux disponibles au choix ?
- [Dans le dashboard, dans un encart dédié] **Suggestions IA** : Où souhaitez-vous voir les suggestions d'amélioration de l'IA ? (dashboard dédié, notifications, rapport)

**Vos réponses :**
```
Répondez ici...
```

---

## 9. Fonctionnalités Bonus (Nice to have)

Indiquez si ces fonctionnalités vous intéressent (priorité 1-3 ou "non") :

| Fonctionnalité | Priorité |
|----------------|----------|
| Historique des sauvegardes avec graphiques de tendance | | 1
| Calcul automatique de la taille des sauvegardes | | 1
| Estimation de l'espace disque restant | | 1
| Détection des sauvegardes manquantes (pas de mail reçu) | | 1
| API REST pour intégration externe | | 3
| Webhook pour automatisation (Zapier, n8n, etc.) | | 3
| Documentation technique intégrée | | 1
| Mode maintenance (pause des alertes) | | 2
| Commentaires/notes sur les incidents | | 2
| Autre idée : _______________ | |

**Vos réponses :**
```
Répondez ici...
```

---

## 10. Exemples d'E-mails

Pour que l'IA puisse bien analyser vos e-mails, pourriez-vous me fournir (dans un fichier séparé, anonymisé) des exemples de :

1. Un e-mail de sauvegarde **réussie** (Synology Hyper Backup)
2. Un e-mail de sauvegarde **échouée** (Synology Hyper Backup)
3. Un e-mail de sauvegarde **réussie** (Active Backup for Business)
4. Un e-mail de sauvegarde **échouée** (Active Backup for Business)
5. Un e-mail de notification RSync
6. Tout autre format d'e-mail de sauvegarde que vous recevez

---

## Comment répondre ?

1. Éditez ce fichier directement en remplissant les sections "Vos réponses"
2. Cochez les cases qui vous concernent avec [x]
3. Une fois complété, indiquez-moi que c'est prêt et je lancerai le développement

**Temps estimé pour répondre : 15-20 minutes**

---

*Document créé le 05/12/2024 - Projet BackupControl*
