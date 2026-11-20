# Analyse rubrique Client — Lalamove (REA) vs MOVEDZ — et correctif

**Date :** 19 novembre 2026
**Sources :** REA sur `Lalamove-116.5.1.apk` (JADX) + analyse statique MOVEDZ.

---

## 1. Ce que REA révèle chez Lalamove (rubrique Client)

Classes et modèles extraits de l'APK :

| Classe / modèle | Rôle |
|---|---|
| `com.deliverysdk.global.ui.deliveryform.DeliveryFormFragment` / `DeliveryFormViewModel` | Formulaire de commande client |
| `com.deliverysdk.global.ui.order.create.CreateOrderViewModel` | Création de commande (`onPlaceOrderClicked`, `handlePlaceOrderAgain`) |
| `com.deliverysdk.global.ui.confirmation.ConfirmationViewModel` | Confirmation (`onPlaceOrderSuccess`, `endPlaceOrder`) |
| `com.deliverysdk.domain.repo.deliveryform.DeliveryFormModel` | Formulaire : `deliveryFormUuid`, `leftSubmissionLimit`, `pickUpAddressInfo`, `pickUpRemarks` |
| `PickupDropOffAddressModel` | `pickUpNote` / `dropOffNote`, `cityId`, 2 adresses |
| **`AddressInformationModel` (24 champs)** | **Le cœur de la saisie adresse** |

### Champs-clés de `AddressInformationModel`
`contactsName`, `contactsPhoneNo`, `houseNumber`, `floor`, `districtName`, `location` (lat/lng), `placeId`, `pickUpNote` / `dropOffNote`, `proofOfDelivery`, `isCashPaymentStop`…

---

## 2. Le souci grave identifié dans MOVEDZ

| Problème | Détail | Risque |
|---|---|---|
| **Aucun contact sur place** | Seul `clientPhone` (le commanditaire) était envoyé ; aucun nom/téléphone du contact départ/arrivée | Le chauffeur ne peut appeler personne à destination |
| **Coordonnées fictives** | `dest.lat + 0.02, dest.lng - 0.01` : décalage arbitraire, pas un vrai point | Le chauffeur arrive à ~2 km du bon endroit |
| **Pas d'adressage structuré** | Adresse = texte libre, pas de n° de porte, pas de quartier | R4 du CDC : « qualité d'adressage — pas de voie nommée » |
| **Consignes fusionnées** | Un seul `clientComment` pour les deux points | Consignes départ et arrivée confondues |

C'était le **scénario métier principal** : sans contact ni point GPS précis, la course échoue sur le terrain.

---

## 3. Correctif implémenté (architecture Lalamove)

### Modèle (`src/domain/types.ts`)
- Nouveau `ServiceContact { name, phone }`
- `RideLocation` enrichi : `houseNumber`, `districtName`, `floor`, `note`, `placeId`, `contact`

### Composant (`src/components/LocationPinPicker.tsx`)
- Mini-carte **cliquable** → vraies coordonnées lat/lng (plus de décalage fictif)
- Affichage des coordonnées, épingle animée, cible

### Formulaire (`ClientWorkspace.tsx`, étape 2)
- **Épinglage** du point de départ et d'arrivée
- **N° de porte / quartier** structurés
- **Contacts départ ET arrivée** (nom + téléphone) distincts du client
- **Consignes séparées** par point
- Envoi de tout cela dans `POST /api/v1/rides` (`pickup` / `dropoff` enrichis, `placeId` dérivé du point épinglé)

### Sécurité (CDC C11 — anti-contournement)
- `sanitizeRideForApi` masque désormais **`contact` et `note`** des deux points tant que la course n'est pas `assigned`
- Les coords et le nom de rue restent visibles ; seuls les numéros/consignes sont verrouillés

---

## 4. Vérifications

- `tsc --noEmit` : **0 erreur**
- Tests domaine : **78/78 passent**
- Navigateur (étape 2 du formulaire urbain) : `Contact au départ` ✅, `N° de porte` ✅, **4 libellés « épingler »** ✅
- Serveur : healthcheck **200**
- Aucune erreur console

---

## 5. Preuve de livraison (proofOfDelivery) — ajoutée

Alignement Lalamove (`AddressInformationModel.proofOfDelivery`) :

| Brique | Fichier | Détail |
|---|---|---|
| Modèle | `types.ts` | `Ride.proofOfDelivery { photoDataUrl, capturedAt, lat, lng, note }` |
| Capture | `ProofOfDeliveryCapture.tsx` | `input capture="environment"` (appareil photo mobile) + compression canvas (1200 px, JPEG 0,72) |
| Chauffeur | `DriverWorkspace.tsx` | Capture obligatoire avant « Encaisser cash & Terminer » (message d'erreur si absente) |
| Serveur | `server.ts` | Stockage de la preuve au passage `completed`, data URL `data:image/` ≤ 1,5 Mo, audit `ride.proof_of_delivery` |
| Client | `ClientWorkspace.tsx` | Affichage de la photo + date/heure + note dans le détail de la course |

**Test de bout en bout validé via API** : création course → offre → acceptation → transitions `driver_arriving → arrived_pickup → loading → in_transit → arrived_dropoff → completed` avec preuve → **`200`, `proof=True`, `capturedAt=2026-11-19T18:46:50Z`**, preuve visible dans `/bootstrap`.

---

## 7. Illustrations 3D des services (pack MOVEDZ fourni)

5 illustrations violettes/orange découpées (fond transparent) dans `src/assets/icons/services/` :

| Service | Illustration |
|---|---|
| Déménagement | Cartons + canapé sur diable |
| Fret | Palette de colis + conteneur |
| Réfrigéré | Camion frigo avec flocon |
| Remorquage | Dépanneuse avec véhicule |
| Déchets & gravats | Camion benne de gravats |

`ServiceIcon.tsx` utilise ces images (repli : plus aucun SVG). Vérifié navigateur : 9 images rendues, 0 cassée, 0 erreur console.

---

## 6. Limites
- Le fond de carte reste vectoriel local (pas de tuiles Mapbox réelles) : les coordonnées sont valides mais la carte est schématique.
- L'APK Lalamove est obfusquée (R8) : les ViewModels exposent des méthodes `zz*` ; l'analyse s'est appuyée sur les **modèles de domaine** (champs) plutôt que sur les corps de méthodes.
