# Bilan d'analyse — MOVEDZ / CAMIO EXPRESS

**Date :** 19 novembre 2026
**Cible :** `C:\Users\zakaria\Documents\REA\MOVEDZ`
**Méthode :** REA 6.9.0 (`analyze-javascript-application` + `inspect-analysis-view`) + lecture statique du code source. Aucune exécution de l'application.

---

## 1. Identification

| Champ | Valeur |
|---|---|
| Nom métier | **CAMIO EXPRESS** (`metadata.json`) |
| Description | Plateforme algérienne de logistique, déménagement, évacuation de déchets et fret inter-wilaya (Client, Chauffeur, Administration) |
| Origine | Générée via **Google AI Studio** (README, applet `64abd713-…`) |
| Stack | React 19 + TypeScript 7, Vite 8, Tailwind 4, Express 4, WebSocket (`ws`), Recharts, Motion, lucide-react |
| Taille | 145 fichiers (~18,9 Mo dont 79 images), ~17 690 lignes TS/TSX + ~2 420 lignes de `server.ts` |
| Données | État JSON unique `data/camio-state.json`, réécrit à chaque mutation |

---

## 2. Architecture

```
MOVEDZ/
├── server.ts                 API Express + WebSocket : 55 endpoints, persistance JSON, Vite en dev / dist en prod
├── src/
│   ├── main.tsx, App.tsx     Point d'entrée, 4 onglets (client / chauffeur / admin / aide), i18n FR↔AR, thème
│   ├── api/                  client.ts (fetch + ApiError bilingue), wsClient.ts (reconnexion exponentielle)
│   ├── components/           22 composants React (workspaces, cartes, graphiques, avis, incidents, suivi…)
│   ├── domain/               27 modules métier + 14 fichiers de tests (73 cas)
│   └── assets/images/        79 images (véhicules, services)
```

**Répartition des endpoints :** 43 `POST`, 5 `GET`, 4 `PATCH`, 2 `PUT`, 1 `DELETE` — tous sous `/api/v1/`.

**Domaine couvert :** devis urbains et inter-wilaya, règles de prix (bornes, plancher/plafond), machine à états des courses, offres et contre-offres, enchères automatiques chauffeur (`autoBid`), abonnements/paiements/vouchers, KYC chauffeur, avis, favoris, modèles de trajets, chat, litiges/incidents, audit logs, suivi GPS en direct, géographie des wilayas et matrice de routes.

**Qualités de conception observables :**
- Logique métier **isolée dans `src/domain/`** en fonctions pures, avec **73 tests unitaires**.
- Messages d'erreur **bilingues français/arabe** (`message` / `message_ar`), interface RTL quand `locale === 'ar'`.
- **Sanitizers** explicites avant exposition API (`sanitizeRideForApi`, `sanitizeIntercityForApi`, numéros de plaques masqués).
- Verrouillage métier des coordonnées et du chat avant attribution (`canReveal*Contact`, `canSend*Chat`).
- Journal d'audit borné (200 entrées) et `request_id` sur les erreurs.
- Synchronisation temps réel multi-acteurs via WebSocket avec backoff exponentiel (1 s → 15 s).

---

## 3. Résultats REA

| Métrique | Valeur |
|---|---|
| Fichiers pertinents / analysés | 59 / 55 (0 échec de parsing) |
| Octets de texte lus | 879 922 |
| Nœuds AST visités | **98 581** |
| Findings REA | **1 743** |
| Faits JavaScript paginables | 1 605 |
| Couverture de la vue | 842 / 842 (`complete-within-view`) |
| Inconnus sémantiques explicites | **30 504** |

### Graphe sémantique (relations retenues / inconnus)

| Famille | Relations | Inconnus |
|---|---:|---:|
| data-flow | 34 923 | 20 343 |
| object-flow | 7 111 | 6 427 |
| closure | 3 902 | 0 |
| call-flow | 1 626 | 3 600 |
| boundary | 274 | 8 |
| promise-ownership | 126 | 123 |
| timer | 12 | 1 |
| configuration | 6 | 0 |
| request | 5 | 2 |

REA a notamment identifié les endpoints candidats (`/api/v1/favorites/:driverId/note`, `/api/v1/driver/:id/documents/submit`, …), les imports statiques (`lucide-react`, `../domain/incidents`) et les modules de domaine.

**Artefacts REA à interpréter avec prudence :** les faits `require:setFloorFrom(...)`, `require:setPortersCount(...)` sont des **setters React** que l'extracteur classe comme références `require` — ce sont des limites d'extraction statique, pas des bugs applicatifs. De même `not-found:./src/domain/favorites` dans `server.ts` : le fichier existe bien (`src/domain/favorites.ts`), REA n'a pas résolu le chemin relative au serveur.

---

## 4. Risques et faiblesses (constatations statiques)

| # | Constat | Impact |
|---|---|---|
| 1 | **OTP de démonstration** : `/auth/otp/request` renvoie `demo_code: "00000"` et `/auth/otp/verify` accepte uniquement ce code, avec `role` fourni par le corps de requête | Authentification fictive : n'importe qui peut se connecter en tant que client, chauffeur **ou admin** |
| 2 | **Aucun middleware d'autorisation** sur les 55 endpoints ; `actor`, `role`, `clientId`, `driverId`, `senderRole`, `openedByRole` sont lus dans le body | Usurpation d'identité, modification de courses ou d'avis par n'importe quel appelant |
| 3 | **État dans un fichier JSON en clair**, réécrit intégralement à chaque mutation, sans verrou ni transaction | Perte de mises à jour concurrentes, exposition des données (téléphones, chats, photos en base64) |
| 4 | **WebSocket `/ws` sans contrôle d'origine ni de token** ; n'importe quel client peut envoyer `driver.position.push` / `intercity.position.push` pour un `rideId` arbitraire | Falsification du suivi GPS diffusé à tous les acteurs |
| 5 | **Verrouillage des contacts par statut seulement** (`/rides/:id/contact`, `/intercity/requests/:id/contact`), sans vérification de l'appelant | Une fois la course assignée, les numéros sont accessibles sans preuve d'identité |
| 6 | **Aucun rate limiting global**, pas de validation de schéma centralisée ; seul l'OTP a un compteur en mémoire (réinitialisé au redémarrage) | Abus d'endpoints, entrées mal formées, saturation |
| 7 | **Capacité Gemini déclarée mais non implémentée** : `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` et `GEMINI_API_KEY` dans `.env.example`, mais **0 import de `@google/genai`** dans le code | Écart entre la fiche applet et le livrable réel |
| 8 | Serveur lié à `0.0.0.0:3000`, phones/plaques et données de paiement simulées en clair | Prototype adapté au demo, pas à une mise en production |

---

## 5. Bilan

**Note globale : prototype fonctionnel et structuré, mais sécurité de démonstration.**

| Axe | Appréciation | Commentaire |
|---|---|---|
| Fonctionnalité | ★★★★☆ | Très large couverture métier, bilingue, temps réel, prêt à être démontré |
| Architecture | ★★★★☆ | Séparation domaine/UI/API exemplaire pour un généré par IA ; 73 tests de domaine |
| Maintenabilité | ★★★★☆ | Types partagés, fonctions pures, messages d'erreur structurés |
| Sécurité | ★☆☆☆☆ | OTP codé en dur, absence d'autorisation, état en JSON, WebSocket non authentifié |
| Tests | ★★★☆☆ | Bon socle unitaire domaine, mais aucun test d'intégration API ni de sécurité |

### Recommandations prioritaires

1. Remplacer l'OTP `00000` par un vrai OTP (SMS) avec expiration et retirer `demo_code` de la réponse.
2. Introduire des **sessions authentifiées** (cookie httpOnly ou JWT) et un middleware qui dérive `role`/`actor`/`driverId` de la session — **ne plus jamais les lire dans le body**.
3. Migrer l'état vers une **base de données** avec transactions (SQLite au minimum) ; ne pas exposer le fichier et ne pas stocker les photos en base64 dans l'état.
4. Sécuriser le WebSocket : vérifier l'origine, exiger un token, et n'accepter une position que du chauffeur assigné au trajet.
5. Ajouter un **rate limiting** global et une validation de schéma des bodies (ex. Zod).
6. Arbitrer la capacité Gemini : l'implémenter côté serveur ou la retirer du `metadata.json` / `.env.example`.
7. Ajouter des tests d'intégration sur les endpoints critiques (acceptation d'offre, révélation de contact, annulation).

### Conclusion

MOVEDZ est un **prototype riche et cohérent** : la logique métier algérienne (wilayas, trajets inter-wilaya, abonnements, enchères automatiques) est modélisée avec soin et testée. REA confirme une base saine (98 581 nœuds AST, 0 erreur de parsing, graphe de données dense). Le **point bloquant pour toute mise en production est la sécurité** : le modèle d'authentification/autorisation est une simulation. Les autres points (persistance, WebSocket, Gemini) sont des chantiers d'industrialisation classiques.

---

## Preuves

- `movedz-analysis.json` (104 Mo) — Evidence REA complète
- `movedz-summary.json` — vue résumé
- `movedz-facts.json` — 20 faits JavaScript avec provenance
- `movedz-analysis.err` — journal de progression REA (347 événements)
