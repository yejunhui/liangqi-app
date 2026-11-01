# Liangqi · 两讫

> Comptes clairs, dettes réglées.

**Langues :** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português](README.pt.md) · [Русский](README.ru.md)

**Application en ligne :** https://arksc.cn:8002/workbook/  
**Code source :** [Gitee](https://gitee.com/PharaohMan/liangqi-app) · [GitHub](https://github.com/yejunhui/liangqi-app)  
**Licence :** AGPL-3.0-or-later

Liangqi est une **application web de comptabilité partagée local-first** qui sépare les dépenses en espèces des achats à crédit :

- Les **dépenses en espèces** sont déduites immédiatement de l’épargne.
- Les **achats à crédit** ne touchent pas l’épargne : ils augmentent le passif et sont comptés en dépense au moment du remboursement.
- Le **remboursement** transfère de l’actif vers le passif et enregistre la dépense à cette date.

Les données restent dans le navigateur par défaut. Vous pouvez gérer plusieurs livres et connecter un dépôt GitHub, Gitee ou WebDAV pour partager un livre entre plusieurs membres.

![Tableau de bord Liangqi](docs/screenshots/dashboard.png)

## Fonctionnement

| Opération | Actifs / épargne | Passifs | Dépense |
| --- | ---: | ---: | ---: |
| Achat en espèces | −100 | 0 | +100 |
| Achat à crédit | 0 | +100 | 0 |
| Remboursement | −100 | −100 | +100 |
| Prêt reçu | +100 | +100 | 0 |

- Un achat à crédit augmente seulement le passif ; **il n’est pas compté comme dépense à l’achat**.
- Le remboursement enregistre la dépense à hauteur du montant remboursé.
- Actif net = actifs − passifs. Un achat à crédit le réduit en augmentant le passif ; le remboursement ne le change pas.

## Fonctions principales

- **Plusieurs livres** : famille, voyage, activité, etc.
- **Comptes d’actif et de passif** : espèces, banque, carte de crédit, Huabei, prêts, avec solde initial.
- **Factures** : nom, catégorie, échéance, remboursement partiel, statut.
- **Remboursements** : depuis un compte d’actif, avec réduction simultanée du passif et de l’épargne.
- **Membres** : rattachement des factures et écritures aux membres de la famille ; connexion par membre dans les livres partagés.
- **Étiquettes et catégories à deux niveaux** : contexte, usage, personne ; catégories parentes/enfants.
- **Budgets et écritures récurrentes** : mensuels ou annuels, par catégorie, étiquette ou membre.
- **Import CSV** : WeChat, Alipay et banques, avec détection automatique des colonnes.
- **Multidevise et pièces jointes** : taux de change, montant d’origine, fichiers jusqu’à 10 Mo.
- **Analyses et rapports** : évolution, catégories, étiquettes, membres, tendance sur 6 mois, CSV et PDF.
- **Assistant IA** : avec une API compatible OpenAI, analyse le livre et propose des budgets.
- **PWA et hors ligne** : installation sur ordinateur ou mobile, ouverture hors ligne de l’interface.
- **10 langues** : chinois simplifié et traditionnel, anglais, japonais, coréen, espagnol, français, allemand, portugais et russe.

## Démarrage rapide

Utilisez l’application en ligne ou lancez-la localement :

```bash
pnpm install
pnpm dev
```

Compilation :

```bash
pnpm build:workbook
```

Le guide de déploiement détaillé est dans [docs/deployment.md](docs/deployment.md) (en chinois).

## Données et confidentialité

- Le livre est stocké dans **IndexedDB**, avec `localStorage` comme secours.
- Avec un dépôt distant, les données restent dans votre dépôt GitHub / Gitee ou votre WebDAV. Liangqi n’a pas de serveur de données.
- Les mots de passe des membres sont stockés uniquement sous forme de **hachage PBKDF2**, jamais en clair.
- Les jetons et clés d’API IA restent dans le `localStorage` de l’appareil et ne passent pas par les serveurs de Liangqi.
- Effacer les données du navigateur supprime le livre local. Exportez régulièrement une sauvegarde.

## Soutenir le projet

Si Liangqi vous aide, vous pouvez soutenir le développement avec Alipay ou WeChat :

| Alipay | WeChat |
| --- | --- |
| <img src="public/support/alipay-qr.jpg" alt="QR Alipay" width="200" /> | <img src="public/support/wechat-qr.jpg" alt="QR WeChat" width="200" /> |

## Licence

Publié sous **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. Voir [LICENSE](LICENSE) pour le texte complet.

- Vous pouvez utiliser, modifier et redistribuer le programme.
- Si vous distribuez une version modifiée, vous devez fournir le code source correspondant et le texte de la licence.
- Si vous modifiez le programme et le mettez à disposition sur un réseau, l’article 13 de l’AGPL exige de fournir le code source correspondant aux utilisateurs.
- Les versions précédentes ont été publiées sous GPL-3.0-or-later. Ces autorisations restent valables.

Voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) pour les licences tierces.

## Avertissement

Liangqi est un outil de comptabilité, pas un conseil financier, fiscal ou en investissement. Exportez une sauvegarde avant utilisation. Les auteurs ne sont pas responsables des pertes de données, erreurs de calcul ou dommages liés à l’utilisation du logiciel.
