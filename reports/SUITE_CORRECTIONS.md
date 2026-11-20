# Suite des corrections — confiance & transparence (CAMIO + Bricoram)

**Date :** 20 novembre 2026

## Ce qui a été ajouté dans ce lot

| # | Amélioration | Inspiration | Fichiers |
|---|---|---|---|
| 1 | **Score de fiabilité visible** (badge « Excellent / Fiable / Correct / À surveiller / Nouveau » + %) | `reliability_score` CAMIO | `src/domain/trust.ts`, `ReliabilityBadge.tsx`, `ClientWorkspace.tsx`, `DriverWorkspace.tsx` |
| 2 | **Selfie + pièce d'identité** dans le KYC (5 documents au lieu de 4) | `selfie_scan` CAMIO, badge « Identité vérifiée » Bricoram | `DriverSignup.tsx`, `server.ts` |
| 3 | **Écran « Qui êtes-vous ? »** au premier lancement (client / chauffeur), mémorisé en localStorage | `role_selection` CAMIO | `RoleSelection.tsx`, `App.tsx` |
| 4 | **Marques de véhicules** en liste (Hyundai, Renault, Suzuki, Sonacome…) | `brands` / `truck_families` CAMIO | `src/domain/trust.ts`, `DriverSignup.tsx` |
| 5 | **Récap portefeuille** dans l'onglet Abonnement (opérations, validées, vouchers) | `wallet` CAMIO | `DriverWorkspace.tsx`, `App.tsx` |
| 6 | **Avis avec prix réel payé + distance** | Avis Bricoram (« 3 000 DA, 10 km ») | `types.ts`, `TripRatingForm.tsx`, `server.ts`, `DriverReviewsSection.tsx` |
| 7 | **Réponse du chauffeur à un avis** + endpoint `POST /reviews/:id/respond` | Réponses Bricoram | `server.ts`, `DriverReviewsSection.tsx` |
| 8 | **Badge « Identité vérifiée »** public sur les avis | Bricoram | `DriverReviewsSection.tsx`, `server.ts` |
| 9 | **Guide des prix public** (tableau 4-5-6 kDA, 50-70-100 DA/km, 1-2-3 kDA montage) | Bricoram / CDC §20 | `HelpCenter.tsx` |
| 10 | **Reçu imprimable** (remplace PDFium côté web via `window.print()`) | `libpdfium` CAMIO | `ReceiptPrint.tsx`, `ClientWorkspace.tsx` |

## Vérifications
- `tsc --noEmit` : **0 erreur**
- Tests : **86/86 passent**
- Serveur : healthcheck **200**

## Choix métier assumés
- **Pas de paiement Stripe / Google Pay** : le CDC algérien v1 exclut le paiement en ligne (cash, 0 commission).
- **Pas de contact direct client↔chauffeur** affiché : contrairement à Bricoram (annuaire), MOVEDZ reste une plateforme d'enchères avec coordonnées verrouillées avant attribution (CDC C11).
- **Pas de Flutter natif** : l'app reste web, conformément au périmètre initial.
