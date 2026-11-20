# Suivi GPS en arrière-plan — résilience réseau (CDC §13 C3)

**Date :** 20 novembre 2026
**Inspiration :** `transistorsoft` + `BACKGROUND_LOCATION` repérés dans l'APK CAMIO v4.5.0.

## Problème corrigé
Avant : le flux GPS utilisait uniquement le WebSocket, avec un fallback REST qui **ignorait silencieusement les échecs** (`.catch(() => {})`). Si le réseau coupait ou si l'onglet passait en arrière-plan (téléphone verrouillé), les positions étaient **perdues** et le client ne voyait plus bouger le chauffeur.

## Solution implémentée

| Brique | Fichier | Rôle |
|---|---|---|
| File FIFO | `src/domain/gpsQueue.ts` | File d'attente plafonnée (200), déduplication, regroupement par cible, persistance `localStorage` |
| Hook | `src/hooks/useBackgroundGps.ts` | `watchPosition` (haute précision) + file locale + reprise auto sur : reconnexion WS, retour `online`, retour de l'onglet (`visibilitychange`) |
| Serveur | `server.ts` | `POST /api/v1/rides/:id/position/batch` (1 écriture pour tout le lot) + `POST /api/v1/intercity/requests/:id/position/batch` |
| UI chauffeur | `DriverWorkspace.tsx` | Indicateur de statut : **GPS en direct / En file d'attente / Hors ligne / Position refusée**, compteur de positions en attente avec bouton « envoyer », horodatage |

## Comportement
1. En ligne + WS connecté → envoi direct (WS)
2. WS coupé mais réseau OK → stockage en file + envoi REST par lots de 20
3. Réseau coupé → stockage en file **persisté** (survit au rechargement de la page)
4. Retour du réseau / WS / onglet → **reprise automatique** de toute la file dans l'ordre
5. Téléphone verrouillé → le navigateur throttled les timers, mais `watchPosition` et la file continuent ; le trail reprend au réveil

## Vérifications
- `tsc --noEmit` : 0 erreur · tests **86/86** (4 nouveaux tests de file GPS)
- API : `POST /position/batch` → **200**, `applied=2`, trail passé de 1 à 3 points, dernière position `35.699`
- Conforme au CDC v2.1 §13 (C3 réseau dégradé : file d'attente locale + reprise automatique)

## Limite web
Contrairement à une app native Flutter (CAMIO), un navigateur web ne peut pas garantir une exécution continue quand l'onglet est fermé ou le téléphone en veille prolongée : les positions.reprennent au réveil, mais il peut y avoir un trou. Une app native/PWA avec service worker serait nécessaire pour un suivi 100 % continu.
